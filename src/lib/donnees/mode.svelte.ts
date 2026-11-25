/**
 * Mode d'accès : démonstration (comptes fictifs, données simulées) ou réel
 * (connexion par e-mail et mot de passe, comptes sur invitation).
 * Le choix est mémorisé sur l'appareil. Le dépôt (depot.svelte.ts) en suit la valeur :
 * données simulées en démonstration, serveur Supabase en mode réel. La démonstration
 * reste disponible en permanence, même quand le serveur réel est en service.
 */
import { browser } from '$app/env';

const CLE = 'apsud-suivi:mode-demo';

/**
 * Le mode démonstration est-il proposé dans cette version construite ?
 * `VITE_MODE_DEMO=oui` l'active, `non` le coupe ; sans valeur : actif en développement
 * (`npm run dev`), coupé en production. La vraie plateforme n'a donc rien à régler ;
 * une adresse de démonstration (second projet Vercel) met `VITE_MODE_DEMO=oui`.
 * Coupé, le module des données de démonstration n'est jamais téléchargé.
 */
const reglage = (import.meta.env.VITE_MODE_DEMO as string | undefined)?.trim().toLowerCase();
export const DEMO_DISPONIBLE: boolean = reglage === 'oui' ? true : reglage === 'non' ? false : import.meta.env.DEV;

function lire(): boolean {
	if (!DEMO_DISPONIBLE) return false;
	if (!browser) return true;
	try {
		return localStorage.getItem(CLE) !== 'non';
	} catch {
		return true;
	}
}

class Mode {
	demo = $state(lire());

	basculer(actif: boolean) {
		if (actif && !DEMO_DISPONIBLE) return;
		this.demo = actif;
		try {
			localStorage.setItem(CLE, actif ? 'oui' : 'non');
		} catch {
			/* stockage indisponible (navigation privée) : le choix vaut pour la session */
		}
	}
}

export const mode = new Mode();
