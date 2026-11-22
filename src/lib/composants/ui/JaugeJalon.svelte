<script lang="ts">
	import { nombre, pourcent } from '#lib/format.ts';
	import './JaugeJalon.css';

	/**
	 * Signature visuelle (DESIGN.md) : le cumul (Pousse) et l'apport du mois (Vert)
	 * avancent vers un jalon de cible (Forêt). Toujours accompagnée de son texte.
	 */
	interface Props {
		cumulPrecedent: number | null;
		ceMois?: number | null;
		cible: number | null;
		unite?: string;
		type?: 'nombre' | 'pourcentage';
		grande?: boolean;
		/** Masque la ligne de texte (elle reste lisible par les lecteurs d'écran). */
		sansTexte?: boolean;
	}
	let { cumulPrecedent, ceMois = 0, cible, unite = '', type = 'nombre', grande = false, sansTexte = false }: Props = $props();

	const avant = $derived(cumulPrecedent ?? 0);
	const mois = $derived(ceMois ?? 0);
	const realise = $derived(type === 'pourcentage' ? (mois || avant) : avant + mois);
	// Échelle : la cible occupe 80 % de la piste pour laisser voir un dépassement.
	const echelle = $derived(type === 'pourcentage' ? 100 : Math.max(cible ?? 0, realise) / 0.8 || 1);
	const pctAvant = $derived(type === 'pourcentage' ? 0 : Math.min(100, (avant / echelle) * 100));
	const pctMois = $derived(type === 'pourcentage' ? Math.min(100, (realise / echelle) * 100) : Math.min(100 - pctAvant, (mois / echelle) * 100));
	const pctJalon = $derived(cible ? Math.min(100, (cible / echelle) * 100) : null);
	const taux = $derived(cible ? (realise / cible) * 100 : null);
	const texte = $derived(
		type === 'pourcentage'
			? `${pourcent(realise)} pour une cible de ${pourcent(cible)}`
			: `${nombre(realise)} sur ${nombre(cible)}${unite ? ` ${unite}` : ''}${taux !== null ? `, ${pourcent(Math.round(taux))}` : ''}`
	);
</script>

<div class="c-jauge" class:c-jauge--grande={grande}>
	<div class="c-jauge__piste" role="img" aria-label={texte}>
		<span class="c-jauge__cumul" style:inline-size="{pctAvant}%"></span>
		<span class="c-jauge__mois" style:inset-inline-start="{pctAvant}%" style:inline-size="{pctMois}%"></span>
		{#if pctJalon !== null}<span class="c-jauge__jalon" style:inset-inline-start="{pctJalon}%"></span>{/if}
	</div>
	{#if !sansTexte}
		<p class="c-jauge__texte">
			{#if type === 'pourcentage'}
				<strong>{pourcent(realise)}</strong> · cible {pourcent(cible)}
			{:else}
				<strong>{nombre(realise)}</strong> sur {nombre(cible)}{#if taux !== null}<span class="c-jauge__taux" class:is-atteint={taux >= 100}>{pourcent(Math.round(taux))}</span>{/if}
			{/if}
		</p>
	{/if}
</div>
