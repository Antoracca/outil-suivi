/**
 * Assemble les migrations (dans l'ordre) en UN fichier à coller dans l'éditeur SQL de
 * Supabase, pour installer la base sans outil en ligne de commande :
 *   supabase/installation/1-schema.sql ← toutes les migrations, cadre logique provisoire compris
 * (méthode recommandée : la CLI, npx supabase db push — voir docs/MISE-EN-SERVICE.md)
 * Usage : npm run base:assembler
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dossier = resolve(racine, 'supabase/migrations');
const sortie = resolve(racine, 'supabase/installation');
mkdirSync(sortie, { recursive: true });
const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const corps = fichiers.map((f) => `-- >>>>>>>>>> ${f}\n${readFileSync(resolve(dossier, f), 'utf8')}`).join('\n\n');
writeFileSync(
	resolve(sortie, '1-schema.sql'),
	`-- Installation complète du schéma (généré par npm run base:assembler, ne pas modifier à la main).\n-- À coller UNE fois dans Supabase › SQL Editor, sur un projet neuf.\n-- ${fichiers.length} migrations : ${fichiers.join(', ')}\n\n${corps}`,
	'utf8'
);
console.log(`Écrit : supabase/installation/1-schema.sql (${fichiers.length} migrations)`);
