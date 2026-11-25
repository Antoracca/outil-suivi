<script lang="ts">
	import { nombre } from '#lib/format.ts';
	import './CarteHeures.css';

	/** Heures d'activité (heure de Bangui) : 24 cases, intensité séquentielle d'une seule teinte. */
	interface Props {
		heures: number[];
	}
	let { heures }: Props = $props();
	const max = $derived(Math.max(1, ...heures));
	const pic = $derived(heures.indexOf(Math.max(...heures)));
</script>

<figure class="c-heures">
	<div class="c-heures__grille" role="img" aria-label="Activité par heure (heure de Bangui) : maximum vers {pic} h.">
		{#each heures as n, h (h)}
			<span class="c-heures__case" style:--_p="{Math.round((n / max) * 100)}%" title="{h} h : {nombre(n)} événement{n > 1 ? 's' : ''}"></span>
		{/each}
	</div>
	<div class="c-heures__axe" aria-hidden="true"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>
	<figcaption class="c-heures__legende"><span class="c-heures__degrade" aria-hidden="true"></span> Moins → plus d’activité · heure de Bangui</figcaption>
</figure>
