<script lang="ts">
	import { page } from '$app/state';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { contexte } from '#lib/donnees/contexte.svelte.ts';
	import { budgetActivite, tauxExecution } from '#lib/donnees/calculs.ts';
	import { peutArchiver, peutEcrireVolet, peutSupprimer } from '#lib/donnees/regles.ts';
	import { date, libelleMois, majuscule, montant, moisCourt, pourcent } from '#lib/format.ts';
	import type { Activite, CodeVolet, Mois, Output, SemaineTache, Tache } from '#lib/donnees/types.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import JaugeJalon from '#lib/composants/ui/JaugeJalon.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import CaseSemaine from './CaseSemaine.svelte';
	import './plan-action.css';

	type NumSemaine = SemaineTache['semaine'];
	type ChampSemaine = 'prevu' | 'realise';
	type EtatCase = { prevu: boolean; realise: boolean };

	interface LigneTache {
		t: Tache;
		semaines: Map<string, SemaineTache>;
	}
	interface LigneActivite {
		a: Activite;
		taches: LigneTache[];
		union: Map<string, EtatCase>;
		budget: { planifie: number; execute: number; taux: number | null };
		taux: number | null;
		debut: string | null;
		fin: string | null;
	}
	interface Groupe {
		output: Output;
		activites: LigneActivite[];
	}

	const SEMAINES: NumSemaine[] = [1, 2, 3, 4, 5];
	/** Nombre de colonnes de détail (Resp., Début, Fin, Planifié, Exécuté, Progrès, Taux). */
	const NB_DETAILS = 7;

	const cle = (m: Mois, s: number) => `${m}#${s}`;
	const parNumero = (x: { numero: string }, y: { numero: string }) => x.numero.localeCompare(y.numero, 'fr', { numeric: true });
	const idSur = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '-');
	const message = (e: unknown) => (e instanceof Error ? e.message : 'Action impossible. Réessayez.');
	/** Date « AAAA-MM-JJ » lue en heure locale (évite le décalage de fuseau). */
	const jour = (d: string | null) => (d ? date(d.length === 10 ? `${d}T00:00:00` : d) : '–');

	const code = $derived(page.params.code as CodeVolet);
	const etat = $derived(depot.etat);
	const volet = $derived(etat.volets.find((v) => v.code === code));
	const u = $derived(depot.utilisateur);
	const ecrit = $derived(volet ? peutEcrireVolet(u, volet) : false);
	const archivable = $derived(volet ? peutArchiver(u, volet) : false);
	const supprimable = $derived(peutSupprimer(u));
	const devise = $derived(etat.projet.devise);
	const moisProjet = $derived(etat.projet.mois);
	const moisListe = $derived(contexte.mois);

	let mode = $state<ChampSemaine>('prevu');
	let details = $state(true);
	let erreur = $state<string | null>(null);

	/* Horloge locale : fait disparaître le fond « modifiée à l'instant » après 10 s. */
	let tic = $state(0);
	$effect(() => {
		const id = setInterval(() => (tic += 1), 2000);
		return () => clearInterval(id);
	});

	/** Semaine en cours de la démonstration : S1 = jours 1 à 7, … S5 = jours 29 à 31. */
	const aujourdhui = $derived.by(() => {
		const d = depot.maintenant();
		const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		return { mois, semaine: Math.min(5, Math.ceil(d.getDate() / 7)), dansProjet: etat.projet.mois.includes(mois) };
	});
	const estAujourdhui = (m: Mois, s: number) => aujourdhui.dansProjet && m === aujourdhui.mois && s === aujourdhui.semaine;

	const groupes = $derived.by<Groupe[]>(() => {
		if (!volet) return [];
		const activites = etat.activites.filter((a) => a.volet === volet.code && !a.archive_le);
		const outputs = etat.outputs.filter((o) => o.volet === volet.code).sort(parNumero);
		return outputs
			.map((output) => ({
				output,
				activites: activites
					.filter((a) => a.output_id === output.id)
					.sort(parNumero)
					.map((a) => ligneActivite(a))
			}))
			.filter((g) => g.activites.length > 0);
	});

	function ligneActivite(a: Activite): LigneActivite {
		const taches = etat.taches.filter((t) => t.activite_id === a.id && !t.archive_le);
		const union = new Map<string, EtatCase>();
		const lignes = taches.map((t) => {
			const semaines = new Map<string, SemaineTache>();
			for (const s of t.semaines) {
				semaines.set(cle(s.mois, s.semaine), s);
				if (!s.prevu && !s.realise) continue;
				const k = cle(s.mois, s.semaine);
				const u0 = union.get(k) ?? { prevu: false, realise: false };
				union.set(k, { prevu: u0.prevu || s.prevu, realise: u0.realise || s.realise });
			}
			return { t, semaines };
		});
		const debuts = taches.map((t) => t.date_debut).filter((d): d is string => !!d).sort();
		const fins = taches.map((t) => t.date_fin).filter((d): d is string => !!d).sort();
		return {
			a,
			taches: lignes,
			union,
			budget: budgetActivite(etat, a.id),
			taux: tauxExecution(etat, a.id, contexte.mois),
			debut: debuts[0] ?? null,
			fin: fins[fins.length - 1] ?? null
		};
	}

	const nbTaches = $derived(groupes.reduce((n, g) => n + g.activites.reduce((m, la) => m + la.taches.length, 0), 0));
	const nbColonnesApres = $derived((details ? NB_DETAILS : 0) + moisProjet.length * SEMAINES.length);

	function texteEtat(s: EtatCase | undefined): string {
		if (!s || (!s.prevu && !s.realise)) return 'vide';
		if (s.prevu && s.realise) return 'prévu, réalisé';
		if (s.realise) return 'réalisé';
		return 'prévu, non réalisé';
	}

	function libelleCase(t: Tache, m: Mois, s: NumSemaine, st: EtatCase | undefined): string {
		const enCours = estAujourdhui(m, s) ? ' (semaine en cours)' : '';
		return `Tâche ${t.libelle}, semaine ${s} de ${libelleMois(m)}${enCours} : ${texteEtat(st)}`;
	}

	/** Mise à jour reçue d'un autre onglet il y a moins de 10 s. */
	function enDirect(id: string) {
		void tic;
		return depot.estEnDirect(id);
	}

	function basculer(t: Tache, m: Mois, s: NumSemaine) {
		erreur = null;
		try {
			depot.basculerSemaine(t.id, m, s, mode);
		} catch (e) {
			erreur = message(e);
		}
	}

	/* ---------- Défilement initial vers la semaine en cours ---------- */

	let zone: HTMLDivElement | undefined = $state();
	$effect(() => {
		void details;
		if (!zone) return;
		const cible = zone.querySelector<HTMLElement>('[data-aujourdhui]');
		const fixe = zone.querySelector<HTMLElement>('.p-plan-action__fixe');
		if (!cible || !fixe) return;
		const position = cible.getBoundingClientRect().left - zone.getBoundingClientRect().left + zone.scrollLeft;
		zone.scrollLeft = Math.max(0, position - fixe.offsetWidth - cible.offsetWidth * SEMAINES.length);
	});

	/* ---------- Dialogues : ajout, archivage, suppression définitive ---------- */

	type EtatDialogue =
		| { type: 'ajout'; activiteId: string; numero: string; libelle: string }
		| { type: 'archiver'; tacheId: string; libelle: string }
		| { type: 'supprimer'; tacheId: string; libelle: string }
		| null;

	let dialogue = $state.raw<EtatDialogue>(null);
	let erreurDialogue = $state<string | null>(null);
	let fLibelle = $state('');
	let fResponsable = $state('');
	let fDebut = $state('');
	let fFin = $state('');
	let fConfirmation = $state('');

	const titreDialogue = $derived.by(() => {
		if (!dialogue) return '';
		if (dialogue.type === 'ajout') return `Ajouter une tâche à l’activité ${dialogue.numero}`;
		if (dialogue.type === 'archiver') return 'Archiver la tâche';
		return 'Supprimer définitivement la tâche';
	});

	function ouvrirAjout(a: Activite) {
		fLibelle = '';
		fResponsable = a.responsable ?? '';
		fDebut = '';
		fFin = '';
		erreurDialogue = null;
		dialogue = { type: 'ajout', activiteId: a.id, numero: a.numero, libelle: a.libelle };
	}

	function ouvrirArchivage(t: Tache) {
		erreurDialogue = null;
		dialogue = { type: 'archiver', tacheId: t.id, libelle: t.libelle };
	}

	function ouvrirSuppression(t: Tache) {
		erreurDialogue = null;
		fConfirmation = '';
		dialogue = { type: 'supprimer', tacheId: t.id, libelle: t.libelle };
	}

	function fermer() {
		dialogue = null;
		erreurDialogue = null;
	}

	function ajouter(e: SubmitEvent) {
		e.preventDefault();
		if (dialogue?.type !== 'ajout') return;
		erreurDialogue = null;
		try {
			depot.ajouterTache(dialogue.activiteId, {
				libelle: fLibelle,
				responsable: fResponsable.trim() || null,
				date_debut: fDebut || null,
				date_fin: fFin || null
			});
			fermer();
		} catch (err) {
			erreurDialogue = message(err);
		}
	}

	function archiver() {
		if (dialogue?.type !== 'archiver') return;
		try {
			depot.archiver('tache', dialogue.tacheId);
			fermer();
		} catch (err) {
			erreurDialogue = message(err);
		}
	}

	function supprimer() {
		if (dialogue?.type !== 'supprimer') return;
		if (fConfirmation.trim() !== 'SUPPRIMER') {
			erreurDialogue = 'Tapez SUPPRIMER en majuscules pour confirmer.';
			return;
		}
		try {
			depot.supprimerDefinitivement('tache', dialogue.tacheId);
			fermer();
		} catch (err) {
			erreurDialogue = message(err);
		}
	}
</script>

<svelte:head><title>Plan d’action {code} · Suivi consortium APSUD</title></svelte:head>

{#snippet actionsTache(t: Tache)}
	{#if archivable || supprimable}
		<span class="p-plan-action__actions-tache">
			{#if archivable}
				<button type="button" class="p-plan-action__icone-bouton" title="Archiver" aria-label="Archiver la tâche {t.libelle}" onclick={() => ouvrirArchivage(t)}>
					<Icone nom="archive" taille="sm" />
				</button>
			{/if}
			{#if supprimable}
				<button
					type="button"
					class="p-plan-action__icone-bouton p-plan-action__icone-bouton--danger"
					title="Supprimer définitivement"
					aria-label="Supprimer définitivement la tâche {t.libelle}"
					onclick={() => ouvrirSuppression(t)}
				>
					<Icone nom="supprimer" taille="sm" />
				</button>
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet marqueDirect(id: string)}
	{@const maj = enDirect(id)}
	{#if maj}
		<span class="p-plan-action__direct">Modifiée à l’instant par {depot.nomUtilisateur(maj.evenement.auteur)}</span>
	{/if}
{/snippet}

{#if volet}
	<div class="p-plan-action">
		{#if !ecrit}
			<Alerte variante="info">
				Lecture seule : seule l’ONG du volet ({volet.organisation}) et la coordination APSUD peuvent modifier ce plan d’action.
			</Alerte>
		{/if}
		{#if erreur}
			<Alerte variante="erreur" onfermer={() => (erreur = null)}>{erreur}</Alerte>
		{/if}

		<Panneau
			titre="Calendrier des tâches"
			sousTitre="{moisProjet.length} mois, du {jour(etat.projet.date_debut)} au {jour(etat.projet.date_fin)}. {nbTaches} tâche{nbTaches > 1 ? 's' : ''}, une colonne par semaine (S1 à S5)."
			id="plan-calendrier"
			sansMarge
		>
			{#snippet actions()}
				{#if ecrit}
					<div class="p-plan-action__mode" role="group" aria-labelledby="plan-mode-libelle">
						<span id="plan-mode-libelle" class="p-plan-action__mode-libelle">Je coche :</span>
						<span class="p-plan-action__segments">
							<button type="button" class="p-plan-action__segment" aria-pressed={mode === 'prevu'} onclick={() => (mode = 'prevu')}>
								<span class="p-plan-action__temoin p-plan-action__temoin--prevu" aria-hidden="true"></span>Prévu
							</button>
							<button type="button" class="p-plan-action__segment" aria-pressed={mode === 'realise'} onclick={() => (mode = 'realise')}>
								<span class="p-plan-action__temoin p-plan-action__temoin--realise" aria-hidden="true"><Icone nom="valider" taille="sm" /></span>Réalisé
							</button>
						</span>
					</div>
				{/if}
				<button type="button" class="p-plan-action__bascule" aria-pressed={details} onclick={() => (details = !details)}>
					<span class="p-plan-action__bascule-case" aria-hidden="true">{#if details}<Icone nom="valider" taille="sm" />{/if}</span>
					Responsables, dates et budgets
				</button>
			{/snippet}

			<ul class="p-plan-action__legende" role="list" aria-label="Légende du calendrier">
				<li><CaseSemaine lecture /> Vide</li>
				<li><CaseSemaine lecture prevu /> Prévu</li>
				<li><CaseSemaine lecture prevu realise /> Réalisé</li>
				<li>
					<span class="p-plan-action__temoin-jour" aria-hidden="true"></span>
					{#if aujourdhui.dansProjet}
						Aujourd’hui : semaine {aujourdhui.semaine} de {libelleMois(aujourdhui.mois)}
					{:else}
						Aujourd’hui : hors de la période du projet
					{/if}
				</li>
				<li><span class="p-plan-action__temoin-direct" aria-hidden="true"></span> Modifiée à l’instant par un autre utilisateur</li>
				<li class="p-plan-action__legende-aide">S1 = jours 1 à 7, S2 = 8 à 14, S3 = 15 à 21, S4 = 22 à 28, S5 = 29 à la fin du mois.</li>
			</ul>

			{#if ecrit}
				<p class="p-plan-action__consigne">
					Cliquez sur une case de tâche (ou Espace / Entrée) pour cocher ou décocher le
					<strong>{mode === 'prevu' ? 'prévu' : 'réalisé'}</strong> de cette semaine. Une semaine réalisée est aussi comptée comme prévue.
				</p>
			{:else}
				<p class="p-plan-action__consigne">Les cases sont affichées en lecture seule.</p>
			{/if}

			{#if groupes.length === 0}
				<div class="p-plan-action__vide">
					<EtatVide icone="calendrier" titre="Aucune activité dans ce volet." texte="Les activités se créent dans le cadre logique ; leurs tâches apparaîtront ensuite dans ce calendrier.">
						{#snippet action()}<Bouton variante="secondaire" href="/volets/{volet.code}/cadre-logique">Ouvrir le cadre logique</Bouton>{/snippet}
					</EtatVide>
				</div>
			{:else}
				<!-- Grand tableau (ordinateur et tablette) -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="p-plan-action__defilement" bind:this={zone} tabindex="0" role="region" aria-label="Calendrier des tâches, défilement horizontal">
					<table class="p-plan-action__table">
						<caption class="u-visuellement-masque">
							Plan d’action {volet.code} : activités, tâches et calendrier des semaines S1 à S5 sur les {moisProjet.length} mois du projet
						</caption>
						<colgroup span={details ? NB_DETAILS + 1 : 1}></colgroup>
						{#each moisProjet as m (m)}<colgroup span="5"></colgroup>{/each}
						<thead>
							<tr>
								<th scope="col" rowspan="2" class="p-plan-action__fixe">Activité · action à prendre</th>
								{#if details}
									<th scope="col" rowspan="2"><abbr title="Responsable">Resp.</abbr></th>
									<th scope="col" rowspan="2">Début</th>
									<th scope="col" rowspan="2">Fin</th>
									<th scope="col" rowspan="2" class="u-nombre">Budget planifié</th>
									<th scope="col" rowspan="2" class="u-nombre">Budget exécuté</th>
									<th scope="col" rowspan="2">Progrès financier</th>
									<th scope="col" rowspan="2" class="u-nombre">
										<abbr title="Taux d’exécution du programme à fin {libelleMois(contexte.mois)}">Taux d’exéc.</abbr>
									</th>
								{/if}
								{#each moisProjet as m (m)}
									<th scope="colgroup" colspan="5" class="p-plan-action__mois">
										<abbr title={majuscule(libelleMois(m))}>{moisCourt(m)}</abbr>
										{m.slice(0, 4)}
									</th>
								{/each}
							</tr>
							<tr>
								{#each moisProjet as m (m)}
									{#each SEMAINES as s (s)}
										{@const auj = estAujourdhui(m, s)}
										<th
											scope="col"
											class="p-plan-action__sem"
											class:is-debut-mois={s === 1}
											class:is-aujourdhui={auj}
											data-aujourdhui={auj ? '' : undefined}
										>
											<span aria-hidden="true">S{s}</span>
											<span class="u-visuellement-masque">Semaine {s} de {libelleMois(m)}{auj ? ', semaine en cours' : ''}</span>
										</th>
									{/each}
								{/each}
							</tr>
						</thead>
						{#each groupes as g (g.output.id)}
							<tbody>
								<tr class="p-plan-action__ligne-output">
									<th scope="rowgroup" class="p-plan-action__fixe">
										<span class="p-plan-action__numero">Output {g.output.numero}</span>
										<span class="p-plan-action__output-libelle">{g.output.libelle}</span>
									</th>
									<td colspan={nbColonnesApres}></td>
								</tr>
								{#each g.activites as la (la.a.id)}
									<tr class="p-plan-action__ligne-activite">
										<th scope="row" class="p-plan-action__fixe">
											<span class="p-plan-action__numero">{la.a.numero}</span>
											{la.a.libelle}
										</th>
										{#if details}
											<td>{la.a.responsable ?? '–'}</td>
											<td>{jour(la.debut)}</td>
											<td>{jour(la.fin)}</td>
											<td class="u-nombre">{montant(la.budget.planifie, devise)}</td>
											<td class="u-nombre">{montant(la.budget.execute, devise)}</td>
											<td>
												<span class="p-plan-action__progres">
													<JaugeJalon cumulPrecedent={la.budget.execute} ceMois={0} cible={la.budget.planifie} sansTexte />
													<span class="u-nombre">{pourcent(la.budget.taux === null ? null : Math.round(la.budget.taux))}</span>
												</span>
											</td>
											<td class="u-nombre">{pourcent(la.taux)}</td>
										{/if}
										{#each moisProjet as m (m)}
											{#each SEMAINES as s (s)}
												{@const st = la.union.get(cle(m, s))}
												<td class="p-plan-action__sem" class:is-debut-mois={s === 1} class:is-aujourdhui={estAujourdhui(m, s)}>
													<CaseSemaine lecture prevu={st?.prevu} realise={st?.realise} texte={st ? texteEtat(st) : undefined} />
												</td>
											{/each}
										{/each}
									</tr>
									{#each la.taches as lt (lt.t.id)}
										<tr class="p-plan-action__ligne-tache" class:is-direct={!!enDirect(lt.t.id)}>
											<th scope="row" class="p-plan-action__fixe">
												<span class="p-plan-action__tache">
													<span class="p-plan-action__tache-texte">
														<span>{lt.t.libelle}</span>
														{@render marqueDirect(lt.t.id)}
													</span>
													{@render actionsTache(lt.t)}
												</span>
											</th>
											{#if details}
												<td>{lt.t.responsable ?? '–'}</td>
												<td>{jour(lt.t.date_debut)}</td>
												<td>{jour(lt.t.date_fin)}</td>
												<td colspan="4"></td>
											{/if}
											{#each moisProjet as m (m)}
												{#each SEMAINES as s (s)}
													{@const st = lt.semaines.get(cle(m, s))}
													<td class="p-plan-action__sem" class:is-debut-mois={s === 1} class:is-aujourdhui={estAujourdhui(m, s)}>
														<CaseSemaine
															prevu={st?.prevu}
															realise={st?.realise}
															pressee={st?.[mode] ?? false}
															libelle={libelleCase(lt.t, m, s, st)}
															actif={ecrit}
															onbasculer={() => basculer(lt.t, m, s)}
														/>
													</td>
												{/each}
											{/each}
										</tr>
									{:else}
										<tr class="p-plan-action__ligne-vide">
											<td class="p-plan-action__fixe">
												Aucune tâche pour cette activité.{#if ecrit} Ajoutez la première tâche pour l’afficher dans le calendrier.{/if}
											</td>
											<td colspan={nbColonnesApres}></td>
										</tr>
									{/each}
									{#if ecrit}
										<tr class="p-plan-action__ligne-ajout">
											<td class="p-plan-action__fixe">
												<Bouton variante="texte" taille="sm" icone="plus" onclick={() => ouvrirAjout(la.a)}>
													Ajouter une tâche<span class="u-visuellement-masque"> à l’activité {la.a.numero}</span>
												</Bouton>
											</td>
											<td colspan={nbColonnesApres}></td>
										</tr>
									{/if}
								{/each}
							</tbody>
						{/each}
					</table>
				</div>

				<!-- Liste par mois (téléphone) -->
				<div class="p-plan-action__liste">
					<div class="p-plan-action__liste-tete">
						<button
							type="button"
							class="p-plan-action__icone-bouton"
							aria-label="Mois précédent"
							disabled={moisListe === moisProjet[0]}
							onclick={() => contexte.decaler(-1)}
						>
							<Icone nom="chevron-gauche" />
						</button>
						<h3 class="p-plan-action__liste-titre" aria-live="polite">Semaines de {libelleMois(moisListe)}</h3>
						<button
							type="button"
							class="p-plan-action__icone-bouton"
							aria-label="Mois suivant"
							disabled={moisListe === moisProjet[moisProjet.length - 1]}
							onclick={() => contexte.decaler(1)}
						>
							<Icone nom="chevron-droite" />
						</button>
					</div>
					{#each groupes as g (g.output.id)}
						{#each g.activites as la (la.a.id)}
							<section class="p-plan-action__fiche" aria-labelledby="plan-fiche-{idSur(la.a.id)}">
								<h4 class="p-plan-action__fiche-titre" id="plan-fiche-{idSur(la.a.id)}">
									<span class="p-plan-action__numero">{la.a.numero}</span>
									{la.a.libelle}
								</h4>
								<p class="p-plan-action__fiche-meta">
									Budget : {montant(la.budget.execute, devise)} exécutés sur {montant(la.budget.planifie, devise)}
									({pourcent(la.budget.taux === null ? null : Math.round(la.budget.taux))}) · exécution du programme {pourcent(la.taux)}
								</p>
								<ul class="p-plan-action__fiche-taches" role="list">
									{#each la.taches as lt (lt.t.id)}
										<li class="p-plan-action__fiche-tache" class:is-direct={!!enDirect(lt.t.id)}>
											<div class="p-plan-action__fiche-entete">
												<div class="p-plan-action__tache-texte">
													<span class="p-plan-action__fiche-libelle">{lt.t.libelle}</span>
													<span class="p-plan-action__fiche-meta">
														{lt.t.responsable ?? 'Responsable non renseigné'} · {jour(lt.t.date_debut)} → {jour(lt.t.date_fin)}
													</span>
													{@render marqueDirect(lt.t.id)}
												</div>
												{@render actionsTache(lt.t)}
											</div>
											<div class="p-plan-action__fiche-semaines" role="group" aria-label="Semaines de {libelleMois(moisListe)}, tâche {lt.t.libelle}">
												{#each SEMAINES as s (s)}
													{@const st = lt.semaines.get(cle(moisListe, s))}
													<span class="p-plan-action__fiche-semaine" class:is-aujourdhui={estAujourdhui(moisListe, s)}>
														<CaseSemaine
															etiquette="S{s}"
															prevu={st?.prevu}
															realise={st?.realise}
															pressee={st?.[mode] ?? false}
															libelle={libelleCase(lt.t, moisListe, s, st)}
															actif={ecrit}
															onbasculer={() => basculer(lt.t, moisListe, s)}
														/>
													</span>
												{/each}
											</div>
										</li>
									{:else}
										<li class="p-plan-action__fiche-vide">
											Aucune tâche pour cette activité.{#if ecrit} Ajoutez la première tâche pour l’afficher dans le calendrier.{/if}
										</li>
									{/each}
								</ul>
								{#if ecrit}
									<Bouton variante="texte" taille="sm" icone="plus" onclick={() => ouvrirAjout(la.a)}>
										Ajouter une tâche<span class="u-visuellement-masque"> à l’activité {la.a.numero}</span>
									</Bouton>
								{/if}
							</section>
						{/each}
					{/each}
				</div>
			{/if}
		</Panneau>
	</div>

	<Dialogue ouvert={!!dialogue} titre={titreDialogue} onfermer={fermer}>
		{#if dialogue?.type === 'ajout'}
			<p>Activité {dialogue.numero} : {dialogue.libelle}</p>
			<form id="p-plan-action-formulaire" class="p-plan-action__formulaire" onsubmit={ajouter}>
				<Champ id="plan-tache-libelle" libelle="Action à prendre" bind:valeur={fLibelle} requis placeholder="Exemple : rédaction des TDR de la formation" />
				<Champ id="plan-tache-responsable" libelle="Responsable" bind:valeur={fResponsable} />
				<div class="p-plan-action__formulaire-dates">
					<Champ id="plan-tache-debut" libelle="Date de début" type="date" bind:valeur={fDebut} />
					<Champ id="plan-tache-fin" libelle="Date de fin" type="date" bind:valeur={fFin} />
				</div>
				<p class="p-plan-action__formulaire-aide">
					Projet du {jour(etat.projet.date_debut)} au {jour(etat.projet.date_fin)}. Cochez ensuite les semaines prévues dans le calendrier.
				</p>
			</form>
		{:else if dialogue?.type === 'archiver'}
			<p>La tâche « {dialogue.libelle} » disparaîtra du calendrier. Elle reste consultable dans les archives et la coordination APSUD peut la restaurer.</p>
		{:else if dialogue?.type === 'supprimer'}
			<p>
				La tâche « {dialogue.libelle} » et toutes ses semaines cochées seront supprimées. <strong>Cette opération est irréversible</strong> ; elle sera inscrite au journal d’audit.
			</p>
			<Champ id="plan-tache-confirmation" libelle="Tapez SUPPRIMER pour confirmer" bind:valeur={fConfirmation} requis />
		{/if}
		{#if erreurDialogue}
			<Alerte variante="erreur">{erreurDialogue}</Alerte>
		{/if}
		{#snippet actions()}
			<Bouton variante="secondaire" onclick={fermer}>Annuler</Bouton>
			{#if dialogue?.type === 'ajout'}
				<Bouton variante="primaire" type="submit" form="p-plan-action-formulaire" icone="plus">Ajouter la tâche</Bouton>
			{:else if dialogue?.type === 'archiver'}
				<Bouton variante="primaire" icone="archive" onclick={archiver}>Archiver la tâche</Bouton>
			{:else if dialogue?.type === 'supprimer'}
				<Bouton variante="danger" icone="supprimer" disabled={fConfirmation.trim() !== 'SUPPRIMER'} onclick={supprimer}>Supprimer définitivement</Bouton>
			{/if}
		{/snippet}
	</Dialogue>
{/if}
