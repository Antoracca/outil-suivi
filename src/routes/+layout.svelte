<script lang="ts">
	import '@fontsource-variable/mona-sans/wdth.css';
	import '#lib/styles/tokens.css';
	import '#lib/styles/base.css';
	import type { LayoutProps } from './$types';
	import { beforeNavigate } from '$app/navigation';
	import { updated } from '$app/state';

	let { children }: LayoutProps = $props();

	// Après un déploiement : la navigation suivante recharge la page sur la nouvelle version,
	// au lieu de chercher d'anciens fichiers qui n'existent plus (« page introuvable »).
	beforeNavigate(({ willUnload, to }) => {
		if (updated.current && !willUnload && to?.url) location.href = to.url.href;
	});
</script>

<svelte:head>
	<link rel="icon" href="/logo-apsud.jpg" />
</svelte:head>

{@render children()}
