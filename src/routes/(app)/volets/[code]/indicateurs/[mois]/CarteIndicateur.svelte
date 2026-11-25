<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { cumul, historique, valeurCourante } from '#lib/donnees/calculs.ts';
	import { dateHeure, lireNombre, nombre, pourcent } from '#lib/format.ts';
	import type { Desagregation, Indicateur, Mois } from '#lib/donnees/types.ts';
	import JaugeJalon from '#lib/composants/ui/JaugeJalon.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import MoyensVerification from '#lib/composants/donnees/MoyensVerification.svelte';
	import './CarteIndicateur.css';

	/**
	 * Saisie du réalisé du mois pour UN indicateur (DESIGN.md, saisie du mois) :
	 * bandes Planifié (verrouillée) / Ce mois (saisie) / Cumul (calculé), total calculé,
	 * enregistrement automatique à la sortie de chaque case, versions conservées.
	 */
	interface Props {
		indicateur: Indicateur;
		mois: Mois;
		modifiable: boolean;
		numero: string;
	}
	let { indicateur: ind, mois, modifiable, numero }: Props = $props();
	const pct = $derived(ind.type_valeur === 'pourcentage');
	const val = (n: number | null | undefined) => (pct ? pourcent(n ?? null) : nombre(n ?? null));

	type Cle = 'femmes' | 'filles' | 'hommes' | 'garcons' | 'total';
	const COLONNES: { cle: Cle; libelle: string }[] = [
		{ cle: 'femmes', libelle: 'Femmes' },
		{ cle: 'filles', libelle: 'Filles' },
		{ cle: 'hommes', libelle: 'Hommes' },
		{ cle: 'garcons', libelle: 'Garçons' }
	];

	const courante = $derived(valeurCourante(depot.etat, ind.id, mois));
	const precedent = $derived(cumul(depot.etat, ind, mois, false));
	const cumulInclus = $derived(cumul(depot.etat, ind, mois, true));
	const versions = $derived(historique(depot.etat, ind.id, mois));
	const enDirect = $derived(depot.estEnDirect(ind.id));
	const domId = $derived(`ind-${ind.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`);

	// Brouillon local des cases (texte saisi), resynchronisé quand la valeur enregistrée change.
	let saisie = $state<Record<Cle, string>>({ femmes: '', filles: '', hommes: '', garcons: '', total: '' });
	let etatEnvoi = $state<'repos' | 'enregistre' | 'attente'>('repos');
	let erreur = $state<string | null>(null);
	let dialogueOuvert = $state(false);
	let commentaire = $state('');

	$effect(() => {
		const v = courante?.valeurs;
		saisie = {
			femmes: v?.femmes?.toString() ?? '',
			filles: v?.filles?.toString() ?? '',
			hommes: v?.hommes?.toString() ?? '',
			garcons: v?.garcons?.toString() ?? '',
			total: v?.total?.toString() ?? ''
		};
		commentaire = courante?.commentaire ?? '';
	});

	const totalCalcule = $derived.by(() => {
		if (!ind.desagrege) return lireNombre(saisie.total);
		const parts = COLONNES.map((c) => lireNombre(saisie[c.cle]));
		if (parts.every((p) => p === null)) return null;
		return parts.reduce<number>((a, b) => a + (b && !Number.isNaN(b) ? b : 0), 0);
	});

	function lire(): Desagregation {
		const n = (c: Cle) => lireNombre(saisie[c]);
		return { femmes: n('femmes'), filles: n('filles'), hommes: n('hommes'), garcons: n('garcons'), total: ind.desagrege ? null : n('total') };
	}

	function enregistrer() {
		if (!modifiable) return;
		erreur = null;
		try {
			depot.enregistrerValeur(ind.id, mois, lire(), commentaire.trim() || null);
			etatEnvoi = depot.enLigne ? 'enregistre' : 'attente';
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
	}

	function enregistrerCommentaire() {
		enregistrer();
		if (!erreur) dialogueOuvert = false;
	}

	/** Contrôle de cohérence non bloquant : dépassement de la cible désagrégée. */
	const alertes = $derived.by(() => {
		if (ind.type_valeur !== 'nombre') return [] as string[];
		const liste: string[] = [];
		for (const c of ind.desagrege ? COLONNES : [{ cle: 'total' as Cle, libelle: 'Total' }]) {
			const cible = ind.cible[c.cle];
			const avant = precedent[c.cle] ?? 0;
			const n = c.cle === 'total' ? totalCalcule : lireNombre(saisie[c.cle]);
			if (cible && n && avant + n > cible * 1.15) {
				liste.push(`${c.libelle} : le cumul (${nombre(avant + n)}) dépasse la cible (${nombre(cible)}) de plus de 15 %. Vérifiez la saisie ou ajoutez un commentaire.`);
			}
		}
		return liste;
	});
</script>

<!-- Ctrl+Entrée depuis une case : ouvre le commentaire et l'historique (DESIGN.md).
     L'écouteur est sur la carte car l'événement remonte depuis les champs de saisie. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article
	class="c-carte-ind"
	class:is-direct={!!enDirect}
	id={domId}
	aria-labelledby="{domId}-titre"
	aria-describedby="{domId}-raccourci"
	onkeydown={(e) => {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			dialogueOuvert = true;
		}
	}}
>
	<span class="u-visuellement-masque" id="{domId}-raccourci">Ctrl et Entrée : commentaire et historique.</span>
	<header class="c-carte-ind__tete">
		<div class="c-carte-ind__titres">
			<p class="c-carte-ind__numero">
				<span>{numero}</span>
				{#if ind.code_cbpf}<span class="u-code" title="Indicateur standard CBPF">{ind.code_cbpf}</span>{/if}
				{#if ind.type_valeur === 'pourcentage'}<span class="c-carte-ind__type">Pourcentage</span>{/if}
			</p>
			<h3 class="c-carte-ind__titre" id="{domId}-titre">{ind.libelle}</h3>
		</div>
		<div class="c-carte-ind__outils">
			{#if enDirect}
				<span class="c-carte-ind__direct">Modifié à l’instant par {depot.nomUtilisateur(enDirect.evenement.auteur)}</span>
			{:else if etatEnvoi === 'attente'}
				<span class="c-carte-ind__etat c-carte-ind__etat--attente"><Icone nom="horloge" taille="sm" /> Enregistré sur cet appareil</span>
			{:else if etatEnvoi === 'enregistre'}
				<span class="c-carte-ind__etat"><Icone nom="valider" taille="sm" /> Enregistré</span>
			{/if}
			<button class="c-carte-ind__bouton" type="button" onclick={() => (dialogueOuvert = true)} aria-label="Commentaire et historique de « {ind.libelle} »">
				<Icone nom={courante?.commentaire ? 'commentaire' : 'historique'} taille="sm" />
				<span>{versions.length > 1 ? `${versions.length} versions` : courante?.commentaire ? 'Commentaire' : 'Historique'}</span>
			</button>
		</div>
	</header>

	{#if ind.desagrege}
		<table class="c-carte-ind__grille">
			<caption class="u-visuellement-masque">Planifié, précédent, actuel et cumul pour {ind.libelle}</caption>
			<thead>
				<tr>
					<th scope="col"><span class="u-visuellement-masque">Ligne</span></th>
					{#each COLONNES as c (c.cle)}<th scope="col" class="u-nombre">{c.libelle}</th>{/each}
					<th scope="col" class="u-nombre">Total</th>
				</tr>
			</thead>
			<tbody>
				<tr class="c-carte-ind__ligne--planifie">
					<th scope="row">Planifié</th>
					{#each COLONNES as c (c.cle)}<td class="u-nombre" data-libelle={c.libelle}>{nombre(ind.cible[c.cle])}</td>{/each}
					<td class="u-nombre" data-libelle="Total">{nombre(ind.cible.total)}</td>
				</tr>
				<tr class="c-carte-ind__ligne--precedent">
					<th scope="row">Précédent</th>
					{#each COLONNES as c (c.cle)}<td class="u-nombre" data-libelle={c.libelle}>{nombre(precedent[c.cle])}</td>{/each}
					<td class="u-nombre" data-libelle="Total">{nombre(precedent.total)}</td>
				</tr>
				<tr class="c-carte-ind__ligne--saisie">
					<th scope="row">Actuel</th>
					{#each COLONNES as c (c.cle)}
						<td class="u-nombre" data-libelle={c.libelle}>
							<input
								class="c-carte-ind__case"
								type="text"
								inputmode="numeric"
								autocomplete="off"
								aria-label="{c.libelle}, actuel (réalisé ce mois)"
								aria-describedby="{domId}-titre"
								bind:value={saisie[c.cle]}
								onchange={enregistrer}
								disabled={!modifiable}
							/>
						</td>
					{/each}
					<td class="u-nombre c-carte-ind__total" data-libelle="Total"><output aria-label="Total calculé">{nombre(totalCalcule)}</output></td>
				</tr>
				<tr class="c-carte-ind__ligne--cumul">
					<th scope="row">Cumul</th>
					{#each COLONNES as c (c.cle)}<td class="u-nombre" data-libelle={c.libelle}>{nombre(cumulInclus[c.cle])}</td>{/each}
					<td class="u-nombre" data-libelle="Total">{nombre(cumulInclus.total)}</td>
				</tr>
			</tbody>
		</table>
	{:else}
		<div class="c-carte-ind__simple">
			<dl class="c-carte-ind__chiffres">
				<div><dt>Planifié</dt><dd>{val(ind.cible.total)}</dd></div>
				<div><dt>{pct ? 'Valeur précédente' : 'Précédent'}</dt><dd>{val(precedent.total)}</dd></div>
				<div>
					<dt><label for="{domId}-total">{pct ? 'Actuel (%)' : 'Actuel'}</label></dt>
					<dd>
						<input id="{domId}-total" class="c-carte-ind__case" type="text" inputmode="decimal" autocomplete="off" bind:value={saisie.total} onchange={enregistrer} disabled={!modifiable} />
					</dd>
				</div>
				<div><dt>{pct ? 'Dernière valeur' : 'Cumul'}</dt><dd>{val(cumulInclus.total)}</dd></div>
			</dl>
		</div>
	{/if}

	<JaugeJalon cumulPrecedent={precedent.total} ceMois={totalCalcule ?? 0} cible={ind.cible.total} type={ind.type_valeur} />

	{#if erreur}<p class="c-carte-ind__erreur" role="alert"><Icone nom="alerte" taille="sm" /> {erreur}</p>{/if}
	{#each alertes as a (a)}<p class="c-carte-ind__alerte"><Icone nom="info" taille="sm" /> {a}</p>{/each}

	<MoyensVerification volet={ind.volet} {mois} {modifiable} rattachement={{ type: 'indicateur', id: ind.id }} moyens={ind.moyens_verification} idBase={domId} />
</article>

<Dialogue ouvert={dialogueOuvert} titre="Commentaire et historique" onfermer={() => (dialogueOuvert = false)}>
	<p><strong>{ind.libelle}</strong></p>
	<Champ id="{domId}-commentaire" libelle="Commentaire pour ce mois" type="textarea" bind:valeur={commentaire} aide="Visible par APSUD et les autres membres. Expliquez un écart, une rupture, une difficulté d’accès." />
	<div class="c-carte-ind__versions">
		<p class="c-carte-ind__versions-titre">Versions enregistrées ({versions.length})</p>
		{#if versions.length}
			<ol role="list">
				{#each versions as v (v.id)}
					<li class:is-courante={v.courante}>
						<span>Version {v.version}{v.courante ? ' (actuelle)' : ''}</span>
						<span>{ind.desagrege ? `F ${nombre(v.valeurs.femmes)} · Fi ${nombre(v.valeurs.filles)} · H ${nombre(v.valeurs.hommes)} · G ${nombre(v.valeurs.garcons)} · ` : ''}Total {nombre(v.valeurs.total)}</span>
						<span class="u-attenue">{depot.nomUtilisateur(v.auteur)}, {dateHeure(v.date)}</span>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="u-attenue">Rien n’a encore été saisi pour ce mois.</p>
		{/if}
	</div>
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={() => (dialogueOuvert = false)}>Fermer</Bouton>
		{#if modifiable}<Bouton variante="primaire" onclick={enregistrerCommentaire}>Enregistrer le commentaire</Bouton>{/if}
	{/snippet}
</Dialogue>
