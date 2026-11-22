<script lang="ts">
	import type { StatutRapport } from '#lib/donnees/types.ts';
	import { LIBELLES_STATUT } from '#lib/donnees/regles.ts';
	import './MarqueurStatut.css';

	/** Statut = forme (goutte APSUD) + couleur + texte, jamais la couleur seule. */
	interface Props {
		statut: StatutRapport;
		/** Texte affiché ; par défaut le libellé du statut. */
		texte?: string;
		retard?: number;
		/** Forme seule à l'écran (le texte reste lisible par les lecteurs d'écran). */
		compact?: boolean;
	}
	let { statut, texte, retard = 0, compact = false }: Props = $props();
	const libelle = $derived(texte ?? LIBELLES_STATUT[statut]);
	const complet = $derived(retard > 0 ? libelle + ', en retard de ' + retard + (retard > 1 ? ' jours' : ' jour') : libelle);
</script>

<span
	class="c-statut c-statut--{statut}"
	class:c-statut--retard={retard > 0}
	title={compact ? complet : undefined}
>
	<span class="c-statut__forme" aria-hidden="true">
		{#if statut === 'verrouille'}
			<svg viewBox="0 0 8 8" class="c-statut__cadenas"><path d="M2 4h4v3H2z M3 4V3a1 1 0 0 1 2 0v1" /></svg>
		{/if}
	</span>
	<span class={compact ? 'u-visuellement-masque' : 'c-statut__texte'}>{complet}</span>
</span>
