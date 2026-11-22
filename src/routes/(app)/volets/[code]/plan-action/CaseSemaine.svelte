<script lang="ts">
	import Icone from '#lib/icones/Icone.svelte';
	import './CaseSemaine.css';

	/**
	 * Case de semaine du calendrier S1-S5 (DESIGN.md, week-cell) :
	 * vide = contour fin ; prévu = fond Pousse et contour Vert ; réalisé = fond Vert et coche blanche.
	 * En mode « lecture », la case résume une activité (union de ses tâches) et n'est pas cliquable.
	 */
	interface Props {
		prevu?: boolean;
		realise?: boolean;
		/** Libellé accessible complet de la case cliquable. */
		libelle?: string;
		/** État du champ que le clic va basculer (aria-pressed). */
		pressee?: boolean;
		/** Faux : case lisible mais désactivée (lecture seule). */
		actif?: boolean;
		/** Case de résumé (ligne d'activité) : jamais cliquable. */
		lecture?: boolean;
		/** Texte pour les lecteurs d'écran d'une case de résumé. */
		texte?: string;
		/** Libellé visible sous la case (liste mobile : « S1 »…). */
		etiquette?: string;
		onbasculer?: () => void;
	}
	let { prevu = false, realise = false, libelle = '', pressee = false, actif = false, lecture = false, texte, etiquette, onbasculer }: Props = $props();
</script>

{#snippet pastille()}
	<span class="p-plan-action__pastille" class:is-prevu={prevu && !realise} class:is-realise={realise} aria-hidden="true">
		{#if realise}<Icone nom="valider" taille="sm" />{/if}
	</span>
{/snippet}

{#if lecture}
	<span class="p-plan-action__case p-plan-action__case--lecture">
		{@render pastille()}
		{#if texte}<span class="u-visuellement-masque">{texte}</span>{/if}
	</span>
{:else}
	<button
		type="button"
		class="p-plan-action__case"
		class:p-plan-action__case--etiquette={!!etiquette}
		aria-pressed={pressee}
		aria-label={etiquette ? `${etiquette} : ${libelle}` : libelle}
		disabled={!actif}
		onclick={onbasculer}
	>
		{@render pastille()}
		{#if etiquette}<span class="p-plan-action__case-etiquette" aria-hidden="true">{etiquette}</span>{/if}
	</button>
{/if}
