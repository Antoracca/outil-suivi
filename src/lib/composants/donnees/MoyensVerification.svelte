<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { FORMATS_JUSTIFICATIF } from '#lib/donnees/regles.ts';
	import { taille } from '#lib/format.ts';
	import type { CodeVolet, Justificatif, Mois } from '#lib/donnees/types.ts';
	import Icone from '#lib/icones/Icone.svelte';
	import './MoyensVerification.css';

	/**
	 * Justificatifs d'un élément (indicateur, activité, rapport du mois) : tous ses moyens de
	 * vérification sont affichés d'un coup, chacun avec sa case. Tant que la case n'est pas
	 * cochée, rien d'autre ; cochée, le bouton « Téléverser le document » apparaît devant.
	 * Une pièce envoyée garde la case cochée. Documents seulement, pas de photo.
	 * Demandes d'APSUD des 24 et 25 novembre 2026 : la même logique partout.
	 */
	interface Props {
		volet: CodeVolet;
		mois: Mois;
		modifiable: boolean;
		rattachement: Justificatif['rattachement'];
		moyens: string[];
		/** Préfixe des identifiants (unique sur la page). */
		idBase: string;
		titre?: string;
	}
	let { volet, mois, modifiable, rattachement, moyens, idBase, titre = 'Moyens de vérification' }: Props = $props();

	/** « Autre document » toujours proposé en dernier, pour une pièce non prévue au cadre logique. */
	const AUTRE = 'Autre document';
	const liste = $derived([...new Set([...moyens.map((m) => m.trim()).filter(Boolean), AUTRE])]);

	const pieces = $derived(
		depot.etat.justificatifs.filter((j) => j.volet === volet && j.mois === mois && !j.archive_le && j.rattachement.type === rattachement.type && j.rattachement.id === rattachement.id)
	);
	const piecesDe = (moyen: string) => pieces.filter((j) => (j.moyen_verification ?? AUTRE) === moyen);
	let coches = $state<Record<string, boolean>>({});
	const coche = (moyen: string) => coches[moyen] ?? piecesDe(moyen).length > 0;
	let erreur = $state<string | null>(null);

	function televerser(moyen: string, champ: HTMLInputElement) {
		const f = champ.files?.[0];
		if (!f) return;
		erreur = null;
		try {
			depot.ajouterJustificatif(volet, mois, rattachement, { nom: f.name, type: f.type, taille: f.size }, moyen, f);
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
		champ.value = '';
	}
	const premiereMajuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
</script>

<fieldset class="c-moyens">
	<legend class="c-moyens__titre">{titre}</legend>
	<ul class="c-moyens__liste" role="list">
		{#each liste as moyen, k (moyen)}
			{@const deja = piecesDe(moyen)}
			{@const idCase = `${idBase}-moyen-${k}`}
			<li class="c-moyens__moyen" class:is-coche={coche(moyen)}>
				<span class="c-moyens__tete">
					<input id={idCase} type="checkbox" class="c-moyens__case" checked={coche(moyen)} disabled={!modifiable || deja.length > 0} onchange={(e) => (coches[moyen] = e.currentTarget.checked)} />
					<label for={idCase}>{premiereMajuscule(moyen)}</label>
				</span>
				{#each deja as j (j.id)}
					<span class="c-moyens__piece"><Icone nom="justificatif" taille="sm" /> {j.nom_fichier} <span class="c-moyens__detail">· {taille(j.taille)}</span></span>
				{/each}
				{#if modifiable && coche(moyen)}
					<label class="c-moyens__televerser">
						<Icone nom="televerser" taille="sm" />
						<span>{deja.length ? 'Ajouter un autre document' : 'Téléverser le document'}</span>
						<span class="c-moyens__formats">PDF, Word, Excel… (pas de photo)</span>
						<input type="file" class="u-visuellement-masque" accept={FORMATS_JUSTIFICATIF} onchange={(e) => televerser(moyen, e.currentTarget)} />
					</label>
				{/if}
			</li>
		{/each}
	</ul>
	{#if erreur}<p class="c-moyens__erreur" role="alert"><Icone nom="alerte" taille="sm" /> {erreur}</p>{/if}
</fieldset>
