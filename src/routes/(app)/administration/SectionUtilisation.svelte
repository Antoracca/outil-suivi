<script lang="ts">
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';

	/** Accès à l'analyse complète de l'utilisation (page /administration/utilisation). */
</script>

<Panneau titre="Utilisation de l’outil" sousTitre="Mesure d’utilisation des comptes qui y consentent : écrans, parcours, actions métier, appareils, difficultés, et constats automatiques avec une piste d’amélioration.">
	<div class="p-admin__usage-acces">
		<p>Analyse sur 7, 30 ou 90 jours, graphiques d’activité par jour et par heure, organisations actives, écrans lents, boutons cliqués plusieurs fois, export CSV pour l’analyse automatique.</p>
		<Bouton variante="secondaire" icone="activite" href="/administration/utilisation">Ouvrir l’analyse complète</Bouton>
	</div>
</Panneau>
