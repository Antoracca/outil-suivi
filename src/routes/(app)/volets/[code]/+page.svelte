<script lang="ts">
	import { page } from '$app/state';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { budgetVolet, cumul, echeance, indicateursAJour, joursRetard, moisARapporter, rapport, tauxExecution, valeurCourante } from '#lib/donnees/calculs.ts';
	import { peutSaisirMois } from '#lib/donnees/regles.ts';
	import { date, libelleMois, montant, moisCourt, pourcent } from '#lib/format.ts';
	import type { CodeVolet } from '#lib/donnees/types.ts';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Tuile from '#lib/composants/ui/Tuile.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import JaugeJalon from '#lib/composants/ui/JaugeJalon.svelte';
	import MarqueurStatut from '#lib/composants/ui/MarqueurStatut.svelte';
	import LigneActivite from '#lib/composants/donnees/LigneActivite.svelte';
	import './synthese.css';

	const code = $derived(page.params.code as CodeVolet);
	const etat = $derived(depot.etat);
	const volet = $derived(depot.volet(code));
	const maintenant = $derived(depot.maintenant());
	const attendu = $derived(moisARapporter(etat, maintenant));
	const r = $derived(rapport(etat, code, attendu));
	const u = $derived(depot.utilisateur);
	const budget = $derived(budgetVolet(etat, code));
	const aJour = $derived(indicateursAJour(etat, code, attendu));
	const activites = $derived(etat.activites.filter((a) => a.volet === code && !a.archive_le));
	const tauxMoyen = $derived.by(() => {
		const t = activites.map((a) => tauxExecution(etat, a.id, attendu)).filter((x): x is number => x !== null);
		return t.length ? t.reduce((s, x) => s + x, 0) / t.length : null;
	});
	const indicateurs = $derived(etat.indicateurs.filter((i) => i.volet === code && !i.archive_le && i.cible.total));
	const journal = $derived(etat.journal.filter((e) => e.volet === code).slice(0, 8));
	const verbe = $derived(peutSaisirMois(u, volet, r) ? (r?.statut === 'a_corriger' ? 'Corriger' : 'Saisir') : 'Ouvrir');
</script>

<svelte:head><title>{code} · Suivi consortium APSUD</title></svelte:head>

<div class="p-synthese__tuiles">
	<Tuile sombre chiffre={libelleMois(attendu, false)} libelle="rapport attendu le {date(echeance(attendu).toISOString())}" href="/volets/{code}/activites/{attendu}">
		{#snippet pied()}
			<div class="p-synthese__statut">
				<MarqueurStatut statut={r?.statut ?? 'non_commence'} retard={joursRetard(r, maintenant)} />
				<span class="p-synthese__ouvrir">{verbe} le rapport</span>
			</div>
		{/snippet}
	</Tuile>
	<Tuile chiffre="{aJour.renseignes} sur {aJour.total}" libelle="indicateurs renseignés pour {libelleMois(attendu, false)}">
		{#snippet pied()}<JaugeJalon cumulPrecedent={aJour.renseignes} ceMois={0} cible={aJour.total} sansTexte />{/snippet}
	</Tuile>
	<Tuile chiffre={pourcent(Math.round(budget.taux ?? 0))} libelle="du budget exécuté" detail="{montant(budget.execute)} sur {montant(budget.planifie)}">
		{#snippet pied()}<JaugeJalon cumulPrecedent={budget.execute} ceMois={0} cible={budget.planifie} sansTexte />{/snippet}
	</Tuile>
	<Tuile chiffre={pourcent(tauxMoyen === null ? null : Math.round(tauxMoyen))} libelle="d’exécution moyenne des activités" detail="{activites.length} activités, taux déclarés par l’ONG" />
</div>

<Panneau titre="Rapports mensuels" sousTitre="Les 10 mois du projet. Cliquez sur un mois pour ouvrir son rapport." sansMarge>
	<ol class="p-synthese__frise" role="list">
		{#each etat.projet.mois as m, i (m)}
			{@const rm = rapport(etat, code, m)}
			<li>
				<a class="p-synthese__mois" class:is-attendu={m === attendu} href="/volets/{code}/activites/{m}">
					<span class="p-synthese__mois-nom">{moisCourt(m)} <span class="u-attenue">{m.slice(0, 4)}</span></span>
					<MarqueurStatut statut={rm?.statut ?? 'non_commence'} retard={joursRetard(rm, maintenant)} compact />
					<span class="u-attenue">Mois {i + 1}</span>
				</a>
			</li>
		{/each}
	</ol>
</Panneau>

<div class="p-synthese__duo">
	<Panneau titre="Indicateurs chiffrés" sousTitre="Cumul au mois de {libelleMois(attendu, false)} par rapport à la cible du projet." sansMarge>
		{#snippet actions()}<Bouton variante="texte" taille="sm" href="/volets/{code}/indicateurs/{attendu}">Ouvrir les indicateurs</Bouton>{/snippet}
		<table class="p-synthese__table">
			<caption class="u-visuellement-masque">Cumul des indicateurs du volet</caption>
			<thead>
				<tr><th scope="col">Indicateur</th><th scope="col" class="p-synthese__col-jauge">Cumul et cible</th></tr>
			</thead>
			<tbody>
				{#each indicateurs as ind (ind.id)}
					{@const avant = cumul(etat, ind, attendu, false).total}
					{@const ceMois = valeurCourante(etat, ind.id, attendu)?.valeurs.total ?? 0}
					<tr>
						<th scope="row">
							{#if ind.code_cbpf}<span class="u-code">{ind.code_cbpf}</span>{/if}
							<a href="/volets/{code}/indicateurs/{attendu}#{encodeURIComponent(ind.id)}">{ind.libelle}</a>
						</th>
						<td class="p-synthese__col-jauge"><JaugeJalon cumulPrecedent={avant} {ceMois} cible={ind.cible.total} type={ind.type_valeur} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</Panneau>

	<Panneau titre="Activité du volet">
		{#snippet actions()}<Bouton variante="texte" taille="sm" href="/activite">Tout le journal</Bouton>{/snippet}
		{#if journal.length}
			<div role="log" aria-label="Activité récente du volet" class="p-synthese__fil">
				{#each journal as ev (ev.id)}<LigneActivite evenement={ev} compacte />{/each}
			</div>
		{:else}
			<p class="u-attenue">Aucune activité enregistrée pour ce volet.</p>
		{/if}
	</Panneau>
</div>
