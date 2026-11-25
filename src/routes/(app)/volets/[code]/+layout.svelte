<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { budgetVolet } from '#lib/donnees/calculs.ts';
	import { peutEcrireVolet, peutValider } from '#lib/donnees/regles.ts';
	import { libelleMois, montant, pourcent } from '#lib/format.ts';
	import type { CodeVolet } from '#lib/donnees/types.ts';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import Onglets from '#lib/composants/ui/Onglets.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import LigneActivite from '#lib/composants/donnees/LigneActivite.svelte';
	import { LIBELLES_ONGLET, nonLuesDe, ongletDe, type OngletVolet } from '#lib/donnees/notifications.ts';
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
	/** Demande APSUD : « Activités planifiées – mois prochain ». À l'écran, le nom du mois (plus précis) ; en entier pour les lecteurs d'écran. */
	const estMoisProchain = $derived(moisSuivant !== moisRapport);
	const precisionPlanif = $derived(`pour ${libelleMois(moisSuivant, false)}`);
	const nomPlanif = $derived(`Activités planifiées pour ${libelleMois(moisSuivant)}${estMoisProchain ? ' (mois prochain)' : ''}`);

	/* ---------- Nouveautés non lues : compteur sur chaque onglet, bandeau sur l'onglet ouvert ---------- */
	const ongletActif = $derived<OngletVolet>(
		chemin.startsWith(`${base}/indicateurs`) || chemin.startsWith(`${base}/cadre-logique`)
			? 'indicateurs'
			: chemin.startsWith(`${base}/activites`) || chemin.startsWith(`${base}/plan-action`)
				? 'activites'
				: surPlanification
					? 'planification'
					: 'synthese'
	);
	const nonLuesVolet = $derived(nonLuesDe(depot.etat, depot.utilisateurId).filter((x) => x.ev.volet === code));
	const parOnglet = (o: OngletVolet) => nonLuesVolet.filter((x) => ongletDe(x.ev, depot.etat) === o);
	const ici = $derived(parOnglet(ongletActif));
	/** Nouveautés montées à l'écran, par onglet : elles passent « lues » quand on quitte l'onglet. */
	const vuesPar = new Map<string, Set<string>>();
	const cle = $derived(`${code}|${ongletActif}`);
	$effect(() => {
		const k = cle;
		const liste = ici;
		untrack(() => {
			const vues = vuesPar.get(k) ?? new Set<string>();
			for (const x of liste) vues.add(x.ev.id);
			vuesPar.set(k, vues);
		});
	});
	$effect(() => {
		const k = cle;
		return () => {
			const vues = vuesPar.get(k);
			vuesPar.delete(k);
			if (vues?.size) depot.marquerLues([...vues]);
		};
	});
	const nb = (o: OngletVolet) => parOnglet(o).length;
	const avecNouveautes = (libelle: string, o: OngletVolet) => (nb(o) ? `${libelle}, ${nb(o)} nouveauté${nb(o) > 1 ? 's' : ''} non lue${nb(o) > 1 ? 's' : ''}` : undefined);

	const onglets = $derived([
		{ libelle: 'Synthèse', href: base, actif: chemin === base, compteur: nb('synthese'), nomAccessible: avecNouveautes('Synthèse', 'synthese') },
		{ libelle: 'Indicateurs', href: `${base}/indicateurs/${moisRapport}`, actif: ongletActif === 'indicateurs', compteur: nb('indicateurs'), nomAccessible: avecNouveautes('Indicateurs', 'indicateurs') },
		{ libelle: 'Activités', href: `${base}/activites/${moisRapport}`, actif: ongletActif === 'activites', compteur: nb('activites'), nomAccessible: avecNouveautes('Activités', 'activites') },
		{ libelle: 'Activités planifiées', precision: precisionPlanif, nomAccessible: nb('planification') ? `${nomPlanif}, ${nb('planification')} nouveauté(s) non lue(s)` : nomPlanif, href: `${base}/planification/${moisSuivant}`, actif: surPlanification, compteur: nb('planification') }
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
		{#if ici.length}
			<section class="p-volet__nouveautes" aria-labelledby="nouveautes-titre">
				<span class="p-volet__nouveautes-picto" aria-hidden="true"><Icone nom="notification" taille="sm" /></span>
				<div class="p-volet__nouveautes-texte">
					<p id="nouveautes-titre"><strong>{ici.length} nouveauté{ici.length > 1 ? 's' : ''}</strong> dans {LIBELLES_ONGLET[ongletActif]} depuis votre dernière visite</p>
					<div class="p-volet__nouveautes-liste">
						{#each ici.slice(0, 3) as x (x.n.id)}
							<LigneActivite evenement={x.ev} nonLue compacte />
						{/each}
					</div>
					<p class="p-volet__nouveautes-note">{ici.length > 3 ? `Et ${ici.length - 3} autre${ici.length - 3 > 1 ? 's' : ''} dans la cloche. ` : ''}Elles seront marquées comme lues quand vous quitterez cet onglet.</p>
				</div>
				<Bouton variante="secondaire" taille="sm" icone="valider" onclick={() => depot.marquerLues(ici.map((x) => x.ev.id))}>Marquer comme lu</Bouton>
			</section>
		{/if}
		<div class="p-volet__contenu">
			{@render children()}
		</div>
	</div>
{:else}
	<p>Volet introuvable. <a href="/">Retour au tableau de bord</a></p>
{/if}
