<script lang="ts">
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import Interrupteur from '#lib/composants/ui/Interrupteur.svelte';
	import LogoApsud from './LogoApsud.svelte';
	import '#lib/composants/ui/Dialogue.css';
	import './ConsentementAnalytique.css';

	/**
	 * Demande de consentement à la mesure d'utilisation. DEUX choix seulement, « Je consens »
	 * ou « Je ne consens pas » (consigne du développeur, 2026-11-25) : ni croix, ni Échap, ni
	 * clic à côté pour fermer. Elle revient à chaque arrivée tant qu'aucun choix n'est fait.
	 * Présentation : le `dialog` de DESIGN.md (480 px, rayon 16, en-tête, corps, pied à filet).
	 * Une fois le choix fait, on ne redemande plus : le menu du compte ouvre un RÉGLAGE avec un
	 * interrupteur qui montre l'état actuel (activée / désactivée), modifiable à tout moment.
	 */
	/** Premier choix (deux boutons, pas de fermeture) ou réglage (interrupteur, fermable). */
	const reglage = $derived(collecte.choix !== null);
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
			// Réglage (choix déjà fait) : la fenêtre reste ouverte, l'interrupteur montre le nouvel état.
			await collecte.decider(consent, !reglage);
		} catch (e) {
			erreur = `Choix non enregistré, réessayez : ${e instanceof Error ? e.message : String(e)}`;
			if (!reglage) collecte.demandeOuverte = true;
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
	oncancel={(e) => {
		// Premier choix : on ne ferme pas sans réponse. Réglage : Échap ferme.
		e.preventDefault();
		if (reglage) collecte.demandeOuverte = false;
	}}
	onclose={() => {
		// Fermée autrement que par un choix (Échap répété, navigateur) : elle revient aussitôt.
		if (collecte.demandeOuverte && !reglage) el?.showModal();
		else collecte.demandeOuverte = false;
	}}
>
	<header class="c-consentement__tete">
		<p class="c-consentement__marque"><LogoApsud /> <span>Suivi consortium APSUD</span></p>
		<h2 class="c-dialogue__titre" id="consentement-titre">Mesure d’utilisation</h2>
		{#if reglage}
			<p class="c-consentement__chapeau">Votre choix est enregistré. Vous pouvez le modifier ici à tout moment.</p>
		{:else}
			<p class="c-consentement__chapeau">Votre accord est demandé avant toute mesure. Tant que vous n’avez pas répondu, rien n’est mesuré.</p>
		{/if}
	</header>

	<div class="c-dialogue__corps" id="consentement-texte">
		{#if reglage}
			<div class="c-consentement__reglage">
				<Interrupteur libelle="Mesure d’utilisation" actif={collecte.choix === true} texteActif="Activée" texteInactif="Désactivée" onbasculer={(v) => choisir(v)} />
				<p class="c-consentement__note">{collecte.choix ? 'L’outil enregistre votre façon de l’utiliser, pour l’améliorer.' : 'Rien n’est mesuré pour votre compte.'}</p>
			</div>
		{/if}
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
		{#if !reglage}
			<p class="c-consentement__note">Je comprends que ce choix est libre, qu’il ne change rien à mon accès, et que je pourrai le modifier à tout moment depuis le menu du compte, « Mesure d’utilisation ».</p>
		{/if}
		{#if erreur}<p class="c-consentement__erreur" role="alert"><Icone nom="alerte" taille="sm" /> {erreur}</p>{/if}
	</div>

	<footer class="c-dialogue__pied c-consentement__pied">
		{#if reglage}
			<Bouton variante="secondaire" onclick={() => (collecte.demandeOuverte = false)}>Fermer</Bouton>
		{:else}
			<Bouton variante="secondaire" disabled={envoi} onclick={() => choisir(false)}>Je ne consens pas</Bouton>
			<Bouton variante="primaire" icone="valider" disabled={envoi} onclick={() => choisir(true)}>Je consens</Bouton>
		{/if}
	</footer>
</dialog>
