<script lang="ts">
	import { analyserEmail } from '#lib/donnees/regles.ts';
	import Icone from '#lib/icones/Icone.svelte';
	import './Champ.css';
	import './ChampEmail.css';

	/**
	 * Champ d'adresse e-mail avec indicateur en temps réel : pendant la frappe, il explique ce
	 * qui manque ou ce qui est faux (espace, virgule, « @ », extension…) et propose une
	 * correction en un clic (« Vouliez-vous dire … ? »). Toute messagerie est acceptée.
	 */
	interface Props {
		id: string;
		libelle: string;
		valeur: string;
		requis?: boolean;
		placeholder?: string;
		autocomplete?: HTMLInputElement['autocomplete'];
		aide?: string;
		/** Erreur donnée à l'envoi du formulaire (prioritaire sur l'indicateur). */
		erreur?: string | null;
	}
	let { id, libelle, valeur = $bindable(), requis = false, placeholder = 'prenom.nom@gmail.com', autocomplete = 'email', aide, erreur = null }: Props = $props();

	let touche = $state(false);
	const analyse = $derived(analyserEmail(valeur ?? ''));
	/** Une adresse incomplète ne devient une faute qu'une fois le champ quitté. */
	const etatAffiche = $derived(analyse.etat === 'en_cours' && touche ? 'erreur' : analyse.etat);
	const decrit = $derived([aide ? `${id}-aide` : '', `${id}-etat`, erreur ? `${id}-erreur` : ''].filter(Boolean).join(' '));
	const icone = $derived(etatAffiche === 'valide' ? 'valider' : etatAffiche === 'erreur' ? 'alerte' : 'info');

	function appliquer() {
		if (analyse.suggestion) valeur = analyse.suggestion;
		document.getElementById(id)?.focus();
	}
</script>

<div class="c-champ c-champ-email c-champ-email--{etatAffiche}" class:c-champ--erreur={!!erreur || etatAffiche === 'erreur'}>
	<label class="c-champ__libelle" for={id}>{libelle}{#if !requis}<span class="c-champ__facultatif"> (facultatif)</span>{/if}</label>
	<input
		class="c-champ__saisie"
		{id}
		type="email"
		inputmode="email"
		spellcheck="false"
		autocapitalize="off"
		bind:value={valeur}
		onblur={() => (touche = true)}
		aria-describedby={decrit}
		aria-invalid={!!erreur || etatAffiche === 'erreur'}
		required={requis}
		{placeholder}
		{autocomplete}
	/>
	{#if aide}<p class="c-champ__aide" id="{id}-aide">{aide}</p>{/if}
	<p class="c-champ-email__etat" id="{id}-etat" aria-live="polite">
		{#if analyse.etat !== 'vide' && !erreur}
			<Icone nom={icone} taille="sm" />
			<span>{analyse.message}</span>
			{#if analyse.suggestion}
				<button type="button" class="c-champ-email__suggestion" onclick={appliquer}>Vouliez-vous dire <strong>{analyse.suggestion}</strong> ?</button>
			{/if}
		{/if}
	</p>
	{#if erreur}
		<p class="c-champ__erreur" id="{id}-erreur">
			{erreur}
			{#if analyse.suggestion}
				<button type="button" class="c-champ-email__suggestion" onclick={appliquer}>Vouliez-vous dire <strong>{analyse.suggestion}</strong> ?</button>
			{/if}
		</p>
	{/if}
</div>
