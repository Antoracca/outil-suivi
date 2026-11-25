<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { libelleMois } from '#lib/format.ts';
	import { lienEvenement, nonLuesDe, titreEvenement, type NonLue } from '#lib/donnees/notifications.ts';
	import type { Evenement } from '#lib/donnees/types.ts';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './NotificationsSurgissantes.css';

	/**
	 * Fenêtres surgissantes : chaque nouvelle notification (activité créée, valeur modifiée,
	 * rapport soumis…) apparaît en haut à droite, avec « Ouvrir » et « Marquer comme lu ».
	 * Onglet en arrière-plan et alertes autorisées sur l'appareil : alerte du navigateur en plus.
	 * Fermer la fenêtre (×) ne marque pas comme lu : la notification reste dans la cloche.
	 * Les notifications déjà là à l'ouverture de la session passent, elles, une par une dans
	 * une fenêtre modale (NotificationsArrivee).
	 */
	interface Fenetre {
		id: string;
		ev: Evenement;
	}
	const DUREE = 12_000;
	const MAX = 4;

	const nonLues = $derived(nonLuesDe(depot.etat, depot.utilisateurId));
	let fenetres = $state<Fenetre[]>([]);
	/** Notifications déjà présentées (ou déjà là à l'ouverture de la session). */
	let vues = new Set<string>();
	let compte: string | null = null;
	const minuteries = new Map<string, ReturnType<typeof setTimeout>>();

	$effect(() => {
		if (!depot.pret || !depot.utilisateurId) return;
		const liste = nonLues;
		untrack(() => synchroniser(liste));
	});

	function synchroniser(liste: NonLue[]) {
		if (compte !== depot.utilisateurId) {
			// Ouverture de session : les notifications déjà là passent par NotificationsArrivee.
			compte = depot.utilisateurId;
			vues = new Set(liste.map((x) => x.n.id));
			fenetres = [];
			return;
		}
		const nouvelles = liste.filter((x) => !vues.has(x.n.id)).reverse();
		for (const x of nouvelles) {
			vues.add(x.n.id);
			presenter(x);
		}
		// Lue ailleurs (cloche, onglet ouvert) : la fenêtre disparaît.
		const ids = new Set(liste.map((x) => x.n.id));
		if (fenetres.some((f) => !ids.has(f.id))) fenetres = fenetres.filter((f) => ids.has(f.id));
	}

	function presenter(x: NonLue) {
		fenetres = [{ id: x.n.id, ev: x.ev }, ...fenetres].slice(0, MAX);
		programmer(x.n.id);
		alerterNavigateur(x.ev);
	}

	function programmer(id: string) {
		clearTimeout(minuteries.get(id));
		minuteries.set(id, setTimeout(() => fermer(id), DUREE));
	}
	function suspendre(id: string) {
		clearTimeout(minuteries.get(id));
	}
	function fermer(id: string) {
		clearTimeout(minuteries.get(id));
		minuteries.delete(id);
		fenetres = fenetres.filter((f) => f.id !== id);
	}

	function ouvrir(f: Fenetre) {
		depot.marquerLue(f.ev.id);
		fermer(f.id);
		const lien = lienEvenement(f.ev);
		if (lien) goto(lien);
	}
	function marquerLu(f: Fenetre) {
		depot.marquerLue(f.ev.id);
		fermer(f.id);
	}

	const auteur = (ev: Evenement) => depot.nomUtilisateur(ev.auteur);
	const texte = (ev: Evenement) => `${auteur(ev)} (${ev.organisation}) ${ev.resume} ${ev.cible.libelle}`;
	const contexteEv = (ev: Evenement) => [ev.volet, ev.mois ? libelleMois(ev.mois) : null].filter(Boolean).join(' · ');

	/** Alerte du système (onglet caché ou fenêtre réduite), si l'utilisateur l'a autorisée. */
	function alerterNavigateur(ev: Evenement) {
		if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
		try {
			const n = new Notification(`${titreEvenement(ev)}${ev.volet ? ` · ${ev.volet}` : ''}`, { body: texte(ev), tag: ev.id, icon: '/logo-apsud.jpg' });
			n.onclick = () => {
				window.focus();
				depot.marquerLue(ev.id);
				const lien = lienEvenement(ev);
				if (lien) goto(lien);
				n.close();
			};
		} catch {
			/* certains navigateurs mobiles refusent les alertes hors service worker */
		}
	}
</script>

<section class="c-surgissantes" aria-label="Nouvelles notifications">
	<div role="status" aria-live="polite" class="c-surgissantes__pile">
		{#each fenetres as f (f.id)}
			<article class="c-surgissante" onmouseenter={() => suspendre(f.id)} onmouseleave={() => programmer(f.id)} onfocusin={() => suspendre(f.id)}>
				<span class="c-surgissante__logo" aria-hidden="true"><LogoOrganisation sigle={f.ev.organisation} taille="sm" /></span>
				<div class="c-surgissante__texte">
					<p class="c-surgissante__titre">{titreEvenement(f.ev)}{#if contexteEv(f.ev)}<span class="c-surgissante__contexte">{contexteEv(f.ev)}</span>{/if}</p>
					<p class="c-surgissante__corps">{texte(f.ev)}</p>
					<div class="c-surgissante__actions">
						{#if lienEvenement(f.ev)}
							<button type="button" class="c-surgissante__action c-surgissante__action--principale" onclick={() => ouvrir(f)}>Ouvrir</button>
						{/if}
						<button type="button" class="c-surgissante__action" onclick={() => marquerLu(f)}><Icone nom="valider" taille="sm" /> Marquer comme lu</button>
					</div>
				</div>
				<button type="button" class="c-surgissante__fermer" onclick={() => fermer(f.id)} aria-label="Fermer (reste dans les notifications)"><Icone nom="fermer" taille="sm" /></button>
			</article>
		{/each}
	</div>
</section>
