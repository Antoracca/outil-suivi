<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import type { NomIcone } from '#lib/icones/icones.ts';
	import './EtatVide.css';

	/** État vide : une phrase qui invite à agir et, au plus, un bouton. */
	interface Props {
		icone?: NomIcone;
		titre: string;
		texte?: string;
		action?: Snippet;
	}
	let { icone = 'info', titre, texte, action }: Props = $props();
</script>

<div class="c-vide">
	<span class="c-vide__icone"><Icone nom={icone} taille="lg" /></span>
	<p class="c-vide__titre">{titre}</p>
	{#if texte}<p class="c-vide__texte">{texte}</p>{/if}
	{#if action}<div class="c-vide__action">{@render action()}</div>{/if}
</div>
