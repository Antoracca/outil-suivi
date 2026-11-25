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
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import '#lib/composants/ui/Dialogue.css';
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
	/** Ce qu'affiche la fenêtre, pour une annonce comme pour une notification. */
	const vue = $derived.by(() => {
		if (!courante) return null;
		const nomDe = (sigle: string | null) => (sigle ? (depot.etat.organisations.find((o) => o.sigle === sigle)?.nom ?? sigle) : 'Consortium APSUD');
		if (courante.annonce) {
			const a = courante.annonce;
			return { organisation: a.organisation, nomOrganisation: nomDe(a.organisation), titre: a.titre, texte: a.texte, contexte: 'à tous les membres', date: a.cree_le, lien: null as string | null };
		}
		const e = courante.notif.ev;
		return { organisation: e.organisation, nomOrganisation: nomDe(e.organisation), titre: titreEvenement(e), texte: '', contexte: contexteEv, date: e.date, lien: lienEvenement(e) };
	});
</script>

<dialog bind:this={el} class="c-dialogue c-arrivee" aria-labelledby="arrivee-titre" aria-describedby="arrivee-texte" onclose={terminer}>
	{#if courante && vue}
		<header class="c-arrivee__tete">
			<p class="c-arrivee__repere">
				<span class="c-arrivee__type">{courante.annonce ? 'Annonce' : 'Notification'}</span>
				<span class="c-arrivee__compte">{rang + 1} sur {file.length}</span>
			</p>
			<button type="button" class="c-dialogue__fermer" onclick={terminer} aria-label="Plus tard : fermer sans marquer comme lu"><Icone nom="fermer" /></button>
		</header>
		<div class="c-arrivee__jauge" role="progressbar" aria-label="Progression de la lecture" aria-valuemin={1} aria-valuemax={file.length} aria-valuenow={rang + 1}>
			<span style:inline-size="{((rang + 1) / file.length) * 100}%"></span>
		</div>

		{#key courante.id}
			<div class="c-arrivee__corps">
				<div class="c-arrivee__emetteur">
					{#if vue.organisation}<LogoOrganisation sigle={vue.organisation} taille="md" />{/if}
					<div>
						<p class="c-arrivee__nom">{vue.nomOrganisation}</p>
						<p class="c-arrivee__meta">
							{#if vue.contexte}{`${vue.contexte} · `}{/if}<time datetime={vue.date} title={dateHeure(vue.date)}>{relatif(vue.date, depot.maintenant())}</time>
						</p>
					</div>
				</div>
				<h2 class="c-arrivee__titre" id="arrivee-titre">{vue.titre}</h2>
				<p class="c-arrivee__message" id="arrivee-texte">
					{#if ev}<strong>{auteur}</strong> {ev.resume} <strong>{ev.cible.libelle}</strong>{:else}{vue.texte}{/if}
				</p>
			</div>
		{/key}

		<footer class="c-dialogue__pied c-arrivee__pied">
			{#if file.length - rang > 1}
				<Bouton variante="texte" taille="sm" onclick={toutLire}>Tout marquer comme lu</Bouton>
			{/if}
			<div class="c-arrivee__actions">
				{#if vue.lien}<Bouton variante="secondaire" onclick={ouvrir}>Ouvrir</Bouton>{/if}
				<Bouton variante="primaire" icone="valider" onclick={suivante}>{derniere ? 'Lu, terminer' : 'Lu, suivante'}</Bouton>
			</div>
		</footer>
	{/if}
</dialog>
