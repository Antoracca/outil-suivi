<script lang="ts">
	import type { Snippet } from 'svelte';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { alertes } from '#lib/donnees/push.svelte.ts';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { untrack } from 'svelte';
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import ConsentementAnalytique from './ConsentementAnalytique.svelte';
	import DemandeNotifications from './DemandeNotifications.svelte';
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
		const u = depot.utilisateur;
		void collecte.demarrer(depot.utilisateurId, depot.source, u?.organisation ?? '', u?.role ?? '').catch(() => undefined);
	});
	beforeNavigate(() => collecte.debutNavigation());
	afterNavigate(({ to }) => {
		if (to?.url) collecte.page(to.url.pathname);
	});

	// Actions métier du compte (valeur saisie, rapport soumis, justificatif ajouté…) : chaque
	// nouvel événement du fil dont il est l'auteur devient une mesure « action ».
	let dernierEvenement: string | null = null;
	$effect(() => {
		if (!depot.pret || !depot.utilisateurId) return;
		const ev = depot.etat.journal[0];
		untrack(() => {
			// Premier passage : on retient l'état actuel du fil, sans le compter.
			if (dernierEvenement === null) {
				dernierEvenement = ev?.id ?? '';
				return;
			}
			if (!ev || ev.id === dernierEvenement) return;
			dernierEvenement = ev.id;
			if (ev.auteur === depot.utilisateurId) collecte.action(ev.type, { volet: ev.volet, mois: ev.mois });
		});
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
<DemandeNotifications />
<!-- Annonces aux lecteurs d'écran : enregistrements, mises à jour en direct. -->
<p class="u-visuellement-masque" role="status" aria-live="polite">{depot.annonce}</p>
