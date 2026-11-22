<script lang="ts">
	import type { CodeSecteur, Sigle } from '#lib/donnees/types.ts';
	import LogoOrganisation from './LogoOrganisation.svelte';
	import './EtiquetteVolet.css';

	/** Identifie un volet : logo de l'ONG + sigle + secteur. */
	interface Props {
		secteur: CodeSecteur;
		organisation: Sigle;
		libelleSecteur: string;
		variante?: 'ligne' | 'puce';
	}
	let { secteur, organisation, libelleSecteur, variante = 'ligne' }: Props = $props();
</script>

{#if variante === 'puce'}
	<span class="c-volet-puce c-volet-puce--{secteur.toLowerCase()}">
		<LogoOrganisation sigle={organisation} taille="sm" />
		<span>{libelleSecteur}, {organisation}</span>
	</span>
{:else}
	<span class="c-volet-ligne">
		<LogoOrganisation sigle={organisation} taille="md" />
		<span class="c-volet-ligne__texte">
			<span class="c-volet-ligne__org">{organisation}</span>
			<span class="c-volet-ligne__secteur">{libelleSecteur}</span>
		</span>
	</span>
{/if}
