import type { EcheanceRapport } from './calendrier';
import type { RoleConsortium } from './referentiels/secteurs';
/**
 * Types métier de la plateforme. Ils reflètent le modèle de docs/ARCHITECTURE.md §4.
 * En phase « maquette », ils sont servis par le dépôt simulé (depot.svelte.ts) ;
 * plus tard, par le back-end, sans changer les écrans.
 */

/** Sigle d'organisation : les 5 du projet FH (APSUD, ARS, AFPE, GADY, IDC), puis celles ajoutées par le super-administrateur. */
export type Sigle = string;
/** Code de secteur : les 5 d'origine (WASH, NUT, SAN, PE, SECAL), ceux du référentiel et ceux ajoutés (« Autre »). */
export type CodeSecteur = string;
/** Code de volet « SECTEUR-SIGLE » : NUT-ARS, SAN-ARS, PE-AFPE, SECAL-GADY, WASH-IDC, puis les volets ajoutés. */
export type CodeVolet = string;
/** Trois rôles : super-administrateur et coordination (APSUD), saisie (chaque ONG). */
export type Role = 'super_admin' | 'coordination' | 'saisie';
export type Mois = string; // « 2026-11 »

export type StatutRapport = 'non_commence' | 'brouillon' | 'soumis' | 'a_corriger' | 'valide' | 'verrouille';

export interface Organisation {
	sigle: Sigle;
	nom: string;
	role_consortium: RoleConsortium;
	ville: string | null;
	/** Logo déposé par le super-administrateur (bucket public « logos ») ; sinon le fichier fourni ou le sigle. */
	logo_url?: string | null;
}

export interface Utilisateur {
	id: string;
	nom: string;
	fonction: string;
	organisation: Sigle;
	role: Role;
	initiales: string;
}

export interface Secteur {
	code: CodeSecteur;
	libelle: string;
	libelle_court: string;
	cluster_cbpf: string;
	/** Mots-clés de recherche (« faim », « eau », « nourriture »…). */
	mots_cles: string[];
}

export interface Projet {
	code_cbpf: string;
	intitule: string;
	bailleur: string;
	date_debut: string;
	date_fin: string;
	devise: string;
	zones: string[];
	objectif_general: string;
	mois: Mois[];
	/** Calendrier officiel de soumission (un rapport par mois), depuis la table periodes. */
	echeances: EcheanceRapport[];
}

export interface Volet {
	code: CodeVolet;
	organisation: Sigle;
	secteur: CodeSecteur;
	cadre_verrouille: boolean;
}

export interface Outcome {
	id: string;
	volet: CodeVolet;
	numero: string;
	libelle: string;
}

export interface Output {
	id: string;
	volet: CodeVolet;
	outcome_id: string;
	numero: string;
	libelle: string;
}

export interface Activite {
	id: string;
	volet: CodeVolet;
	output_id: string;
	numero: string;
	libelle: string;
	responsable: string | null;
	budget_planifie: number;
	archive_le: string | null;
	cree_par: string | null;
	/** Fiche 5W du cluster (volet WASH) : remplie une fois, reprise dans chaque export. */
	fiche_5w?: Fiche5W | null;
}

/** Correspondance d'une activité du projet avec la nomenclature 5W du cluster WASH (EHA). */
export interface Fiche5W {
	/** Code « Sous-cluster|Activité standard », ex. « Eau|07. Rehabilitation d'un forage existant ». */
	activite_cluster: string;
	modalite: string;
	type_beneficiaire: string;
	reponse: string;
	partenaires: string | null;
}

/** Une ligne du 5W : une activité, un lieu (sous-préfecture), un mois. */
export interface Ligne5W {
	id: string;
	volet: CodeVolet;
	activite_id: string;
	mois: Mois;
	prefecture: string;
	sous_prefecture: string;
	commune: string | null;
	village: string | null;
	latitude: number | null;
	longitude: number | null;
	quantite_prevue: number | null;
	quantite_realisee: number | null;
	personnes_ciblees: number | null;
	filles: number | null;
	garcons: number | null;
	femmes: number | null;
	hommes: number | null;
	date_debut: string | null;
	date_fin: string | null;
	statut: string;
	commentaire: string | null;
	auteur: string;
	date: string;
	archive_le: string | null;
}

export interface SemaineTache {
	mois: Mois;
	semaine: 1 | 2 | 3 | 4 | 5;
	prevu: boolean;
	realise: boolean;
}

export interface Tache {
	id: string;
	volet: CodeVolet;
	activite_id: string;
	libelle: string;
	responsable: string | null;
	date_debut: string | null;
	date_fin: string | null;
	semaines: SemaineTache[];
	archive_le: string | null;
}

export type Niveau = 'outcome' | 'output' | 'activite';

export interface Desagregation {
	femmes: number | null;
	filles: number | null;
	hommes: number | null;
	garcons: number | null;
	total: number | null;
}

export interface Indicateur {
	id: string;
	volet: CodeVolet;
	niveau: Niveau;
	parent_id: string;
	ordre: number;
	code_cbpf: string | null;
	libelle: string;
	type_valeur: 'nombre' | 'pourcentage';
	mode_cumul: 'somme' | 'derniere_valeur';
	desagrege: boolean;
	cible: Desagregation;
	moyens_verification: string[];
	commentaire: string | null;
	archive_le: string | null;
}

/** Réalisé du mois pour un indicateur. Versionné : jamais écrasé (ARCHITECTURE.md §4.6). */
export interface ValeurIndicateur {
	id: string;
	indicateur_id: string;
	volet: CodeVolet;
	mois: Mois;
	valeurs: Desagregation;
	commentaire: string | null;
	version: number;
	courante: boolean;
	auteur: string;
	date: string;
}

export interface AvancementActivite {
	id: string;
	activite_id: string;
	volet: CodeVolet;
	mois: Mois;
	taux_execution: number | null; // 0 à 100
	resultats: string;
	observations: string;
	version: number;
	courante: boolean;
	auteur: string;
	date: string;
}

/**
 * Planification du mois suivant (cahier des charges APSUD, §3.4) : une ligne par activité
 * et par mois, écrite à chaque validation de l'onglet « Activités planifiées ».
 */
export interface Planification {
	/** « <activité>:<mois> ». */
	id: string;
	activite_id: string;
	volet: CodeVolet;
	mois: Mois;
	prevue: boolean;
	valide_par: string;
	valide_le: string;
}

export interface Depense {
	id: string;
	activite_id: string;
	volet: CodeVolet;
	mois: Mois;
	montant: number;
	libelle: string;
	auteur: string;
	date: string;
	archive_le: string | null;
}

export interface Justificatif {
	id: string;
	volet: CodeVolet;
	mois: Mois;
	rattachement: { type: 'indicateur' | 'activite' | 'rapport' | 'depense'; id: string };
	nom_fichier: string;
	type_mime: string;
	taille: number;
	moyen_verification: string | null;
	/** Mode réel : chemin du fichier dans le stockage privé (absent en démonstration). */
	chemin_stockage?: string | null;
	auteur: string;
	date: string;
	archive_le: string | null;
}

export interface Rapport {
	id: string;
	volet: CodeVolet;
	mois: Mois;
	statut: StatutRapport;
	soumis_par: string | null;
	soumis_le: string | null;
	decision_par: string | null;
	decision_le: string | null;
	motif: string | null;
}

export type TypeEvenement =
	| 'valeur_modifiee'
	| 'avancement_modifie'
	| 'rapport_soumis'
	| 'rapport_valide'
	| 'rapport_a_corriger'
	| 'rapport_verrouille'
	| 'rapport_deverrouille'
	| 'activite_creee'
	| 'tache_creee'
	| 'tache_modifiee'
	| 'semaine_cochee'
	| 'depense_ajoutee'
	| 'justificatif_ajoute'
	| 'fiche_5w_modifiee'
	| 'ligne_5w_ajoutee'
	| 'ligne_5w_modifiee'
	| 'element_archive'
	| 'element_restaure'
	| 'element_supprime'
	| 'cadre_verrouille'
	| 'cadre_deverrouille'
	| 'volet_cree'
	| 'planification_validee'
	| 'secteur_cree'
	| 'organisation_modifiee';

/** Journal d'audit : en ajout seul. */
export interface Evenement {
	id: string;
	date: string;
	type: TypeEvenement;
	auteur: string;
	organisation: Sigle;
	volet: CodeVolet | null;
	mois: Mois | null;
	cible: { type: string; id: string; libelle: string };
	resume: string;
	avant: unknown;
	apres: unknown;
}

export interface Notification {
	id: string;
	evenement_id: string;
	destinataire: string;
	lue: boolean;
}

/** Annonce destinée à tous les comptes, même créés plus tard (ex. : arrivée d'une ONG). */
export interface Annonce {
	id: string;
	titre: string;
	texte: string;
	organisation: Sigle | null;
	cree_le: string;
	archive_le: string | null;
}

/** Lecture d'une annonce par un compte (une fois pour toutes). */
export interface AnnonceLue {
	id: string;
	annonce_id: string;
	utilisateur: string;
	lue_le: string;
}

export interface EtatDepot {
	version_schema: number;
	aujourdhui: string;
	organisations: Organisation[];
	utilisateurs: Utilisateur[];
	secteurs: Secteur[];
	projet: Projet;
	volets: Volet[];
	outcomes: Outcome[];
	outputs: Output[];
	activites: Activite[];
	taches: Tache[];
	indicateurs: Indicateur[];
	valeurs: ValeurIndicateur[];
	avancements: AvancementActivite[];
	depenses: Depense[];
	justificatifs: Justificatif[];
	lignes_5w: Ligne5W[];
	planifications: Planification[];
	annonces: Annonce[];
	annonces_lues: AnnonceLue[];
	rapports: Rapport[];
	journal: Evenement[];
	notifications: Notification[];
}
