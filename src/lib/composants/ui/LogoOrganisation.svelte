<script lang="ts">
	import type { Sigle } from '#lib/donnees/types.ts';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import './LogoOrganisation.css';

	/**
	 * Logo d'une organisation : celui déposé par le super-administrateur (Administration ›
	 * Organisations, mis à jour en temps réel chez tous), sinon le fichier fourni par APSUD
	 * (static/logos/), sinon le sigle dans la même pastille.
	 */
	const FICHIERS: Record<string, string> = {
		APSUD: '/logos/apsud.jpg',
		ARS: '/logos/ars.jpg',
		AFPE: '/logos/afpe.jpg',
		GADY: '/logos/gady.png',
		IDC: '/logos/idc.jpg'
	};

	interface Props {
		sigle: Sigle;
		taille?: 'sm' | 'md' | 'lg';
		/** Texte alternatif ; vide par défaut car le sigle est presque toujours écrit à côté. */
		alt?: string;
	}
	let { sigle, taille = 'md', alt = '' }: Props = $props();
	const fichier = $derived(depot.etat.organisations.find((o) => o.sigle === sigle)?.logo_url || FICHIERS[sigle]);
</script>

<span class="c-logo-org c-logo-org--{taille}" class:c-logo-org--sigle={!fichier}>
	{#if fichier}
		<img src={fichier} {alt} loading="lazy" decoding="async" />
	{:else}
		<span class="c-logo-org__sigle" aria-hidden={alt ? undefined : 'true'}>{sigle.slice(0, 5)}</span>
	{/if}
</span>
