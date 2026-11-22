/**
 * Graine de démonstration : construit l'état complet de la maquette à partir de
 * structure.json (tiré des 5 fichiers Excel), puis ajoute des données FICTIVES
 * plausibles pour montrer l'outil « en vie » au 12 janvier 2027 :
 *   - utilisateurs fictifs (aucune personne réelle) ;
 *   - budgets par activité (les fichiers n'ont que des valeurs de remplissage à 100) ;
 *   - réalisations de novembre, décembre et début janvier ;
 *   - tâches de démonstration pour les activités qui n'en ont pas ;
 *   - statuts de rapports variés pour montrer tout le circuit.
 * Tout est déterministe (même résultat à chaque chargement).
 */
import structure from './structure.json';
import type {
	Activite,
	AvancementActivite,
	CodeVolet,
	Depense,
	Desagregation,
	EtatDepot,
	Evenement,
	Indicateur,
	Justificatif,
	Ligne5W,
	Mois,
	Notification,
	Outcome,
	Output,
	Rapport,
	SemaineTache,
	Sigle,
	StatutRapport,
	Tache,
	Utilisateur,
	ValeurIndicateur
} from '../types';

export const VERSION_SCHEMA = 8;
export const AUJOURDHUI_DEMO = '2027-01-12T09:30:00';

/* ---------- Hasard déterministe ---------- */
function hash(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0) / 4294967295;
}
const entre = (cle: string, min: number, max: number) => min + hash(cle) * (max - min);
const arrondi = (n: number, pas: number) => Math.round(n / pas) * pas;

/* ---------- Référentiels ---------- */
const organisations = [
	{ sigle: 'APSUD' as Sigle, nom: 'Action pour la Population et le Développement Durable', role_consortium: 'chef_de_file' as const, ville: 'Bimbo' },
	{ sigle: 'ARS' as Sigle, nom: 'African Relief Service', role_consortium: 'partenaire' as const, ville: null },
	{ sigle: 'AFPE' as Sigle, nom: 'Association des Femmes pour la Promotion de l’Entrepreneuriat', role_consortium: 'partenaire' as const, ville: null },
	{ sigle: 'GADY' as Sigle, nom: 'GADY, ONG nationale (nom développé à confirmer)', role_consortium: 'partenaire' as const, ville: null },
	{ sigle: 'IDC' as Sigle, nom: 'Initiative Développement Centrafrique', role_consortium: 'partenaire' as const, ville: null }
];

const secteurs = [
	{ code: 'WASH' as const, libelle: 'Eau, hygiène et assainissement', libelle_court: 'WASH', cluster_cbpf: 'WSH' },
	{ code: 'NUT' as const, libelle: 'Nutrition', libelle_court: 'Nutrition', cluster_cbpf: 'NUT' },
	{ code: 'SAN' as const, libelle: 'Santé', libelle_court: 'Santé', cluster_cbpf: 'HEA' },
	{ code: 'PE' as const, libelle: 'Protection de l’enfance et VBG', libelle_court: 'Protection', cluster_cbpf: 'PRO' },
	{ code: 'SECAL' as const, libelle: 'Sécurité alimentaire', libelle_court: 'Sécurité alimentaire', cluster_cbpf: 'FSA' }
];

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

const saisieParVolet: Record<CodeVolet, string> = {
	'NUT-ARS': 'u-ars-nut',
	'SAN-ARS': 'u-ars-san',
	'PE-AFPE': 'u-afpe',
	'SECAL-GADY': 'u-gady',
	'WASH-IDC': 'u-idc'
};

/** Statuts de démonstration : tout le circuit est visible. */
const STATUTS_DEMO: Record<CodeVolet, Partial<Record<Mois, StatutRapport>>> = {
	'NUT-ARS': { '2026-11': 'verrouille', '2026-12': 'soumis', '2027-01': 'brouillon' },
	'SAN-ARS': { '2026-11': 'valide', '2026-12': 'valide', '2027-01': 'brouillon' },
	'PE-AFPE': { '2026-11': 'valide', '2026-12': 'a_corriger' },
	'SECAL-GADY': { '2026-11': 'valide', '2026-12': 'soumis' },
	'WASH-IDC': { '2026-11': 'valide', '2026-12': 'brouillon' }
};

/** Part de la cible réalisée chaque mois (avant aléa). */
const PART_MOIS: Record<Mois, [number, number]> = {
	'2026-11': [0.05, 0.1],
	'2026-12': [0.09, 0.15],
	'2027-01': [0.02, 0.05]
};

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
const PREFECTURE: Record<string, string> = { 'Nanga Boguila': 'Ouham', Bossangoa: 'Ouham', Paoua: 'Ouham-Pendé' };

const LIBELLES_DEPENSES = ['Frais de transport', 'Achat de kits', 'Perdiems des formateurs', 'Location de salle', 'Achat de matériel', 'Frais de communication', 'Prestation de service'];
const TACHES_DEMO = ['Préparation et ciblage', 'Mise en œuvre sur le terrain', 'Suivi, rapport et redevabilité'];

type ActiviteBrute = (typeof structure.volets)[number]['outcomes'][number]['outputs'][number]['activites'][number];
type IndicateurBrut = ActiviteBrute['indicateurs'][number];

const MOIS: Mois[] = structure.projet.mois;

function dateDuMois(mois: Mois, jour: number, heure = 10): string {
	return `${mois}-${String(jour).padStart(2, '0')}T${String(heure).padStart(2, '0')}:${String(Math.floor(entre(mois + jour, 0, 59))).padStart(2, '0')}:00`;
}
function moisSuivant(mois: Mois): Mois {
	const i = MOIS.indexOf(mois);
	return MOIS[i + 1] ?? mois;
}

function semainesPlanifiees(cle: string, debut: number, longueur: number): SemaineTache[] {
	const s: SemaineTache[] = [];
	for (let k = 0; k < longueur; k++) {
		const index = debut + k;
		const mois = MOIS[Math.floor(index / 4)];
		if (!mois) break;
		const semaine = ((index % 4) + 1) as 1 | 2 | 3 | 4;
		s.push({ mois, semaine, prevu: true, realise: false });
	}
	return s.length ? s : [{ mois: MOIS[0], semaine: 2, prevu: true, realise: false }];
}

/** Coche « réalisé » les semaines prévues passées (avant le 12 janvier 2027). */
function marquerRealise(semaines: SemaineTache[], cle: string): SemaineTache[] {
	return semaines.map((s) => {
		const passe = s.mois < '2027-01' || (s.mois === '2027-01' && s.semaine <= 1);
		return { ...s, realise: s.prevu && passe && hash(cle + s.mois + s.semaine) > 0.12 };
	});
}

function repartir(cible: Desagregation, total: number): Desagregation {
	const parts = [cible.femmes ?? 0, cible.filles ?? 0, cible.hommes ?? 0, cible.garcons ?? 0];
	const somme = parts.reduce((a, b) => a + b, 0);
	if (!somme) return { femmes: null, filles: null, hommes: null, garcons: null, total };
	const v = parts.map((p) => Math.round((p / somme) * total));
	return { femmes: v[0], filles: v[1], hommes: v[2], garcons: v[3], total: v[0] + v[1] + v[2] + v[3] };
}

export function construireEtatDemo(): EtatDepot {
	const outcomes: Outcome[] = [];
	const outputs: Output[] = [];
	const activites: Activite[] = [];
	const taches: Tache[] = [];
	const indicateurs: Indicateur[] = [];
	const valeurs: ValeurIndicateur[] = [];
	const avancements: AvancementActivite[] = [];
	const depenses: Depense[] = [];
	const rapports: Rapport[] = [];
	const journal: Evenement[] = [];
	const lignes5w: Ligne5W[] = [];
	const justificatifs: Justificatif[] = [];

	const ajouterIndicateur = (b: IndicateurBrut, volet: CodeVolet, niveau: Indicateur['niveau'], parent: string) => {
		const id = `${volet}:ind:${b.ordre}`;
		indicateurs.push({
			id,
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
				s.activites.forEach((a: ActiviteBrute, rangActivite: number) => {
					const activiteId = `${volet}:act:${a.numero}`;
					const budget = arrondi(entre(activiteId + 'budget', 4000, 58000), 100);
					activites.push({
						id: activiteId,
						volet,
						output_id: outputId,
						numero: a.numero,
						libelle: a.libelle,
						responsable: a.responsable ?? null,
						budget_planifie: budget,
						archive_le: null,
						cree_par: null,
						fiche_5w:
							volet === 'WASH-IDC' && FICHES_5W_WASH[a.numero]
								? { activite_cluster: FICHES_5W_WASH[a.numero].code, modalite: 'Implementation directe', type_beneficiaire: 'Retournés', reponse: 'Conflit', partenaires: null }
								: null
					});
					a.indicateurs.forEach((i) => ajouterIndicateur(i, volet, 'activite', activiteId));

					// Tâches : celles du fichier (modèle), sinon des tâches de démonstration.
					const tachesFichier = a.taches ?? [];
					const debutBase = (rangActivite * 3) % 20;
					if (tachesFichier.length) {
						tachesFichier.forEach((t, k) => {
							const prevues = t.semaines.length
								? t.semaines.map((s) => ({ mois: s.mois, semaine: s.semaine as SemaineTache['semaine'], prevu: true, realise: false }))
								: semainesPlanifiees(activiteId + k, k, 1);
							taches.push({
								id: `${activiteId}:t:${k + 1}`,
								volet,
								activite_id: activiteId,
								libelle: t.libelle,
								responsable: a.responsable ?? null,
								date_debut: t.date_debut,
								date_fin: t.date_fin,
								semaines: marquerRealise(prevues, activiteId + k),
								archive_le: null
							});
						});
					} else {
						TACHES_DEMO.forEach((libelle, k) => {
							const debut = debutBase + k * 4 + Math.floor(entre(activiteId + k, 0, 3));
							const longueur = 2 + Math.floor(entre(activiteId + 'l' + k, 0, k === 1 ? 10 : 4));
							const semaines = marquerRealise(semainesPlanifiees(activiteId + k, debut, longueur), activiteId + k);
							const premier = semaines[0];
							const dernier = semaines[semaines.length - 1];
							taches.push({
								id: `${activiteId}:t:${k + 1}`,
								volet,
								activite_id: activiteId,
								libelle,
								responsable: null,
								date_debut: `${premier.mois}-${String((premier.semaine - 1) * 7 + 1).padStart(2, '0')}`,
								date_fin: `${dernier.mois}-${String(Math.min(dernier.semaine * 7, 28)).padStart(2, '0')}`,
								semaines,
								archive_le: null
							});
						});
					}
				});
			}
		}

		// Rapports, valeurs, avancements et dépenses par mois.
		const auteur = saisieParVolet[volet];
		for (const mois of MOIS) {
			const statut: StatutRapport = STATUTS_DEMO[volet][mois] ?? 'non_commence';
			const rapport: Rapport = {
				id: `${volet}:${mois}`,
				volet,
				mois,
				statut,
				soumis_par: null,
				soumis_le: null,
				decision_par: null,
				decision_le: null,
				motif: null
			};
			const suivant = moisSuivant(mois);
			if (['soumis', 'valide', 'verrouille', 'a_corriger'].includes(statut)) {
				rapport.soumis_par = auteur;
				rapport.soumis_le = dateDuMois(suivant, 3 + Math.floor(entre(volet + mois, 0, 4)), 15);
			}
			if (['valide', 'verrouille', 'a_corriger'].includes(statut)) {
				rapport.decision_par = 'u-apsud-coord';
				rapport.decision_le = dateDuMois(suivant, 7 + Math.floor(entre(volet + mois + 'd', 0, 3)), 11);
			}
			if (statut === 'a_corriger') {
				rapport.motif =
					'Le nombre d’enfants pris en charge dépasse le nombre de fiches d’enregistrement jointes. Merci de vérifier la désagrégation Filles / Garçons et d’ajouter les fiches manquantes.';
			}
			rapports.push(rapport);

			if (statut === 'non_commence') continue;
			const [min, max] = PART_MOIS[mois] ?? [0, 0];
			for (const ind of indicateurs.filter((i) => i.volet === volet)) {
				const cible = ind.cible.total;
				if (!cible) continue;
				if (statut === 'brouillon' && hash(ind.id + mois + 'b') < 0.35) continue; // brouillon partiel
				let total: number;
				if (ind.type_valeur === 'pourcentage') {
					total = Math.round(cible * entre(ind.id + mois, 0.62, 1.04));
				} else {
					total = Math.max(0, Math.round(cible * entre(ind.id + mois, min, max)));
					if (cible <= 12) total = hash(ind.id + mois) > 0.55 ? 1 : 0;
				}
				const v = ind.desagrege ? repartir(ind.cible, total) : { femmes: null, filles: null, hommes: null, garcons: null, total };
				valeurs.push({
					id: `${ind.id}:${mois}:v1`,
					indicateur_id: ind.id,
					volet,
					mois,
					valeurs: v,
					commentaire: null,
					version: 1,
					courante: true,
					auteur,
					date: statut === 'brouillon' ? dateDuMois(mois === '2027-01' ? '2027-01' : suivant, mois === '2027-01' ? 9 : 2, 16) : rapport.soumis_le!
				});
			}
			for (const act of activites.filter((a) => a.volet === volet)) {
				const rang = MOIS.indexOf(mois) + 1;
				const taux = Math.min(100, Math.round(entre(act.id + mois, 6, 14) * rang));
				avancements.push({
					id: `${act.id}:${mois}:a1`,
					activite_id: act.id,
					volet,
					mois,
					taux_execution: taux,
					resultats: rang === 1 ? 'Démarrage effectif ; équipes mobilisées et autorités informées.' : 'Mise en œuvre conforme au calendrier.',
					observations: hash(act.id + mois + 'o') > 0.8 ? 'Accès difficile à certaines localités en raison de l’état des pistes.' : '',
					version: 1,
					courante: true,
					auteur,
					date: rapport.soumis_le ?? dateDuMois(mois, 25, 14)
				});
				if (hash(act.id + mois + 'dep') > 0.45) {
					const montant = arrondi(act.budget_planifie * entre(act.id + mois + 'm', 0.04, 0.12), 10);
					depenses.push({
						id: `${act.id}:${mois}:d1`,
						activite_id: act.id,
						volet,
						mois,
						montant,
						libelle: LIBELLES_DEPENSES[Math.floor(hash(act.id + mois + 'l') * LIBELLES_DEPENSES.length)],
						auteur,
						date: dateDuMois(mois, 20, 12),
						archive_le: null
					});
				}
			}

			// Justificatifs FICTIFS rattachés à certains indicateurs (alimentent la case « Oui/Non »).
			if (['soumis', 'valide', 'verrouille', 'a_corriger'].includes(statut)) {
				for (const ind of indicateurs.filter((i) => i.volet === volet && i.cible.total)) {
					if (hash(ind.id + mois + 'j') < 0.55) continue;
					const moyen = ind.moyens_verification[0] ?? null;
					justificatifs.push({ id: `${ind.id}:${mois}:j`, volet, mois, rattachement: { type: 'indicateur', id: ind.id }, nom_fichier: `${(moyen ?? 'piece').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${mois}.pdf`, type_mime: 'application/pdf', taille: Math.round(entre(ind.id + mois, 90000, 900000)), moyen_verification: moyen, auteur, date: dateDuMois(suivant, 2, 17), archive_le: null });
				}
			}

			// 5W (volet WASH) : une ligne par activité et par sous-préfecture, chiffres fictifs.
			if (volet === 'WASH-IDC') {
				for (const act of activites.filter((a) => a.volet === volet && a.fiche_5w)) {
					for (const sp of FICHES_5W_WASH[act.numero].lieux) {
						const cle = act.id + mois + sp;
						const atteints = Math.round(entre(cle, 60, 420));
						const part = (x: number) => Math.round(atteints * x);
						lignes5w.push({
							id: `${cle}:5w`,
							volet,
							activite_id: act.id,
							mois,
							prefecture: PREFECTURE[sp],
							sous_prefecture: sp,
							commune: sp === 'Nanga Boguila' ? 'Nanga Boguila' : sp,
							village: null,
							latitude: null,
							longitude: null,
							quantite_prevue: Math.round(entre(cle + 'qp', 2, 40)),
							quantite_realisee: Math.round(entre(cle + 'qr', 1, 20)),
							personnes_ciblees: Math.round(atteints * entre(cle + 'c', 1.4, 2.2)),
							filles: part(0.3),
							garcons: part(0.25),
							femmes: part(0.27),
							hommes: atteints - part(0.3) - part(0.25) - part(0.27),
							date_debut: structure.projet.date_debut,
							date_fin: structure.projet.date_fin,
							statut: 'En cours',
							commentaire: null,
							auteur,
							date: dateDuMois(mois, 26, 10),
							archive_le: null
						});
					}
				}
			}

			// Journal : soumissions et décisions.
			const org = utilisateursDemo.find((u) => u.id === auteur)!.organisation;
			if (rapport.soumis_le) {
				journal.push({
					id: `ev:${rapport.id}:soumis`,
					date: rapport.soumis_le,
					type: 'rapport_soumis',
					auteur,
					organisation: org,
					volet,
					mois,
					cible: { type: 'rapport', id: rapport.id, libelle: `Rapport de ${mois}` },
					resume: 'a soumis le rapport',
					avant: 'brouillon',
					apres: 'soumis'
				});
			}
			if (rapport.decision_le) {
				const type = statut === 'a_corriger' ? 'rapport_a_corriger' : 'rapport_valide';
				journal.push({
					id: `ev:${rapport.id}:decision`,
					date: rapport.decision_le,
					type,
					auteur: 'u-apsud-coord',
					organisation: 'APSUD',
					volet,
					mois,
					cible: { type: 'rapport', id: rapport.id, libelle: `Rapport de ${mois}` },
					resume: statut === 'a_corriger' ? 'a renvoyé pour correction le rapport' : 'a validé le rapport',
					avant: 'soumis',
					apres: statut === 'a_corriger' ? 'a_corriger' : 'valide'
				});
			}
			if (statut === 'verrouille') {
				journal.push({
					id: `ev:${rapport.id}:verrou`,
					date: dateDuMois(suivant, 15, 9),
					type: 'rapport_verrouille',
					auteur: 'u-apsud-coord',
					organisation: 'APSUD',
					volet,
					mois,
					cible: { type: 'rapport', id: rapport.id, libelle: `Rapport de ${mois}` },
					resume: 'a verrouillé le rapport',
					avant: 'valide',
					apres: 'verrouille'
				});
			}
		}
	}

	journal.sort((a, b) => b.date.localeCompare(a.date));

	// Notifications non lues de démonstration pour la coordination et pour AFPE.
	const notifications: Notification[] = [];
	journal.slice(0, 6).forEach((ev) => {
		for (const u of utilisateursDemo) {
			const concerne = u.role === 'coordination' || u.role === 'super_admin' || (ev.volet && saisieParVolet[ev.volet] === u.id);
			if (concerne && u.id !== ev.auteur) {
				notifications.push({ id: `n:${ev.id}:${u.id}`, evenement_id: ev.id, destinataire: u.id, lue: false });
			}
		}
	});

	return {
		version_schema: VERSION_SCHEMA,
		aujourdhui: AUJOURDHUI_DEMO,
		organisations,
		utilisateurs: utilisateursDemo,
		secteurs,
		projet: structure.projet,
		volets: structure.volets.map((v) => ({
			code: v.code as CodeVolet,
			organisation: v.organisation as Sigle,
			secteur: v.secteur as EtatDepot['volets'][number]['secteur'],
			cadre_verrouille: v.code === 'NUT-ARS'
		})),
		outcomes,
		outputs,
		activites,
		taches,
		indicateurs,
		valeurs,
		avancements,
		depenses,
		justificatifs,
		lignes_5w: lignes5w,
		rapports,
		journal,
		notifications
	};
}
