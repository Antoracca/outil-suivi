<script lang="ts">
	import type { Snippet } from 'svelte';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { echeance, echeanceFH, joursRetard, rapportDuCalendrier, rapport as trouverRapport } from '#lib/donnees/calculs.ts';
	import { peutSaisirMois, peutValider } from '#lib/donnees/regles.ts';
	import { date, dateHeure } from '#lib/format.ts';
	import type { CodeVolet, Mois } from '#lib/donnees/types.ts';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import MarqueurStatut from '#lib/composants/ui/MarqueurStatut.svelte';
	import EtapesCircuit from './EtapesCircuit.svelte';
	import './EnTeteRapport.css';

	/**
	 * En-tête commun aux onglets Indicateurs et Activités d'un mois : statut du rapport,
	 * échéance, circuit et messages (renvoi pour correction, lecture seule, mois à venir).
	 * Les deux onglets forment ensemble le rapport du mois soumis à APSUD.
	 */
	interface Props {
		volet: CodeVolet;
		mois: Mois;
		titre: string;
		/** Mentions propres à l'onglet, ajoutées à la ligne de statut. */
		meta?: Snippet;
	}
	let { volet: code, mois, titre, meta }: Props = $props();

	const volet = $derived(depot.volet(code));
	const r = $derived(trouverRapport(depot.etat, code, mois));
	const statut = $derived(r?.statut ?? 'non_commence');
	const modifiable = $derived(peutSaisirMois(depot.utilisateur, volet, r));
	const maintenant = $derived(depot.maintenant());
	const retard = $derived(joursRetard(depot.etat, r, maintenant));
	const attendu = $derived(rapportDuCalendrier(depot.etat, mois));
	const fh = $derived(echeanceFH(depot.etat, mois));
	const futur = $derived(mois > `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`);
</script>

<header class="c-entete-rapport">
	<div class="c-entete-rapport__titres">
		<h2 id="rapport-titre" class="c-entete-rapport__titre">{titre}</h2>
		<p class="c-entete-rapport__meta">
			<MarqueurStatut {statut} {retard} />
			{#if attendu}<span class="c-entete-rapport__type">{attendu.libelle}</span>{/if}
			<span>À soumettre à APSUD avant le {date(echeance(depot.etat, mois).toISOString())}</span>
			{#if fh && peutValider(depot.utilisateur)}<span>Transmission au FH : {date(fh.toISOString())}</span>{/if}
			{@render meta?.()}
		</p>
	</div>
	<EtapesCircuit {statut} />
</header>

{#if r?.statut === 'a_corriger' && r.motif}
	<Alerte variante="avertissement" titre="Renvoyé pour correction par {depot.nomUtilisateur(r.decision_par)} le {date(r.decision_le)}">
		<p>{r.motif}</p>
	</Alerte>
{/if}
{#if r?.soumis_le && statut !== 'a_corriger'}
	<p class="c-entete-rapport__trace">
		Soumis par {depot.nomUtilisateur(r.soumis_par)} le {dateHeure(r.soumis_le)}{#if r.decision_le && (statut === 'valide' || statut === 'verrouille')}, validé par {depot.nomUtilisateur(r.decision_par)} le {dateHeure(r.decision_le)}{/if}.
	</p>
{/if}
{#if !modifiable}
	<Alerte variante="info">
		{#if statut === 'valide' || statut === 'verrouille'}
			Ce rapport est {statut === 'valide' ? 'validé' : 'verrouillé'} : les valeurs ne peuvent plus être modifiées. La coordination APSUD peut le rouvrir pour correction.
		{:else if statut === 'soumis'}
			Rapport soumis : il attend la décision de la coordination APSUD. Pour modifier une valeur, demandez à APSUD de le renvoyer pour correction.
		{:else}
			Lecture seule : seule l’ONG {volet.organisation} et la coordination APSUD peuvent saisir ce rapport.
		{/if}
	</Alerte>
{:else if futur}
	<Alerte variante="info">Ce mois n’est pas encore commencé. Vous pouvez préparer la saisie, mais le rapport ne sera attendu qu’après la fin du mois.</Alerte>
{/if}
