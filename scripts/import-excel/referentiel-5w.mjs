/**
 * Extraction du référentiel 5W du cluster WASH (EHA) depuis le modèle Excel reçu
 * (../docs/excel/HRP_2025_5W_Juillet_september_2025 (3).xlsx, lecture seule).
 *
 * Produit src/lib/donnees/referentiels/5w-wash.json :
 *   - colonnes : les 31 en-têtes du modèle, dans l'ordre et avec leur libellé exact ;
 *   - activites : les activités standard (sous-cluster, libellé numéroté, unité, indicateur) ;
 *   - listes : modalités, types de bénéficiaire, statuts, types de réponse, mois, organisations ;
 *   - lieux : préfectures → sous-préfectures → communes (feuilles Admin2 et Admin3).
 *
 * Usage : node scripts/import-excel/referentiel-5w.mjs (appelé par npm run donnees:demo)
 */
import ExcelJS from 'exceljs';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '..', '..');
const fichier = resolve(racine, '..', 'docs', 'excel', 'HRP_2025_5W_Juillet_september_2025 (3).xlsx');
const sortie = join(racine, 'src', 'lib', 'donnees', 'referentiels', '5w-wash.json');

const texte = (v) => {
	if (v === null || v === undefined) return null;
	if (typeof v === 'object' && 'richText' in v) v = v.richText.map((r) => r.text).join('');
	if (typeof v === 'object' && 'result' in v) v = v.result;
	if (v instanceof Date) return v.toISOString();
	const t = String(v).replace(/\s+/g, ' ').trim();
	return t === '' ? null : t;
};

const classeur = new ExcelJS.Workbook();
await classeur.xlsx.readFile(fichier);

/* Colonnes du 5W : ligne 5, colonnes A à AE. */
const feuille5w = classeur.getWorksheet('5W');
const colonnes = [];
for (let c = 1; c <= 31; c++) colonnes.push(texte(feuille5w.getRow(5).getCell(c).value));

/* Listes déroulantes : feuille « Dropdown Mirror » (une colonne par liste). */
const dd = classeur.getWorksheet('Dropdown Mirror');
const colonne = (n) => {
	const v = [];
	dd.getColumn(n).eachCell({ includeEmpty: false }, (cell, ligne) => {
		if (ligne > 1) {
			const t = texte(cell.value);
			if (t) v.push(t);
		}
	});
	return v;
};
const entete = (n) => texte(dd.getRow(1).getCell(n).value);

// Repérage des colonnes par leur en-tête (robuste à un réordonnancement).
const index = {};
for (let c = 1; c <= dd.columnCount; c++) {
	const e = entete(c);
	if (e && !(e in index)) index[e.trim()] = c;
}
const sousSecteurs = colonne(index['Sub-Sector']);
const libellesActivites = colonne(index['Activities']);
const unites = colonne(index['Units']);
const indicateurs = colonne(index['Indicator']);
const activites = libellesActivites.map((libelle, i) => ({
	code: `${sousSecteurs[i]}|${libelle}`,
	sous_cluster: sousSecteurs[i],
	libelle,
	unite: unites[i] ?? null,
	indicateur: indicateurs[i] ?? null
}));

const organisations = colonne(index['Organization']).map((nom, i) => ({ nom, sigle: colonne(index['Short name'])[i] ?? nom }));

const listes = {
	secteur: colonne(index['Sector'])[0] ?? 'EHA',
	sous_clusters: colonne(index['Sub-sector']),
	modalites: colonne(index['Modality']),
	statuts: colonne(index['Status']),
	types_beneficiaire: colonne(index['Beneficiary Type']),
	reponses: colonne(index['Response Name']),
	mois: colonne(index['Reporting Month'])
};

/* Lieux : Admin2 Mirror (ligne 1 = préfectures, dessous = sous-préfectures),
   Admin3 Mirror (ligne 1 = sous-préfectures, dessous = communes). */
const parColonnes = (nom) => {
	const f = classeur.getWorksheet(nom);
	const res = {};
	for (let c = 1; c <= f.columnCount; c++) {
		const tete = texte(f.getRow(1).getCell(c).value);
		if (!tete) continue;
		const enfants = [];
		for (let l = 2; l <= f.rowCount; l++) {
			const t = texte(f.getRow(l).getCell(c).value);
			if (t) enfants.push(t);
		}
		res[tete] = enfants;
	}
	return res;
};
const sousPrefectures = parColonnes('Admin2 Mirror');
const communes = parColonnes('Admin3 Mirror');
const lieux = Object.entries(sousPrefectures).map(([prefecture, sps]) => ({
	prefecture,
	sous_prefectures: sps.map((sp) => ({ nom: sp, communes: communes[sp] ?? [] }))
}));

const referentiel = {
	source: 'docs/excel/HRP_2025_5W_Juillet_september_2025 (3).xlsx (modèle 5W du cluster WASH, PRH 2025)',
	colonnes,
	activites,
	listes,
	organisations,
	lieux
};
writeFileSync(sortie, JSON.stringify(referentiel, null, '\t') + '\n');
console.log(`5W : ${colonnes.length} colonnes, ${activites.length} activités, ${lieux.length} préfectures, ${organisations.length} organisations → ${sortie}`);
