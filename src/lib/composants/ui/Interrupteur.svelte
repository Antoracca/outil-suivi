<script lang="ts">
	import './Interrupteur.css';

	/** Interrupteur accessible (role="switch") : libellé visible + état en texte. */
	interface Props {
		libelle: string;
		actif: boolean;
		texteActif?: string;
		texteInactif?: string;
		onbasculer: (actif: boolean) => void;
	}
	let { libelle, actif, texteActif = 'Activé', texteInactif = 'Désactivé', onbasculer }: Props = $props();
</script>

<button class="c-interrupteur" class:is-actif={actif} type="button" role="switch" aria-checked={actif} onclick={() => onbasculer(!actif)}>
	<span class="c-interrupteur__libelle">{libelle}</span>
	<span class="c-interrupteur__piste" aria-hidden="true"><span class="c-interrupteur__bouton"></span></span>
	<span class="c-interrupteur__etat">{actif ? texteActif : texteInactif}</span>
</button>
