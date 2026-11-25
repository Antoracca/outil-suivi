<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { dateHeure, libelleMois, relatif } from '#lib/format.ts';
	import { lienEvenement, nonLuesDe, titreEvenement, type NonLue } from '#lib/donnees/notifications.ts';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './NotificationsArrivee.css';

	/**
	 * À l'arrivée sur la plateforme : quelques secondes après l'ouverture, les notifications
	 * non lues s'affichent dans une fenêtre modale, UNE PAR UNE, de la plus ancienne à la plus
	 * récente (demande du développeur : marquer l'urgence). « Lu, suivante » passe à la
	 * suivante ; « Ouvrir » mène à l'élément ; « Plus tard » ferme sans rien marquer.
	 */
	const DELAI = 1500;

	let el: HTMLDialogElement | undefined = $state();
	let file = $state<NonLue[]>([]);
	let rang = $state(0);
	let compte: string | null = null;
	let minuterie: ReturnType<typeof setTimeout> | undefined;

	const courante = $derived(file[rang] ?? null);
	const derniere = $derived(rang >= file.length - 1);

	$effect(() => {
		if (!depot.pret || !depot.utilisateurId) return;
		const id = depot.utilisateurId;
		untrack(() => {
			if (compte === id) return;
			compte = id;
			clearTimeout(minuterie);
			minuterie = setTimeout(() => {
				// Plus ancienne d'abord : les nouvelles arrivent dans l'ordre où elles se sont produites.
				const liste = nonLuesDe(depot.etat, depot.utilisateurId).reverse();
				if (!liste.length) return;
				file = liste;
				rang = 0;
			}, DELAI);
		});
		return () => clearTimeout(minuterie);
	});

	$effect(() => {
		if (!el) return;
		if (courante && !el.open) el.showModal();
		if (!courante && el.open) el.close();
	});

	function terminer() {
		file = [];
		rang = 0;
	}
	function suivante() {
		if (!courante) return;
		depot.marquerLue(courante.ev.id);
		if (derniere) terminer();
		else rang += 1;
	}
	function ouvrir() {
		if (!courante) return;
		const lien = lienEvenement(courante.ev);
		depot.marquerLue(courante.ev.id);
		terminer();
		if (lien) goto(lien);
	}
	function toutLire() {
		depot.marquerLues(file.map((x) => x.ev.id));
		terminer();
	}

	const auteur = $derived(courante ? depot.nomUtilisateur(courante.ev.auteur) : '');
	const contexteEv = $derived(courante ? [courante.ev.volet, courante.ev.mois ? `rapport de ${libelleMois(courante.ev.mois)}` : null].filter(Boolean).join(' · ') : '');
</script>

<dialog bind:this={el} class="c-arrivee" aria-labelledby="arrivee-titre" aria-describedby="arrivee-texte" onclose={terminer}>
	{#if courante}
		<header class="c-arrivee__tete">
			<p class="c-arrivee__rang">
				<span class="c-arrivee__urgence"><Icone nom="notification" taille="sm" /> Nouveau</span>
				<span>Notification {rang + 1} sur {file.length}</span>
			</p>
			<button type="button" class="c-arrivee__fermer" onclick={terminer} aria-label="Plus tard : fermer sans marquer comme lu"><Icone nom="fermer" /></button>
		</header>
		<div class="c-arrivee__progression" aria-hidden="true">
			{#each file as x, i (x.n.id)}<span class:is-faite={i < rang} class:is-courante={i === rang}></span>{/each}
		</div>

		{#key courante.n.id}
			<div class="c-arrivee__corps">
				<span class="c-arrivee__logo"><LogoOrganisation sigle={courante.ev.organisation} taille="lg" /></span>
				<div class="c-arrivee__texte">
					<h2 class="c-arrivee__titre" id="arrivee-titre">{titreEvenement(courante.ev)}</h2>
					{#if contexteEv}<p class="c-arrivee__contexte">{contexteEv}</p>{/if}
					<p class="c-arrivee__message" id="arrivee-texte">
						<strong>{auteur}</strong> ({courante.ev.organisation}) {courante.ev.resume} <strong>{courante.ev.cible.libelle}</strong>
					</p>
					<p class="c-arrivee__date"><time datetime={courante.ev.date} title={dateHeure(courante.ev.date)}>{relatif(courante.ev.date, depot.maintenant())}</time></p>
				</div>
			</div>
		{/key}

		<footer class="c-arrivee__pied">
			<button type="button" class="c-arrivee__tout" onclick={toutLire}>Tout marquer comme lu ({file.length - rang})</button>
			<div class="c-arrivee__actions">
				{#if lienEvenement(courante.ev)}
					<button type="button" class="c-arrivee__bouton" onclick={ouvrir}>Ouvrir</button>
				{/if}
				<button type="button" class="c-arrivee__bouton c-arrivee__bouton--principal" onclick={suivante}>
					<Icone nom="valider" taille="sm" />
					{derniere ? 'Lu, terminer' : 'Lu, suivante'}
				</button>
			</div>
		</footer>
	{/if}
</dialog>
