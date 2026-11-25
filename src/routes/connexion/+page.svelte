<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { DEMO_DISPONIBLE, mode } from '#lib/donnees/mode.svelte.ts';
	import { DESCRIPTION_ROLE, LIBELLES_ROLE } from '#lib/donnees/regles.ts';
	import LogoApsud from '#lib/composants/structure/LogoApsud.svelte';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import Interrupteur from '#lib/composants/ui/Interrupteur.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import type { Role } from '#lib/donnees/types.ts';
	import ConnexionReelle from './ConnexionReelle.svelte';
	import './connexion.css';

	const ordreRoles: Role[] = ['super_admin', 'coordination', 'saisie'];
	const groupes = $derived(
		ordreRoles.map((role) => ({ role, comptes: depot.etat.utilisateurs.filter((u) => u.role === role) })).filter((g) => g.comptes.length)
	);

	function choisir(id: string) {
		depot.connecter(id);
		goto('/');
	}

	/** Changer de mode ferme la session ouverte dans cet onglet et change la source des données. */
	function basculerMode(actif: boolean) {
		if (depot.source === 'demo') depot.deconnecter();
		mode.basculer(actif);
		void depot.utiliserSource(actif ? 'demo' : 'reel');
	}

	/** Lien reçu dans un message d'invitation (« /connexion?inscription ») : mode réel, onglet Inscription. */
	const versInscription = page.url.searchParams.has('inscription');
	onMount(() => {
		if (versInscription && mode.demo) basculerMode(false);
	});
</script>

<svelte:head><title>Connexion · Suivi consortium APSUD</title></svelte:head>

<main class="p-connexion" class:p-connexion--reel={!mode.demo} id="contenu">
	<section class="p-connexion__marque" aria-labelledby="connexion-titre">
		<div class="p-connexion__identite">
			<LogoApsud taille="xl" />
			<div class="p-connexion__textes">
				<h1 id="connexion-titre" class="p-connexion__titre">Suivi du consortium</h1>
				<p class="p-connexion__projet">Assistance d’urgence intégrée à Nanga-Boguila, Paoua et Bossangoa</p>
			</div>
			<p class="p-connexion__description">La plateforme commune d’APSUD et de ses partenaires.</p>
			<p class="p-connexion__code">CBPF-CAR-26-R-NGO-NSFT-41469 · Fonds humanitaire RCA</p>
		</div>
	</section>

	<section class="p-connexion__acces" aria-label={mode.demo ? 'Comptes de démonstration' : 'Connexion'}>
		{#if DEMO_DISPONIBLE}
			<div class="p-connexion__bascule">
				<Interrupteur libelle="Mode démonstration" actif={mode.demo} onbasculer={basculerMode} />
			</div>
		{/if}

		{#if mode.demo}
			<div class="p-connexion__choix">
				<div class="p-connexion__avertissement">
					<Icone nom="info" taille="sm" />
					<p>
						<strong>Démonstration.</strong> Seuls les comptes sont fictifs ; aucune donnée inventée : activités, indicateurs et cibles tirés des 5 plans d’action. Ouvrez deux onglets avec deux comptes pour voir le temps réel.
					</p>
				</div>
				<h2 class="p-connexion__sous-titre">Choisissez un compte de démonstration</h2>
				{#each groupes as g (g.role)}
					<div class="p-connexion__groupe">
						<h3 class="p-connexion__role">{LIBELLES_ROLE[g.role]}</h3>
						<p class="p-connexion__role-desc">{DESCRIPTION_ROLE[g.role]}</p>
						<ul class="p-connexion__comptes" role="list">
							{#each g.comptes as u (u.id)}
								<li>
									<button class="p-connexion__compte" type="button" onclick={() => choisir(u.id)}>
										<LogoOrganisation sigle={u.organisation} taille="md" />
										<span class="p-connexion__compte-texte">
											<span class="p-connexion__nom">{u.nom}</span>
											<span class="p-connexion__fonction">{u.organisation} · {u.fonction}</span>
										</span>
										<Icone nom="chevron-droite" taille="sm" />
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
				<p class="p-connexion__pied">
					<button type="button" class="p-connexion__reinit" onclick={() => depot.reinitialiserDemo()}>Réinitialiser les données de démonstration</button>
				</p>
			</div>
		{:else}
			<div class="p-connexion__reel">
				<ConnexionReelle ongletInitial={versInscription ? 'inscription' : 'connexion'} />
			</div>
		{/if}
	</section>
</main>
