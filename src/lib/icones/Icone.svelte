<script lang="ts">
	import { ICONES, type NomIcone } from './icones';
	import './Icone.css';

	interface Props {
		nom: NomIcone;
		/** Texte pour les lecteurs d'écran ; sans lui, l'icône est décorative. */
		titre?: string;
		taille?: 'sm' | 'md' | 'lg';
	}
	let { nom, titre, taille = 'md' }: Props = $props();
</script>

<svg
	class="c-icone c-icone--{taille}"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden={titre ? undefined : 'true'}
	role={titre ? 'img' : undefined}
	focusable="false"
>
	{#if titre}<title>{titre}</title>{/if}
	{#each ICONES[nom] as d (d)}
		<path {d} />
	{/each}
</svg>
