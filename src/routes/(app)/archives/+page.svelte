<script lang="ts">
	import { depot, type Archivable } from '#lib/donnees/depot.svelte.ts';
	import { peutSupprimer, peutValider, peutVoirArchives } from '#lib/donnees/regles.ts';
	import { date, dateHeure, libelleMois, montant, taille } from '#lib/format.ts';
	import type { CodeVolet, Utilisateur } from '#lib/donnees/types.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import Avatar from '#lib/composants/ui/Avatar.svelte';
	import EtiquetteVolet from '#lib/composants/ui/EtiquetteVolet.svelte';
	import './archives.css';

	interface ElementArchive {
		type: Archivable;
		id: string;
		libelle: string;
		detail: string | null;
		volet: CodeVolet;
		archive_le: string;
		auteur: Utilisateur | null;
	}

	const TYPES: { type: Archivable; libelle: string; pluriel: string }[] = [
		{ type: 'activite', libelle: 'Activité', pluriel: 'Activités' },
		{ type: 'tache', libelle: 'Tâche', pluriel: 'Tâches' },
		{ type: 'indicateur', libelle: 'Indicateur', pluriel: 'Indicateurs' },
		{ type: 'depense', libelle: 'Dépense', pluriel: 'Dépenses' },
		{ type: 'justificatif', libelle: 'Justificatif', pluriel: 'Justificatifs' }
	];
	const libelleType = (t: Archivable) => TYPES.find((x) => x.type === t)!.libelle;

	const etat = $derived(depot.etat);
	const u = $derived(depot.utilisateur);
	const voit = $derived(peutVoirArchives(u));
	const restaure = $derived(peutValider(u));
	const supprime = $derived(peutSupprimer(u));

	/** Auteur de l'archivage : dernier événement « element_archive » sur cette cible (journal du plus récent au plus ancien). */
	function auteurArchivage(id: string): Utilisateur | null {
		const ev = etat.journal.find((e) => e.type === 'element_archive' && e.cible.id === id);
		return ev ? (etat.utilisateurs.find((x) => x.id === ev.auteur) ?? null) : null;
	}

	const elements = $derived.by<ElementArchive[]>(() => {
		const liste: ElementArchive[] = [];
		const ajouter = (type: Archivable, id: string, volet: CodeVolet, archive_le: string, libelle: string, detail: string | null) =>
			liste.push({ type, id, volet, archive_le, libelle, detail, auteur: auteurArchivage(id) });
		for (const a of etat.activites) if (a.archive_le) ajouter('activite', a.id, a.volet, a.archive_le, `${a.numero} ${a.libelle}`, a.budget_planifie ? `Budget planifié ${montant(a.budget_planifie, etat.projet.devise)}` : null);
		for (const t of etat.taches) {
			if (!t.archive_le) continue;
			const act = etat.activites.find((a) => a.id === t.activite_id);
			ajouter('tache', t.id, t.volet, t.archive_le, t.libelle, act ? `Activité ${act.numero}` : null);
		}
		for (const i of etat.indicateurs) if (i.archive_le) ajouter('indicateur', i.id, i.volet, i.archive_le, i.libelle, i.code_cbpf);
		for (const d of etat.depenses) if (d.archive_le) ajouter('depense', d.id, d.volet, d.archive_le, d.libelle, `${montant(d.montant, etat.projet.devise)} · ${libelleMois(d.mois)}`);
		for (const j of etat.justificatifs) if (j.archive_le) ajouter('justificatif', j.id, j.volet, j.archive_le, j.nom_fichier, `${taille(j.taille)} · ${libelleMois(j.mois)}`);
		return liste.sort((a, b) => b.archive_le.localeCompare(a.archive_le));
	});

	let filtre = $state<Archivable | 'tous'>('tous');
	const visibles = $derived(filtre === 'tous' ? elements : elements.filter((e) => e.type === filtre));
	const compte = (t: Archivable) => elements.filter((e) => e.type === t).length;

	const voletDe = (code: CodeVolet) => etat.volets.find((v) => v.code === code);
	const libelleSecteur = (code: string) => etat.secteurs.find((s) => s.code === code)?.libelle_court ?? code;

	let erreur = $state<string | null>(null);
	let message = $state<string | null>(null);

	function restaurer(e: ElementArchive) {
		erreur = null;
		message = null;
		try {
			depot.restaurer(e.type, e.id);
			message = `Élément restauré : « ${e.libelle} » réapparaît dans le volet ${e.volet}.`;
		} catch (err) {
			erreur = err instanceof Error ? err.message : String(err);
		}
	}

	/* ---------- Suppression définitive (super-administrateur) ---------- */
	let aSupprimer = $state<ElementArchive | null>(null);
	let confirmation = $state('');
	let erreurDialogue = $state<string | null>(null);
	const confirme = $derived(confirmation.trim() === 'SUPPRIMER');

	function ouvrirSuppression(e: ElementArchive) {
		confirmation = '';
		erreurDialogue = null;
		aSupprimer = e;
	}

	function fermerSuppression() {
		aSupprimer = null;
		confirmation = '';
		erreurDialogue = null;
	}

	function supprimer() {
		if (!aSupprimer || !confirme) return;
		const e = aSupprimer;
		try {
			depot.supprimerDefinitivement(e.type, e.id);
			message = `« ${e.libelle} » a été supprimé définitivement. L’opération est inscrite au journal.`;
			erreur = null;
			fermerSuppression();
		} catch (err) {
			erreurDialogue = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<svelte:head><title>Archives · Suivi consortium APSUD</title></svelte:head>

<div class="p-archives">
	<header class="p-archives__tete">
		<h1 class="p-archives__titre">Archives</h1>
		<p class="p-archives__intro">
			Un élément archivé disparaît des volets, des calculs et des exports, mais il est conservé avec tout son historique. La coordination APSUD peut le restaurer à tout moment.
		</p>
	</header>

	{#if !voit}
		<EtatVide icone="cadenas" titre="Archives réservées à la coordination APSUD" texte="Seuls la coordination APSUD et le super-administrateur consultent et restaurent les éléments archivés. Pour retrouver un élément, contactez la coordination." />
	{:else}
		{#if erreur}
			<Alerte variante="erreur" titre="Action impossible" onfermer={() => (erreur = null)}>{erreur}</Alerte>
		{/if}
		{#if message}
			<Alerte variante="succes" onfermer={() => (message = null)}>{message}</Alerte>
		{/if}

		{#if elements.length === 0}
			<EtatVide icone="archive" titre="Aucun élément archivé" texte="Quand une ONG ou la coordination archive une activité, une tâche, un indicateur, une dépense ou un justificatif, il apparaît ici et peut être restauré." />
		{:else}
			<Panneau titre="Éléments archivés" sousTitre="{elements.length} élément{elements.length > 1 ? 's' : ''}, du plus récent au plus ancien." id="archives" sansMarge>
				<div class="p-archives__filtres" role="group" aria-label="Filtrer par type">
					<button type="button" class="p-archives__filtre" aria-pressed={filtre === 'tous'} onclick={() => (filtre = 'tous')}>
						Tout <span class="p-archives__compte">{elements.length}</span>
					</button>
					{#each TYPES as t (t.type)}
						{@const n = compte(t.type)}
						{#if n}
							<button type="button" class="p-archives__filtre" aria-pressed={filtre === t.type} onclick={() => (filtre = t.type)}>
								{t.pluriel} <span class="p-archives__compte">{n}</span>
							</button>
						{/if}
					{/each}
				</div>
				<div class="p-archives__defilement">
					<table class="p-archives__table">
						<caption class="u-visuellement-masque">Éléments archivés{filtre === 'tous' ? '' : ` : ${TYPES.find((t) => t.type === filtre)?.pluriel.toLowerCase()}`}</caption>
						<thead>
							<tr>
								<th scope="col">Type</th>
								<th scope="col">Libellé</th>
								<th scope="col">Volet</th>
								<th scope="col">Archivé le</th>
								<th scope="col">Archivé par</th>
								<th scope="col"><span class="u-visuellement-masque">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{#each visibles as e (e.type + e.id)}
								{@const v = voletDe(e.volet)}
								<tr>
									<td class="p-archives__type">{libelleType(e.type)}</td>
									<th scope="row" class="p-archives__libelle">
										<span>{e.libelle}</span>
										{#if e.detail}<span class="p-archives__detail">{e.detail}</span>{/if}
									</th>
									<td>
										{#if v}<EtiquetteVolet variante="puce" secteur={v.secteur} organisation={v.organisation} libelleSecteur={libelleSecteur(v.secteur)} />{:else}{e.volet}{/if}
									</td>
									<td class="p-archives__date"><time datetime={e.archive_le} title={dateHeure(e.archive_le)}>{date(e.archive_le)}</time></td>
									<td>
										{#if e.auteur}
											<span class="p-archives__auteur">
												<Avatar initiales={e.auteur.initiales} nom={e.auteur.nom} organisation={e.auteur.organisation} />
												<span aria-hidden="true">{e.auteur.nom}</span>
												<span class="u-attenue">({e.auteur.organisation})</span>
											</span>
										{:else}
											<span class="u-attenue">Non retrouvé au journal</span>
										{/if}
									</td>
									<td class="p-archives__actions">
										<div class="p-archives__boutons">
										{#if restaure}
											<Bouton variante="secondaire" taille="sm" icone="restaurer" onclick={() => restaurer(e)} aria-label="Restaurer « {e.libelle} »">Restaurer</Bouton>
										{/if}
										{#if supprime}
											<Bouton variante="danger" taille="sm" icone="supprimer" onclick={() => ouvrirSuppression(e)} aria-label="Supprimer définitivement « {e.libelle} »">Supprimer définitivement</Bouton>
										{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Panneau>
			{#if !supprime}
				<p class="p-archives__note">La suppression définitive est réservée au super-administrateur. Ici, on restaure ou on laisse archivé.</p>
			{/if}
		{/if}
	{/if}
</div>

<Dialogue ouvert={aSupprimer !== null} titre="Supprimer définitivement cet élément ?" onfermer={fermerSuppression}>
	{#if aSupprimer}
		<p>
			{libelleType(aSupprimer.type)} <strong>« {aSupprimer.libelle} »</strong> (volet {aSupprimer.volet}) sera retiré de la plateforme. Cette opération ne peut pas être annulée.
		</p>
		<p class="p-archives__rappel">
			Elle est inscrite au journal d’audit avec votre nom, la date et le contenu supprimé. Pour simplement le garder hors de vue, laissez-le archivé.
		</p>
		{#if erreurDialogue}
			<Alerte variante="erreur">{erreurDialogue}</Alerte>
		{/if}
		<Champ id="confirmation-suppression" libelle="Pour confirmer, tapez SUPPRIMER" bind:valeur={confirmation} requis aide="En majuscules, sans guillemets." />
	{/if}
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={fermerSuppression}>Annuler</Bouton>
		<Bouton variante="danger" icone="supprimer" disabled={!confirme} onclick={supprimer}>Supprimer définitivement</Bouton>
	{/snippet}
</Dialogue>
