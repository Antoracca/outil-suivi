<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { dateHeure, libelleMois, nombre, relatif } from '#lib/format.ts';
	import type { Desagregation, Evenement } from '#lib/donnees/types.ts';
	import Avatar from '#lib/composants/ui/Avatar.svelte';
	import { lienEvenement } from '#lib/donnees/notifications.ts';
	import './LigneActivite.css';

	/** Une ligne du fil d'activité : qui, quoi, sur quoi, quand. */
	interface Props {
		evenement: Evenement;
		nonLue?: boolean;
		compacte?: boolean;
	}
	let { evenement: ev, nonLue = false, compacte = false }: Props = $props();
	const auteur = $derived(depot.etat.utilisateurs.find((u) => u.id === ev.auteur));
	const maintenant = $derived(depot.maintenant());


	function ecart(avant: unknown, apres: unknown): string | null {
		const a = avant as Desagregation | null;
		const b = apres as Desagregation | null;
		if (!b || typeof b !== 'object' || !('total' in b)) return null;
		return `${a ? nombre(a.total) : 'vide'} → ${nombre(b.total)}`;
	}
	const detail = $derived(ev.type === 'valeur_modifiee' ? ecart(ev.avant, ev.apres) : null);
	const href = $derived(lienEvenement(ev));
</script>

<article class="c-ligne-activite" class:is-non-lue={nonLue} class:c-ligne-activite--compacte={compacte}>
	{#if auteur}<Avatar initiales={auteur.initiales} nom={auteur.nom} organisation={auteur.organisation} />{/if}
	<div class="c-ligne-activite__texte">
		<p>
			<strong>{auteur?.nom ?? 'Quelqu’un'}</strong>
			<span class="c-ligne-activite__org">({ev.organisation})</span>
			{ev.resume}
			{#if href}<a {href}>{ev.cible.type === 'rapport' && ev.mois ? `${ev.volet}, ${libelleMois(ev.mois)}` : ev.cible.libelle}</a>{:else}<em>{ev.cible.libelle}</em>{/if}{#if detail}<span class="c-ligne-activite__ecart"> : {detail}</span>{/if}
		</p>
		<p class="c-ligne-activite__meta">
			<time datetime={ev.date} title={dateHeure(ev.date)}>{relatif(ev.date, maintenant)}</time>
			{#if ev.mois && ev.cible.type !== 'rapport'} · rapport de {libelleMois(ev.mois)}{/if}
		</p>
	</div>
	{#if nonLue}<span class="c-ligne-activite__point" aria-label="Non lue"></span>{/if}
</article>
