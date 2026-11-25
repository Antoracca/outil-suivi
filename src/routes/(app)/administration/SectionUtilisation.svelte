<script lang="ts">
	import { onMount } from 'svelte';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { serveur } from '#lib/donnees/reel/client.ts';
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import { nombre } from '#lib/format.ts';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Icone from '#lib/icones/Icone.svelte';

	/**
	 * Utilisation de l'outil (super-administrateur) : premier tableau de la mesure d'utilisation,
	 * sur 30 jours, à enrichir. Mode réel : synthèse calculée par la base (resume_analytique) ;
	 * démonstration : mesures gardées dans ce navigateur.
	 */
	interface Resume {
		consentements: { oui: number; non: number } | null;
		evenements: number;
		sessions: number;
		pages: { page: string; nb: number }[];
		clics: { cible: string; nb: number }[];
	}
	let resume = $state<Resume | null>(null);
	let erreur = $state<string | null>(null);

	function compter<T extends string>(liste: T[]): { cle: T; nb: number }[] {
		const m = new Map<T, number>();
		for (const x of liste) m.set(x, (m.get(x) ?? 0) + 1);
		return [...m.entries()].map(([cle, nb]) => ({ cle, nb })).sort((a, b) => b.nb - a.nb).slice(0, 12);
	}

	onMount(async () => {
		if (depot.source === 'demo') {
			const m = collecte.mesuresDemo();
			resume = {
				consentements: null,
				evenements: m.length,
				sessions: 1,
				pages: compter(m.filter((x) => x.type === 'page').map((x) => x.page)).map((x) => ({ page: x.cle, nb: x.nb })),
				clics: compter(m.filter((x) => x.type === 'clic' && x.cible).map((x) => x.cible!)).map((x) => ({ cible: x.cle, nb: x.nb }))
			};
			return;
		}
		const { data, error } = await serveur().rpc('resume_analytique');
		if (error) erreur = error.message;
		else resume = data as Resume;
	});
</script>

<Panneau titre="Utilisation de l’outil" sousTitre="Mesure d’utilisation des 30 derniers jours, seulement pour les comptes qui y consentent. Point de départ, à enrichir.">
	{#if erreur}
		<p class="p-admin__note"><Icone nom="alerte" taille="sm" /> <span>Synthèse indisponible : {erreur}</span></p>
	{:else if !resume}
		<p class="p-admin__note"><span>Chargement…</span></p>
	{:else}
		<dl class="p-admin__usage-chiffres">
			{#if resume.consentements}
				<div><dt>Comptes qui consentent</dt><dd>{nombre(resume.consentements.oui)}</dd></div>
				<div><dt>Comptes qui refusent</dt><dd>{nombre(resume.consentements.non)}</dd></div>
			{/if}
			<div><dt>Événements mesurés</dt><dd>{nombre(resume.evenements)}</dd></div>
			<div><dt>Sessions</dt><dd>{nombre(resume.sessions)}</dd></div>
		</dl>
		<div class="p-admin__usage-listes">
			<div>
				<h3 class="p-admin__usage-titre">Pages les plus ouvertes</h3>
				{#if resume.pages.length}
					<ol>{#each resume.pages as p (p.page)}<li><span class="u-code">{p.page}</span> <span class="p-admin__detail">{nombre(p.nb)}</span></li>{/each}</ol>
				{:else}<p class="p-admin__detail">Rien encore.</p>{/if}
			</div>
			<div>
				<h3 class="p-admin__usage-titre">Boutons et liens les plus utilisés</h3>
				{#if resume.clics.length}
					<ol>{#each resume.clics as c (c.cible)}<li>{c.cible} <span class="p-admin__detail">{nombre(c.nb)}</span></li>{/each}</ol>
				{:else}<p class="p-admin__detail">Rien encore.</p>{/if}
			</div>
		</div>
		{#if depot.source === 'demo'}
			<p class="p-admin__note"><Icone nom="info" taille="sm" /> <span>Démonstration : mesures de ce navigateur seulement (après « Je consens »).</span></p>
		{/if}
	{/if}
</Panneau>
