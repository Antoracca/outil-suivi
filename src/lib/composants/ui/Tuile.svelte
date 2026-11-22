<script lang="ts">
	import type { Snippet } from 'svelte';
	import './Tuile.css';

	/** Tuile du tableau de bord : un chiffre, un libellé, un instrument en pied. */
	interface Props {
		chiffre: string;
		libelle: string;
		detail?: string;
		sombre?: boolean;
		href?: string;
		pied?: Snippet;
	}
	let { chiffre, libelle, detail, sombre = false, href, pied }: Props = $props();
</script>

<svelte:element this={href ? 'a' : 'div'} class="c-tuile" class:c-tuile--sombre={sombre} class:c-tuile--lien={!!href} {href}>
	<p class="c-tuile__chiffre">{chiffre}</p>
	<p class="c-tuile__libelle">{libelle}</p>
	{#if detail}<p class="c-tuile__detail">{detail}</p>{/if}
	{#if pied}<div class="c-tuile__pied">{@render pied()}</div>{/if}
</svelte:element>
