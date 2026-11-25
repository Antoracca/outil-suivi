/**
 * Dépôt de données : la seule porte des écrans vers les données, avec DEUX sources.
 *
 * 1. Démonstration (mode.demo) — tout est simulé dans le navigateur :
 *   - stockage : localStorage (partagé entre les onglets du même navigateur) ;
 *   - temps réel : BroadcastChannel (ouvrez deux onglets avec deux comptes différents) ;
 *   - session : sessionStorage (chaque onglet peut être connecté avec un compte différent).
 *
 * 2. Réel — le serveur Supabase (supabase/migrations) :
 *   - connexion par e-mail et mot de passe, comptes sur invitation ;
 *   - chaque action est d'abord appliquée à l'écran (réponse immédiate), puis envoyée à
 *     la fonction SQL correspondante, qui refait TOUS les contrôles ; si le serveur
 *     refuse, l'état est rechargé et le motif affiché ;
 *   - file d'attente sur l'appareil quand le réseau tombe, rejouée sans doublon ;
 *   - temps réel : les changements des autres comptes arrivent par Supabase Realtime.
 *
 * Dans les deux cas, les règles de regles.ts s'appliquent avant toute écriture.
 * Les écrans n'appellent que les méthodes publiques et ne savent pas quelle source sert.
 */
import { browser } from '$app/env';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { construireEtatDemo, AUJOURDHUI_DEMO, VERSION_SCHEMA } from './demo/graine';
import { mode } from './mode.svelte';
import { estErreurReseau, serveur, serveurConfigure, traduireErreurAuth } from './reel/client';
import { COLLECTIONS, chargerEtatReel, etatVide, vers } from './reel/correspondance';
import { cumul, rapport as trouverRapport, valeurCourante } from './calculs';
import {
	ErreurRegle,
	MESSAGE_PHOTO_REFUSEE,
	destinataires,
	estPhoto,
	peutArchiver,
	peutEcrireVolet,
	peutAjouterOrganisation,
	peutModifierStructure,
	peutSaisirMois,
	peutSupprimer,
	peutValider,
	verifierTransition
} from './regles';
import type {
	Activite,
	CodeSecteur,
	CodeVolet,
	Depense,
	Desagregation,
	EtatDepot,
	Evenement,
	Fiche5W,
	Indicateur,
	Justificatif,
	Ligne5W,
	Mois,
	Planification,
	SemaineTache,
	StatutRapport,
	Tache,
	TypeEvenement,
	Utilisateur
} from './types';

const CLE_ETAT = 'apsud-suivi:etat';
const CLE_DECALAGE = 'apsud-suivi:decalage-horloge';
const CLE_SESSION = 'apsud-suivi:utilisateur';
const CANAL = 'apsud-suivi';

export type Archivable = 'activite' | 'tache' | 'indicateur' | 'depense' | 'justificatif' | 'ligne_5w';

/** Champs saisis pour une ligne 5W (le reste est déduit : volet, auteur, date). */
export type ChampsLigne5W = Omit<Ligne5W, 'id' | 'volet' | 'activite_id' | 'mois' | 'auteur' | 'date' | 'archive_le'>;

type MessageCanal = { type: 'maj'; evenement: Evenement } | { type: 'reinitialisation' };

export interface MajEnDirect {
	evenement: Evenement;
	recu_le: number;
}

/** Un appel à une fonction SQL du serveur, gardé sur l'appareil tant qu'il n'est pas confirmé. */
interface AppelDistant {
	id: string;
	fn: string;
	args: Record<string, unknown>;
	libelle: string;
}

/** Ce qu'une invitation valide annonce avant la création du compte. */
export interface InvitationValide {
	nom: string;
	fonction: string;
	organisation: string;
	role: string;
}

const CLE_FILE_REEL = 'apsud-suivi:file-reel';

function uid(prefixe: string): string {
	return `${prefixe}:${crypto.randomUUID()}`;
}

class Depot {
	etat = $state<EtatDepot>(construireEtatDemo());
	utilisateurId = $state<string | null>(null);
	/** Source des données : démonstration (simulée) ou serveur réel. */
	source = $state<'demo' | 'reel'>('demo');
	/** Mises à jour reçues d'autres onglets (pour la trace « modifiée à l'instant »). */
	enDirect = $state<MajEnDirect[]>([]);
	/** Dernier message à annoncer aux lecteurs d'écran (role="status"). */
	annonce = $state('');
	/** Hors ligne : les saisies restent en file d'attente sur l'appareil. */
	enLigne = $state(true);
	fileAttente = $state<{ id: string; libelle: string }[]>([]);
	/** Mode réel : dernier refus du serveur, affiché en bandeau jusqu'à fermeture. */
	erreurServeur = $state<string | null>(null);
	pret = $state(false);

	#canal: BroadcastChannel | null = null;
	#decalage = 0;
	#canalReel: RealtimeChannel | null = null;
	#file: AppelDistant[] = [];
	#envoiEnCours = false;
	#horsLigneSimule = false;

	constructor() {
		if (!browser) return;
		this.#canal = new BroadcastChannel(CANAL);
		this.#canal.onmessage = (e: MessageEvent<MessageCanal>) => this.#recevoir(e.data);
		window.addEventListener('online', () => this.#reseauChange(true));
		window.addEventListener('offline', () => this.#reseauChange(false));
		if (mode.demo) this.#chargerDemo();
		else void this.#demarrerReel();
	}

	/* ---------- Sources ---------- */

	#chargerDemo() {
		this.source = 'demo';
		this.#decalage = this.#lireDecalage();
		this.etat = construireEtatDemo();
		const brut = localStorage.getItem(CLE_ETAT);
		if (brut) {
			try {
				const lu = JSON.parse(brut) as EtatDepot;
				if (lu.version_schema === VERSION_SCHEMA) this.etat = lu;
				else this.#sauver();
			} catch {
				this.#sauver();
			}
		} else {
			this.#sauver();
		}
		this.utilisateurId = sessionStorage.getItem(CLE_SESSION);
		this.enLigne = true;
		this.fileAttente = [];
		this.pret = true;
	}

	/** Bascule entre la démonstration et le serveur réel (appelée par l'interrupteur de la connexion). */
	async utiliserSource(source: 'demo' | 'reel') {
		if (source === this.source && this.pret) return;
		await this.#fermerReel();
		if (source === 'demo') this.#chargerDemo();
		else await this.#demarrerReel();
	}

	async #demarrerReel() {
		this.source = 'reel';
		this.pret = false;
		this.etat = etatVide();
		this.utilisateurId = null;
		this.enDirect = [];
		this.#decalage = 0;
		this.#file = this.#lireFile();
		this.#majFileAttente();
		this.enLigne = navigator.onLine;
		try {
			if (serveurConfigure) {
				const { data } = await serveur().auth.getSession();
				if (data.session) await this.#ouvrirSessionReelle(data.session.user.id);
			}
		} catch (e) {
			this.erreurServeur = e instanceof Error ? e.message : String(e);
		} finally {
			this.pret = true;
		}
	}

	async #fermerReel() {
		if (this.#canalReel) {
			await serveur().removeChannel(this.#canalReel);
			this.#canalReel = null;
		}
	}

	/** Charge les données visibles par le compte, s'abonne au temps réel et envoie la file en attente. */
	async #ouvrirSessionReelle(id: string) {
		const sb = serveur();
		const etat = await chargerEtatReel(sb);
		if (!etat.utilisateurs.some((u) => u.id === id)) {
			await sb.auth.signOut();
			throw new ErreurRegle('Ce compte est désactivé ou n’a pas de profil. Contactez la coordination APSUD.');
		}
		this.etat = etat;
		this.utilisateurId = id;
		this.#abonnerTempsReel();
		void this.#viderFile();
	}

	#abonnerTempsReel() {
		const sb = serveur();
		if (this.#canalReel) void sb.removeChannel(this.#canalReel);
		let deconnecte = false;
		this.#canalReel = sb
			.channel('consortium')
			.on('postgres_changes', { event: '*', schema: 'public' }, (p) => this.#appliquerChangement(p))
			.subscribe((statut) => {
				if (statut === 'SUBSCRIBED' && deconnecte) {
					deconnecte = false;
					void this.#resynchroniser(); // rattraper ce qui a changé pendant la coupure
				}
				if (statut === 'CHANNEL_ERROR' || statut === 'TIMED_OUT' || statut === 'CLOSED') deconnecte = true;
			});
	}

	/** Applique à l'état une ligne ajoutée, modifiée ou supprimée sur le serveur. */
	#appliquerChangement(p: RealtimePostgresChangesPayload<Record<string, unknown>>) {
		const ligne = (p.eventType === 'DELETE' ? p.old : p.new) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
		if (p.table === 'taches_semaines') {
			const t = this.etat.taches.find((x) => x.id === ligne.tache_id);
			if (!t) return;
			const i = t.semaines.findIndex((s) => s.mois === ligne.mois && s.semaine === ligne.semaine);
			if (p.eventType === 'DELETE') {
				if (i >= 0) t.semaines.splice(i, 1);
			} else if (i >= 0) t.semaines[i] = vers.semaine(ligne);
			else t.semaines.push(vers.semaine(ligne));
			return;
		}
		const c = COLLECTIONS[p.table as keyof typeof COLLECTIONS];
		if (!c) return;
		const liste = this.etat[c.etat] as unknown as Record<string, unknown>[];
		const i = liste.findIndex((x) => x[c.cle] === ligne[c.cle]); // mêmes noms de clé dans la base et dans l'état
		if (p.eventType === 'DELETE') {
			if (i >= 0) liste.splice(i, 1);
			return;
		}
		const conv = vers[p.table as keyof typeof vers] as unknown as (r: Record<string, unknown>, ...x: unknown[]) => Record<string, unknown>;
		const valeur = p.table === 'taches' ? conv(ligne, i >= 0 ? (liste[i] as { semaines: SemaineTache[] }).semaines : []) : conv(ligne);
		const nouveau = i < 0;
		if (nouveau) {
			if (p.table === 'journal') liste.unshift(valeur);
			else liste.push(valeur);
		} else liste[i] = valeur;
		if (p.table === 'journal' && nouveau) {
			const ev = valeur as unknown as Evenement;
			if (ev.auteur !== this.utilisateurId) {
				this.enDirect = [{ evenement: ev, recu_le: Date.now() }, ...this.enDirect].slice(0, 30);
				this.annonce = `${this.nomUtilisateur(ev.auteur)} ${ev.resume} ${ev.cible.libelle}.`;
			}
		}
	}

	/** Recharge tout l'état depuis le serveur (après un refus ou une coupure). */
	async #resynchroniser() {
		if (this.source !== 'reel' || !this.utilisateurId) return;
		try {
			this.etat = await chargerEtatReel(serveur());
		} catch (e) {
			this.erreurServeur = e instanceof Error ? e.message : String(e);
		}
	}

	/* ---------- File d'envoi vers le serveur réel ---------- */

	#lireFile(): AppelDistant[] {
		try {
			return JSON.parse(localStorage.getItem(CLE_FILE_REEL) ?? '[]');
		} catch {
			return [];
		}
	}

	#majFileAttente() {
		try {
			localStorage.setItem(CLE_FILE_REEL, JSON.stringify(this.#file));
		} catch {
			/* stockage indisponible : la file vit le temps de la session */
		}
		this.fileAttente = this.#file.map((a) => ({ id: a.id, libelle: a.libelle }));
	}

	#envoyer(appel: AppelDistant) {
		this.#file.push(appel);
		this.#majFileAttente();
		void this.#viderFile();
	}

	/** Envoie les appels en attente, dans l'ordre. Rejouer un appel déjà reçu ne fait rien (identifiant d'événement). */
	async #viderFile() {
		if (this.#envoiEnCours || !this.enLigne || !this.utilisateurId) return;
		this.#envoiEnCours = true;
		try {
			while (this.#file.length && this.enLigne) {
				const appel = this.#file[0];
				const { error } = await serveur().rpc(appel.fn, appel.args);
				if (error && estErreurReseau(error)) {
					this.enLigne = false; // on réessaiera au retour du réseau
					this.annonce = 'Serveur injoignable : vos saisies sont gardées sur cet appareil.';
					break;
				}
				this.#file.shift();
				this.#majFileAttente();
				if (error) {
					this.erreurServeur = `${appel.libelle} : refusé par le serveur. ${error.message}`;
					this.annonce = this.erreurServeur;
					await this.#resynchroniser();
				}
			}
		} finally {
			this.#envoiEnCours = false;
		}
	}

	#reseauChange(enLigne: boolean) {
		if (this.source !== 'reel' || this.#horsLigneSimule) return;
		this.enLigne = enLigne;
		this.annonce = enLigne ? 'Connexion rétablie.' : 'Hors ligne : vos saisies sont gardées sur cet appareil.';
		if (enLigne) void this.#viderFile().then(() => this.#resynchroniser());
	}

	fermerErreurServeur() {
		this.erreurServeur = null;
	}

	/* ---------- Comptes réels ---------- */

	async connexionReelle(email: string, motDePasse: string) {
		const { data, error } = await serveur().auth.signInWithPassword({ email: email.trim().toLowerCase(), password: motDePasse });
		if (error) throw new ErreurRegle(traduireErreurAuth(error.message));
		await this.#ouvrirSessionReelle(data.user.id);
	}

	async verifierInvitation(code: string, email: string): Promise<InvitationValide | null> {
		const { data, error } = await serveur().rpc('verifier_invitation', { p_code: code, p_email: email });
		if (error) throw new ErreurRegle(traduireErreurAuth(error.message));
		return (data as InvitationValide[] | null)?.[0] ?? null;
	}

	/** Crée le compte avec le code d'invitation. Renvoie « confirmer » si le serveur exige de confirmer l'adresse. */
	async inscriptionReelle(email: string, motDePasse: string, code: string, nom: string): Promise<'connecte' | 'confirmer'> {
		const { data, error } = await serveur().auth.signUp({
			email: email.trim().toLowerCase(),
			password: motDePasse,
			options: { data: { code_invitation: code, nom: nom.trim() } }
		});
		if (error) throw new ErreurRegle(traduireErreurAuth(error.message));
		if (!data.session || !data.user) return 'confirmer';
		await this.#ouvrirSessionReelle(data.user.id);
		return 'connecte';
	}

	/** Coordination ou super-admin : crée une invitation et renvoie le code à transmettre. */
	async creerInvitation(champs: { email: string; nom: string; fonction: string; organisation: string; role: string }): Promise<string> {
		const { data, error } = await serveur().rpc('creer_invitation', {
			p_email: champs.email,
			p_nom: champs.nom,
			p_fonction: champs.fonction,
			p_organisation: champs.organisation,
			p_role: champs.role
		});
		if (error) throw new ErreurRegle(error.message);
		return data as string;
	}

	/** Lien temporaire (5 minutes) vers un justificatif stocké sur le serveur. */
	async lienJustificatif(j: Justificatif): Promise<string | null> {
		if (this.source !== 'reel' || !j.chemin_stockage) return null;
		const { data, error } = await serveur().storage.from('justificatifs').createSignedUrl(j.chemin_stockage, 300);
		if (error) throw new ErreurRegle(`Fichier inaccessible : ${error.message}`);
		return data.signedUrl;
	}

	/* ---------- Horloge de démonstration ---------- */

	#lireDecalage(): number {
		const enr = localStorage.getItem(CLE_DECALAGE);
		if (enr) return Number(enr);
		const d = new Date(AUJOURDHUI_DEMO).getTime() - Date.now();
		localStorage.setItem(CLE_DECALAGE, String(d));
		return d;
	}

	/** « Maintenant » de la démonstration : part du 12 janvier 2027 et avance normalement. */
	maintenant(): Date {
		return new Date(Date.now() + this.#decalage);
	}

	#horodatage(): string {
		const d = this.maintenant();
		const p = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
	}

	/* ---------- Session ---------- */

	get utilisateur(): Utilisateur | null {
		return this.etat.utilisateurs.find((u) => u.id === this.utilisateurId) ?? null;
	}

	connecter(id: string) {
		this.utilisateurId = id;
		sessionStorage.setItem(CLE_SESSION, id);
	}

	deconnecter() {
		this.utilisateurId = null;
		if (this.source === 'reel') {
			if (serveurConfigure) {
				void this.#fermerReel();
				void serveur().auth.signOut();
			}
			this.etat = etatVide();
			return;
		}
		sessionStorage.removeItem(CLE_SESSION);
	}

	/* ---------- Lecture ---------- */

	volet(code: CodeVolet) {
		const v = this.etat.volets.find((x) => x.code === code);
		if (!v) throw new ErreurRegle(`Volet inconnu : ${code}`);
		return v;
	}

	nomUtilisateur(id: string | null): string {
		return this.etat.utilisateurs.find((u) => u.id === id)?.nom ?? 'Utilisateur inconnu';
	}

	notificationsNonLues(): number {
		return this.etat.notifications.filter((n) => n.destinataire === this.utilisateurId && !n.lue).length;
	}

	/** Une cible a-t-elle été modifiée par quelqu'un d'autre il y a moins de 10 s ? */
	estEnDirect(cibleId: string): MajEnDirect | undefined {
		const limite = Date.now() - 10000;
		return this.enDirect.find((m) => m.evenement.cible.id === cibleId && m.recu_le > limite);
	}

	/* ---------- Écriture : socle commun ---------- */

	#exigerUtilisateur(): Utilisateur {
		const u = this.utilisateur;
		if (!u) throw new ErreurRegle('Connectez-vous pour continuer.');
		return u;
	}

	#journaliser(type: TypeEvenement, volet: CodeVolet | null, mois: Mois | null, cible: Evenement['cible'], resume: string, avant: unknown = null, apres: unknown = null): Evenement {
		const u = this.#exigerUtilisateur();
		const ev: Evenement = {
			id: uid('ev'),
			date: this.#horodatage(),
			type,
			auteur: u.id,
			organisation: u.organisation,
			volet,
			mois,
			cible,
			resume,
			avant,
			apres
		};
		this.etat.journal.unshift(ev);
		// En mode réel, les notifications sont créées par le serveur (et chacun ne voit que les siennes).
		if (this.source === 'demo') {
			for (const d of destinataires(this.etat, u.id, volet)) {
				this.etat.notifications.push({ id: uid('n'), evenement_id: ev.id, destinataire: d, lue: false });
			}
		}
		return ev;
	}

	/**
	 * Termine une écriture. Démonstration : sauvegarde locale et diffusion aux autres onglets.
	 * Réel : envoi à la fonction SQL `distant.fn`, avec l'identifiant de l'événement
	 * (le serveur l'utilise pour ne jamais appliquer deux fois le même envoi).
	 */
	#valider(ev: Evenement, annonce: string, distant?: { fn: string; args: Record<string, unknown> }) {
		if (this.source === 'reel') {
			if (distant) this.#envoyer({ id: ev.id, fn: distant.fn, args: { p_evenement: ev.id, ...distant.args }, libelle: `${ev.resume} ${ev.cible.libelle}` });
			this.annonce = annonce;
			return;
		}
		if (this.enLigne) {
			this.#sauver();
			this.#canal?.postMessage({ type: 'maj', evenement: $state.snapshot(ev) } satisfies MessageCanal);
		} else {
			this.fileAttente.push({ id: ev.id, libelle: `${ev.resume} ${ev.cible.libelle}` });
			this.#sauver();
		}
		this.annonce = annonce;
	}

	#sauver() {
		// Seule la démonstration vit dans le navigateur : les données réelles n'y sont jamais copiées.
		if (!browser || this.source !== 'demo') return;
		localStorage.setItem(CLE_ETAT, JSON.stringify($state.snapshot(this.etat)));
	}

	#recevoir(message: MessageCanal) {
		if (this.source !== 'demo') return;
		const brut = localStorage.getItem(CLE_ETAT);
		if (brut) this.etat = JSON.parse(brut);
		if (message.type === 'reinitialisation') {
			this.annonce = 'La démonstration a été réinitialisée.';
			return;
		}
		const ev = message.evenement;
		this.enDirect = [{ evenement: ev, recu_le: Date.now() }, ...this.enDirect].slice(0, 30);
		if (ev.auteur !== this.utilisateurId) {
			this.annonce = `${this.nomUtilisateur(ev.auteur)} ${ev.resume} ${ev.cible.libelle}.`;
		}
	}

	/** Simule une coupure réseau ; au retour, la file d'attente est envoyée sans doublon. */
	basculerReseau() {
		if (this.source === 'reel') {
			// Simulation d'une coupure, utile pour la formation : la file se vide au retour.
			this.#horsLigneSimule = this.enLigne;
			this.enLigne = !this.enLigne;
			this.annonce = this.enLigne ? 'Connexion rétablie.' : 'Hors ligne : vos saisies sont gardées sur cet appareil.';
			if (this.enLigne) void this.#viderFile();
			return;
		}
		this.enLigne = !this.enLigne;
		if (this.enLigne && this.fileAttente.length) {
			const n = this.fileAttente.length;
			this.fileAttente = [];
			this.#sauver();
			const dernier = this.etat.journal[0];
			if (dernier) this.#canal?.postMessage({ type: 'maj', evenement: $state.snapshot(dernier) } satisfies MessageCanal);
			this.annonce = `${n} modification${n > 1 ? 's' : ''} envoyée${n > 1 ? 's' : ''}.`;
		} else {
			this.annonce = this.enLigne ? 'Connexion rétablie.' : 'Hors ligne : vos saisies sont gardées sur cet appareil.';
		}
	}

	reinitialiserDemo() {
		if (this.source !== 'demo') throw new ErreurRegle('La réinitialisation ne concerne que la démonstration.');
		this.etat = construireEtatDemo();
		localStorage.removeItem(CLE_DECALAGE);
		this.#decalage = this.#lireDecalage();
		this.enDirect = [];
		this.fileAttente = [];
		this.#sauver();
		this.#canal?.postMessage({ type: 'reinitialisation' } satisfies MessageCanal);
		this.annonce = 'La démonstration a été réinitialisée.';
	}

	#rapportOuCreer(volet: CodeVolet, mois: Mois) {
		let r = trouverRapport(this.etat, volet, mois);
		if (!r) {
			r = { id: `${volet}:${mois}`, volet, mois, statut: 'non_commence', soumis_par: null, soumis_le: null, decision_par: null, decision_le: null, motif: null };
			this.etat.rapports.push(r);
		}
		return r;
	}

	#exigerSaisie(volet: CodeVolet, mois: Mois) {
		const u = this.#exigerUtilisateur();
		const v = this.volet(volet);
		const r = trouverRapport(this.etat, volet, mois);
		if (!peutEcrireVolet(u, v)) throw new ErreurRegle(`Votre organisation (${u.organisation}) ne peut pas modifier le volet ${volet}.`);
		if (!peutSaisirMois(u, v, r)) throw new ErreurRegle('Ce rapport est validé ou verrouillé : demandez une réouverture à la coordination APSUD.');
		const rapport = this.#rapportOuCreer(volet, mois);
		if (rapport.statut === 'non_commence') rapport.statut = 'brouillon';
		return { u, v, rapport };
	}

	/* ---------- Indicateurs ---------- */

	/** Enregistre le réalisé du mois : nouvelle version, l'ancienne reste dans l'historique. */
	enregistrerValeur(indicateurId: string, mois: Mois, saisie: Desagregation, commentaire: string | null) {
		const ind = this.etat.indicateurs.find((i) => i.id === indicateurId);
		if (!ind) throw new ErreurRegle('Indicateur introuvable.');
		this.#exigerSaisie(ind.volet, mois);
		const valeurs = this.#controlerValeurs(ind, saisie);
		const precedente = valeurCourante(this.etat, indicateurId, mois);
		if (precedente && JSON.stringify(precedente.valeurs) === JSON.stringify(valeurs) && (precedente.commentaire ?? '') === (commentaire ?? '')) return;
		if (precedente) precedente.courante = false;
		const idValeur = uid('val');
		this.etat.valeurs.push({
			id: idValeur,
			indicateur_id: indicateurId,
			volet: ind.volet,
			mois,
			valeurs,
			commentaire,
			version: (precedente?.version ?? 0) + 1,
			courante: true,
			auteur: this.utilisateurId!,
			date: this.#horodatage()
		});
		const ev = this.#journaliser('valeur_modifiee', ind.volet, mois, { type: 'indicateur', id: indicateurId, libelle: ind.libelle }, 'a modifié', precedente?.valeurs ?? null, valeurs);
		this.#valider(ev, 'Valeur enregistrée.', {
			fn: 'enregistrer_valeur',
			args: { p_id: idValeur, p_indicateur: indicateurId, p_mois: mois, p_femmes: valeurs.femmes, p_filles: valeurs.filles, p_hommes: valeurs.hommes, p_garcons: valeurs.garcons, p_total: valeurs.total, p_commentaire: commentaire }
		});
	}

	#controlerValeurs(ind: Indicateur, s: Desagregation): Desagregation {
		const parts = [s.femmes, s.filles, s.hommes, s.garcons];
		for (const p of [...parts, s.total]) {
			if (p !== null && (Number.isNaN(p) || p < 0)) throw new ErreurRegle('Saisissez des nombres positifs ou laissez la case vide.');
			if (p !== null && ind.type_valeur === 'nombre' && !Number.isInteger(p)) throw new ErreurRegle('Saisissez des nombres entiers (pas de décimales pour un nombre de personnes ou d’unités).');
		}
		if (ind.type_valeur === 'pourcentage' && s.total !== null && s.total > 100) throw new ErreurRegle('Un pourcentage ne peut pas dépasser 100.');
		if (ind.desagrege) {
			const total = parts.every((p) => p === null) ? null : parts.reduce<number>((a, b) => a + (b ?? 0), 0);
			return { femmes: s.femmes, filles: s.filles, hommes: s.hommes, garcons: s.garcons, total };
		}
		return { femmes: null, filles: null, hommes: null, garcons: null, total: s.total };
	}

	/* ---------- Activités : avancement, dépenses ---------- */

	enregistrerAvancement(activiteId: string, mois: Mois, champs: { taux_execution: number | null; resultats: string; observations: string }) {
		const act = this.#activite(activiteId);
		this.#exigerSaisie(act.volet, mois);
		if (champs.taux_execution !== null && (champs.taux_execution < 0 || champs.taux_execution > 100)) throw new ErreurRegle('Le taux d’exécution est compris entre 0 et 100 %.');
		const precedent = this.etat.avancements.find((a) => a.activite_id === activiteId && a.mois === mois && a.courante);
		if (precedent && precedent.taux_execution === champs.taux_execution && precedent.resultats === champs.resultats && precedent.observations === champs.observations) return;
		if (precedent) precedent.courante = false;
		const idAvancement = uid('av');
		this.etat.avancements.push({ id: idAvancement, activite_id: activiteId, volet: act.volet, mois, ...champs, version: (precedent?.version ?? 0) + 1, courante: true, auteur: this.utilisateurId!, date: this.#horodatage() });
		const ev = this.#journaliser('avancement_modifie', act.volet, mois, { type: 'activite', id: activiteId, libelle: `${act.numero} ${act.libelle}` }, 'a mis à jour l’avancement de', precedent ? { taux: precedent.taux_execution } : null, { taux: champs.taux_execution });
		this.#valider(ev, 'Avancement enregistré.', {
			fn: 'enregistrer_avancement',
			args: { p_id: idAvancement, p_activite: activiteId, p_mois: mois, p_taux: champs.taux_execution, p_resultats: champs.resultats, p_observations: champs.observations }
		});
	}

	/* ---------- Planification du mois suivant (cahier des charges APSUD, §3.4) ---------- */

	/**
	 * Valide la planification d'un volet pour un mois : les activités listées sont prévues,
	 * les autres activités actives du volet ne le sont pas. Rien n'est supprimé : chaque ligne
	 * est mise à jour. Mêmes règles que la fonction SQL planifier_mois.
	 */
	planifierMois(volet: CodeVolet, mois: Mois, activiteIds: string[]) {
		const u = this.#exigerUtilisateur();
		const v = this.volet(volet);
		if (!peutEcrireVolet(u, v)) throw new ErreurRegle(`Votre organisation (${u.organisation}) ne peut pas planifier le volet ${volet}.`);
		if (!this.etat.projet.mois.includes(mois)) throw new ErreurRegle(`Le mois ${mois} ne fait pas partie du projet.`);
		if (!peutSaisirMois(u, v, trouverRapport(this.etat, volet, mois))) throw new ErreurRegle('Le rapport de ce mois est déjà soumis ou validé : la planification ne peut plus changer.');
		const actives = this.etat.activites.filter((a) => a.volet === volet && !a.archive_le);
		const choisies = new Set(activiteIds);
		if ([...choisies].some((id) => !actives.some((a) => a.id === id))) throw new ErreurRegle(`Une activité choisie n’appartient pas au volet ${volet} ou est archivée.`);
		const le = this.#horodatage();
		for (const a of actives) {
			const id = `${a.id}:${mois}`;
			const ligne: Planification = { id, activite_id: a.id, volet, mois, prevue: choisies.has(a.id), valide_par: u.id, valide_le: le };
			const i = this.etat.planifications.findIndex((p) => p.id === id);
			if (i >= 0) this.etat.planifications[i] = ligne;
			else this.etat.planifications.push(ligne);
		}
		const nb = choisies.size;
		const ev = this.#journaliser('planification_validee', volet, mois, { type: 'planification', id: `${volet}:${mois}`, libelle: `${nb} activité${nb > 1 ? 's' : ''}` }, 'a validé la planification du mois :');
		this.#valider(ev, 'Planification enregistrée.', { fn: 'planifier_mois', args: { p_volet: volet, p_mois: mois, p_activites: [...choisies] } });
	}

	ajouterDepense(activiteId: string, mois: Mois, montant: number, libelle: string) {
		const act = this.#activite(activiteId);
		this.#exigerSaisie(act.volet, mois);
		if (!Number.isFinite(montant) || montant <= 0) throw new ErreurRegle('Le montant doit être un nombre positif.');
		if (!libelle.trim()) throw new ErreurRegle('Décrivez la dépense (exemple : « Achat de kits d’hygiène »).');
		const d: Depense = { id: uid('dep'), activite_id: activiteId, volet: act.volet, mois, montant, libelle: libelle.trim(), auteur: this.utilisateurId!, date: this.#horodatage(), archive_le: null };
		this.etat.depenses.push(d);
		const ev = this.#journaliser('depense_ajoutee', act.volet, mois, { type: 'depense', id: d.id, libelle: `${d.libelle} (${act.numero})` }, 'a ajouté une dépense :', null, { montant });
		this.#valider(ev, 'Dépense ajoutée.', { fn: 'ajouter_depense', args: { p_id: d.id, p_activite: activiteId, p_mois: mois, p_montant: montant, p_libelle: d.libelle } });
	}

	#activite(id: string): Activite {
		const a = this.etat.activites.find((x) => x.id === id);
		if (!a) throw new ErreurRegle('Activité introuvable.');
		return a;
	}

	/* ---------- Structure : activités, tâches ---------- */

	ajouterActivite(outputId: string, libelle: string, budget: number, responsable: string | null) {
		const u = this.#exigerUtilisateur();
		const output = this.etat.outputs.find((o) => o.id === outputId);
		if (!output) throw new ErreurRegle('Output introuvable.');
		const v = this.volet(output.volet);
		if (!peutModifierStructure(u, v)) throw new ErreurRegle(v.cadre_verrouille ? 'Le cadre logique de ce volet est verrouillé par APSUD : demandez un déverrouillage.' : 'Vous ne pouvez pas modifier ce volet.');
		if (!libelle.trim()) throw new ErreurRegle('Donnez un intitulé à l’activité.');
		const freres = this.etat.activites.filter((a) => a.output_id === outputId);
		const numero = `${output.numero}.${freres.length + 1}`;
		const a: Activite = { id: `${v.code}:act:${numero}:${crypto.randomUUID().slice(0, 4)}`, volet: v.code, output_id: outputId, numero, libelle: libelle.trim(), responsable, budget_planifie: Math.max(0, budget || 0), archive_le: null, cree_par: u.id };
		this.etat.activites.push(a);
		const ev = this.#journaliser('activite_creee', v.code, null, { type: 'activite', id: a.id, libelle: `${a.numero} ${a.libelle}` }, 'a créé l’activité');
		this.#valider(ev, `Activité ${numero} créée.`, {
			fn: 'ajouter_activite',
			args: { p_id: a.id, p_output: outputId, p_libelle: a.libelle, p_budget: a.budget_planifie, p_responsable: responsable }
		});
		return a;
	}

	ajouterTache(activiteId: string, champs: { libelle: string; responsable: string | null; date_debut: string | null; date_fin: string | null }) {
		const u = this.#exigerUtilisateur();
		const act = this.#activite(activiteId);
		const v = this.volet(act.volet);
		if (!peutEcrireVolet(u, v)) throw new ErreurRegle('Vous ne pouvez pas modifier ce volet.');
		if (!champs.libelle.trim()) throw new ErreurRegle('Décrivez la tâche (« Action à prendre »).');
		if (champs.date_debut && champs.date_fin && champs.date_fin < champs.date_debut) throw new ErreurRegle('La date de fin doit suivre la date de début.');
		const t: Tache = { id: uid('t'), volet: act.volet, activite_id: activiteId, libelle: champs.libelle.trim(), responsable: champs.responsable, date_debut: champs.date_debut, date_fin: champs.date_fin, semaines: [], archive_le: null };
		this.etat.taches.push(t);
		const ev = this.#journaliser('tache_creee', act.volet, null, { type: 'tache', id: t.id, libelle: t.libelle }, 'a ajouté la tâche');
		this.#valider(ev, 'Tâche ajoutée.', {
			fn: 'ajouter_tache',
			args: { p_id: t.id, p_activite: activiteId, p_libelle: t.libelle, p_responsable: t.responsable, p_date_debut: t.date_debut, p_date_fin: t.date_fin }
		});
		return t;
	}

	/** Coche ou décoche une semaine (prévu ou réalisé) du calendrier S1-S5. */
	basculerSemaine(tacheId: string, mois: Mois, semaine: SemaineTache['semaine'], champ: 'prevu' | 'realise') {
		const u = this.#exigerUtilisateur();
		const t = this.etat.taches.find((x) => x.id === tacheId);
		if (!t) throw new ErreurRegle('Tâche introuvable.');
		if (!peutEcrireVolet(u, this.volet(t.volet))) throw new ErreurRegle('Vous ne pouvez pas modifier ce calendrier.');
		let s = t.semaines.find((x) => x.mois === mois && x.semaine === semaine);
		if (!s) {
			s = { mois, semaine, prevu: false, realise: false };
			t.semaines.push(s);
		}
		s[champ] = !s[champ];
		if (champ === 'realise' && s.realise) s.prevu = true;
		const etat = s[champ] ? 'coché' : 'décoché';
		const ev = this.#journaliser('semaine_cochee', t.volet, mois, { type: 'tache', id: t.id, libelle: t.libelle }, `a ${etat} S${semaine} (${champ === 'prevu' ? 'prévu' : 'réalisé'}) pour`);
		this.#valider(ev, `Semaine ${semaine} ${etat}e.`, {
			fn: 'definir_semaine',
			args: { p_tache: tacheId, p_mois: mois, p_semaine: semaine, p_champ: champ, p_valeur: s[champ] }
		});
	}

	/* ---------- Justificatifs (métadonnées seulement dans la maquette) ---------- */

	/**
	 * Démonstration : métadonnées seulement. Réel : le fichier (`contenu`) est d'abord déposé
	 * dans le stockage privé, dans le dossier de l'organisation du volet, puis enregistré.
	 */
	ajouterJustificatif(volet: CodeVolet, mois: Mois, rattachement: Justificatif['rattachement'], fichier: { nom: string; type: string; taille: number }, moyen: string | null, contenu?: Blob) {
		if (this.source === 'reel' && contenu && !this.enLigne) throw new ErreurRegle('Hors ligne : un fichier ne peut être envoyé qu’avec une connexion. Réessayez au retour du réseau.');
		this.#exigerSaisie(volet, mois);
		if (estPhoto(fichier.nom, fichier.type)) throw new ErreurRegle(MESSAGE_PHOTO_REFUSEE);
		const id = uid('j');
		const sur = fichier.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
		const chemin = this.source === 'reel' && contenu ? `${this.volet(volet).organisation}/${mois}/${id.replace(':', '-')}-${sur}` : null;
		const j: Justificatif = { id, volet, mois, rattachement, nom_fichier: fichier.nom, type_mime: fichier.type || 'application/octet-stream', taille: fichier.taille, moyen_verification: moyen, chemin_stockage: chemin, auteur: this.utilisateurId!, date: this.#horodatage(), archive_le: null };
		this.etat.justificatifs.push(j);
		const ev = this.#journaliser('justificatif_ajoute', volet, mois, { type: 'justificatif', id: j.id, libelle: j.nom_fichier }, 'a ajouté le justificatif');
		const distant = {
			fn: 'ajouter_justificatif',
			args: { p_id: id, p_volet: volet, p_mois: mois, p_rattachement_type: rattachement.type, p_rattachement_id: rattachement.id, p_nom_fichier: j.nom_fichier, p_type_mime: j.type_mime, p_taille: j.taille, p_moyen: moyen, p_chemin: chemin }
		};
		if (!chemin || !contenu) return this.#valider(ev, 'Justificatif ajouté.', distant);
		this.annonce = 'Envoi du fichier…';
		void serveur()
			.storage.from('justificatifs')
			.upload(chemin, contenu, { contentType: j.type_mime, upsert: false })
			.then(({ error }) => {
				if (error) {
					this.erreurServeur = `Le fichier « ${j.nom_fichier} » n’a pas pu être envoyé : ${error.message}`;
					return this.#resynchroniser();
				}
				this.#valider(ev, 'Justificatif ajouté.', distant);
			});
	}

	/* ---------- 5W du cluster WASH ---------- */

	/** Fiche 5W d'une activité (correspondance avec la nomenclature du cluster) : modifiable par l'ONG du volet. */
	enregistrerFiche5W(activiteId: string, fiche: Fiche5W) {
		const u = this.#exigerUtilisateur();
		const act = this.#activite(activiteId);
		if (!peutEcrireVolet(u, this.volet(act.volet))) throw new ErreurRegle('Seules l’ONG du volet et la coordination APSUD peuvent modifier la fiche 5W.');
		if (!fiche.activite_cluster) throw new ErreurRegle('Choisissez l’activité standard du cluster qui correspond à cette activité.');
		if (!fiche.modalite || !fiche.type_beneficiaire || !fiche.reponse) throw new ErreurRegle('Renseignez la modalité, le type de bénéficiaire et le type de réponse.');
		const avant = act.fiche_5w ? $state.snapshot(act.fiche_5w) : null;
		act.fiche_5w = { ...fiche, partenaires: fiche.partenaires?.trim() || null };
		const ev = this.#journaliser('fiche_5w_modifiee', act.volet, null, { type: 'activite', id: act.id, libelle: `${act.numero} ${act.libelle}` }, 'a mis à jour la fiche 5W de', avant, $state.snapshot(act.fiche_5w));
		this.#valider(ev, 'Fiche 5W enregistrée.', { fn: 'enregistrer_fiche_5w', args: { p_activite: activiteId, p_fiche: $state.snapshot(act.fiche_5w) } });
	}

	#controlerLigne5W(c: ChampsLigne5W) {
		if (!c.sous_prefecture || !c.prefecture) throw new ErreurRegle('Choisissez la sous-préfecture : le cluster demande une ligne par sous-préfecture.');
		const nombres = [c.quantite_prevue, c.quantite_realisee, c.personnes_ciblees, c.filles, c.garcons, c.femmes, c.hommes];
		for (const n of nombres) {
			if (n !== null && (!Number.isFinite(n) || n < 0 || !Number.isInteger(n))) throw new ErreurRegle('Quantités et nombres de personnes : des nombres entiers positifs, ou laissez la case vide.');
		}
		if (c.latitude !== null && (c.latitude < -90 || c.latitude > 90)) throw new ErreurRegle('Latitude en degrés décimaux, entre −90 et 90 (exemple : 6,4893).');
		if (c.longitude !== null && (c.longitude < -180 || c.longitude > 180)) throw new ErreurRegle('Longitude en degrés décimaux, entre −180 et 180 (exemple : 17,4482).');
		if (c.date_debut && c.date_fin && c.date_fin < c.date_debut) throw new ErreurRegle('La date de fin doit suivre la date de début.');
		const atteints = [c.filles, c.garcons, c.femmes, c.hommes].some((n) => n !== null);
		if (!atteints) throw new ErreurRegle('Le cluster ne retient que les lignes avec des personnes atteintes : renseignez Filles, Garçons, Femmes ou Hommes.');
	}

	ajouterLigne5W(activiteId: string, mois: Mois, champs: ChampsLigne5W) {
		const act = this.#activite(activiteId);
		this.#exigerSaisie(act.volet, mois);
		if (!act.fiche_5w) throw new ErreurRegle('Complétez d’abord la fiche 5W de l’activité (activité standard, modalité, bénéficiaires).');
		this.#controlerLigne5W(champs);
		const l: Ligne5W = { id: uid('l5w'), volet: act.volet, activite_id: activiteId, mois, ...champs, auteur: this.utilisateurId!, date: this.#horodatage(), archive_le: null };
		this.etat.lignes_5w.push(l);
		const ev = this.#journaliser('ligne_5w_ajoutee', act.volet, mois, { type: 'activite', id: act.id, libelle: `${act.numero}, ${l.sous_prefecture}` }, 'a ajouté une ligne 5W :');
		this.#valider(ev, 'Ligne 5W ajoutée.', { fn: 'ajouter_ligne_5w', args: { p_id: l.id, p_activite: activiteId, p_mois: mois, p_champs: champs } });
	}

	modifierLigne5W(id: string, champs: ChampsLigne5W) {
		const l = this.etat.lignes_5w.find((x) => x.id === id);
		if (!l) throw new ErreurRegle('Ligne 5W introuvable.');
		this.#exigerSaisie(l.volet, l.mois);
		this.#controlerLigne5W(champs);
		const avant = $state.snapshot(l);
		Object.assign(l, champs, { auteur: this.utilisateurId!, date: this.#horodatage() });
		const act = this.#activite(l.activite_id);
		const ev = this.#journaliser('ligne_5w_modifiee', l.volet, l.mois, { type: 'activite', id: act.id, libelle: `${act.numero}, ${l.sous_prefecture}` }, 'a modifié une ligne 5W :', avant, $state.snapshot(l));
		this.#valider(ev, 'Ligne 5W mise à jour.', { fn: 'modifier_ligne_5w', args: { p_id: id, p_champs: champs } });
	}

	/* ---------- Nouvelle ONG ou nouveau volet ---------- */

	/**
	 * Super-administrateur : fait entrer une nouvelle ONG dans le consortium avec son volet,
	 * ou ajoute un volet (un secteur) à une ONG existante. Les 10 rapports mensuels du volet
	 * sont créés ; son cadre logique s'importe ensuite depuis le plan d'action Excel de l'ONG.
	 * Démonstration : la nouvelle ONG reçoit un compte de saisie, choisissable à la connexion.
	 */
	ajouterVolet(sigleSaisi: string, nom: string, secteur: CodeSecteur): CodeVolet {
		const u = this.#exigerUtilisateur();
		if (!peutAjouterOrganisation(u)) throw new ErreurRegle('Seul le super-administrateur ajoute une ONG ou un volet.');
		const sigle = sigleSaisi.trim().toUpperCase();
		if (!/^[A-Z0-9]{2,12}$/.test(sigle)) throw new ErreurRegle('Sigle invalide : 2 à 12 lettres majuscules ou chiffres, sans espace ni tiret (ex. MSF, CARE).');
		const sect = this.etat.secteurs.find((s) => s.code === secteur);
		if (!sect) throw new ErreurRegle('Choisissez le secteur du volet.');
		let org = this.etat.organisations.find((o) => o.sigle === sigle);
		const nouvelle = !org;
		if (!org) {
			if (nom.trim().length < 3) throw new ErreurRegle('Indiquez le nom complet de la nouvelle ONG.');
			org = { sigle, nom: nom.trim(), role_consortium: 'partenaire', ville: null };
			this.etat.organisations.push(org);
		}
		const code = `${secteur}-${sigle}`;
		if (this.etat.volets.some((v) => v.code === code)) throw new ErreurRegle(`Le volet ${code} existe déjà.`);
		this.etat.volets.push({ code, organisation: sigle, secteur, cadre_verrouille: false });
		for (const mois of this.etat.projet.mois) {
			this.etat.rapports.push({ id: `${code}:${mois}`, volet: code, mois, statut: 'non_commence', soumis_par: null, soumis_le: null, decision_par: null, decision_le: null, motif: null });
		}
		if (this.source === 'demo' && nouvelle) {
			this.etat.utilisateurs.push({ id: `u-${sigle.toLowerCase()}`, nom: `Saisie ${sigle}`, fonction: `Volet ${sect.libelle_court.toLowerCase()}`, organisation: sigle, role: 'saisie', initiales: sigle.slice(0, 2) });
		}
		const ev = this.#journaliser('volet_cree', code, null, { type: 'volet', id: code, libelle: `${code} (${org.nom})` }, nouvelle ? 'a ajouté une nouvelle ONG et son volet' : 'a ajouté le volet');
		this.#valider(ev, nouvelle ? `${sigle} a rejoint le consortium (volet ${code}).` : `Volet ${code} ajouté.`, {
			fn: 'ajouter_volet',
			args: { p_sigle: sigle, p_nom: org.nom, p_secteur: secteur }
		});
		return code;
	}

	/* ---------- Circuit de validation ---------- */

	changerStatut(volet: CodeVolet, mois: Mois, vers: StatutRapport, motif: string | null = null) {
		const u = this.#exigerUtilisateur();
		const v = this.volet(volet);
		const r = this.#rapportOuCreer(volet, mois);
		verifierTransition(u, v, r, vers, motif);
		if (vers === 'soumis') {
			const inds = this.etat.indicateurs.filter((i) => i.volet === volet && !i.archive_le && i.cible.total);
			const manquants = inds.filter((i) => !valeurCourante(this.etat, i.id, mois));
			if (manquants.length === inds.length) throw new ErreurRegle('Le rapport est vide : saisissez au moins un indicateur avant de le soumettre.');
		}
		const avant = r.statut;
		r.statut = vers;
		const h = this.#horodatage();
		if (vers === 'soumis') {
			r.soumis_par = u.id;
			r.soumis_le = h;
			r.motif = null;
		} else {
			r.decision_par = u.id;
			r.decision_le = h;
			r.motif = motif?.trim() || null;
		}
		const types: Record<string, TypeEvenement> = { soumis: 'rapport_soumis', valide: avant === 'verrouille' ? 'rapport_deverrouille' : 'rapport_valide', a_corriger: 'rapport_a_corriger', verrouille: 'rapport_verrouille' };
		const resumes: Record<string, string> = { soumis: 'a soumis le rapport', valide: avant === 'verrouille' ? 'a déverrouillé le rapport' : 'a validé le rapport', a_corriger: 'a renvoyé pour correction le rapport', verrouille: 'a verrouillé le rapport' };
		const ev = this.#journaliser(types[vers], volet, mois, { type: 'rapport', id: r.id, libelle: `${volet}, ${mois}` }, resumes[vers], avant, vers);
		this.#valider(ev, `Rapport ${resumes[vers].replace(/^a /, '').replace(' le rapport', '')}.`, {
			fn: 'changer_statut_rapport',
			args: { p_volet: volet, p_mois: mois, p_vers: vers, p_motif: motif }
		});
	}

	basculerVerrouCadre(volet: CodeVolet) {
		const u = this.#exigerUtilisateur();
		if (!peutValider(u)) throw new ErreurRegle('Seule la coordination APSUD verrouille un cadre logique.');
		const v = this.volet(volet);
		v.cadre_verrouille = !v.cadre_verrouille;
		const ev = this.#journaliser(v.cadre_verrouille ? 'cadre_verrouille' : 'cadre_deverrouille', volet, null, { type: 'volet', id: volet, libelle: `cadre logique ${volet}` }, v.cadre_verrouille ? 'a verrouillé le' : 'a déverrouillé le');
		this.#valider(ev, v.cadre_verrouille ? 'Cadre logique verrouillé.' : 'Cadre logique déverrouillé.', {
			fn: 'definir_verrou_cadre',
			args: { p_volet: volet, p_verrouille: v.cadre_verrouille }
		});
	}

	/* ---------- Archivage, restauration, suppression ---------- */

	#collection(type: Archivable) {
		const map = { activite: this.etat.activites, tache: this.etat.taches, indicateur: this.etat.indicateurs, depense: this.etat.depenses, justificatif: this.etat.justificatifs, ligne_5w: this.etat.lignes_5w } as const;
		return map[type] as { id: string; volet: CodeVolet; archive_le: string | null; libelle?: string; nom_fichier?: string; sous_prefecture?: string }[];
	}

	#libelleElement(e: { libelle?: string; nom_fichier?: string; sous_prefecture?: string; id: string }) {
		return e.libelle ?? e.nom_fichier ?? (e.sous_prefecture ? `ligne 5W, ${e.sous_prefecture}` : e.id);
	}

	archiver(type: Archivable, id: string) {
		const u = this.#exigerUtilisateur();
		const e = this.#collection(type).find((x) => x.id === id);
		if (!e) throw new ErreurRegle('Élément introuvable.');
		if (!peutArchiver(u, this.volet(e.volet))) throw new ErreurRegle('Vous ne pouvez archiver que les éléments de votre organisation.');
		e.archive_le = this.#horodatage();
		const ev = this.#journaliser('element_archive', e.volet, null, { type, id, libelle: this.#libelleElement(e) }, 'a archivé');
		this.#valider(ev, 'Élément archivé. Il reste consultable dans les archives.', { fn: 'archiver', args: { p_type: type, p_id: id } });
	}

	restaurer(type: Archivable, id: string) {
		const u = this.#exigerUtilisateur();
		if (!peutValider(u)) throw new ErreurRegle('Seule la coordination APSUD restaure un élément archivé.');
		const e = this.#collection(type).find((x) => x.id === id);
		if (!e) throw new ErreurRegle('Élément introuvable.');
		e.archive_le = null;
		const ev = this.#journaliser('element_restaure', e.volet, null, { type, id, libelle: this.#libelleElement(e) }, 'a restauré');
		this.#valider(ev, 'Élément restauré.', { fn: 'restaurer', args: { p_type: type, p_id: id } });
	}

	/** Suppression définitive : super-administrateur uniquement, et toujours journalisée. */
	supprimerDefinitivement(type: Archivable, id: string) {
		const u = this.#exigerUtilisateur();
		if (!peutSupprimer(u)) throw new ErreurRegle('Suppression refusée : seul le super-administrateur peut supprimer définitivement. Utilisez « Archiver ».');
		const liste = this.#collection(type);
		const i = liste.findIndex((x) => x.id === id);
		if (i < 0) throw new ErreurRegle('Élément introuvable.');
		const [e] = liste.splice(i, 1);
		const ev = this.#journaliser('element_supprime', e.volet, null, { type, id, libelle: this.#libelleElement(e) }, 'a supprimé définitivement', $state.snapshot(e), null);
		this.#valider(ev, 'Élément supprimé définitivement. L’opération est inscrite au journal.', { fn: 'supprimer_definitivement', args: { p_type: type, p_id: id } });
	}

	/* ---------- Notifications ---------- */

	marquerToutLu() {
		for (const n of this.etat.notifications) if (n.destinataire === this.utilisateurId) n.lue = true;
		this.#sauver();
		if (this.source === 'reel') this.#envoyer({ id: uid('lu'), fn: 'marquer_lu', args: { p_evenement_id: null }, libelle: 'Notifications marquées comme lues' });
	}

	marquerLue(evenementId: string) {
		for (const n of this.etat.notifications) if (n.destinataire === this.utilisateurId && n.evenement_id === evenementId) n.lue = true;
		this.#sauver();
		if (this.source === 'reel') this.#envoyer({ id: uid('lu'), fn: 'marquer_lu', args: { p_evenement_id: evenementId }, libelle: 'Notification marquée comme lue' });
	}

	/* ---------- Raccourcis de calcul liés à l'état ---------- */

	cumul(indicateurId: string, mois: Mois, inclus = true) {
		const ind = this.etat.indicateurs.find((i) => i.id === indicateurId);
		return ind ? cumul(this.etat, ind, mois, inclus) : null;
	}
}

export const depot = new Depot();
export { ErreurRegle };
