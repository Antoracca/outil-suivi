<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { echeance, echeanceFH, moisCourant, rapportDuCalendrier } from '#lib/donnees/calculs.ts';
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
		transitionsPossibles,
		estEmailValide,
		normaliserEmail,
		MESSAGE_EMAIL_INVALIDE
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
	import ChampEmail from '#lib/composants/ui/ChampEmail.svelte';
	import ChampSecteur from '#lib/composants/ui/ChampSecteur.svelte';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import { ROLES_CONSORTIUM, codeSecteurPropose, libelleRoleConsortium, type RoleConsortium } from '#lib/donnees/referentiels/secteurs.ts';
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
	let invErreurServeur = $state<string | null>(null);
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
		invErreurServeur = null;
		codeCree = null;
		// Toute messagerie est acceptée (Gmail, Yahoo, adresse d'organisation…), majuscules comprises.
		if (!estEmailValide(invEmail)) invErreurs.email = MESSAGE_EMAIL_INVALIDE;
		if (invNom.trim().length < 2) invErreurs.nom = 'Indiquez le nom de la personne ou l’intitulé du poste.';
		if (Object.keys(invErreurs).length) return;
		invEnvoi = true;
		const adresse = normaliserEmail(invEmail);
		try {
			const code = await depot.creerInvitation({ email: adresse, nom: invNom, fonction: invFonction, organisation: invOrganisation, role: invRole });
			codeCree = { code, email: adresse, nom: invNom.trim() };
			invEmail = '';
			invNom = '';
			invFonction = '';
		} catch (err) {
			// Affiché dans le panneau, à côté du formulaire (et non en haut de la page, hors de vue).
			invErreurServeur = err instanceof Error ? err.message : String(err);
		} finally {
			invEnvoi = false;
		}
	}

	/* ---------- Nouvelle ONG ou nouveau volet (super-administrateur, démonstration et réel) ---------- */
	let ongSigle = $state('');
	let ongNom = $state('');
	let ongSecteur = $state<string>('');
	let ongAutre = $state('');
	let ongRole = $state<RoleConsortium>('partenaire');
	let ongLogo = $state<File | null>(null);
	let ongApercu = $state<string | null>(null);
	let ongEnvoi = $state(false);
	let ongErreurs = $state<{ sigle?: string; nom?: string; secteur?: string; logo?: string }>({});
	let ongErreurServeur = $state<string | null>(null);
	let ongMessage = $state<string | null>(null);
	let champLogo: HTMLInputElement | undefined = $state();
	const sigleNormalise = $derived(ongSigle.trim().toUpperCase());
	const ongExistante = $derived(etat.organisations.find((o) => o.sigle === sigleNormalise) ?? null);
	/** Indicateur en temps réel du sigle : ce qui sera enregistré, et ce qui ne va pas. */
	const etatSigle = $derived.by(() => {
		if (!ongSigle.trim()) return null;
		if (/[\s-]/.test(ongSigle.trim())) return { ok: false, texte: 'Pas d’espace ni de tiret dans un sigle.' };
		if (/[^A-Za-z0-9]/.test(ongSigle.trim())) return { ok: false, texte: 'Lettres et chiffres seulement (pas d’accent ni de ponctuation).' };
		if (sigleNormalise.length < 2) return { ok: false, texte: 'Au moins 2 caractères.' };
		if (sigleNormalise.length > 12) return { ok: false, texte: '12 caractères au plus.' };
		if (ongExistante) return { ok: false, texte: `${sigleNormalise} est déjà membre (${ongExistante.nom}) : modifiez-la dans « Organisations du consortium ».` };
		return { ok: true, texte: `Sera enregistré : ${sigleNormalise}` };
	});
	const codeVoletPrevu = $derived(sigleNormalise && (ongSecteur || ongAutre) ? `${ongSecteur || codeSecteurPropose(ongAutre, etat.secteurs.map((s) => s.code))}-${sigleNormalise}` : null);

	function choisirLogo(champ: HTMLInputElement, apercu: (url: string | null) => void, garder: (f: File | null) => void) {
		const f = champ.files?.[0] ?? null;
		garder(f);
		apercu(f ? URL.createObjectURL(f) : null);
	}

	async function ajouterOng(e: SubmitEvent) {
		e.preventDefault();
		ongErreurs = {};
		ongErreurServeur = null;
		ongMessage = null;
		if (!etatSigle?.ok) ongErreurs.sigle = etatSigle?.texte ?? 'Indiquez le sigle de l’ONG (ex. MSF, CARE).';
		if (ongNom.trim().length < 3) ongErreurs.nom = 'Indiquez le nom complet de la nouvelle ONG.';
		if (!ongSecteur && ongAutre.trim().length < 3) ongErreurs.secteur = 'Choisissez un secteur dans la liste, ou tapez-en un nouveau puis « Autre ».';
		if (ongLogo && !['image/png', 'image/jpeg', 'image/webp'].includes(ongLogo.type)) ongErreurs.logo = 'Logo : image PNG, JPEG ou WebP.';
		if (Object.keys(ongErreurs).length) return;
		ongEnvoi = true;
		try {
			const secteur = ongSecteur || depot.ajouterSecteur(ongAutre);
			const code = depot.ajouterVolet(sigleNormalise, ongNom, secteur, ongRole);
			if (ongLogo) {
				const url = await depot.televerserLogo(sigleNormalise, ongLogo);
				depot.modifierOrganisation(sigleNormalise, { nom: ongNom, role_consortium: ongRole, logo_url: url });
			}
			ongMessage =
				depot.source === 'demo'
					? `${sigleNormalise} a rejoint le consortium (volet ${code}). Son compte « Saisie ${sigleNormalise} » est disponible sur la page de connexion de démonstration.`
					: `${sigleNormalise} a rejoint le consortium (volet ${code}). Elle apparaît dans « Organisations du consortium » et sur le tableau de bord. Invitez maintenant son point focal (section Inviter).`;
			ongSigle = '';
			ongNom = '';
			ongSecteur = '';
			ongAutre = '';
			ongRole = 'partenaire';
			ongLogo = null;
			ongApercu = null;
			if (champLogo) champLogo.value = '';
		} catch (err) {
			ongErreurServeur = err instanceof Error ? err.message : String(err);
		} finally {
			ongEnvoi = false;
		}
	}

	/* ---------- Modifier une organisation : nom, rôle, logo (super-administrateur) ---------- */
	let orgEditee = $state<Sigle | null>(null);
	let orgNom = $state('');
	let orgRole = $state<RoleConsortium>('partenaire');
	let orgLogo = $state<File | null>(null);
	let orgApercu = $state<string | null>(null);
	let orgErreur = $state<string | null>(null);
	let orgEnvoi = $state(false);
	function editerOrganisation(sigle: Sigle) {
		const o = etat.organisations.find((x) => x.sigle === sigle)!;
		orgEditee = sigle;
		orgNom = o.nom;
		orgRole = o.role_consortium;
		orgLogo = null;
		orgApercu = null;
		orgErreur = null;
	}
	async function enregistrerOrganisation() {
		if (!orgEditee) return;
		orgErreur = null;
		orgEnvoi = true;
		try {
			const o = etat.organisations.find((x) => x.sigle === orgEditee)!;
			const logo = orgLogo ? await depot.televerserLogo(orgEditee, orgLogo) : (o.logo_url ?? null);
			depot.modifierOrganisation(orgEditee, { nom: orgNom, role_consortium: orgRole, logo_url: logo });
			message = `${orgEditee} mise à jour${orgLogo ? ' : nouveau logo visible partout' : ''}.`;
			orgEditee = null;
		} catch (err) {
			orgErreur = err instanceof Error ? err.message : String(err);
		} finally {
			orgEnvoi = false;
		}
	}

	const voletsDe = (sigle: Sigle) => etat.volets.filter((v) => v.organisation === sigle).map((v) => v.code);
	const comptesDe = (sigle: Sigle) => etat.utilisateurs.filter((x) => x.organisation === sigle).length;
	const situation = (m: string) => {
		if (m === courant) return 'En cours';
		return echeance(etat, m).getTime() < maintenant.getTime() ? 'Échéance passée' : m < courant ? 'Rapport attendu' : 'À venir';
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
					{#if invErreurServeur}
						<Alerte variante="erreur" titre="Invitation non créée" onfermer={() => (invErreurServeur = null)}>{invErreurServeur}</Alerte>
					{/if}
					<form class="p-admin__invitation" onsubmit={inviter} novalidate>
						<ChampEmail id="inv-email" libelle="Adresse e-mail" requis bind:valeur={invEmail} erreur={invErreurs.email} autocomplete="off" aide="Toute messagerie : Gmail, Yahoo, adresse de l’organisation…" />
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
								{#if peutAjouterOrganisation(u)}<th scope="col"><span class="u-visuellement-masque">Actions</span></th>{/if}
							</tr>
						</thead>
						<tbody>
							{#each etat.organisations as o (o.sigle)}
								<tr>
									<th scope="row"><span class="p-admin__org"><LogoOrganisation sigle={o.sigle} taille="sm" /> {o.sigle}</span></th>
									<td>{o.nom}{#if o.ville}<span class="p-admin__detail">{o.ville}</span>{/if}</td>
									<td>{libelleRoleConsortium(o.role_consortium)}</td>
									<td>{voletsDe(o.sigle).join(', ') || '–'}</td>
									<td class="u-nombre">{comptesDe(o.sigle)}</td>
									{#if peutAjouterOrganisation(u)}
										<td><Bouton variante="texte" taille="sm" icone="modifier" onclick={() => editerOrganisation(o.sigle)}>Modifier<span class="u-visuellement-masque"> {o.sigle}</span></Bouton></td>
									{/if}
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
			<Panneau titre="Nouvelle ONG" sousTitre="Une organisation qui rejoint le consortium : elle est créée avec son volet et ses 10 rapports mensuels, et apparaît aussitôt partout (organisations, volets, tableau de bord). Réservé au super-administrateur." id="panneau-nouvelle-ong">
				{#if ongErreurServeur}
					<Alerte variante="erreur" titre="ONG non créée" onfermer={() => (ongErreurServeur = null)}>{ongErreurServeur}</Alerte>
				{/if}
				{#if ongMessage}
					<Alerte variante="succes" onfermer={() => (ongMessage = null)}>{ongMessage}</Alerte>
				{/if}
				<form class="p-admin__ong" onsubmit={ajouterOng} novalidate>
					<div class="p-admin__ong-sigle">
						<Champ id="ong-sigle" libelle="Sigle" requis bind:valeur={ongSigle} erreur={ongErreurs.sigle} placeholder="Ex. CARE" />
						{#if etatSigle && !ongErreurs.sigle}
							<p class="p-admin__indicateur" class:is-ok={etatSigle.ok} aria-live="polite"><Icone nom={etatSigle.ok ? 'valider' : 'alerte'} taille="sm" /> {etatSigle.texte}</p>
						{/if}
					</div>
					<Champ id="ong-nom" libelle="Nom complet" requis bind:valeur={ongNom} erreur={ongErreurs.nom} placeholder="Ex. CARE International" />
					<Champ
						id="ong-role"
						libelle="Rôle dans le consortium"
						type="select"
						requis
						bind:valeur={ongRole}
						options={ROLES_CONSORTIUM.filter((r) => r.valeur !== 'chef_de_file').map((r) => ({ valeur: r.valeur, libelle: r.libelle }))}
						aide={ROLES_CONSORTIUM.find((r) => r.valeur === ongRole)?.description}
					/>
					<ChampSecteur id="ong-secteur" libelle="Secteur du volet" secteurs={etat.secteurs} bind:code={ongSecteur} bind:autre={ongAutre} erreur={ongErreurs.secteur} aide={codeVoletPrevu ? `Code du volet : ${codeVoletPrevu}` : `${etat.secteurs.length} secteurs : cherchez par nom ou par mot-clé.`} />
					<div class="p-admin__logo-champ">
						<label for="ong-logo">Logo <span class="c-champ__facultatif">(facultatif)</span></label>
						<div class="p-admin__logo-ligne">
							<span class="p-admin__logo-apercu" aria-hidden="true">
								{#if ongApercu}<img src={ongApercu} alt="" />{:else}<span>{sigleNormalise.slice(0, 5) || 'Logo'}</span>{/if}
							</span>
							<input id="ong-logo" bind:this={champLogo} type="file" accept="image/png,image/jpeg,image/webp" onchange={(e) => choisirLogo(e.currentTarget, (x) => (ongApercu = x), (x) => (ongLogo = x))} aria-describedby="ong-logo-aide" />
						</div>
						<p class="c-champ__aide" id="ong-logo-aide">PNG, JPEG ou WebP, 1 Mo au plus. Sans logo, le sigle s’affiche.</p>
						{#if ongErreurs.logo}<p class="c-champ__erreur">{ongErreurs.logo}</p>{/if}
					</div>
					<div class="p-admin__invitation-actions">
						<Bouton variante="primaire" type="submit" icone="plus" disabled={ongEnvoi}>{ongEnvoi ? 'Création…' : 'Ajouter l’ONG'}</Bouton>
					</div>
				</form>
				<p class="p-admin__note">
					<Icone nom="info" taille="sm" />
					<span>Le cadre logique du nouveau volet est vide : il s’importe depuis le plan d’action Excel de l’ONG, comme pour les cinq volets d’origine. Le nom, le rôle et le logo se modifient ensuite dans « Organisations du consortium ».</span>
				</p>
			</Panneau>
		</div>

		<!-- Périodes -->
		<div class="p-admin__ancre" id="periodes">
			<Panneau titre="Périodes de rapportage" sousTitre="Un rapport par mois et par volet, selon le calendrier officiel d’APSUD : le 2 du mois suivant (le 9 pour les trimestriels 2 et 3), transmis au FH le 7 (le 14 pour les trimestriels)." id="panneau-periodes" sansMarge>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (zone défilante : doit être atteignable au clavier, WCAG 2.1.1) -->
				<div class="p-admin__defilement" tabindex="0" role="region" aria-label="Tableau des périodes">
					<table class="p-admin__table">
						<caption class="u-visuellement-masque">Les {etat.projet.mois.length} mois du projet, le rapport attendu et ses échéances (calendrier officiel APSUD)</caption>
						<thead>
							<tr>
								<th scope="col">Mois</th>
								<th scope="col">Période</th>
								<th scope="col">Rapport attendu</th>
								<th scope="col">Partenaire → APSUD</th>
								<th scope="col">APSUD → FH</th>
								<th scope="col">Situation</th>
							</tr>
						</thead>
						<tbody>
							{#each etat.projet.mois as m, i (m)}
								{@const fh = echeanceFH(etat, m)}
								<tr class:is-courant={m === courant}>
									<th scope="row">Mois {i + 1}</th>
									<td>{majuscule(libelleMois(m))}</td>
									<td>{rapportDuCalendrier(etat, m)?.libelle ?? '–'}</td>
									<td><time datetime={echeance(etat, m).toISOString()}>{date(echeance(etat, m).toISOString())}</time></td>
									<td>{#if fh}<time datetime={fh.toISOString()}>{date(fh.toISOString())}</time>{:else}–{/if}</td>
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

<Dialogue ouvert={!!orgEditee} titre="Modifier {orgEditee ?? ''}" onfermer={() => (orgEditee = null)}>
	{#if orgErreur}<Alerte variante="erreur">{orgErreur}</Alerte>{/if}
	<div class="p-admin__org-form">
		<Champ id="org-nom" libelle="Nom complet" requis bind:valeur={orgNom} />
		<Champ id="org-role" libelle="Rôle dans le consortium" type="select" requis bind:valeur={orgRole} options={ROLES_CONSORTIUM.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))} aide={ROLES_CONSORTIUM.find((r) => r.valeur === orgRole)?.description} />
		<div class="p-admin__logo-champ">
			<label for="org-logo">Logo</label>
			<div class="p-admin__logo-ligne">
				<span class="p-admin__logo-apercu" aria-hidden="true">
					{#if orgApercu}<img src={orgApercu} alt="" />{:else if orgEditee}<LogoOrganisation sigle={orgEditee} taille="lg" />{/if}
				</span>
				<input id="org-logo" type="file" accept="image/png,image/jpeg,image/webp" onchange={(e) => choisirLogo(e.currentTarget, (x) => (orgApercu = x), (x) => (orgLogo = x))} aria-describedby="org-logo-aide" />
			</div>
			<p class="c-champ__aide" id="org-logo-aide">PNG, JPEG ou WebP, 1 Mo au plus. Le nouveau logo s’affiche aussitôt partout, chez tous les membres.</p>
		</div>
	</div>
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={() => (orgEditee = null)}>Annuler</Bouton>
		<Bouton variante="primaire" icone="valider" disabled={orgEnvoi} onclick={enregistrerOrganisation}>{orgEnvoi ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
	{/snippet}
</Dialogue>
