<script lang="ts">
	import { tick } from 'svelte';
	import { depot } from '#lib/donnees/depot.svelte.ts';
	import { cumul, echeance, echeanceFH, indicateursAJour, joursRetard, moisARapporter, rapport as trouverRapport, valeurCourante } from '#lib/donnees/calculs.ts';
	import { peutValider, transitionsPossibles, type Transition } from '#lib/donnees/regles.ts';
	import { date, dateHeure, entier, libelleMois, majuscule, nombre, pourcent } from '#lib/format.ts';
	import type { CodeVolet, Indicateur, Rapport, StatutRapport, Volet } from '#lib/donnees/types.ts';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Tuile from '#lib/composants/ui/Tuile.svelte';
	import JaugeJalon from '#lib/composants/ui/JaugeJalon.svelte';
	import MarqueurStatut from '#lib/composants/ui/MarqueurStatut.svelte';
	import EtiquetteVolet from '#lib/composants/ui/EtiquetteVolet.svelte';
	import EtatVide from '#lib/composants/ui/EtatVide.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import DialogueDecision from './DialogueDecision.svelte';
	import './validation.css';

	/** Écart toléré entre le cumul et le repère attendu au prorata, au-delà duquel on demande une justification (comme OneGMS). */
	const SEUIL_ECART = 15;
	/** Délai de validation au-delà duquel un rapport soumis est signalé « prioritaire ». */
	const DELAI_VALIDATION = 5;
	const JOUR = 86_400_000;
	const DECISIONS_VISIBLES = 8;

	const etat = $derived(depot.etat);
	const u = $derived(depot.utilisateur);
	const autorise = $derived(peutValider(u));
	const maintenant = $derived(depot.maintenant());
	const nbMois = $derived(etat.projet.mois.length);

	function voletDe(code: CodeVolet): Volet {
		return etat.volets.find((v) => v.code === code)!;
	}
	function libelleSecteur(v: Volet): string {
		return etat.secteurs.find((s) => s.code === v.secteur)?.libelle_court ?? v.secteur;
	}
	function nomVolet(v: Volet): string {
		return `${libelleSecteur(v)}, ${v.organisation}`;
	}
	function idDom(r: Rapport): string {
		return r.id.replace(/[^a-zA-Z0-9-]/g, '-');
	}
	function joursDepuis(iso: string | null): number {
		if (!iso) return 0;
		return Math.max(0, Math.floor((maintenant.getTime() - new Date(iso).getTime()) / JOUR));
	}
	function jours(n: number): string {
		return `${entier(n)} jour${n > 1 ? 's' : ''}`;
	}
	function signe(n: number): string {
		const arrondi = Math.round(n);
		return `${arrondi > 0 ? '+' : arrondi < 0 ? '−' : ''}${pourcent(Math.abs(arrondi))}`;
	}

	interface Ecart {
		ind: Indicateur;
		avant: number | null;
		ceMois: number | null;
		realise: number;
		attendu: number;
		ecart: number;
	}

	/**
	 * Repère simple : cible × rang du mois / nombre de mois du projet (10).
	 * Pour un pourcentage (dernière valeur connue), le repère est la cible elle-même.
	 * Seuls les indicateurs chiffrés et renseignés sont comparés ; les manquants
	 * sont déjà comptés dans « indicateurs renseignés ».
	 */
	function ecartsAJustifier(r: Rapport): Ecart[] {
		const rang = etat.projet.mois.indexOf(r.mois) + 1;
		const resultat: Ecart[] = [];
		for (const ind of etat.indicateurs) {
			if (ind.volet !== r.volet || ind.archive_le || !ind.cible.total) continue;
			const total = cumul(etat, ind, r.mois).total;
			if (total === null) continue;
			const attendu = ind.mode_cumul === 'derniere_valeur' ? ind.cible.total : (ind.cible.total * rang) / nbMois;
			if (!attendu) continue;
			const ecart = ((total - attendu) / attendu) * 100;
			if (Math.abs(ecart) <= SEUIL_ECART) continue;
			resultat.push({
				ind,
				avant: cumul(etat, ind, r.mois, false).total,
				ceMois: valeurCourante(etat, ind.id, r.mois)?.valeurs.total ?? null,
				realise: total,
				attendu,
				ecart
			});
		}
		return resultat;
	}

	/* ---------- File « À valider » : du plus ancien au plus récent ---------- */
	const aValider = $derived(
		etat.rapports
			.filter((r) => r.statut === 'soumis')
			.sort((a, b) => (a.soumis_le ?? '').localeCompare(b.soumis_le ?? ''))
			.map((r) => {
				const v = voletDe(r.volet);
				return {
					r,
					v,
					attente: joursDepuis(r.soumis_le),
					renseignes: indicateursAJour(etat, r.volet, r.mois),
					ecarts: ecartsAJustifier(r),
					transitions: transitionsPossibles(u, v, r)
				};
			})
	);

	/* ---------- Rapports en retard (échéance dépassée, non soumis) ---------- */
	const enRetard = $derived.by(() => {
		const liste: { r: Rapport; v: Volet; retard: number }[] = [];
		for (const v of etat.volets) {
			for (const m of etat.projet.mois) {
				const r: Rapport = trouverRapport(etat, v.code, m) ?? {
					id: `${v.code}:${m}`,
					volet: v.code,
					mois: m,
					statut: 'non_commence',
					soumis_par: null,
					soumis_le: null,
					decision_par: null,
					decision_le: null,
					motif: null
				};
				const retard = joursRetard(etat, r, maintenant);
				if (retard > 0) liste.push({ r, v, retard });
			}
		}
		return liste.sort((a, b) => b.retard - a.retard);
	});

	/* ---------- Décisions récentes ---------- */
	const decisions = $derived(
		etat.rapports
			.filter((r) => r.statut === 'valide' || r.statut === 'a_corriger' || r.statut === 'verrouille')
			.sort((a, b) => (b.decision_le ?? '').localeCompare(a.decision_le ?? ''))
			.map((r) => {
				const v = voletDe(r.volet);
				// « Soumettre à APSUD » reste l'affaire de l'ONG : on ne garde ici que les décisions.
				return { r, v, transitions: transitionsPossibles(u, v, r).filter((t) => t.vers !== 'soumis') };
			})
	);
	let toutesDecisions = $state(false);
	const decisionsVisibles = $derived(toutesDecisions ? decisions : decisions.slice(0, DECISIONS_VISIBLES));

	/* ---------- Synthèse ---------- */
	const attendusAuJour = $derived.by(() => {
		const limite = moisARapporter(etat, maintenant);
		return etat.projet.mois.filter((m) => m <= limite).length * etat.volets.length;
	});
	const nbValides = $derived(etat.rapports.filter((r) => r.statut === 'valide' || r.statut === 'verrouille').length);
	const plusAncien = $derived(aValider[0]?.attente ?? 0);

	/* ---------- Actions ---------- */
	let ecartsOuverts = $state<Record<string, boolean>>({});
	let demande = $state<{ r: Rapport; v: Volet; t: Transition } | null>(null);
	let message = $state<{ variante: 'succes' | 'erreur'; titre: string; texte: string } | null>(null);
	let zoneMessage: HTMLDivElement | undefined = $state();

	function texteSucces(avant: StatutRapport, vers: StatutRapport): string {
		if (vers === 'valide' && avant === 'verrouille') return 'Rapport déverrouillé : il repasse au statut « Validé par APSUD ». L’ONG est notifiée.';
		if (vers === 'valide') return 'Rapport validé. L’ONG est notifiée.';
		if (vers === 'verrouille') return 'Rapport verrouillé : ses données ne peuvent plus être modifiées. L’ONG est notifiée.';
		if (vers === 'a_corriger' && avant === 'valide') return 'Rapport rouvert pour correction. L’ONG est notifiée avec votre motif.';
		if (vers === 'a_corriger') return 'Rapport renvoyé pour correction. L’ONG est notifiée avec votre motif.';
		return 'Décision enregistrée.';
	}

	/** Applique la décision via le dépôt (qui vérifie la règle). Renvoie l'erreur éventuelle. */
	function decider(r: Rapport, v: Volet, t: Transition, motif: string | null = null): string | null {
		const avant = r.statut;
		try {
			depot.changerStatut(r.volet, r.mois, t.vers, motif);
		} catch (e) {
			return e instanceof Error ? e.message : 'Action impossible.';
		}
		message = { variante: 'succes', titre: `${nomVolet(v)} · rapport de ${libelleMois(r.mois)}`, texte: texteSucces(avant, t.vers) };
		tick().then(() => zoneMessage?.focus());
		return null;
	}

	function agir(r: Rapport, v: Volet, t: Transition) {
		if (t.motifObligatoire) {
			demande = { r, v, t };
			return;
		}
		const erreur = decider(r, v, t);
		if (erreur) {
			message = { variante: 'erreur', titre: 'Action refusée', texte: erreur };
			tick().then(() => zoneMessage?.focus());
		}
	}

	function confirmerDemande(motif: string): string | null {
		if (!demande) return null;
		const { r, v, t } = demande;
		const erreur = decider(r, v, t, motif);
		if (!erreur) demande = null;
		return erreur;
	}

	function iconeTransition(t: Transition) {
		if (t.vers === 'valide' && !t.motifObligatoire) return 'valider' as const;
		if (t.vers === 'verrouille') return 'cadenas' as const;
		if (t.vers === 'valide') return 'deverrouiller' as const;
		return 'renvoyer' as const;
	}
</script>

<svelte:head><title>Validation · Suivi consortium APSUD</title></svelte:head>

<div class="p-validation">
	<header class="p-validation__tete">
		<h1 class="p-validation__titre">Validation des rapports</h1>
		<p class="p-validation__intro">
			Chaque ONG soumet son rapport du mois à APSUD. La coordination le valide ou le renvoie pour correction avec un motif, puis le verrouille une fois
			les chiffres reportés dans OneGMS.
		</p>
	</header>

	{#if !autorise}
		<EtatVide
			icone="cadenas"
			titre="Cet écran est réservé à la coordination APSUD."
			texte="Seuls la coordination APSUD et le super-administrateur valident ou renvoient les rapports mensuels. Suivez l’état de vos rapports dans l’onglet « Rapports mensuels » de votre volet."
		>
			{#snippet action()}<Bouton variante="secondaire" href="/" icone="tableau-de-bord">Retour au tableau de bord</Bouton>{/snippet}
		</EtatVide>
	{:else}
		<div class="p-validation__message" bind:this={zoneMessage} tabindex="-1">
			{#if message}
				<Alerte variante={message.variante} titre={message.titre} onfermer={() => (message = null)}>{message.texte}</Alerte>
			{/if}
		</div>

		<div class="p-validation__tuiles">
			<Tuile
				chiffre={entier(aValider.length)}
				libelle={aValider.length > 1 ? 'rapports à valider' : 'rapport à valider'}
				detail={aValider.length ? `Le plus ancien attend depuis ${jours(plusAncien)}.` : 'Aucun rapport en attente.'}
			/>
			<Tuile
				chiffre={entier(enRetard.length)}
				libelle={enRetard.length > 1 ? 'rapports en retard' : 'rapport en retard'}
				detail={enRetard.length ? `Échéances du calendrier officiel d’APSUD. Le plus long : ${jours(enRetard[0].retard)}.` : 'Tous les volets sont dans les temps.'}
			/>
			<Tuile chiffre="{entier(nbValides)} sur {entier(attendusAuJour)}" libelle="rapports validés ou verrouillés" detail="Rapports attendus à ce jour, tous volets confondus.">
				{#snippet pied()}<JaugeJalon cumulPrecedent={nbValides} ceMois={0} cible={attendusAuJour} sansTexte />{/snippet}
			</Tuile>
		</div>

		<!-- ================= À valider ================= -->
		<Panneau
			titre="À valider"
			sousTitre="Du plus ancien au plus récent. Un indicateur est « à justifier » quand son cumul s’écarte de plus de {SEUIL_ECART} % du repère attendu au prorata des mois écoulés."
			id="a-valider"
			sansMarge
		>
			{#if aValider.length}
				<div class="p-validation__defilement">
					<table class="p-validation__table">
						<caption class="u-visuellement-masque">Rapports soumis en attente de validation, du plus ancien au plus récent</caption>
						<thead>
							<tr>
								<th scope="col">Volet</th>
								<th scope="col">Rapport</th>
								<th scope="col">Soumis</th>
								<th scope="col" class="u-nombre">Attente</th>
								<th scope="col">Indicateurs renseignés</th>
								<th scope="col">Écarts</th>
								<th scope="col"><span class="u-visuellement-masque">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{#each aValider as { r, v, attente, renseignes, ecarts, transitions } (r.id)}
								{@const ouvert = !!ecartsOuverts[r.id]}
								{@const fh = echeanceFH(etat, r.mois)}
								<tr class:is-ouvert={ouvert}>
									<th scope="row"><EtiquetteVolet secteur={v.secteur} organisation={v.organisation} libelleSecteur={libelleSecteur(v)} /></th>
									<td class="p-validation__mois">
										{majuscule(libelleMois(r.mois))}
										{#if fh}<span class="p-validation__quand">À transmettre au FH le {date(fh.toISOString())}</span>{/if}
									</td>
									<td>
										<span class="p-validation__qui">{depot.nomUtilisateur(r.soumis_par)}</span>
										<span class="p-validation__quand">le {date(r.soumis_le)}</span>
									</td>
									<td class="u-nombre">
										{jours(attente)}
										{#if attente > DELAI_VALIDATION}
											<span class="p-validation__priorite"><Icone nom="horloge" taille="sm" /> Prioritaire</span>
										{/if}
									</td>
									<td>
										<span class="p-validation__renseignes">{entier(renseignes.renseignes)} sur {entier(renseignes.total)}</span>
										{#if renseignes.total > renseignes.renseignes}
											<span class="p-validation__quand">{entier(renseignes.total - renseignes.renseignes)} manquant{renseignes.total - renseignes.renseignes > 1 ? 's' : ''}</span>
										{/if}
									</td>
									<td>
										{#if ecarts.length}
											<button
												type="button"
												class="p-validation__bascule"
												aria-expanded={ouvert}
												aria-controls="ecarts-{idDom(r)}"
												onclick={() => (ecartsOuverts[r.id] = !ouvert)}
											>
												<Icone nom="alerte" taille="sm" />
												{entier(ecarts.length)} à justifier
												<span class="u-visuellement-masque">, rapport {nomVolet(v)} de {libelleMois(r.mois)}</span>
											</button>
										{:else}
											<span class="u-attenue">Aucun</span>
										{/if}
									</td>
									<td>
										<div class="p-validation__actions">
											{#each transitions as t (t.vers)}
												<Bouton
													variante={t.principal ? 'primaire' : 'secondaire'}
													taille="sm"
													icone={iconeTransition(t)}
													aria-label="{t.action} le rapport {nomVolet(v)} de {libelleMois(r.mois)}"
													onclick={() => agir(r, v, t)}
												>
													{t.action}
												</Bouton>
											{/each}
											<a class="p-validation__lien" href="/volets/{r.volet}/activites/{r.mois}">
												Ouvrir le rapport<span class="u-visuellement-masque"> {nomVolet(v)} de {libelleMois(r.mois)}</span>
											</a>
										</div>
									</td>
								</tr>
								{#if ouvert}
									<tr class="p-validation__detail" id="ecarts-{idDom(r)}">
										<td colspan="7">
											<p class="p-validation__detail-titre">
												Indicateurs à justifier · repère au mois {etat.projet.mois.indexOf(r.mois) + 1} sur {nbMois}
											</p>
											<ul class="p-validation__ecarts" role="list">
												{#each ecarts as e (e.ind.id)}
													<li class="p-validation__ecart">
														<div class="p-validation__ecart-libelle">
															{#if e.ind.code_cbpf}<span class="u-code">{e.ind.code_cbpf}</span>{/if}
															<span>{e.ind.libelle}</span>
														</div>
														<div class="p-validation__ecart-jauge">
															<JaugeJalon cumulPrecedent={e.avant} ceMois={e.ceMois} cible={e.ind.cible.total} type={e.ind.type_valeur} />
														</div>
														<p class="p-validation__ecart-repere">
															Repère attendu : <strong>{e.ind.type_valeur === 'pourcentage' ? pourcent(e.attendu) : nombre(Math.round(e.attendu))}</strong>
															<span class="p-validation__ecart-valeur">écart {signe(e.ecart)}</span>
														</p>
													</li>
												{/each}
											</ul>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="p-validation__vide">
					<EtatVide icone="validation" titre="Aucun rapport en attente de validation." texte="Les rapports soumis par les ONG apparaîtront ici, du plus ancien au plus récent." />
				</div>
			{/if}
		</Panneau>

		<!-- ================= En retard ================= -->
		<Panneau titre="En retard" sousTitre="Rapports non soumis dont l’échéance du calendrier officiel (le 2 du mois suivant, le 9 pour les trimestriels 2 et 3) est dépassée." id="en-retard" sansMarge>
			{#if enRetard.length}
				<div class="p-validation__defilement">
					<table class="p-validation__table">
						<caption class="u-visuellement-masque">Rapports non soumis dont l’échéance est dépassée, du plus en retard au moins en retard</caption>
						<thead>
							<tr>
								<th scope="col">Volet</th>
								<th scope="col">Rapport</th>
								<th scope="col">Statut</th>
								<th scope="col">Échéance</th>
								<th scope="col" class="u-nombre">Retard</th>
								<th scope="col"><span class="u-visuellement-masque">Lien</span></th>
							</tr>
						</thead>
						<tbody>
							{#each enRetard as { r, v, retard } (r.id)}
								<tr>
									<th scope="row"><EtiquetteVolet secteur={v.secteur} organisation={v.organisation} libelleSecteur={libelleSecteur(v)} /></th>
									<td class="p-validation__mois">{majuscule(libelleMois(r.mois))}</td>
									<td><MarqueurStatut statut={r.statut} {retard} /></td>
									<td>{date(echeance(etat, r.mois).toISOString())}</td>
									<td class="u-nombre">{jours(retard)}</td>
									<td>
										<a class="p-validation__lien" href="/volets/{r.volet}/activites/{r.mois}">
											Ouvrir le rapport<span class="u-visuellement-masque"> {nomVolet(v)} de {libelleMois(r.mois)}</span>
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="p-validation__vide">
					<EtatVide icone="horloge" titre="Aucun rapport en retard." texte="Tous les rapports attendus ont été soumis avant leur échéance." />
				</div>
			{/if}
		</Panneau>

		<!-- ================= Décisions récentes ================= -->
		<Panneau titre="Décisions récentes" sousTitre="Rapports validés, renvoyés pour correction ou verrouillés, du plus récent au plus ancien." id="decisions" sansMarge>
			{#snippet actions()}
				{#if decisions.length > DECISIONS_VISIBLES}
					<Bouton variante="texte" taille="sm" aria-expanded={toutesDecisions} aria-controls="decisions-table" onclick={() => (toutesDecisions = !toutesDecisions)}>
						{toutesDecisions ? 'Afficher les plus récentes' : `Afficher les ${decisions.length} décisions`}
					</Bouton>
				{/if}
			{/snippet}
			{#if decisions.length}
				<div class="p-validation__defilement">
					<table class="p-validation__table" id="decisions-table">
						<caption class="u-visuellement-masque">Dernières décisions de la coordination sur les rapports mensuels</caption>
						<thead>
							<tr>
								<th scope="col">Volet</th>
								<th scope="col">Rapport</th>
								<th scope="col">Statut</th>
								<th scope="col">Décision</th>
								<th scope="col">Motif</th>
								<th scope="col"><span class="u-visuellement-masque">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{#each decisionsVisibles as { r, v, transitions } (r.id)}
								<tr>
									<th scope="row"><EtiquetteVolet secteur={v.secteur} organisation={v.organisation} libelleSecteur={libelleSecteur(v)} /></th>
									<td class="p-validation__mois">{majuscule(libelleMois(r.mois))}</td>
									<td><MarqueurStatut statut={r.statut} /></td>
									<td>
										<span class="p-validation__qui">{r.decision_par ? depot.nomUtilisateur(r.decision_par) : '–'}</span>
										{#if r.decision_le}
											<time class="p-validation__quand" datetime={r.decision_le} title={dateHeure(r.decision_le)}>le {date(r.decision_le)}</time>
										{/if}
									</td>
									<td class="p-validation__motif">
										{#if r.motif}<p>{r.motif}</p>{:else}<span class="u-attenue">–</span>{/if}
									</td>
									<td>
										<div class="p-validation__actions">
											{#each transitions as t (t.vers)}
												<Bouton
													variante="secondaire"
													taille="sm"
													icone={iconeTransition(t)}
													aria-label="{t.action} le rapport {nomVolet(v)} de {libelleMois(r.mois)}"
													onclick={() => agir(r, v, t)}
												>
													{t.action}
												</Bouton>
											{/each}
											<a class="p-validation__lien" href="/volets/{r.volet}/activites/{r.mois}">
												Ouvrir le rapport<span class="u-visuellement-masque"> {nomVolet(v)} de {libelleMois(r.mois)}</span>
											</a>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="p-validation__vide">
					<EtatVide icone="historique" titre="Aucune décision pour le moment." texte="Les rapports validés, renvoyés ou verrouillés apparaîtront ici." />
				</div>
			{/if}
		</Panneau>
	{/if}
</div>

{#if demande}
	<DialogueDecision rapport={demande.r} libelleVolet={nomVolet(demande.v)} transition={demande.t} onfermer={() => (demande = null)} onconfirmer={confirmerDemande} />
{/if}
