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
			adapter: adapter({ fallback: 'index.html' }),
			// Nouvelle version en ligne : détectée toutes les 2 minutes (et au retour sur l'onglet),
			// la navigation suivante recharge la page (src/routes/+layout.svelte).
			version: { pollInterval: 120_000 },
			// Politique de sécurité du contenu (CSP) : SvelteKit calcule l'empreinte de son script de
			// démarrage et l'écrit dans index.html. Seul le projet Supabase est joignable ; aucun script,
			// image ou cadre venu d'ailleurs. Les directives qu'une balise meta ne peut pas porter
			// (frame-ancestors) sont envoyées en en-tête par vercel.json.
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:', 'https://npcqqivoorfwkfaznsbc.supabase.co'],
					'font-src': ['self', 'data:'],
					'connect-src': ['self', 'https://npcqqivoorfwkfaznsbc.supabase.co', 'wss://npcqqivoorfwkfaznsbc.supabase.co'],
					'worker-src': ['self'],
					'manifest-src': ['self'],
					'media-src': ['self', 'blob:'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self']
				}
			}
		})
	]
});
