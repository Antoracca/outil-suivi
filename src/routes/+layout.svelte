<script lang="ts">
	import '@fontsource-variable/mona-sans/wdth.css';
	import '#lib/styles/tokens.css';
	import '#lib/styles/base.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href="/logo-apsud.jpg" />
</svelte:head>

{@render children()}
