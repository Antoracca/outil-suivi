<script lang="ts">
	import { page } from '$app/state';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { rapport as trouverRapport } from '#lib/donnees/calculs.ts';
	import { peutEcrireVolet, peutSaisirMois } from '#lib/donnees/regles.ts';
	import { dateHeure, libelleMois, montant } from '#lib/format.ts';
	import type { CodeVolet, Mois } from '#lib/donnees/types.ts';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './planification.css';

	/**
	 * Onglet « Activités planifiées » (cahier des charges APSUD, §3.4) : l'ONG coche les
	 * activités prévues pour le mois de l'adresse (en général M+1), puis valide.
	 * Le mois venu, l'onglet Activités les présente en tête avec la mention « Prévue ».
	 */
	const code = $derived(page.params.code as CodeVolet);
	const mois = $derived(page.params.mois as Mois);
	const etat = $derived(depot.etat);
	const volet = $derived(depot.volet(code));
	const u = $derived(depot.utilisateur);
	const rapportDuMois = $derived(trouverRapport(etat, code, mois));
	const ecrit = $derived(peutEcrireVolet(u, volet));
	const modifiable = $derived(peutSaisirMois(u, volet, rapportDuMois));
	const dansProjet = $derived(etat.projet.mois.includes(mois));

	const outputs = $derived(etat.outputs.filter((o) => o.volet === code));
	const activites = $derived(etat.activites.filter((a) => a.volet === code && !a.archive_le));
	const enregistrees = $derived(etat.planifications.filter((p) => p.volet === code && p.mois === mois));
	const derniere = $derived(enregistrees.reduce<(typeof enregistrees)[number] | null>((d, p) => (!d || p.valide_le > d.valide_le ? p : d), null));

	/** Tâches du calendrier prévues ce mois : une aide au choix, pas une obligation. */
	const tachesPrevues = (activiteId: string) => etat.taches.filter((t) => t.activite_id === activiteId && !t.archive_le && t.semaines.some((s) => s.mois === mois && s.prevu)).length;

	// Sélection en cours : reprend la planification enregistrée à chaque changement de mois
	// ou quand elle change ailleurs (temps réel), tant qu'aucune case n'a été touchée ici.
	let choix = $state<Set<string>>(new Set());
	let modifie = $state(false);
	let cleChargee = '';
	$effect(() => {
		const cle = `${code}:${mois}:${derniere?.valide_le ?? ''}`;
		if (cle === cleChargee) return;
		if (modifie && cleChargee.startsWith(`${code}:${mois}:`)) return;
		cleChargee = cle;
		choix = new Set(enregistrees.filter((p) => p.prevue).map((p) => p.activite_id));
		modifie = false;
	});

	function basculer(id: string, coche: boolean) {
		const s = new Set(choix);
		if (coche) s.add(id);
		else s.delete(id);
		choix = s;
		modifie = true;
		succes = null;
	}
	function toutes(coche: boolean) {
		choix = coche ? new Set(activites.map((a) => a.id)) : new Set();
		modifie = true;
		succes = null;
	}
	function selonCalendrier() {
		choix = new Set(activites.filter((a) => tachesPrevues(a.id) > 0).map((a) => a.id));
		modifie = true;
		succes = null;
	}

	let erreur = $state<string | null>(null);
	let succes = $state<string | null>(null);
	function valider() {
		erreur = null;
		succes = null;
		try {
			depot.planifierMois(code, mois, [...choix]);
			modifie = false;
			cleChargee = '';
			succes = `Planification de ${libelleMois(mois)} enregistrée : ${choix.size} activité${choix.size > 1 ? 's' : ''} prévue${choix.size > 1 ? 's' : ''}. Elles apparaîtront en tête de l’onglet Activités.`;
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
	}

	const idCase = (id: string) => `planif-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
</script>

<svelte:head><title>Activités planifiées pour {libelleMois(mois)} · {code} · Suivi consortium APSUD</title></svelte:head>

<section class="p-planif" aria-labelledby="planif-titre">
	<header class="p-planif__tete">
		<div class="p-planif__titres">
			<h2 id="planif-titre" class="p-planif__titre">Activités planifiées pour {libelleMois(mois)}</h2>
			<p class="p-planif__meta">
				{#if derniere}
					<span class="p-planif__etat p-planif__etat--validee"><Icone nom="valider" taille="sm" /> Planification validée</span>
					<span>par {depot.nomUtilisateur(derniere.valide_par)} le {dateHeure(derniere.valide_le)}</span>
				{:else}
					<span class="p-planif__etat"><Icone nom="horloge" taille="sm" /> Pas encore planifié</span>
				{/if}
			</p>
		</div>
	</header>

	<p class="p-planif__consigne">
		Cochez les activités que vous prévoyez de réaliser en {libelleMois(mois)}, puis validez. Le mois venu, elles apparaîtront en tête de l’onglet
		<a href="/volets/{code}/activites/{mois}">Activités</a>, sans rien ressaisir.
	</p>

	{#if !dansProjet}
		<Alerte variante="info">Ce mois ne fait pas partie du projet (du {etat.projet.mois[0] ? libelleMois(etat.projet.mois[0]) : '…'} à {etat.projet.mois.at(-1) ? libelleMois(etat.projet.mois.at(-1)!) : '…'}).</Alerte>
	{:else if !ecrit}
		<Alerte variante="info">Lecture seule : seule l’ONG {volet.organisation} et la coordination APSUD planifient ce volet.</Alerte>
	{:else if !modifiable}
		<Alerte variante="info">Le rapport de {libelleMois(mois)} est déjà soumis ou validé : la planification de ce mois ne peut plus changer.</Alerte>
	{/if}
	{#if erreur}<Alerte variante="erreur" onfermer={() => (erreur = null)}>{erreur}</Alerte>{/if}
	{#if succes}<Alerte variante="succes" onfermer={() => (succes = null)}>{succes}</Alerte>{/if}

	{#if dansProjet}
		<Panneau titre="Activités du volet" sousTitre="{activites.length} activités · {choix.size} cochée{choix.size > 1 ? 's' : ''}" sansMarge>
			{#snippet actions()}
				{#if modifiable}
					<div class="p-planif__raccourcis">
						<Bouton variante="texte" taille="sm" onclick={selonCalendrier}>Selon le calendrier</Bouton>
						<Bouton variante="texte" taille="sm" onclick={() => toutes(true)}>Tout cocher</Bouton>
						<Bouton variante="texte" taille="sm" onclick={() => toutes(false)}>Tout décocher</Bouton>
					</div>
				{/if}
			{/snippet}
			{#if !activites.length}
				<div class="p-planif__vide"><EtatVide titre="Aucune activité dans ce volet" texte="Ajoutez des activités depuis la structure du cadre logique (onglet Indicateurs)." /></div>
			{/if}
			{#each outputs as op (op.id)}
				{@const liste = activites.filter((a) => a.output_id === op.id)}
				{#if liste.length}
					<fieldset class="p-planif__groupe">
						<legend class="p-planif__groupe-tete"><span>Output {op.numero}</span> {op.libelle}</legend>
						<ul class="p-planif__liste" role="list">
							{#each liste as a (a.id)}
								{@const nbTaches = tachesPrevues(a.id)}
								<li class="p-planif__ligne" class:is-cochee={choix.has(a.id)}>
									<input
										id={idCase(a.id)}
										class="p-planif__case"
										type="checkbox"
										checked={choix.has(a.id)}
										disabled={!modifiable}
										onchange={(e) => basculer(a.id, e.currentTarget.checked)}
									/>
									<label for={idCase(a.id)} class="p-planif__libelle">
										<span class="p-planif__numero">{a.numero}</span>
										<span>{a.libelle}</span>
									</label>
									<span class="p-planif__details">
										{#if a.responsable}<span>{a.responsable}</span>{/if}
										<span>Budget {montant(a.budget_planifie)}</span>
										{#if nbTaches}<span class="p-planif__calendrier"><Icone nom="calendrier" taille="sm" /> {nbTaches} tâche{nbTaches > 1 ? 's' : ''} prévue{nbTaches > 1 ? 's' : ''} au calendrier</span>{/if}
									</span>
								</li>
							{/each}
						</ul>
					</fieldset>
				{/if}
			{/each}
		</Panneau>

		{#if modifiable}
			<div class="p-planif__barre" role="region" aria-label="Valider la planification">
				<p class="p-planif__barre-texte" aria-live="polite">
					<strong>{choix.size}</strong> activité{choix.size > 1 ? 's' : ''} prévue{choix.size > 1 ? 's' : ''} en {libelleMois(mois, false)}
					{#if modifie}<span class="p-planif__non-valide">· modifications non validées</span>{/if}
				</p>
				<Bouton variante="primaire" icone="valider" onclick={valider}>Valider la planification</Bouton>
			</div>
		{/if}
	{/if}
</section>
