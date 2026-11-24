<script lang="ts">
	import { page } from '$app/state';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { rapport as trouverRapport } from '#lib/donnees/calculs.ts';
	import { peutSaisirMois, transitionsPossibles, type Transition } from '#lib/donnees/regles.ts';
	import { libelleMois, majuscule } from '#lib/format.ts';
	import type { CodeVolet, Mois } from '#lib/donnees/types.ts';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import MarqueurStatut from '#lib/composants/ui/MarqueurStatut.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import EnTeteRapport from '#lib/composants/donnees/EnTeteRapport.svelte';
	import PanneauJustificatifs from '#lib/composants/donnees/PanneauJustificatifs.svelte';
	import BlocActivite from './BlocActivite.svelte';
	import Section5W from './Section5W.svelte';
	import './rapport.css';

	/**
	 * Onglet « Activités » (cahier des charges APSUD, §3.3) : exécution opérationnelle et
	 * financière des activités du mois, pièces du mois, et soumission du rapport à APSUD.
	 * Les valeurs des indicateurs se saisissent dans l'onglet Indicateurs.
	 */
	const code = $derived(page.params.code as CodeVolet);
	const mois = $derived(page.params.mois as Mois);
	const etat = $derived(depot.etat);
	const volet = $derived(depot.volet(code));
	const u = $derived(depot.utilisateur);
	const r = $derived(trouverRapport(etat, code, mois));
	const statut = $derived(r?.statut ?? 'non_commence');
	const modifiable = $derived(peutSaisirMois(u, volet, r));
	const transitions = $derived(r ? transitionsPossibles(u, volet, r) : transitionsPossibles(u, volet, { id: '', volet: code, mois, statut: 'non_commence', soumis_par: null, soumis_le: null, decision_par: null, decision_le: null, motif: null }));

	$effect(() => {
		contexte.mois = mois;
	});

	/** Planification validée pour ce mois (onglet Activités planifiées) : les activités prévues passent en tête. */
	const planifs = $derived(etat.planifications.filter((p) => p.volet === code && p.mois === mois));
	const prevues = $derived(new Set(planifs.filter((p) => p.prevue).map((p) => p.activite_id)));
	const activites = $derived.by(() => {
		const liste = etat.activites.filter((a) => a.volet === code && !a.archive_le);
		return planifs.length ? [...liste.filter((a) => prevues.has(a.id)), ...liste.filter((a) => !prevues.has(a.id))] : liste;
	});
	const moisSuivant = $derived(etat.projet.mois[etat.projet.mois.indexOf(mois) + 1]);
	const justificatifs = $derived(etat.justificatifs.filter((j) => j.volet === code && j.mois === mois && !j.archive_le).length);
	const lignes5w = $derived(etat.lignes_5w.filter((l) => l.volet === code && l.mois === mois && !l.archive_le).length);

	/* ---------- Actions de circuit ---------- */
	let erreur = $state<string | null>(null);
	let succes = $state<string | null>(null);
	let transitionEnCours = $state<Transition | null>(null);
	let motif = $state('');

	function agir(fn: () => void, message: string) {
		erreur = null;
		succes = null;
		try {
			fn();
			succes = message;
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
	}

	function lancer(t: Transition) {
		if (t.motifObligatoire) {
			motif = '';
			transitionEnCours = t;
			return;
		}
		const messages: Record<string, string> = { soumis: 'Rapport soumis à APSUD. La coordination est notifiée.', valide: 'Rapport validé. L’ONG est notifiée.', verrouille: 'Rapport verrouillé.' };
		agir(() => depot.changerStatut(code, mois, t.vers), messages[t.vers] ?? 'Statut mis à jour.');
	}

	function confirmerMotif() {
		if (!transitionEnCours) return;
		const t = transitionEnCours;
		agir(() => depot.changerStatut(code, mois, t.vers, motif), t.vers === 'a_corriger' ? 'Rapport renvoyé pour correction. L’ONG est notifiée.' : 'Rapport déverrouillé.');
		if (!erreur) transitionEnCours = null;
	}
</script>


<svelte:head><title>Activités de {libelleMois(mois)} · {code} · Suivi consortium APSUD</title></svelte:head>

<section class="p-rapport" aria-labelledby="rapport-titre">
	<EnTeteRapport volet={code} {mois} titre="Activités de {libelleMois(mois)}">
		{#snippet meta()}
			{#if planifs.length}
				<span>{prevues.size} prévue{prevues.size > 1 ? 's' : ''} sur {activites.length} activités</span>
			{:else}
				<span>{activites.length} activités · <a href="/volets/{code}/planification/{mois}">mois non planifié</a></span>
			{/if}
		{/snippet}
	</EnTeteRapport>
	{#if erreur}<Alerte variante="erreur" onfermer={() => (erreur = null)}>{erreur}</Alerte>{/if}
	{#if succes}<Alerte variante="succes" onfermer={() => (succes = null)}>{succes}</Alerte>{/if}

	<nav class="p-rapport__sommaire" aria-label="Sections de l’onglet">
		<a href="#section-activites"><Icone nom="calendrier" taille="sm" /> Activités et budget <span>{activites.length}</span></a>
		{#if volet.secteur === 'WASH'}
			<a href="#section-5w"><Icone nom="carte" taille="sm" /> 5W du cluster <span>{lignes5w}</span></a>
		{/if}
		<a href="#section-justificatifs"><Icone nom="justificatif" taille="sm" /> Justificatifs <span>{justificatifs}</span></a>
		{#if moisSuivant}
			<a href="/volets/{code}/planification/{moisSuivant}"><Icone nom="calendrier" taille="sm" /> Planifier {libelleMois(moisSuivant)}</a>
		{/if}
		<a href="/volets/{code}/plan-action"><Icone nom="calendrier" taille="sm" /> Calendrier des tâches</a>
	</nav>

	<div id="section-activites" class="p-rapport__section">
		<Panneau titre="Activités et budget" sousTitre={planifs.length ? 'Les activités prévues pour ce mois viennent en premier. Taux d’exécution, résultats, observations et dépenses, activité par activité.' : 'Taux d’exécution, résultats, observations et dépenses du mois, activité par activité.'} sansMarge>
			{#each activites as a (a.id)}
				<BlocActivite activite={a} {mois} {modifiable} prevue={planifs.length ? prevues.has(a.id) : null} />
			{/each}
		</Panneau>
	</div>

	{#if volet.secteur === 'WASH'}
		<div id="section-5w" class="p-rapport__section">
			<Section5W volet={code} {mois} {modifiable} />
		</div>
	{/if}

	<div id="section-justificatifs" class="p-rapport__section">
		<PanneauJustificatifs volet={code} {mois} {modifiable} portee="activites" />
	</div>

	{#if transitions.length}
		<div class="p-rapport__barre" role="region" aria-label="Actions sur le rapport">
			<p class="p-rapport__barre-texte">
				<MarqueurStatut {statut} />
				{#if statut === 'brouillon' || statut === 'non_commence' || statut === 'a_corriger'}
					<span>Les valeurs s’enregistrent automatiquement. Soumettez quand les indicateurs et les activités du mois sont complets.</span>
				{:else if statut === 'soumis'}
					<span>En attente de la décision de la coordination APSUD.</span>
				{/if}
			</p>
			<div class="p-rapport__barre-actions">
				{#each [...transitions].reverse() as t (t.vers + t.action)}
					<Bouton variante={t.principal ? 'primaire' : 'secondaire'} onclick={() => lancer(t)}>{t.action}</Bouton>
				{/each}
			</div>
		</div>
	{/if}
</section>

<Dialogue ouvert={!!transitionEnCours} titre={transitionEnCours ? majuscule(transitionEnCours.action) : ''} onfermer={() => (transitionEnCours = null)}>
	<p>Le motif est visible par l’ONG {volet.organisation} et inscrit au journal.</p>
	{#if erreur}<Alerte variante="erreur">{erreur}</Alerte>{/if}
	<Champ id="motif-transition" libelle="Motif" type="textarea" requis bind:valeur={motif} aide="Soyez précis : quelle valeur vérifier, quelle pièce ajouter." />
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={() => (transitionEnCours = null)}>Annuler</Bouton>
		<Bouton variante="primaire" onclick={confirmerMotif}>{transitionEnCours?.action ?? 'Confirmer'}</Bouton>
	{/snippet}
</Dialogue>
