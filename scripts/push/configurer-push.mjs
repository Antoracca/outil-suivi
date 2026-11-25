#!/usr/bin/env node
/**
 * Mise en service des alertes push (à lancer UNE fois, par le développeur, dans un terminal).
 *
 *   1. génère la paire de clés VAPID (Node, sans dépendance) ;
 *   2. place la clé privée dans les secrets de la fonction Edge (CLI Supabase, fichier
 *      temporaire hors du dépôt, supprimé aussitôt) : elle n'est JAMAIS affichée ni écrite
 *      dans le projet ;
 *   3. déploie la fonction Edge « envoyer-push » (sans Docker, sans vérification de jeton) ;
 *   4. écrit la clé PUBLIQUE dans src/lib/donnees/reel/cle-push-publique.ts (à committer).
 *
 * Prérequis : être connecté au CLI Supabase une fois sur ce PC :
 *   node node_modules/supabase/dist/supabase.js login
 *
 * Options : --redeployer   redéploie seulement la fonction (garde les clés en place)
 *           --forcer       régénère les clés alors qu'elles existent (les appareils déjà
 *                          abonnés devront réactiver les alertes)
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const REF = 'npcqqivoorfwkfaznsbc';
const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cli = join(racine, 'node_modules', 'supabase', 'dist', 'supabase.js');
const fichierCle = join(racine, 'src', 'lib', 'donnees', 'reel', 'cle-push-publique.ts');
const args = new Set(process.argv.slice(2));

function supabase(...a) {
	const r = spawnSync(process.execPath, [cli, ...a], { cwd: racine, stdio: 'inherit' });
	return r.status === 0;
}

function deployer() {
	console.log('\n→ Déploiement de la fonction Edge « envoyer-push »…');
	if (!supabase('functions', 'deploy', 'envoyer-push', '--no-verify-jwt', '--use-api', '--project-ref', REF)) {
		console.error('✗ Déploiement impossible. Êtes-vous connecté ? node node_modules/supabase/dist/supabase.js login');
		process.exit(1);
	}
	console.log('✓ Fonction déployée.');
}

if (args.has('--redeployer')) {
	deployer();
	process.exit(0);
}

const existante = /CLE_PUSH_PUBLIQUE = '([^']+)'/.exec(readFileSync(fichierCle, 'utf8'))?.[1];
if (existante && !args.has('--forcer')) {
	console.log('Les clés sont déjà en place (clé publique présente). Pour redéployer la fonction : --redeployer ; pour régénérer les clés : --forcer.');
	process.exit(0);
}

const question = createInterface({ input: process.stdin, output: process.stdout });
const reponse = (await question.question('Adresse publique de la plateforme (https://…) [https://outil-suivi.vercel.app] : ')).trim();
question.close();
const sujet = reponse || 'https://outil-suivi.vercel.app';
if (!/^https:\/\//.test(sujet)) {
	console.error('✗ L’adresse doit commencer par https://');
	process.exit(1);
}

// Clés VAPID : courbe P-256 ; publique = point non compressé (65 octets), privée = d (32 octets), en base64url.
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwkPub = publicKey.export({ format: 'jwk' });
const jwkPriv = privateKey.export({ format: 'jwk' });
const b64u = (b) => Buffer.from(b).toString('base64url');
const publique = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwkPub.x, 'base64url'), Buffer.from(jwkPub.y, 'base64url')]));
const privee = jwkPriv.d;

console.log('\n→ Envoi des secrets à la fonction Edge (la clé privée n’est pas affichée)…');
const dossier = mkdtempSync(join(tmpdir(), `push-${randomBytes(4).toString('hex')}-`));
const fichierSecrets = join(dossier, 'secrets.env');
let ok = false;
try {
	writeFileSync(fichierSecrets, `VAPID_CLE_PUBLIQUE=${publique}\nVAPID_CLE_PRIVEE=${privee}\nVAPID_SUJET=${sujet}\n`, { mode: 0o600 });
	ok = supabase('secrets', 'set', '--env-file', fichierSecrets, '--project-ref', REF);
} finally {
	rmSync(dossier, { recursive: true, force: true });
}
if (!ok) {
	console.error('✗ Secrets non envoyés (aucune clé n’a été gardée). Connectez-vous puis relancez :\n  node node_modules/supabase/dist/supabase.js login');
	process.exit(1);
}
console.log('✓ Secrets enregistrés.');

writeFileSync(
	fichierCle,
	readFileSync(fichierCle, 'utf8').replace(/CLE_PUSH_PUBLIQUE = '[^']*'/, `CLE_PUSH_PUBLIQUE = '${publique}'`)
);
console.log('✓ Clé publique écrite dans src/lib/donnees/reel/cle-push-publique.ts');

deployer();
console.log('\nTerminé. Il reste : appliquer la migration 0015 (node scripts/supabase/pousser.mjs), puis mettre le code en ligne.');
