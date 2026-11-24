<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';

	// /volets/[code]/indicateurs → l'onglet ouvert sur le mois sélectionné.
	$effect(() => {
		goto(`/volets/${page.params.code}/indicateurs/${contexte.mois}`, { replace: true });
	});
</script>
