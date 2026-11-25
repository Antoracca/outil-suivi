<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import ChampEmail from '#lib/composants/ui/ChampEmail.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import LogoApsud from '#lib/composants/structure/LogoApsud.svelte';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import { depot, type InvitationValide } from '#lib/donnees/depot.svelte.ts';
	import { serveurConfigure } from '#lib/donnees/reel/client.ts';
	import { DEMO_DISPONIBLE } from '#lib/donnees/mode.svelte.ts';
	import { lireComptes, memoriserCompte, oublierCompte, type CompteMemorise } from '#lib/donnees/reel/comptes-memorises.ts';
	import { LIBELLES_ROLE, MESSAGE_EMAIL_INVALIDE, estEmailValide } from '#lib/donnees/regles.ts';
	import type { Role } from '#lib/donnees/types.ts';
	import './ConnexionReelle.css';

	/**
	 * Accès réel (serveur Supabase) :
	 *   - connexion par e-mail et mot de passe ;
	 *   - CONNEXION RAPIDE : on touche le logo de son organisation ; si un compte de cette
	 *     organisation s'est déjà connecté sur cet appareil, seul le mot de passe est demandé
	 *     (comptes-memorises.ts : adresse, nom, organisation, jamais le mot de passe) ;
	 *   - inscription avec le code d'invitation d'APSUD (aucune inscription libre).
	 * Le mot de passe est effacé du champ après chaque essai.
	 */

	/** Les 5 organisations du projet FH, puis celles des comptes déjà vus sur cet appareil. */
	const FONDATRICES = [
		{ sigle: 'APSUD', precision: 'Coordination et administration' },
		{ sigle: 'ARS', precision: 'African Relief Service' },
		{ sigle: 'AFPE', precision: 'Protection de l’enfance' },
		{ sigle: 'GADY', precision: 'Sécurité alimentaire' },
		{ sigle: 'IDC', precision: 'Eau, hygiène et assainissement' }
	];

	let { ongletInitial = 'connexion' }: { ongletInitial?: 'connexion' | 'inscription' } = $props();
	// svelte-ignore state_referenced_locally (valeur de départ seulement : l'onglet se change ensuite à la main)
	let onglet = $state<'connexion' | 'inscription'>(ongletInitial);
	let email = $state('');
	let motDePasse = $state('');
	let confirmation = $state('');
	let voirMotDePasse = $state(false);
	let memoriser = $state(true);
	let code = $state('');
	let nom = $state('');
	let invitation = $state<InvitationValide | null>(null);
	let envoi = $state(false);
	let message = $state<{ variante: 'info' | 'erreur' | 'succes'; titre: string; texte: string } | null>(null);
	let erreurs = $state<{ email?: string; motDePasse?: string; confirmation?: string; code?: string; nom?: string }>({});

	let comptes = $state<CompteMemorise[]>(lireComptes());
	let orgChoisie = $state<string | null>(null);
	let compteRapide = $state<CompteMemorise | null>(null);
	const organisations = $derived([
		...FONDATRICES,
		...[...new Set(comptes.map((c) => c.organisation))].filter((s) => !FONDATRICES.some((f) => f.sigle === s)).map((sigle) => ({ sigle, precision: '' }))
	]);
	const comptesDeOrg = $derived(orgChoisie ? comptes.filter((c) => c.organisation === orgChoisie) : []);

	// Session réelle déjà ouverte sur cet appareil : directement vers le tableau de bord.
	$effect(() => {
		if (depot.pret && depot.source === 'reel' && depot.utilisateur) goto('/', { replace: true });
	});

	function changer(o: 'connexion' | 'inscription') {
		onglet = o;
		message = null;
		erreurs = {};
		invitation = null;
	}

	function erreurDe(e: unknown) {
		return e instanceof Error ? e.message : String(e);
	}

	async function focaliser(id: string) {
		await tick();
		document.getElementById(id)?.focus();
	}

	/** Connexion rapide : un compte connu sur cet appareil → mot de passe seul ; sinon formulaire complet. */
	function choisirOrganisation(sigle: string) {
		message = null;
		erreurs = {};
		motDePasse = '';
		orgChoisie = sigle;
		const connus = comptes.filter((c) => c.organisation === sigle);
		if (connus.length === 1) return choisirCompte(connus[0]);
		compteRapide = null;
		if (connus.length === 0) {
			email = '';
			focaliser('reel-email');
		}
	}

	function choisirCompte(c: CompteMemorise) {
		compteRapide = c;
		email = c.email;
		focaliser('reel-mdp-rapide');
	}

	function autreCompte() {
		compteRapide = null;
		orgChoisie = null;
		email = '';
		motDePasse = '';
		focaliser('reel-email');
	}

	function oublier(c: CompteMemorise) {
		comptes = oublierCompte(c.email);
		message = { variante: 'info', titre: 'Compte oublié', texte: `${c.email} n’est plus proposé en connexion rapide sur cet appareil.` };
		autreCompte();
	}

	async function seConnecter(e: SubmitEvent) {
		e.preventDefault();
		erreurs = {};
		message = null;
		const adresse = (compteRapide?.email ?? email).trim().toLowerCase();
		if (!estEmailValide(adresse)) erreurs.email = MESSAGE_EMAIL_INVALIDE;
		if (!motDePasse) erreurs.motDePasse = 'Saisissez votre mot de passe.';
		const mdp = motDePasse;
		motDePasse = '';
		if (Object.keys(erreurs).length) return;
		envoi = true;
		try {
			await depot.connexionReelle(adresse, mdp);
			const u = depot.utilisateur;
			if (u && (memoriser || compteRapide)) comptes = memoriserCompte({ email: adresse, nom: u.nom, organisation: u.organisation, role: u.role });
			goto('/');
		} catch (err) {
			message = { variante: 'erreur', titre: 'Connexion impossible', texte: erreurDe(err) };
			focaliser(compteRapide ? 'reel-mdp-rapide' : 'reel-mdp');
		} finally {
			envoi = false;
		}
	}

	async function verifierCode(e: SubmitEvent) {
		e.preventDefault();
		erreurs = {};
		message = null;
		if (!estEmailValide(email)) erreurs.email = MESSAGE_EMAIL_INVALIDE;
		if (code.replace(/[\s-]/g, '').length < 8) erreurs.code = 'Saisissez le code complet reçu d’APSUD (8 caractères, ex. 7K4P-92QD).';
		if (Object.keys(erreurs).length) return;
		envoi = true;
		try {
			invitation = await depot.verifierInvitation(code, email);
			if (!invitation) {
				message = { variante: 'erreur', titre: 'Code non reconnu', texte: 'Ce code est invalide, expiré, déjà utilisé ou destiné à une autre adresse. Demandez une nouvelle invitation à la coordination APSUD.' };
			} else nom = invitation.nom;
		} catch (err) {
			message = { variante: 'erreur', titre: 'Vérification impossible', texte: erreurDe(err) };
		} finally {
			envoi = false;
		}
	}

	async function creerCompte(e: SubmitEvent) {
		e.preventDefault();
		erreurs = {};
		message = null;
		if (nom.trim().length < 2) erreurs.nom = 'Indiquez votre nom tel qu’il apparaîtra dans le journal.';
		if (motDePasse.length < 10 || !/[A-Za-z]/.test(motDePasse) || !/\d/.test(motDePasse)) erreurs.motDePasse = 'Au moins 10 caractères, avec des lettres et des chiffres.';
		else if (confirmation !== motDePasse) erreurs.confirmation = 'Les deux mots de passe ne correspondent pas.';
		const mdp = motDePasse;
		if (Object.keys(erreurs).length) {
			motDePasse = '';
			confirmation = '';
			return;
		}
		envoi = true;
		try {
			const resultat = await depot.inscriptionReelle(email, mdp, code, nom);
			if (resultat === 'connecte') {
				const u = depot.utilisateur;
				if (u) comptes = memoriserCompte({ email: email.trim().toLowerCase(), nom: u.nom, organisation: u.organisation, role: u.role });
				goto('/');
			} else message = { variante: 'succes', titre: 'Compte créé', texte: 'Confirmez votre adresse avec le lien reçu par e-mail, puis connectez-vous.' };
		} catch (err) {
			message = { variante: 'erreur', titre: 'Création du compte impossible', texte: erreurDe(err) };
		} finally {
			motDePasse = '';
			confirmation = '';
			envoi = false;
		}
	}
</script>

<div class="p-reel">
	<header class="p-reel__entete">
		<LogoApsud taille="lg" />
		<p class="p-reel__accroche">Espace des membres du consortium</p>
	</header>

	{#if !serveurConfigure}
		<Alerte variante="info" titre="Serveur réel non configuré">
			Ce déploiement n’est pas encore relié au serveur du consortium.{#if DEMO_DISPONIBLE} Activez le mode démonstration pour parcourir l’outil.{:else} Contactez l’équipe technique d’APSUD.{/if}
		</Alerte>
	{:else if !depot.pret}
		<p class="p-reel__texte" role="status">Ouverture de votre session…</p>
	{:else}
		<div class="p-reel__onglets" role="group" aria-label="Choisir entre connexion et inscription">
			<button type="button" id="onglet-connexion" aria-pressed={onglet === 'connexion'} class:is-actif={onglet === 'connexion'} onclick={() => changer('connexion')}>
				Connexion
			</button>
			<button type="button" id="onglet-inscription" aria-pressed={onglet === 'inscription'} class:is-actif={onglet === 'inscription'} onclick={() => changer('inscription')}>
				Inscription
			</button>
		</div>

		{#if onglet === 'connexion'}
			{#if compteRapide}
				<form class="p-reel__formulaire" aria-labelledby="titre-rapide" onsubmit={seConnecter} novalidate>
					<h2 class="p-reel__titre" id="titre-rapide">Entrez votre mot de passe</h2>
					<div class="p-reel__identite">
						<LogoOrganisation sigle={compteRapide.organisation} taille="md" />
						<span class="p-reel__identite-texte">
							<strong>{compteRapide.nom}</strong>
							<span>{compteRapide.email}</span>
						</span>
					</div>
					<!-- Identifiant caché pour les gestionnaires de mots de passe (WCAG 3.3.8 : authentification accessible). -->
					<input class="u-visuellement-masque" type="email" name="username" autocomplete="username" value={compteRapide.email} readonly tabindex="-1" aria-hidden="true" />
					<div class="p-reel__mdp">
						<Champ id="reel-mdp-rapide" libelle="Mot de passe" type={voirMotDePasse ? 'text' : 'password'} autocomplete="current-password" requis bind:valeur={motDePasse} erreur={erreurs.motDePasse} />
						<button type="button" class="p-reel__voir" aria-pressed={voirMotDePasse} onclick={() => (voirMotDePasse = !voirMotDePasse)}>
							<Icone nom="oeil" taille="sm" /> {voirMotDePasse ? 'Masquer' : 'Afficher'}
						</button>
					</div>
					<Bouton variante="primaire" type="submit" disabled={envoi}>{envoi ? 'Connexion…' : 'Se connecter'}</Bouton>
					<div class="p-reel__liens">
						<button type="button" class="p-reel__retour" onclick={autreCompte}>Autre compte</button>
						<button type="button" class="p-reel__retour" onclick={() => oublier(compteRapide!)}>Oublier sur cet appareil</button>
					</div>
				</form>
			{:else}
				<form class="p-reel__formulaire" id="panneau-connexion" aria-labelledby="titre-connexion" onsubmit={seConnecter} novalidate>
					<h2 class="p-reel__titre" id="titre-connexion">Se connecter</h2>
					{#if orgChoisie && comptesDeOrg.length === 0}
						<p class="p-reel__note" role="status">
							<LogoOrganisation sigle={orgChoisie} taille="sm" />
							<span>Première connexion pour {orgChoisie} sur cet appareil : saisissez votre adresse et votre mot de passe. La prochaine fois, le mot de passe suffira.</span>
						</p>
					{/if}
					<ChampEmail id="reel-email" libelle="Adresse e-mail" autocomplete="username" requis bind:valeur={email} erreur={erreurs.email} />
					<div class="p-reel__mdp">
						<Champ id="reel-mdp" libelle="Mot de passe" type={voirMotDePasse ? 'text' : 'password'} autocomplete="current-password" requis bind:valeur={motDePasse} erreur={erreurs.motDePasse} />
						<button type="button" class="p-reel__voir" aria-pressed={voirMotDePasse} onclick={() => (voirMotDePasse = !voirMotDePasse)}>
							<Icone nom="oeil" taille="sm" /> {voirMotDePasse ? 'Masquer' : 'Afficher'}
						</button>
					</div>
					<label class="p-reel__case">
						<input type="checkbox" bind:checked={memoriser} />
						<span>Retenir mon adresse sur cet appareil (connexion rapide)</span>
					</label>
					<Bouton variante="primaire" type="submit" disabled={envoi}>{envoi ? 'Connexion…' : 'Se connecter'}</Bouton>
					<p class="p-reel__aide">Mot de passe oublié : demandez une nouvelle invitation à la coordination APSUD.</p>
				</form>
			{/if}

			<section class="p-reel__rapide" aria-labelledby="titre-acces-rapide">
				<h3 class="p-reel__rapide-titre" id="titre-acces-rapide">Connexion rapide</h3>
				<p class="p-reel__aide">Touchez votre organisation.</p>
				<ul class="p-reel__organisations" role="list">
					{#each organisations as o (o.sigle)}
						<li>
							<button
								type="button"
								class="p-reel__organisation"
								class:is-actif={orgChoisie === o.sigle}
								aria-pressed={orgChoisie === o.sigle}
								aria-label={o.precision ? `${o.sigle}, ${o.precision}` : o.sigle}
								title={o.precision || o.sigle}
								onclick={() => choisirOrganisation(o.sigle)}
							>
								<LogoOrganisation sigle={o.sigle} taille="md" />
								<span class="p-reel__organisation-sigle" aria-hidden="true">{o.sigle}</span>
								{#if comptes.some((c) => c.organisation === o.sigle)}<span class="p-reel__organisation-connu" aria-hidden="true"></span>{/if}
							</button>
						</li>
					{/each}
				</ul>
				{#if orgChoisie && comptesDeOrg.length > 1 && !compteRapide}
					<ul class="p-reel__comptes" role="list" aria-label="Comptes de {orgChoisie} sur cet appareil">
						{#each comptesDeOrg as c (c.email)}
							<li>
								<button type="button" class="p-reel__compte" onclick={() => choisirCompte(c)}>
									<span class="p-reel__identite-texte">
										<strong>{c.nom}</strong>
										<span>{LIBELLES_ROLE[c.role as Role] ?? c.role} · {c.email}</span>
									</span>
									<Icone nom="chevron-droite" taille="sm" />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{:else if !invitation}
			<form class="p-reel__formulaire" id="panneau-inscription" aria-labelledby="titre-inscription" onsubmit={verifierCode} novalidate>
				<h2 class="p-reel__titre" id="titre-inscription">Créer mon compte</h2>
				<p class="p-reel__texte">Les comptes sont créés uniquement sur invitation d’APSUD. Saisissez l’adresse invitée et le code reçu.</p>
				<ChampEmail id="reel-email-invite" libelle="Adresse e-mail invitée" autocomplete="username" requis bind:valeur={email} erreur={erreurs.email} />
				<Champ id="reel-code" libelle="Code d’invitation" autocomplete="one-time-code" requis bind:valeur={code} erreur={erreurs.code} placeholder="Ex. 7K4P-92QD" />
				<Bouton variante="primaire" type="submit" disabled={envoi}>{envoi ? 'Vérification…' : 'Vérifier le code'}</Bouton>
				<p class="p-reel__aide">Pas de code ? Demandez à votre point focal APSUD de vous inviter.</p>
			</form>
		{:else}
			<form class="p-reel__formulaire" aria-labelledby="titre-compte" onsubmit={creerCompte} novalidate>
				<h2 class="p-reel__titre" id="titre-compte">Votre compte</h2>
				<p class="p-reel__texte">
					Invitation valide : <strong>{invitation.organisation}</strong>, {LIBELLES_ROLE[invitation.role as Role] ?? invitation.role}.
				</p>
				<Champ id="reel-nom" libelle="Nom affiché" autocomplete="name" requis bind:valeur={nom} erreur={erreurs.nom} aide="Visible des autres membres dans le fil d’activité." />
				<Champ id="reel-nouveau-mdp" libelle="Mot de passe" type="password" autocomplete="new-password" requis bind:valeur={motDePasse} erreur={erreurs.motDePasse} aide="Au moins 10 caractères, avec des lettres et des chiffres." />
				<Champ id="reel-confirmation" libelle="Confirmer le mot de passe" type="password" autocomplete="new-password" requis bind:valeur={confirmation} erreur={erreurs.confirmation} />
				<Bouton variante="primaire" type="submit" disabled={envoi}>{envoi ? 'Création…' : 'Créer mon compte'}</Bouton>
				<button type="button" class="p-reel__retour" onclick={() => (invitation = null)}>Changer d’adresse ou de code</button>
			</form>
		{/if}
	{/if}

	{#if message}<Alerte variante={message.variante} titre={message.titre}>{message.texte}</Alerte>{/if}
</div>
