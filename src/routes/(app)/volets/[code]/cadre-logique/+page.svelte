<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { depot, ErreurRegle } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { rapport } from '#lib/donnees/calculs.ts';
	import { peutArchiver, peutEcrireVolet, peutModifierStructure, peutSaisirMois, peutSupprimer, peutValider } from '#lib/donnees/regles.ts';
	import { libelleMois, lireNombre, majuscule, montant } from '#lib/format.ts';
	import type { CodeVolet, Indicateur, Niveau } from '#lib/donnees/types.ts';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import MarqueurStatut from '#lib/composants/ui/MarqueurStatut.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import CarteIndicateur from './CarteIndicateur.svelte';
	import './cadre-logique.css';

	/* ---------- Données du volet ---------- */

	const code = $derived(page.params.code as CodeVolet);
	const etat = $derived(depot.etat);
	const volet = $derived(etat.volets.find((v) => v.code === code));
	const u = $derived(depot.utilisateur);
	const devise = $derived(etat.projet.devise);
	const mois = $derived(contexte.mois);
	const rapportDuMois = $derived(rapport(etat, code, mois));

	const parNumero = (a: { numero: string }, b: { numero: string }) => a.numero.localeCompare(b.numero, 'fr', { numeric: true });

	const outcomes = $derived(etat.outcomes.filter((o) => o.volet === code).sort(parNumero));
	const outputsDe = (outcomeId: string) => etat.outputs.filter((o) => o.outcome_id === outcomeId).sort(parNumero);
	const activitesDe = (outputId: string) => etat.activites.filter((a) => a.output_id === outputId && !a.archive_le).sort(parNumero);
	const indicateursDe = (niveau: Niveau, parentId: string): Indicateur[] =>
		etat.indicateurs.filter((i) => i.niveau === niveau && i.parent_id === parentId && !i.archive_le).sort((a, b) => a.ordre - b.ordre);
	const budgetOutput = (outputId: string) => activitesDe(outputId).reduce((s, a) => s + a.budget_planifie, 0);

	const compte = $derived.by(() => {
		const outputs = etat.outputs.filter((o) => o.volet === code).length;
		const activites = etat.activites.filter((a) => a.volet === code && !a.archive_le).length;
		const indicateurs = etat.indicateurs.filter((i) => i.volet === code && !i.archive_le).length;
		return { outputs, activites, indicateurs };
	});

	const optionsMois = $derived(etat.projet.mois.map((m) => ({ valeur: m, libelle: majuscule(libelleMois(m)) })));

	/* ---------- Règles : ce que l'utilisateur connecté peut faire ---------- */

	const ecrit = $derived(volet ? peutEcrireVolet(u, volet) : false);
	const structure = $derived(volet ? peutModifierStructure(u, volet) : false);
	const archivage = $derived(volet ? peutArchiver(u, volet) : false);
	const suppression = $derived(peutSupprimer(u));
	const saisie = $derived(volet ? peutSaisirMois(u, volet, rapportDuMois) : false);

	/** Une phrase qui explique pourquoi un bouton attendu est absent (ou pourquoi il est encore là). */
	const explicationDroits = $derived.by(() => {
		if (!volet) return null;
		if (!ecrit) return `Lecture seule : seule l’ONG du volet (${volet.organisation}) et la coordination APSUD peuvent modifier ce cadre logique.`;
		if (volet.cadre_verrouille && !structure)
			return 'Le cadre logique est verrouillé par APSUD : l’ajout et la modification d’activités sont suspendus jusqu’au déverrouillage. Les saisies mensuelles continuent.';
		if (volet.cadre_verrouille && peutValider(u)) return 'Le cadre logique est verrouillé pour l’ONG. En tant que coordination APSUD, vous pouvez encore le modifier.';
		return null;
	});

	/* ---------- Dépliage des outcomes et outputs ---------- */

	let replies = $state<Record<string, boolean>>({});
	const idDom = (prefixe: string, id: string) => `cl-${prefixe}-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

	function basculer(id: string) {
		replies[id] = !replies[id];
	}
	function toutDeplier() {
		replies = {};
	}
	function toutReplier() {
		const tous: Record<string, boolean> = {};
		for (const o of outcomes) {
			tous[o.id] = true;
			for (const s of outputsDe(o.id)) tous[s.id] = true;
		}
		replies = tous;
	}

	/* ---------- Trace « modifié à l'instant » (rafraîchie chaque seconde) ---------- */

	let tic = $state(0);
	$effect(() => {
		if (!depot.enDirect.length) return;
		const minuterie = setInterval(() => tic++, 1000);
		return () => clearInterval(minuterie);
	});
	function enDirect(id: string) {
		void tic;
		return depot.estEnDirect(id);
	}

	/* ---------- Messages ---------- */

	let succes = $state<string | null>(null);
	let zoneMessages: HTMLDivElement | undefined = $state();

	const messageErreur = (e: unknown) => (e instanceof ErreurRegle || e instanceof Error ? e.message : 'L’action n’a pas pu être enregistrée.');

	async function annoncerSucces(texte: string) {
		succes = texte;
		await tick();
		zoneMessages?.focus();
	}

	/* ---------- Dialogues : ajout, archivage, suppression définitive ---------- */

	type Cible = { type: 'activite' | 'indicateur'; id: string; nom: string; libelle: string };
	type EtatDialogue =
		| { mode: 'ajout'; outputId: string; outputNumero: string; outputLibelle: string }
		| { mode: 'archiver'; cible: Cible }
		| { mode: 'supprimer'; cible: Cible };

	let dialogue = $state<EtatDialogue | null>(null);
	let dialogueOuvert = $state(false);
	let erreurDialogue = $state<string | null>(null);
	let intitule = $state('');
	let budgetSaisi = $state('');
	let responsable = $state('');
	let confirmation = $state('');
	let erreurIntitule = $state<string | null>(null);
	let erreurBudget = $state<string | null>(null);

	const titreDialogue = $derived.by(() => {
		if (!dialogue) return '';
		if (dialogue.mode === 'ajout') return `Ajouter une activité à l’output ${dialogue.outputNumero}`;
		if (dialogue.mode === 'archiver') return `Archiver ${dialogue.cible.nom} ?`;
		return `Supprimer définitivement ${dialogue.cible.nom} ?`;
	});

	function ouvrir(d: EtatDialogue) {
		dialogue = d;
		erreurDialogue = null;
		erreurIntitule = null;
		erreurBudget = null;
		intitule = '';
		budgetSaisi = '';
		responsable = '';
		confirmation = '';
		dialogueOuvert = true;
	}
	function fermer() {
		dialogueOuvert = false;
	}

	function cibleActivite(a: { id: string; numero: string; libelle: string }): Cible {
		return { type: 'activite', id: a.id, nom: `l’activité ${a.numero}`, libelle: a.libelle };
	}
	function cibleIndicateur(i: Indicateur): Cible {
		return { type: 'indicateur', id: i.id, nom: 'cet indicateur', libelle: i.libelle };
	}

	async function ajouter(e: SubmitEvent) {
		e.preventDefault();
		if (dialogue?.mode !== 'ajout') return;
		erreurIntitule = intitule.trim() ? null : 'Donnez un intitulé à l’activité, par exemple « Distribution de kits d’hygiène ».';
		const budget = lireNombre(budgetSaisi);
		if (budget === null) erreurBudget = 'Indiquez le budget planifié en USD (0 s’il n’est pas encore connu).';
		else if (Number.isNaN(budget)) erreurBudget = 'Saisissez un montant en chiffres, par exemple 12 500.';
		else if (budget < 0) erreurBudget = 'Le budget planifié ne peut pas être négatif.';
		else erreurBudget = null;
		if (erreurIntitule || erreurBudget || budget === null) return;
		try {
			const a = depot.ajouterActivite(dialogue.outputId, intitule, budget, responsable.trim() || null);
			fermer();
			await annoncerSucces(`Activité ${a.numero} « ${a.libelle} » ajoutée à l’output ${dialogue.outputNumero}.`);
		} catch (err) {
			erreurDialogue = messageErreur(err);
		}
	}

	async function archiver() {
		if (dialogue?.mode !== 'archiver') return;
		const { cible } = dialogue;
		try {
			depot.archiver(cible.type, cible.id);
			fermer();
			await annoncerSucces(`${majuscule(cible.nom)} a été archivé${cible.type === 'activite' ? 'e' : ''}. ${cible.type === 'activite' ? 'Elle reste consultable' : 'Il reste consultable'} dans les archives.`);
		} catch (err) {
			erreurDialogue = messageErreur(err);
		}
	}

	async function supprimer() {
		if (dialogue?.mode !== 'supprimer') return;
		const { cible } = dialogue;
		if (confirmation.trim() !== 'SUPPRIMER') {
			erreurDialogue = 'Tapez le mot SUPPRIMER en capitales pour confirmer.';
			return;
		}
		try {
			depot.supprimerDefinitivement(cible.type, cible.id);
			fermer();
			await annoncerSucces(`${majuscule(cible.nom)} a été supprimé${cible.type === 'activite' ? 'e' : ''} définitivement. L’opération est inscrite au journal.`);
		} catch (err) {
			erreurDialogue = messageErreur(err);
		}
	}
</script>

<svelte:head><title>Cadre logique {code} · Suivi consortium APSUD</title></svelte:head>

{#snippet listeIndicateurs(liste: Indicateur[], niveauTitre: 3 | 4 | 5, etiquette: string)}
	{#if liste.length}
		<div class="p-cadre-logique__groupe">
			<p class="p-cadre-logique__groupe-titre">
				<Icone nom="cible" taille="sm" />
				{etiquette} <span class="u-attenue">({liste.length})</span>
			</p>
			<ul class="p-cadre-logique__inds" role="list">
				{#each liste as ind (ind.id)}
					<li>
						<CarteIndicateur
							indicateur={ind}
							{mois}
							{code}
							{niveauTitre}
							{saisie}
							{archivage}
							{suppression}
							direct={enDirect(ind.id)}
							onarchiver={() => ouvrir({ mode: 'archiver', cible: cibleIndicateur(ind) })}
							onsupprimer={() => ouvrir({ mode: 'supprimer', cible: cibleIndicateur(ind) })}
						/>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/snippet}

{#if volet}
	<div class="p-cadre-logique">
		<!-- Objectif général et mois de référence des cumuls -->
		<section class="p-cadre-logique__entete" aria-label="Objectif et mois de référence">
			<div class="p-cadre-logique__objectif">
				<p class="p-cadre-logique__objectif-etiquette">Objectif général du projet</p>
				<p class="p-cadre-logique__objectif-texte">{etat.projet.objectif_general}</p>
			</div>
			<div class="p-cadre-logique__mois">
				<Champ
					id="cl-mois"
					type="select"
					libelle="Avancement au"
					requis
					options={optionsMois}
					aide="Cumul des mois précédents, apport du mois choisi et cible."
					bind:valeur={() => contexte.mois, (m) => (contexte.mois = m)}
				/>
				<p class="p-cadre-logique__statut-mois">
					<span>Rapport de {libelleMois(mois, false)} :</span>
					<MarqueurStatut statut={rapportDuMois?.statut ?? 'non_commence'} />
				</p>
			</div>
		</section>

		<!-- Barre d'outils -->
		<div class="p-cadre-logique__outils">
			<p class="p-cadre-logique__compte">
				{outcomes.length} outcome{outcomes.length > 1 ? 's' : ''} · {compte.outputs} output{compte.outputs > 1 ? 's' : ''} · {compte.activites} activité{compte.activites > 1 ? 's' : ''} · {compte.indicateurs} indicateur{compte.indicateurs > 1 ? 's' : ''}
			</p>
			<div class="p-cadre-logique__outils-boutons">
				<Bouton variante="texte" taille="sm" icone="deplier" onclick={toutDeplier}>Tout déplier</Bouton>
				<Bouton variante="texte" taille="sm" icone="replier" onclick={toutReplier}>Tout replier</Bouton>
			</div>
		</div>

		{#if explicationDroits}
			<p class="p-cadre-logique__droits">
				<Icone nom={ecrit ? 'cadenas' : 'oeil'} taille="sm" />
				<span>{explicationDroits}</span>
			</p>
		{/if}

		<div class="p-cadre-logique__messages" tabindex="-1" bind:this={zoneMessages}>
			{#if succes}
				<Alerte variante="succes" onfermer={() => (succes = null)}>{succes}</Alerte>
			{/if}
		</div>

		{#if !outcomes.length}
			<EtatVide icone="cadre-logique" titre="Aucun outcome pour ce volet." texte="Le cadre logique de ce volet n’a pas encore été importé depuis le fichier Excel." />
		{/if}

		<!-- Arbre : Outcome → Output → Activité → Indicateurs -->
		{#each outcomes as o (o.id)}
			{@const ouvertO = !replies[o.id]}
			<section class="p-cadre-logique__outcome" aria-labelledby={idDom('titre', o.id)}>
				<h2 class="p-cadre-logique__niveau p-cadre-logique__niveau--outcome" id={idDom('titre', o.id)}>
					<button type="button" class="p-cadre-logique__bascule" aria-expanded={ouvertO} aria-controls={idDom('corps', o.id)} onclick={() => basculer(o.id)}>
						<span class="p-cadre-logique__chevron"><Icone nom="chevron-bas" taille="sm" /></span>
						<span class="p-cadre-logique__numero">Outcome {o.numero}</span>
						<span class="p-cadre-logique__libelle">{o.libelle}</span>
					</button>
				</h2>
				<div class="p-cadre-logique__corps" class:is-replie={!ouvertO} id={idDom('corps', o.id)} inert={!ouvertO}>
					<div class="p-cadre-logique__corps-interieur p-cadre-logique__corps-interieur--outcome">
						{@render listeIndicateurs(indicateursDe('outcome', o.id), 3, `Indicateurs de l’outcome ${o.numero}`)}

						{#each outputsDe(o.id) as s (s.id)}
							{@const ouvertS = !replies[s.id]}
							{@const activites = activitesDe(s.id)}
							<section class="p-cadre-logique__output" aria-labelledby={idDom('titre', s.id)}>
								<h3 class="p-cadre-logique__niveau p-cadre-logique__niveau--output" id={idDom('titre', s.id)}>
									<button type="button" class="p-cadre-logique__bascule" aria-expanded={ouvertS} aria-controls={idDom('corps', s.id)} onclick={() => basculer(s.id)}>
										<span class="p-cadre-logique__chevron"><Icone nom="chevron-bas" taille="sm" /></span>
										<span class="p-cadre-logique__numero">Output {s.numero}</span>
										<span class="p-cadre-logique__libelle">{s.libelle}</span>
									</button>
								</h3>
								<p class="p-cadre-logique__meta-output">
									{activites.length} activité{activites.length > 1 ? 's' : ''} · budget planifié {montant(budgetOutput(s.id), devise)}
								</p>
								<div class="p-cadre-logique__corps" class:is-replie={!ouvertS} id={idDom('corps', s.id)} inert={!ouvertS}>
									<div class="p-cadre-logique__corps-interieur">
										{@render listeIndicateurs(indicateursDe('output', s.id), 4, `Indicateurs de l’output ${s.numero}`)}

										{#if activites.length}
											<ol class="p-cadre-logique__activites" role="list" aria-label="Activités de l’output {s.numero}">
												{#each activites as a (a.id)}
													{@const majA = enDirect(a.id)}
													{@const indsA = indicateursDe('activite', a.id)}
													<li class="p-cadre-logique__activite" class:is-direct={!!majA}>
														<div class="p-cadre-logique__activite-tete">
															<div class="p-cadre-logique__activite-titres">
																<h4 class="p-cadre-logique__activite-titre">
																	<span class="p-cadre-logique__numero">Activité {a.numero}</span>
																	<span class="p-cadre-logique__activite-libelle">{a.libelle}</span>
																</h4>
																<p class="p-cadre-logique__activite-meta">
																	<span><Icone nom="utilisateur" taille="sm" /> {a.responsable ?? 'Responsable non désigné'}</span>
																	<span><Icone nom="argent" taille="sm" /> {montant(a.budget_planifie, devise)} planifiés</span>
																	{#if majA}
																		<span class="p-cadre-logique__direct"><Icone nom="horloge" taille="sm" /> Modifiée à l’instant par {depot.nomUtilisateur(majA.evenement.auteur)}</span>
																	{/if}
																</p>
															</div>
															{#if archivage || suppression}
																<div class="p-cadre-logique__activite-actions">
																	{#if archivage}
																		<Bouton variante="texte" taille="sm" icone="archive" aria-label="Archiver l’activité {a.numero}" onclick={() => ouvrir({ mode: 'archiver', cible: cibleActivite(a) })}>Archiver</Bouton>
																	{/if}
																	{#if suppression}
																		<Bouton variante="danger" taille="sm" icone="supprimer" aria-label="Supprimer définitivement l’activité {a.numero}" onclick={() => ouvrir({ mode: 'supprimer', cible: cibleActivite(a) })}>Supprimer définitivement</Bouton>
																	{/if}
																</div>
															{/if}
														</div>
														{#if indsA.length}
															{@render listeIndicateurs(indsA, 5, `Indicateurs de l’activité ${a.numero}`)}
														{:else}
															<p class="p-cadre-logique__sans-indicateur">Aucun indicateur rattaché.</p>
														{/if}
													</li>
												{/each}
											</ol>
										{:else}
											<p class="p-cadre-logique__sans-activite">
												Aucune activité pour cet output.{#if structure} Ajoutez la première activité pour la suivre dans le plan d’action.{/if}
											</p>
										{/if}

										{#if structure}
											<div class="p-cadre-logique__ajout">
												<Bouton
													variante="secondaire"
													taille="sm"
													icone="plus"
													aria-label="Ajouter une activité à l’output {s.numero}"
													onclick={() => ouvrir({ mode: 'ajout', outputId: s.id, outputNumero: s.numero, outputLibelle: s.libelle })}
												>
													Ajouter une activité
												</Bouton>
											</div>
										{/if}
									</div>
								</div>
							</section>
						{/each}
					</div>
				</div>
			</section>
		{/each}
	</div>

	<Dialogue ouvert={dialogueOuvert} titre={titreDialogue} onfermer={fermer}>
		{#if dialogue?.mode === 'ajout'}
			<form id="cl-form-ajout" class="p-cadre-logique__form" novalidate onsubmit={ajouter}>
				<p class="p-cadre-logique__dialogue-texte">
					Output {dialogue.outputNumero} : {dialogue.outputLibelle}
				</p>
				<Champ id="cl-ajout-intitule" libelle="Intitulé de l’activité" requis bind:valeur={intitule} erreur={erreurIntitule} />
				<Champ
					id="cl-ajout-budget"
					libelle="Budget planifié (USD)"
					requis
					inputmode="decimal"
					bind:valeur={budgetSaisi}
					erreur={erreurBudget}
					aide="Montant prévu pour toute la durée du projet, en dollars américains."
				/>
				<Champ id="cl-ajout-responsable" libelle="Responsable" bind:valeur={responsable} aide="Nom ou fonction, par exemple « Chargé WASH Paoua »." />
				<p class="p-cadre-logique__dialogue-note">L’activité reçoit le numéro suivant de l’output et apparaît aussi dans le plan d’action.</p>
				{#if erreurDialogue}<Alerte variante="erreur">{erreurDialogue}</Alerte>{/if}
			</form>
		{:else if dialogue?.mode === 'archiver'}
			<div class="p-cadre-logique__form">
				<p class="p-cadre-logique__dialogue-cite">« {dialogue.cible.libelle} »</p>
				<p class="p-cadre-logique__dialogue-texte">
					{dialogue.cible.type === 'activite' ? 'Elle ne sera plus affichée' : 'Il ne sera plus affiché'} dans le cadre logique ni dans les rapports. Rien n’est effacé : {dialogue.cible.type === 'activite'
						? 'elle reste consultable'
						: 'il reste consultable'} dans les archives avec son historique, et la coordination APSUD peut {dialogue.cible.type === 'activite' ? 'la' : 'le'} restaurer.
				</p>
				{#if erreurDialogue}<Alerte variante="erreur">{erreurDialogue}</Alerte>{/if}
			</div>
		{:else if dialogue?.mode === 'supprimer'}
			<form id="cl-form-suppression" class="p-cadre-logique__form" novalidate onsubmit={(e) => { e.preventDefault(); supprimer(); }}>
				<p class="p-cadre-logique__dialogue-cite">« {dialogue.cible.libelle} »</p>
				<Alerte variante="avertissement" titre="Action irréversible">
					{dialogue.cible.type === 'activite' ? 'L’activité sera effacée' : 'L’indicateur sera effacé'} de la base. Seule une trace restera dans le journal d’audit. Préférez « Archiver » si vous voulez seulement {dialogue.cible.type === 'activite' ? 'la' : 'le'} masquer.
				</Alerte>
				<Champ id="cl-confirmation" libelle="Tapez SUPPRIMER pour confirmer" requis bind:valeur={confirmation} />
				{#if erreurDialogue}<Alerte variante="erreur">{erreurDialogue}</Alerte>{/if}
			</form>
		{/if}

		{#snippet actions()}
			<Bouton variante="secondaire" onclick={fermer}>Annuler</Bouton>
			{#if dialogue?.mode === 'ajout'}
				<Bouton variante="primaire" type="submit" form="cl-form-ajout" icone="plus">Ajouter l’activité</Bouton>
			{:else if dialogue?.mode === 'archiver'}
				<Bouton variante="primaire" icone="archive" onclick={archiver}>Archiver</Bouton>
			{:else if dialogue?.mode === 'supprimer'}
				<Bouton variante="danger" type="submit" form="cl-form-suppression" icone="supprimer" disabled={confirmation.trim() !== 'SUPPRIMER'}>Supprimer définitivement</Bouton>
			{/if}
		{/snippet}
	</Dialogue>
{/if}
