<script lang="ts">
	import { depot, type MajEnDirect } from '#lib/donnees/depot.svelte.ts';
	import { cumul, justificatifsIndicateur, valeurCourante } from '#lib/donnees/calculs.ts';
	import { libelleMois, moisCourt, nombre, pourcent } from '#lib/format.ts';
	import type { CodeVolet, Desagregation, Indicateur, Mois } from '#lib/donnees/types.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import JaugeJalon from '#lib/composants/ui/JaugeJalon.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './CarteIndicateur.css';

	/**
	 * Un indicateur du cadre logique : libellé complet, type, jauge à jalon au mois choisi,
	 * cibles désagrégées, moyens de vérification et lien vers le rapport du mois.
	 */
	interface Props {
		indicateur: Indicateur;
		mois: Mois;
		code: CodeVolet;
		/** Niveau de titre selon la profondeur dans l'arbre (outcome 3, output 4, activité 5). */
		niveauTitre: 3 | 4 | 5;
		/** Le rapport du mois peut être saisi par l'utilisateur connecté. */
		saisie: boolean;
		archivage: boolean;
		suppression: boolean;
		direct?: MajEnDirect;
		onarchiver: () => void;
		onsupprimer: () => void;
	}
	let { indicateur: ind, mois, code, niveauTitre, saisie, archivage, suppression, direct, onarchiver, onsupprimer }: Props = $props();

	const etat = $derived(depot.etat);
	const pct = $derived(ind.type_valeur === 'pourcentage');
	const avant = $derived(cumul(etat, ind, mois, false));
	const jusqua = $derived(cumul(etat, ind, mois, true));
	const duMois = $derived(valeurCourante(etat, ind.id, mois));
	const apport = $derived(duMois?.valeurs.total ?? null);
	const nbJustificatifs = $derived(justificatifsIndicateur(etat, ind.id, mois));
	const idTitre = $derived(`ind-${ind.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`);
	const lien = $derived(`/volets/${code}/indicateurs/${mois}#${encodeURIComponent(ind.id)}`);
	const valeur = (n: number | null) => (pct ? pourcent(n) : nombre(n));

	const colonnes: { cle: keyof Desagregation; libelle: string }[] = [
		{ cle: 'femmes', libelle: 'Femmes' },
		{ cle: 'filles', libelle: 'Filles' },
		{ cle: 'hommes', libelle: 'Hommes' },
		{ cle: 'garcons', libelle: 'Garçons' },
		{ cle: 'total', libelle: 'Total' }
	];
</script>

<article class="p-cadre-logique__ind" class:is-direct={!!direct} aria-labelledby={idTitre}>
	<div class="p-cadre-logique__ind-grille">
		<div class="p-cadre-logique__ind-texte">
			<svelte:element this={`h${niveauTitre}`} class="p-cadre-logique__ind-titre" id={idTitre}>
				{#if ind.code_cbpf}<span class="u-code p-cadre-logique__ind-code">{ind.code_cbpf}</span>{/if}
				<span class="p-cadre-logique__ind-libelle">{ind.libelle}</span>
			</svelte:element>
			<p class="p-cadre-logique__ind-badges">
				<span class="p-cadre-logique__badge">{pct ? 'Pourcentage' : 'Nombre'}</span>
				<span class="p-cadre-logique__badge">{ind.mode_cumul === 'somme' ? 'Cumul : somme des mois' : 'Cumul : dernière valeur connue'}</span>
				{#if ind.desagrege}<span class="p-cadre-logique__badge">Désagrégé par sexe et âge</span>{/if}
				{#if direct}
					<span class="p-cadre-logique__badge p-cadre-logique__badge--direct">
						<Icone nom="horloge" taille="sm" /> Modifié à l’instant par {depot.nomUtilisateur(direct.evenement.auteur)}
					</span>
				{/if}
			</p>

			<div class="p-cadre-logique__ind-bloc">
				<p class="p-cadre-logique__ind-etiquette">Moyens de vérification</p>
				{#if ind.moyens_verification.length}
					<ul class="p-cadre-logique__ind-moyens">
						{#each ind.moyens_verification as m, i (i)}<li>{m}</li>{/each}
					</ul>
				{:else}
					<p class="u-attenue">Aucun moyen de vérification renseigné dans le fichier.</p>
				{/if}
				<!-- Colonne « Oui/Non » des fiches Excel : justificatif joint pour le mois choisi (D11). -->
				<p class="p-cadre-logique__ouinon" class:is-oui={nbJustificatifs > 0}>
					<Icone nom={nbJustificatifs > 0 ? 'valider' : 'fermer'} taille="sm" />
					Justificatif fourni en {libelleMois(mois, false)} : <strong>{nbJustificatifs > 0 ? `Oui (${nbJustificatifs})` : 'Non'}</strong>
				</p>
			</div>

			{#if ind.commentaire}
				<div class="p-cadre-logique__ind-bloc">
					<p class="p-cadre-logique__ind-etiquette">Commentaire</p>
					<p class="p-cadre-logique__ind-commentaire">{ind.commentaire}</p>
				</div>
			{/if}
		</div>

		<div class="p-cadre-logique__ind-mesure">
			<JaugeJalon cumulPrecedent={avant.total} ceMois={apport} cible={ind.cible.total} type={ind.type_valeur} />
			<dl class="p-cadre-logique__ind-chiffres">
				<div>
					<dt>{pct ? 'Dernière valeur avant' : 'Cumul avant'} {moisCourt(mois)}</dt>
					<dd>{valeur(avant.total)}</dd>
				</div>
				<div>
					<dt>Apport de {moisCourt(mois)}</dt>
					<dd>{duMois ? valeur(apport) : 'non saisi'}</dd>
				</div>
				<div>
					<dt>Cible</dt>
					<dd>{ind.cible.total === null ? 'non renseignée' : valeur(ind.cible.total)}</dd>
				</div>
			</dl>

			{#if ind.desagrege}
				<table class="p-cadre-logique__ind-table">
					<caption class="u-visuellement-masque">Cibles et cumul désagrégés : {ind.libelle}</caption>
					<thead>
						<tr>
							<th scope="col"><span class="u-visuellement-masque">Ligne</span></th>
							{#each colonnes as c (c.cle)}<th scope="col" class="u-nombre">{c.libelle}</th>{/each}
						</tr>
					</thead>
					<tbody>
						<tr>
							<th scope="row">Cible</th>
							{#each colonnes as c (c.cle)}<td class="u-nombre" class:is-total={c.cle === 'total'}>{valeur(ind.cible[c.cle])}</td>{/each}
						</tr>
						<tr>
							<th scope="row">Cumul fin {moisCourt(mois)}</th>
							{#each colonnes as c (c.cle)}<td class="u-nombre" class:is-total={c.cle === 'total'}>{valeur(jusqua[c.cle])}</td>{/each}
						</tr>
					</tbody>
				</table>
			{/if}

			<div class="p-cadre-logique__ind-pied">
				<a class="p-cadre-logique__ind-lien" href={lien}>
					<Icone nom={saisie ? 'saisie' : 'oeil'} taille="sm" />
					{saisie ? 'Saisir dans le rapport de' : 'Voir le rapport de'}
					{libelleMois(mois)}
				</a>
				{#if archivage || suppression}
					<span class="p-cadre-logique__ind-actions">
						{#if archivage}
							<Bouton variante="texte" taille="sm" icone="archive" aria-label="Archiver l’indicateur : {ind.libelle}" onclick={onarchiver}>Archiver</Bouton>
						{/if}
						{#if suppression}
							<Bouton variante="danger" taille="sm" icone="supprimer" aria-label="Supprimer définitivement l’indicateur : {ind.libelle}" onclick={onsupprimer}>Supprimer définitivement</Bouton>
						{/if}
					</span>
				{/if}
			</div>
		</div>
	</div>
</article>
