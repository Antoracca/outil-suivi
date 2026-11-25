<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { alertes } from '#lib/donnees/push.svelte.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import LogoApsud from './LogoApsud.svelte';
	import '#lib/composants/ui/Dialogue.css';
	import './DemandeNotifications.css';

	/**
	 * Demande d'activation des notifications sur l'appareil (consigne du développeur) : dès la
	 * connexion, une fois les autres fenêtres d'arrivée réglées ; « Plus tard » la fait revenir
	 * au PROCHAIN CHANGEMENT DE PAGE, et ainsi de suite tant que ce n'est pas activé.
	 * Trois cas : à activer (bouton qui ouvre l'autorisation du navigateur), bloquées par le
	 * navigateur (marche à suivre, le site ne peut plus redemander lui-même), iPhone / iPad sans
	 * écran d'accueil (marche à suivre pour ajouter la plateforme, condition des alertes sur iOS).
	 */
	let el: HTMLDialogElement | undefined = $state();
	let ouverte = $state(false);
	let envoi = $state(false);
	let minuterie: ReturnType<typeof setTimeout> | undefined;
	let compte: string | null = null;

	const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
	const ecranAccueil = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
	const reel = $derived(depot.source === 'reel');

	/** Ce qu'il faut demander sur cet appareil, ou rien. */
	const cas = $derived.by((): 'activer' | 'bloquees' | 'ios' | null => {
		if (!alertes.verifie) return null;
		if (alertes.etat === 'a_activer') return 'activer';
		if (alertes.etat === 'bloquees') return 'bloquees';
		if (alertes.etat === 'indisponible' && ios && !ecranAccueil) return 'ios';
		return null;
	});

	$effect(() => {
		if (!el) return;
		if (ouverte && !el.open) el.showModal();
		if (!ouverte && el.open) el.close();
	});

	/** Ouvre la demande dès qu'aucune autre fenêtre n'est ouverte (consentement, annonces…). */
	function tenter(delai: number) {
		clearTimeout(minuterie);
		minuterie = setTimeout(function essai() {
			if (!cas || ouverte || !depot.utilisateurId) return;
			if (document.querySelector('dialog[open]')) {
				minuterie = setTimeout(essai, 2500);
				return;
			}
			ouverte = true;
		}, delai);
	}

	// À la connexion : quelques secondes après l'arrivée.
	$effect(() => {
		if (!depot.pret || !depot.utilisateurId || !alertes.verifie) return;
		if (compte === depot.utilisateurId) return;
		compte = depot.utilisateurId;
		tenter(4000);
	});
	// À chaque changement de page : on redemande tant que ce n'est pas activé.
	afterNavigate(({ from }) => {
		if (from) tenter(900);
	});
	// Activées ailleurs (cloche) : la demande se ferme.
	$effect(() => {
		if (!cas && ouverte) ouverte = false;
	});

	async function activer() {
		envoi = true;
		try {
			await alertes.activer(reel);
		} finally {
			envoi = false;
		}
		if (alertes.etat === 'activees_push' || alertes.etat === 'activees_local') ouverte = false;
	}
	async function verifier() {
		envoi = true;
		try {
			await alertes.actualiser(reel);
			if (alertes.etat === 'a_activer') await alertes.activer(reel);
		} finally {
			envoi = false;
		}
		if (!cas) ouverte = false;
	}
	/** « Plus tard » : fermée maintenant, elle reviendra au prochain changement de page. */
	function plusTard() {
		ouverte = false;
	}
</script>

<dialog
	bind:this={el}
	class="c-dialogue c-demande-notif"
	aria-labelledby="demande-notif-titre"
	aria-describedby="demande-notif-texte"
	oncancel={(e) => {
		e.preventDefault();
		plusTard();
	}}
	onclose={() => (ouverte = false)}
>
	{#if cas}
		<header class="c-demande-notif__tete">
			<p class="c-demande-notif__marque"><LogoApsud /> <span>Suivi consortium APSUD</span></p>
			<p class="c-demande-notif__repere"><Icone nom="notification" taille="sm" /> {cas === 'activer' ? 'Notifications' : cas === 'bloquees' ? 'Notifications bloquées' : 'iPhone et iPad'}</p>
			<h2 class="c-dialogue__titre" id="demande-notif-titre">
				{cas === 'activer' ? 'Recevez tout, instantanément' : cas === 'bloquees' ? 'Autorisez les notifications pour ce site' : 'Ajoutez la plateforme à l’écran d’accueil'}
			</h2>
		</header>

		<div class="c-dialogue__corps" id="demande-notif-texte">
			{#if cas === 'activer'}
				<p>Activez les notifications sur cet appareil pour être prévenu dès qu’il se passe quelque chose{reel && alertes.pushPossible ? ', même quand la plateforme est fermée' : ''} :</p>
				<ul class="c-demande-notif__liste">
					<li><Icone nom="valider" taille="sm" /> un rapport soumis, validé ou renvoyé pour correction ;</li>
					<li><Icone nom="valider" taille="sm" /> une activité créée, une valeur ou une pièce ajoutée dans votre volet ;</li>
					<li><Icone nom="valider" taille="sm" /> une nouvelle ONG dans le consortium et les annonces d’APSUD.</li>
				</ul>
				<p class="c-demande-notif__note">Votre navigateur va vous demander l’autorisation : choisissez « Autoriser ».</p>
			{:else if cas === 'bloquees'}
				<p>Les notifications ont été refusées pour ce site : le navigateur ne nous laisse plus les redemander. Pour les recevoir :</p>
				<ol class="c-demande-notif__etapes">
					<li>Cliquez sur l’icône à gauche de l’adresse du site (cadenas ou réglages).</li>
					<li>Dans « Notifications », choisissez « Autoriser ».</li>
					<li>Revenez ici et cliquez sur « J’ai autorisé ».</li>
				</ol>
			{:else}
				<p>Sur iPhone et iPad, les notifications ne fonctionnent que depuis l’écran d’accueil :</p>
				<ol class="c-demande-notif__etapes">
					<li>Dans Safari, touchez le bouton Partager (carré avec une flèche).</li>
					<li>Choisissez « Sur l’écran d’accueil », puis « Ajouter ».</li>
					<li>Ouvrez la plateforme depuis sa nouvelle icône et activez les notifications.</li>
				</ol>
			{/if}
			{#if alertes.erreur}<p class="c-demande-notif__erreur" role="alert"><Icone nom="alerte" taille="sm" /> {alertes.erreur}</p>{/if}
			<p class="c-demande-notif__note">« Plus tard » : nous vous le redemanderons à la page suivante.</p>
		</div>

		<footer class="c-dialogue__pied c-demande-notif__pied">
			<Bouton variante="secondaire" disabled={envoi} onclick={plusTard}>Plus tard</Bouton>
			{#if cas === 'activer'}
				<Bouton variante="primaire" icone="notification" disabled={envoi} onclick={activer}>{envoi ? 'Activation…' : 'Activer les notifications'}</Bouton>
			{:else if cas === 'bloquees'}
				<Bouton variante="primaire" icone="valider" disabled={envoi} onclick={verifier}>J’ai autorisé</Bouton>
			{:else}
				<Bouton variante="primaire" icone="valider" onclick={plusTard}>J’ai compris</Bouton>
			{/if}
		</footer>
	{/if}
</dialog>
