<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';

	// /volets/[code]/rapports → le rapport du mois sélectionné.
	$effect(() => {
		goto(`/volets/${page.params.code}/rapports/${contexte.mois}`, { replace: true });
	});
</script>
