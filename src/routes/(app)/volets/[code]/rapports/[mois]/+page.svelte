<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	// Ancienne adresse d'un rapport mensuel (liens déjà partagés, notifications) :
	// un lien vers un indicateur (#…) ouvre l'onglet Indicateurs, sinon l'onglet Activités.
	$effect(() => {
		const { code, mois } = page.params;
		const ancre = page.url.hash;
		goto(ancre ? `/volets/${code}/indicateurs/${mois}${ancre}` : `/volets/${code}/activites/${mois}`, { replace: true });
	});
</script>
