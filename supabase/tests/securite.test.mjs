/**
 * Tests de la base : chaque règle de sécurité et de circuit est PROUVÉE, pas supposée
 * (INSTRUCTIONS.md §0.9, ARCHITECTURE.md §11).
 *
 * Moteur : PGlite (PostgreSQL complet compilé en WebAssembly), sans Docker ni serveur.
 * Charge supabase/tests/environnement-local.sql, puis TOUTES les migrations dans
 * l'ordre (cadre logique compris), et joue chaque règle avec de vrais rôles
 * (« authenticated », « anon ») et la sécurité par ligne active.
 *
 * Usage : npm run test:db
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const lire = (...p) => readFileSync(resolve(ici, ...p), 'utf8');

const db = new PGlite();
await db.exec(lire('environnement-local.sql'));
const migrations = readdirSync(resolve(ici, '..', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
for (const m of migrations) {
	try {
		await db.exec(lire('..', 'migrations', m));
	} catch (e) {
		console.error(`\n✗ Migration ${m} : ${e.message}`);
		process.exit(1);
	}
}

/* ---------- Outils ---------- */

let reussis = 0;
const echecs = [];
async function test(nom, fn) {
	try {
		await fn();
		reussis++;
		console.log(`  ✓ ${nom}`);
	} catch (e) {
		echecs.push(nom);
		console.log(`  ✗ ${nom}\n      ${e.message}`);
	} finally {
		await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
	}
}
function egal(obtenu, attendu, message = '') {
	if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) throw new Error(`${message} attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
}
async function refuse(promesse, motif) {
	try {
		await promesse;
	} catch (e) {
		if (motif && !motif.test(e.message)) throw new Error(`refus inattendu : « ${e.message} »`);
		return;
	}
	throw new Error('l’opération aurait dû être refusée');
}
const ligne = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const valeur = async (sql, p = []) => Object.values((await ligne(sql, p)) ?? {})[0];

/** Se mettre dans la peau d'un compte (comme une requête de l'application avec son jeton). */
async function en(uid) {
	await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
}
const enPostgres = () => db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);

let n = 0;
const ev = () => `ev-test-${++n}`;

/** Crée un compte comme le ferait l'inscription : invitation, puis auth.users. */
async function compte(email, nom, organisation, role) {
	await enPostgres();
	const code = `TEST${String(++n).padStart(4, '0')}`;
	await db.query(`insert into public.invitations (code_hache, email, nom, organisation, role) values (public._hacher_code($1), $2, $3, $4, $5)`, [code, email, nom, organisation, role]);
	return valeur(`insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('code_invitation', $2::text)) returning id`, [email, code]);
}

/* ---------- Jeu de comptes ---------- */

const admin = await compte('admin@apsud.test', 'Administration de la plateforme', 'APSUD', 'super_admin');
const coord = await compte('coord@apsud.test', 'Coordination APSUD', 'APSUD', 'coordination');
const idc = await compte('saisie@idc.test', 'Saisie IDC WASH', 'IDC', 'saisie');
const ars = await compte('saisie@ars.test', 'Saisie ARS', 'ARS', 'saisie');
const IND_WASH = await valeur(`select id from public.indicateurs where volet = 'WASH-IDC' and coalesce(cible_total, 0) > 0 and type_valeur = 'nombre' order by ordre limit 1`);
const IND_NUT = await valeur(`select id from public.indicateurs where volet = 'NUT-ARS' order by ordre limit 1`);
const ACT_WASH = 'WASH-IDC:act:1.1.1';
const OP_WASH = 'WASH-IDC:op:1.1';

console.log('\nBase de la plateforme — tests de sécurité et de circuit\n');

/* ---------- Socle ---------- */

await test('Migrations et cadre logique chargés (5 volets, 50 rapports, indicateurs importés)', async () => {
	egal(Number(await valeur('select count(*) from public.volets')), 5);
	egal(Number(await valeur('select count(*) from public.rapports')), 50);
	if (Number(await valeur('select count(*) from public.indicateurs')) < 40) throw new Error('trop peu d’indicateurs');
});

/* ---------- Comptes et invitations ---------- */

await test('Inscription refusée sans code d’invitation valide', async () => {
	await refuse(db.query(`insert into auth.users (email, raw_user_meta_data) values ('intrus@x.test', '{"code_invitation":"FAUX-CODE"}')`), /invitation invalide/);
});
await test('Un code ne sert qu’une fois et seulement pour son adresse', async () => {
	await db.query(`insert into public.invitations (code_hache, email, nom, organisation, role) values (public._hacher_code('ABCD-EFGH'), 'bon@x.test', 'Saisie GADY', 'GADY', 'saisie')`);
	await refuse(db.query(`insert into auth.users (email, raw_user_meta_data) values ('autre@x.test', '{"code_invitation":"ABCD-EFGH"}')`), /invitation invalide/);
	await db.query(`insert into auth.users (email, raw_user_meta_data) values ('bon@x.test', '{"code_invitation":"abcd efgh"}')`);
	egal(await valeur(`select role from public.profils p join auth.users u on u.id = p.id where u.email = 'bon@x.test'`), 'saisie');
	await refuse(db.query(`insert into auth.users (email, raw_user_meta_data) values ('bon2@x.test', '{"code_invitation":"ABCD-EFGH"}')`), /invitation invalide/);
});
await test('Sans compte : vérifier un code est possible, lire les données ne l’est pas', async () => {
	await en(null);
	egal((await db.query(`select * from public.verifier_invitation('NIMPORTE', 'x@x.test')`)).rows.length, 0);
	await refuse(db.query('select * from public.volets'), /permission denied/);
	await refuse(db.query('select * from public.profils'), /permission denied/);
});
await test('Une ONG ne peut pas inviter ; la coordination invite une saisie mais pas un super-admin', async () => {
	await en(idc);
	await refuse(db.query(`select public.creer_invitation('a@b.test', 'Saisie IDC 2', '', 'IDC', 'saisie')`), /Seule la coordination/);
	await en(coord);
	const code = await valeur(`select public.creer_invitation('nouvelle@idc.test', 'Saisie IDC 2', '', 'IDC', 'saisie')`);
	if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) throw new Error(`code mal formé : ${code}`);
	await refuse(db.query(`select public.creer_invitation('chef@apsud.test', 'X Y', '', 'APSUD', 'super_admin')`), /Seul le super-administrateur/);
	// Le code n'est jamais lisible, même par la coordination.
	await refuse(db.query('select code_hache from public.invitations'), /permission denied/);
});
await test('Invitations : toute messagerie acceptée (Gmail, Yahoo, majuscules, alias), extension en chiffres refusée', async () => {
	await en(admin);
	const inviter = (email) => valeur(`select public.creer_invitation($1, 'Personne Test', '', 'GADY', 'saisie')`, [email]);
	for (const email of ['jean.dupont@gmail.com', 'Awa.Kone@Yahoo.FR', 'contact+rapports@ong-gady.org', 'chef.projet@sous.domaine.org.cf', 'equipe@ong.com']) {
		const code = await inviter(email);
		if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) throw new Error(`refusée à tort : ${email}`);
	}
	await enPostgres();
	egal(await valeur(`select email from public.invitations where email like 'awa.kone@%'`), 'awa.kone@yahoo.fr', 'enregistrée en minuscules :');
	await en(admin);
	for (const email of ['nom@ong.90', 'sans-arobase.org', 'nom@ong', 'deux@@ong.org', 'nom avec espace@ong.org', 'nom@.org', 'nom@ong.c']) {
		await refuse(inviter(email), /Adresse e-mail incomplète/);
	}
});
await test('Invitations : la règle de l’écran (regles.ts) et celle de la base donnent les mêmes réponses', async () => {
	const { estEmailValide } = await import('../../src/lib/donnees/regles.ts');
	for (const email of ['jean.dupont@gmail.com', 'Awa.Kone@Yahoo.FR', ' contact+suivi@ong.org ', 'nom@ong.90', 'nom@ong', 'nom avec espace@ong.org', 'a@b.co', 'x@-ong.org']) {
		const base = await valeur(`select public._email_valide($1)`, [email]);
		egal(estEmailValide(email), base, `${email} :`);
	}
});
await test('Amorçage du super-admin impossible depuis l’application', async () => {
	await en(admin);
	await refuse(db.query(`select public.amorcer_super_admin('x@y.test', 'X Y')`), /permission denied/);
});

/* ---------- Écriture directe interdite ---------- */

await test('Aucune écriture directe dans les tables, même pour le super-admin', async () => {
	await en(admin);
	await refuse(db.query(`update public.volets set cadre_verrouille = true`), /permission denied/);
	await refuse(db.query(`insert into public.depenses (activite_id, volet, mois, montant, libelle, auteur) values ('${ACT_WASH}', 'WASH-IDC', '2026-11', 5, 'x', '${admin}')`), /permission denied/);
	await refuse(db.query(`delete from public.activites`), /permission denied/);
});

/* ---------- Droits par organisation ---------- */

await test('Une ONG saisit dans son volet', async () => {
	await en(idc);
	await db.query(`select public.enregistrer_valeur($1, 'val-1', $2, '2026-11', null, null, null, null, 40, null)`, [ev(), IND_WASH]);
	egal(Number(await valeur(`select total from public.valeurs where id = 'val-1'`)), 40);
	egal(await valeur(`select statut from public.rapports where id = 'WASH-IDC:2026-11'`), 'brouillon', 'rapport passé en brouillon :');
});
await test('Une ONG ne peut pas écrire dans le volet d’une autre', async () => {
	await en(idc);
	await refuse(db.query(`select public.enregistrer_valeur($1, null, $2, '2026-11', null, null, null, null, 3, null)`, [ev(), IND_NUT]), /ne peut pas modifier le volet NUT-ARS/);
	await refuse(db.query(`select public.ajouter_depense($1, null, 'NUT-ARS:act:1.1.1', '2026-11', 10, 'Transport')`, [ev()]), /ne peut pas modifier/);
});
await test('Trois rôles seulement : le rôle « lecture » est refusé partout', async () => {
	await refuse(db.query(`insert into public.invitations (code_hache, email, nom, organisation, role) values ('x', 'l@x.test', 'Direction', 'APSUD', 'lecture')`), /invitations_role_check/);
	await en(admin);
	await refuse(db.query(`select public.creer_invitation('l@x.test', 'Direction', '', 'APSUD', 'lecture')`), /Rôle inconnu/);
});
await test('Une ONG lit tout le consortium (D3) mais n’écrit que chez elle', async () => {
	await en(ars);
	egal(Number(await valeur('select count(*) from public.volets')), 5);
	await refuse(db.query(`select public.enregistrer_valeur($1, null, $2, '2026-11', null, null, null, null, 3, null)`, [ev(), IND_WASH]), /ne peut pas modifier le volet WASH-IDC/);
});
await test('Contrôles de saisie : négatifs, décimales et pourcentages refusés', async () => {
	await en(idc);
	await refuse(db.query(`select public.enregistrer_valeur($1, null, $2, '2026-11', null, null, null, null, -1, null)`, [ev(), IND_WASH]), /nombres positifs/);
	await refuse(db.query(`select public.enregistrer_valeur($1, null, $2, '2026-11', null, null, null, null, 2.5, null)`, [ev(), IND_WASH]), /entiers/);
	await refuse(db.query(`select public.ajouter_depense($1, null, $2, '2026-11', 0, 'Transport')`, [ev(), ACT_WASH]), /montant/);
});

/* ---------- Versions et rejeu ---------- */

await test('Une valeur modifiée crée une version ; l’ancienne reste lisible', async () => {
	await en(idc);
	await db.query(`select public.enregistrer_valeur($1, 'val-2', $2, '2026-11', null, null, null, null, 55, 'corrigé')`, [ev(), IND_WASH]);
	const v = (await db.query(`select version, courante, total from public.valeurs where indicateur_id = $1 and mois = '2026-11' order by version`, [IND_WASH])).rows;
	egal(v.map((x) => [x.version, x.courante, Number(x.total)]), [[1, false, 40], [2, true, 55]]);
});
await test('Un envoi rejoué (même événement) ne crée pas de doublon', async () => {
	await en(idc);
	const e = ev();
	await db.query(`select public.ajouter_depense($1, 'dep-1', $2, '2026-11', 120, 'Transport')`, [e, ACT_WASH]);
	await db.query(`select public.ajouter_depense($1, 'dep-1', $2, '2026-11', 120, 'Transport')`, [e, ACT_WASH]);
	egal(Number(await valeur(`select count(*) from public.depenses where id = 'dep-1'`)), 1);
});

/* ---------- Notifications ---------- */

await test('Notifications : la coordination est prévenue, pas l’autre ONG ni l’auteur', async () => {
	await en(idc);
	const e = ev();
	await db.query(`select public.ajouter_tache($1, 'tache-1', $2, 'Ciblage des ménages', null, '2026-11-10', '2026-11-20')`, [e, ACT_WASH]);
	await enPostgres();
	const dest = (await db.query(`select destinataire from public.notifications where evenement_id = $1`, [e])).rows.map((r) => r.destinataire);
	if (!dest.includes(coord) || !dest.includes(admin)) throw new Error('coordination ou super-admin non notifiés');
	if (dest.includes(ars) || dest.includes(idc)) throw new Error('notification envoyée à tort');
});
await test('Chacun ne voit que ses propres notifications', async () => {
	await en(ars);
	egal(Number(await valeur('select count(*) from public.notifications where destinataire <> auth.uid()')), 0);
	await en(coord);
	if (Number(await valeur('select count(*) from public.notifications')) === 0) throw new Error('la coordination devrait en voir');
	await db.query(`select public.marquer_lu(null)`);
	egal(Number(await valeur('select count(*) from public.notifications where not lue')), 0);
});

/* ---------- Circuit de validation ---------- */

await test('Une ONG ne valide pas son propre rapport', async () => {
	await en(idc);
	await db.query(`select public.changer_statut_rapport($1, 'WASH-IDC', '2026-11', 'soumis', null)`, [ev()]);
	await refuse(db.query(`select public.changer_statut_rapport($1, 'WASH-IDC', '2026-11', 'valide', null)`, [ev()]), /Action impossible/);
});
await test('Renvoi pour correction refusé sans motif', async () => {
	await en(coord);
	await refuse(db.query(`select public.changer_statut_rapport($1, 'WASH-IDC', '2026-11', 'a_corriger', '  ')`, [ev()]), /motif/);
});
await test('Rapport vide : soumission refusée', async () => {
	await en(idc);
	await refuse(db.query(`select public.changer_statut_rapport($1, 'WASH-IDC', '2026-12', 'soumis', null)`, [ev()]), /rapport est vide/);
});
await test('Après validation, plus aucune saisie sur le mois', async () => {
	await en(coord);
	await db.query(`select public.changer_statut_rapport($1, 'WASH-IDC', '2026-11', 'valide', null)`, [ev()]);
	await en(idc);
	await refuse(db.query(`select public.enregistrer_valeur($1, null, $2, '2026-11', null, null, null, null, 60, null)`, [ev(), IND_WASH]), /validé ou verrouillé/);
	await refuse(db.query(`select public.ajouter_depense($1, null, $2, '2026-11', 10, 'Transport')`, [ev(), ACT_WASH]), /validé ou verrouillé/);
});
await test('Cadre logique verrouillé : l’ONG ne crée plus d’activité, la coordination si', async () => {
	await en(coord);
	await db.query(`select public.definir_verrou_cadre($1, 'WASH-IDC', true)`, [ev()]);
	await en(idc);
	await refuse(db.query(`select public.ajouter_activite($1, null, $2, 'Nouvelle activité', 100, null)`, [ev(), OP_WASH]), /verrouillé par APSUD/);
	await en(coord);
	await db.query(`select public.ajouter_activite($1, 'act-coord', $2, 'Suivi conjoint', 0, null)`, [ev(), OP_WASH]);
	if (!(await valeur(`select numero from public.activites where id = 'act-coord'`)).startsWith('1.1.')) throw new Error('numérotation inattendue');
});

/* ---------- Archivage, suppression ---------- */

await test('Une ONG archive ses éléments mais pas ceux d’une autre, ni ne restaure', async () => {
	await en(idc);
	await db.query(`select public.archiver($1, 'tache', 'tache-1')`, [ev()]);
	if (!(await valeur(`select archive_le from public.taches where id = 'tache-1'`))) throw new Error('non archivée');
	await refuse(db.query(`select public.archiver($1, 'activite', 'NUT-ARS:act:1.1.1')`, [ev()]), /votre organisation/);
	await refuse(db.query(`select public.restaurer($1, 'tache', 'tache-1')`, [ev()]), /Seule la coordination/);
});
await test('La coordination ne supprime pas définitivement', async () => {
	await en(coord);
	await refuse(db.query(`select public.supprimer_definitivement($1, 'tache', 'tache-1')`, [ev()]), /seul le super-administrateur/);
});
await test('Le super-admin supprime, et la suppression est inscrite aux deux journaux', async () => {
	await en(admin);
	const e = ev();
	await db.query(`select public.supprimer_definitivement($1, 'tache', 'tache-1')`, [e]);
	await enPostgres();
	egal(Number(await valeur(`select count(*) from public.taches where id = 'tache-1'`)), 0);
	egal(await valeur(`select type from public.journal where id = $1`, [e]), 'element_supprime');
	egal(Number(await valeur(`select count(*) from public.journal_audit where table_nom = 'taches' and ligne_id = 'tache-1' and action = 'DELETE'`)), 1);
});

/* ---------- Journaux inaltérables ---------- */

await test('Le fil d’activité et le journal d’audit sont inaltérables, même pour le propriétaire de la base', async () => {
	await enPostgres();
	await refuse(db.query(`update public.journal set resume = 'falsifié'`), /ajout seul/);
	await refuse(db.query(`delete from public.journal`), /ajout seul/);
	await refuse(db.query(`delete from public.journal_audit`), /ajout seul/);
	await refuse(db.query(`truncate public.journal_audit`), /ajout seul/);
});
await test('Le journal d’audit trace l’ancienne et la nouvelle valeur ; seul le super-admin le lit', async () => {
	await enPostgres();
	const champs = await valeur(`select champs_modifies from public.journal_audit where table_nom = 'volets' and action = 'UPDATE' order by id desc limit 1`);
	egal(champs, ['cadre_verrouille']);
	await en(coord);
	egal(Number(await valeur('select count(*) from public.journal_audit')), 0, 'invisible pour la coordination :');
	await en(admin);
	if (Number(await valeur('select count(*) from public.journal_audit')) === 0) throw new Error('le super-admin devrait le lire');
});

/* ---------- Calendrier, 5W ---------- */

await test('Calendrier : cocher « réalisé » coche aussi « prévu » ; l’appel est rejouable', async () => {
	await en(idc);
	await db.query(`select public.ajouter_tache($1, 'tache-2', $2, 'Distribution', null, null, null)`, [ev(), ACT_WASH]);
	await db.query(`select public.definir_semaine($1, 'tache-2', '2026-12', 2::smallint, 'realise', true)`, [ev()]);
	await db.query(`select public.definir_semaine($1, 'tache-2', '2026-12', 2::smallint, 'realise', true)`, [ev()]);
	egal(await ligne(`select prevu, realise from public.taches_semaines where tache_id = 'tache-2'`), { prevu: true, realise: true });
});
await test('5W : fiche obligatoire, puis ligne contrôlée (personnes atteintes requises)', async () => {
	await en(idc);
	const champs = { prefecture: 'Ouham', sous_prefecture: 'Nanga Boguila', filles: 12, femmes: 30 };
	await db.query(`select public.enregistrer_fiche_5w($1, $2, $3)`, [ev(), ACT_WASH, { activite_cluster: "Eau|07. Rehabilitation d'un forage existant", modalite: 'Implementation directe', type_beneficiaire: 'Retournés', reponse: 'Conflit', partenaires: '' }]);
	await refuse(db.query(`select public.ajouter_ligne_5w($1, null, $2, '2026-12', $3)`, [ev(), ACT_WASH, { prefecture: 'Ouham', sous_prefecture: 'Nanga Boguila' }]), /personnes atteintes/);
	await db.query(`select public.ajouter_ligne_5w($1, 'l5w-1', $2, '2026-12', $3)`, [ev(), ACT_WASH, champs]);
	await db.query(`select public.modifier_ligne_5w($1, 'l5w-1', $2)`, [ev(), { ...champs, garcons: 9, volet: 'NUT-ARS' }]);
	egal(await ligne(`select volet, garcons from public.lignes_5w where id = 'l5w-1'`), { volet: 'WASH-IDC', garcons: 9 }, 'le volet ne se change pas :');
});

/* ---------- Stockage ---------- */

await test('Justificatifs : dépôt dans le dossier de son organisation seulement, aucune suppression', async () => {
	await en(idc);
	await db.query(`insert into storage.objects (bucket_id, name) values ('justificatifs', 'IDC/2026-12/j1-photo.jpg')`);
	await refuse(db.query(`insert into storage.objects (bucket_id, name) values ('justificatifs', 'ARS/2026-12/j2.pdf')`), /row-level security/);
	const supprimes = await db.query(`delete from storage.objects where name like 'IDC/%'`);
	egal(supprimes.affectedRows ?? 0, 0, 'suppression sans effet :');
});

await test('Justificatifs : documents acceptés (PDF, Excel), photos refusées', async () => {
	await en(idc);
	const appel = (nom, type) => db.query(`select public.ajouter_justificatif($1, null, 'WASH-IDC', '2027-01', 'indicateur', $2, $3, $4, 1000, 'images', null)`, [ev(), IND_WASH, nom, type]);
	await appel('fiches-depistage.pdf', 'application/pdf');
	await appel('suivi.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
	await refuse(appel('photo-forage.jpg', 'image/jpeg'), /photos ne sont pas acceptées/);
	await refuse(appel('IMG_2041.HEIC', ''), /photos ne sont pas acceptées/);
	await enPostgres();
	const types = await valeur(`select allowed_mime_types::text from storage.buckets where id = 'justificatifs'`);
	if (types.includes('image/')) throw new Error('le stockage accepte encore des images : ' + types);
});

/* ---------- Nouvelle ONG ---------- */

await test('Nouvelle ONG : seul le super-admin l’ajoute, avec son rôle, son volet et ses 10 rapports', async () => {
	await en(coord);
	await refuse(db.query(`select public.ajouter_volet($1, 'NOUVELLE', 'ONG Nouvelle', 'WASH', 'partenaire')`, [ev()]), /Seul le super-administrateur/);
	await en(admin);
	await refuse(db.query(`select public.ajouter_volet($1, 'ab-c', 'X', 'WASH', 'partenaire')`, [ev()]), /Sigle invalide/);
	await refuse(db.query(`select public.ajouter_volet($1, 'NOUVELLE', '', 'WASH', 'partenaire')`, [ev()]), /nom complet/);
	await refuse(db.query(`select public.ajouter_volet($1, 'NOUVELLE', 'ONG Nouvelle', 'WASH', 'patron')`, [ev()]), /Rôle inconnu/);
	await db.query(`select public.ajouter_volet($1, 'nouvelle', 'ONG Nouvelle pour l’exemple', 'WASH', 'partenaire_technique')`, [ev()]);
	egal(Number(await valeur(`select count(*) from public.rapports where volet = 'WASH-NOUVELLE'`)), 10);
	egal(await valeur(`select role_consortium from public.organisations where sigle = 'NOUVELLE'`), 'partenaire_technique', 'rôle enregistré :');
	await refuse(db.query(`select public.ajouter_volet($1, 'NOUVELLE', null, 'WASH', null)`, [ev()]), /existe déjà/);
	await db.query(`select public.ajouter_volet($1, 'NOUVELLE', null, 'EDU', null)`, [ev()]);
	egal(Number(await valeur(`select count(*) from public.volets where organisation = 'NOUVELLE'`)), 2, 'second volet (secteur Éducation) pour la même ONG :');
	await refuse(db.query(`select public.creer_invitation('saisie@nouvelle.test', 'Saisie Nouvelle', '', 'INCONNUE', 'saisie')`), /Organisation inconnue/);
});
await test('Secteurs : la base porte les secteurs du référentiel ; « Autre » ajouté par le super-admin seulement', async () => {
	const { SECTEURS_REFERENCE } = await import('../../src/lib/donnees/referentiels/secteurs.ts');
	for (const s of SECTEURS_REFERENCE) {
		const r = await ligne(`select libelle, cluster_cbpf, mots_cles from public.secteurs where code = $1`, [s.code]);
		egal([r?.libelle, r?.cluster_cbpf, r?.mots_cles], [s.libelle, s.cluster_cbpf, s.mots_cles], `${s.code} :`);
	}
	await en(coord);
	await refuse(db.query(`select public.ajouter_secteur($1, 'APICUL', 'Apiculture')`, [ev()]), /Seul le super-administrateur/);
	await en(admin);
	await refuse(db.query(`select public.ajouter_secteur($1, 'a b', 'Apiculture')`, [ev()]), /Code de secteur invalide/);
	await refuse(db.query(`select public.ajouter_secteur($1, 'EAU2', 'Eau, hygiène et assainissement')`, [ev()]), /déjà ce nom/);
	await db.query(`select public.ajouter_secteur($1, 'APICUL', 'Apiculture et produits forestiers')`, [ev()]);
	await refuse(db.query(`select public.ajouter_secteur($1, 'APICUL', 'Autre libellé')`, [ev()]), /existe déjà/);
	await db.query(`select public.ajouter_volet($1, 'NOUVELLE', null, 'APICUL', null)`, [ev()]);
	egal(Number(await valeur(`select count(*) from public.rapports where volet = 'APICUL-NOUVELLE'`)), 10, 'volet sur le nouveau secteur :');
});
await test('Organisations : nom, rôle et logo modifiés par le super-admin seulement ; logos publics, déposés par lui seul', async () => {
	await en(coord);
	await refuse(db.query(`select public.modifier_organisation($1, 'NOUVELLE', 'ONG Nouvelle', 'associe', null)`, [ev()]), /Seul le super-administrateur/);
	await en(admin);
	await refuse(db.query(`select public.modifier_organisation($1, 'NOUVELLE', 'ONG Nouvelle', 'associe', 'javascript:alert(1)')`, [ev()]), /Adresse de logo invalide/);
	await db.query(`select public.modifier_organisation($1, 'nouvelle', 'ONG Nouvelle', 'associe', 'https://exemple.supabase.co/storage/v1/object/public/logos/NOUVELLE/logo.png')`, [ev()]);
	const o = await ligne(`select role_consortium, logo_url from public.organisations where sigle = 'NOUVELLE'`);
	egal(o.role_consortium, 'associe');
	if (!o.logo_url.endsWith('/logos/NOUVELLE/logo.png')) throw new Error('logo non enregistré');
	await db.query(`insert into storage.objects (bucket_id, name) values ('logos', 'NOUVELLE/logo.png')`);
	await en(coord);
	await refuse(db.query(`insert into storage.objects (bucket_id, name) values ('logos', 'ARS/logo.png')`), /row-level security/);
	// Lecture ouverte (politique « to anon, authenticated ») : vérifiée ici avec un compte sans droit d'écriture.
	egal(Number(await valeur(`select count(*) from storage.objects where bucket_id = 'logos'`)), 1, 'lecture des logos :');
});
await test('Nouvelle ONG : son compte de saisie écrit dans son volet, pas ailleurs', async () => {
	const nouvelle = await compte('saisie@nouvelle.test', 'Saisie Nouvelle', 'NOUVELLE', 'saisie');
	await en(coord);
	await db.query(`select public.definir_verrou_cadre($1, 'WASH-IDC', false)`, [ev()]);
	await en(nouvelle);
	await refuse(db.query(`select public.ajouter_tache($1, null, $2, 'Intrusion', null, null, null)`, [ev(), ACT_WASH]), /ne pouvez pas modifier/);
	egal(Number(await valeur(`select count(*) from public.volets`)), 8, 'elle lit le consortium :');
});

/* ---------- Calendrier officiel de soumission (PDF d'APSUD du 2026-11-24) ---------- */

await test('Échéances : la base porte les dates du PDF, identiques à src/lib/donnees/calendrier.ts', async () => {
	const { CALENDRIER_FH } = await import('../../src/lib/donnees/calendrier.ts');
	const { rows } = await db.query(`select mois, numero_rapport, type_rapport, libelle_rapport, to_char(echeance, 'YYYY-MM-DD') as partenaire, to_char(echeance_fh, 'YYYY-MM-DD') as fh from public.periodes order by rang`);
	egal(rows.length, CALENDRIER_FH.length, 'nombre de mois :');
	for (const c of CALENDRIER_FH) {
		const r = rows.find((x) => x.mois === c.mois);
		egal([r?.numero_rapport, r?.type_rapport, r?.libelle_rapport, r?.partenaire, r?.fh], [c.numero, c.type, c.libelle, c.partenaire, c.fh], `${c.mois} :`);
	}
	egal(await valeur(`select to_char(echeance, 'YYYY-MM-DD') from public.periodes where mois = '2026-11'`), '2026-12-02', 'premier rapport :');
});

/* ---------- Planification du mois suivant (cahier des charges APSUD, §3.4) ---------- */

await test('Planification M+1 : l’ONG coche ses activités, les autres sont « non prévues », l’appel est rejouable', async () => {
	await en(idc);
	const e = ev();
	await db.query(`select public.planifier_mois($1, 'WASH-IDC', '2027-01', array[$2])`, [e, ACT_WASH]);
	await db.query(`select public.planifier_mois($1, 'WASH-IDC', '2027-01', array[$2])`, [e, ACT_WASH]);
	egal(Number(await valeur(`select count(*) from public.planifications where volet = 'WASH-IDC' and mois = '2027-01' and prevue`)), 1, 'une seule prévue :');
	const total = Number(await valeur(`select count(*) from public.activites where volet = 'WASH-IDC' and archive_le is null`));
	egal(Number(await valeur(`select count(*) from public.planifications where volet = 'WASH-IDC' and mois = '2027-01'`)), total, 'une ligne par activité :');
	egal(Number(await valeur(`select count(*) from public.journal where type = 'planification_validee' and volet = 'WASH-IDC'`)), 1, 'une seule trace au fil :');
	// Nouvelle validation : la sélection est remplacée, rien n'est supprimé.
	await db.query(`select public.planifier_mois($1, 'WASH-IDC', '2027-01', '{}')`, [ev()]);
	egal(Number(await valeur(`select count(*) from public.planifications where volet = 'WASH-IDC' and mois = '2027-01' and prevue`)), 0);
	egal(Number(await valeur(`select count(*) from public.planifications where volet = 'WASH-IDC' and mois = '2027-01'`)), total);
});
await test('Planification M+1 : refusée hors de son volet, pour une activité d’un autre volet, et après soumission', async () => {
	await en(ars);
	await refuse(db.query(`select public.planifier_mois($1, 'WASH-IDC', '2027-01', '{}')`, [ev()]), /ne peut pas planifier/);
	await en(idc);
	await refuse(db.query(`select public.planifier_mois($1, 'WASH-IDC', '2027-01', array['NUT-ARS:act:1.1.1'])`, [ev()]), /n’appartient pas au volet/);
	await refuse(db.query(`select public.planifier_mois($1, 'WASH-IDC', '2031-01', '{}')`, [ev()]), /ne fait pas partie du projet/);
	await enPostgres();
	await db.query(`update public.rapports set statut = 'soumis' where volet = 'WASH-IDC' and mois = '2027-02'`);
	await en(idc);
	await refuse(db.query(`select public.planifier_mois($1, 'WASH-IDC', '2027-02', '{}')`, [ev()]), /déjà soumis ou validé/);
	await refuse(db.query(`insert into public.planifications (id, activite_id, volet, mois, prevue, valide_par) values ('x', $1, 'WASH-IDC', '2027-03', true, $2)`, [ACT_WASH, idc]), /permission denied/);
});

/* ---------- Comptes ---------- */

await test('Comptes : seul le super-admin désactive, et jamais lui-même', async () => {
	await en(coord);
	await refuse(db.query(`select public.modifier_compte($1, 'saisie', false)`, [ars]), /Seul le super-administrateur/);
	await en(admin);
	await refuse(db.query(`select public.modifier_compte($1, 'lecture', true)`, [admin]), /propres droits/);
	await db.query(`select public.modifier_compte($1, 'saisie', false)`, [ars]);
	await en(ars);
	egal(Number(await valeur('select count(*) from public.volets')), 0, 'un compte désactivé ne lit plus rien :');
	await refuse(db.query(`select public.marquer_lu(null)`), /compte actif/);
});

/* ---------- Bilan ---------- */

console.log(`\n${reussis} réussi${reussis > 1 ? 's' : ''}, ${echecs.length} échec${echecs.length > 1 ? 's' : ''}.`);
process.exit(echecs.length ? 1 : 0);
