/**
 * Graine de démonstration : l'état de départ de la maquette, tiré de structure.json
 * (les 5 fichiers Excel : volets, outcomes, outputs, activités, indicateurs et cibles).
 *
 * AUCUNE donnée fictive (consigne du développeur, 2026-11-25) : pas de rapport soumis ou
 * validé, pas de valeur, d'avancement, de dépense, de justificatif, de tâche, de ligne 5W,
 * de planification ni de notification inventés ; budgets à 0 comme en production (les
 * fichiers n'ont que des valeurs de remplissage). Seuls les comptes de démonstration sont
 * fictifs (intitulés de rôle, aucune personne réelle), pour pouvoir se connecter.
 * L'horloge est la vraie date du jour.
 */
import structure from './structure.json';
import type { Activite, Annonce, CodeVolet, EtatDepot, Indicateur, Outcome, Output, Rapport, Sigle, Utilisateur } from '../types';
import { CALENDRIER_FH } from '../calendrier';
import { SECTEURS_REFERENCE } from '../referentiels/secteurs';
import { ordonnerVolets } from '../ordre';

import { VERSION_SCHEMA } from '../version';
export { VERSION_SCHEMA };

/* ---------- Référentiels ---------- */
const organisations = [
	{ sigle: 'APSUD' as Sigle, nom: 'Action pour la Population et le Développement Durable', role_consortium: 'chef_de_file' as const, ville: 'Bimbo', logo_url: null },
	{ sigle: 'ARS' as Sigle, nom: 'African Relief Service', role_consortium: 'partenaire' as const, ville: null, logo_url: null },
	{ sigle: 'AFPE' as Sigle, nom: 'Association des Femmes pour la Promotion de l’Entrepreneuriat', role_consortium: 'partenaire' as const, ville: null, logo_url: null },
	{ sigle: 'GADY' as Sigle, nom: 'GADY, ONG nationale (nom développé à confirmer)', role_consortium: 'partenaire' as const, ville: null, logo_url: null },
	{ sigle: 'IDC' as Sigle, nom: 'Initiative Développement Centrafrique', role_consortium: 'partenaire' as const, ville: null, logo_url: null }
];

/** Secteurs : référentiel complet (les 5 du projet, puis les clusters humanitaires). */
const secteurs = SECTEURS_REFERENCE;

/** Comptes de la démonstration : intitulés de rôle, aucun nom de personne. */
export const utilisateursDemo: Utilisateur[] = [
	{ id: 'u-admin', nom: 'Super-administration APSUD', fonction: 'Tout faire : comptes, nouvelles ONG, suppressions', organisation: 'APSUD', role: 'super_admin', initiales: 'AD' },
	{ id: 'u-apsud-coord', nom: 'Coordination APSUD', fonction: 'Pilote, contrôle, valide, suivi-évaluation', organisation: 'APSUD', role: 'coordination', initiales: 'CO' },
	{ id: 'u-ars-nut', nom: 'Saisie ARS Nutrition', fonction: 'Volet nutrition', organisation: 'ARS', role: 'saisie', initiales: 'NU' },
	{ id: 'u-ars-san', nom: 'Saisie ARS Santé', fonction: 'Volet santé', organisation: 'ARS', role: 'saisie', initiales: 'SA' },
	{ id: 'u-afpe', nom: 'Saisie AFPE Protection', fonction: 'Volet protection de l’enfance et VBG', organisation: 'AFPE', role: 'saisie', initiales: 'PE' },
	{ id: 'u-gady', nom: 'Saisie GADY Sécurité alimentaire', fonction: 'Volet sécurité alimentaire', organisation: 'GADY', role: 'saisie', initiales: 'SC' },
	{ id: 'u-idc', nom: 'Saisie IDC WASH', fonction: 'Volet eau, hygiène et assainissement', organisation: 'IDC', role: 'saisie', initiales: 'WA' }
];

/**
 * Correspondance PROPOSÉE (à confirmer par IDC) entre les activités WASH du projet et
 * la nomenclature 5W du cluster (référentiel-5w.json), avec les lieux cités dans les outputs.
 */
const FICHES_5W_WASH: Record<string, { code: string; lieux: string[] }> = {
	'1.1.1': { code: "Eau|07. Rehabilitation d'un forage existant", lieux: ['Nanga Boguila', 'Paoua'] },
	'1.1.2': { code: 'Gouvernance & appui institutionnel|01. Renforcement des capacités institutionnelles (formation)', lieux: ['Paoua'] },
	'1.1.3': { code: 'Gouvernance & appui institutionnel|07. Enquêtes/Evaluations/missions de suivi des activités', lieux: ['Paoua'] },
	'1.1.4': { code: "Eau|29. Formation des comités de gestion des points d'eau", lieux: ['Nanga Boguila', 'Paoua'] },
	'1.2.1': { code: "Hygiène & changement de comportement|07. Distribution de kit d'hygiène menstruelle", lieux: ['Paoua', 'Nanga Boguila'] },
	'1.2.2': { code: "Hygiène & changement de comportement|03. Réalisation de séances de promotion de l'hygiène générale", lieux: ['Paoua', 'Nanga Boguila'] },
	'1.2.3': { code: "Hygiène & changement de comportement|06. Distribution de kit d'hygiène ménage", lieux: ['Paoua', 'Nanga Boguila'] },
	'1.3.1': { code: 'Assainissement|07. Construction de nouvelle latrine familiale (moins de 20 personnes par latrine)', lieux: ['Bossangoa'] }
};
type ActiviteBrute = (typeof structure.volets)[number]['outcomes'][number]['outputs'][number]['activites'][number];
type IndicateurBrut = ActiviteBrute['indicateurs'][number];

/** Date et heure locales du jour, au format des horodatages de l'état. */
function maintenantLocal(): string {
	const d = new Date();
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Annonces de l'arrivée des 5 organisations (mêmes textes que la migration 0016). */
function annoncesFondatrices(date: string): Annonce[] {
	const secteurDe = (code: string) => SECTEURS_REFERENCE.find((s) => s.code === code)?.libelle_court ?? code;
	return organisations.map((o) => {
		const volets = structure.volets.filter((v) => v.organisation === o.sigle).map((v) => secteurDe(v.secteur));
		const texte =
			o.role_consortium === 'chef_de_file'
				? `${o.sigle} (${o.nom}), chef de file du consortium, coordonne la plateforme de suivi : rapports, validation et consolidation pour le Fonds humanitaire.`
				: `${o.sigle} (${o.nom}) a rejoint le consortium, partenaire de mise en œuvre${volets.length ? ` : volet${volets.length > 1 ? 's' : ''} ${volets.join(' et ')}` : ''}.`;
		return {
			id: `arrivee-${o.sigle.toLowerCase()}`,
			titre: o.role_consortium === 'chef_de_file' ? 'Le consortium sur la plateforme' : 'Nouvelle ONG dans le consortium',
			texte,
			organisation: o.sigle,
			cree_le: date,
			archive_le: null
		};
	});
}

export function construireEtatDemo(): EtatDepot {
	const outcomes: Outcome[] = [];
	const outputs: Output[] = [];
	const activites: Activite[] = [];
	const indicateurs: Indicateur[] = [];
	const rapports: Rapport[] = [];

	const ajouterIndicateur = (b: IndicateurBrut, volet: CodeVolet, niveau: Indicateur['niveau'], parent: string) => {
		indicateurs.push({
			id: `${volet}:ind:${b.ordre}`,
			volet,
			niveau,
			parent_id: parent,
			ordre: b.ordre,
			code_cbpf: b.code_cbpf,
			libelle: b.libelle,
			type_valeur: b.type_valeur as Indicateur['type_valeur'],
			mode_cumul: b.mode_cumul as Indicateur['mode_cumul'],
			desagrege: b.desagrege,
			cible: b.cible,
			moyens_verification: b.moyens_verification,
			commentaire: b.commentaire ?? null,
			archive_le: null
		});
	};

	for (const v of structure.volets) {
		const volet = v.code as CodeVolet;
		for (const o of v.outcomes) {
			const outcomeId = `${volet}:oc:${o.numero}`;
			outcomes.push({ id: outcomeId, volet, numero: o.numero, libelle: o.libelle });
			o.indicateurs.forEach((i) => ajouterIndicateur(i, volet, 'outcome', outcomeId));
			for (const s of o.outputs) {
				const outputId = `${volet}:op:${s.numero}`;
				outputs.push({ id: outputId, volet, outcome_id: outcomeId, numero: s.numero, libelle: s.libelle });
				s.indicateurs.forEach((i) => ajouterIndicateur(i, volet, 'output', outputId));
				s.activites.forEach((a: ActiviteBrute) => {
					const activiteId = `${volet}:act:${a.numero}`;
					activites.push({
						id: activiteId,
						volet,
						output_id: outputId,
						numero: a.numero,
						libelle: a.libelle,
						responsable: a.responsable ?? null,
						budget_planifie: 0,
						archive_le: null,
						cree_par: null,
						fiche_5w:
							volet === 'WASH-IDC' && FICHES_5W_WASH[a.numero]
								? { activite_cluster: FICHES_5W_WASH[a.numero].code, modalite: 'Implementation directe', type_beneficiaire: 'Retournés', reponse: 'Conflit', partenaires: null }
								: null
					});
					a.indicateurs.forEach((i) => ajouterIndicateur(i, volet, 'activite', activiteId));
				});
			}
		}
		// Un rapport par mois, non commencé : rien n'a encore été saisi.
		for (const mois of structure.projet.mois) {
			rapports.push({ id: `${volet}:${mois}`, volet, mois, statut: 'non_commence', soumis_par: null, soumis_le: null, decision_par: null, decision_le: null, motif: null });
		}
	}

	return {
		version_schema: VERSION_SCHEMA,
		aujourdhui: maintenantLocal(),
		organisations,
		utilisateurs: utilisateursDemo,
		secteurs,
		projet: { ...structure.projet, echeances: CALENDRIER_FH },
		volets: ordonnerVolets(
			structure.volets.map((v) => ({
				code: v.code as CodeVolet,
				organisation: v.organisation as Sigle,
				secteur: v.secteur as EtatDepot['volets'][number]['secteur'],
				cadre_verrouille: false
			}))
		),
		outcomes,
		outputs,
		activites,
		taches: [],
		indicateurs,
		valeurs: [],
		avancements: [],
		depenses: [],
		justificatifs: [],
		lignes_5w: [],
		planifications: [],
		rapports,
		journal: [],
		notifications: [],
		annonces: annoncesFondatrices(maintenantLocal()),
		annonces_lues: []
	};
}
