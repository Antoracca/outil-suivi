<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import Icone from '#lib/icones/Icone.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import './BandeauHorsLigne.css';
</script>

{#if depot.erreurServeur}
	<div class="c-hors-ligne__refus">
		<Alerte variante="erreur" titre="Modification non enregistrée" onfermer={() => depot.fermerErreurServeur()}>
			{depot.erreurServeur} L’écran a été remis à jour avec les données du serveur.
		</Alerte>
	</div>
{/if}

{#if !depot.enLigne}
	<div class="c-hors-ligne">
		<Icone nom="hors-ligne" taille="sm" />
		<p>
			<strong>Hors ligne.</strong>
			{#if depot.fileAttente.length}
				{depot.fileAttente.length} modification{depot.fileAttente.length > 1 ? 's' : ''} gardée{depot.fileAttente.length > 1 ? 's' : ''} sur cet appareil, envoi automatique au retour du réseau.
			{:else}
				Vous pouvez continuer à saisir : rien ne sera perdu.
			{/if}
		</p>
		<button type="button" class="c-hors-ligne__action" onclick={() => depot.basculerReseau()}>
			{depot.source === 'demo' ? 'Rétablir la connexion (démonstration)' : 'Réessayer maintenant'}
		</button>
	</div>
{/if}
