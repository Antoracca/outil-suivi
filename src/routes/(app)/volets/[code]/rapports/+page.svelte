<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';

	// Ancienne adresse « Rapports mensuels » : l'onglet Activités du mois sélectionné.
	$effect(() => {
		goto(`/volets/${page.params.code}/activites/${contexte.mois}`, { replace: true });
	});
</script>
