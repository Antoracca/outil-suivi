<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { echeance, moisCourant } from '#lib/donnees/calculs.ts';
	import {
		DESCRIPTION_ROLE,
		LIBELLES_ROLE,
		peutAdministrer,
		peutAjouterOrganisation,
		peutArchiver,
		peutEcrireVolet,
		peutModifierStructure,
		peutSupprimer,
		peutValider,
		peutVoirArchives,
		transitionsPossibles
	} from '#lib/donnees/regles.ts';
	import { date, libelleMois, majuscule } from '#lib/format.ts';
	import type { CodeSecteur, CodeVolet, Rapport, Role, Sigle, StatutRapport, Utilisateur, Volet } from '#lib/donnees/types.ts';
	import anomalies from '#lib/donnees/demo/anomalies.json';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import Avatar from '#lib/composants/ui/Avatar.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import EtiquetteVolet from '#lib/composants/ui/EtiquetteVolet.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './administration.css';

	const etat = $derived(depot.etat);
	const u = $derived(depot.utilisateur);
	const admin = $derived(peutAdministrer(u));
	const maintenant = $derived(depot.maintenant());
	const courant = $derived(moisCourant(etat, maintenant));
	const libelleSecteur = (code: string) => etat.secteurs.find((s) => s.code === code)?.libelle_court ?? code;

	const reel = $derived(depot.source === 'reel');
	const TOUTES_SECTIONS = [
		{ id: 'utilisateurs', libelle: 'Utilisateurs' },
		{ id: 'invitations', libelle: 'Inviter' },
		{ id: 'droits', libelle: 'Matrice des droits' },
		{ id: 'organisations', libelle: 'Organisations et volets' },
		{ id: 'nouvelle-ong', libelle: 'Nouvelle ONG' },
		{ id: 'periodes', libelle: 'Périodes' },
		{ id: 'anomalies', libelle: 'Anomalies d’import' },
		{ id: 'demonstration', libelle: 'Démonstration' }
	];
	// Mode réel : invitations, pas de réinitialisation. Démonstration : l'inverse.
	const SECTIONS = $derived(TOUTES_SECTIONS.filter((s) => (reel ? s.id !== 'demonstration' : s.id !== 'invitations')));

	/* ---------- Matrice des droits : calculée À PARTIR de regles.ts ---------- */
	const ROLES: Role[] = ['super_admin', 'coordination', 'saisie'];

	/** Utilisateur fictif d'un rôle : APSUD pour la coordination, une ONG partenaire sinon. */
	const fictif = (role: Role): Utilisateur => ({
		id: `fictif-${role}`,
		nom: LIBELLES_ROLE[role],
		fonction: '',
		organisation: role === 'saisie' ? 'ARS' : 'APSUD',
		role,
		initiales: ''
	});
	const voletDe = (organisation: Sigle, cadre_verrouille = false): Volet => ({ code: 'NUT-ARS', organisation, secteur: 'NUT', cadre_verrouille });
	const rapportFictif = (statut: StatutRapport): Rapport => ({ id: 'fictif', volet: 'NUT-ARS', mois: '2026-11', statut, soumis_par: null, soumis_le: null, decision_par: null, decision_le: null, motif: null });
	const AUTRE_ORG: Sigle = 'IDC';

	interface Droit {
		oui: boolean;
		precision?: string;
	}

	/** Oui / Non, et si oui : sur son organisation seulement ou sur tous les volets. */
	function portee(x: Utilisateur, test: (v: Volet) => boolean): Droit {
		if (!test(voletDe(x.organisation))) return { oui: false };
		return { oui: true, precision: test(voletDe(AUTRE_ORG)) ? 'tous les volets' : 'son organisation seulement' };
	}
	const transition = (x: Utilisateur, statut: StatutRapport, vers: StatutRapport, org: Sigle = AUTRE_ORG) =>
		transitionsPossibles(x, voletDe(org), rapportFictif(statut)).some((t) => t.vers === vers);

	const ACTIONS: { action: string; droit: (x: Utilisateur) => Droit }[] = [
		// Décision D3 (à confirmer) : lecture de tout le consortium pour chaque compte.
		{ action: 'Consulter tout le consortium', droit: () => ({ oui: true }) },
		{ action: 'Saisir les données de son organisation', droit: (x) => portee(x, (v) => peutEcrireVolet(x, v)) },
		{
			action: 'Ajouter activités et tâches',
			droit: (x) => {
				const d = portee(x, (v) => peutModifierStructure(x, v));
				if (d.oui && !peutModifierStructure(x, voletDe(x.organisation, true))) d.precision = `${d.precision}, tant que le cadre n’est pas verrouillé`;
				return d;
			}
		},
		{ action: 'Soumettre un rapport', droit: (x) => portee(x, (v) => transitionsPossibles(x, v, rapportFictif('brouillon')).some((t) => t.vers === 'soumis')) },
		{ action: 'Valider / renvoyer', droit: (x) => ({ oui: transition(x, 'soumis', 'valide') && transition(x, 'soumis', 'a_corriger') }) },
		{ action: 'Verrouiller un cadre ou un rapport', droit: (x) => ({ oui: peutValider(x) && transition(x, 'valide', 'verrouille') }) },
		{ action: 'Archiver', droit: (x) => portee(x, (v) => peutArchiver(x, v)) },
		{ action: 'Restaurer', droit: (x) => ({ oui: peutVoirArchives(x) && peutValider(x) }) },
		{ action: 'Supprimer définitivement', droit: (x) => ({ oui: peutSupprimer(x) }) },
		{ action: 'Gérer les comptes', droit: (x) => ({ oui: peutAdministrer(x) }) },
		{ action: 'Ajouter une ONG ou un volet', droit: (x) => ({ oui: peutAjouterOrganisation(x) }) }
	];
	const matrice = ACTIONS.map((a) => ({ action: a.action, droits: ROLES.map((r) => a.droit(fictif(r))) }));

	/* ---------- Anomalies relevées à l'import ---------- */
	interface Anomalie {
		volet: string;
		code: string;
		message: string;
		cellule: string;
	}
	const LIBELLES_ANOMALIE: Record<string, string> = {
		A1: 'Dates de fin en 2024 (modèle recopié d’un ancien projet)',
		A2: 'Budgets planifiés de remplissage (100 partout)',
		A3: 'Tâches d’exemple identiques dans tous les fichiers',
		A4: '#REF! dans les totaux budgétaires',
		A5: 'En-tête de feuille incorrect',
		A6: '#REF! dans les totaux',
		A7: 'Point utilisé comme séparateur de milliers',
		A8: 'Point utilisé comme séparateur de milliers',
		A9: 'Cible tronquée',
		A10: 'Désagrégation incohérente',
		A11: 'Indicateur sans cible',
		A12: 'Indicateur répété : risque de double comptage',
		A13: 'Taux d’exécution saisis sur des échelles différentes'
	};
	const liste = anomalies as Anomalie[];
	const anomaliesParVolet = $derived(
		etat.volets
			.map((v) => ({ v, lignes: liste.filter((a) => a.volet === v.code).sort((a, b) => a.code.localeCompare(b.code, 'fr', { numeric: true })) }))
			.filter((g) => g.lignes.length)
	);

	/* ---------- Démonstration ---------- */
	let confirmerReinit = $state(false);
	let erreur = $state<string | null>(null);
	let message = $state<string | null>(null);

	function reinitialiser() {
		erreur = null;
		message = null;
		try {
			depot.reinitialiserDemo();
			message = 'Les données de démonstration ont été réinitialisées dans tous les onglets de ce navigateur.';
			confirmerReinit = false;
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
			confirmerReinit = false;
		}
	}

	/* ---------- Invitations (mode réel) ---------- */
	let invEmail = $state('');
	let invNom = $state('');
	let invFonction = $state('');
	let invOrganisation = $state<string>('ARS');
	let invRole = $state<string>('saisie');
	let invEnvoi = $state(false);
	let invErreurs = $state<{ email?: string; nom?: string }>({});
	let codeCree = $state<{ code: string; email: string; nom: string } | null>(null);
	const optionsOrganisations = $derived(etat.organisations.map((o) => ({ valeur: o.sigle, libelle: `${o.sigle} · ${o.nom}` })));
	const optionsRoles = $derived(
		ROLES.filter((r) => invOrganisation === 'APSUD' || r === 'saisie').map((r) => ({ valeur: r, libelle: LIBELLES_ROLE[r] }))
	);
	$effect(() => {
		if (!optionsRoles.some((o) => o.valeur === invRole)) invRole = 'saisie';
	});

	async function inviter(e: SubmitEvent) {
		e.preventDefault();
		invErreurs = {};
		erreur = null;
		codeCree = null;
		if (!/^S+@S+.S+$/.test(invEmail.trim())) invErreurs.email = 'Saisissez l’adresse e-mail professionnelle de la personne.';
		if (invNom.trim().length < 2) invErreurs.nom = 'Indiquez le nom de la personne ou l’intitulé du poste.';
		if (Object.keys(invErreurs).length) return;
		invEnvoi = true;
		try {
			const code = await depot.creerInvitation({ email: invEmail, nom: invNom, fonction: invFonction, organisation: invOrganisation, role: invRole });
			codeCree = { code, email: invEmail.trim().toLowerCase(), nom: invNom.trim() };
			invEmail = '';
			invNom = '';
			invFonction = '';
		} catch (err) {
			erreur = err instanceof Error ? err.message : String(err);
		} finally {
			invEnvoi = false;
		}
	}

	/* ---------- Nouvelle ONG ou nouveau volet (super-administrateur, démonstration et réel) ---------- */
	let ongSigle = $state('');
	let ongNom = $state('');
	let ongSecteur = $state<string>('WASH');
	let ongErreurs = $state<{ sigle?: string; nom?: string }>({});
	const sigleNormalise = $derived(ongSigle.trim().toUpperCase());
	const ongExistante = $derived(etat.organisations.find((o) => o.sigle === sigleNormalise) ?? null);
	const optionsSecteurs = $derived(etat.secteurs.map((x) => ({ valeur: x.code, libelle: `${x.libelle} (${x.code})` })));

	function ajouterOng(e: SubmitEvent) {
		e.preventDefault();
		ongErreurs = {};
		erreur = null;
		message = null;
		if (!/^[A-Z0-9]{2,12}$/.test(sigleNormalise)) ongErreurs.sigle = '2 à 12 lettres ou chiffres, sans espace ni tiret (ex. MSF, CARE).';
		if (!ongExistante && ongNom.trim().length < 3) ongErreurs.nom = 'Indiquez le nom complet de la nouvelle ONG.';
		if (Object.keys(ongErreurs).length) return;
		const dejaMembre = !!ongExistante; // lu avant l'ajout, qui rend l'ONG « existante »
		try {
			const code = depot.ajouterVolet(sigleNormalise, ongNom, ongSecteur as CodeSecteur);
			message = dejaMembre
				? `Volet ${code} ajouté à ${sigleNormalise}.`
				: depot.source === 'demo'
					? `${sigleNormalise} a rejoint le consortium avec le volet ${code}. Son compte « Saisie ${sigleNormalise} » est disponible sur la page de connexion de démonstration.`
					: `${sigleNormalise} a rejoint le consortium avec le volet ${code}. Invitez maintenant son point focal (section Inviter).`;
			ongSigle = '';
			ongNom = '';
		} catch (err) {
			erreur = err instanceof Error ? err.message : String(err);
		}
	}

	const voletsDe = (sigle: Sigle) => etat.volets.filter((v) => v.organisation === sigle).map((v) => v.code);
	const comptesDe = (sigle: Sigle) => etat.utilisateurs.filter((x) => x.organisation === sigle).length;
	const situation = (m: string) => {
		if (m === courant) return 'En cours';
		return echeance(m).getTime() < maintenant.getTime() ? 'Échéance passée' : m < courant ? 'Rapport attendu' : 'À venir';
	};
	const lienVolet = (code: CodeVolet) => `/volets/${code}`;
</script>

<svelte:head><title>Administration · Suivi consortium APSUD</title></svelte:head>

<div class="p-admin">
	<header class="p-admin__tete">
		<h1 class="p-admin__titre">Administration</h1>
		<p class="p-admin__intro">Comptes, droits, référentiels du projet et contrôle de l’import des fichiers Excel.</p>
	</header>

	{#if !admin}
		<EtatVide icone="cadenas" titre="Administration réservée au super-administrateur" texte="Seul le super-administrateur gère les comptes, les droits et les référentiels. Pour une demande de compte ou de modification, contactez la coordination APSUD." />
	{:else}
		<nav class="p-admin__sommaire" aria-label="Sections de l’administration">
			<ul role="list">
				{#each SECTIONS as s (s.id)}
					<li><a href="#{s.id}">{s.libelle}</a></li>
				{/each}
			</ul>
		</nav>

		{#if erreur}
			<Alerte variante="erreur" titre="Action impossible" onfermer={() => (erreur = null)}>{erreur}</Alerte>
		{/if}
		{#if message}
			<Alerte variante="succes" onfermer={() => (message = null)}>{message}</Alerte>
		{/if}

		<!-- Utilisateurs -->
		<div class="p-admin__ancre" id="utilisateurs">
			<Panneau titre="Utilisateurs" sousTitre={reel ? `${etat.utilisateurs.length} compte${etat.utilisateurs.length > 1 ? 's' : ''} du consortium.` : `${etat.utilisateurs.length} comptes de démonstration (intitulés de rôle, aucune personne réelle).`} id="panneau-utilisateurs" sansMarge>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (zone défilante : doit être atteignable au clavier, WCAG 2.1.1) -->
				<div class="p-admin__defilement" tabindex="0" role="region" aria-label="Tableau des utilisateurs">
					<table class="p-admin__table">
						<caption class="u-visuellement-masque">Comptes utilisateurs de la plateforme</caption>
						<thead>
							<tr>
								<th scope="col">Nom</th>
								<th scope="col">Fonction</th>
								<th scope="col">Organisation</th>
								<th scope="col">Rôle</th>
							</tr>
						</thead>
						<tbody>
							{#each etat.utilisateurs as x (x.id)}
								<tr>
									<th scope="row">
										<span class="p-admin__personne">
											<Avatar initiales={x.initiales} nom={x.nom} organisation={x.organisation} />
											<span aria-hidden="true">{x.nom}</span>
											{#if x.id === u?.id}<span class="p-admin__badge">Vous</span>{/if}
										</span>
									</th>
									<td>{x.fonction}</td>
									<td>{x.organisation}</td>
									<td title={DESCRIPTION_ROLE[x.role]}>{LIBELLES_ROLE[x.role]}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="p-admin__note">
					<Icone nom="info" taille="sm" />
					<span>Comptes nominatifs, créés uniquement sur invitation ; jamais de compte partagé. Un départ se traite en désactivant le compte, jamais en le supprimant.</span>
				</p>
			</Panneau>
		</div>

		{#if reel}
			<!-- Invitations -->
			<div class="p-admin__ancre" id="invitations">
				<Panneau titre="Inviter une personne" sousTitre="La personne crée son compte avec ce code depuis l’écran de connexion (onglet Inscription). Code valable 14 jours, pour cette adresse seulement." id="panneau-invitations">
					<form class="p-admin__invitation" onsubmit={inviter} novalidate>
						<Champ id="inv-email" libelle="Adresse e-mail" type="email" inputmode="email" requis bind:valeur={invEmail} erreur={invErreurs.email} placeholder="prenom.nom@organisation.org" />
						<Champ id="inv-nom" libelle="Nom" requis bind:valeur={invNom} erreur={invErreurs.nom} aide="La personne pourra le corriger en créant son compte." />
						<Champ id="inv-fonction" libelle="Fonction" bind:valeur={invFonction} placeholder="Ex. Chargé de suivi-évaluation" />
						<Champ id="inv-organisation" libelle="Organisation" type="select" requis bind:valeur={invOrganisation} options={optionsOrganisations} />
						<Champ id="inv-role" libelle="Rôle" type="select" requis bind:valeur={invRole} options={optionsRoles} aide={DESCRIPTION_ROLE[invRole as Role]} />
						<div class="p-admin__invitation-actions">
							<Bouton variante="primaire" type="submit" icone="plus" disabled={invEnvoi}>{invEnvoi ? 'Création…' : 'Créer l’invitation'}</Bouton>
						</div>
					</form>
					{#if codeCree}
						<div class="p-admin__code" role="status">
							<p>Invitation créée pour <strong>{codeCree.nom}</strong> ({codeCree.email}). Transmettez-lui ce code, il ne sera plus affiché :</p>
							<p class="p-admin__code-valeur">{codeCree.code}</p>
							<p class="p-admin__note-code">Le code seul ne suffit pas : il ne fonctionne qu’avec cette adresse e-mail.</p>
						</div>
					{/if}
				</Panneau>
			</div>
		{/if}

		<!-- Matrice des droits -->
		<div class="p-admin__ancre" id="droits">
			<Panneau titre="Matrice des droits" sousTitre="Calculée directement à partir des règles de la plateforme : ce tableau ne peut pas diverger de ce que l’outil autorise." id="panneau-droits" sansMarge>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (zone défilante : doit être atteignable au clavier, WCAG 2.1.1) -->
				<div class="p-admin__defilement" tabindex="0" role="region" aria-label="Tableau de la matrice des droits">
					<table class="p-admin__table p-admin__matrice">
						<caption class="u-visuellement-masque">Ce que chaque rôle peut faire</caption>
						<thead>
							<tr>
								<th scope="col">Action</th>
								{#each ROLES as r (r)}<th scope="col" class="p-admin__role">{LIBELLES_ROLE[r]}</th>{/each}
							</tr>
						</thead>
						<tbody>
							{#each matrice as ligne (ligne.action)}
								<tr>
									<th scope="row">{ligne.action}</th>
									{#each ligne.droits as d, i (i)}
										<td>
											<span class="p-admin__droit" class:p-admin__droit--oui={d.oui} class:p-admin__droit--non={!d.oui}>
												<Icone nom={d.oui ? 'valider' : 'fermer'} taille="sm" />
												{d.oui ? 'Oui' : 'Non'}
											</span>
											{#if d.precision}<span class="p-admin__precision">{d.precision}</span>{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<dl class="p-admin__roles">
					{#each ROLES as r (r)}
						<div>
							<dt>{LIBELLES_ROLE[r]}</dt>
							<dd>{DESCRIPTION_ROLE[r]}</dd>
						</div>
					{/each}
				</dl>
				<p class="p-admin__note">
					<Icone nom="info" taille="sm" />
					<span>« Consulter tout le consortium » applique la décision D3 (lecture de tous les volets), encore à confirmer par APSUD.</span>
				</p>
			</Panneau>
		</div>

		<!-- Organisations et volets -->
		<div class="p-admin__ancre p-admin__duo" id="organisations">
			<Panneau titre="Organisations du consortium" id="panneau-organisations" sansMarge>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (zone défilante : doit être atteignable au clavier, WCAG 2.1.1) -->
				<div class="p-admin__defilement" tabindex="0" role="region" aria-label="Tableau des organisations">
					<table class="p-admin__table">
						<caption class="u-visuellement-masque">Organisations membres du consortium</caption>
						<thead>
							<tr>
								<th scope="col">Sigle</th>
								<th scope="col">Nom</th>
								<th scope="col">Rôle</th>
								<th scope="col">Volets</th>
								<th scope="col" class="u-nombre">Comptes</th>
							</tr>
						</thead>
						<tbody>
							{#each etat.organisations as o (o.sigle)}
								<tr>
									<th scope="row">{o.sigle}</th>
									<td>{o.nom}{#if o.ville}<span class="p-admin__detail">{o.ville}</span>{/if}</td>
									<td>{o.role_consortium === 'chef_de_file' ? 'Chef de file' : 'Partenaire'}</td>
									<td>{voletsDe(o.sigle).join(', ') || '–'}</td>
									<td class="u-nombre">{comptesDe(o.sigle)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Panneau>

			<Panneau titre="Volets" sousTitre="Un volet = une ONG sur un secteur = un fichier Excel." id="panneau-volets" sansMarge>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (zone défilante : doit être atteignable au clavier, WCAG 2.1.1) -->
				<div class="p-admin__defilement" tabindex="0" role="region" aria-label="Tableau des volets">
					<table class="p-admin__table">
						<caption class="u-visuellement-masque">Les volets du consortium</caption>
						<thead>
							<tr>
								<th scope="col">Volet</th>
								<th scope="col">Code</th>
								<th scope="col">Cluster</th>
								<th scope="col">Cadre logique</th>
							</tr>
						</thead>
						<tbody>
							{#each etat.volets as v (v.code)}
								<tr>
									<th scope="row">
										<a class="p-admin__lien-volet" href={lienVolet(v.code)}>
											<EtiquetteVolet secteur={v.secteur} organisation={v.organisation} libelleSecteur={libelleSecteur(v.secteur)} />
										</a>
									</th>
									<td><span class="u-code">{v.code}</span></td>
									<td>{etat.secteurs.find((s) => s.code === v.secteur)?.cluster_cbpf ?? '–'}</td>
									<td>
										<span class="p-admin__cadre">
											<Icone nom={v.cadre_verrouille ? 'cadenas' : 'deverrouiller'} taille="sm" />
											{v.cadre_verrouille ? 'Verrouillé' : 'Modifiable'}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Panneau>
		</div>

		<!-- Nouvelle ONG -->
		<div class="p-admin__ancre" id="nouvelle-ong">
			<Panneau titre="Nouvelle ONG ou nouveau volet" sousTitre="Pour une 6e ONG (ou plus) qui rejoint le consortium, ou un nouveau secteur pour une ONG déjà membre. Réservé au super-administrateur." id="panneau-nouvelle-ong">
				<form class="p-admin__invitation" onsubmit={ajouterOng} novalidate>
					<Champ id="ong-sigle" libelle="Sigle" requis bind:valeur={ongSigle} erreur={ongErreurs.sigle} placeholder="Ex. CARE" aide={ongExistante ? `ONG déjà membre : ${ongExistante.nom}. Un nouveau volet lui sera ajouté.` : 'Lettres majuscules ou chiffres, sans espace.'} />
					{#if !ongExistante}
						<Champ id="ong-nom" libelle="Nom complet" requis bind:valeur={ongNom} erreur={ongErreurs.nom} placeholder="Ex. CARE International" />
					{/if}
					<Champ id="ong-secteur" libelle="Secteur du volet" type="select" requis bind:valeur={ongSecteur} options={optionsSecteurs} aide={sigleNormalise ? `Code du volet : ${ongSecteur}-${sigleNormalise}` : undefined} />
					<div class="p-admin__invitation-actions">
						<Bouton variante="primaire" type="submit" icone="plus">{ongExistante ? 'Ajouter le volet' : 'Ajouter l’ONG'}</Bouton>
					</div>
				</form>
				<p class="p-admin__note">
					<Icone nom="info" taille="sm" />
					<span>Le volet est créé avec ses 10 rapports mensuels et un cadre logique vide : celui-ci s’importe depuis le plan d’action Excel de l’ONG, comme pour les cinq volets d’origine. Son logo s’ajoute dans static/logos/ ; d’ici là, son sigle s’affiche.</span>
				</p>
			</Panneau>
		</div>

		<!-- Périodes -->
		<div class="p-admin__ancre" id="periodes">
			<Panneau titre="Périodes de rapportage" sousTitre="Un rapport par mois et par volet, attendu le 5 du mois suivant (décision D4)." id="panneau-periodes" sansMarge>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (zone défilante : doit être atteignable au clavier, WCAG 2.1.1) -->
				<div class="p-admin__defilement" tabindex="0" role="region" aria-label="Tableau des périodes">
					<table class="p-admin__table">
						<caption class="u-visuellement-masque">Les {etat.projet.mois.length} mois du projet et leur échéance</caption>
						<thead>
							<tr>
								<th scope="col">Mois</th>
								<th scope="col">Période</th>
								<th scope="col">Échéance du rapport</th>
								<th scope="col">Situation</th>
							</tr>
						</thead>
						<tbody>
							{#each etat.projet.mois as m, i (m)}
								<tr class:is-courant={m === courant}>
									<th scope="row">Mois {i + 1}</th>
									<td>{majuscule(libelleMois(m))}</td>
									<td><time datetime={echeance(m).toISOString()}>{date(echeance(m).toISOString())}</time></td>
									<td>{situation(m)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Panneau>
		</div>

		<!-- Anomalies d'import -->
		<div class="p-admin__ancre" id="anomalies">
			<Panneau titre="Anomalies relevées à l’import des Excel" sousTitre="{liste.length} constats dans les 5 plans d’action. À faire confirmer par APSUD avant la mise en service." id="panneau-anomalies" sansMarge>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (zone défilante : doit être atteignable au clavier, WCAG 2.1.1) -->
				<div class="p-admin__defilement" tabindex="0" role="region" aria-label="Tableau des anomalies d’import">
					<table class="p-admin__table p-admin__anomalies">
						<caption class="u-visuellement-masque">Anomalies relevées à l’import, groupées par volet</caption>
						<thead>
							<tr>
								<th scope="col">Code</th>
								<th scope="col">Cellule</th>
								<th scope="col">Constat</th>
							</tr>
						</thead>
						{#each anomaliesParVolet as g (g.v.code)}
							<tbody>
								<tr class="p-admin__groupe">
									<th scope="rowgroup" colspan="3">
										{g.v.code} <span class="u-attenue">· {libelleSecteur(g.v.secteur)}, {g.v.organisation} · {g.lignes.length} constat{g.lignes.length > 1 ? 's' : ''}</span>
									</th>
								</tr>
								{#each g.lignes as a, i (i)}
									<tr>
										<th scope="row"><abbr title={LIBELLES_ANOMALIE[a.code] ?? a.code}>{a.code}</abbr></th>
										<td><span class="u-code">{a.cellule}</span></td>
										<td>{a.message}</td>
									</tr>
								{/each}
							</tbody>
						{/each}
					</table>
				</div>
				<p class="p-admin__note">
					<Icone nom="alerte" taille="sm" />
					<span>À faire confirmer par APSUD avant la mise en service : les corrections automatiques (séparateur de milliers, dates ramenées en 2026) restent des propositions tant qu’elles ne sont pas validées par écrit.</span>
				</p>
			</Panneau>
		</div>

		<!-- Démonstration -->
		{#if !reel}
		<div class="p-admin__ancre" id="demonstration">
			<Panneau titre="Démonstration" id="panneau-demonstration">
				<div class="p-admin__demo">
					<p>
						Cette maquette garde ses données dans ce navigateur. La réinitialisation remet les données de départ (valeurs, tâches, dépenses, statuts, journal) et l’horloge de démonstration au 12 janvier 2027.
					</p>
					<Bouton variante="secondaire" icone="synchro" onclick={() => (confirmerReinit = true)}>Réinitialiser les données de démonstration</Bouton>
				</div>
			</Panneau>
		</div>
		{/if}
	{/if}
</div>

<Dialogue ouvert={confirmerReinit} titre="Réinitialiser les données de démonstration ?" onfermer={() => (confirmerReinit = false)}>
	<p>Toutes les saisies faites pendant la démonstration seront remplacées par les données de départ, dans tous les onglets ouverts de ce navigateur.</p>
	<p class="p-admin__rappel">Votre session reste ouverte. Cette action ne concerne que la maquette : aucune donnée réelle n’est touchée.</p>
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={() => (confirmerReinit = false)}>Annuler</Bouton>
		<Bouton variante="primaire" icone="synchro" onclick={reinitialiser}>Réinitialiser</Bouton>
	{/snippet}
</Dialogue>
