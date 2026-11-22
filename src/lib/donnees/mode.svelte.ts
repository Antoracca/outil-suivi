/**
 * Mode d'accès : démonstration (comptes fictifs, données simulées) ou réel
 * (connexion par e-mail et mot de passe, comptes sur invitation).
 * Le choix est mémorisé sur l'appareil. Le dépôt (depot.svelte.ts) en suit la valeur :
 * données simulées en démonstration, serveur Supabase en mode réel. La démonstration
 * reste disponible en permanence, même quand le serveur réel est en service.
 */
import { browser } from '$app/env';

const CLE = 'apsud-suivi:mode-demo';

function lire(): boolean {
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
		this.demo = actif;
		try {
			localStorage.setItem(CLE, actif ? 'oui' : 'non');
		} catch {
			/* stockage indisponible (navigation privée) : le choix vaut pour la session */
		}
	}
}

export const mode = new Mode();
