<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { budgetVolet, cumul, echeance, indicateurPhare, indicateursAJour, joursRetard, moisARapporter, moisCourant, rapport, valeurCourante } from '#lib/donnees/calculs.ts';
	import { peutValider } from '#lib/donnees/regles.ts';
	import { date, entier, libelleMois, majuscule, montant, moisCourt, pourcent } from '#lib/format.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Tuile from '#lib/composants/ui/Tuile.svelte';
	import JaugeJalon from '#lib/composants/ui/JaugeJalon.svelte';
	import MarqueurStatut from '#lib/composants/ui/MarqueurStatut.svelte';
	import EtiquetteVolet from '#lib/composants/ui/EtiquetteVolet.svelte';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import LigneActivite from '#lib/composants/donnees/LigneActivite.svelte';
	import './tableau-de-bord.css';

	const etat = $derived(depot.etat);
	const u = $derived(depot.utilisateur!);
	const maintenant = $derived(depot.maintenant());
	const courant = $derived(moisCourant(etat, maintenant));
	const attendu = $derived(moisARapporter(etat, maintenant));
	const rang = $derived(etat.projet.mois.indexOf(courant) + 1);
	const libelleSecteur = (code: string) => etat.secteurs.find((s) => s.code === code)!.libelle_court;

	const rapportsAttendus = $derived(etat.volets.map((v) => ({ v, r: rapport(etat, v.code, attendu) })));
	const soumis = $derived(rapportsAttendus.filter(({ r }) => r && ['soumis', 'valide', 'verrouille'].includes(r.statut)).length);
	const aValider = $derived(etat.rapports.filter((r) => r.statut === 'soumis').length);
	const retards = $derived(rapportsAttendus.filter(({ r }) => joursRetard(r, maintenant) > 0));

	const budget = $derived.by(() => {
		const parVolet = etat.volets.map((v) => ({ v, ...budgetVolet(etat, v.code) }));
		const planifie = parVolet.reduce((s, b) => s + b.planifie, 0);
		const execute = parVolet.reduce((s, b) => s + b.execute, 0);
		return { parVolet, planifie, execute, taux: planifie ? (execute / planifie) * 100 : 0 };
	});

	const aJour = $derived.by(() => {
		const parVolet = etat.volets.map((v) => indicateursAJour(etat, v.code, attendu));
		const total = parVolet.reduce((s, x) => s + x.total, 0);
		const renseignes = parVolet.reduce((s, x) => s + x.renseignes, 0);
		return { total, renseignes, taux: total ? (renseignes / total) * 100 : 0 };
	});

	const avancement = $derived(
		etat.volets.map((v) => {
			const ind = indicateurPhare(etat, v.code);
			const precedent = ind ? cumul(etat, ind, attendu, false).total : null;
			const ceMois = ind ? (valeurCourante(etat, ind.id, attendu)?.valeurs.total ?? 0) : 0;
			return { v, ind, precedent, ceMois, r: rapport(etat, v.code, attendu) };
		})
	);

	/** Action principale selon le rôle connecté (DESIGN.md, consortium-band). */
	const action = $derived.by(() => {
		if (peutValider(u)) return aValider ? { libelle: `${aValider} rapport${aValider > 1 ? 's' : ''} à valider`, href: '/validation' } : { libelle: 'Voir l’activité du consortium', href: '/activite' };
		if (u.role === 'saisie') {
			const mien = etat.volets.find((v) => v.organisation === u.organisation && ['non_commence', 'brouillon', 'a_corriger'].includes(rapport(etat, v.code, attendu)?.statut ?? 'non_commence'));
			const volet = mien ?? etat.volets.find((v) => v.organisation === u.organisation)!;
			const r = rapport(etat, volet.code, attendu);
			const verbe = r?.statut === 'a_corriger' ? 'Corriger' : mien ? 'Saisir' : 'Voir';
			return { libelle: `${verbe} le rapport de ${libelleMois(attendu, false)} (${libelleSecteur(volet.secteur)})`, href: `/volets/${volet.code}/activites/${attendu}` };
		}
		return { libelle: 'Voir l’activité du consortium', href: '/activite' };
	});

	const dernieres = $derived(etat.journal.slice(0, 7));
</script>

<svelte:head><title>Tableau de bord · Suivi consortium APSUD</title></svelte:head>

<div class="p-tdb">
	<section class="p-tdb__bandeau" aria-labelledby="tdb-titre">
		<div class="p-tdb__bandeau-texte">
			<h1 id="tdb-titre" class="p-tdb__titre">Consortium FH, Nanga-Boguila, Paoua, Bossangoa</h1>
			<p class="p-tdb__sous-titre">
				{majuscule(libelleMois(courant))}, mois {rang} sur {etat.projet.mois.length}. Rapports de {libelleMois(attendu, false)} attendus le {date(echeance(attendu).toISOString())}.
			</p>
		</div>
		<Bouton variante="primaire" href={action.href}>{action.libelle}</Bouton>
	</section>

	<div class="p-tdb__tuiles">
		<Tuile sombre chiffre="{soumis} sur {etat.volets.length}" libelle="rapports de {libelleMois(attendu, false)} soumis" href={peutValider(u) ? '/validation' : undefined}>
			{#snippet pied()}
				<ul class="p-tdb__gouttes" role="list" aria-label="Statut par volet">
					{#each rapportsAttendus as { v, r } (v.code)}
						<li><MarqueurStatut statut={r?.statut ?? 'non_commence'} texte="{v.organisation} {libelleSecteur(v.secteur).toLowerCase()}" retard={joursRetard(r, maintenant)} /></li>
					{/each}
				</ul>
			{/snippet}
		</Tuile>
		<Tuile chiffre={pourcent(Math.round(budget.taux))} libelle="du budget exécuté" detail="{montant(budget.execute)} sur {montant(budget.planifie)}">
			{#snippet pied()}<JaugeJalon cumulPrecedent={budget.execute} ceMois={0} cible={budget.planifie} sansTexte />{/snippet}
		</Tuile>
		<Tuile chiffre={pourcent(Math.round(aJour.taux))} libelle="des indicateurs renseignés pour {libelleMois(attendu, false)}" detail="{aJour.renseignes} sur {aJour.total} indicateurs chiffrés">
			{#snippet pied()}<JaugeJalon cumulPrecedent={aJour.renseignes} ceMois={0} cible={aJour.total} sansTexte />{/snippet}
		</Tuile>
		<Tuile
			chiffre={retards.length ? String(retards.length) : '0'}
			libelle={retards.length ? `rapport${retards.length > 1 ? 's' : ''} en retard` : 'rapport en retard'}
			detail={retards.length ? retards.map(({ v }) => `${v.organisation} (${libelleSecteur(v.secteur)})`).join(', ') : 'Tous les volets sont dans les temps.'}
		/>
	</div>

	<Panneau titre="Avancement par volet" sousTitre="Indicateur principal de chaque volet : cumul avant {libelleMois(attendu, false)}, apport du mois et cible." id="avancement" sansMarge>
		<table class="p-tdb__table">
			<caption class="u-visuellement-masque">Avancement de l’indicateur principal de chaque volet</caption>
			<thead>
				<tr>
					<th scope="col">Volet</th>
					<th scope="col">Indicateur principal</th>
					<th scope="col" class="p-tdb__col-jauge">Cumul et cible</th>
					<th scope="col">Rapport de {libelleMois(attendu, false)}</th>
				</tr>
			</thead>
			<tbody>
				{#each avancement as a (a.v.code)}
					<tr>
						<th scope="row">
							<a class="p-tdb__lien-volet" href="/volets/{a.v.code}">
								<EtiquetteVolet secteur={a.v.secteur} organisation={a.v.organisation} libelleSecteur={libelleSecteur(a.v.secteur)} />
							</a>
						</th>
						<td class="p-tdb__indicateur">
							{#if a.ind}
								{#if a.ind.code_cbpf}<span class="u-code">{a.ind.code_cbpf}</span>{/if}
								<span>{a.ind.libelle}</span>
							{:else}<span class="u-attenue">Aucun indicateur chiffré</span>{/if}
						</td>
						<td class="p-tdb__col-jauge">
							{#if a.ind}<JaugeJalon cumulPrecedent={a.precedent} ceMois={a.ceMois} cible={a.ind.cible.total} />{/if}
						</td>
						<td>
							<a class="p-tdb__lien-statut" href="/volets/{a.v.code}/activites/{attendu}">
								<MarqueurStatut statut={a.r?.statut ?? 'non_commence'} retard={joursRetard(a.r, maintenant)} />
							</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</Panneau>

	<div class="p-tdb__duo">
		<Panneau titre="Rapports mensuels" sousTitre="Un rapport par volet et par mois. Cliquez sur une case pour l’ouvrir." id="matrice" sansMarge>
			<div class="p-tdb__defilement">
				<table class="p-tdb__matrice">
					<caption class="u-visuellement-masque">Statut des rapports mensuels par volet</caption>
					<thead>
						<tr>
							<th scope="col"><span class="u-visuellement-masque">Volet</span></th>
							{#each etat.projet.mois as m (m)}
								<th scope="col" class:is-courant={m === attendu}><abbr title={libelleMois(m)}>{moisCourt(m)}</abbr></th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each etat.volets as v (v.code)}
							<tr>
								<th scope="row"><span class="p-tdb__matrice-volet"><LogoOrganisation sigle={v.organisation} taille="sm" /><span>{v.organisation} <span class="u-attenue">{libelleSecteur(v.secteur)}</span></span></span></th>
								{#each etat.projet.mois as m (m)}
									{@const r = rapport(etat, v.code, m)}
									<td class:is-courant={m === attendu}>
										<a class="p-tdb__case" href="/volets/{v.code}/activites/{m}" aria-label="{v.code}, {libelleMois(m)}">
											<MarqueurStatut statut={r?.statut ?? 'non_commence'} retard={joursRetard(r, maintenant)} compact />
										</a>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Panneau>

		<Panneau titre="Dernières activités" id="activite">
			{#snippet actions()}<Bouton variante="texte" taille="sm" href="/activite">Tout voir</Bouton>{/snippet}
			<div class="p-tdb__fil" role="log" aria-label="Dernières activités">
				{#each dernieres as ev (ev.id)}
					<LigneActivite evenement={ev} compacte />
				{/each}
			</div>
		</Panneau>
	</div>

	<Panneau titre="Budget par volet" sousTitre="Montants de démonstration : les fichiers Excel ne contiennent que des valeurs de remplissage." id="budget" sansMarge>
		<table class="p-tdb__table">
			<caption class="u-visuellement-masque">Budget planifié et exécuté par volet</caption>
			<thead>
				<tr>
					<th scope="col">Volet</th>
					<th scope="col" class="u-nombre">Planifié</th>
					<th scope="col" class="u-nombre">Exécuté</th>
					<th scope="col" class="p-tdb__col-jauge">Exécution</th>
				</tr>
			</thead>
			<tbody>
				{#each budget.parVolet as b (b.v.code)}
					<tr>
						<th scope="row"><EtiquetteVolet secteur={b.v.secteur} organisation={b.v.organisation} libelleSecteur={libelleSecteur(b.v.secteur)} /></th>
						<td class="u-nombre">{montant(b.planifie)}</td>
						<td class="u-nombre">{montant(b.execute)}</td>
						<td class="p-tdb__col-jauge"><JaugeJalon cumulPrecedent={b.execute} ceMois={0} cible={b.planifie} /></td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<th scope="row">Consortium</th>
					<td class="u-nombre">{montant(budget.planifie)}</td>
					<td class="u-nombre">{montant(budget.execute)}</td>
					<td class="p-tdb__col-jauge">{pourcent(Math.round(budget.taux))} exécuté · {entier(etat.activites.filter((a) => !a.archive_le).length)} activités</td>
				</tr>
			</tfoot>
		</table>
	</Panneau>
</div>
