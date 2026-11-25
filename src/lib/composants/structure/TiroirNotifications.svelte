<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { date, dateHeure, relatif } from '#lib/format.ts';
	import type { Annonce, Evenement, Notification } from '#lib/donnees/types.ts';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import LigneActivite from '#lib/composants/donnees/LigneActivite.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import { alertes } from '#lib/donnees/push.svelte.ts';
	import './TiroirNotifications.css';

	let el: HTMLDialogElement | undefined = $state();
	let filtre = $state<'toutes' | 'non_lues'>('non_lues');

	$effect(() => {
		if (!el) return;
		if (contexte.tiroirOuvert && !el.open) el.showModal();
		if (!contexte.tiroirOuvert && el.open) el.close();
	});

	/**
	 * Historique de la cloche : les notifications du compte ET les annonces (ex. : arrivée d'une
	 * ONG), lues ou non, telles qu'elles sont en base. Une annonce lue reste dans « Toutes ».
	 */
	type Item = { cle: string; date: string; lue: boolean; n?: Notification; ev?: Evenement; annonce?: Annonce };
	const miennes = $derived.by((): Item[] => {
		const parId = new Map(depot.etat.journal.map((e) => [e.id, e]));
		const notifs: Item[] = depot.etat.notifications
			.filter((n) => n.destinataire === depot.utilisateurId && parId.has(n.evenement_id))
			.map((n) => ({ cle: n.id, date: parId.get(n.evenement_id)!.date, lue: n.lue, n, ev: parId.get(n.evenement_id) }));
		const lues = new Set(depot.etat.annonces_lues.filter((l) => l.utilisateur === depot.utilisateurId).map((l) => l.annonce_id));
		const annonces: Item[] = depot.etat.annonces.filter((a) => !a.archive_le).map((a) => ({ cle: `a:${a.id}`, date: a.cree_le, lue: lues.has(a.id), annonce: a }));
		return [...notifs, ...annonces].sort((a, b) => b.date.localeCompare(a.date));
	});
	const affichees = $derived(filtre === 'non_lues' ? miennes.filter((x) => !x.lue) : miennes.slice(0, 80));
	const lire = (x: Item) => (x.annonce ? depot.marquerAnnonceLue(x.annonce.id) : depot.marquerLue(x.ev!.id));
	/* Alertes sur l'appareil : push du serveur (mode réel, même plateforme fermée) ou alertes locales. */
	const reel = $derived(depot.source === 'reel');

	const parJour = $derived.by(() => {
		const groupes = new Map<string, typeof affichees>();
		for (const x of affichees) {
			const jour = date(x.date);
			groupes.set(jour, [...(groupes.get(jour) ?? []), x]);
		}
		return [...groupes.entries()];
	});
</script>

<dialog bind:this={el} class="c-tiroir" aria-labelledby="tiroir-titre" onclose={() => (contexte.tiroirOuvert = false)}>
	<header class="c-tiroir__tete">
		<h2 id="tiroir-titre" class="c-tiroir__titre">Notifications</h2>
		<button class="c-tiroir__fermer" type="button" onclick={() => (contexte.tiroirOuvert = false)} aria-label="Fermer les notifications">
			<Icone nom="fermer" />
		</button>
	</header>
	<div class="c-tiroir__outils">
		<div class="c-tiroir__filtres" role="group" aria-label="Filtrer">
			<button type="button" class:is-actif={filtre === 'non_lues'} aria-pressed={filtre === 'non_lues'} onclick={() => (filtre = 'non_lues')}>Non lues ({miennes.filter((x) => !x.lue).length})</button>
			<button type="button" class:is-actif={filtre === 'toutes'} aria-pressed={filtre === 'toutes'} onclick={() => (filtre = 'toutes')}>Toutes</button>
		</div>
		<Bouton variante="texte" taille="sm" onclick={() => depot.marquerToutLu()}>Tout marquer comme lu</Bouton>
	</div>
	{#if alertes.etat !== 'indisponible'}
		<div class="c-tiroir__alertes" class:is-actives={alertes.etat === 'activees_push'}>
			<Icone nom="notification" taille="sm" />
			{#if alertes.etat === 'bloquees'}
				<p>Alertes bloquées par le navigateur. Pour les recevoir, autorisez les notifications pour ce site (icône à gauche de l’adresse), puis rouvrez la cloche.</p>
			{:else if alertes.etat === 'activees_push'}
				<p><strong>Alertes activées sur cet appareil</strong>, même quand la plateforme est fermée.</p>
				<Bouton variante="texte" taille="sm" onclick={() => alertes.desactiver()}>Désactiver</Bouton>
			{:else if alertes.etat === 'activees_local' && !(reel && alertes.pushPossible)}
				<p>Alertes activées pendant que la plateforme est ouverte{reel ? '' : ' (démonstration)'}.</p>
			{:else}
				<p>Recevez une alerte sur cet appareil{reel && alertes.pushPossible ? ', même quand la plateforme est fermée' : ' quand l’onglet est en arrière-plan'}.</p>
				<Bouton variante="secondaire" taille="sm" onclick={() => alertes.activer(reel)}>Activer</Bouton>
			{/if}
			{#if alertes.erreur}<p class="c-tiroir__alertes-erreur">{alertes.erreur}</p>{/if}
		</div>
	{/if}
	<div class="c-tiroir__corps">
		{#if !affichees.length}
			<EtatVide icone="notification" titre="Rien de nouveau" texte="Vous serez prévenu ici dès qu’une ONG soumet un rapport, modifie une valeur ou qu’APSUD prend une décision." />
		{:else}
			{#each parJour as [jour, items] (jour)}
				<h3 class="c-tiroir__jour">{jour}</h3>
				{#each items as x (x.cle)}
					<div class="c-tiroir__item" role="presentation" onclick={(e) => { if ((e.target as HTMLElement).closest('a')) lire(x); }}>
						{#if x.annonce}
							<article class="c-ligne-activite c-tiroir__annonce" class:is-non-lue={!x.lue}>
								{#if x.annonce.organisation}<LogoOrganisation sigle={x.annonce.organisation} taille="sm" />{/if}
								<div class="c-ligne-activite__texte">
									<p><strong>{x.annonce.titre}</strong> · {x.annonce.texte}</p>
									<p class="c-ligne-activite__meta"><time datetime={x.annonce.cree_le} title={dateHeure(x.annonce.cree_le)}>{relatif(x.annonce.cree_le, depot.maintenant())}</time> · annonce à tous les membres</p>
								</div>
								{#if !x.lue}<span class="c-ligne-activite__point" aria-label="Non lue"></span>{/if}
							</article>
						{:else}
							<LigneActivite evenement={x.ev!} nonLue={!x.lue} />
						{/if}
						{#if !x.lue}
							<button type="button" class="c-tiroir__lu" onclick={() => lire(x)}><Icone nom="valider" taille="sm" /> Marquer comme lu</button>
						{/if}
					</div>
				{/each}
			{/each}
		{/if}
	</div>
</dialog>
