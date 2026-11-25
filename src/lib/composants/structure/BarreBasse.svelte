<script lang="ts">
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { moisARapporter, rapport } from '#lib/donnees/calculs.ts';
	import { LIBELLES_ROLE, peutAdministrer, peutValider, peutVoirArchives } from '#lib/donnees/regles.ts';
	import Icone from '#lib/icones/Icone.svelte';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import { nonLuesDe } from '#lib/donnees/notifications.ts';
	import type { NomIcone } from '#lib/icones/icones.ts';
	import './BarreBasse.css';

	/** Navigation du téléphone (< 640 px) : 4 entrées en bas d'écran + menu « Plus ». */
	const u = $derived(depot.utilisateur);
	const chemin = $derived(page.url.pathname);
	const attendu = $derived(moisARapporter(depot.etat, depot.maintenant()));
	const aValider = $derived(depot.etat.rapports.filter((r) => r.statut === 'soumis').length);
	let menu: HTMLDialogElement | undefined = $state();
	const nonLues = $derived(nonLuesDe(depot.etat, depot.utilisateurId));
	const nouveautes = (code: string) => nonLues.filter((x) => x.ev.volet === code).length;

	/** L'entrée centrale dépend du rôle : saisir pour une ONG, valider pour APSUD. */
	const centrale = $derived.by(() => {
		if (u?.role === 'saisie') {
			const mes = depot.etat.volets.filter((v) => v.organisation === u.organisation);
			const volet = mes.find((v) => ['non_commence', 'brouillon', 'a_corriger'].includes(rapport(depot.etat, v.code, attendu)?.statut ?? 'non_commence')) ?? mes[0];
			return { href: `/volets/${volet.code}/activites/${attendu}`, libelle: 'Saisir', icone: 'saisie' as NomIcone, compteur: 0 };
		}
		if (peutValider(u)) return { href: '/validation', libelle: 'Valider', icone: 'validation' as NomIcone, compteur: aValider };
		return { href: '/exports', libelle: 'Exports', icone: 'export' as NomIcone, compteur: 0 };
	});

	const entrees = $derived([
		{ href: '/', libelle: 'Accueil', icone: 'tableau-de-bord' as NomIcone, compteur: 0 },
		centrale,
		{ href: '/activite', libelle: 'Activité', icone: 'activite' as NomIcone, compteur: 0 }
	]);

	const outils = $derived(
		[
			{ href: '/validation', libelle: 'Validation', icone: 'validation' as NomIcone, visible: peutValider(u) },
			{ href: '/exports', libelle: 'Exports', icone: 'export' as NomIcone, visible: true },
			{ href: '/archives', libelle: 'Archives', icone: 'archive' as NomIcone, visible: peutVoirArchives(u) },
			{ href: '/administration', libelle: 'Administration', icone: 'parametres' as NomIcone, visible: peutAdministrer(u) }
		].filter((l) => l.visible)
	);

	const actif = (href: string) => (href === '/' ? chemin === '/' : chemin.startsWith(href.split('/activites')[0]));
	const secteur = (code: string) => depot.etat.secteurs.find((s) => s.code === code)!;

	function aller(href: string) {
		menu?.close();
		goto(href);
	}
</script>

<nav class="c-barre-basse" aria-label="Navigation principale">
	<ul role="list">
		{#each entrees as e (e.href)}
			<li>
				<a href={e.href} class="c-barre-basse__lien" class:is-actif={actif(e.href)} aria-current={actif(e.href) ? 'page' : undefined}>
					<span class="c-barre-basse__icone">
						<Icone nom={e.icone} />
						{#if e.compteur}<span class="c-barre-basse__pastille">{e.compteur}<span class="u-visuellement-masque"> à valider</span></span>{/if}
					</span>
					<span>{e.libelle}</span>
				</a>
			</li>
		{/each}
		<li>
			<button type="button" class="c-barre-basse__lien" onclick={() => menu?.showModal()} aria-haspopup="dialog">
				<span class="c-barre-basse__icone"><Icone nom="menu" /></span>
				<span>Plus</span>
			</button>
		</li>
	</ul>
</nav>

<dialog class="c-barre-basse__menu" bind:this={menu} aria-label="Menu">
	<header class="c-barre-basse__menu-tete">
		{#if u}
			<p><strong>{u.nom}</strong><span>{u.organisation} · {LIBELLES_ROLE[u.role]}</span></p>
		{/if}
		<button type="button" class="c-barre-basse__fermer" onclick={() => menu?.close()} aria-label="Fermer le menu"><Icone nom="fermer" /></button>
	</header>
	<p class="c-barre-basse__groupe">Volets</p>
	<ul role="list" class="c-barre-basse__liste">
		{#each depot.etat.volets as v (v.code)}
			<li>
				<button type="button" onclick={() => aller(`/volets/${v.code}`)}>
					<LogoOrganisation sigle={v.organisation} taille="sm" />
					<span><strong>{v.organisation}</strong> {secteur(v.secteur).libelle_court}</span>
					{#if nouveautes(v.code)}<span class="c-barre-basse__nouveau">{nouveautes(v.code)}<span class="u-visuellement-masque"> non lues</span></span>{/if}
				</button>
			</li>
		{/each}
	</ul>
	<p class="c-barre-basse__groupe">Outils</p>
	<ul role="list" class="c-barre-basse__liste">
		{#each outils as o (o.href)}
			<li><button type="button" onclick={() => aller(o.href)}><Icone nom={o.icone} /> <span>{o.libelle}</span></button></li>
		{/each}
		{#if depot.source === 'demo'}
			<li><button type="button" onclick={() => aller('/connexion')}><Icone nom="equipe" /> <span>Changer de compte de démonstration</span></button></li>
		{/if}
		<li><button type="button" onclick={() => { menu?.close(); collecte.revoir(); }}><Icone nom="activite" /> <span>Mesure d’utilisation : {collecte.choix === true ? 'activée' : collecte.choix === false ? 'désactivée' : 'à choisir'}</span></button></li>
		<li><button type="button" onclick={() => { menu?.close(); depot.deconnecter(); goto('/connexion'); }}><Icone nom="deconnexion" /> <span>Se déconnecter</span></button></li>
	</ul>
</dialog>
