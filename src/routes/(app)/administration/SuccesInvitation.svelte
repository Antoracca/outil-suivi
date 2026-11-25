<script lang="ts">
	import { onMount } from 'svelte';
	import { date } from '#lib/format.ts';
	import {
		ENVOI_AUTOMATIQUE_DISPONIBLE,
		envoyerInvitationParEmail,
		lienInscription,
		lienMessagerie,
		messageInvitation,
		type Invitation
	} from '#lib/donnees/invitations.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './SuccesInvitation.css';

	/**
	 * Page de succès d'une invitation : glisse de la droite vers la gauche à la place de
	 * l'Administration. Récapitulatif des accès, message prêt à envoyer (copier, partager,
	 * messagerie) ; l'envoi automatique par e-mail sera branché plus tard (invitations.ts).
	 * Le code n'est conservé nulle part : il disparaît quand on quitte cette page.
	 */
	interface Props {
		invitation: Invitation;
		onretour: () => void;
		onautre: () => void;
	}
	let { invitation: inv, onretour, onautre }: Props = $props();

	const message = $derived(messageInvitation(inv));
	const lien = $derived(lienInscription());
	let partageDisponible = $state(false);
	let annonce = $state('');
	let copie = $state(false);
	let confirmerDepart = $state<null | 'retour' | 'autre'>(null);
	let titre: HTMLHeadingElement | undefined = $state();

	onMount(() => {
		partageDisponible = typeof navigator.share === 'function';
		titre?.scrollIntoView({ block: 'center' });
		titre?.focus({ preventScroll: true });
	});

	/** Presse-papiers, avec repli pour une adresse non sécurisée (test sur le Wi-Fi local). */
	function copierAncienne(texte: string): boolean {
		const zone = document.createElement('textarea');
		zone.value = texte;
		zone.setAttribute('readonly', '');
		zone.className = 'u-visuellement-masque';
		document.body.append(zone);
		zone.select();
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}
		zone.remove();
		return ok;
	}
	async function copier(texte: string, quoi: string) {
		let ok = false;
		if (navigator.clipboard && window.isSecureContext) {
			try {
				await navigator.clipboard.writeText(texte);
				ok = true;
			} catch {
				ok = false;
			}
		}
		if (!ok) ok = copierAncienne(texte);
		if (ok) {
			copie = true;
			annonce = `${quoi} copié : collez-le dans un e-mail, WhatsApp ou SMS.`;
		} else annonce = 'Copie impossible sur cet appareil : sélectionnez le texte et copiez-le à la main.';
	}

	async function partager() {
		try {
			await navigator.share({ title: message.objet, text: message.corps });
			copie = true;
			annonce = 'Message partagé.';
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			annonce = 'Partage impossible : copiez le message.';
		}
	}

	async function envoyerAutomatiquement() {
		try {
			await envoyerInvitationParEmail(inv);
			copie = true;
			annonce = `Message envoyé à ${inv.email}.`;
		} catch (e) {
			annonce = e instanceof Error ? e.message : String(e);
		}
	}

	/** Le code ne sera plus affiché : on prévient si rien n'a encore été copié ni partagé. */
	function quitter(vers: 'retour' | 'autre') {
		if (!copie) {
			confirmerDepart = vers;
			return;
		}
		(vers === 'retour' ? onretour : onautre)();
	}
</script>

<section class="p-succes" aria-labelledby="succes-titre">
	<div class="p-succes__haut">
		<Bouton variante="texte" taille="sm" icone="chevron-gauche" onclick={() => quitter('retour')}>Retour à l’administration</Bouton>
	</div>

	<header class="p-succes__tete">
		<span class="p-succes__pastille" aria-hidden="true"><Icone nom="valider" /></span>
		<div class="p-succes__intitule">
			<p class="p-succes__surtitre">Inviter une organisation · terminé</p>
			<h1 class="p-succes__titre" id="succes-titre" tabindex="-1" bind:this={titre}>Invitation créée pour {inv.nom}</h1>
			<p class="p-succes__intro">
				Transmettez ces accès à <strong>{inv.email}</strong> pour son inscription. <strong>Le code ne sera plus affiché</strong> une fois cette page quittée.
			</p>
		</div>
	</header>

	{#if inv.demonstration}
		<Alerte variante="info" titre="Démonstration">Code fictif : aucune invitation n’est enregistrée et personne ne reçoit de message.</Alerte>
	{/if}

	<div class="p-succes__grille">
		<Panneau titre="Accès de connexion" sousTitre="Ce qu’il faut à la personne pour créer son compte.">
			<dl class="p-succes__acces">
				<div>
					<dt>Personne invitée</dt>
					<dd>{inv.nom}{#if inv.fonction}<span class="p-succes__detail">{inv.fonction}</span>{/if}</dd>
				</div>
				<div>
					<dt>Organisation et rôle</dt>
					<dd>{inv.organisation}{#if inv.nomOrganisation && inv.nomOrganisation !== inv.organisation}{` · ${inv.nomOrganisation}`}{/if}<span class="p-succes__detail">{inv.libelleRole}</span></dd>
				</div>
				<div>
					<dt>Adresse e-mail</dt>
					<dd class="p-succes__casse">{inv.email}</dd>
				</div>
				<div>
					<dt>Adresse de la plateforme</dt>
					<dd class="p-succes__casse"><a href={lien} target="_blank" rel="noopener">{lien}</a></dd>
				</div>
				<div class="p-succes__code">
					<dt>Code d’invitation</dt>
					<dd>
						<span class="p-succes__code-valeur">{inv.code}</span>
						<Bouton variante="secondaire" taille="sm" icone="copier" onclick={() => copier(inv.code, 'Code')}>Copier le code</Bouton>
					</dd>
				</div>
				<div>
					<dt>Validité</dt>
					<dd><span>Jusqu’au <time datetime={inv.expire_le.toISOString()}>{date(inv.expire_le.toISOString())}</time></span><span class="p-succes__detail">Une seule fois, et seulement avec cette adresse e-mail. Le mot de passe, la personne le choisit elle-même à l’inscription.</span></dd>
				</div>
			</dl>
		</Panneau>

		<Panneau titre="Message à envoyer" sousTitre="Prêt à coller dans un e-mail, WhatsApp ou SMS.">
			<div class="p-succes__message">
				<p class="p-succes__objet"><span>Objet</span> {message.objet}</p>
				<p class="p-succes__corps">{message.corps}</p>
			</div>
			<div class="p-succes__actions">
				<Bouton variante="primaire" icone="copier" onclick={() => copier(`${message.objet}\n\n${message.corps}`, 'Message')}>Copier le message entier</Bouton>
				{#if partageDisponible}
					<Bouton variante="secondaire" icone="partager" onclick={partager}>Partager</Bouton>
				{/if}
				<Bouton variante="secondaire" icone="courriel" href={lienMessagerie(inv)}>Ouvrir ma messagerie</Bouton>
			</div>
			<p class="p-succes__annonce" role="status" aria-live="polite">
				{#if annonce}<Icone nom="info" taille="sm" /> {annonce}{/if}
			</p>
			<div class="p-succes__auto">
				<Bouton variante="texte" taille="sm" icone="courriel" disabled={!ENVOI_AUTOMATIQUE_DISPONIBLE} onclick={envoyerAutomatiquement}>Envoyer automatiquement par e-mail</Bouton>
				{#if !ENVOI_AUTOMATIQUE_DISPONIBLE}<span class="p-succes__bientot">Bientôt : l’envoi automatique sera relié à un service d’e-mail.</span>{/if}
			</div>
		</Panneau>
	</div>

	<div class="p-succes__pied">
		<Bouton variante="secondaire" icone="chevron-gauche" onclick={() => quitter('retour')}>Retour à l’administration</Bouton>
		<Bouton variante="secondaire" icone="plus" onclick={() => quitter('autre')}>Inviter une autre organisation</Bouton>
	</div>
</section>

<Dialogue ouvert={!!confirmerDepart} titre="Quitter sans avoir copié le code ?" onfermer={() => (confirmerDepart = null)}>
	<p>Le code <strong>{inv.code}</strong> ne sera plus affiché. Sans lui, il faudra créer une nouvelle invitation pour {inv.email}.</p>
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={() => (confirmerDepart = null)}>Rester sur la page</Bouton>
		<Bouton variante="primaire" icone="chevron-gauche" onclick={() => { const v = confirmerDepart; confirmerDepart = null; (v === 'autre' ? onautre : onretour)(); }}>Quitter quand même</Bouton>
	{/snippet}
</Dialogue>
