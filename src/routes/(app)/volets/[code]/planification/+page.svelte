<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { depot } from '#lib/donnees/depot.svelte.ts';

	// /volets/[code]/planification → la planification du mois qui suit le mois sélectionné.
	$effect(() => {
		const liste = depot.etat.projet.mois;
		const i = liste.indexOf(contexte.mois);
		const cible = liste[Math.min(i + 1, liste.length - 1)] ?? contexte.mois;
		goto(`/volets/${page.params.code}/planification/${cible}`, { replace: true });
	});
</script>
