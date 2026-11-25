<script lang="ts">
	import { nombre } from '#lib/format.ts';
	import './BarresJour.css';

	/**
	 * Activité par jour : une série (sessions), barres fines en Vert APSUD ancrées sur la ligne
	 * de base, info-bulle au survol et au focus, tableau équivalent pour les lecteurs d'écran.
	 */
	interface Props {
		donnees: { jour: string; sessions: number; utilisateurs: number; evenements: number }[];
		titre: string;
	}
	let { donnees, titre }: Props = $props();

	const max = $derived(Math.max(1, ...donnees.map((d) => d.sessions)));
	const total = $derived(donnees.reduce((a, d) => a + d.sessions, 0));
	const jourCourt = (j: string) => new Date(`${j}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
	const reperes = $derived(donnees.length ? [donnees[0], donnees[Math.floor((donnees.length - 1) / 2)], donnees[donnees.length - 1]] : []);
</script>

<figure class="c-barres-jour">
	<div class="c-barres-jour__zone" role="img" aria-label="{titre} : {nombre(total)} sessions sur {donnees.length} jours, au plus {nombre(max)} un même jour.">
		<span class="c-barres-jour__max" aria-hidden="true">{nombre(max)}</span>
		<div class="c-barres-jour__barres" aria-hidden="true">
			{#each donnees as d (d.jour)}
				<div class="c-barres-jour__col">
					<span class="c-barres-jour__barre" class:is-vide={!d.sessions} style:block-size="{(d.sessions / max) * 100}%"></span>
					<span class="c-barres-jour__bulle">
						<strong>{jourCourt(d.jour)}</strong>
						<span>{nombre(d.sessions)} session{d.sessions > 1 ? 's' : ''}</span>
						<span>{nombre(d.utilisateurs)} compte{d.utilisateurs > 1 ? 's' : ''}</span>
					</span>
				</div>
			{/each}
		</div>
	</div>
	<div class="c-barres-jour__axe" aria-hidden="true">
		{#each reperes as r, i (i)}<span>{jourCourt(r.jour)}</span>{/each}
	</div>
	<details class="c-barres-jour__tableau">
		<summary>Voir les données en tableau</summary>
		<table>
			<caption class="u-visuellement-masque">{titre}</caption>
			<thead><tr><th scope="col">Jour</th><th scope="col" class="u-nombre">Sessions</th><th scope="col" class="u-nombre">Comptes</th><th scope="col" class="u-nombre">Événements</th></tr></thead>
			<tbody>
				{#each donnees.filter((d) => d.evenements) as d (d.jour)}
					<tr><th scope="row">{jourCourt(d.jour)}</th><td class="u-nombre">{nombre(d.sessions)}</td><td class="u-nombre">{nombre(d.utilisateurs)}</td><td class="u-nombre">{nombre(d.evenements)}</td></tr>
				{/each}
			</tbody>
		</table>
	</details>
</figure>
