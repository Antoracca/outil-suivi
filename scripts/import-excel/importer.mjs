/**
 * Import des 5 « Plan d'action » Excel du consortium FH vers les données de démonstration.
 *
 * Lecture seule des fichiers sources (../docs/excel/). Produit :
 *   src/lib/donnees/demo/structure.json  → projet, organisations, volets, cadre logique, tâches
 *   src/lib/donnees/demo/anomalies.json  → anomalies relevées et corrections appliquées
 *
 * Usage : npm run donnees:demo
 *
 * Corrections automatiques (INSTRUCTIONS.md §3.1) :
 *   A1  dates de fin en 2024 → année ramenée à celle du début
 *   A7-A9 séparateur de milliers lu comme décimale (3.838 → 3 838)
 * Les autres anomalies sont seulement signalées.
 */
import ExcelJS from 'exceljs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racineProjet = resolve(ici, '..', '..');
const dossierExcel = resolve(racineProjet, '..', 'docs', 'excel');
const dossierSortie = join(racineProjet, 'src', 'lib', 'donnees', 'demo');

/** Les 5 volets : un fichier = une ONG sur un secteur. */
const VOLETS = [
	{ code: 'NUT-ARS', fichier: "Plan d'action_FH - US Consortium APSUD - NUT ARS.xlsx", organisation: 'ARS', secteur: 'NUT' },
	{ code: 'SAN-ARS', fichier: "Plan d'action_FH - US Consortium APSUD- SANTE ARS.xlsx", organisation: 'ARS', secteur: 'SAN' },
	{ code: 'PE-AFPE', fichier: "Plan d'action_FH - US Consortium APSUD- PE AFPE.xlsx", organisation: 'AFPE', secteur: 'PE' },
	{ code: 'SECAL-GADY', fichier: "Plan d'action_FH - US Consortium APSUD- SECAL- GADY.xlsx", organisation: 'GADY', secteur: 'SECAL' },
	{ code: 'WASH-IDC', fichier: "Plan d'action_FH - US Consortium APSUD- WASH - IDC.xlsx", organisation: 'IDC', secteur: 'WASH' }
];

const anomalies = [];
const signaler = (volet, code, message, cellule = null) => anomalies.push({ volet, code, message, cellule });

/* ---------- Lecture des cellules ---------- */

/** Valeur « propre » d'une cellule ExcelJS ; ignore les cellules esclaves d'une fusion. */
function valeur(feuille, adresse) {
	const cellule = feuille.getCell(adresse);
	if (cellule.isMerged && cellule.master.address !== cellule.address) return null;
	return normaliser(cellule.value);
}

function normaliser(v) {
	if (v === null || v === undefined) return null;
	if (v instanceof Date) return v;
	if (typeof v === 'object') {
		if ('richText' in v) return v.richText.map((r) => r.text).join('');
		if ('result' in v) return normaliser(v.result);
		if ('error' in v) return { erreur: v.error };
		if ('text' in v) return v.text;
		return null;
	}
	if (typeof v === 'string') {
		const t = v.replace(/\s+/g, ' ').trim();
		return t === '' ? null : t;
	}
	return v;
}

const texte = (v) => (typeof v === 'string' ? v : v === null ? null : String(v));

/* ---------- Nettoyage des libellés ---------- */

/** « Activity 1.1.2: : Prise en charge… » → { numero: '1.1.2', libelle: 'Prise en charge…' } */
function decouper(brut, motCle) {
	if (!brut) return null;
	const re = new RegExp(`^\\s*${motCle}\\s*(\\d+(?:\\.\\d+)*)\\s*[:.]*\\s*[:.]*\\s*(.*)$`, 'i');
	const m = texte(brut).match(re);
	if (!m) return { numero: null, libelle: texte(brut).trim() };
	return { numero: m[1], libelle: m[2].replace(/^[:.\s]+/, '').trim() };
}

/** Code d'indicateur standard CBPF, ex. « (Global) (NUT/C-CA5/N.3a) … » → NUT/C-CA5/N.3a */
function codeCbpf(libelle) {
	const m = libelle?.match(/\(([A-Z]{2,4}\/[A-Z0-9-]+\/[A-Za-z0-9.]+)\)/);
	return m ? m[1] : null;
}

function libelleSansCode(libelle) {
	return libelle
		.replace(/^\(Global\)\s*/i, '')
		.replace(/^\([A-Z]{2,4}\/[A-Z0-9-]+\/[A-Za-z0-9.]+\)\s*/, '')
		.trim();
}

function estPourcentage(libelle) {
	return /\b(taux|pourcentage|percentage)\b|%/i.test(libelle);
}

/** Corrige un nombre dont le point a servi de séparateur de milliers (A7-A9). */
function nombre(v, volet, cellule, pourcentage) {
	if (v === null || v === undefined || v === '') return null;
	if (typeof v === 'object' && v.erreur) {
		signaler(volet, 'REF', `Erreur de formule ${v.erreur}`, cellule);
		return null;
	}
	const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
	if (Number.isNaN(n)) return null;
	if (!pourcentage && !Number.isInteger(n) && Number.isInteger(Math.round(n * 1000 * 1e6) / 1e6)) {
		const corrige = Math.round(n * 1000);
		signaler(volet, 'A7', `Cible « ${n} » lue comme ${corrige} (point utilisé comme séparateur de milliers)`, cellule);
		return corrige;
	}
	return n;
}

const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : null);

/* ---------- Feuille 2 : cadre logique et indicateurs ---------- */

function lireCadreLogique(feuille, volet) {
	const outcomes = [];
	let outcome = null;
	let output = null;
	let activite = null;
	let compteurIndicateur = 0;

	const derniere = feuille.rowCount;
	for (let r = 10; r <= derniere; r++) {
		const a = texte(valeur(feuille, `A${r}`));
		const b = texte(valeur(feuille, `B${r}`));
		const c = texte(valeur(feuille, `C${r}`));
		const d = texte(valeur(feuille, `D${r}`));

		if (a && /^outcome/i.test(a)) {
			const p = decouper(a, 'Outcome');
			outcome = { numero: p.numero ?? String(outcomes.length + 1), libelle: p.libelle, outputs: [], indicateurs: [] };
			outcomes.push(outcome);
			output = null;
			activite = null;
		} else if (a && /^output/i.test(a)) {
			const p = decouper(a, 'Output');
			output = { numero: p.numero, libelle: p.libelle, activites: [], indicateurs: [] };
			if (!outcome) {
				outcome = { numero: '1', libelle: '(outcome non nommé)', outputs: [], indicateurs: [] };
				outcomes.push(outcome);
			}
			outcome.outputs.push(output);
			activite = null;
		}

		if (b && /^activit/i.test(b)) {
			const p = decouper(b, 'Activity');
			activite = { numero: p.numero, libelle: p.libelle, indicateurs: [], taches: [], semaines: [] };
			if (output) output.activites.push(activite);
		}

		// Un indicateur occupe 3 lignes : Planifié / Actuel / Cumul. On lit la ligne « Planifié ».
		if (d && /^planif/i.test(d) && c) {
			const pourcentage = estPourcentage(c);
			const cible = {
				femmes: nombre(valeur(feuille, `E${r}`), volet, `E${r}`, pourcentage),
				filles: nombre(valeur(feuille, `F${r}`), volet, `F${r}`, pourcentage),
				hommes: nombre(valeur(feuille, `G${r}`), volet, `G${r}`, pourcentage),
				garcons: nombre(valeur(feuille, `H${r}`), volet, `H${r}`, pourcentage),
				total: nombre(valeur(feuille, `I${r}`), volet, `I${r}`, pourcentage)
			};
			const somme = (cible.femmes ?? 0) + (cible.filles ?? 0) + (cible.hommes ?? 0) + (cible.garcons ?? 0);
			const desagrege = !pourcentage && somme > 0;
			if (desagrege && cible.total !== null && somme !== cible.total) {
				signaler(volet, 'TOTAL', `Somme désagrégée ${somme} ≠ cible totale ${cible.total} pour « ${c.slice(0, 70)} »`, `I${r}`);
			}
			if (cible.total === null && somme === 0) {
				signaler(volet, 'A11', `Indicateur sans cible : « ${c.slice(0, 70)} »`, `I${r}`);
			}
			const moyens = [r, r + 1, r + 2].map((l) => texte(valeur(feuille, `J${l}`))).filter(Boolean);
			const commentaire = texte(valeur(feuille, `L${r}`));
			compteurIndicateur++;
			const indicateur = {
				ordre: compteurIndicateur,
				code_cbpf: codeCbpf(c),
				libelle: libelleSansCode(c),
				type_valeur: pourcentage ? 'pourcentage' : 'nombre',
				mode_cumul: pourcentage ? 'derniere_valeur' : 'somme',
				desagrege,
				cible: { ...cible, total: cible.total ?? (somme || null) },
				moyens_verification: moyens,
				commentaire
			};
			// Rattachement au niveau le plus fin ouvert : activité, sinon output, sinon outcome.
			if (activite) {
				activite.indicateurs.push(indicateur);
			} else if (output) {
				output.indicateurs.push(indicateur);
			} else if (outcome) {
				outcome.indicateurs.push(indicateur);
			}
		}
	}
	return outcomes;
}

/* ---------- Feuille 1 : plan d'action (tâches, budget, semaines) ---------- */

/** Colonnes N à BK : 10 mois × 5 semaines. Renvoie la liste des colonnes avec (mois, semaine). */
function colonnesSemaines() {
	const lettres = [];
	for (let i = 0; i < 50; i++) {
		const n = 14 + i; // N = 14
		lettres.push({ col: colonne(n), mois: Math.floor(i / 5), semaine: (i % 5) + 1 });
	}
	return lettres;
}

function colonne(n) {
	let s = '';
	while (n > 0) {
		const m = (n - 1) % 26;
		s = String.fromCharCode(65 + m) + s;
		n = Math.floor((n - 1) / 26);
	}
	return s;
}

const MOIS_PROJET = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08'];

function corrigerAnnee(date, reference, volet, cellule) {
	if (!(date instanceof Date)) return null;
	const d = new Date(date);
	if (d.getUTCFullYear() < 2026) {
		const annee = reference instanceof Date && reference.getUTCFullYear() >= 2026 ? reference.getUTCFullYear() : 2026;
		signaler(volet, 'A1', `Date ${iso(date)} ramenée en ${annee}`, cellule);
		d.setUTCFullYear(annee);
	}
	return d;
}

function lirePlanAction(feuille, volet) {
	const semaines = colonnesSemaines();
	const parNumero = new Map();
	let courante = null;
	let enTete = 7;
	for (let r = 1; r <= 12; r++) if (texte(valeur(feuille, `A${r}`)) === 'Volet') enTete = r;

	for (let r = enTete + 1; r <= feuille.rowCount; r++) {
		const d = texte(valeur(feuille, `D${r}`));
		if (d && /^activity/i.test(d)) {
			const numero = decouper(d, 'Activity').numero;
			courante = {
				numero,
				responsable: texte(valeur(feuille, `F${r}`)),
				budget_planifie: nombre(valeur(feuille, `J${r}`), volet, `J${r}`, true),
				budget_execute: nombre(valeur(feuille, `K${r}`), volet, `K${r}`, true),
				taux_execution: nombre(valeur(feuille, `L${r}`), volet, `L${r}`, true),
				taches: [],
				semaines: [],
				resultats: [],
				observations: []
			};
			parNumero.set(numero, courante);
		}
		if (!courante) continue;

		const tache = texte(valeur(feuille, `G${r}`));
		const debutBrut = valeur(feuille, `H${r}`);
		const finBrut = valeur(feuille, `I${r}`);
		const marques = semaines
			.filter(({ col }) => /x/i.test(texte(valeur(feuille, `${col}${r}`)) ?? ''))
			.map(({ mois, semaine }) => ({ mois: MOIS_PROJET[mois], semaine }));

		if (tache) {
			const debut = corrigerAnnee(debutBrut, null, volet, `H${r}`);
			const fin = corrigerAnnee(finBrut, debut, volet, `I${r}`);
			courante.taches.push({ libelle: tache, date_debut: iso(debut), date_fin: iso(fin), semaines: marques });
		} else if (marques.length) {
			courante.semaines.push(...marques);
		}
		const resultat = texte(valeur(feuille, `BL${r}`));
		const observation = texte(valeur(feuille, `BM${r}`));
		const observationBis = texte(valeur(feuille, `BN${r}`));
		if (resultat) courante.resultats.push(resultat);
		if (observation) courante.observations.push(observation);
		if (observationBis) courante.observations.push(observationBis);
	}
	return parNumero;
}

/* ---------- Assemblage ---------- */

async function lireVolet(def) {
	const classeur = new ExcelJS.Workbook();
	await classeur.xlsx.readFile(join(dossierExcel, def.fichier));
	const [plan, suivi] = classeur.worksheets;

	const enTeteSuivi = texte(valeur(suivi, 'A4'));
	if (enTeteSuivi && !enTeteSuivi.replace(/\s/g, '').toUpperCase().includes(def.organisation)) {
		signaler(def.code, 'A5', `En-tête de la feuille de suivi « ${enTeteSuivi} » ne correspond pas à ${def.organisation}`, 'A4');
	}

	const outcomes = lireCadreLogique(suivi, def.code);
	const planParActivite = lirePlanAction(plan, def.code);

	for (const outcome of outcomes) {
		for (const output of outcome.outputs) {
			for (const activite of output.activites) {
				const p = planParActivite.get(activite.numero);
				if (!p) {
					signaler(def.code, 'PLAN', `Activité ${activite.numero} absente du plan d'action`);
					continue;
				}
				Object.assign(activite, {
					responsable: p.responsable,
					budget_planifie_fichier: p.budget_planifie,
					budget_execute_fichier: p.budget_execute,
					taux_execution_fichier: p.taux_execution,
					taches: p.taches,
					semaines: p.semaines,
					resultats: p.resultats,
					observations: p.observations
				});
				if (p.taux_execution !== null && p.taux_execution > 1) {
					signaler(def.code, 'A13', `Taux d'exécution ${p.taux_execution} pour l'activité ${activite.numero} (attendu entre 0 et 1)`);
				}
				planParActivite.delete(activite.numero);
			}
		}
	}
	for (const numero of planParActivite.keys()) {
		signaler(def.code, 'PLAN', `Activité ${numero} présente dans le plan d'action mais pas dans le cadre logique`);
	}
	if (outcomes.flatMap((o) => o.outputs.flatMap((s) => s.activites)).every((a) => a.budget_planifie_fichier === 100 || a.budget_planifie_fichier === null)) {
		signaler(def.code, 'A2', 'Budgets planifiés à 100 (valeurs de remplissage) : montants réels à fournir');
	}
	return { ...def, outcomes };
}

const structure = {
	genere_le: new Date().toISOString(),
	source: 'docs/excel (5 plans d’action du consortium FH)',
	projet: {
		code_cbpf: 'CBPF-CAR-26-R-NGO-NSFT-41469',
		intitule:
			"Projet d'assistance d'urgence intégrée en WASH, Sécurité alimentaire, Santé, Nutrition et Protection (Enfance et VBG) à Nanga-Boguila, Paoua et Bossangoa",
		bailleur: 'Fonds humanitaire RCA (FH)',
		date_debut: '2026-11-08',
		date_fin: '2027-08-30',
		devise: 'USD',
		zones: ['Nanga-Boguila', 'Paoua', 'Bossangoa'],
		objectif_general:
			'Contribuer à la réduction de la mortalité et de la morbidité, et améliorer les conditions de vie et la dignité des populations affectées par la crise dans les sous-préfectures de Nanga-Boguila, Paoua et Bossangoa.',
		mois: MOIS_PROJET
	},
	volets: []
};

for (const def of VOLETS) {
	structure.volets.push(await lireVolet(def));
}

mkdirSync(dossierSortie, { recursive: true });
writeFileSync(join(dossierSortie, 'structure.json'), JSON.stringify(structure, null, '\t') + '\n');
writeFileSync(join(dossierSortie, 'anomalies.json'), JSON.stringify(anomalies, null, '\t') + '\n');

const compte = structure.volets.map((v) => {
	const outputs = v.outcomes.flatMap((o) => o.outputs);
	const activites = outputs.flatMap((s) => s.activites);
	const indicateurs =
		v.outcomes.flatMap((o) => o.indicateurs).length +
		outputs.flatMap((s) => s.indicateurs).length +
		activites.flatMap((a) => a.indicateurs).length;
	return `${v.code.padEnd(11)} outcomes ${v.outcomes.length} · outputs ${outputs.length} · activités ${activites.length} · tâches ${activites.flatMap((a) => a.taches).length} · indicateurs ${indicateurs}`;
});
console.log(compte.join('\n'));
console.log(`\n${anomalies.length} anomalies relevées → src/lib/donnees/demo/anomalies.json`);
