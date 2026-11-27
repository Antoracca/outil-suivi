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
 * Proposé partout par défaut, production comprise (consigne du développeur, 2026-11-27) ;
 * `VITE_MODE_DEMO=non` le coupe (le module des données de démonstration n'est alors jamais
 * téléchargé). En production, l'arrivée se fait en mode réel tant que la personne n'a pas
 * choisi la démonstration ; en développement, en démonstration.
 */
const reglage = (import.meta.env.VITE_MODE_DEMO as string | undefined)?.trim().toLowerCase();
export const DEMO_DISPONIBLE: boolean = reglage !== 'non';

function lire(): boolean {
	if (!DEMO_DISPONIBLE) return false;
	const parDefaut = import.meta.env.DEV;
	if (!browser) return parDefaut;
	try {
		const choix = localStorage.getItem(CLE);
		return choix === null ? parDefaut : choix === 'oui';
	} catch {
		return parDefaut;
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
