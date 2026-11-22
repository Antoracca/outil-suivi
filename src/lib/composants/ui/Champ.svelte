<script lang="ts">
	import './Champ.css';

	/** Champ de formulaire : libellé visible au-dessus, aide et erreur en dessous. */
	interface Props {
		id: string;
		libelle: string;
		valeur: string;
		type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea' | 'select';
		aide?: string;
		erreur?: string | null;
		options?: { valeur: string; libelle: string }[];
		requis?: boolean;
		inputmode?: 'numeric' | 'decimal' | 'text' | 'email';
		placeholder?: string;
		/** Aide les gestionnaires de mots de passe (WCAG 3.3.8) : « username », « current-password »… */
		autocomplete?: HTMLInputElement['autocomplete'];
	}
	let { id, libelle, valeur = $bindable(), type = 'text', aide, erreur = null, options = [], requis = false, inputmode, placeholder, autocomplete }: Props = $props();
	const decrit = $derived([aide ? `${id}-aide` : '', erreur ? `${id}-erreur` : ''].filter(Boolean).join(' ') || undefined);
</script>

<div class="c-champ" class:c-champ--erreur={!!erreur}>
	<label class="c-champ__libelle" for={id}>{libelle}{#if !requis}<span class="c-champ__facultatif"> (facultatif)</span>{/if}</label>
	{#if type === 'textarea'}
		<textarea class="c-champ__saisie c-champ__saisie--zone" {id} bind:value={valeur} aria-describedby={decrit} aria-invalid={!!erreur} required={requis} {placeholder}></textarea>
	{:else if type === 'select'}
		<select class="c-champ__saisie" {id} bind:value={valeur} aria-describedby={decrit} required={requis}>
			{#each options as o (o.valeur)}<option value={o.valeur}>{o.libelle}</option>{/each}
		</select>
	{:else}
		<input class="c-champ__saisie" {id} {type} bind:value={valeur} aria-describedby={decrit} aria-invalid={!!erreur} required={requis} {inputmode} {placeholder} {autocomplete} />
	{/if}
	{#if aide}<p class="c-champ__aide" id="{id}-aide">{aide}</p>{/if}
	{#if erreur}<p class="c-champ__erreur" id="{id}-erreur">{erreur}</p>{/if}
</div>
