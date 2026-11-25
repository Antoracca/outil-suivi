<script lang="ts">
	import './Onglets.css';

	/**
	 * Onglets de navigation (liens) : l'onglet actif porte un trait bas Forêt.
	 * `precision` : mention secondaire courte, en petit à côté du libellé (dessous si la place manque).
	 * `nomAccessible` : nom complet lu par les lecteurs d'écran ; il doit commencer par le texte visible.
	 */
	interface Props {
		onglets: { libelle: string; href: string; actif: boolean; compteur?: number; precision?: string; nomAccessible?: string }[];
		etiquette: string;
	}
	let { onglets, etiquette }: Props = $props();
</script>

<nav class="c-onglets" aria-label={etiquette}>
	<ul role="list">
		{#each onglets as o (o.href)}
			<li>
				<a href={o.href} class="c-onglets__lien" class:is-actif={o.actif} aria-current={o.actif ? 'page' : undefined} aria-label={o.nomAccessible}>
					<span class="c-onglets__libelle">{o.libelle}</span>
					{#if o.precision}<span class="c-onglets__precision">{o.precision}</span>{/if}
					{#if o.compteur}<span class="c-onglets__compteur">{o.compteur}</span>{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
