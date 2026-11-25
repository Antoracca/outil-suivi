<script lang="ts">
	import { page } from '$app/state';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { peutAdministrer, peutValider, peutVoirArchives } from '#lib/donnees/regles.ts';
	import { nonLuesDe } from '#lib/donnees/notifications.ts';
	import Icone from '#lib/icones/Icone.svelte';
	import LogoOrganisation from '#lib/composants/ui/LogoOrganisation.svelte';
	import type { NomIcone } from '#lib/icones/icones.ts';
	import LogoApsud from './LogoApsud.svelte';
	import './BarreLaterale.css';

	const u = $derived(depot.utilisateur);
	const chemin = $derived(page.url.pathname);
	const aValider = $derived(depot.etat.rapports.filter((r) => r.statut === 'soumis').length);

	const liens = $derived(
		[
			{ href: '/', libelle: 'Tableau de bord', icone: 'tableau-de-bord' as NomIcone, visible: true },
			{ href: '/validation', libelle: 'Validation', icone: 'validation' as NomIcone, visible: peutValider(u), compteur: aValider },
			{ href: '/activite', libelle: 'Activité', icone: 'activite' as NomIcone, visible: true },
			{ href: '/exports', libelle: 'Exports', icone: 'export' as NomIcone, visible: true },
			{ href: '/archives', libelle: 'Archives', icone: 'archive' as NomIcone, visible: peutVoirArchives(u) },
			{ href: '/administration', libelle: 'Administration', icone: 'parametres' as NomIcone, visible: peutAdministrer(u) }
		].filter((l) => l.visible)
	);

	const actif = (href: string) => (href === '/' ? chemin === '/' : chemin.startsWith(href));
	const secteur = (code: string) => depot.etat.secteurs.find((s) => s.code === code)!;
	const nonLues = $derived(nonLuesDe(depot.etat, depot.utilisateurId));
	const nouveautes = (code: string) => nonLues.filter((x) => x.ev.volet === code).length;
</script>

<nav class="c-nav" class:c-nav--repliee={contexte.navRepliee} aria-label="Navigation principale">
	<div class="c-nav__tete">
		<a href="/" class="c-nav__marque" title="Tableau de bord du consortium">
			<LogoApsud />
			<span class="c-nav__marque-texte">
				<span class="c-nav__produit">Suivi consortium</span>
				<span class="u-code">FH · 41469</span>
			</span>
			<!-- Nom accessible conservé quand la navigation est repliée (texte masqué). -->
			<span class="u-visuellement-masque">, tableau de bord</span>
		</a>
		<button
			class="c-nav__replier"
			type="button"
			onclick={() => (contexte.navRepliee = !contexte.navRepliee)}
			aria-label={contexte.navRepliee ? 'Déplier la navigation' : 'Replier la navigation'}
			aria-expanded={!contexte.navRepliee}
		>
			<Icone nom={contexte.navRepliee ? 'deplier' : 'replier'} />
		</button>
	</div>

	<ul class="c-nav__liste" role="list">
		{#each liens.slice(0, 1) as l (l.href)}
			<li>
				<a href={l.href} class="c-nav__lien" class:is-actif={actif(l.href)} aria-current={actif(l.href) ? 'page' : undefined}>
					<Icone nom={l.icone} />
					<span class="c-nav__libelle">{l.libelle}</span>
				</a>
			</li>
		{/each}
	</ul>

	<p class="c-nav__groupe" id="nav-volets">Volets</p>
	<ul class="c-nav__liste" role="list" aria-labelledby="nav-volets">
		{#each depot.etat.volets as v (v.code)}
			{@const href = `/volets/${v.code}`}
			<li>
				<a {href} class="c-nav__lien c-nav__lien--volet" class:is-actif={actif(href)} aria-current={actif(href) ? 'page' : undefined}>
					<LogoOrganisation sigle={v.organisation} taille="sm" />
					<span class="c-nav__libelle">
						<span class="c-nav__volet-org">{v.organisation}</span>
						<span class="c-nav__volet-secteur">{secteur(v.secteur).libelle_court}</span>
					</span>
					{#if nouveautes(v.code)}
						<span class="c-nav__compteur c-nav__compteur--nouveau" title="{nouveautes(v.code)} nouveauté(s) non lue(s)">{nouveautes(v.code)}<span class="u-visuellement-masque"> nouveauté{nouveautes(v.code) > 1 ? 's' : ''} non lue{nouveautes(v.code) > 1 ? 's' : ''}</span></span>
					{:else if u && u.role === 'saisie' && u.organisation === v.organisation}
						<span class="c-nav__mien" title="Votre organisation">●<span class="u-visuellement-masque"> (votre organisation)</span></span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>

	<ul class="c-nav__liste c-nav__liste--outils" role="list">
		{#each liens.slice(1) as l (l.href)}
			<li>
				<a href={l.href} class="c-nav__lien" class:is-actif={actif(l.href)} aria-current={actif(l.href) ? 'page' : undefined}>
					<Icone nom={l.icone} />
					<span class="c-nav__libelle">{l.libelle}</span>
					{#if l.compteur}<span class="c-nav__compteur">{l.compteur}<span class="u-visuellement-masque"> rapports à valider</span></span>{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
