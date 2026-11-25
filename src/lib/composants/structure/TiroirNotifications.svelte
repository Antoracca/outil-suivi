<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { date } from '#lib/format.ts';
	import Icone from '#lib/icones/Icone.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import LigneActivite from '#lib/composants/donnees/LigneActivite.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import './TiroirNotifications.css';

	let el: HTMLDialogElement | undefined = $state();
	let filtre = $state<'toutes' | 'non_lues'>('non_lues');

	$effect(() => {
		if (!el) return;
		if (contexte.tiroirOuvert && !el.open) el.showModal();
		if (!contexte.tiroirOuvert && el.open) el.close();
	});

	const miennes = $derived(
		depot.etat.notifications
			.filter((n) => n.destinataire === depot.utilisateurId)
			.map((n) => ({ n, ev: depot.etat.journal.find((e) => e.id === n.evenement_id) }))
			.filter((x) => x.ev)
			.sort((a, b) => b.ev!.date.localeCompare(a.ev!.date))
	);
	const affichees = $derived(filtre === 'non_lues' ? miennes.filter((x) => !x.n.lue) : miennes.slice(0, 60));
	/* Alertes du navigateur (onglet en arrière-plan) : à autoriser une fois par appareil. */
	const alertesPossibles = typeof Notification !== 'undefined';
	let permission = $state<NotificationPermission>(alertesPossibles ? Notification.permission : 'denied');
	async function activerAlertes() {
		if (!alertesPossibles) return;
		permission = await Notification.requestPermission();
		if (permission === 'granted') new Notification('Alertes activées', { body: 'Vous serez prévenu ici même quand l’onglet de la plateforme est en arrière-plan.', icon: '/logo-apsud.jpg' });
	}

	const parJour = $derived.by(() => {
		const groupes = new Map<string, typeof affichees>();
		for (const x of affichees) {
			const jour = date(x.ev!.date);
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
			<button type="button" class:is-actif={filtre === 'non_lues'} aria-pressed={filtre === 'non_lues'} onclick={() => (filtre = 'non_lues')}>Non lues ({miennes.filter((x) => !x.n.lue).length})</button>
			<button type="button" class:is-actif={filtre === 'toutes'} aria-pressed={filtre === 'toutes'} onclick={() => (filtre = 'toutes')}>Toutes</button>
		</div>
		<Bouton variante="texte" taille="sm" onclick={() => depot.marquerToutLu()}>Tout marquer comme lu</Bouton>
	</div>
	{#if alertesPossibles && permission !== 'granted'}
		<div class="c-tiroir__alertes">
			<Icone nom="notification" taille="sm" />
			{#if permission === 'denied'}
				<p>Alertes bloquées par le navigateur. Pour les recevoir, autorisez les notifications pour ce site (icône à gauche de l’adresse).</p>
			{:else}
				<p>Recevez une alerte sur cet appareil quand l’onglet est en arrière-plan.</p>
				<Bouton variante="secondaire" taille="sm" onclick={activerAlertes}>Activer</Bouton>
			{/if}
		</div>
	{/if}
	<div class="c-tiroir__corps">
		{#if !affichees.length}
			<EtatVide icone="notification" titre="Rien de nouveau" texte="Vous serez prévenu ici dès qu’une ONG soumet un rapport, modifie une valeur ou qu’APSUD prend une décision." />
		{:else}
			{#each parJour as [jour, items] (jour)}
				<h3 class="c-tiroir__jour">{jour}</h3>
				{#each items as x (x.n.id)}
					<div class="c-tiroir__item" role="presentation" onclick={(e) => { if ((e.target as HTMLElement).closest('a')) depot.marquerLue(x.ev!.id); }}>
						<LigneActivite evenement={x.ev!} nonLue={!x.n.lue} />
						{#if !x.n.lue}
							<button type="button" class="c-tiroir__lu" onclick={() => depot.marquerLue(x.ev!.id)}><Icone nom="valider" taille="sm" /> Marquer comme lu</button>
						{/if}
					</div>
				{/each}
			{/each}
		{/if}
	</div>
</dialog>
