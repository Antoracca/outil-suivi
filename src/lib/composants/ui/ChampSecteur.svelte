<script lang="ts">
	import type { Secteur } from '#lib/donnees/types.ts';
	import { chercherSecteurs, texteRecherche } from '#lib/donnees/referentiels/secteurs.ts';
	import './Champ.css';
	import './ChampSecteur.css';

	/**
	 * Choix d'un secteur avec recherche intelligente (liste déroulante « combobox » ARIA) :
	 * la liste se filtre à chaque lettre tapée, sur le nom, le code, le cluster et les mots-clés
	 * (« faim » propose Nutrition et Sécurité alimentaire, « eau » propose WASH…), sans tenir
	 * compte des accents. Si rien ne convient, « Autre » crée un nouveau secteur avec le texte tapé.
	 * Clavier : flèches, Entrée, Échap.
	 */
	interface Props {
		id: string;
		libelle: string;
		secteurs: Secteur[];
		/** Code du secteur choisi ('' si « Autre » ou rien). */
		code: string;
		/** Nom du nouveau secteur quand « Autre » est choisi ('' sinon). */
		autre: string;
		erreur?: string | null;
		aide?: string;
	}
	let { id, libelle, secteurs, code = $bindable(), autre = $bindable(), erreur = null, aide }: Props = $props();

	const choisi = $derived(secteurs.find((s) => s.code === code));
	let texte = $state('');
	let ouvert = $state(false);
	let actif = $state(0);
	let champ: HTMLInputElement | undefined = $state();

	// Affiche le libellé du secteur choisi quand la liste est fermée.
	$effect(() => {
		if (!ouvert) texte = choisi ? choisi.libelle : autre;
	});

	const resultats = $derived(chercherSecteurs(secteurs, ouvert && texte !== (choisi?.libelle ?? '') ? texte : ''));
	const exact = $derived(secteurs.some((s) => texteRecherche(s.libelle) === texteRecherche(texte)));
	const proposerAutre = $derived(texte.trim().length >= 3 && !exact);
	const total = $derived(resultats.length + (proposerAutre ? 1 : 0));
	const idOption = (i: number) => `${id}-option-${i}`;

	function choisir(i: number) {
		if (i < resultats.length) {
			code = resultats[i].code;
			autre = '';
			texte = resultats[i].libelle;
		} else if (proposerAutre) {
			code = '';
			autre = texte.trim().replace(/\s+/g, ' ');
		}
		ouvert = false;
	}

	function clavier(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!ouvert) ouvert = true;
			else actif = Math.min(actif + 1, total - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			actif = Math.max(actif - 1, 0);
		} else if (e.key === 'Enter' && ouvert && total) {
			e.preventDefault();
			choisir(actif);
		} else if (e.key === 'Escape' && ouvert) {
			e.preventDefault();
			ouvert = false;
		}
	}

	function saisir() {
		ouvert = true;
		actif = 0;
		// Le texte modifié ne correspond plus au secteur choisi : on attend un nouveau choix.
		if (choisi && texte !== choisi.libelle) code = '';
		if (autre && texte !== autre) autre = '';
	}

	/** Met en évidence les mots tapés dans le libellé. */
	function morceaux(libelleSecteur: string): { t: string; fort: boolean }[] {
		const mots = texteRecherche(texte).split(/\s+/).filter((m) => m.length > 1);
		if (!mots.length) return [{ t: libelleSecteur, fort: false }];
		const norme = texteRecherche(libelleSecteur);
		const marque = new Array(libelleSecteur.length).fill(false);
		for (const m of mots) {
			let i = norme.indexOf(m);
			while (i >= 0) {
				for (let k = i; k < i + m.length; k++) marque[k] = true;
				i = norme.indexOf(m, i + m.length);
			}
		}
		const sortie: { t: string; fort: boolean }[] = [];
		for (let i = 0; i < libelleSecteur.length; i++) {
			const dernier = sortie.at(-1);
			if (dernier && dernier.fort === marque[i]) dernier.t += libelleSecteur[i];
			else sortie.push({ t: libelleSecteur[i], fort: marque[i] });
		}
		return sortie;
	}
	const motCleTrouve = (s: Secteur) => {
		const mots = texteRecherche(texte).split(/\s+/).filter((m) => m.length > 1);
		if (!mots.length || mots.every((m) => texteRecherche(s.libelle).includes(m))) return null;
		return s.mots_cles.find((k) => mots.some((m) => texteRecherche(k).includes(m))) ?? null;
	};
</script>

<div class="c-champ c-champ-secteur" class:c-champ--erreur={!!erreur}>
	<label class="c-champ__libelle" for={id}>{libelle}</label>
	<div class="c-champ-secteur__boite">
		<input
			bind:this={champ}
			class="c-champ__saisie"
			{id}
			type="text"
			role="combobox"
			autocomplete="off"
			spellcheck="false"
			aria-autocomplete="list"
			aria-expanded={ouvert}
			aria-controls="{id}-liste"
			aria-activedescendant={ouvert && total ? idOption(actif) : undefined}
			aria-describedby={[aide ? `${id}-aide` : '', erreur ? `${id}-erreur` : '', `${id}-etat`].filter(Boolean).join(' ')}
			aria-invalid={!!erreur}
			placeholder="Tapez : eau, faim, santé, école…"
			bind:value={texte}
			oninput={saisir}
			onfocus={() => (ouvert = true)}
			onblur={() => setTimeout(() => (ouvert = false), 150)}
			onkeydown={clavier}
		/>
		{#if ouvert}
			<ul class="c-champ-secteur__liste" id="{id}-liste" role="listbox" aria-label="Secteurs">
				{#each resultats as s, i (s.code)}
					{@const cle = motCleTrouve(s)}
					<li
						id={idOption(i)}
						role="option"
						class="c-champ-secteur__option"
						class:is-actif={i === actif}
						aria-selected={s.code === code}
						onmousedown={(e) => {
							e.preventDefault();
							choisir(i);
						}}
						onmousemove={() => (actif = i)}
					>
						<span class="c-champ-secteur__nom">{#each morceaux(s.libelle) as m, k (k)}{#if m.fort}<mark>{m.t}</mark>{:else}{m.t}{/if}{/each}</span>
						<span class="c-champ-secteur__detail">{s.code} · cluster {s.cluster_cbpf}{#if cle} · « {cle} »{/if}</span>
					</li>
				{/each}
				{#if proposerAutre}
					<li
						id={idOption(resultats.length)}
						role="option"
						class="c-champ-secteur__option c-champ-secteur__option--autre"
						class:is-actif={actif === resultats.length}
						aria-selected={!code && autre === texte.trim()}
						onmousedown={(e) => {
							e.preventDefault();
							choisir(resultats.length);
						}}
						onmousemove={() => (actif = resultats.length)}
					>
						<span class="c-champ-secteur__nom">Autre : « {texte.trim()} »</span>
						<span class="c-champ-secteur__detail">Nouveau secteur, ajouté à la liste pour tout le consortium</span>
					</li>
				{/if}
				{#if !total}
					<li class="c-champ-secteur__vide" role="presentation">Aucun secteur trouvé. Tapez au moins 3 lettres pour en créer un.</li>
				{/if}
			</ul>
		{/if}
	</div>
	<p class="u-visuellement-masque" id="{id}-etat" aria-live="polite">{ouvert ? `${resultats.length} secteur${resultats.length > 1 ? 's' : ''} trouvé${resultats.length > 1 ? 's' : ''}${proposerAutre ? ', et « Autre »' : ''}.` : ''}</p>
	{#if choisi}
		<p class="c-champ-secteur__choix">Secteur choisi : <strong>{choisi.libelle}</strong> ({choisi.code})</p>
	{:else if autre}
		<p class="c-champ-secteur__choix">Nouveau secteur : <strong>{autre}</strong>. Il sera ajouté à la liste à l’enregistrement.</p>
	{/if}
	{#if aide}<p class="c-champ__aide" id="{id}-aide">{aide}</p>{/if}
	{#if erreur}<p class="c-champ__erreur" id="{id}-erreur">{erreur}</p>{/if}
</div>
