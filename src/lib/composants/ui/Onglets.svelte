<script lang="ts">
	import './Onglets.css';

	/** Onglets de navigation (liens) : l'onglet actif porte un trait bas Forêt. */
	interface Props {
		onglets: { libelle: string; href: string; actif: boolean; compteur?: number }[];
		etiquette: string;
	}
	let { onglets, etiquette }: Props = $props();
</script>

<nav class="c-onglets" aria-label={etiquette}>
	<ul role="list">
		{#each onglets as o (o.href)}
			<li>
				<a href={o.href} class="c-onglets__lien" class:is-actif={o.actif} aria-current={o.actif ? 'page' : undefined}>
					{o.libelle}
					{#if o.compteur}<span class="c-onglets__compteur">{o.compteur}</span>{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
