/**
 * Cadre logique des 5 plans d'action → supabase/migrations/20261122090009_cadre_logique_provisoire.sql
 *
 * Lit src/lib/donnees/demo/structure.json (produit par importer.mjs depuis ../docs/excel,
 * séparateurs de milliers déjà corrigés : anomalies A7 à A9) et écrit les outcomes,
 * outputs, activités et indicateurs avec leurs cibles, sous les mêmes identifiants que
 * la maquette (« WASH-IDC:act:1.1.1 »).
 *
 * Volontairement NON repris (anomalies à faire confirmer par APSUD, D1) :
 *   - les budgets planifiés (valeurs de remplissage à 100, A2) : mis à 0, à saisir ;
 *   - les tâches (modèle identique dans les 5 fichiers, A3) : chaque ONG crée les siennes.
 *
 * Usage : node scripts/import-excel/vers-sql.mjs
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const structure = JSON.parse(readFileSync(resolve(racine, 'src/lib/donnees/demo/structure.json'), 'utf8'));

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 'null' : String(Number(v)));
const tableau = (liste) => (liste?.length ? `array[${liste.map(q).join(', ')}]::text[]` : `'{}'::text[]`);

const lignes = [];
const ajouter = (s) => lignes.push(s);

function indicateur(i, volet, niveau, parent) {
	const colonneParent = { outcome: 'outcome_id', output: 'output_id', activite: 'activite_id' }[niveau];
	ajouter(
		`insert into public.indicateurs (id, volet, niveau, ${colonneParent}, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, ` +
			`cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values (` +
			[
				q(`${volet}:ind:${i.ordre}`), q(volet), q(niveau), q(parent), n(i.ordre), q(i.code_cbpf), q(i.libelle),
				q(i.type_valeur), q(i.mode_cumul), i.desagrege ? 'true' : 'false',
				n(i.cible.femmes), n(i.cible.filles), n(i.cible.hommes), n(i.cible.garcons), n(i.cible.total),
				tableau(i.moyens_verification), q(i.commentaire ?? null)
			].join(', ') +
			');'
	);
}

let nb = { outcomes: 0, outputs: 0, activites: 0, indicateurs: 0 };
for (const v of structure.volets) {
	ajouter(`\n-- ===== Volet ${v.code} (${v.fichier}) =====`);
	for (const o of v.outcomes) {
		const idOc = `${v.code}:oc:${o.numero}`;
		ajouter(`insert into public.outcomes (id, volet, numero, libelle) values (${q(idOc)}, ${q(v.code)}, ${q(o.numero)}, ${q(o.libelle)});`);
		nb.outcomes++;
		for (const i of o.indicateurs) (indicateur(i, v.code, 'outcome', idOc), nb.indicateurs++);
		for (const s of o.outputs) {
			const idOp = `${v.code}:op:${s.numero}`;
			ajouter(`insert into public.outputs (id, volet, outcome_id, numero, libelle) values (${q(idOp)}, ${q(v.code)}, ${q(idOc)}, ${q(s.numero)}, ${q(s.libelle)});`);
			nb.outputs++;
			for (const i of s.indicateurs) (indicateur(i, v.code, 'output', idOp), nb.indicateurs++);
			for (const a of s.activites) {
				const idAct = `${v.code}:act:${a.numero}`;
				ajouter(
					`insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values (` +
						`${q(idAct)}, ${q(v.code)}, ${q(idOp)}, ${q(a.numero)}, ${q(a.libelle)}, ${q(a.responsable ?? null)}, 0);`
				);
				nb.activites++;
				for (const i of a.indicateurs) (indicateur(i, v.code, 'activite', idAct), nb.indicateurs++);
			}
		}
	}
}

const entete = `-- =============================================================================
-- 0009 · Cadre logique PROVISOIRE des 5 plans d'action du consortium FH
-- (généré par scripts/import-excel/vers-sql.mjs, ne pas modifier à la main)
-- Source : ${structure.source}, structure lue le ${structure.genere_le}
-- ${nb.outcomes} outcomes, ${nb.outputs} outputs, ${nb.activites} activités, ${nb.indicateurs} indicateurs.
--
-- Chargé AVANT la validation des anomalies par APSUD (D1), pour que l'outil soit utilisable :
--   - séparateurs de milliers corrigés à l'import (A7 à A9) ;
--   - budgets planifiés à 0 (valeurs de remplissage à 100 dans les fichiers, A2) ;
--   - tâches non reprises (modèle identique dans les 5 fichiers, A3) : chaque ONG crée les siennes ;
--   - les autres anomalies restent visibles dans Administration › Anomalies d'import.
-- Les corrections validées par APSUD passeront par une NOUVELLE migration (jamais en
-- modifiant celle-ci, déjà appliquée au projet en ligne).
-- =============================================================================`;

const sortie = resolve(racine, 'supabase/migrations/20261122090009_cadre_logique_provisoire.sql');
if (existsSync(sortie) && !process.argv.includes('--forcer')) {
	console.error('La migration du cadre logique existe déjà et a pu être appliquée en ligne : on ne la réécrit pas.\nPour une correction, créez une nouvelle migration. (Option --forcer : uniquement si elle n’a jamais été poussée.)');
	process.exit(1);
}
mkdirSync(dirname(sortie), { recursive: true });
writeFileSync(sortie, `${entete}\n${lignes.join('\n')}\n`, 'utf8');
console.log(`Écrit : ${sortie.slice(racine.length + 1)} (${nb.outcomes} outcomes, ${nb.outputs} outputs, ${nb.activites} activités, ${nb.indicateurs} indicateurs)`);
