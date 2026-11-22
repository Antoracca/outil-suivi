<script lang="ts">
	import { goto } from '$app/navigation';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { mode } from '#lib/donnees/mode.svelte.ts';
	import CadreApplication from '#lib/composants/structure/CadreApplication.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Garde : sans compte connecté dans la source choisie (démonstration ou serveur réel),
	// retour à l'écran de connexion.
	const autorise = $derived(!!depot.utilisateur && depot.source === (mode.demo ? 'demo' : 'reel'));
	$effect(() => {
		if (depot.pret && !autorise) goto('/connexion', { replace: true });
	});
</script>

{#if autorise}
	<CadreApplication>
		{@render children()}
	</CadreApplication>
{/if}
