<script lang="ts">
	import type { Snippet } from 'svelte';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import BarreLaterale from './BarreLaterale.svelte';
	import BarreContexte from './BarreContexte.svelte';
	import TiroirNotifications from './TiroirNotifications.svelte';
	import NotificationsSurgissantes from './NotificationsSurgissantes.svelte';
	import BandeauHorsLigne from './BandeauHorsLigne.svelte';
	import BarreBasse from './BarreBasse.svelte';
	import './CadreApplication.css';

	interface Props {
		children: Snippet;
	}
	let { children }: Props = $props();
</script>

<a class="c-cadre__evitement" href="#contenu">Aller au contenu</a>
<div class="c-cadre">
	<BarreLaterale />
	<div class="c-cadre__principal">
		<BarreContexte />
		<BandeauHorsLigne />
		<main id="contenu" class="c-cadre__travail" tabindex="-1">
			{@render children()}
		</main>
	</div>
</div>
<BarreBasse />
<TiroirNotifications />
<NotificationsSurgissantes />
<!-- Annonces aux lecteurs d'écran : enregistrements, mises à jour en direct. -->
<p class="u-visuellement-masque" role="status" aria-live="polite">{depot.annonce}</p>
