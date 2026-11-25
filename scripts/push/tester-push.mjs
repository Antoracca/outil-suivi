#!/usr/bin/env node
/**
 * Test de bout en bout des alertes push, sur le projet en ligne (à lancer par le développeur).
 *
 * Crée une annonce « Test des alertes » → le déclencheur `annonces_push` (migration 0017)
 * appelle la fonction Edge → l'alerte part vers TOUS les appareils abonnés. Le script attend
 * la réponse de la fonction (table net._http_response de pg_net), l'affiche, puis ARCHIVE
 * l'annonce de test pour qu'elle disparaisse de la cloche et des fenêtres d'arrivée.
 *
 * Le mot de passe de la base est demandé au clavier, masqué, jamais écrit ni affiché.
 * Usage : node scripts/push/tester-push.mjs
 */
import { createInterface } from 'node:readline';
import pg from 'pg';

const REF = 'npcqqivoorfwkfaznsbc';
const HOTE = 'aws-0-eu-west-1.pooler.supabase.com';

function demander(question, masque = false) {
	return new Promise((resolve) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		if (masque) {
			rl._writeToOutput = (s) => {
				if (s.includes(question)) rl.output.write(s);
				else rl.output.write('*'.repeat(s.length ? 1 : 0));
			};
		}
		rl.question(question, (r) => {
			rl.close();
			if (masque) process.stdout.write('\n');
			resolve(r.trim());
		});
	});
}

const mdp = await demander('Mot de passe de la base Supabase (masqué) : ', true);
if (!mdp) process.exit(1);
const db = new pg.Client({ host: HOTE, port: 5432, user: `postgres.${REF}`, password: mdp, database: 'postgres', ssl: { rejectUnauthorized: false } });
await db.connect();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

try {
	const { rows: abonnes } = await db.query(`select p.organisation, p.role, s.appareil from public.abonnements_push s join public.profils p on p.id = s.utilisateur where p.actif`);
	console.log(`\nAppareils abonnés : ${abonnes.length}`);
	if (abonnes.length) console.table(abonnes);
	if (!abonnes.length) {
		console.log('Aucun appareil abonné : dans la cloche, cliquez sur « Activer » sur chaque appareil, puis relancez.');
		process.exit(0);
	}
	const ok = await demander(`Envoyer une alerte de test à ces ${abonnes.length} appareil(s) ? (o/N) `);
	if (!/^o(ui)?$/i.test(ok)) process.exit(0);

	const id = `test-alertes-${Date.now()}`;
	const debut = new Date();
	await db.query(
		`insert into public.annonces (id, titre, texte, organisation) values ($1, 'Test des alertes', 'Alerte de test envoyée par l’équipe technique : si vous la voyez, les alertes push fonctionnent sur cet appareil.', 'APSUD')`,
		[id]
	);
	console.log('\n→ Annonce de test créée, attente de la réponse de la fonction Edge…');

	let reponse = null;
	for (let i = 0; i < 20 && !reponse; i++) {
		await pause(1000);
		const { rows } = await db.query(`select status_code, coalesce(content::text, error_msg) as contenu, timed_out from net._http_response where created >= $1 order by created desc limit 1`, [debut]);
		reponse = rows[0] ?? null;
	}
	const { rows: etat } = await db.query(`select push_envoye_le is not null as poussee from public.annonces where id = $1`, [id]);
	if (!reponse) console.log('✗ Aucune réponse de la fonction en 20 s : le déclencheur n’a pas appelé la fonction (pg_net), ou la file d’attente de pg_net est bloquée.');
	else console.log(`Réponse de la fonction : HTTP ${reponse.status_code}${reponse.timed_out ? ' (délai dépassé)' : ''} · ${reponse.contenu}`);
	console.log(`Annonce marquée « poussée » : ${etat[0]?.poussee ? 'oui' : 'non'}`);

	const { rows: envois } = await db.query(`select p.organisation, p.role, s.appareil, s.dernier_envoi::text from public.abonnements_push s join public.profils p on p.id = s.utilisateur`);
	console.table(envois);

	await db.query(`update public.annonces set archive_le = now() where id = $1`, [id]);
	console.log('Annonce de test archivée (elle n’apparaît plus dans la plateforme).');
} catch (e) {
	console.error(`\nErreur : ${e.message}`);
} finally {
	await db.end();
}
