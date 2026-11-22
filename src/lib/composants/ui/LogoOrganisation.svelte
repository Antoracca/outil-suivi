<script lang="ts">
	import type { Sigle } from '#lib/donnees/types.ts';
	import './LogoOrganisation.css';

	/**
	 * Logo réel d'une organisation du consortium (fichiers fournis par APSUD, dans static/logos/).
	 * Une ONG ajoutée plus tard, dont on n'a pas encore le logo, est représentée par son
	 * sigle dans la même pastille, jusqu'à l'ajout de son fichier ici.
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
	const fichier = $derived(FICHIERS[sigle]);
</script>

<span class="c-logo-org c-logo-org--{taille}" class:c-logo-org--sigle={!fichier}>
	{#if fichier}
		<img src={fichier} {alt} loading="lazy" decoding="async" />
	{:else}
		<span class="c-logo-org__sigle" aria-hidden={alt ? undefined : 'true'}>{sigle.slice(0, 5)}</span>
	{/if}
</span>
