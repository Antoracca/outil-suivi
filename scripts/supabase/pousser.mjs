/**
 * Applique les nouvelles migrations au projet Supabase en ligne, par le pooler
 * (l'hôte direct db.* est en IPv6 et injoignable d'ici, docs/MISE-EN-SERVICE.md).
 *
 * Le mot de passe de la base est demandé au clavier, masqué, et n'est jamais écrit
 * dans un fichier ni affiché. Usage : node scripts/supabase/pousser.mjs [--liste]
 *   --liste : affiche seulement l'état des migrations (local / en ligne), sans rien appliquer.
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const REF = 'npcqqivoorfwkfaznsbc';
const HOTE = 'aws-0-eu-west-1.pooler.supabase.com:5432';
const listeSeulement = process.argv.includes('--liste');

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
if (!mdp) {
	console.error('Aucun mot de passe saisi : rien n’a été fait.');
	process.exit(1);
}
const url = `postgresql://postgres.${REF}:${encodeURIComponent(mdp)}@${HOTE}/postgres`;
const args = listeSeulement ? ['migration', 'list', '--db-url', url] : ['db', 'push', '--db-url', url];
// Lancement direct du CLI installé dans le projet, sans interpréteur de commandes :
// le mot de passe n'est ni réinterprété par un shell ni conservé dans l'historique.
const cli = fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url));
const r = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
