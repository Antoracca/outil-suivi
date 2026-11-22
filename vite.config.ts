import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * Phase « maquette » : l'application tourne entièrement dans le navigateur
 * (données de démonstration, aucun serveur). Le build produit un dossier
 * statique `build/` hébergeable gratuitement (Cloudflare Pages, Netlify, LWS…).
 * Quand le back-end sera choisi, on changera d'adaptateur (voir ARCHITECTURE.md).
 */
export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Mode « runes » de Svelte 5 partout, sauf dans les dépendances.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: 'index.html' })
		})
	]
});
