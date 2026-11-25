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

/** Résultat de l'analyse en temps réel d'une adresse en cours de saisie. */
export interface AnalyseEmail {
	/**
	 * vide : rien de saisi ; en_cours : incomplète mais sans faute ; erreur : faute à corriger ;
	 * attention : forme valide mais faute de frappe probable (gmial.com) ; valide.
	 */
	etat: 'vide' | 'en_cours' | 'erreur' | 'attention' | 'valide';
	message: string;
	/** Adresse corrigée proposée (« Vouliez-vous dire … ? »), quand une correction sûre existe. */
	suggestion?: string;
}

/** Fautes de frappe fréquentes sur les grandes messageries. */
const DOMAINES_CORRIGES: Record<string, string> = {
	'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com',
	'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.fr': 'gmail.com', 'gmail': 'gmail.com',
	'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com', 'yaho.fr': 'yahoo.fr', 'yahou.fr': 'yahoo.fr', 'yahoo': 'yahoo.fr',
	'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail': 'hotmail.com',
	'outlok.com': 'outlook.com', 'outllok.com': 'outlook.com', 'outlook.co': 'outlook.com', 'outlook': 'outlook.com', 'icloud.co': 'icloud.com'
};
/** Extensions mal tapées. */
const EXTENSIONS_CORRIGEES: Record<string, string> = { con: 'com', cmo: 'com', cpm: 'com', vom: 'com', xom: 'com', ocm: 'com', ogr: 'org', orh: 'org', rg: 'org', fe: 'fr' };

/**
 * Analyse une adresse pendant la saisie et explique la faute : espace, virgule à la place
 * d'un point, « @ » absent ou en double, point mal placé, extension en chiffres, faute de
 * frappe sur un domaine connu. Toujours cohérente avec estEmailValide.
 */
export function analyserEmail(saisie: string): AnalyseEmail {
	const brut = saisie.trim();
	if (!brut) return { etat: 'vide', message: '' };
	const corrigeEspaces = brut.replace(/\s+/g, '');
	if (/\s/.test(brut)) return { etat: 'erreur', message: 'Une adresse ne contient pas d’espace.', suggestion: proposer(corrigeEspaces) };
	if (/[,;]/.test(brut)) return { etat: 'erreur', message: 'Une virgule ou un point-virgule s’est glissé : c’est un point qu’il faut.', suggestion: proposer(brut.replace(/[,;]/g, '.')) };
	const arobases = (brut.match(/@/g) ?? []).length;
	if (arobases === 0) return { etat: 'en_cours', message: 'Il manque le « @ » (ex. prenom.nom@gmail.com).' };
	if (arobases > 1) return { etat: 'erreur', message: 'Une adresse ne contient qu’un seul « @ ».' };
	const [local, domaineBrut] = brut.split('@');
	const domaine = domaineBrut.toLowerCase();
	if (!local) return { etat: 'erreur', message: 'Écrivez le nom avant le « @ ».' };
	if (/[()<>[\]\\"]/.test(local)) return { etat: 'erreur', message: 'Caractère non autorisé avant le « @ ».' };
	if (!domaine) return { etat: 'en_cours', message: 'Ajoutez le domaine après le « @ » (gmail.com, yahoo.fr, ong.org…).' };
	if (DOMAINES_CORRIGES[domaine]) {
		const suggestion = `${local}@${DOMAINES_CORRIGES[domaine]}`;
		if (!domaine.includes('.')) return { etat: 'en_cours', message: 'Ajoutez l’extension après le domaine.', suggestion };
		return { etat: estEmailValide(brut) ? 'attention' : 'erreur', message: `Faute de frappe probable dans « ${domaine} ».`, suggestion };
	}
	if (/[^a-z0-9.-]/.test(domaine)) return { etat: 'erreur', message: 'Le domaine ne contient que des lettres, des chiffres, des points et des tirets.' };
	if (domaine.includes('..') || domaine.startsWith('.') || domaine.startsWith('-')) {
		return { etat: 'erreur', message: 'Point en double ou mal placé après le « @ ».', suggestion: proposer(`${local}@${domaine.replace(/\.{2,}/g, '.').replace(/^[.-]+/, '')}`) };
	}
	if (!domaine.includes('.')) return { etat: 'en_cours', message: 'Ajoutez l’extension après le domaine : .com, .org, .fr…' };
	if (domaine.endsWith('.')) return { etat: 'en_cours', message: 'Ajoutez l’extension après le point : com, org, fr…' };
	const extension = domaine.split('.').pop()!;
	if (EXTENSIONS_CORRIGEES[extension]) {
		return { etat: 'attention', message: `L’extension « .${extension} » semble mal tapée.`, suggestion: `${local}@${domaine.slice(0, -extension.length)}${EXTENSIONS_CORRIGEES[extension]}` };
	}
	if (/[0-9]/.test(extension)) return { etat: 'erreur', message: `L’extension « .${extension} » doit être en lettres (.com, .org, .fr…).` };
	if (extension.length < 2) return { etat: 'en_cours', message: 'L’extension compte au moins 2 lettres (.fr, .cf, .com…).' };
	if (!estEmailValide(brut)) return { etat: 'erreur', message: MESSAGE_EMAIL_INVALIDE };
	if (brut !== brut.toLowerCase()) return { etat: 'valide', message: `Adresse valide, enregistrée en minuscules : ${normaliserEmail(brut)}` };
	return { etat: 'valide', message: 'Adresse valide.' };
}

/** Propose une correction seulement si elle donne une adresse valide (ou corrige encore un domaine connu). */
function proposer(candidat: string): string | undefined {
	const a = analyserEmail(candidat);
	if (a.etat === 'valide') return candidat;
	return a.suggestion;
}

export const MESSAGE_EMAIL_INVALIDE ='Adresse e-mail incomplète : il faut un « @ » et une extension en lettres, par exemple prenom.nom@gmail.com ou contact@ong.org.';

export const MESSAGE_PHOTO_REFUSEE = 'Les photos ne sont pas acceptées : joignez un document (PDF, Word, Excel…). Regroupez les photos dans un PDF si besoin.';
