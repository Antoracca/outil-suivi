<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { date, dateHeure, entier, libelleMois, nombre, pourcent } from '#lib/format.ts';
	import type { Desagregation, Evenement, TypeEvenement } from '#lib/donnees/types.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import LigneActivite from '#lib/composants/donnees/LigneActivite.svelte';
	import './activite.css';

	/* ---------- Familles d'événements (regroupement lisible des types du journal) ---------- */
	type Famille = 'saisies' | 'rapports' | 'structure' | 'archivage';
	const FAMILLES: Record<Famille, string> = {
		saisies: 'Saisies',
		rapports: 'Rapports et décisions',
		structure: 'Structure',
		archivage: 'Archivage et suppression'
	};
	const FAMILLE_DU_TYPE: Record<TypeEvenement, Famille> = {
		valeur_modifiee: 'saisies',
		avancement_modifie: 'saisies',
		semaine_cochee: 'saisies',
		depense_ajoutee: 'saisies',
		justificatif_ajoute: 'saisies',
		fiche_5w_modifiee: 'structure',
		ligne_5w_ajoutee: 'saisies',
		ligne_5w_modifiee: 'saisies',
		rapport_soumis: 'rapports',
		rapport_valide: 'rapports',
		rapport_a_corriger: 'rapports',
		rapport_verrouille: 'rapports',
		rapport_deverrouille: 'rapports',
		activite_creee: 'structure',
		tache_creee: 'structure',
		tache_modifiee: 'structure',
		cadre_verrouille: 'structure',
		cadre_deverrouille: 'structure',
		element_archive: 'archivage',
		element_restaure: 'archivage',
		element_supprime: 'archivage',
		volet_cree: 'structure',
		planification_validee: 'saisies'
	};
	const PARTS: { cle: keyof Desagregation; libelle: string }[] = [
		{ cle: 'femmes', libelle: 'Femmes' },
		{ cle: 'filles', libelle: 'Filles' },
		{ cle: 'hommes', libelle: 'Hommes' },
		{ cle: 'garcons', libelle: 'Garçons' },
		{ cle: 'total', libelle: 'Total' }
	];
	const PAS = 50;

	const etat = $derived(depot.etat);
	const maintenant = $derived(depot.maintenant());

	/* ---------- Filtres (appliqués en direct) ---------- */
	let filtreVolet = $state('');
	let filtreOrganisation = $state('');
	let filtreFamille = $state('');
	let recherche = $state('');

	const optionsVolet = $derived([
		{ valeur: '', libelle: 'Tous les volets' },
		...etat.volets.map((v) => ({ valeur: v.code, libelle: `${etat.secteurs.find((s) => s.code === v.secteur)?.libelle_court ?? v.secteur}, ${v.organisation}` }))
	]);
	const optionsOrganisation = $derived([{ valeur: '', libelle: 'Toutes les organisations' }, ...etat.organisations.map((o) => ({ valeur: o.sigle, libelle: o.sigle }))]);
	const optionsFamille = [{ valeur: '', libelle: 'Tous les types' }, ...(Object.entries(FAMILLES) as [Famille, string][]).map(([valeur, libelle]) => ({ valeur, libelle }))];

	const filtresActifs = $derived(!!(filtreVolet || filtreOrganisation || filtreFamille || recherche.trim()));

	function effacerFiltres() {
		filtreVolet = '';
		filtreOrganisation = '';
		filtreFamille = '';
		recherche = '';
	}

	/** Recherche insensible à la casse et aux accents. */
	function normaliser(s: string): string {
		return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
	}
	function texteRecherche(ev: Evenement): string {
		return [depot.nomUtilisateur(ev.auteur), ev.organisation, ev.resume, ev.cible.libelle, ev.volet ?? '', ev.mois ? libelleMois(ev.mois) : ''].join(' ');
	}

	const filtres = $derived.by(() => {
		const q = normaliser(recherche.trim());
		return etat.journal.filter(
			(ev) =>
				(!filtreVolet || ev.volet === filtreVolet) &&
				(!filtreOrganisation || ev.organisation === filtreOrganisation) &&
				(!filtreFamille || FAMILLE_DU_TYPE[ev.type] === filtreFamille) &&
				(!q || normaliser(texteRecherche(ev)).includes(q))
		);
	});

	/* ---------- Pagination : revient à 50 dès que les filtres changent ---------- */
	const cleFiltres = $derived(`${filtreVolet}|${filtreOrganisation}|${filtreFamille}|${recherche.trim()}`);
	let pagination = $state({ cle: '', limite: PAS });
	const limite = $derived(pagination.cle === cleFiltres ? pagination.limite : PAS);
	const visibles = $derived(filtres.slice(0, limite));
	const restants = $derived(Math.max(0, filtres.length - visibles.length));

	function afficherPlus() {
		pagination = { cle: cleFiltres, limite: limite + PAS };
	}

	/* ---------- Groupement par jour (le journal est trié du plus récent au plus ancien) ---------- */
	function jourLocal(d: Date): string {
		const p = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
	}
	const aujourdhui = $derived(jourLocal(maintenant));
	const hier = $derived(jourLocal(new Date(maintenant.getTime() - 86_400_000)));

	function libelleJour(jour: string): string {
		const d = date(`${jour}T12:00:00`);
		if (jour === aujourdhui) return `Aujourd’hui, ${d}`;
		if (jour === hier) return `Hier, ${d}`;
		return d;
	}

	const jours = $derived.by(() => {
		const groupes: { jour: string; evenements: Evenement[] }[] = [];
		for (const ev of visibles) {
			const jour = ev.date.slice(0, 10);
			const dernier = groupes.at(-1);
			if (dernier?.jour === jour) dernier.evenements.push(ev);
			else groupes.push({ jour, evenements: [ev] });
		}
		return groupes;
	});

	/* ---------- Détails avant / après ---------- */
	function estDesagregation(x: unknown): x is Desagregation {
		return !!x && typeof x === 'object' && 'total' in x;
	}
	function aDetails(ev: Evenement): boolean {
		return estDesagregation(ev.apres) || estDesagregation(ev.avant);
	}

	let detail = $state<Evenement | null>(null);
	const detailAvant = $derived(detail && estDesagregation(detail.avant) ? detail.avant : null);
	const detailApres = $derived(detail && estDesagregation(detail.apres) ? detail.apres : null);
	const detailIndicateur = $derived(detail ? etat.indicateurs.find((i) => i.id === detail!.cible.id) : undefined);
	const enPourcentage = $derived(detailIndicateur?.type_valeur === 'pourcentage');

	function valeur(n: number | null | undefined): string {
		return enPourcentage ? pourcent(n) : nombre(n);
	}
	function ecart(a: number | null | undefined, b: number | null | undefined): string {
		if (a === null || a === undefined || b === null || b === undefined) return '–';
		const d = b - a;
		if (d === 0) return 'inchangé';
		const texte = enPourcentage ? `${nombre(Math.abs(d))} point${Math.abs(d) > 1 ? 's' : ''}` : nombre(Math.abs(d));
		return `${d > 0 ? '+' : '−'}${texte}`;
	}
	function heure(iso: string): string {
		const d = new Date(iso);
		return `${String(d.getHours()).padStart(2, '0')} h ${String(d.getMinutes()).padStart(2, '0')}`;
	}
	function nomVolet(code: string | null): string {
		const v = etat.volets.find((x) => x.code === code);
		if (!v) return '';
		return `${etat.secteurs.find((s) => s.code === v.secteur)?.libelle_court ?? v.secteur}, ${v.organisation}`;
	}
</script>

<svelte:head><title>Activité · Suivi consortium APSUD</title></svelte:head>

<div class="p-activite">
	<header class="p-activite__tete">
		<div class="p-activite__titres">
			<h1 class="p-activite__titre">Activité</h1>
			<p class="p-activite__intro">
				Chaque modification est enregistrée ici avec son auteur, sa date et les anciennes et nouvelles valeurs. Ce journal ne peut être ni modifié ni
				effacé.
			</p>
		</div>
		<span class="p-activite__badge"><Icone nom="cadenas" taille="sm" /> Lecture seule, inaltérable</span>
	</header>

	<form class="p-activite__filtres" role="search" aria-label="Filtrer le journal" onsubmit={(e) => e.preventDefault()}>
		<div class="p-activite__champ">
			<label for="filtre-volet">Volet</label>
			<select id="filtre-volet" bind:value={filtreVolet}>
				{#each optionsVolet as o (o.valeur)}<option value={o.valeur}>{o.libelle}</option>{/each}
			</select>
		</div>
		<div class="p-activite__champ">
			<label for="filtre-organisation">Organisation</label>
			<select id="filtre-organisation" bind:value={filtreOrganisation}>
				{#each optionsOrganisation as o (o.valeur)}<option value={o.valeur}>{o.libelle}</option>{/each}
			</select>
		</div>
		<div class="p-activite__champ">
			<label for="filtre-famille">Type d’événement</label>
			<select id="filtre-famille" bind:value={filtreFamille}>
				{#each optionsFamille as o (o.valeur)}<option value={o.valeur}>{o.libelle}</option>{/each}
			</select>
		</div>
		<div class="p-activite__champ p-activite__champ--recherche">
			<label for="filtre-recherche">Rechercher</label>
			<span class="p-activite__saisie-recherche">
				<Icone nom="recherche" taille="sm" />
				<input id="filtre-recherche" type="search" bind:value={recherche} placeholder="Nom, indicateur, activité…" autocomplete="off" />
			</span>
		</div>
		<div class="p-activite__effacer">
			<Bouton variante="texte" icone="fermer" disabled={!filtresActifs} onclick={effacerFiltres}>Effacer les filtres</Bouton>
		</div>
	</form>

	<Panneau titre="Journal d’audit" id="journal">
		{#snippet actions()}
			<p class="p-activite__compte" role="status">
				{entier(filtres.length)} événement{filtres.length > 1 ? 's' : ''}{filtresActifs ? ' correspondant aux filtres' : ''}
			</p>
		{/snippet}

		{#if filtres.length}
			<div class="p-activite__journal" role="log" aria-label="Journal d’audit">
				{#each jours as groupe (groupe.jour)}
					<section class="p-activite__jour" aria-labelledby="jour-{groupe.jour}">
						<h2 class="p-activite__jour-titre" id="jour-{groupe.jour}">
							<time datetime={groupe.jour}>{libelleJour(groupe.jour)}</time>
							<span class="p-activite__jour-compte">{entier(groupe.evenements.length)} événement{groupe.evenements.length > 1 ? 's' : ''}</span>
						</h2>
						<ul class="p-activite__liste" role="list">
							{#each groupe.evenements as ev (ev.id)}
								<li class="p-activite__ligne">
									<div class="p-activite__ligne-texte"><LigneActivite evenement={ev} /></div>
									{#if aDetails(ev)}
										<Bouton variante="texte" taille="sm" icone="oeil" aria-label="Détails de la modification : {ev.cible.libelle}, {dateHeure(ev.date)}" onclick={() => (detail = ev)}>
											Détails
										</Bouton>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
			{#if restants > 0}
				<div class="p-activite__plus">
					<p class="p-activite__compte">{entier(visibles.length)} sur {entier(filtres.length)} affichés</p>
					<Bouton variante="secondaire" icone="plus" onclick={afficherPlus}>Afficher {Math.min(PAS, restants)} de plus</Bouton>
				</div>
			{/if}
		{:else}
			<EtatVide icone="filtre" titre="Aucun événement ne correspond à ces filtres." texte="Élargissez la recherche ou effacez les filtres pour revoir tout le journal.">
				{#snippet action()}
					{#if filtresActifs}<Bouton variante="secondaire" icone="fermer" onclick={effacerFiltres}>Effacer les filtres</Bouton>{/if}
				{/snippet}
			</EtatVide>
		{/if}
	</Panneau>
</div>

{#if detail}
	<Dialogue ouvert titre="Détails de la modification" onfermer={() => (detail = null)}>
		<dl class="p-activite__detail-meta">
			<div>
				<dt>Élément</dt>
				<dd>{detail.cible.libelle}</dd>
			</div>
			<div>
				<dt>Auteur</dt>
				<dd>{depot.nomUtilisateur(detail.auteur)} ({detail.organisation})</dd>
			</div>
			<div>
				<dt>Date</dt>
				<dd><time datetime={detail.date}>{date(detail.date)} à {heure(detail.date)}</time></dd>
			</div>
			{#if detail.volet}
				<div>
					<dt>Volet</dt>
					<dd>{nomVolet(detail.volet)}{detail.mois ? ` · rapport de ${libelleMois(detail.mois)}` : ''}</dd>
				</div>
			{/if}
		</dl>
		{#if !detailAvant}
			<p class="p-activite__detail-note">Première saisie : aucune valeur n’existait avant cette modification.</p>
		{/if}
		<table class="p-activite__detail-table">
			<caption class="u-visuellement-masque">Valeurs avant et après la modification, par désagrégation</caption>
			<thead>
				<tr>
					<th scope="col"><span class="u-visuellement-masque">Désagrégation</span></th>
					<th scope="col" class="u-nombre">Avant</th>
					<th scope="col" class="u-nombre">Après</th>
					<th scope="col" class="u-nombre">Écart</th>
				</tr>
			</thead>
			<tbody>
				{#each PARTS as p (p.cle)}
					<tr class:p-activite__detail-total={p.cle === 'total'}>
						<th scope="row">{p.libelle}</th>
						<td class="u-nombre">{valeur(detailAvant?.[p.cle])}</td>
						<td class="u-nombre">{valeur(detailApres?.[p.cle])}</td>
						<td class="u-nombre">{ecart(detailAvant?.[p.cle], detailApres?.[p.cle])}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="p-activite__detail-note">L’ancienne valeur reste conservée dans l’historique de l’indicateur. Ce détail ne peut pas être modifié.</p>
		{#snippet actions()}
			<Bouton variante="secondaire" onclick={() => (detail = null)}>Fermer</Bouton>
		{/snippet}
	</Dialogue>
{/if}
