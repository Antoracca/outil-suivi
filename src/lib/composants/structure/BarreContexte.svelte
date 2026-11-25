<script lang="ts">
	import { collecte } from '#lib/analytique/collecte.svelte.ts';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { LIBELLES_ROLE } from '#lib/donnees/regles.ts';
	import { libelleMois, majuscule } from '#lib/format.ts';
	import Icone from '#lib/icones/Icone.svelte';
	import type { CodeVolet, Mois } from '#lib/donnees/types.ts';
	import './BarreContexte.css';

	const u = $derived(depot.utilisateur);
	const codeVolet = $derived(page.params.code as CodeVolet | undefined);
	const moisAdresse = $derived(page.params.mois as Mois | undefined);
	const mois = $derived(moisAdresse ?? contexte.mois);
	const nonLues = $derived(depot.notificationsNonLues());
	const liste = $derived(depot.etat.projet.mois);
	const indexMois = $derived(liste.indexOf(mois));
	let menuOuvert = $state(false);
	let boutonCompte: HTMLButtonElement | undefined = $state();

	function allerMois(m: Mois) {
		contexte.mois = m;
		// Garde l’onglet ouvert (Indicateurs ou Activités) et change seulement le mois de l’adresse.
		if (moisAdresse && codeVolet) goto(page.url.pathname.replace(/\/\d{4}-\d{2}$/,`/${m}`));
	}

	function changerVolet(code: string) {
		const suite = page.url.pathname.split('/').slice(3).join('/');
		goto(`/volets/${code}${suite ? '/' + suite : ''}`);
	}

	const secteur = (code: string) => depot.etat.secteurs.find((s) => s.code === code)!;
</script>

<header class="c-contexte">
	<div class="c-contexte__gauche">
		{#if codeVolet}
			<label class="c-contexte__champ">
				<span class="u-visuellement-masque">Volet</span>
				<select class="c-contexte__select" value={codeVolet} onchange={(e) => changerVolet(e.currentTarget.value)}>
					{#each depot.etat.volets as v (v.code)}
						<option value={v.code}>{v.organisation}, {secteur(v.secteur).libelle_court}</option>
					{/each}
				</select>
				<Icone nom="chevron-bas" taille="sm" />
			</label>
		{/if}
		<div class="c-contexte__mois" role="group" aria-label="Mois">
			<button class="c-contexte__fleche" type="button" onclick={() => allerMois(liste[indexMois - 1])} disabled={indexMois <= 0} aria-label="Mois précédent">
				<Icone nom="chevron-gauche" taille="sm" />
			</button>
			<label class="c-contexte__champ c-contexte__champ--mois">
				<span class="u-visuellement-masque">Mois du rapport affiché</span>
				<select class="c-contexte__select" value={mois} onchange={(e) => allerMois(e.currentTarget.value)}>
					{#each liste as m, i (m)}
						<option value={m} title="Mois {i + 1} sur {liste.length}">{majuscule(libelleMois(m))}</option>
					{/each}
				</select>
			</label>
			<button class="c-contexte__fleche" type="button" onclick={() => allerMois(liste[indexMois + 1])} disabled={indexMois >= liste.length - 1} aria-label="Mois suivant">
				<Icone nom="chevron-droite" taille="sm" />
			</button>
		</div>
	</div>

	<div class="c-contexte__droite">
		<button
			class="c-contexte__reseau"
			class:is-hors-ligne={!depot.enLigne}
			type="button"
			onclick={() => depot.basculerReseau()}
			title={depot.source === 'demo' ? 'Démonstration : cliquez pour simuler une coupure réseau' : 'État de la connexion (cliquez pour simuler une coupure, utile en formation)'}
		>
			<Icone nom={depot.enLigne ? 'en-ligne' : 'hors-ligne'} taille="sm" />
			<span>{depot.enLigne ? 'En ligne' : `Hors ligne${depot.fileAttente.length ? ` · ${depot.fileAttente.length} en attente` : ''}`}</span>
		</button>

		<button class="c-contexte__cloche" type="button" data-mesure="Cloche des notifications" onclick={() => (contexte.tiroirOuvert = true)} aria-label={nonLues ? `Notifications : ${nonLues} non lues` : 'Notifications'}>
			<Icone nom="notification" />
			{#if nonLues}<span class="c-contexte__pastille" aria-hidden="true">{nonLues > 99 ? '99+' : nonLues}</span>{/if}
		</button>

		{#if u}
			<!-- Le menu se ferme avec Échap (le focus revient au bouton) ou quand le focus le quitte. -->
			<div
				class="c-contexte__compte"
				role="presentation"
				onkeydown={(e) => {
					if (e.key === 'Escape' && menuOuvert) {
						menuOuvert = false;
						boutonCompte?.focus();
					}
				}}
				onfocusout={(e) => {
					if (!e.currentTarget.contains(e.relatedTarget as Node | null)) menuOuvert = false;
				}}
			>
				<button bind:this={boutonCompte} class="c-contexte__utilisateur" type="button" aria-expanded={menuOuvert} aria-controls="menu-compte" onclick={() => (menuOuvert = !menuOuvert)}>
					<span class="c-avatar c-contexte__icone-compte" title={u.nom}><img src="/icones/compte.png" alt="" /><span class="u-visuellement-masque">{u.nom}</span></span>
					<span class="c-contexte__identite">
						<span class="c-contexte__nom">{u.nom}</span>
						<span class="c-contexte__role">{u.organisation} · {LIBELLES_ROLE[u.role]}</span>
					</span>
					<Icone nom="chevron-bas" taille="sm" />
				</button>
				{#if menuOuvert}
					<div class="c-contexte__menu" id="menu-compte">
						<p class="c-contexte__menu-info">{u.fonction}</p>
						{#if depot.source === 'demo'}
							<a class="c-contexte__menu-lien" href="/connexion" onclick={() => (menuOuvert = false)}>
								<Icone nom="equipe" taille="sm" /> Changer de compte de démonstration
							</a>
						{/if}
						<button class="c-contexte__menu-lien" type="button" onclick={() => { collecte.revoir(); menuOuvert = false; }}>
							<Icone nom="activite" taille="sm" /> Mesure d’utilisation : {collecte.choix === true ? 'acceptée' : collecte.choix === false ? 'refusée' : 'à choisir'}
						</button>
						<button class="c-contexte__menu-lien" type="button" onclick={() => { depot.deconnecter(); menuOuvert = false; goto('/connexion'); }}>
							<Icone nom="deconnexion" taille="sm" /> Se déconnecter
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</header>
