<script lang="ts">
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { echeance, indicateursAJour, joursRetard, rapport as trouverRapport } from '#lib/donnees/calculs.ts';
	import { peutSaisirMois, transitionsPossibles, type Transition } from '#lib/donnees/regles.ts';
	import { date, dateHeure, libelleMois, majuscule, taille } from '#lib/format.ts';
	import type { CodeVolet, Indicateur, Mois } from '#lib/donnees/types.ts';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import MarqueurStatut from '#lib/composants/ui/MarqueurStatut.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import CarteIndicateur from './CarteIndicateur.svelte';
	import BlocActivite from './BlocActivite.svelte';
	import EtapesCircuit from './EtapesCircuit.svelte';
	import Section5W from './Section5W.svelte';
	import './rapport.css';

	const code = $derived(page.params.code as CodeVolet);
	const mois = $derived(page.params.mois as Mois);
	const etat = $derived(depot.etat);
	const volet = $derived(depot.volet(code));
	const u = $derived(depot.utilisateur);
	const r = $derived(trouverRapport(etat, code, mois));
	const statut = $derived(r?.statut ?? 'non_commence');
	const modifiable = $derived(peutSaisirMois(u, volet, r));
	const transitions = $derived(r ? transitionsPossibles(u, volet, r) : transitionsPossibles(u, volet, { id: '', volet: code, mois, statut: 'non_commence', soumis_par: null, soumis_le: null, decision_par: null, decision_le: null, motif: null }));
	const maintenant = $derived(depot.maintenant());
	const retard = $derived(joursRetard(r, maintenant));
	const futur = $derived(mois > `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`);
	const progression = $derived(indicateursAJour(etat, code, mois));

	$effect(() => {
		contexte.mois = mois;
	});

	/* ---------- Structure du volet ---------- */
	const outcomes = $derived(etat.outcomes.filter((o) => o.volet === code));
	const outputs = $derived(etat.outputs.filter((o) => o.volet === code));
	const activites = $derived(etat.activites.filter((a) => a.volet === code && !a.archive_le));
	const indicateurs = $derived(etat.indicateurs.filter((i) => i.volet === code && !i.archive_le));

	type Groupe = { id: string; titre: string; niveau: string; indicateurs: { ind: Indicateur; numero: string }[] };
	const groupes = $derived.by(() => {
		const g: Groupe[] = [];
		for (const oc of outcomes) {
			const inds = indicateurs.filter((i) => i.niveau === 'outcome' && i.parent_id === oc.id);
			if (inds.length) g.push({ id: oc.id, niveau: `Outcome ${oc.numero}`, titre: oc.libelle, indicateurs: inds.map((ind, k) => ({ ind, numero: `Outcome ${oc.numero} · indicateur ${k + 1}` })) });
			for (const op of outputs.filter((o) => o.outcome_id === oc.id)) {
				const directs = indicateurs.filter((i) => i.niveau === 'output' && i.parent_id === op.id).map((ind, k) => ({ ind, numero: `Output ${op.numero} · indicateur ${k + 1}` }));
				const parActivite = activites
					.filter((a) => a.output_id === op.id)
					.flatMap((a) => indicateurs.filter((i) => i.niveau === 'activite' && i.parent_id === a.id).map((ind, k) => ({ ind, numero: `Activité ${a.numero}${k ? ` · ${k + 1}` : ''}` })));
				if (directs.length || parActivite.length) g.push({ id: op.id, niveau: `Output ${op.numero}`, titre: op.libelle, indicateurs: [...directs, ...parActivite] });
			}
		}
		return g;
	});

	/* ---------- Justificatifs ---------- */
	const justificatifs = $derived(etat.justificatifs.filter((j) => j.volet === code && j.mois === mois && !j.archive_le));
	const lignes5w = $derived(etat.lignes_5w.filter((l) => l.volet === code && l.mois === mois && !l.archive_le).length);
	const moyensAttendus = $derived([...new Set(indicateurs.flatMap((i) => i.moyens_verification))].slice(0, 30));
	let fichierChoisi = $state<File | null>(null);
	let moyenChoisi = $state('');
	/** Rattachement : le rapport du mois en général, ou un indicateur (alimente la colonne « Oui/Non »). */
	let rattachementChoisi = $state('');
	let champFichier: HTMLInputElement | undefined = $state();
	const optionsRattachement = $derived([
		{ valeur: '', libelle: 'Le rapport du mois (général)' },
		...indicateurs.map((i) => ({ valeur: i.id, libelle: `Indicateur : ${i.libelle.length > 70 ? i.libelle.slice(0, 70) + '…' : i.libelle}` }))
	]);
	const moyensProposes = $derived(rattachementChoisi ? (indicateurs.find((i) => i.id === rattachementChoisi)?.moyens_verification ?? []) : moyensAttendus);

	function joindre() {
		if (!fichierChoisi) return;
		const rattachement = rattachementChoisi ? { type: 'indicateur' as const, id: rattachementChoisi } : { type: 'rapport' as const, id: r?.id ?? `${code}:${mois}` };
		agir(() => depot.ajouterJustificatif(code, mois, rattachement, { nom: fichierChoisi!.name, type: fichierChoisi!.type, taille: fichierChoisi!.size }, moyenChoisi || null, fichierChoisi!), 'Justificatif ajouté.');
		fichierChoisi = null;
		moyenChoisi = '';
		if (champFichier) champFichier.value = '';
	}

	/** Depuis une carte d'indicateur : pré-choisit l'indicateur et descend vers les justificatifs. */
	function preparerJustificatif(indicateurId: string) {
		rattachementChoisi = indicateurId;
		moyenChoisi = '';
		document.getElementById('section-justificatifs')?.scrollIntoView({ block: 'start' });
		tick().then(() => document.getElementById('fichier-justificatif')?.focus({ preventScroll: true }));
	}

	/* ---------- Actions de circuit ---------- */
	let erreur = $state<string | null>(null);
	let succes = $state<string | null>(null);
	let transitionEnCours = $state<Transition | null>(null);
	let motif = $state('');

	function agir(fn: () => void, message: string) {
		erreur = null;
		succes = null;
		try {
			fn();
			succes = message;
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
	}

	function lancer(t: Transition) {
		if (t.motifObligatoire) {
			motif = '';
			transitionEnCours = t;
			return;
		}
		const messages: Record<string, string> = { soumis: 'Rapport soumis à APSUD. La coordination est notifiée.', valide: 'Rapport validé. L’ONG est notifiée.', verrouille: 'Rapport verrouillé.' };
		agir(() => depot.changerStatut(code, mois, t.vers), messages[t.vers] ?? 'Statut mis à jour.');
	}

	function confirmerMotif() {
		if (!transitionEnCours) return;
		const t = transitionEnCours;
		agir(() => depot.changerStatut(code, mois, t.vers, motif), t.vers === 'a_corriger' ? 'Rapport renvoyé pour correction. L’ONG est notifiée.' : 'Rapport déverrouillé.');
		if (!erreur) transitionEnCours = null;
	}

	// Ouverture depuis un lien « #indicateur » : défiler jusqu'à la carte et y placer le focus.
	$effect(() => {
		const ancre = decodeURIComponent(page.url.hash.slice(1));
		if (!ancre) return;
		tick().then(() => {
			const el = document.getElementById(`ind-${ancre.replace(/[^a-zA-Z0-9_-]/g, '-')}`);
			el?.scrollIntoView({ block: 'center' });
			el?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
		});
	});
</script>

<svelte:head><title>Rapport de {libelleMois(mois)} · {code} · Suivi consortium APSUD</title></svelte:head>

<section class="p-rapport" aria-labelledby="rapport-titre">
	<header class="p-rapport__tete">
		<div class="p-rapport__titres">
			<h2 id="rapport-titre" class="p-rapport__titre">Rapport de {libelleMois(mois)}</h2>
			<p class="p-rapport__meta">
				<MarqueurStatut {statut} {retard} />
				<span>Échéance : {date(echeance(mois).toISOString())}</span>
				<span>{progression.renseignes} sur {progression.total} indicateurs chiffrés renseignés</span>
			</p>
		</div>
		<EtapesCircuit {statut} />
	</header>

	{#if r?.statut === 'a_corriger' && r.motif}
		<Alerte variante="avertissement" titre="Renvoyé pour correction par {depot.nomUtilisateur(r.decision_par)} le {date(r.decision_le)}">
			<p>{r.motif}</p>
		</Alerte>
	{/if}
	{#if r?.soumis_le && statut !== 'a_corriger'}
		<p class="p-rapport__trace">
			Soumis par {depot.nomUtilisateur(r.soumis_par)} le {dateHeure(r.soumis_le)}{#if r.decision_le && (statut === 'valide' || statut === 'verrouille')}, validé par {depot.nomUtilisateur(r.decision_par)} le {dateHeure(r.decision_le)}{/if}.
		</p>
	{/if}
	{#if !modifiable}
		<Alerte variante="info">
			{#if statut === 'valide' || statut === 'verrouille'}
				Ce rapport est {statut === 'valide' ? 'validé' : 'verrouillé'} : les valeurs ne peuvent plus être modifiées. La coordination APSUD peut le rouvrir pour correction.
			{:else if statut === 'soumis'}
				Rapport soumis : il attend la décision de la coordination APSUD. Pour modifier une valeur, demandez à APSUD de le renvoyer pour correction.
			{:else}
				Lecture seule : seule l’ONG {volet.organisation} et la coordination APSUD peuvent saisir ce rapport.
			{/if}
		</Alerte>
	{:else if futur}
		<Alerte variante="info">Ce mois n’est pas encore commencé. Vous pouvez préparer la saisie, mais le rapport ne sera attendu qu’après la fin du mois.</Alerte>
	{/if}
	{#if erreur}<Alerte variante="erreur" onfermer={() => (erreur = null)}>{erreur}</Alerte>{/if}
	{#if succes}<Alerte variante="succes" onfermer={() => (succes = null)}>{succes}</Alerte>{/if}

	<nav class="p-rapport__sommaire" aria-label="Sections du rapport">
		<a href="#section-indicateurs"><Icone nom="saisie" taille="sm" /> Indicateurs <span>{indicateurs.length}</span></a>
		<a href="#section-activites"><Icone nom="calendrier" taille="sm" /> Activités et budget <span>{activites.length}</span></a>
		<a href="#section-justificatifs"><Icone nom="justificatif" taille="sm" /> Justificatifs <span>{justificatifs.length}</span></a>
		{#if volet.secteur === 'WASH'}
			<a href="#section-5w"><Icone nom="carte" taille="sm" /> 5W du cluster <span>{lignes5w}</span></a>
		{/if}
	</nav>

	<div id="section-indicateurs" class="p-rapport__section">
		<Panneau titre="Indicateurs" sousTitre="Saisissez le réalisé du mois : le total et le cumul se calculent seuls. Chaque case s’enregistre dès que vous la quittez." sansMarge>
			{#if !groupes.length}
				<div class="p-rapport__vide"><EtatVide titre="Aucun indicateur dans ce volet" texte="Ajoutez des indicateurs depuis le cadre logique." /></div>
			{/if}
			{#each groupes as g (g.id)}
				<div class="p-rapport__groupe">
					<p class="p-rapport__groupe-tete"><span>{g.niveau}</span> {g.titre}</p>
					{#each g.indicateurs as { ind, numero } (ind.id)}
						<CarteIndicateur indicateur={ind} {mois} {modifiable} {numero} onjustificatif={() => preparerJustificatif(ind.id)} />
					{/each}
				</div>
			{/each}
		</Panneau>
	</div>

	<div id="section-activites" class="p-rapport__section">
		<Panneau titre="Activités et budget" sousTitre="Taux d’exécution, résultats, observations et dépenses du mois, activité par activité." sansMarge>
			{#each activites as a (a.id)}
				<BlocActivite activite={a} {mois} {modifiable} />
			{/each}
		</Panneau>
	</div>

	{#if volet.secteur === 'WASH'}
		<div id="section-5w" class="p-rapport__section">
			<Section5W volet={code} {mois} {modifiable} />
		</div>
	{/if}

	<div id="section-justificatifs" class="p-rapport__section">
		<Panneau titre="Justificatifs" sousTitre="Fiches de présence, listes d’émargement, photos, rapports : les moyens de vérification du cadre logique.">
			{#if justificatifs.length}
				<ul class="p-rapport__fichiers" role="list">
					{#each justificatifs as j (j.id)}
						<li class="p-rapport__fichier">
							<Icone nom="justificatif" />
							<span class="p-rapport__fichier-nom">{j.nom_fichier}</span>
							<span class="u-attenue">{taille(j.taille)} · {depot.nomUtilisateur(j.auteur)}, {date(j.date)}{j.moyen_verification ? ` · ${j.moyen_verification}` : ''}{j.rattachement.type === 'indicateur' ? ` · indicateur : ${indicateurs.find((i) => i.id === j.rattachement.id)?.libelle ?? 'archivé'}` : ''}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<EtatVide icone="justificatif" titre="Aucun justificatif pour ce mois" texte={modifiable ? 'Joignez les pièces qui prouvent les chiffres saisis.' : 'L’ONG n’a pas encore joint de pièce.'} />
			{/if}
			{#if modifiable}
				<div class="p-rapport__joindre">
					<div class="p-rapport__fichier-champ">
						<label for="fichier-justificatif">Fichier</label>
						<input id="fichier-justificatif" bind:this={champFichier} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onchange={(e) => (fichierChoisi = e.currentTarget.files?.[0] ?? null)} />
					</div>
					<Champ id="rattachement-justificatif" libelle="Prouve quoi ?" type="select" bind:valeur={rattachementChoisi} options={optionsRattachement} aide="Rattaché à un indicateur, il passe la case « Justificatif fourni » à Oui." />
					<Champ id="moyen-justificatif" libelle="Moyen de vérification" type="select" bind:valeur={moyenChoisi} options={[{ valeur: '', libelle: 'Choisir…' }, ...moyensProposes.map((m) => ({ valeur: m, libelle: m }))]} />
					<Bouton variante="secondaire" icone="televerser" disabled={!fichierChoisi} onclick={joindre}>Joindre</Bouton>
				</div>
				<p class="p-rapport__note">Démonstration : seul le nom du fichier est conservé. Dans la version finale, les images sont compressées avant l’envoi et l’envoi reprend après une coupure.</p>
			{/if}
		</Panneau>
	</div>

	{#if transitions.length}
		<div class="p-rapport__barre" role="region" aria-label="Actions sur le rapport">
			<p class="p-rapport__barre-texte">
				<MarqueurStatut {statut} />
				{#if statut === 'brouillon' || statut === 'non_commence' || statut === 'a_corriger'}
					<span>Les valeurs s’enregistrent automatiquement. Soumettez quand le mois est complet.</span>
				{:else if statut === 'soumis'}
					<span>En attente de la décision de la coordination APSUD.</span>
				{/if}
			</p>
			<div class="p-rapport__barre-actions">
				{#each [...transitions].reverse() as t (t.vers + t.action)}
					<Bouton variante={t.principal ? 'primaire' : 'secondaire'} onclick={() => lancer(t)}>{t.action}</Bouton>
				{/each}
			</div>
		</div>
	{/if}
</section>

<Dialogue ouvert={!!transitionEnCours} titre={transitionEnCours ? majuscule(transitionEnCours.action) : ''} onfermer={() => (transitionEnCours = null)}>
	<p>Le motif est visible par l’ONG {volet.organisation} et inscrit au journal.</p>
	{#if erreur}<Alerte variante="erreur">{erreur}</Alerte>{/if}
	<Champ id="motif-transition" libelle="Motif" type="textarea" requis bind:valeur={motif} aide="Soyez précis : quelle valeur vérifier, quelle pièce ajouter." />
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={() => (transitionEnCours = null)}>Annuler</Bouton>
		<Bouton variante="primaire" onclick={confirmerMotif}>{transitionEnCours?.action ?? 'Confirmer'}</Bouton>
	{/snippet}
</Dialogue>
