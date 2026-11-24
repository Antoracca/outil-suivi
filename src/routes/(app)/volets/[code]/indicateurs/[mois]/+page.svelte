<script lang="ts">
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { indicateursAJour, rapport as trouverRapport } from '#lib/donnees/calculs.ts';
	import { peutSaisirMois } from '#lib/donnees/regles.ts';
	import { libelleMois } from '#lib/format.ts';
	import type { CodeVolet, Indicateur, Mois } from '#lib/donnees/types.ts';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import EnTeteRapport from '#lib/composants/donnees/EnTeteRapport.svelte';
	import PanneauJustificatifs from '#lib/composants/donnees/PanneauJustificatifs.svelte';
	import CarteIndicateur from './CarteIndicateur.svelte';
	import './indicateurs.css';

	/**
	 * Onglet « Indicateurs » (cahier des charges APSUD, §3.2) : le seul endroit où l'on
	 * renseigne les valeurs des indicateurs. La structure (cadre logique) s'ouvre d'ici.
	 */
	const code = $derived(page.params.code as CodeVolet);
	const mois = $derived(page.params.mois as Mois);
	const etat = $derived(depot.etat);
	const volet = $derived(depot.volet(code));
	const modifiable = $derived(peutSaisirMois(depot.utilisateur, volet, trouverRapport(etat, code, mois)));
	const progression = $derived(indicateursAJour(etat, code, mois));

	$effect(() => {
		contexte.mois = mois;
	});

	const outcomes = $derived(etat.outcomes.filter((o) => o.volet === code));
	const outputs = $derived(etat.outputs.filter((o) => o.volet === code));
	const activites = $derived(etat.activites.filter((a) => a.volet === code && !a.archive_le));
	const indicateurs = $derived(etat.indicateurs.filter((i) => i.volet === code && !i.archive_le));

	type Groupe = { id: string; titre: string; niveau: string; indicateurs: { ind: Indicateur; numero: string }[] };
	const groupes = $derived.by(() => {
		const g: Groupe[] = [];
		for (const oc of outcomes) {
			const inds = indicateurs.filter((i) => i.niveau === 'outcome' && i.parent_id === oc.id);
			if (inds.length) g.push({ id: oc.id, niveau: `Outcome ${oc.numero}`, titre: oc.libelle, indicateurs: inds.map((ind, k) => ({ ind, numero: `Outcome ${oc.numero} · indicateur ${k + 1}` })) });
			for (const op of outputs.filter((o) => o.outcome_id === oc.id)) {
				const directs = indicateurs.filter((i) => i.niveau === 'output' && i.parent_id === op.id).map((ind, k) => ({ ind, numero: `Output ${op.numero} · indicateur ${k + 1}` }));
				const parActivite = activites
					.filter((a) => a.output_id === op.id)
					.flatMap((a) => indicateurs.filter((i) => i.niveau === 'activite' && i.parent_id === a.id).map((ind, k) => ({ ind, numero: `Activité ${a.numero}${k ? ` · ${k + 1}` : ''}` })));
				if (directs.length || parActivite.length) g.push({ id: op.id, niveau: `Output ${op.numero}`, titre: op.libelle, indicateurs: [...directs, ...parActivite] });
			}
		}
		return g;
	});

	/** Depuis une carte : pré-choisit l'indicateur et descend vers les justificatifs. */
	let rattachement = $state('');
	function preparerJustificatif(indicateurId: string) {
		rattachement = indicateurId;
		document.getElementById('section-justificatifs')?.scrollIntoView({ block: 'start' });
		tick().then(() => document.getElementById('fichier-justificatif-indicateurs')?.focus({ preventScroll: true }));
	}

	// Ouverture depuis un lien « #indicateur » : défiler jusqu'à la carte et y placer le focus.
	$effect(() => {
		const ancre = decodeURIComponent(page.url.hash.slice(1));
		if (!ancre) return;
		tick().then(() => {
			const el = document.getElementById(`ind-${ancre.replace(/[^a-zA-Z0-9_-]/g, '-')}`);
			el?.scrollIntoView({ block: 'center' });
			el?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
		});
	});
</script>

<svelte:head><title>Indicateurs de {libelleMois(mois)} · {code} · Suivi consortium APSUD</title></svelte:head>

<section class="p-indicateurs" aria-labelledby="rapport-titre">
	<EnTeteRapport volet={code} {mois} titre="Indicateurs de {libelleMois(mois)}">
		{#snippet meta()}
			<span>{progression.renseignes} sur {progression.total} indicateurs chiffrés renseignés</span>
		{/snippet}
	</EnTeteRapport>

	<div class="p-indicateurs__outils">
		<p class="p-indicateurs__consigne">
			Saisissez le réalisé du mois : le total et le cumul se calculent seuls. Le rapport du mois, indicateurs et activités, se soumet à APSUD depuis l’onglet
			<a href="/volets/{code}/activites/{mois}">Activités</a>.
		</p>
		<Bouton variante="secondaire" taille="sm" icone="cadre-logique" href="/volets/{code}/cadre-logique">Structure du cadre logique</Bouton>
	</div>

	<Panneau titre="Valeurs du mois" sousTitre="Chaque case s’enregistre dès que vous la quittez." sansMarge>
		{#if !groupes.length}
			<div class="p-indicateurs__vide"><EtatVide titre="Aucun indicateur dans ce volet" texte="Ajoutez des indicateurs depuis la structure du cadre logique." /></div>
		{/if}
		{#each groupes as g (g.id)}
			<div class="p-indicateurs__groupe">
				<p class="p-indicateurs__groupe-tete"><span>{g.niveau}</span> {g.titre}</p>
				{#each g.indicateurs as { ind, numero } (ind.id)}
					<CarteIndicateur indicateur={ind} {mois} {modifiable} {numero} onjustificatif={() => preparerJustificatif(ind.id)} />
				{/each}
			</div>
		{/each}
	</Panneau>

	<div id="section-justificatifs" class="p-indicateurs__section">
		<PanneauJustificatifs volet={code} {mois} {modifiable} portee="indicateurs" bind:rattachement />
	</div>
</section>
