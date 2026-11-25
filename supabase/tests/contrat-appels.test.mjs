/**
 * Contrat entre l'interface et la base : chaque appel `fn` de depot.svelte.ts doit
 * transmettre EXACTEMENT les paramètres de la fonction SQL du même nom (PostgREST
 * choisit la fonction d'après les noms des arguments : un nom de trop ou manquant
 * donne « fonction introuvable » en production). Vérifié contre les migrations réelles.
 * Usage : npm run test:db (lancé après les tests de sécurité)
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const db = new PGlite();
await db.exec(readFileSync(resolve(ici, 'environnement-local.sql'), 'utf8'));
for (const m of readdirSync(resolve(ici, '..', 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
	await db.exec(readFileSync(resolve(ici, '..', 'migrations', m), 'utf8'));
}
const { rows } = await db.query(`
	select p.proname as nom,
		array(select x.a from unnest(coalesce(p.proargnames, '{}'), coalesce(p.proargmodes::text[], array_fill('i'::text, array[cardinality(coalesce(p.proargnames, '{}'))]))) as x(a, m) where x.m in ('i', 'b', 'v')) as params, p.pronargdefaults as defauts,
		has_function_privilege('authenticated', p.oid, 'execute') as autorise
	from pg_proc p join pg_namespace n on n.oid = p.pronamespace
	where n.nspname = 'public'`);
const sql = new Map(rows.map((r) => [r.nom, r]));

// Le dépôt, plus les alertes push (abonnement de l'appareil).
const source = ['src/lib/donnees/depot.svelte.ts', 'src/lib/donnees/push.svelte.ts', 'src/lib/analytique/collecte.svelte.ts'].map((f) => readFileSync(resolve(ici, '..', '..', f), 'utf8')).join('\n');
const appels = [];
// fn: 'nom', args: { cle: …, cle2: … }   (l'identifiant d'événement p_evenement est ajouté par #valider)
for (const m of source.matchAll(/fn: '([a-z_0-9]+)',\s*args: \{([^}]*)\}/g)) {
	const cles = [...m[2].matchAll(/(p_[a-z_0-9]+)\s*:/g)].map((x) => x[1]);
	appels.push({ fn: m[1], cles, viaValider: !['marquer_lu', 'marquer_annonce_lue'].includes(m[1]) });
}
for (const m of source.matchAll(/rpc\('([a-z_0-9]+)',\s*\{([^}]*)\}/g)) {
	appels.push({ fn: m[1], cles: [...m[2].matchAll(/(p_[a-z_0-9]+)\s*:/g)].map((x) => x[1]), viaValider: false });
}

let echecs = 0;
console.log('\nContrat interface ↔ fonctions SQL\n');
for (const a of appels) {
	const f = sql.get(a.fn);
	const envoyes = new Set(a.viaValider ? ['p_evenement', ...a.cles] : a.cles);
	let probleme = null;
	if (!f) probleme = 'fonction absente des migrations';
	else {
		const params = f.params;
		const obligatoires = params.slice(0, params.length - f.defauts);
		const manquants = obligatoires.filter((p) => !envoyes.has(p));
		const inconnus = [...envoyes].filter((p) => !params.includes(p));
		if (manquants.length) probleme = `paramètres manquants : ${manquants.join(', ')}`;
		else if (inconnus.length) probleme = `paramètres inconnus : ${inconnus.join(', ')}`;
		else if (!f.autorise && a.fn !== 'verifier_invitation') probleme = 'non exécutable par un compte connecté';
	}
	if (probleme) echecs++;
	console.log(`  ${probleme ? '✗' : '✓'} ${a.fn}${probleme ? ` — ${probleme}` : ''}`);
}
if (appels.length < 18) (echecs++, console.log(`  ✗ seulement ${appels.length} appels repérés : l'analyse du dépôt a échoué`));
console.log(`\n${appels.length - echecs} conforme(s), ${echecs} écart(s).`);
process.exit(echecs ? 1 : 0);
