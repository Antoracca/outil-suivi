<script lang="ts">
	import type { Rapport } from '#lib/donnees/types.ts';
	import type { Transition } from '#lib/donnees/regles.ts';
	import { libelleMois } from '#lib/format.ts';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import './DialogueDecision.css';

	/**
	 * Confirmation d'une décision qui exige un motif : renvoi pour correction,
	 * réouverture d'un rapport validé, déverrouillage. Le motif est obligatoire,
	 * visible par l'ONG et inscrit au journal.
	 */
	interface Props {
		rapport: Rapport;
		libelleVolet: string;
		transition: Transition;
		onfermer: () => void;
		/** Renvoie le message d'erreur de la règle, ou null si la décision est enregistrée. */
		onconfirmer: (motif: string) => string | null;
	}
	let { rapport, libelleVolet, transition, onfermer, onconfirmer }: Props = $props();

	let motif = $state('');
	let erreurMotif = $state<string | null>(null);
	let erreur = $state<string | null>(null);

	const explication = $derived.by(() => {
		if (transition.vers === 'a_corriger' && rapport.statut === 'soumis')
			return 'Le rapport repasse au statut « À corriger ». L’ONG pourra reprendre ses saisies puis le soumettre à nouveau à APSUD.';
		if (transition.vers === 'a_corriger')
			return 'Ce rapport validé redevient modifiable par l’ONG. Il devra être soumis et validé de nouveau.';
		if (transition.vers === 'valide' && rapport.statut === 'verrouille')
			return 'Le rapport repasse au statut « Validé par APSUD ». Ses données restent figées tant qu’il n’est pas rouvert pour correction.';
		return 'Cette décision sera inscrite au journal.';
	});

	const aideMotif = $derived(
		transition.vers === 'a_corriger'
			? 'Dites précisément quoi corriger et comment. L’ONG reçoit ce motif, qui reste inscrit au journal.'
			: 'Expliquez pourquoi le rapport est déverrouillé. Le motif reste inscrit au journal.'
	);

	const exemple = $derived(
		transition.vers === 'a_corriger'
			? 'Exemple : la désagrégation Filles / Garçons ne correspond pas aux fiches jointes. Merci de vérifier et d’ajouter les fiches manquantes.'
			: 'Exemple : erreur de saisie signalée par l’ONG sur l’indicateur 1.2.'
	);

	function confirmer() {
		if (!motif.trim()) {
			erreurMotif = 'Indiquez le motif : il sera visible par l’ONG et inscrit au journal.';
			document.getElementById('motif-decision')?.focus();
			return;
		}
		erreurMotif = null;
		erreur = onconfirmer(motif.trim());
	}
</script>

<Dialogue ouvert titre="{transition.action} : rapport de {libelleMois(rapport.mois)}" {onfermer}>
	<p class="p-validation-dialogue__rappel">
		<span class="p-validation-dialogue__volet">{libelleVolet}</span>
		<span>Rapport de {libelleMois(rapport.mois)}</span>
	</p>
	<p>{explication}</p>
	{#if erreur}
		<Alerte variante="erreur" onfermer={() => (erreur = null)}>{erreur}</Alerte>
	{/if}
	<Champ id="motif-decision" type="textarea" libelle="Motif" requis bind:valeur={motif} aide={aideMotif} erreur={erreurMotif} placeholder={exemple} />
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={onfermer}>Annuler</Bouton>
		<Bouton variante="primaire" icone={transition.vers === 'a_corriger' ? 'renvoyer' : 'deverrouiller'} onclick={confirmer}>{transition.action}</Bouton>
	{/snippet}
</Dialogue>
