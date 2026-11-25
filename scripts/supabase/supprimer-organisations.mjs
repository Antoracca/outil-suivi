#!/usr/bin/env node
/**
 * SUPPRESSION DÉFINITIVE d'organisations d'essai, SANS TRACE, sur le projet en ligne
 * (demande explicite du développeur, 2026-11-25). Irréversible.
 *
 * Supprime, pour chaque sigle choisi : ses rapports et volets (seulement s'ils sont vides :
 * aucune activité, valeur, dépense… sinon le script s'arrête), ses invitations, son annonce
 * et les lectures de celle-ci, les événements du fil d'activité qui la concernent et leurs
 * notifications, les lignes du journal d'audit, puis l'organisation.
 * Le fil d'activité et le journal d'audit sont protégés (ajout seul) : la protection est levée
 * le temps de la suppression, DANS LA MÊME TRANSACTION, puis remise ; en cas d'erreur, rien
 * n'est modifié. Les 5 organisations fondatrices ne peuvent pas être supprimées ici.
 *
 * Le mot de passe de la base est demandé au clavier, masqué, jamais écrit ni affiché.
 * Usage : node scripts/supabase/supprimer-organisations.mjs
 */
import { createInterface } from 'node:readline';
import pg from 'pg';

const REF = 'npcqqivoorfwkfaznsbc';
const HOTE = 'aws-0-eu-west-1.pooler.supabase.com';
const FONDATRICES = ['APSUD', 'ARS', 'AFPE', 'GADY', 'IDC'];
/** Tables du cadre et des saisies : elles doivent être vides pour les volets supprimés. */
const SAISIES = ['outcomes', 'outputs', 'activites', 'indicateurs', 'taches', 'valeurs', 'avancements', 'depenses', 'justificatifs', 'lignes_5w', 'planifications'];

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

try {
	const { rows: candidates } = await db.query(
		`select o.sigle, o.nom, o.role_consortium, string_agg(v.code, ', ' order by v.code) as volets,
			(select min(j.date)::date::text from public.journal j where j.type = 'volet_cree' and j.volet in (select code from public.volets where organisation = o.sigle)) as creee_le
		from public.organisations o left join public.volets v on v.organisation = o.sigle
		where o.sigle <> all($1) group by o.sigle, o.nom, o.role_consortium order by o.sigle`,
		[FONDATRICES]
	);
	console.log('\nOrganisations ajoutées après les 5 fondatrices :');
	console.table(candidates);
	const saisie = (await demander('Sigles à SUPPRIMER définitivement (séparés par des espaces, vide = annuler) : ')).toUpperCase().split(/[\s,]+/).filter(Boolean);
	if (!saisie.length) process.exit(0);
	const inconnus = saisie.filter((s) => !candidates.some((c) => c.sigle === s));
	if (inconnus.length) {
		console.error(`✗ Sigles refusés (inconnus ou fondateurs) : ${inconnus.join(', ')}. Rien n'a été fait.`);
		process.exit(1);
	}
	const { rows: v } = await db.query(`select code from public.volets where organisation = any($1)`, [saisie]);
	const codes = v.map((x) => x.code);

	for (const t of SAISIES) {
		const { rows } = await db.query(`select count(*)::int as nb from public.${t} where volet = any($1)`, [codes]);
		if (rows[0].nb) {
			console.error(`✗ ${t} contient ${rows[0].nb} ligne(s) pour ces volets : ce ne sont pas des organisations vides. Rien n'a été fait.`);
			process.exit(1);
		}
	}
	const { rows: comptes } = await db.query(`select count(*)::int as nb from public.profils where organisation = any($1)`, [saisie]);
	if (comptes[0].nb) {
		console.error(`✗ ${comptes[0].nb} compte(s) appartiennent à ces organisations. Rien n'a été fait.`);
		process.exit(1);
	}

	const evenements = `select id from public.journal where volet = any($2) or (cible_type = 'organisation' and cible_id = any($1)) or (cible_type = 'volet' and cible_id = any($2))`;
	const annonces = saisie.map((s) => `arrivee-${s.toLowerCase()}`);
	const plan = await db.query(
		`select
			(select count(*) from public.rapports where volet = any($2))::int as rapports,
			(select count(*) from public.invitations where organisation = any($1))::int as invitations,
			(select count(*) from public.annonces where id = any($3) or organisation = any($1))::int as annonces,
			(select count(*) from public.journal where id in (${evenements}))::int as evenements,
			(select count(*) from public.notifications where evenement_id in (${evenements}))::int as notifications,
			(select count(*) from public.journal_audit where (table_nom = 'organisations' and ligne_id = any($1)) or (table_nom = 'volets' and ligne_id = any($2))
				or (table_nom = 'rapports' and split_part(ligne_id, ':', 1) = any($2))
				or (table_nom = 'invitations' and coalesce(nouveau ->> 'organisation', ancien ->> 'organisation') = any($1)))::int as audit`,
		[saisie, codes, annonces]
	);
	console.log(`\nSera supprimé définitivement pour ${saisie.join(', ')} (volets : ${codes.join(', ') || 'aucun'}) :`);
	console.table(plan.rows);
	const ok = await demander('Cette suppression est IRRÉVERSIBLE. Tapez SUPPRIMER pour confirmer : ');
	if (ok !== 'SUPPRIMER') {
		console.log('Annulé : rien n’a été modifié.');
		process.exit(0);
	}

	await db.query('begin');
	// Protections levées le temps de la transaction : fil d'activité, journal d'audit, audit automatique.
	const declencheurs = [
		['journal', 'journal_ajout_seul'],
		['journal_audit', 'journal_audit_ajout_seul'],
		['organisations', 'auditer'],
		['volets', 'auditer'],
		['rapports', 'auditer'],
		['invitations', 'auditer']
	];
	for (const [t, d] of declencheurs) await db.query(`alter table public.${t} disable trigger ${d}`);

	await db.query(`delete from public.notifications where evenement_id in (${evenements})`, [saisie, codes]);
	await db.query(`delete from public.journal where id in (${evenements})`, [saisie, codes]);
	await db.query(`delete from public.annonces_lues where annonce_id in (select id from public.annonces where id = any($1) or organisation = any($2))`, [annonces, saisie]);
	await db.query(`delete from public.annonces where id = any($1) or organisation = any($2)`, [annonces, saisie]);
	await db.query(`delete from public.rapports where volet = any($1)`, [codes]);
	await db.query(`delete from public.volets where code = any($1)`, [codes]);
	await db.query(`delete from public.invitations where organisation = any($1)`, [saisie]);
	await db.query(
		`delete from public.journal_audit where (table_nom = 'organisations' and ligne_id = any($1)) or (table_nom = 'volets' and ligne_id = any($2))
			or (table_nom = 'rapports' and split_part(ligne_id, ':', 1) = any($2))
			or (table_nom = 'invitations' and coalesce(nouveau ->> 'organisation', ancien ->> 'organisation') = any($1))`,
		[saisie, codes]
	);
	const { rows: logos } = await db.query(`select logo_url from public.organisations where sigle = any($1) and logo_url is not null`, [saisie]);
	await db.query(`delete from public.organisations where sigle = any($1)`, [saisie]);

	for (const [t, d] of declencheurs) await db.query(`alter table public.${t} enable trigger ${d}`);
	await db.query('commit');
	console.log(`\n✓ Supprimé sans trace : ${saisie.join(', ')}. Les protections du fil d'activité et de l'audit sont remises.`);
	if (logos.length) console.log(`Logo(s) encore présent(s) dans le stockage (à supprimer dans Supabase › Storage › logos) : ${logos.map((l) => l.logo_url).join(', ')}`);
} catch (e) {
	await db.query('rollback').catch(() => undefined);
	console.error(`\n✗ Erreur, rien n'a été modifié : ${e.message}`);
} finally {
	await db.end();
}
