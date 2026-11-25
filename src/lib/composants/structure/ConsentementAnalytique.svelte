<script lang="ts">
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import Icone from '#lib/icones/Icone.svelte';
	import './ConsentementAnalytique.css';

	/**
	 * Demande de consentement à la mesure d'utilisation : à l'arrivée, 3 fois au plus tant
	 * qu'aucun choix n'est fait ; de nouveau depuis le menu du compte pour changer d'avis.
	 */
	let el: HTMLDialogElement | undefined = $state();
	let erreur = $state<string | null>(null);

	$effect(() => {
		if (!el) return;
		if (collecte.demandeOuverte && !el.open) el.showModal();
		if (!collecte.demandeOuverte && el.open) el.close();
	});

	async function choisir(consent: boolean) {
		erreur = null;
		try {
			await collecte.decider(consent);
		} catch (e) {
			erreur = `Choix non enregistré : ${e instanceof Error ? e.message : String(e)}`;
		}
	}
</script>

<dialog bind:this={el} class="c-consentement" aria-labelledby="consentement-titre" aria-describedby="consentement-texte" onclose={() => collecte.fermerSansChoisir()}>
	<header class="c-consentement__tete">
		<span class="c-consentement__picto" aria-hidden="true"><Icone nom="activite" /></span>
		<div>
			<p class="c-consentement__surtitre">Améliorer l’outil ensemble</p>
			<h2 class="c-consentement__titre" id="consentement-titre">Mesure d’utilisation de la plateforme</h2>
		</div>
		<button type="button" class="c-consentement__fermer" onclick={() => collecte.fermerSansChoisir()} aria-label="Décider plus tard"><Icone nom="fermer" /></button>
	</header>
	<div class="c-consentement__corps" id="consentement-texte">
		<p>
			APSUD souhaite comprendre comment la plateforme est utilisée, pour l’améliorer de jour en jour. Avec votre accord, l’outil enregistre votre façon de l’utiliser ; ces informations
			serviront aussi à une analyse automatique (intelligence artificielle) des usages, afin d’optimiser l’outil.
		</p>
		<div class="c-consentement__colonnes">
			<div>
				<p class="c-consentement__liste-titre"><Icone nom="valider" taille="sm" /> Ce qui est mesuré</p>
				<ul>
					<li>les pages ouvertes et le temps passé ;</li>
					<li>les boutons et liens utilisés ;</li>
					<li>le type d’appareil, la taille d’écran et la qualité de connexion ;</li>
					<li>les erreurs rencontrées.</li>
				</ul>
			</div>
			<div>
				<p class="c-consentement__liste-titre"><Icone nom="cadenas" taille="sm" /> Ce qui ne l’est jamais</p>
				<ul>
					<li>le contenu de vos saisies (valeurs, textes, fichiers) ;</li>
					<li>votre mot de passe ;</li>
					<li>quoi que ce soit si vous ne consentez pas.</li>
				</ul>
			</div>
		</div>
		<p class="c-consentement__note">
			Je comprends que ce choix est libre, qu’il ne change rien à l’accès à la plateforme, et que je peux le modifier à tout moment (menu du compte › Mesure d’utilisation). Seule la
			super-administration d’APSUD consulte ces informations.
		</p>
		{#if collecte.choix !== null}
			<p class="c-consentement__etat">Votre choix actuel : <strong>{collecte.choix ? 'vous consentez' : 'vous ne consentez pas'}</strong>.</p>
		{/if}
		{#if erreur}<p class="c-consentement__erreur" role="alert">{erreur}</p>{/if}
	</div>
	<footer class="c-consentement__pied">
		<button type="button" class="c-consentement__bouton" onclick={() => choisir(false)}>Je ne consens pas</button>
		<button type="button" class="c-consentement__bouton c-consentement__bouton--principal" onclick={() => choisir(true)}><Icone nom="valider" taille="sm" /> Je consens</button>
	</footer>
</dialog>
