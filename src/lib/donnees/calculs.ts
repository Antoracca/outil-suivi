/**
 * Calculs dérivés (équivalents des vues SQL de ARCHITECTURE.md §4.7).
 * Fonctions pures : le cumul, les taux et les totaux ne sont JAMAIS saisis.
 */
import type { CodeVolet, Desagregation, EtatDepot, Indicateur, Mois, Rapport, ValeurIndicateur } from './types';
import type { EcheanceRapport } from './calendrier';

export const VIDE: Desagregation = { femmes: null, filles: null, hommes: null, garcons: null, total: null };

export function valeurCourante(etat: EtatDepot, indicateurId: string, mois: Mois): ValeurIndicateur | undefined {
	return etat.valeurs.find((v) => v.indicateur_id === indicateurId && v.mois === mois && v.courante);
}

export function historique(etat: EtatDepot, indicateurId: string, mois: Mois): ValeurIndicateur[] {
	return etat.valeurs.filter((v) => v.indicateur_id === indicateurId && v.mois === mois).sort((a, b) => b.version - a.version);
}

const additionner = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));

/** Cumul jusqu'au mois inclus (somme), ou dernière valeur connue (pourcentages). */
export function cumul(etat: EtatDepot, indicateur: Indicateur, jusqua: Mois, inclus = true): Desagregation {
	const mois = etat.projet.mois.filter((m) => (inclus ? m <= jusqua : m < jusqua));
	if (indicateur.mode_cumul === 'derniere_valeur') {
		for (const m of [...mois].reverse()) {
			const v = valeurCourante(etat, indicateur.id, m);
			if (v && v.valeurs.total !== null) return v.valeurs;
		}
		return VIDE;
	}
	return mois.reduce<Desagregation>((acc, m) => {
		const v = valeurCourante(etat, indicateur.id, m);
		if (!v) return acc;
		return {
			femmes: additionner(acc.femmes, v.valeurs.femmes),
			filles: additionner(acc.filles, v.valeurs.filles),
			hommes: additionner(acc.hommes, v.valeurs.hommes),
			garcons: additionner(acc.garcons, v.valeurs.garcons),
			total: additionner(acc.total, v.valeurs.total)
		};
	}, VIDE);
}

/** Taux d'atteinte en % (peut dépasser 100). */
export function tauxAtteinte(realise: number | null, cible: number | null): number | null {
	if (realise === null || !cible) return null;
	return (realise / cible) * 100;
}

export function totalDesagrege(d: Desagregation): number | null {
	const parts = [d.femmes, d.filles, d.hommes, d.garcons];
	if (parts.every((p) => p === null)) return d.total;
	return parts.reduce<number>((a, b) => a + (b ?? 0), 0);
}

/**
 * Colonne « Oui/Non » des fiches de suivi (décision D11, proposition) : un justificatif
 * est-il joint à cet indicateur pour ce mois ? Renvoie le nombre de pièces (0 = « Non »).
 */
export function justificatifsIndicateur(etat: EtatDepot, indicateurId: string, mois: Mois): number {
	return etat.justificatifs.filter((j) => j.rattachement.type === 'indicateur' && j.rattachement.id === indicateurId && j.mois === mois && !j.archive_le).length;
}

export function budgetActivite(etat: EtatDepot, activiteId: string) {
	const act = etat.activites.find((a) => a.id === activiteId);
	const execute = etat.depenses.filter((d) => d.activite_id === activiteId && !d.archive_le).reduce((s, d) => s + d.montant, 0);
	const planifie = act?.budget_planifie ?? 0;
	return { planifie, execute, taux: planifie ? (execute / planifie) * 100 : null };
}

export function budgetVolet(etat: EtatDepot, volet: CodeVolet) {
	const acts = etat.activites.filter((a) => a.volet === volet && !a.archive_le);
	const planifie = acts.reduce((s, a) => s + a.budget_planifie, 0);
	const execute = etat.depenses.filter((d) => d.volet === volet && !d.archive_le).reduce((s, d) => s + d.montant, 0);
	return { planifie, execute, taux: planifie ? (execute / planifie) * 100 : null };
}

export function avancementCourant(etat: EtatDepot, activiteId: string, mois: Mois) {
	return etat.avancements.find((a) => a.activite_id === activiteId && a.mois === mois && a.courante);
}

/** Dernier taux d'exécution connu jusqu'au mois inclus. */
export function tauxExecution(etat: EtatDepot, activiteId: string, jusqua: Mois): number | null {
	const liste = etat.avancements.filter((a) => a.activite_id === activiteId && a.courante && a.mois <= jusqua).sort((a, b) => b.mois.localeCompare(a.mois));
	return liste[0]?.taux_execution ?? null;
}

export function rapport(etat: EtatDepot, volet: CodeVolet, mois: Mois): Rapport | undefined {
	return etat.rapports.find((r) => r.volet === volet && r.mois === mois);
}

/** Mois « en cours » de la démonstration (celui qui contient la date du jour). */
export function moisCourant(etat: EtatDepot, maintenant: Date): Mois {
	const m = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
	const mois = etat.projet.mois;
	if (m < mois[0]) return mois[0];
	if (m > mois[mois.length - 1]) return mois[mois.length - 1];
	return m;
}

/**
 * Mois dont le rapport est attendu : le dernier mois du projet déjà terminé.
 * Après la fin du projet, c'est le dernier mois (rapport final), et non l'avant-dernier.
 */
export function moisARapporter(etat: EtatDepot, maintenant: Date): Mois {
	const m = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
	const termines = etat.projet.mois.filter((x) => x < m);
	return termines.at(-1) ?? etat.projet.mois[0];
}

/** Rapport attendu pour un mois selon le calendrier officiel (type, intitulé, dates). */
export function rapportDuCalendrier(etat: EtatDepot, mois: Mois): EcheanceRapport | undefined {
	return etat.projet.echeances?.find((e) => e.mois === mois);
}

const finDeJournee = (iso: string) => {
	const [a, m, j] = iso.split('-').map(Number);
	return new Date(a, m - 1, j, 23, 59);
};

/** Date limite partenaire → APSUD (calendrier officiel ; à défaut, le 2 du mois suivant). */
export function echeance(etat: EtatDepot, mois: Mois): Date {
	const c = rapportDuCalendrier(etat, mois);
	if (c) return finDeJournee(c.partenaire);
	const [a, m] = mois.split('-').map(Number);
	return new Date(a, m, 2, 23, 59);
}

/** Date limite APSUD → Fonds humanitaire, si le calendrier la donne. */
export function echeanceFH(etat: EtatDepot, mois: Mois): Date | null {
	const c = rapportDuCalendrier(etat, mois);
	return c ? finDeJournee(c.fh) : null;
}

export function joursRetard(etat: EtatDepot, r: Rapport | undefined, maintenant: Date): number {
	if (!r || !['non_commence', 'brouillon', 'a_corriger'].includes(r.statut)) return 0;
	const e = echeance(etat, r.mois);
	const diff = Math.floor((maintenant.getTime() - e.getTime()) / 86400000);
	return diff > 0 ? diff : 0;
}

/** Indicateur « à jour » : réalisé du dernier mois rapporté renseigné. */
export function indicateursAJour(etat: EtatDepot, volet: CodeVolet, mois: Mois) {
	const inds = etat.indicateurs.filter((i) => i.volet === volet && !i.archive_le && i.cible.total);
	const renseignes = inds.filter((i) => valeurCourante(etat, i.id, mois));
	return { total: inds.length, renseignes: renseignes.length };
}

/** Indicateur phare d'un volet : le premier indicateur d'outcome chiffré, sinon le premier chiffré. */
export function indicateurPhare(etat: EtatDepot, volet: CodeVolet): Indicateur | undefined {
	const inds = etat.indicateurs.filter((i) => i.volet === volet && !i.archive_le && i.cible.total && i.type_valeur === 'nombre');
	return inds.find((i) => i.niveau === 'outcome' && (i.cible.total ?? 0) > 20) ?? inds.find((i) => (i.cible.total ?? 0) > 20) ?? inds[0];
}
