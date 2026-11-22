<script lang="ts">
	import type { Snippet } from 'svelte';
	import './Panneau.css';

	/** Panneau de données : surface blanche, rayon 12 px, filet fort, sans ombre. */
	interface Props {
		titre?: string;
		sousTitre?: string;
		niveau?: 2 | 3;
		actions?: Snippet;
		children: Snippet;
		sansMarge?: boolean;
		id?: string;
	}
	let { titre, sousTitre, niveau = 2, actions, children, sansMarge = false, id }: Props = $props();

	let corps: HTMLDivElement | undefined = $state();
	let defile = $state(false);

	// Un tableau plus large que le panneau défile horizontalement : la zone devient alors
	// atteignable au clavier (WCAG 2.1.1), et seulement dans ce cas.
	$effect(() => {
		if (!corps || !sansMarge) return;
		const el = corps;
		const mesurer = () => (defile = el.scrollWidth > el.clientWidth + 1);
		mesurer();
		const ro = new ResizeObserver(mesurer);
		ro.observe(el);
		return () => ro.disconnect();
	});
</script>

<section class="c-panneau" aria-labelledby={titre && id ? `${id}-titre` : undefined}>
	{#if titre || actions}
		<header class="c-panneau__tete">
			<div class="c-panneau__titres">
				{#if titre}
					<svelte:element this={`h${niveau}`} class="c-panneau__titre" id={id ? `${id}-titre` : undefined}>{titre}</svelte:element>
				{/if}
				{#if sousTitre}<p class="c-panneau__sous-titre">{sousTitre}</p>{/if}
			</div>
			{#if actions}<div class="c-panneau__actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (zone défilante : doit être atteignable au clavier, WCAG 2.1.1) -->
	<div
		bind:this={corps}
		class="c-panneau__corps"
		class:c-panneau__corps--plein={sansMarge}
		tabindex={defile ? 0 : undefined}
		role={defile ? 'group' : undefined}
		aria-label={defile ? `${titre ?? 'Tableau'} (défilement horizontal)` : undefined}
	>
		{@render children()}
	</div>
</section>
