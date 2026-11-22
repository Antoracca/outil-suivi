<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './Alerte.css';

	/**
	 * Message en bandeau. « erreur » est annoncé immédiatement (role="alert") ;
	 * les autres variantes sont polies (role="status").
	 */
	interface Props {
		variante?: 'erreur' | 'succes' | 'info' | 'avertissement';
		titre?: string;
		children: Snippet;
		onfermer?: () => void;
	}
	let { variante = 'info', titre, children, onfermer }: Props = $props();
	const icone = $derived(variante === 'erreur' ? 'alerte' : variante === 'succes' ? 'valider' : variante === 'avertissement' ? 'alerte' : 'info');
</script>

<div class="c-alerte c-alerte--{variante}" role={variante === 'erreur' ? 'alert' : 'status'}>
	<Icone nom={icone} taille="sm" />
	<div class="c-alerte__texte">
		{#if titre}<p class="c-alerte__titre">{titre}</p>{/if}
		<div>{@render children()}</div>
	</div>
	{#if onfermer}
		<button class="c-alerte__fermer" type="button" onclick={onfermer} aria-label="Fermer le message"><Icone nom="fermer" taille="sm" /></button>
	{/if}
</div>
