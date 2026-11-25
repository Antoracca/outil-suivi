<script lang="ts">
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import Icone from '#lib/icones/Icone.svelte';
	import './ReglageMesure.css';

	/**
	 * Réglage « Mesure d'utilisation » dans le menu du compte : un interrupteur qui montre l'état
	 * actuel (lu en base en mode réel) et l'enregistre au clic. La fenêtre « Je consens / Je ne
	 * consens pas » ne sert qu'au tout premier choix ; ensuite, on règle ici, sans redemander.
	 */
	let envoi = $state(false);
	let erreur = $state<string | null>(null);
	const actif = $derived(collecte.choix === true);

	async function basculer() {
		erreur = null;
		envoi = true;
		try {
			await collecte.decider(!actif, false);
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		} finally {
			envoi = false;
		}
	}
</script>

<div class="c-reglage-mesure">
	<button type="button" class="c-reglage-mesure__bouton" role="switch" aria-checked={actif} disabled={envoi} onclick={basculer}>
		<Icone nom="activite" taille="sm" />
		<span class="c-reglage-mesure__texte">
			<span class="c-reglage-mesure__libelle">Mesure d’utilisation</span>
			<span class="c-reglage-mesure__etat">{actif ? 'Activée' : 'Désactivée'}</span>
		</span>
		<span class="c-reglage-mesure__piste" class:is-actif={actif} aria-hidden="true"><span></span></span>
	</button>
	{#if erreur}<p class="c-reglage-mesure__erreur" role="alert">Choix non enregistré : {erreur}</p>{/if}
</div>
