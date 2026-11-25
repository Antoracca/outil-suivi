/**
 * Règles d'accès et de circuit. Fonctions pures, testables, et miroir exact des
 * règles que la base de données appliquera plus tard (ARCHITECTURE.md §5 et §6).
 * L'interface ne fait que les afficher ; le dépôt refuse toute action interdite.
 */
import type { EtatDepot, Rapport, Role, StatutRapport, Utilisateur, Volet } from './types';

export class ErreurRegle extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ErreurRegle';
	}
}

export const LIBELLES_ROLE: Record<Role, string> = {
	super_admin: 'Super-administrateur',
	coordination: 'Coordination APSUD',
	saisie: 'Saisie (ONG)'
};

export const DESCRIPTION_ROLE: Record<Role, string> = {
	super_admin: 'Tout faire : comptes, nouvelles ONG, archives et suppression définitive.',
	coordination: 'Piloter le consortium : contrôler, valider ou renvoyer les rapports, suivi-évaluation, saisie sur tous les volets. Ne supprime rien.',
	saisie: 'Ajouter et mettre à jour les données de son ONG, soumettre ses rapports, consulter tout le consortium.'
};

export const LIBELLES_STATUT: Record<StatutRapport, string> = {
	non_commence: 'Non commencé',
	brouillon: 'Brouillon',
	soumis: 'Soumis',
	a_corriger: 'À corriger',
	valide: 'Validé par APSUD',
	verrouille: 'Verrouillé'
};

const estCoordination = (u: Utilisateur) => u.role === 'coordination' || u.role === 'super_admin';

/** Peut écrire dans ce volet (indépendamment du statut du mois). */
export function peutEcrireVolet(u: Utilisateur | null, volet: Volet): boolean {
	if (!u) return false;
	if (estCoordination(u)) return true;
	return u.role === 'saisie' && u.organisation === volet.organisation;
}

/** Peut modifier la structure (activités, tâches, indicateurs) du volet. */
export function peutModifierStructure(u: Utilisateur | null, volet: Volet): boolean {
	if (!u) return false;
	if (estCoordination(u)) return true;
	return peutEcrireVolet(u, volet) && !volet.cadre_verrouille;
}

/** Les données d'un mois ne se modifient que tant que le rapport n'est ni validé ni verrouillé. */
export function moisModifiable(rapport: Rapport | undefined): boolean {
	if (!rapport) return true;
	return ['non_commence', 'brouillon', 'a_corriger'].includes(rapport.statut);
}

export function peutSaisirMois(u: Utilisateur | null, volet: Volet, rapport: Rapport | undefined): boolean {
	return peutEcrireVolet(u, volet) && moisModifiable(rapport);
}

export function peutValider(u: Utilisateur | null): boolean {
	return !!u && estCoordination(u);
}

/** Seul le super-administrateur supprime définitivement. Tous les autres archivent. */
export function peutSupprimer(u: Utilisateur | null): boolean {
	return u?.role === 'super_admin';
}

export function peutArchiver(u: Utilisateur | null, volet: Volet): boolean {
	return peutEcrireVolet(u, volet);
}

export function peutVoirArchives(u: Utilisateur | null): boolean {
	return !!u && estCoordination(u);
}

/** Seul le super-administrateur fait entrer une nouvelle ONG (ou un nouveau volet) dans le consortium. */
export function peutAjouterOrganisation(u: Utilisateur | null): boolean {
	return u?.role === 'super_admin';
}

export function peutAdministrer(u: Utilisateur | null): boolean {
	return u?.role === 'super_admin';
}

export type Transition = { vers: StatutRapport; action: string; motifObligatoire?: boolean; principal?: boolean };

/** Transitions possibles d'un rapport pour cet utilisateur (ARCHITECTURE.md §6). */
export function transitionsPossibles(u: Utilisateur | null, volet: Volet, rapport: Rapport): Transition[] {
	if (!u) return [];
	const t: Transition[] = [];
	const ecrit = peutEcrireVolet(u, volet);
	switch (rapport.statut) {
		case 'non_commence':
		case 'brouillon':
		case 'a_corriger':
			if (ecrit) t.push({ vers: 'soumis', action: 'Soumettre à APSUD', principal: true });
			break;
		case 'soumis':
			if (peutValider(u)) {
				t.push({ vers: 'valide', action: 'Valider', principal: true });
				t.push({ vers: 'a_corriger', action: 'Renvoyer pour correction', motifObligatoire: true });
			}
			break;
		case 'valide':
			if (peutValider(u)) {
				t.push({ vers: 'verrouille', action: 'Verrouiller' });
				t.push({ vers: 'a_corriger', action: 'Rouvrir pour correction', motifObligatoire: true });
			}
			break;
		case 'verrouille':
			if (peutValider(u)) t.push({ vers: 'valide', action: 'Déverrouiller', motifObligatoire: true });
			break;
	}
	return t;
}

export function verifierTransition(u: Utilisateur | null, volet: Volet, rapport: Rapport, vers: StatutRapport, motif: string | null) {
	const t = transitionsPossibles(u, volet, rapport).find((x) => x.vers === vers);
	if (!t) throw new ErreurRegle(`Action impossible : un rapport « ${LIBELLES_STATUT[rapport.statut]} » ne peut pas passer à « ${LIBELLES_STATUT[vers]} » avec votre rôle.`);
	if (t.motifObligatoire && !motif?.trim()) throw new ErreurRegle('Indiquez le motif : il sera visible par l’ONG et inscrit au journal.');
}

/** Destinataires d'une notification : coordination, super-admin et l'ONG du volet, sauf l'auteur. */
export function destinataires(etat: EtatDepot, auteurId: string, voletCode: string | null): string[] {
	const volet = etat.volets.find((v) => v.code === voletCode);
	return etat.utilisateurs
		.filter((u) => u.id !== auteurId)
		.filter((u) => estCoordination(u) || (volet && u.organisation === volet.organisation))
		.map((u) => u.id);
}

/* ---------- Justificatifs : documents seulement (demande d'APSUD du 2026-11-25) ---------- */

/** Formats proposés par le sélecteur de fichier : documents, aucune photo. */
export const FORMATS_JUSTIFICATIF = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.csv,.txt,.zip,application/pdf';

/** Une photo (refusée comme justificatif ; à regrouper dans un PDF). Même règle en SQL (migration 0012). */
export function estPhoto(nom: string, type: string): boolean {
	return type.toLowerCase().startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|svg)$/i.test(nom.trim());
}

/* ---------- Adresses e-mail (invitations, connexion, inscription) ---------- */

/**
 * Forme enregistrée d'une adresse : sans espaces autour, en minuscules
 * (« Prenom.Nom@Yahoo.FR » et « prenom.nom@yahoo.fr » sont la même adresse).
 */
export function normaliserEmail(adresse: string): string {
	return adresse.trim().toLowerCase();
}

/**
 * Toute messagerie est acceptée : Gmail, Yahoo, Outlook, adresse d'une organisation…
 * Il faut un seul « @ », une partie avant sans espace (les alias « nom+suivi@… » passent),
 * un domaine fait de libellés séparés par des points, et une extension finale en lettres,
 * de 2 caractères au moins (.com, .org, .fr, .cf…). « nom@ong.90 » est refusée.
 * Même règle en SQL : public._email_valide (migration 0013).
 */
export function estEmailValide(adresse: string): boolean {
	return /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(normaliserEmail(adresse));
}

export const MESSAGE_EMAIL_INVALIDE = 'Adresse e-mail incomplète : il faut un « @ » et une extension en lettres, par exemple prenom.nom@gmail.com ou contact@ong.org.';

export const MESSAGE_PHOTO_REFUSEE = 'Les photos ne sont pas acceptées : joignez un document (PDF, Word, Excel…). Regroupez les photos dans un PDF si besoin.';
