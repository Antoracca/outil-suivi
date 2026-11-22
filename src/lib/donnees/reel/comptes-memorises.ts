/**
 * Connexion rapide : comptes déjà utilisés SUR CET APPAREIL.
 *
 * La page de connexion ne peut pas afficher publiquement l'adresse e-mail d'une ONG
 * (n'importe qui pourrait lire les adresses des membres). On retient donc, après une
 * connexion réussie et si la personne l'accepte, son adresse, son nom et son
 * organisation, jamais le mot de passe. La fois suivante, toucher le logo de son ONG
 * suffit : seul le mot de passe est demandé.
 */
const CLE = 'apsud-suivi:comptes-memorises';
const MAXIMUM = 8;

export interface CompteMemorise {
	email: string;
	nom: string;
	organisation: string;
	role: string;
}

const valide = (c: unknown): c is CompteMemorise =>
	!!c && typeof c === 'object' && ['email', 'nom', 'organisation', 'role'].every((k) => typeof (c as Record<string, unknown>)[k] === 'string');

export function lireComptes(): CompteMemorise[] {
	try {
		const liste = JSON.parse(localStorage.getItem(CLE) ?? '[]');
		return Array.isArray(liste) ? liste.filter(valide) : [];
	} catch {
		return [];
	}
}

function ecrire(liste: CompteMemorise[]) {
	try {
		localStorage.setItem(CLE, JSON.stringify(liste.slice(0, MAXIMUM)));
	} catch {
		/* stockage indisponible (navigation privée) : pas de connexion rapide, rien de cassé */
	}
}

/** Retient (ou remonte en tête) un compte après une connexion réussie. */
export function memoriserCompte(c: CompteMemorise): CompteMemorise[] {
	const liste = [{ ...c, email: c.email.trim().toLowerCase() }, ...lireComptes().filter((x) => x.email !== c.email.trim().toLowerCase())];
	ecrire(liste);
	return lireComptes();
}

export function oublierCompte(email: string): CompteMemorise[] {
	ecrire(lireComptes().filter((x) => x.email !== email));
	return lireComptes();
}
