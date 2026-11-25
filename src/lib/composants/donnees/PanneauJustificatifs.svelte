<script lang="ts">
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { date, taille } from '#lib/format.ts';
	import type { CodeVolet, Justificatif, Mois } from '#lib/donnees/types.ts';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import MoyensVerification from './MoyensVerification.svelte';
	import './PanneauJustificatifs.css';

	/**
	 * Justificatifs du mois, en bas des onglets Indicateurs et Activités. Les pièces se déposent
	 * élément par élément, sur chaque carte (indicateur) ou bloc (activité), moyen par moyen.
	 * Ici : le rapport du mois lui-même (onglet Activités), puis la liste de contrôle de
	 * tous les documents déposés, pour la coordination APSUD.
	 */
	interface Props {
		volet: CodeVolet;
		mois: Mois;
		modifiable: boolean;
		portee: 'indicateurs' | 'activites';
	}
	let { volet: code, mois, modifiable, portee }: Props = $props();

	const etat = $derived(depot.etat);
	const indicateurs = $derived(etat.indicateurs.filter((i) => i.volet === code));
	const activites = $derived(etat.activites.filter((a) => a.volet === code));
	const tous = $derived(etat.justificatifs.filter((j) => j.volet === code && j.mois === mois && !j.archive_le));
	const liste = $derived(portee === 'indicateurs' ? tous.filter((j) => j.rattachement.type === 'indicateur') : tous);
	const idRapport = $derived(etat.rapports.find((r) => r.volet === code && r.mois === mois)?.id ?? `${code}:${mois}`);

	function libelleRattachement(j: Justificatif): string {
		if (j.rattachement.type === 'indicateur') {
			const l = indicateurs.find((i) => i.id === j.rattachement.id)?.libelle ?? 'indicateur archivé';
			return `Indicateur : ${l.length > 80 ? l.slice(0, 80) + '…' : l}`;
		}
		if (j.rattachement.type === 'activite') {
			const a = activites.find((x) => x.id === j.rattachement.id);
			return a ? `Activité ${a.numero}` : 'Activité archivée';
		}
		if (j.rattachement.type === 'depense') return 'Dépense';
		return 'Rapport du mois';
	}
</script>

<Panneau
	titre="Justificatifs"
	sousTitre={portee === 'indicateurs'
		? 'Les documents se déposent sur chaque indicateur, moyen de vérification par moyen. Liste des documents de ce mois.'
		: 'Les documents se déposent sur chaque activité, moyen de vérification par moyen. Ci-dessous : le rapport du mois et la liste des documents.'}
>
	{#if portee === 'activites'}
		<MoyensVerification volet={code} {mois} {modifiable} rattachement={{ type: 'rapport', id: idRapport }} moyens={['Rapport narratif du mois', 'Rapport financier du mois']} idBase="rapport-{code}-{mois}" titre="Rapport du mois" />
	{/if}
	{#if liste.length}
		<p class="c-justifs__compte">Documents déposés ce mois-ci : {liste.length}</p>
		<ul class="c-justifs__liste" role="list">
			{#each liste as j (j.id)}
				<li class="c-justifs__fichier">
					<Icone nom="justificatif" />
					<span class="c-justifs__nom">{j.nom_fichier}</span>
					<span class="c-justifs__detail">{libelleRattachement(j)}{j.moyen_verification ? ` · ${j.moyen_verification}` : ''} · {taille(j.taille)} · {depot.nomUtilisateur(j.auteur)}, {date(j.date)}</span>
				</li>
			{/each}
		</ul>
	{/if}
	{#if modifiable && depot.source === 'demo'}
		<p class="c-justifs__note">Démonstration : seul le nom du fichier est conservé.</p>
	{/if}
</Panneau>
