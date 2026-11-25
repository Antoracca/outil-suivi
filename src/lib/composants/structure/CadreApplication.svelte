<script lang="ts">
	import type { Snippet } from 'svelte';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { alertes } from '#lib/donnees/push.svelte.ts';
	import { afterNavigate } from '$app/navigation';
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import ConsentementAnalytique from './ConsentementAnalytique.svelte';
	import BarreLaterale from './BarreLaterale.svelte';
	import BarreContexte from './BarreContexte.svelte';
	import TiroirNotifications from './TiroirNotifications.svelte';
	import NotificationsSurgissantes from './NotificationsSurgissantes.svelte';
	import NotificationsArrivee from './NotificationsArrivee.svelte';
	import BandeauHorsLigne from './BandeauHorsLigne.svelte';
	import BarreBasse from './BarreBasse.svelte';
	import './CadreApplication.css';

	interface Props {
		children: Snippet;
	}
	let { children }: Props = $props();

	// Alertes de l'appareil : état relu à chaque connexion ; en mode réel, l'abonnement
	// existant est rattaché au compte connecté (changement de compte sur le même appareil).
	$effect(() => {
		if (!depot.pret || !depot.utilisateurId) return;
		void alertes.actualiser(depot.source === 'reel').catch(() => undefined);
	});

	// Mesure d'utilisation : choix relu à chaque connexion, demande à l'arrivée (3 fois au plus).
	$effect(() => {
		if (!depot.pret || !depot.utilisateurId) return;
		void collecte.demarrer(depot.utilisateurId, depot.source).catch(() => undefined);
	});
	afterNavigate(({ to }) => {
		if (to?.url) collecte.page(to.url.pathname);
	});
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
<ConsentementAnalytique />
<NotificationsArrivee />
<!-- Annonces aux lecteurs d'écran : enregistrements, mises à jour en direct. -->
<p class="u-visuellement-masque" role="status" aria-live="polite">{depot.annonce}</p>
