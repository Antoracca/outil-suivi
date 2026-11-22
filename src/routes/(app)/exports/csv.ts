/**
 * Génération des exports CSV « compatibles Excel » (côté navigateur, sans back-end).
 *
 * Fonctions PURES : elles reçoivent l'état du dépôt et des options, et rendent un
 * tableau (en-têtes + lignes) puis une chaîne CSV. Aucune dépendance au DOM :
 * on peut les tester telles quelles. Le téléchargement (Blob + lien) vit dans la page.
 *
 * Format retenu pour qu'Excel (réglages français) ouvre le fichier sans assistant :
 *   - encodage UTF-8 précédé d'un BOM (accents corrects) ;
 *   - séparateur « ; » ;
 *   - nombres sans séparateur de milliers, virgule décimale (7525 ; 40,5) ;
 *   - dates au format JJ/MM/AAAA ;
 *   - fins de ligne CRLF.
 */
import { budgetActivite, cumul, justificatifsIndicateur, tauxAtteinte, tauxExecution, valeurCourante } from '#lib/donnees/calculs.ts';
import { libelleMois, majuscule } from '#lib/format.ts';
import type { CodeVolet, EtatDepot, Indicateur, Mois, Niveau, Tache } from '#lib/donnees/types.ts';
import { activiteCluster, COLONNES_5W, LISTES_5W } from '#lib/donnees/referentiels/cinqw.ts';
import donnees5w from '#lib/donnees/referentiels/5w-wash.json';

const REF_5W = { listes: LISTES_5W, organisations: donnees5w.organisations };

export type Cellule = string | number | null;

export interface TableExport {
	entetes: string[];
	lignes: Cellule[][];
}

export interface OptionsExport {
	/** « tous » = tout le consortium. */
	volet: CodeVolet | 'tous';
	/** Dernier mois inclus. */
	jusqua: Mois;
}

/** Écart au prorata du temps au-delà duquel OneGMS demande une justification. */
export const SEUIL_JUSTIFICATION = 15;

const BOM = '﻿';
const SEPARATEUR = ';';
const FIN_LIGNE = '\r\n';

/* ---------- Mise en forme des cellules ---------- */

/** 7525 → « 7525 » ; 40.456 → « 40,46 » (2 décimales au plus, sans séparateur de milliers). */
export function nombreCsv(n: number): string {
	if (!Number.isFinite(n)) return '';
	const arrondi = Math.round(n * 100) / 100;
	return String(arrondi).replace('.', ',');
}

/**
 * Une cellule CSV. Le texte est protégé :
 *   - entre guillemets s'il contient « ; », un guillemet, un retour à la ligne ou des espaces en bord ;
 *   - précédé d'une apostrophe s'il commence par = + - @ (sinon Excel l'exécuterait comme une formule).
 */
export function celluleCsv(c: Cellule): string {
	if (c === null || c === undefined) return '';
	if (typeof c === 'number') return nombreCsv(c);
	let t = c;
	if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
	if (/[;"\r\n]/.test(t) || t !== t.trim()) t = `"${t.replace(/"/g, '""')}"`;
	return t;
}

/** Tableau → contenu complet du fichier (BOM compris). */
export function versCsv(table: TableExport): string {
	const lignes = [table.entetes, ...table.lignes].map((l) => l.map(celluleCsv).join(SEPARATEUR));
	return BOM + lignes.join(FIN_LIGNE) + FIN_LIGNE;
}

/** « 2026-11-08 » ou « 2026-11-08T10:00:00 » → « 08/11/2026 ». */
export function dateCsv(iso: string | null | undefined): string | null {
	if (!iso) return null;
	const [a, m, j] = iso.slice(0, 10).split('-');
	if (!a || !m || !j) return null;
	return `${j}/${m}/${a}`;
}

const arrondi1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** Nom de fichier lisible : « apsud_suivi-indicateurs_WASH-IDC_jusqua-2027-01.csv ». */
export function nomFichier(prefixe: string, o: OptionsExport, voletForce?: CodeVolet): string {
	const portee = voletForce ?? (o.volet === 'tous' ? 'consortium' : o.volet);
	return `apsud_${prefixe}_${portee}_jusqua-${o.jusqua}.csv`;
}

/* ---------- Parcours ordonné du cadre logique ---------- */

const parNumero = (a: { numero: string }, b: { numero: string }) => a.numero.localeCompare(b.numero, 'fr', { numeric: true });

function voletsChoisis(etat: EtatDepot, o: OptionsExport): CodeVolet[] {
	return etat.volets.map((v) => v.code).filter((c) => o.volet === 'tous' || c === o.volet);
}

/** Indicateurs non archivés d'un volet, dans l'ordre du cadre logique (outcome → output → activité). */
export function indicateursOrdonnes(etat: EtatDepot, volet: CodeVolet): Indicateur[] {
	const actifs = etat.indicateurs.filter((i) => i.volet === volet && !i.archive_le);
	const de = (parentId: string) => actifs.filter((i) => i.parent_id === parentId).sort((a, b) => a.ordre - b.ordre);
	const liste: Indicateur[] = [];
	for (const oc of etat.outcomes.filter((x) => x.volet === volet).sort(parNumero)) {
		liste.push(...de(oc.id));
		for (const op of etat.outputs.filter((x) => x.outcome_id === oc.id).sort(parNumero)) {
			liste.push(...de(op.id));
			for (const ac of etat.activites.filter((x) => x.output_id === op.id && !x.archive_le).sort(parNumero)) {
				liste.push(...de(ac.id));
			}
		}
	}
	// Sécurité : un indicateur dont le parent n'a pas été trouvé n'est jamais perdu.
	for (const i of actifs) if (!liste.includes(i)) liste.push(i);
	return liste;
}

const NOMS_NIVEAU: Record<Niveau, string> = { outcome: 'Outcome', output: 'Output', activite: 'Activité' };

/** « Outcome 1 », « Output 1.2 », « Activité 1.2.3 ». */
export function niveauIndicateur(etat: EtatDepot, ind: Indicateur): string {
	const parent =
		ind.niveau === 'outcome'
			? etat.outcomes.find((x) => x.id === ind.parent_id)
			: ind.niveau === 'output'
				? etat.outputs.find((x) => x.id === ind.parent_id)
				: etat.activites.find((x) => x.id === ind.parent_id);
	return parent ? `${NOMS_NIVEAU[ind.niveau]} ${parent.numero}` : NOMS_NIVEAU[ind.niveau];
}

function moisJusqua(etat: EtatDepot, jusqua: Mois): Mois[] {
	return etat.projet.mois.filter((m) => m <= jusqua);
}

/* ---------- a) Suivi des indicateurs ---------- */

export function exporterIndicateurs(etat: EtatDepot, o: OptionsExport): TableExport {
	const entetes = [
		'Volet',
		'Niveau',
		'Code CBPF',
		'Indicateur',
		'Mois',
		'Réalisé Femmes',
		'Réalisé Filles',
		'Réalisé Hommes',
		'Réalisé Garçons',
		'Réalisé total',
		'Cumul total',
		'Cible totale',
		'Taux d’atteinte (%)',
		'Justificatif fourni (Oui/Non)'
	];
	const lignes: Cellule[][] = [];
	const mois = moisJusqua(etat, o.jusqua);
	for (const volet of voletsChoisis(etat, o)) {
		for (const ind of indicateursOrdonnes(etat, volet)) {
			const niveau = niveauIndicateur(etat, ind);
			for (const m of mois) {
				const v = valeurCourante(etat, ind.id, m)?.valeurs;
				const c = cumul(etat, ind, m).total;
				lignes.push([
					volet,
					niveau,
					ind.code_cbpf,
					ind.libelle,
					m,
					v?.femmes ?? null,
					v?.filles ?? null,
					v?.hommes ?? null,
					v?.garcons ?? null,
					v?.total ?? null,
					c,
					ind.cible.total,
					arrondi1(tauxAtteinte(c, ind.cible.total)),
					justificatifsIndicateur(etat, ind.id, m) > 0 ? 'Oui' : 'Non'
				]);
			}
		}
	}
	return { entetes, lignes };
}

/* ---------- b) Plan d'action ---------- */

/** « 2026-12 S2, 2027-01 S1 » (semaines triées, filtrées jusqu'au mois inclus). */
export function semainesTexte(t: Tache, champ: 'prevu' | 'realise', jusqua?: Mois): string {
	return t.semaines
		.filter((s) => s[champ] && (!jusqua || s.mois <= jusqua))
		.sort((a, b) => a.mois.localeCompare(b.mois) || a.semaine - b.semaine)
		.map((s) => `${s.mois} S${s.semaine}`)
		.join(', ');
}

export function exporterPlanAction(etat: EtatDepot, o: OptionsExport): TableExport {
	const entetes = [
		'Volet',
		'Num',
		'Activité',
		'Tâche',
		'Responsable',
		'Début',
		'Fin',
		'Budget planifié',
		'Budget exécuté',
		'Taux d’exécution financière (%)',
		'Taux d’exécution programme (%)',
		'Semaines prévues',
		'Semaines réalisées'
	];
	const lignes: Cellule[][] = [];
	for (const volet of voletsChoisis(etat, o)) {
		const outputs = etat.outputs.filter((x) => x.volet === volet);
		const activites = etat.activites
			.filter((a) => a.volet === volet && !a.archive_le)
			.sort((a, b) => {
				const oa = outputs.find((x) => x.id === a.output_id)?.numero ?? '';
				const ob = outputs.find((x) => x.id === b.output_id)?.numero ?? '';
				return oa.localeCompare(ob, 'fr', { numeric: true }) || parNumero(a, b);
			});
		for (const a of activites) {
			const planifie = budgetActivite(etat, a.id).planifie;
			const execute = etat.depenses.filter((d) => d.activite_id === a.id && !d.archive_le && d.mois <= o.jusqua).reduce((s, d) => s + d.montant, 0);
			lignes.push([
				volet,
				a.numero,
				a.libelle,
				null,
				a.responsable,
				null,
				null,
				planifie,
				execute,
				planifie ? arrondi1((execute / planifie) * 100) : null,
				tauxExecution(etat, a.id, o.jusqua),
				null,
				null
			]);
			for (const t of etat.taches.filter((x) => x.activite_id === a.id && !x.archive_le)) {
				lignes.push([
					volet,
					a.numero,
					a.libelle,
					t.libelle,
					t.responsable,
					dateCsv(t.date_debut),
					dateCsv(t.date_fin),
					null,
					null,
					null,
					null,
					semainesTexte(t, 'prevu'),
					semainesTexte(t, 'realise', o.jusqua)
				]);
			}
		}
	}
	return { entetes, lignes };
}

/* ---------- c) Fiche OneGMS ---------- */

/**
 * Valeur attendue à la date choisie : cible au prorata des mois écoulés pour un
 * indicateur cumulé ; la cible elle-même pour un pourcentage (dernière valeur).
 */
export function attenduAuProrata(etat: EtatDepot, ind: Indicateur, jusqua: Mois): number | null {
	const cible = ind.cible.total;
	if (!cible) return null;
	if (ind.mode_cumul === 'derniere_valeur') return cible;
	const ecoules = etat.projet.mois.indexOf(jusqua) + 1;
	if (ecoules <= 0) return null;
	return (cible * ecoules) / etat.projet.mois.length;
}

/** Écart en % entre le cumul et l'attendu au prorata (négatif = retard). */
export function ecartProrata(realise: number | null, attendu: number | null): number | null {
	if (!attendu) return null;
	return (((realise ?? 0) - attendu) / attendu) * 100;
}

export function exporterOneGMS(etat: EtatDepot, o: OptionsExport): TableExport {
	const entetes = [
		'Volet',
		'Code CBPF',
		'Indicateur',
		'Cible Femmes',
		'Cible Filles',
		'Cible Hommes',
		'Cible Garçons',
		'Cible total',
		'Cumul Femmes',
		'Cumul Filles',
		'Cumul Hommes',
		'Cumul Garçons',
		'Cumul total',
		'Attendu au prorata',
		'Écart (%)',
		'Justification'
	];
	const lignes: Cellule[][] = [];
	for (const volet of voletsChoisis(etat, o)) {
		for (const ind of indicateursOrdonnes(etat, volet)) {
			const c = cumul(etat, ind, o.jusqua);
			const attendu = attenduAuProrata(etat, ind, o.jusqua);
			const ecart = ecartProrata(c.total, attendu);
			lignes.push([
				volet,
				ind.code_cbpf,
				ind.libelle,
				ind.cible.femmes,
				ind.cible.filles,
				ind.cible.hommes,
				ind.cible.garcons,
				ind.cible.total,
				c.femmes,
				c.filles,
				c.hommes,
				c.garcons,
				c.total,
				arrondi1(attendu),
				arrondi1(ecart),
				ecart !== null && Math.abs(ecart) > SEUIL_JUSTIFICATION ? 'Justification requise' : null
			]);
		}
	}
	return { entetes, lignes };
}

/* ---------- d) 5W du cluster WASH (EHA) ---------- */

export const VOLET_5W: CodeVolet = 'WASH-IDC';

/** Les 31 en-têtes du modèle du cluster, dans l’ordre et avec leur libellé exact (copier-coller direct). */
export { COLONNES_5W } from '#lib/donnees/referentiels/cinqw.ts';

/**
 * Une ligne par activité WASH, par sous-préfecture et par mois de rapportage (règle du cluster).
 * Ne sortent que les activités dont la fiche 5W est remplie, et les lignes avec des personnes atteintes.
 */
export function exporter5W(etat: EtatDepot, o: OptionsExport): TableExport {
	const volet = etat.volets.find((v) => v.code === VOLET_5W);
	if (!volet) return { entetes: COLONNES_5W, lignes: [] };
	const p = etat.projet;
	const org = REF_5W.organisations.find((x) => x.sigle.trim() === volet.organisation)?.nom.trim() ?? volet.organisation;
	const moisLibelle = (m: Mois) => REF_5W.listes.mois[Number(m.slice(5, 7)) - 1] ?? majuscule(libelleMois(m, false));
	const lignes: Cellule[][] = [];
	for (const act of etat.activites.filter((a) => a.volet === VOLET_5W && !a.archive_le && a.fiche_5w)) {
		const fiche = act.fiche_5w!;
		const ac = activiteCluster(fiche.activite_cluster);
		const ls = etat.lignes_5w
			.filter((l) => l.activite_id === act.id && l.mois === o.jusqua && !l.archive_le)
			.sort((a, b) => a.sous_prefecture.localeCompare(b.sous_prefecture));
		for (const l of ls) {
			const atteintes = [l.filles, l.garcons, l.femmes, l.hommes].every((x) => x === null) ? null : (l.filles ?? 0) + (l.garcons ?? 0) + (l.femmes ?? 0) + (l.hommes ?? 0);
			lignes.push([
				org,
				fiche.partenaires,
				REF_5W.listes.secteur,
				ac?.sous_cluster ?? null,
				ac?.libelle ?? null,
				fiche.modalite,
				ac?.unite ?? null,
				l.quantite_prevue,
				l.quantite_realisee,
				l.prefecture,
				l.sous_prefecture,
				l.commune,
				l.village,
				l.latitude,
				l.longitude,
				ac?.indicateur ?? null,
				fiche.type_beneficiaire,
				l.personnes_ciblees,
				atteintes,
				l.filles,
				l.garcons,
				l.femmes,
				l.hommes,
				dateCsv(l.date_debut),
				dateCsv(l.date_fin),
				l.statut,
				l.commentaire,
				p.code_cbpf,
				p.bailleur,
				fiche.reponse,
				moisLibelle(l.mois)
			]);
		}
	}
	return { entetes: COLONNES_5W, lignes };
}
