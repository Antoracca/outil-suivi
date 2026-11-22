<script lang="ts">
	import type { StatutRapport } from '#lib/donnees/types.ts';
	import './EtapesCircuit.css';

	/** Indicateur d'étapes : Brouillon → Soumis → Validé → Verrouillé (DESIGN.md). */
	interface Props {
		statut: StatutRapport;
	}
	let { statut }: Props = $props();

	const ETAPES = ['Brouillon', 'Soumis', 'Validé', 'Verrouillé'];
	const rang = $derived(({ non_commence: -1, brouillon: 0, a_corriger: 0, soumis: 1, valide: 2, verrouille: 3 } as const)[statut]);
</script>

<ol class="c-etapes" aria-label="Circuit du rapport">
	{#each ETAPES as e, i (e)}
		{@const etatEtape = i < rang ? 'faite' : i === rang ? 'en-cours' : 'a-venir'}
		<li class="c-etapes__etape c-etapes__etape--{etatEtape}" aria-current={i === rang ? 'step' : undefined}>
			<span class="c-etapes__point" aria-hidden="true"></span>
			<span class="c-etapes__libelle">{i === 0 && statut === 'a_corriger' ? 'À corriger' : e}</span>
			<span class="u-visuellement-masque">{etatEtape === 'faite' ? ' (terminée)' : etatEtape === 'en-cours' ? ' (étape actuelle)' : ' (à venir)'}</span>
		</li>
	{/each}
</ol>
