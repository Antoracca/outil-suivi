/**
 * État des données du projet Supabase en ligne, en LECTURE SEULE (transaction read only) :
 * ce qui a été saisi depuis l'application (activités créées, rapports, valeurs, fil d'activité),
 * pour repérer d'éventuelles données d'essai. N'affiche ni adresse e-mail ni mot de passe.
 *
 * Le mot de passe de la base est demandé au clavier, masqué, jamais écrit ni affiché.
 * Usage : node scripts/supabase/inspecter.mjs
 */
import { createInterface } from 'node:readline';
import pg from 'pg';

const REF = 'npcqqivoorfwkfaznsbc';
const HOTE = 'aws-0-eu-west-1.pooler.supabase.com';

function demanderMasque(question) {
	return new Promise((resolve) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		rl._writeToOutput = (s) => {
			if (s.includes(question)) rl.output.write(s);
			else rl.output.write('*'.repeat(s.length ? 1 : 0));
		};
		rl.question(question, (r) => {
			rl.close();
			process.stdout.write('\n');
			resolve(r);
		});
	});
}

const mdp = await demanderMasque('Mot de passe de la base Supabase (masqué) : ');
if (!mdp) process.exit(1);
const client = new pg.Client({ host: HOTE, port: 5432, user: `postgres.${REF}`, password: mdp, database: 'postgres', ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query('begin read only');
const q = async (titre, sql) => {
	const { rows } = await client.query(sql);
	console.log(`\n## ${titre} (${rows.length})`);
	if (rows.length) console.table(rows);
};
try {
	await q('Comptes par organisation et rôle', `select organisation, role, actif, count(*)::int as nb from public.profils group by 1, 2, 3 order by 1, 2`);
	await q('Organisations', `select sigle, role_consortium from public.organisations order by sigle`);
	await q('Volets', `select code, organisation, secteur from public.volets order by code`);
	await q('Fil d’activité par type', `select type, count(*)::int as nb, min(date)::text as premier, max(date)::text as dernier from public.journal group by 1 order by 2 desc`);
	await q('Activités créées depuis l’application', `
		select a.volet, a.numero, a.libelle, a.archive_le is not null as archivee, j.date::text as creee_le
		from public.journal j join public.activites a on a.id = j.cible_id
		where j.type = 'activite_creee' order by j.date`);
	await q('Tâches créées depuis l’application', `select j.volet, j.cible_libelle, j.date::text from public.journal j where j.type = 'tache_creee' order by j.date`);
	await q('Rapports sortis du brouillon', `select volet, mois, statut from public.rapports where statut not in ('brouillon', 'non_commence') order by volet, mois`);
	await q('Saisies (nombre de lignes)', `
		select 'valeurs' as table, count(*)::int as nb from public.valeurs
		union all select 'avancements', count(*)::int from public.avancements
		union all select 'depenses', count(*)::int from public.depenses
		union all select 'justificatifs', count(*)::int from public.justificatifs
		union all select 'planifications', count(*)::int from public.planifications
		union all select 'taches', count(*)::int from public.taches
		union all select 'notifications', count(*)::int from public.notifications
		union all select 'invitations', count(*)::int from public.invitations`);
} catch (e) {
	console.error(`\nErreur de lecture : ${e.message}`);
} finally {
	await client.query('rollback');
	await client.end();
}
