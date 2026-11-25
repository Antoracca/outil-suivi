<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { date, taille } from '#lib/format.ts';
	import type { CodeVolet, Justificatif, Mois } from '#lib/donnees/types.ts';
	import { FORMATS_JUSTIFICATIF } from '#lib/donnees/regles.ts';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './PanneauJustificatifs.css';

	/**
	 * Pièces justificatives d'un mois.
	 * - Onglet Indicateurs : pièces rattachées à un indicateur (en plus de celles déposées sur chaque moyen de vérification).
	 * - Onglet Activités : toutes les pièces du mois, pour le contrôle par APSUD ; on y joint
	 *   une pièce pour une activité ou pour le rapport en général.
	 */
	interface Props {
		volet: CodeVolet;
		mois: Mois;
		modifiable: boolean;
		portee: 'indicateurs' | 'activites';
		/** Ligne pré-choisie (identifiant d'indicateur ou d'activité), par exemple depuis une carte. */
		rattachement?: string;
	}
	let { volet: code, mois, modifiable, portee, rattachement = $bindable('') }: Props = $props();

	const etat = $derived(depot.etat);
	const indicateurs = $derived(etat.indicateurs.filter((i) => i.volet === code && !i.archive_le));
	const activites = $derived(etat.activites.filter((a) => a.volet === code && !a.archive_le));
	const tous = $derived(etat.justificatifs.filter((j) => j.volet === code && j.mois === mois && !j.archive_le));
	const liste = $derived(portee === 'indicateurs' ? tous.filter((j) => j.rattachement.type === 'indicateur') : tous);

	const court = (t: string) => (t.length > 70 ? t.slice(0, 70) + '…' : t);
	const options = $derived(
		portee === 'indicateurs'
			? [{ valeur: '', libelle: 'Choisir l’indicateur…' }, ...indicateurs.map((i) => ({ valeur: i.id, libelle: court(i.libelle) }))]
			: [{ valeur: '', libelle: 'Le rapport du mois (général)' }, ...activites.map((a) => ({ valeur: a.id, libelle: `Activité ${a.numero} : ${court(a.libelle)}` }))]
	);
	const moyens = $derived.by(() => {
		if (portee === 'indicateurs') {
			const ind = indicateurs.find((i) => i.id === rattachement);
			return ind ? ind.moyens_verification : [...new Set(indicateurs.flatMap((i) => i.moyens_verification))].slice(0, 30);
		}
		return [...new Set(indicateurs.flatMap((i) => i.moyens_verification))].slice(0, 30);
	});

	let fichier = $state<File | null>(null);
	let moyen = $state('');
	let champFichier: HTMLInputElement | undefined = $state();
	let erreur = $state<string | null>(null);
	let succes = $state<string | null>(null);
	const pret = $derived(!!fichier && (portee === 'activites' || !!rattachement));

	function cible(): Justificatif['rattachement'] {
		if (portee === 'indicateurs') return { type: 'indicateur', id: rattachement };
		if (rattachement) return { type: 'activite', id: rattachement };
		return { type: 'rapport', id: etat.rapports.find((r) => r.volet === code && r.mois === mois)?.id ?? `${code}:${mois}` };
	}

	function joindre() {
		if (!fichier || !pret) return;
		erreur = null;
		succes = null;
		try {
			depot.ajouterJustificatif(code, mois, cible(), { nom: fichier.name, type: fichier.type, taille: fichier.size }, moyen || null, fichier);
			succes = 'Justificatif ajouté.';
			fichier = null;
			moyen = '';
			if (champFichier) champFichier.value = '';
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
	}

	function libelleRattachement(j: Justificatif): string {
		if (j.rattachement.type === 'indicateur') return `indicateur : ${indicateurs.find((i) => i.id === j.rattachement.id)?.libelle ?? 'archivé'}`;
		if (j.rattachement.type === 'activite') return `activité ${activites.find((a) => a.id === j.rattachement.id)?.numero ?? 'archivée'}`;
		if (j.rattachement.type === 'depense') return 'dépense';
		return 'rapport du mois';
	}
</script>

<Panneau
	titre="Justificatifs"
	sousTitre={portee === 'indicateurs'
		? 'Pièces qui prouvent les valeurs des indicateurs : les moyens de vérification du cadre logique.'
		: 'Toutes les pièces du mois : fiches de présence, listes d’émargement, photos, rapports.'}
>
	{#if liste.length}
		<ul class="c-justifs__liste" role="list">
			{#each liste as j (j.id)}
				<li class="c-justifs__fichier">
					<Icone nom="justificatif" />
					<span class="c-justifs__nom">{j.nom_fichier}</span>
					<span class="c-justifs__detail">{taille(j.taille)} · {depot.nomUtilisateur(j.auteur)}, {date(j.date)}{j.moyen_verification ? ` · ${j.moyen_verification}` : ''} · {libelleRattachement(j)}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<EtatVide icone="justificatif" titre="Aucun justificatif pour ce mois" texte={modifiable ? 'Joignez les pièces qui prouvent les chiffres saisis.' : 'L’ONG n’a pas encore joint de pièce.'} />
	{/if}
	{#if modifiable}
		{#if erreur}<Alerte variante="erreur" onfermer={() => (erreur = null)}>{erreur}</Alerte>{/if}
		{#if succes}<Alerte variante="succes" onfermer={() => (succes = null)}>{succes}</Alerte>{/if}
		<div class="c-justifs__joindre">
			<div class="c-justifs__champ-fichier">
				<label for="fichier-justificatif-{portee}">Document <span class="c-justifs__formats">(PDF, Word, Excel… pas de photo)</span></label>
				<input id="fichier-justificatif-{portee}" bind:this={champFichier} type="file" accept={FORMATS_JUSTIFICATIF} onchange={(e) => (fichier = e.currentTarget.files?.[0] ?? null)} />
			</div>
			<Champ
				id="rattachement-justificatif-{portee}"
				libelle="Prouve quoi ?"
				type="select"
				bind:valeur={rattachement}
				{options}
				aide={portee === 'indicateurs' ? 'Pour une pièce prévue au cadre logique, utilisez plutôt la case du moyen de vérification sur la carte.' : undefined}
			/>
			<Champ id="moyen-justificatif-{portee}" libelle="Moyen de vérification" type="select" bind:valeur={moyen} options={[{ valeur: '', libelle: 'Choisir…' }, ...moyens.map((m) => ({ valeur: m, libelle: m }))]} />
			<Bouton variante="secondaire" icone="televerser" disabled={!pret} onclick={joindre}>Joindre</Bouton>
		</div>
		{#if depot.source === 'demo'}
			<p class="c-justifs__note">Démonstration : seul le nom du fichier est conservé.</p>
		{/if}
	{/if}
</Panneau>
