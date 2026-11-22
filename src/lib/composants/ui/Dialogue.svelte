<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './Dialogue.css';

	/** Boîte de dialogue native (<dialog>) : focus piégé, Échap pour fermer. */
	interface Props {
		ouvert: boolean;
		titre: string;
		children: Snippet;
		actions?: Snippet;
		onfermer: () => void;
	}
	let { ouvert, titre, children, actions, onfermer }: Props = $props();
	let el: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!el) return;
		if (ouvert && !el.open) el.showModal();
		if (!ouvert && el.open) el.close();
	});
</script>

<dialog bind:this={el} class="c-dialogue" aria-labelledby="dialogue-titre" onclose={onfermer}>
	<header class="c-dialogue__tete">
		<h2 id="dialogue-titre" class="c-dialogue__titre">{titre}</h2>
		<button class="c-dialogue__fermer" type="button" onclick={onfermer} aria-label="Fermer">
			<Icone nom="fermer" />
		</button>
	</header>
	<div class="c-dialogue__corps">{@render children()}</div>
	{#if actions}<footer class="c-dialogue__pied">{@render actions()}</footer>{/if}
</dialog>
