<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { avancementCourant, budgetActivite } from '#lib/donnees/calculs.ts';
	import { lireNombre, montant, pourcent } from '#lib/format.ts';
	import type { Activite, Mois } from '#lib/donnees/types.ts';
	import JaugeJalon from '#lib/composants/ui/JaugeJalon.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './BlocActivite.css';

	/** Avancement d'une activité pour le mois : taux, résultats, observations, dépenses. */
	interface Props {
		activite: Activite;
		mois: Mois;
		modifiable: boolean;
		/** Prévue par la planification du mois (null : mois non planifié). */
		prevue?: boolean | null;
	}
	let { activite: act, mois, modifiable, prevue = null }: Props = $props();

	const av = $derived(avancementCourant(depot.etat, act.id, mois));
	const budget = $derived(budgetActivite(depot.etat, act.id));
	const depensesMois = $derived(depot.etat.depenses.filter((d) => d.activite_id === act.id && d.mois === mois && !d.archive_le));
	const domId = $derived(`act-${act.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`);

	let taux = $state('');
	let resultats = $state('');
	let observations = $state('');
	let nouveauMontant = $state('');
	let nouveauLibelle = $state('');
	let erreur = $state<string | null>(null);
	let enregistre = $state(false);

	$effect(() => {
		taux = av?.taux_execution?.toString() ?? '';
		resultats = av?.resultats ?? '';
		observations = av?.observations ?? '';
	});

	function enregistrer() {
		erreur = null;
		try {
			const t = lireNombre(taux);
			depot.enregistrerAvancement(act.id, mois, { taux_execution: t === null || Number.isNaN(t) ? null : t, resultats: resultats.trim(), observations: observations.trim() });
			enregistre = true;
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
	}

	function ajouterDepense(ev: SubmitEvent) {
		ev.preventDefault();
		erreur = null;
		try {
			depot.ajouterDepense(act.id, mois, lireNombre(nouveauMontant) ?? NaN, nouveauLibelle);
			nouveauMontant = '';
			nouveauLibelle = '';
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
	}
</script>

<article class="c-bloc-act" class:is-direct={!!depot.estEnDirect(act.id)} class:is-non-prevue={prevue === false} id={domId} aria-labelledby="{domId}-titre">
	<header class="c-bloc-act__tete">
		<h3 class="c-bloc-act__titre" id="{domId}-titre">
			<span class="c-bloc-act__num">{act.numero}</span> {act.libelle}
			{#if prevue === true}<span class="c-bloc-act__prevue"><Icone nom="calendrier" taille="sm" /> Prévue</span>{:else if prevue === false}<span class="c-bloc-act__non-prevue">Non prévue</span>{/if}
		</h3>
		<div class="c-bloc-act__budget">
			<span>Budget {montant(budget.planifie)} · exécuté {montant(budget.execute)}</span>
			<JaugeJalon cumulPrecedent={budget.execute} ceMois={0} cible={budget.planifie} sansTexte />
		</div>
	</header>

	<div class="c-bloc-act__champs">
		<div class="c-bloc-act__champ c-bloc-act__champ--taux">
			<label for="{domId}-taux">Taux d’exécution cumulé</label>
			<div class="c-bloc-act__suffixe">
				<input id="{domId}-taux" type="text" inputmode="numeric" bind:value={taux} onchange={enregistrer} disabled={!modifiable} aria-describedby="{domId}-taux-aide" />
				<span aria-hidden="true">%</span>
			</div>
			<p class="c-bloc-act__aide" id="{domId}-taux-aide">De 0 à 100 % depuis le début du projet.</p>
		</div>
		<div class="c-bloc-act__champ">
			<label for="{domId}-res">Résultats obtenus</label>
			<textarea id="{domId}-res" rows="2" bind:value={resultats} onchange={enregistrer} disabled={!modifiable}></textarea>
		</div>
		<div class="c-bloc-act__champ">
			<label for="{domId}-obs">Observations</label>
			<textarea id="{domId}-obs" rows="2" bind:value={observations} onchange={enregistrer} disabled={!modifiable} placeholder={modifiable ? 'Difficultés, retards, changements…' : ''}></textarea>
		</div>
	</div>

	<div class="c-bloc-act__depenses">
		<p class="c-bloc-act__sous-titre">Dépenses du mois</p>
		{#if depensesMois.length}
			<ul role="list">
				{#each depensesMois as d (d.id)}
					<li><span>{d.libelle}</span><span class="u-nombre">{montant(d.montant)}</span></li>
				{/each}
			</ul>
		{:else}
			<p class="u-attenue">Aucune dépense enregistrée ce mois-ci.</p>
		{/if}
		{#if modifiable}
			<form class="c-bloc-act__form" onsubmit={ajouterDepense}>
				<label class="u-visuellement-masque" for="{domId}-lib">Libellé de la dépense</label>
				<input id="{domId}-lib" type="text" placeholder="Ex. Achat de kits d’hygiène" bind:value={nouveauLibelle} />
				<label class="u-visuellement-masque" for="{domId}-mt">Montant en dollars</label>
				<input id="{domId}-mt" type="text" inputmode="decimal" placeholder="Montant ($)" bind:value={nouveauMontant} />
				<button type="submit" class="c-bloc-act__ajouter"><Icone nom="plus" taille="sm" /> Ajouter la dépense</button>
			</form>
		{/if}
	</div>

	{#if erreur}<p class="c-bloc-act__erreur" role="alert"><Icone nom="alerte" taille="sm" /> {erreur}</p>{/if}
	{#if enregistre && !erreur}<p class="c-bloc-act__ok" role="status"><Icone nom="valider" taille="sm" /> Avancement enregistré ({pourcent(lireNombre(taux))}).</p>{/if}
</article>
