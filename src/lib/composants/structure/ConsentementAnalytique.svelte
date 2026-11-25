<script lang="ts">
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import LogoApsud from './LogoApsud.svelte';
	import '#lib/composants/ui/Dialogue.css';
	import './ConsentementAnalytique.css';

	/**
	 * Demande de consentement à la mesure d'utilisation. DEUX choix seulement, « Je consens »
	 * ou « Je ne consens pas » (consigne du développeur, 2026-11-25) : ni croix, ni Échap, ni
	 * clic à côté pour fermer. Elle revient à chaque arrivée tant qu'aucun choix n'est fait.
	 * Présentation : le `dialog` de DESIGN.md (480 px, rayon 16, en-tête, corps, pied à filet).
	 */
	let el: HTMLDialogElement | undefined = $state();
	let erreur = $state<string | null>(null);
	let envoi = $state(false);

	$effect(() => {
		if (!el) return;
		if (collecte.demandeOuverte && !el.open) el.showModal();
		if (!collecte.demandeOuverte && el.open) el.close();
	});

	async function choisir(consent: boolean) {
		erreur = null;
		envoi = true;
		try {
			await collecte.decider(consent);
		} catch (e) {
			erreur = `Choix non enregistré, réessayez : ${e instanceof Error ? e.message : String(e)}`;
			collecte.demandeOuverte = true;
		} finally {
			envoi = false;
		}
	}
</script>

<dialog
	bind:this={el}
	class="c-dialogue c-consentement"
	aria-labelledby="consentement-titre"
	aria-describedby="consentement-texte"
	oncancel={(e) => e.preventDefault()}
	onclose={() => {
		// Fermée autrement que par un choix (Échap répété, navigateur) : elle revient aussitôt.
		if (collecte.demandeOuverte) el?.showModal();
	}}
>
	<header class="c-consentement__tete">
		<p class="c-consentement__marque"><LogoApsud /> <span>Suivi consortium APSUD</span></p>
		<h2 class="c-dialogue__titre" id="consentement-titre">Mesure d’utilisation</h2>
		<p class="c-consentement__chapeau">Votre accord est demandé avant toute mesure. Tant que vous n’avez pas répondu, rien n’est mesuré.</p>
	</header>

	<div class="c-dialogue__corps" id="consentement-texte">
		<p>
			APSUD veut comprendre comment la plateforme est utilisée, pour l’améliorer de jour en jour. Avec votre accord, l’outil enregistre votre façon de l’utiliser ; ces informations
			serviront aussi à une analyse automatique des usages, par intelligence artificielle, afin d’optimiser l’outil.
		</p>
		<dl class="c-consentement__tableau">
			<div>
				<dt><Icone nom="valider" taille="sm" /> Mesuré, avec votre accord</dt>
				<dd>Pages ouvertes et temps passé, boutons et liens utilisés, type d’appareil, taille d’écran, qualité de connexion, erreurs rencontrées.</dd>
			</div>
			<div>
				<dt><Icone nom="cadenas" taille="sm" /> Jamais mesuré</dt>
				<dd>Le contenu de vos saisies (valeurs, textes, fichiers) et votre mot de passe.</dd>
			</div>
			<div>
				<dt><Icone nom="oeil" taille="sm" /> Qui consulte</dt>
				<dd>La super-administration d’APSUD, seulement.</dd>
			</div>
		</dl>
		<p class="c-consentement__note">Je comprends que ce choix est libre, qu’il ne change rien à mon accès, et que je pourrai le modifier à tout moment depuis le menu du compte, « Mesure d’utilisation ».</p>
		{#if collecte.choix !== null}
			<p class="c-consentement__note">Votre choix actuel : <strong>{collecte.choix ? 'vous consentez' : 'vous ne consentez pas'}</strong>.</p>
		{/if}
		{#if erreur}<p class="c-consentement__erreur" role="alert"><Icone nom="alerte" taille="sm" /> {erreur}</p>{/if}
	</div>

	<footer class="c-dialogue__pied c-consentement__pied">
		<Bouton variante="secondaire" disabled={envoi} onclick={() => choisir(false)}>Je ne consens pas</Bouton>
		<Bouton variante="primaire" icone="valider" disabled={envoi} onclick={() => choisir(true)}>Je consens</Bouton>
	</footer>
</dialog>
