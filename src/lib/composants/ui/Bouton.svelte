<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icone from '#lib/icones/Icone.svelte';
	import type { NomIcone } from '#lib/icones/icones.ts';
	import './Bouton.css';

	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		variante?: 'primaire' | 'secondaire' | 'texte' | 'danger';
		taille?: 'md' | 'sm';
		icone?: NomIcone;
		href?: string;
		children: Snippet;
	}
	let { variante = 'secondaire', taille = 'md', icone, href, children, type = 'button', ...reste }: Props = $props();
</script>

{#if href}
	<a class="c-bouton c-bouton--{variante} c-bouton--{taille}" {href}>
		{#if icone}<Icone nom={icone} taille="sm" />{/if}
		<span>{@render children()}</span>
	</a>
{:else}
	<button class="c-bouton c-bouton--{variante} c-bouton--{taille}" {type} {...reste}>
		{#if icone}<Icone nom={icone} taille="sm" />{/if}
		<span>{@render children()}</span>
	</button>
{/if}
