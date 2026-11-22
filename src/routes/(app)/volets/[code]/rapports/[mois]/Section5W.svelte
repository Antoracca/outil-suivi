<script lang="ts">
	import { depot, type ChampsLigne5W } from '#lib/donnees/depot.svelte.ts';
	import { peutArchiver, peutEcrireVolet } from '#lib/donnees/regles.ts';
	import { activiteCluster, activitesParSousCluster, communes, LISTES_5W, LIEUX, prefectureDe, sousPrefectures, ZONES_PROJET } from '#lib/donnees/referentiels/cinqw.ts';
	import { lireNombre, nombre } from '#lib/format.ts';
	import type { Activite, CodeVolet, Fiche5W, Ligne5W, Mois } from '#lib/donnees/types.ts';
	import Panneau from '#lib/composants/ui/Panneau.svelte';
	import Bouton from '#lib/composants/ui/Bouton.svelte';
	import Dialogue from '#lib/composants/ui/Dialogue.svelte';
	import Champ from '#lib/composants/ui/Champ.svelte';
	import Alerte from '#lib/composants/ui/Alerte.svelte';
	import Icone from '#lib/icones/Icone.svelte';
	import './Section5W.css';

	/**
	 * 5W du cluster WASH (EHA) : chaque activité a une fiche (activité standard du cluster,
	 * modalité, bénéficiaires, réponse) remplie une fois ; chaque mois, une ligne par sous-préfecture.
	 * L'export (écran Exports) reproduit les 31 colonnes du modèle du cluster.
	 */
	interface Props {
		volet: CodeVolet;
		mois: Mois;
		modifiable: boolean;
	}
	let { volet, mois, modifiable }: Props = $props();

	const u = $derived(depot.utilisateur);
	const v = $derived(depot.volet(volet));
	const ecrit = $derived(peutEcrireVolet(u, v));
	const activites = $derived(depot.etat.activites.filter((a) => a.volet === volet && !a.archive_le));
	const lignes = (activiteId: string) => depot.etat.lignes_5w.filter((l) => l.activite_id === activiteId && l.mois === mois && !l.archive_le);
	const sansFiche = $derived(activites.filter((a) => !a.fiche_5w).length);

	let erreur = $state<string | null>(null);
	let succes = $state<string | null>(null);

	/* ---------- Fiche 5W ---------- */
	let ficheActivite = $state<Activite | null>(null);
	let fiche = $state<Fiche5W>({ activite_cluster: '', modalite: '', type_beneficiaire: '', reponse: '', partenaires: null });
	let partenaires = $state('');

	function ouvrirFiche(a: Activite) {
		erreur = null;
		ficheActivite = a;
		fiche = a.fiche_5w ? { ...a.fiche_5w } : { activite_cluster: '', modalite: LISTES_5W.modalites[2] ?? '', type_beneficiaire: '', reponse: '', partenaires: null };
		partenaires = a.fiche_5w?.partenaires ?? '';
	}
	function enregistrerFiche() {
		if (!ficheActivite) return;
		try {
			depot.enregistrerFiche5W(ficheActivite.id, { ...fiche, partenaires });
			succes = `Fiche 5W de l’activité ${ficheActivite.numero} enregistrée.`;
			ficheActivite = null;
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
	}

	/* ---------- Ligne 5W ---------- */
	type Saisie = Record<'prefecture' | 'sous_prefecture' | 'commune' | 'village' | 'latitude' | 'longitude' | 'quantite_prevue' | 'quantite_realisee' | 'personnes_ciblees' | 'filles' | 'garcons' | 'femmes' | 'hommes' | 'date_debut' | 'date_fin' | 'statut' | 'commentaire', string>;
	let ligneActivite = $state<Activite | null>(null);
	let ligneEnCours = $state<Ligne5W | null>(null);
	let s = $state<Saisie>(vide());
	let aArchiver = $state<Ligne5W | null>(null);

	function vide(): Saisie {
		const p = depot.etat.projet;
		return { prefecture: 'Ouham', sous_prefecture: '', commune: '', village: '', latitude: '', longitude: '', quantite_prevue: '', quantite_realisee: '', personnes_ciblees: '', filles: '', garcons: '', femmes: '', hommes: '', date_debut: p.date_debut, date_fin: p.date_fin, statut: 'En cours', commentaire: '' };
	}
	const txt = (n: number | null) => (n === null ? '' : String(n));

	function ouvrirLigne(a: Activite, l: Ligne5W | null = null) {
		erreur = null;
		ligneActivite = a;
		ligneEnCours = l;
		s = l
			? { prefecture: l.prefecture, sous_prefecture: l.sous_prefecture, commune: l.commune ?? '', village: l.village ?? '', latitude: txt(l.latitude), longitude: txt(l.longitude), quantite_prevue: txt(l.quantite_prevue), quantite_realisee: txt(l.quantite_realisee), personnes_ciblees: txt(l.personnes_ciblees), filles: txt(l.filles), garcons: txt(l.garcons), femmes: txt(l.femmes), hommes: txt(l.hommes), date_debut: l.date_debut ?? '', date_fin: l.date_fin ?? '', statut: l.statut, commentaire: l.commentaire ?? '' }
			: vide();
	}

	const n = (t: string) => {
		const x = lireNombre(t);
		return x === null ? null : x;
	};
	const totalAtteints = $derived([s.filles, s.garcons, s.femmes, s.hommes].map(n).reduce<number>((a, b) => a + (b && !Number.isNaN(b) ? b : 0), 0));

	function enregistrerLigne() {
		if (!ligneActivite) return;
		const champs: ChampsLigne5W = {
			prefecture: s.prefecture,
			sous_prefecture: s.sous_prefecture,
			commune: s.commune || null,
			village: s.village.trim() || null,
			latitude: n(s.latitude),
			longitude: n(s.longitude),
			quantite_prevue: n(s.quantite_prevue),
			quantite_realisee: n(s.quantite_realisee),
			personnes_ciblees: n(s.personnes_ciblees),
			filles: n(s.filles),
			garcons: n(s.garcons),
			femmes: n(s.femmes),
			hommes: n(s.hommes),
			date_debut: s.date_debut || null,
			date_fin: s.date_fin || null,
			statut: s.statut,
			commentaire: s.commentaire.trim() || null
		};
		try {
			if (ligneEnCours) depot.modifierLigne5W(ligneEnCours.id, champs);
			else depot.ajouterLigne5W(ligneActivite.id, mois, champs);
			succes = ligneEnCours ? 'Ligne 5W mise à jour.' : `Ligne 5W ajoutée pour ${champs.sous_prefecture}.`;
			ligneActivite = null;
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
	}

	function confirmerArchivage() {
		if (!aArchiver) return;
		try {
			depot.archiver('ligne_5w', aArchiver.id);
			succes = 'Ligne 5W archivée. Elle reste consultable dans les archives.';
			aArchiver = null;
		} catch (e) {
			erreur = e instanceof Error ? e.message : String(e);
		}
	}

	const optionsPrefectures = LIEUX.map((l) => ({ valeur: l.prefecture, libelle: l.prefecture }));
	const listeOptions = (liste: string[], vide = 'Choisir…') => [{ valeur: '', libelle: vide }, ...liste.map((x) => ({ valeur: x, libelle: x }))];
</script>

<Panneau titre="5W du cluster WASH" sousTitre="« Qui fait quoi, où, quand » : une ligne par activité et par sous-préfecture, au format du cluster EHA. L’export se fait depuis l’écran Exports." sansMarge id="section-5w-panneau">
	<div class="p-5w">
		{#if sansFiche}
			<p class="p-5w__note"><Icone nom="info" taille="sm" /> {sansFiche} activité{sansFiche > 1 ? 's n’ont' : ' n’a'} pas encore de fiche 5W : elle{sansFiche > 1 ? 's' : ''} ne sortira pas dans l’export.</p>
		{/if}
		{#if succes}<Alerte variante="succes" onfermer={() => (succes = null)}>{succes}</Alerte>{/if}

		{#each activites as a (a.id)}
			{@const ac = activiteCluster(a.fiche_5w?.activite_cluster)}
			{@const ls = lignes(a.id)}
			<section class="p-5w__activite" aria-labelledby="5w-{a.id.replace(/[^a-zA-Z0-9_-]/g, '-')}">
				<header class="p-5w__tete">
					<div>
						<h3 class="p-5w__titre" id="5w-{a.id.replace(/[^a-zA-Z0-9_-]/g, '-')}"><span>{a.numero}</span> {a.libelle}</h3>
						{#if a.fiche_5w && ac}
							<p class="p-5w__fiche">
								<span class="p-5w__etiquette">{ac.sous_cluster}</span>
								<span>{ac.libelle}</span>
								<span class="u-attenue">· {a.fiche_5w.modalite} · {a.fiche_5w.type_beneficiaire} · {a.fiche_5w.reponse}</span>
							</p>
						{:else}
							<p class="p-5w__fiche p-5w__fiche--vide">Fiche 5W à compléter : activité standard du cluster, modalité, bénéficiaires.</p>
						{/if}
					</div>
					{#if ecrit}
						<Bouton variante="texte" taille="sm" icone="modifier" onclick={() => ouvrirFiche(a)}>{a.fiche_5w ? 'Modifier la fiche' : 'Compléter la fiche'}</Bouton>
					{/if}
				</header>

				{#if ls.length}
					<div class="p-5w__defile">
						<table class="p-5w__table">
							<caption class="u-visuellement-masque">Lignes 5W de l’activité {a.numero} pour ce mois</caption>
							<thead>
								<tr>
									<th scope="col">Sous-préfecture</th>
									<th scope="col" class="u-nombre">Qté prévue</th>
									<th scope="col" class="u-nombre">Qté réalisée</th>
									<th scope="col" class="u-nombre">Ciblées</th>
									<th scope="col" class="u-nombre">Atteintes</th>
									<th scope="col">Filles · Garçons · Femmes · Hommes</th>
									<th scope="col">Statut</th>
									{#if modifiable}<th scope="col"><span class="u-visuellement-masque">Actions</span></th>{/if}
								</tr>
							</thead>
							<tbody>
								{#each ls as l (l.id)}
									{@const tot = (l.filles ?? 0) + (l.garcons ?? 0) + (l.femmes ?? 0) + (l.hommes ?? 0)}
									<tr class:is-direct={!!depot.estEnDirect(a.id)}>
										<th scope="row">{l.sous_prefecture}<span class="u-attenue">{l.commune && l.commune !== l.sous_prefecture ? `, ${l.commune}` : ''}{l.village ? `, ${l.village}` : ''}</span></th>
										<td class="u-nombre">{nombre(l.quantite_prevue)}</td>
										<td class="u-nombre">{nombre(l.quantite_realisee)}</td>
										<td class="u-nombre">{nombre(l.personnes_ciblees)}</td>
										<td class="u-nombre"><strong>{nombre(tot)}</strong></td>
										<td class="p-5w__desagrege">{nombre(l.filles)} · {nombre(l.garcons)} · {nombre(l.femmes)} · {nombre(l.hommes)}</td>
										<td>{l.statut}</td>
										{#if modifiable}
											<td class="p-5w__actions">
												<button type="button" class="p-5w__icone" onclick={() => ouvrirLigne(a, l)} aria-label="Modifier la ligne {l.sous_prefecture}"><Icone nom="modifier" taille="sm" /></button>
												{#if peutArchiver(u, v)}
													<button type="button" class="p-5w__icone" onclick={() => (aArchiver = l)} aria-label="Archiver la ligne {l.sous_prefecture}"><Icone nom="archive" taille="sm" /></button>
												{/if}
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="p-5w__vide">Aucune ligne pour ce mois.</p>
				{/if}

				{#if modifiable && a.fiche_5w}
					<button type="button" class="p-5w__ajouter" onclick={() => ouvrirLigne(a)}><Icone nom="plus" taille="sm" /> Ajouter un lieu</button>
				{/if}
			</section>
		{/each}
	</div>
</Panneau>

<!-- Fiche 5W de l'activité -->
<Dialogue ouvert={!!ficheActivite} titre="Fiche 5W de l’activité {ficheActivite?.numero ?? ''}" onfermer={() => (ficheActivite = null)}>
	<p>{ficheActivite?.libelle}</p>
	{#if erreur}<Alerte variante="erreur">{erreur}</Alerte>{/if}
	<div class="c-champ">
		<label class="c-champ__libelle" for="fiche-activite">Activité standard du cluster</label>
		<select id="fiche-activite" class="c-champ__saisie" bind:value={fiche.activite_cluster} required>
			<option value="">Choisir dans la liste du cluster…</option>
			{#each activitesParSousCluster() as g (g.sous_cluster)}
				<optgroup label={g.sous_cluster}>
					{#each g.activites as ac (ac.code)}<option value={ac.code}>{ac.libelle}</option>{/each}
				</optgroup>
			{/each}
		</select>
		{#if activiteCluster(fiche.activite_cluster)}
			{@const ac = activiteCluster(fiche.activite_cluster)!}
			<p class="c-champ__aide">Unité : {ac.unite} · Indicateur du cluster : {ac.indicateur}</p>
		{/if}
	</div>
	<Champ id="fiche-modalite" libelle="Type de modalité" type="select" requis bind:valeur={fiche.modalite} options={listeOptions(LISTES_5W.modalites)} />
	<Champ id="fiche-beneficiaire" libelle="Type de bénéficiaire" type="select" requis bind:valeur={fiche.type_beneficiaire} options={listeOptions(LISTES_5W.types_beneficiaire)} />
	<Champ id="fiche-reponse" libelle="Type de réponse" type="select" requis bind:valeur={fiche.reponse} options={listeOptions(LISTES_5W.reponses)} />
	<Champ id="fiche-partenaires" libelle="Partenaires de mise en œuvre du paquet WASH" bind:valeur={partenaires} aide="Autres organisations qui mettent en œuvre ce paquet pour le même projet." />
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={() => (ficheActivite = null)}>Annuler</Bouton>
		<Bouton variante="primaire" onclick={enregistrerFiche}>Enregistrer la fiche</Bouton>
	{/snippet}
</Dialogue>

<!-- Ligne 5W (un lieu) -->
<Dialogue ouvert={!!ligneActivite} titre={ligneEnCours ? 'Modifier la ligne 5W' : 'Ajouter un lieu au 5W'} onfermer={() => (ligneActivite = null)}>
	<p>{ligneActivite?.numero} {ligneActivite?.libelle}</p>
	{#if erreur}<Alerte variante="erreur">{erreur}</Alerte>{/if}
	<div class="p-5w__zones" role="group" aria-label="Sous-préfectures du projet">
		{#each ZONES_PROJET as z (z)}
			<button type="button" class:is-actif={s.sous_prefecture === z} aria-pressed={s.sous_prefecture === z} onclick={() => { s.sous_prefecture = z; s.prefecture = prefectureDe(z) ?? s.prefecture; s.commune = communes(s.prefecture, z).length === 1 ? communes(s.prefecture, z)[0] : ''; }}>{z}</button>
		{/each}
	</div>
	<div class="p-5w__grille">
		<Champ id="l5w-pref" libelle="Préfecture" type="select" requis bind:valeur={s.prefecture} options={optionsPrefectures} />
		<Champ id="l5w-sp" libelle="Sous-préfecture" type="select" requis bind:valeur={s.sous_prefecture} options={listeOptions(sousPrefectures(s.prefecture))} />
		<Champ id="l5w-commune" libelle="Commune" type="select" bind:valeur={s.commune} options={listeOptions(communes(s.prefecture, s.sous_prefecture), '—')} />
		<Champ id="l5w-village" libelle="Village ou localisation" bind:valeur={s.village} />
		<Champ id="l5w-lat" libelle="Latitude" inputmode="decimal" bind:valeur={s.latitude} aide="Degrés décimaux, ex. 6,4893" />
		<Champ id="l5w-long" libelle="Longitude" inputmode="decimal" bind:valeur={s.longitude} aide="Degrés décimaux, ex. 17,4482" />
		<Champ id="l5w-qp" libelle="Quantité prévue ({activiteCluster(ligneActivite?.fiche_5w?.activite_cluster)?.unite ?? 'unités'})" inputmode="numeric" bind:valeur={s.quantite_prevue} />
		<Champ id="l5w-qr" libelle="Quantité réalisée" inputmode="numeric" bind:valeur={s.quantite_realisee} />
		<Champ id="l5w-cibles" libelle="Personnes ciblées" inputmode="numeric" bind:valeur={s.personnes_ciblees} />
		<Champ id="l5w-statut" libelle="Statut" type="select" requis bind:valeur={s.statut} options={LISTES_5W.statuts.map((x) => ({ valeur: x, libelle: x }))} />
	</div>
	<fieldset class="p-5w__personnes">
		<legend>Personnes atteintes : {nombre(totalAtteints)}</legend>
		<div class="p-5w__grille p-5w__grille--4">
			<Champ id="l5w-filles" libelle="Filles" inputmode="numeric" bind:valeur={s.filles} />
			<Champ id="l5w-garcons" libelle="Garçons" inputmode="numeric" bind:valeur={s.garcons} />
			<Champ id="l5w-femmes" libelle="Femmes" inputmode="numeric" bind:valeur={s.femmes} />
			<Champ id="l5w-hommes" libelle="Hommes" inputmode="numeric" bind:valeur={s.hommes} />
		</div>
	</fieldset>
	<div class="p-5w__grille">
		<Champ id="l5w-debut" libelle="Date de début" type="date" bind:valeur={s.date_debut} />
		<Champ id="l5w-fin" libelle="Date de fin" type="date" bind:valeur={s.date_fin} />
	</div>
	<Champ id="l5w-commentaire" libelle="Commentaire" type="textarea" bind:valeur={s.commentaire} />
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={() => (ligneActivite = null)}>Annuler</Bouton>
		<Bouton variante="primaire" onclick={enregistrerLigne}>{ligneEnCours ? 'Enregistrer' : 'Ajouter la ligne'}</Bouton>
	{/snippet}
</Dialogue>

<Dialogue ouvert={!!aArchiver} titre="Archiver la ligne 5W" onfermer={() => (aArchiver = null)}>
	<p>La ligne « {aArchiver?.sous_prefecture} » ne sortira plus dans l’export 5W. Elle reste consultable dans les archives et la coordination APSUD peut la restaurer.</p>
	{#if erreur}<Alerte variante="erreur">{erreur}</Alerte>{/if}
	{#snippet actions()}
		<Bouton variante="secondaire" onclick={() => (aArchiver = null)}>Annuler</Bouton>
		<Bouton variante="primaire" onclick={confirmerArchivage}>Archiver</Bouton>
	{/snippet}
</Dialogue>
