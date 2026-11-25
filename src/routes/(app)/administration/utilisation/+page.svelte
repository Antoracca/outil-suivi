<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { serveur } from '#lib/donnees/reel/client.ts';
	import { peutAdministrer } from '#lib/donnees/regles.ts';
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import { analyser, constats, versCsv, LIBELLES_FORMAT, type MesureBrute, type NiveauConstat } from '#lib/analytique/analyse.ts';
	import { date, nombre } from '#lib/format.ts';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Tuile from '#lib/composants/ui/Tuile.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import BarresJour from '#lib/composants/graphiques/BarresJour.svelte';
	import CarteHeures from '#lib/composants/graphiques/CarteHeures.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import type { NomIcone } from '#lib/icones/icones.ts';
	import './utilisation.css';

	/**
	 * Utilisation de l'outil (super-administrateur) : analyse complète de la mesure d'utilisation,
	 * sur 7, 30 ou 90 jours. Mode réel : mesures lues en base (seul le super-admin y a accès) ;
	 * démonstration : mesures de ce navigateur. Calculs : src/lib/analytique/analyse.ts.
	 */
	const PERIODES = [7, 30, 90] as const;
	let jours = $state<number>(30);
	let brutes = $state<MesureBrute[]>([]);
	let consentements = $state<{ oui: number; non: number } | null>(null);
	let chargement = $state(true);
	let erreur = $state<string | null>(null);
	let maintenant = $state(new Date());

	const admin = $derived(peutAdministrer(depot.utilisateur));
	const etat = $derived(depot.etat);
	const organisations = $derived(etat.organisations.filter((o) => etat.volets.some((v) => v.organisation === o.sigle) || o.sigle === 'APSUD').map((o) => ({ sigle: o.sigle, nom: o.nom })));
	const synthese = $derived(analyser(brutes, { jours, maintenant, organisations, comptes: etat.utilisateurs.length, consentements }));
	const liste = $derived(constats(synthese));

	async function charger() {
		chargement = true;
		erreur = null;
		maintenant = new Date();
		try {
			if (depot.source === 'demo') {
				brutes = collecte.mesuresDemo() as MesureBrute[];
				consentements = null;
			} else {
				const depuis = new Date(Date.now() - jours * 86_400_000).toISOString();
				const lignes: MesureBrute[] = [];
				for (let debut = 0; debut < 50_000; debut += 1000) {
					const { data, error } = await serveur()
						.from('analytique_evenements')
						.select('utilisateur, organisation, role, session, type, page, cible, donnees, date')
						.gte('date', depuis)
						.order('date')
						.range(debut, debut + 999);
					if (error) throw new Error(error.message);
					lignes.push(...((data ?? []) as MesureBrute[]));
					if (!data || data.length < 1000) break;
				}
				brutes = lignes;
				const { data: c } = await serveur().from('consentements').select('analytique');
				consentements = c ? { oui: c.filter((x) => x.analytique).length, non: c.filter((x) => !x.analytique).length } : null;
			}
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		} finally {
			chargement = false;
		}
	}

	$effect(() => {
		void jours;
		if (admin && depot.pret) void charger();
	});

	function exporter() {
		const lien = document.createElement('a');
		lien.href = URL.createObjectURL(new Blob([versCsv(brutes)], { type: 'text/csv;charset=utf-8' }));
		lien.download = `utilisation-outil-${jours}-jours-${new Date().toISOString().slice(0, 10)}.csv`;
		lien.click();
		setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
	}

	const duree = (s: number | null) => (s === null ? '–' : s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
	const secondes = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`);
	const maxVues = $derived(Math.max(1, ...synthese.ecrans.map((e) => e.vues)));
	const totalFormats = $derived(synthese.formats.reduce((a, f) => a + f.nb, 0));
	const totalConnexions = $derived(synthese.connexions.reduce((a, f) => a + f.nb, 0));
	const ICONES_NIVEAU: Record<NiveauConstat, NomIcone> = { alerte: 'alerte', attention: 'alerte', info: 'info', positif: 'valider' };
	const LIBELLES_NIVEAU: Record<NiveauConstat, string> = { alerte: 'À corriger', attention: 'À surveiller', info: 'À savoir', positif: 'Bon signe' };
	const tauxConsentement = $derived(consentements && consentements.oui + consentements.non ? Math.round((consentements.oui / (consentements.oui + consentements.non)) * 100) : null);
</script>

<svelte:head><title>Utilisation de l’outil · Suivi consortium APSUD</title></svelte:head>

<div class="p-usage">
	<header class="p-usage__tete">
		<div>
			<p class="p-usage__fil"><a href="/administration">Administration</a> › Utilisation de l’outil</p>
			<h1 class="p-usage__titre">Utilisation de l’outil</h1>
			<p class="p-usage__intro">Comment la plateforme est utilisée, par les comptes qui y consentent : écrans, parcours, actions, appareils, difficultés. Les constats proposent une piste d’amélioration.</p>
		</div>
		<div class="p-usage__outils">
			<div class="p-usage__periodes" role="group" aria-label="Période analysée">
				{#each PERIODES as p (p)}
					<button type="button" class:is-actif={jours === p} aria-pressed={jours === p} onclick={() => (jours = p)}>{p} jours</button>
				{/each}
			</div>
			<Bouton variante="secondaire" taille="sm" icone="synchro" onclick={charger} disabled={chargement}>Actualiser</Bouton>
			<Bouton variante="secondaire" taille="sm" icone="telecharger" onclick={exporter} disabled={!brutes.length}>Exporter (CSV)</Bouton>
		</div>
	</header>

	{#if !admin}
		<EtatVide icone="cadenas" titre="Réservé au super-administrateur" texte="L’analyse de l’utilisation n’est accessible qu’à la super-administration d’APSUD." />
	{:else if erreur}
		<EtatVide icone="alerte" titre="Analyse indisponible" texte={erreur} />
	{:else}
		{#if depot.source === 'demo'}
			<p class="p-usage__note"><Icone nom="info" taille="sm" /> Démonstration : mesures de ce navigateur seulement, après « Je consens ».</p>
		{/if}

		<section class="p-usage__tuiles" aria-label="Chiffres clés de la période" aria-busy={chargement}>
			<Tuile chiffre={nombre(synthese.kpi.utilisateurs)} libelle={synthese.kpi.utilisateurs > 1 ? 'comptes actifs' : 'compte actif'} detail={synthese.kpi.comptes ? `sur ${nombre(synthese.kpi.comptes)} comptes` : undefined} />
			<Tuile chiffre={nombre(synthese.kpi.sessions)} libelle={synthese.kpi.sessions > 1 ? 'sessions' : 'session'} detail="{nombre(synthese.kpi.pagesVues)} écrans ouverts" />
			<Tuile chiffre={duree(synthese.kpi.dureeSessionMediane)} libelle="durée d’une session" detail="valeur médiane" />
			<Tuile chiffre={nombre(synthese.kpi.actions)} libelle={synthese.kpi.actions > 1 ? 'actions métier' : 'action métier'} detail="saisies, soumissions, justificatifs…" />
			<Tuile chiffre={nombre(synthese.kpi.erreurs + synthese.kpi.frictions)} libelle="difficultés relevées" detail="{nombre(synthese.kpi.erreurs)} erreurs, {nombre(synthese.kpi.frictions)} clics répétés" />
			<Tuile chiffre={tauxConsentement === null ? '–' : `${tauxConsentement} %`} libelle="consentement" detail={consentements ? `${consentements.oui} oui, ${consentements.non} non` : 'en mode réel seulement'} />
		</section>

		<Panneau titre="Constats automatiques" sousTitre="Calculés à chaque ouverture à partir des mesures : ce qui mérite votre attention, avec une piste.">
			<ul class="p-usage__constats" role="list">
				{#each liste as c, i (i)}
					<li class="p-usage__constat p-usage__constat--{c.niveau}">
						<span class="p-usage__constat-icone" aria-hidden="true"><Icone nom={ICONES_NIVEAU[c.niveau]} taille="sm" /></span>
						<div>
							<p class="p-usage__constat-titre"><span class="p-usage__constat-niveau">{LIBELLES_NIVEAU[c.niveau]}</span> {c.titre}</p>
							<p class="p-usage__constat-detail">{c.detail}</p>
							<p class="p-usage__constat-piste"><strong>Piste :</strong> {c.piste}</p>
						</div>
					</li>
				{/each}
			</ul>
		</Panneau>

		<div class="p-usage__duo">
			<Panneau titre="Sessions par jour" sousTitre="Survolez une barre pour le détail du jour.">
				<BarresJour donnees={synthese.parJour} titre="Sessions par jour sur {jours} jours" />
			</Panneau>
			<Panneau titre="Heures d’activité" sousTitre="Quand l’outil est utilisé, heure de Bangui.">
				<CarteHeures heures={synthese.parHeure} />
			</Panneau>
		</div>

		<Panneau titre="Écrans" sousTitre="Les plus ouverts, avec le temps passé en moyenne et le temps d’affichage." sansMarge>
			{#if synthese.ecrans.length}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (zone défilante : doit être atteignable au clavier, WCAG 2.1.1) -->
				<div class="p-usage__defilement" tabindex="0" role="region" aria-label="Tableau des écrans">
					<table class="p-usage__table">
						<caption class="u-visuellement-masque">Écrans les plus ouverts</caption>
						<thead><tr><th scope="col">Écran</th><th scope="col">Ouvertures</th><th scope="col" class="u-nombre">Comptes</th><th scope="col" class="u-nombre">Temps moyen</th><th scope="col" class="u-nombre">Affichage (médian)</th></tr></thead>
						<tbody>
							{#each synthese.ecrans as e (e.ecran)}
								<tr>
									<th scope="row">{e.ecran}</th>
									<td><span class="p-usage__jauge"><span style:inline-size="{(e.vues / maxVues) * 100}%"></span></span> <span class="p-usage__valeur">{nombre(e.vues)}</span></td>
									<td class="u-nombre">{nombre(e.utilisateurs)}</td>
									<td class="u-nombre">{duree(e.tempsMoyen)}</td>
									<td class="u-nombre" class:p-usage__lent={(e.vitesseMediane ?? 0) > 3000}>{secondes(e.vitesseMediane)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="p-usage__vide">Aucun écran ouvert sur la période.</p>
			{/if}
		</Panneau>

		<div class="p-usage__duo">
			<Panneau titre="Parcours fréquents" sousTitre="Écran suivant le plus souvent ouvert.">
				{#if synthese.parcours.length}
					<ol class="p-usage__liste">
						{#each synthese.parcours as p, i (i)}
							<li><span>{p.de}</span> <Icone nom="chevron-droite" taille="sm" /> <strong>{p.vers}</strong> <span class="p-usage__nb">{nombre(p.nb)}</span></li>
						{/each}
					</ol>
				{:else}<p class="p-usage__vide">Pas encore de parcours.</p>{/if}
			</Panneau>
			<Panneau titre="Actions métier" sousTitre="Ce que les comptes font vraiment dans l’outil.">
				{#if synthese.actions.length}
					<ol class="p-usage__liste">
						{#each synthese.actions as a (a.action)}<li><span>{a.action}</span> <span class="p-usage__nb">{nombre(a.nb)}</span></li>{/each}
					</ol>
				{:else}<p class="p-usage__vide">Aucune action sur la période.</p>{/if}
			</Panneau>
		</div>

		<div class="p-usage__duo">
			<Panneau titre="Organisations" sousTitre="Activité de chaque organisation (comptes qui consentent)." sansMarge>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (zone défilante : doit être atteignable au clavier, WCAG 2.1.1) -->
				<div class="p-usage__defilement" tabindex="0" role="region" aria-label="Tableau des organisations">
					<table class="p-usage__table">
						<caption class="u-visuellement-masque">Activité par organisation</caption>
						<thead><tr><th scope="col">Organisation</th><th scope="col" class="u-nombre">Comptes</th><th scope="col" class="u-nombre">Sessions</th><th scope="col" class="u-nombre">Actions</th><th scope="col">Dernière visite</th></tr></thead>
						<tbody>
							{#each synthese.organisations as o (o.sigle)}
								<tr>
									<th scope="row"><span class="p-usage__org"><LogoOrganisation sigle={o.sigle} taille="sm" /> {o.sigle}</span></th>
									<td class="u-nombre">{nombre(o.utilisateurs)}</td>
									<td class="u-nombre">{nombre(o.sessions)}</td>
									<td class="u-nombre">{nombre(o.actions)}</td>
									<td>{o.derniere ? date(o.derniere.toISOString()) : 'Aucune'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Panneau>
			<Panneau titre="Appareils et connexion" sousTitre="Une mesure par session.">
				<div class="p-usage__repartitions">
					<div>
						<h3 class="p-usage__sous-titre">Appareil</h3>
						{#each synthese.formats as f (f.cle)}
							<p class="p-usage__barre-ligne"><span>{LIBELLES_FORMAT[f.cle] ?? f.cle}</span><span class="p-usage__jauge"><span style:inline-size="{(f.nb / Math.max(1, totalFormats)) * 100}%"></span></span><span class="p-usage__nb">{Math.round((f.nb / Math.max(1, totalFormats)) * 100)} %</span></p>
						{:else}<p class="p-usage__vide">Rien encore.</p>{/each}
					</div>
					<div>
						<h3 class="p-usage__sous-titre">Connexion</h3>
						{#each synthese.connexions as f (f.cle)}
							<p class="p-usage__barre-ligne"><span>{f.cle === 'inconnue' ? 'non mesurée' : f.cle.toUpperCase()}</span><span class="p-usage__jauge"><span style:inline-size="{(f.nb / Math.max(1, totalConnexions)) * 100}%"></span></span><span class="p-usage__nb">{Math.round((f.nb / Math.max(1, totalConnexions)) * 100)} %</span></p>
						{:else}<p class="p-usage__vide">Rien encore.</p>{/each}
					</div>
				</div>
			</Panneau>
		</div>

		<div class="p-usage__duo">
			<Panneau titre="Boutons et liens les plus utilisés">
				{#if synthese.clics.length}
					<ol class="p-usage__liste">{#each synthese.clics as c (c.cible)}<li><span>{c.cible}</span> <span class="p-usage__nb">{nombre(c.nb)}</span></li>{/each}</ol>
				{:else}<p class="p-usage__vide">Aucun clic sur la période.</p>{/if}
			</Panneau>
			<Panneau titre="Difficultés" sousTitre="Erreurs rencontrées et boutons cliqués plusieurs fois de suite.">
				{#if synthese.erreurs.length || synthese.frictions.length}
					<ul class="p-usage__liste" role="list">
						{#each synthese.erreurs as e, i (i)}<li class="p-usage__difficulte"><Icone nom="alerte" taille="sm" /> <span><strong>{e.message}</strong> · {e.ecran}</span> <span class="p-usage__nb">{nombre(e.nb)}</span></li>{/each}
						{#each synthese.frictions as f, i (i)}<li class="p-usage__difficulte"><Icone nom="info" taille="sm" /> <span>« {f.cible} » cliqué plusieurs fois · {f.ecran}</span> <span class="p-usage__nb">{nombre(f.nb)}</span></li>{/each}
					</ul>
				{:else}<p class="p-usage__vide">Aucune difficulté relevée : bon signe.</p>{/if}
			</Panneau>
		</div>
	{/if}
</div>
