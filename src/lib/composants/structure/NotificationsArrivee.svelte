<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { dateHeure, libelleMois, relatif } from '#lib/format.ts';
	import { lienEvenement, nonLuesDe, titreEvenement, type NonLue } from '#lib/donnees/notifications.ts';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import type { Annonce } from '#lib/donnees/types.ts';
	import Icone from '#lib/icones/Icone.svelte';
	import './NotificationsArrivee.css';

	/**
	 * À l'arrivée sur la plateforme : quelques secondes après l'ouverture, les notifications
	 * non lues s'affichent dans une fenêtre modale, UNE PAR UNE, de la plus ancienne à la plus
	 * récente (demande du développeur : marquer l'urgence). « Lu, suivante » passe à la
	 * suivante ; « Ouvrir » mène à l'élément ; « Plus tard » ferme sans rien marquer.
	 * Les ANNONCES (ex. : arrivée des ONG du consortium) passent en premier ; marquées « lues »,
	 * elles ne reviennent jamais, même après actualisation ; fermées, elles reviennent à la
	 * prochaine arrivée. La série attend que la demande de consentement soit réglée.
	 */
	type Element = { id: string; annonce: Annonce; notif?: undefined } | { id: string; notif: NonLue; annonce?: undefined };
	const DELAI = 1500;

	let el: HTMLDialogElement | undefined = $state();
	let file = $state<Element[]>([]);
	let rang = $state(0);
	let compte: string | null = null;
	let minuterie: ReturnType<typeof setTimeout> | undefined;

	const courante = $derived(file[rang] ?? null);
	const derniere = $derived(rang >= file.length - 1);

	$effect(() => {
		if (!depot.pret || !depot.utilisateurId || !collecte.pret || collecte.demandeOuverte) return;
		const id = depot.utilisateurId;
		untrack(() => {
			if (compte === id) return;
			compte = id;
			clearTimeout(minuterie);
			minuterie = setTimeout(() => {
				// Plus ancienne d'abord : les nouvelles arrivent dans l'ordre où elles se sont produites.
				const annonces: Element[] = depot.annoncesNonLues().map((a) => ({ id: `a:${a.id}`, annonce: a }));
				const notifs: Element[] = nonLuesDe(depot.etat, depot.utilisateurId).reverse().map((x) => ({ id: x.n.id, notif: x }));
				const liste = [...annonces, ...notifs];
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
	function lire(e: Element) {
		if (e.annonce) depot.marquerAnnonceLue(e.annonce.id);
		else depot.marquerLue(e.notif.ev.id);
	}
	function suivante() {
		if (!courante) return;
		lire(courante);
		if (derniere) terminer();
		else rang += 1;
	}
	function ouvrir() {
		if (!courante?.notif) return;
		const lien = lienEvenement(courante.notif.ev);
		lire(courante);
		terminer();
		if (lien) goto(lien);
	}
	function toutLire() {
		for (const e of file.slice(rang)) lire(e);
		terminer();
	}

	const ev = $derived(courante?.notif?.ev ?? null);
	const auteur = $derived(ev ? depot.nomUtilisateur(ev.auteur) : '');
	const contexteEv = $derived(ev ? [ev.volet, ev.mois ? `rapport de ${libelleMois(ev.mois)}` : null].filter(Boolean).join(' · ') : '');
</script>

<dialog bind:this={el} class="c-arrivee" aria-labelledby="arrivee-titre" aria-describedby="arrivee-texte" onclose={terminer}>
	{#if courante}
		<header class="c-arrivee__tete">
			<p class="c-arrivee__rang">
				<span class="c-arrivee__urgence"><Icone nom="notification" taille="sm" /> Nouveau</span>
				<span>{courante.annonce ? 'Annonce' : 'Notification'} {rang + 1} sur {file.length}</span>
			</p>
			<button type="button" class="c-arrivee__fermer" onclick={terminer} aria-label="Plus tard : fermer sans marquer comme lu"><Icone nom="fermer" /></button>
		</header>
		<div class="c-arrivee__progression" aria-hidden="true">
			{#each file as x, i (x.id)}<span class:is-faite={i < rang} class:is-courante={i === rang}></span>{/each}
		</div>

		{#key courante.id}
			<div class="c-arrivee__corps">
				{#if courante.annonce}
					{@const a = courante.annonce}
					<span class="c-arrivee__logo">{#if a.organisation}<LogoOrganisation sigle={a.organisation} taille="lg" />{/if}</span>
					<div class="c-arrivee__texte">
						<h2 class="c-arrivee__titre" id="arrivee-titre">{a.titre}</h2>
						{#if a.organisation}<p class="c-arrivee__contexte">{a.organisation} · consortium APSUD</p>{/if}
						<p class="c-arrivee__message" id="arrivee-texte">{a.texte}</p>
						<p class="c-arrivee__date"><time datetime={a.cree_le} title={dateHeure(a.cree_le)}>{relatif(a.cree_le, depot.maintenant())}</time></p>
					</div>
				{:else if ev}
					<span class="c-arrivee__logo"><LogoOrganisation sigle={ev.organisation} taille="lg" /></span>
					<div class="c-arrivee__texte">
						<h2 class="c-arrivee__titre" id="arrivee-titre">{titreEvenement(ev)}</h2>
						{#if contexteEv}<p class="c-arrivee__contexte">{contexteEv}</p>{/if}
						<p class="c-arrivee__message" id="arrivee-texte">
							<strong>{auteur}</strong> ({ev.organisation}) {ev.resume} <strong>{ev.cible.libelle}</strong>
						</p>
						<p class="c-arrivee__date"><time datetime={ev.date} title={dateHeure(ev.date)}>{relatif(ev.date, depot.maintenant())}</time></p>
					</div>
				{/if}
			</div>
		{/key}

		<footer class="c-arrivee__pied">
			<button type="button" class="c-arrivee__tout" onclick={toutLire}>Tout marquer comme lu ({file.length - rang})</button>
			<div class="c-arrivee__actions">
				{#if ev && lienEvenement(ev)}
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
