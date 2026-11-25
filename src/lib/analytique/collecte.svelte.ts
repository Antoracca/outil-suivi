/**
 * MESURE D'UTILISATION de la plateforme (analytique), avec le consentement de chaque compte.
 *
 * But : comprendre comment l'outil est utilisé (pages ouvertes, boutons utilisés, temps passé,
 * appareil et connexion) pour l'améliorer de jour en jour ; plus tard, ces traces nourriront
 * une analyse automatique (intelligence artificielle) des usages. Point de départ simple,
 * destiné à être enrichi : c'est ICI que s'ajoutent les nouvelles mesures.
 *
 * Règles :
 *   - rien n'est enregistré sans « Je consens » (et la base refuse aussi tout envoi sans accord,
 *     migration 0016) ; le choix se change à tout moment (menu du compte › Mesure d'utilisation) ;
 *   - la demande s'affiche à l'arrivée, 3 fois au plus tant qu'aucun choix n'est fait ;
 *   - jamais le contenu des saisies : ni valeurs, ni textes tapés, ni noms de fichiers ;
 *   - mode réel : envoi groupé à la base (enregistrer_analytique) ; démonstration : gardé
 *     dans ce navigateur seulement (300 derniers événements), pour voir ce qui serait mesuré.
 */
import { browser } from '$app/env';
import { serveur } from '#lib/donnees/reel/client.ts';

export type TypeMesure = 'page' | 'clic' | 'duree' | 'appareil' | 'erreur' | 'recherche' | 'action';
export interface Mesure {
	type: TypeMesure;
	page: string;
	cible?: string;
	donnees?: Record<string, string | number | boolean | null>;
	date: string;
}

/** Version du texte de consentement (à augmenter si ce qui est mesuré change beaucoup). */
export const VERSION_CONSENTEMENT = 1;
/** Nombre d'affichages de la demande, au plus, tant qu'aucun choix n'est fait. */
export const AFFICHAGES_MAX = 3;
const CLE_DEMO = 'apsud-suivi:analytique-demo';
const INTERVALLE = 20_000;

const lire = (cle: string) => {
	try {
		return localStorage.getItem(cle);
	} catch {
		return null;
	}
};
const ecrire = (cle: string, v: string) => {
	try {
		localStorage.setItem(cle, v);
	} catch {
		/* stockage indisponible : sans conséquence */
	}
};

class Collecte {
	/** Choix du compte connecté : true (consent), false (refuse), null (pas encore choisi). */
	choix = $state<boolean | null>(null);
	/** La demande de consentement est affichée. */
	demandeOuverte = $state(false);
	/** Le choix est connu (lu sur le serveur ou sur l'appareil) : la suite de l'arrivée peut s'afficher. */
	pret = $state(false);

	#utilisateur: string | null = null;
	#source: 'demo' | 'reel' = 'demo';
	#file: Mesure[] = [];
	#minuterie: ReturnType<typeof setInterval> | undefined;
	#pageCourante: string | null = null;
	#entreeLe = 0;
	#session = '';
	#ecoute = false;

	get actif(): boolean {
		return this.choix === true;
	}

	/** À chaque connexion : relit le choix, décide d'afficher la demande, démarre si accord. */
	async demarrer(utilisateur: string, source: 'demo' | 'reel') {
		if (!browser || this.#utilisateur === utilisateur) return;
		this.#arreter();
		this.#utilisateur = utilisateur;
		this.#source = source;
		this.pret = false;
		this.choix = await this.#lireChoix();
		if (this.choix === null) {
			const cle = `apsud-suivi:consentement-affichages:${utilisateur}`;
			const vus = Number(lire(cle) ?? '0');
			if (vus < AFFICHAGES_MAX) {
				ecrire(cle, String(vus + 1));
				this.demandeOuverte = true;
			}
		}
		this.pret = true;
		if (this.actif) this.#lancer();
	}

	/** Ouvre de nouveau la demande (menu du compte), pour changer d'avis. */
	revoir() {
		this.demandeOuverte = true;
	}

	/** Enregistre le choix : sur le serveur en mode réel, sur l'appareil en démonstration. */
	async decider(consent: boolean) {
		this.demandeOuverte = false;
		this.choix = consent;
		if (this.#source === 'reel') {
			const { error } = await serveur().rpc('enregistrer_consentement', { p_analytique: consent });
			if (error) throw new Error(error.message);
		} else if (this.#utilisateur) ecrire(`apsud-suivi:consentement:${this.#utilisateur}`, consent ? 'oui' : 'non');
		if (consent) this.#lancer();
		else this.#arreter(false);
	}

	/** Fermer sans choisir : rien n'est mesuré ; la demande reviendra (3 fois au plus). */
	fermerSansChoisir() {
		this.demandeOuverte = false;
	}

	/** Page ouverte (appelée à chaque navigation). */
	page(chemin: string) {
		if (!this.actif) return;
		this.#finirPage();
		this.#pageCourante = chemin;
		this.#entreeLe = Date.now();
		this.#ajouter({ type: 'page', page: chemin });
	}

	/** Action métier nommée (ex. « rapport_soumis ») : à appeler depuis les écrans. */
	action(nom: string, donnees?: Mesure['donnees']) {
		if (this.actif) this.#ajouter({ type: 'action', page: this.#pageCourante ?? location.pathname, cible: nom.slice(0, 200), donnees });
	}

	async #lireChoix(): Promise<boolean | null> {
		if (this.#source === 'reel') {
			const { data } = await serveur().from('consentements').select('analytique').eq('utilisateur', this.#utilisateur!).maybeSingle();
			return data ? Boolean(data.analytique) : null;
		}
		const v = lire(`apsud-suivi:consentement:${this.#utilisateur}`);
		return v === 'oui' ? true : v === 'non' ? false : null;
	}

	#lancer() {
		if (!this.#session) this.#session = crypto.randomUUID();
		this.#ajouter({
			type: 'appareil',
			page: location.pathname,
			donnees: {
				largeur: window.innerWidth,
				hauteur: window.innerHeight,
				format: window.innerWidth < 640 ? 'telephone' : window.innerWidth < 1024 ? 'tablette' : 'ordinateur',
				langue: navigator.language,
				connexion: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null,
				ecran_accueil: window.matchMedia('(display-mode: standalone)').matches
			}
		});
		this.page(location.pathname);
		if (!this.#ecoute) {
			this.#ecoute = true;
			document.addEventListener('click', this.#surClic, { capture: true });
			document.addEventListener('visibilitychange', this.#surVisibilite);
			window.addEventListener('error', this.#surErreur);
		}
		clearInterval(this.#minuterie);
		this.#minuterie = setInterval(() => void this.#envoyer(), INTERVALLE);
	}

	#arreter(envoyerReste = true) {
		if (envoyerReste) void this.#envoyer();
		else this.#file = [];
		clearInterval(this.#minuterie);
		this.#pageCourante = null;
		if (this.#ecoute) {
			document.removeEventListener('click', this.#surClic, { capture: true });
			document.removeEventListener('visibilitychange', this.#surVisibilite);
			window.removeEventListener('error', this.#surErreur);
			this.#ecoute = false;
		}
	}

	#finirPage() {
		if (this.#pageCourante && this.#entreeLe) {
			this.#ajouter({ type: 'duree', page: this.#pageCourante, donnees: { secondes: Math.round((Date.now() - this.#entreeLe) / 1000) } });
		}
	}

	/** Bouton ou lien utilisé : son libellé visible (jamais un champ de saisie ni sa valeur). */
	#surClic = (e: MouseEvent) => {
		if (!this.actif) return;
		const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('button, a, [role="button"], summary, label');
		if (!el || el.closest('input, textarea, select, [contenteditable="true"]')) return;
		const libelle = (el.getAttribute('data-mesure') ?? el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/[●•]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
		if (!libelle) return;
		const href = el instanceof HTMLAnchorElement && el.origin === location.origin ? el.pathname : null;
		this.#ajouter({ type: 'clic', page: location.pathname, cible: libelle, donnees: { element: el.tagName.toLowerCase(), vers: href } });
	};

	#surVisibilite = () => {
		if (document.visibilityState === 'hidden') {
			this.#finirPage();
			this.#entreeLe = 0;
			void this.#envoyer();
		} else if (this.#pageCourante) this.#entreeLe = Date.now();
	};

	#surErreur = (e: ErrorEvent) => {
		this.#ajouter({ type: 'erreur', page: location.pathname, cible: String(e.message).slice(0, 160) });
	};

	#ajouter(m: Omit<Mesure, 'date'>) {
		this.#file.push({ ...m, date: new Date().toISOString() });
		if (this.#file.length >= 100) void this.#envoyer();
	}

	async #envoyer() {
		if (!this.#file.length) return;
		const lot = this.#file.splice(0, 100);
		if (this.#source === 'demo') {
			let garde: Mesure[] = [];
			try {
				garde = JSON.parse(lire(CLE_DEMO) ?? '[]');
			} catch {
				garde = [];
			}
			ecrire(CLE_DEMO, JSON.stringify([...garde, ...lot].slice(-300)));
			return;
		}
		const { error } = await serveur().rpc('enregistrer_analytique', { p_session: this.#session, p_evenements: lot });
		// Réseau coupé : on garde le lot pour le prochain envoi (500 au plus en attente).
		if (error) this.#file = [...lot, ...this.#file].slice(-500);
	}

	/** Démonstration : les mesures gardées dans ce navigateur (Administration › Utilisation). */
	mesuresDemo(): Mesure[] {
		try {
			return JSON.parse(lire(CLE_DEMO) ?? '[]');
		} catch {
			return [];
		}
	}
}

export const collecte = new Collecte();
