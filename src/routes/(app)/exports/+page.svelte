<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { libelleMois, majuscule, nombre } from '#lib/format.ts';
	import type { CodeVolet, EtatDepot } from '#lib/donnees/types.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import {
		SEUIL_JUSTIFICATION,
		VOLET_5W,
		exporter5W,
		exporterIndicateurs,
		exporterOneGMS,
		exporterPlanAction,
		nomFichier,
		versCsv,
		type Cellule,
		type OptionsExport,
		type TableExport
	} from './csv.ts';
	import './exports.css';

	interface DefinitionExport {
		id: string;
		titre: string;
		description: string;
		prefixe: string;
		/** Export limité à un volet, quel que soit le choix (5W WASH). */
		voletForce?: CodeVolet;
		generer: (etat: EtatDepot, o: OptionsExport) => TableExport;
	}

	const etat = $derived(depot.etat);
	const libelleSecteur = (code: string) => etat.secteurs.find((s) => s.code === code)?.libelle_court ?? code;

	let voletChoisi = $state('tous');
	let jusqua = $state(contexte.mois);
	let message = $state<string | null>(null);
	let erreur = $state<string | null>(null);

	const options = $derived<OptionsExport>({ volet: voletChoisi as CodeVolet | 'tous', jusqua });

	const optionsVolet = $derived([
		{ valeur: 'tous', libelle: 'Tous les volets (consortium)' },
		...etat.volets.map((v) => ({ valeur: v.code, libelle: `${v.code} · ${libelleSecteur(v.secteur)}, ${v.organisation}` }))
	]);
	const optionsMois = $derived(etat.projet.mois.map((m, i) => ({ valeur: m, libelle: `${majuscule(libelleMois(m))} (mois ${i + 1})` })));

	const definitions: DefinitionExport[] = [
		{
			id: 'indicateurs',
			titre: 'Suivi des indicateurs',
			description: 'Une ligne par indicateur et par mois : réalisé désagrégé, cumul, cible et taux d’atteinte, comme la feuille « Suivi indicateurs » des plans d’action.',
			prefixe: 'suivi-indicateurs',
			generer: exporterIndicateurs
		},
		{
			id: 'plan-action',
			titre: 'Plan d’action',
			description: 'Les activités et leurs tâches avec responsable, dates, budget planifié et exécuté, taux et semaines prévues ou réalisées (forme « 2026-12 S2 »).',
			prefixe: 'plan-action',
			generer: exporterPlanAction
		},
		{
			id: 'onegms',
			titre: 'Fiche OneGMS',
			description: `Une ligne par indicateur, prête à recopier dans OneGMS : cible et cumul désagrégés au mois choisi, écart au prorata du temps écoulé, et mention « Justification requise » au-delà de ${SEUIL_JUSTIFICATION} %.`,
			prefixe: 'onegms',
			generer: exporterOneGMS
		},
		{
			id: '5w',
			titre: '5W du cluster WASH',
			description: 'Le fichier du cluster WASH (EHA) pour le mois choisi : les 31 colonnes du modèle, dans le même ordre, une ligne par activité et par sous-préfecture. À coller tel quel dans la fiche 5W d’IDC.',
			prefixe: '5w-wash',
			voletForce: VOLET_5W,
			generer: exporter5W
		}
	];

	const tables = $derived(Object.fromEntries(definitions.map((d) => [d.id, d.generer(etat, options)])) as Record<string, TableExport>);

	function afficher(c: Cellule): string {
		if (c === null || c === '') return '';
		return typeof c === 'number' ? nombre(c) : c;
	}

	function telecharger(d: DefinitionExport) {
		message = null;
		erreur = null;
		try {
			const table = d.generer(depot.etat, options);
			const nom = nomFichier(d.prefixe, options, d.voletForce);
			const blob = new Blob([versCsv(table)], { type: 'text/csv;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const lien = document.createElement('a');
			lien.href = url;
			lien.download = nom;
			document.body.append(lien);
			lien.click();
			lien.remove();
			setTimeout(() => URL.revokeObjectURL(url), 0);
			message = `Fichier « ${nom} » téléchargé : ${table.lignes.length} ligne${table.lignes.length > 1 ? 's' : ''}.`;
		} catch (e) {
			erreur = e instanceof Error ? e.message : 'Le fichier n’a pas pu être créé. Réessayez.';
		}
	}
</script>

<svelte:head><title>Exports · Suivi consortium APSUD</title></svelte:head>

<div class="p-exports">
	<header class="p-exports__tete">
		<h1 class="p-exports__titre">Exports</h1>
		<p class="p-exports__intro">
			Fichiers CSV qui s’ouvrent directement dans Excel : accents, nombres et colonnes sont reconnus. Ils sont créés sur cet appareil à partir des données affichées ; rien n’est envoyé.
		</p>
	</header>

	<Panneau titre="Ce que vous exportez" id="choix">
		<div class="p-exports__choix">
			<Champ id="export-volet" libelle="Volet" type="select" bind:valeur={voletChoisi} options={optionsVolet} requis />
			<Champ id="export-mois" libelle="Jusqu’au mois" type="select" bind:valeur={jusqua} options={optionsMois} requis aide="Le mois choisi est inclus. Il sert aussi de date de calcul des cumuls et des écarts." />
		</div>
	</Panneau>

	{#if erreur}
		<Alerte variante="erreur" titre="Export impossible" onfermer={() => (erreur = null)}>{erreur}</Alerte>
	{/if}
	{#if message}
		<Alerte variante="succes" onfermer={() => (message = null)}>{message}</Alerte>
	{/if}

	{#each definitions as d (d.id)}
		{@const table = tables[d.id]}
		<Panneau titre={d.titre} sousTitre={d.description} id="export-{d.id}" sansMarge>
			{#snippet actions()}
				<Bouton variante="secondaire" taille="sm" icone="telecharger" onclick={() => telecharger(d)} aria-label="Télécharger le CSV « {d.titre} »" disabled={table.lignes.length === 0}>
					Télécharger le CSV
				</Bouton>
			{/snippet}
			<div class="p-exports__resume">
				<p>
					<strong>{nombre(table.lignes.length)}</strong> ligne{table.lignes.length > 1 ? 's' : ''} · {table.entetes.length} colonnes
					{#if d.voletForce && voletChoisi !== d.voletForce}
						<span class="u-attenue"> · cet export porte toujours sur le volet {d.voletForce}</span>
					{/if}
				</p>
				<p class="p-exports__fichier u-code">{nomFichier(d.prefixe, options, d.voletForce)}</p>
			</div>
			{#if table.lignes.length}
				<!-- Zone qui défile horizontalement : elle doit pouvoir recevoir le focus pour défiler au clavier (WCAG 2.1.1). -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="p-exports__defilement" role="region" aria-labelledby="apercu-{d.id}" tabindex="0">
					<table class="p-exports__table">
						<caption id="apercu-{d.id}" class="p-exports__legende">Aperçu : {Math.min(5, table.lignes.length)} premières lignes sur {nombre(table.lignes.length)}</caption>
						<thead>
							<tr>
								{#each table.entetes as e, i (i)}<th scope="col">{e}</th>{/each}
							</tr>
						</thead>
						<tbody>
							{#each table.lignes.slice(0, 5) as ligne, r (r)}
								<tr>
									{#each ligne as c, i (i)}
										<td class:u-nombre={typeof c === 'number'} class:p-exports__long={typeof c === 'string' && c.length > 40}>{afficher(c)}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="p-exports__vide">Aucune ligne pour ce choix. Changez de volet ou de mois pour obtenir des données.</p>
			{/if}
		</Panneau>
	{/each}

	<Alerte variante="info">Le format Excel natif (.xlsx) identique aux fichiers actuels viendra avec le back-end.</Alerte>
</div>
