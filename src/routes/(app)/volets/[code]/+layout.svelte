<script lang="ts">
	import { page } from '$app/state';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { budgetVolet } from '#lib/donnees/calculs.ts';
	import { peutEcrireVolet, peutValider } from '#lib/donnees/regles.ts';
	import { montant, pourcent } from '#lib/format.ts';
	import type { CodeVolet } from '#lib/donnees/types.ts';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import Onglets from '#lib/composants/ui/Onglets.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import type { LayoutProps } from './$types';
	import './volet.css';

	let { children }: LayoutProps = $props();

	const code = $derived(page.params.code as CodeVolet);
	const volet = $derived(depot.etat.volets.find((v) => v.code === code));
	const secteur = $derived(depot.etat.secteurs.find((s) => s.code === volet?.secteur));
	const organisation = $derived(depot.etat.organisations.find((o) => o.sigle === volet?.organisation));
	const u = $derived(depot.utilisateur);
	const ecrit = $derived(volet ? peutEcrireVolet(u, volet) : false);
	const budget = $derived(volet ? budgetVolet(depot.etat, volet.code) : null);
	const nbActivites = $derived(depot.etat.activites.filter((a) => a.volet === code && !a.archive_le).length);
	const nbIndicateurs = $derived(depot.etat.indicateurs.filter((i) => i.volet === code && !i.archive_le).length);
	const base = $derived(`/volets/${code}`);
	const chemin = $derived(page.url.pathname);
	const listeMois = $derived(depot.etat.projet.mois);
	const surPlanification = $derived(chemin.startsWith(`${base}/planification`));
	/** Mois du rapport (Indicateurs, Activités). Sur la planification, l'adresse porte M+1 : on revient d'un mois. */
	const moisRapport = $derived.by(() => {
		const m = (page.params.mois as string | undefined) ?? contexte.mois;
		if (!surPlanification || !page.params.mois) return m;
		const i = listeMois.indexOf(m);
		return i > 0 ? listeMois[i - 1] : m;
	});
	const moisSuivant = $derived(listeMois[Math.min(listeMois.indexOf(moisRapport) + 1, listeMois.length - 1)] ?? moisRapport);

	const onglets = $derived([
		{ libelle: 'Synthèse', href: base, actif: chemin === base },
		{ libelle: 'Indicateurs', href: `${base}/indicateurs/${moisRapport}`, actif: chemin.startsWith(`${base}/indicateurs`) || chemin.startsWith(`${base}/cadre-logique`) },
		{ libelle: 'Activités', href: `${base}/activites/${moisRapport}`, actif: chemin.startsWith(`${base}/activites`) || chemin.startsWith(`${base}/plan-action`) },
		{ libelle: 'Activités planifiées', href: `${base}/planification/${moisSuivant}`, actif: surPlanification }
	]);
</script>

{#if volet && secteur}
	<div class="p-volet p-volet--{volet.secteur.toLowerCase()}">
		<header class="p-volet__tete">
			<div class="p-volet__identite">
				<LogoOrganisation sigle={volet.organisation} taille="lg" alt="Logo {organisation?.nom ?? volet.organisation}" />
				<div>
					<p class="p-volet__surtitre">{organisation?.sigle} · volet {volet.code}</p>
					<h1 class="p-volet__titre">{secteur.libelle}</h1>
					<p class="p-volet__meta">
						{nbActivites} activités · {nbIndicateurs} indicateurs · budget {montant(budget?.planifie)} ({pourcent(Math.round(budget?.taux ?? 0))} exécuté)
					</p>
				</div>
			</div>
			<div class="p-volet__etat">
				{#if volet.cadre_verrouille}
					<span class="p-volet__badge" title="La structure (activités, indicateurs) ne peut plus être modifiée sans déverrouillage par APSUD. Les saisies mensuelles continuent.">
						<Icone nom="cadenas" taille="sm" /> Cadre logique verrouillé
					</span>
				{/if}
				{#if ecrit}
					<span class="p-volet__badge p-volet__badge--droit"><Icone nom="modifier" taille="sm" /> Vous pouvez saisir</span>
				{:else}
					<span class="p-volet__badge"><Icone nom="oeil" taille="sm" /> Lecture seule</span>
				{/if}
				{#if peutValider(u)}
					<Bouton variante="secondaire" taille="sm" icone={volet.cadre_verrouille ? 'deverrouiller' : 'cadenas'} onclick={() => depot.basculerVerrouCadre(volet.code)}>
						{volet.cadre_verrouille ? 'Déverrouiller le cadre' : 'Verrouiller le cadre'}
					</Bouton>
				{/if}
			</div>
		</header>
		<Onglets etiquette="Sections du volet" {onglets} />
		<div class="p-volet__contenu">
			{@render children()}
		</div>
	</div>
{:else}
	<p>Volet introuvable. <a href="/">Retour au tableau de bord</a></p>
{/if}
