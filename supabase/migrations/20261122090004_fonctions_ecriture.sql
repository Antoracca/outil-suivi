-- =============================================================================
-- 0004 · Fonctions d'écriture : la seule porte d'entrée des modifications
--
-- Le navigateur n'a AUCUN droit d'insertion, de modification ou de suppression
-- directe sur les tables (0005). Chaque action de l'application appelle une de ces
-- fonctions, qui :
--   1. vérifie le compte, le rôle, l'organisation et le statut du mois
--      (miroir exact de src/lib/donnees/regles.ts) ;
--   2. contrôle les valeurs (miroir de depot.svelte.ts) ;
--   3. écrit la donnée et l'événement du fil d'activité dans la même transaction ;
--   4. notifie les personnes concernées.
-- Chaque appel porte l'identifiant de son événement, généré sur l'appareil :
-- un appel rejoué (réseau coupé puis rétabli) ne fait rien la seconde fois.
-- =============================================================================

-- ---------- Socle commun ----------

/** Le profil actif de la personne connectée, sinon refus. */
create function public._moi() returns public.profils
	language plpgsql stable security definer set search_path = ''
as $$
declare
	p public.profils;
begin
	select * into p from public.profils where id = auth.uid() and actif;
	if not found then
		raise exception 'Connectez-vous avec un compte actif pour continuer.' using errcode = '42501';
	end if;
	return p;
end;
$$;

create function public._volet(p_code text) returns public.volets
	language plpgsql stable security definer set search_path = ''
as $$
declare
	v public.volets;
begin
	select * into v from public.volets where code = p_code;
	if not found then raise exception 'Volet inconnu : %.', p_code using errcode = 'P0001'; end if;
	return v;
end;
$$;

create function public._est_coordination(p public.profils) returns boolean
	language sql immutable set search_path = ''
as $$ select p.role in ('coordination', 'super_admin') $$;

/** regles.ts › peutEcrireVolet */
create function public._peut_ecrire_volet(p public.profils, v public.volets) returns boolean
	language sql immutable set search_path = ''
as $$ select p.role in ('coordination', 'super_admin') or (p.role = 'saisie' and p.organisation = v.organisation) $$;

/** regles.ts › peutModifierStructure */
create function public._peut_modifier_structure(p public.profils, v public.volets) returns boolean
	language sql immutable set search_path = ''
as $$ select p.role in ('coordination', 'super_admin') or (p.role = 'saisie' and p.organisation = v.organisation and not v.cadre_verrouille) $$;

create function public._deja_fait(p_evenement text) returns boolean
	language sql stable security definer set search_path = ''
as $$ select p_evenement is not null and exists (select 1 from public.journal where id = p_evenement) $$;

/**
 * regles.ts › peutSaisirMois : écriture permise dans le volet ET rapport du mois
 * ni validé ni verrouillé. Le premier enregistrement passe le rapport en brouillon.
 */
create function public._exiger_saisie(p_volet text, p_mois text) returns public.profils
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	v public.volets := public._volet(p_volet);
	r public.rapports;
begin
	if not public._peut_ecrire_volet(p, v) then
		raise exception 'Votre organisation (%) ne peut pas modifier le volet %.', p.organisation, p_volet using errcode = '42501';
	end if;
	if not exists (select 1 from public.periodes where mois = p_mois) then
		raise exception 'Le mois % ne fait pas partie du projet.', p_mois using errcode = 'P0001';
	end if;
	select * into r from public.rapports where volet = p_volet and mois = p_mois for update;
	if found and r.statut not in ('non_commence', 'brouillon', 'a_corriger') then
		raise exception 'Ce rapport est validé ou verrouillé : demandez une réouverture à la coordination APSUD.' using errcode = 'P0001';
	end if;
	if not found then
		insert into public.rapports (id, volet, mois, statut) values (p_volet || ':' || p_mois, p_volet, p_mois, 'brouillon');
	elsif r.statut = 'non_commence' then
		update public.rapports set statut = 'brouillon' where id = r.id;
	end if;
	return p;
end;
$$;

/**
 * Inscrit l'événement au fil d'activité et notifie : la coordination, le super-admin
 * et l'ONG du volet (sauf comptes en lecture seule), jamais l'auteur (regles.ts › destinataires).
 */
create function public._journaliser(
	p_evenement text, p_auteur public.profils, p_type text, p_volet text, p_mois text,
	p_cible_type text, p_cible_id text, p_cible_libelle text, p_resume text,
	p_avant jsonb default null, p_apres jsonb default null
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	ev text := coalesce(p_evenement, gen_random_uuid()::text);
	org_volet text;
begin
	insert into public.journal (id, type, auteur, organisation, volet, mois, cible_type, cible_id, cible_libelle, resume, avant, apres)
	values (ev, p_type, p_auteur.id, p_auteur.organisation, p_volet, p_mois, p_cible_type, p_cible_id, p_cible_libelle, p_resume, p_avant, p_apres);
	select organisation into org_volet from public.volets where code = p_volet;
	insert into public.notifications (evenement_id, destinataire)
	select ev, u.id
	from public.profils u
	where u.actif
		and u.id <> p_auteur.id
		and (u.role in ('coordination', 'super_admin') or (org_volet is not null and u.organisation = org_volet and u.role <> 'lecture'));
end;
$$;

create function public._desagregation(f numeric, fi numeric, h numeric, g numeric, t numeric) returns jsonb
	language sql immutable set search_path = ''
as $$ select jsonb_build_object('femmes', f, 'filles', fi, 'hommes', h, 'garcons', g, 'total', t) $$;

create function public._libelle_activite(a public.activites) returns text
	language sql immutable set search_path = ''
as $$ select a.numero || ' ' || a.libelle $$;

create function public._activite(p_id text) returns public.activites
	language plpgsql stable security definer set search_path = ''
as $$
declare
	a public.activites;
begin
	select * into a from public.activites where id = p_id;
	if not found then raise exception 'Activité introuvable.' using errcode = 'P0001'; end if;
	return a;
end;
$$;

-- ---------- Indicateurs : réalisé du mois ----------

create function public.enregistrer_valeur(
	p_evenement text, p_id text, p_indicateur text, p_mois text,
	p_femmes numeric, p_filles numeric, p_hommes numeric, p_garcons numeric, p_total numeric,
	p_commentaire text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	ind public.indicateurs;
	p public.profils;
	prec public.valeurs;
	a_prec boolean;
	x numeric;
	f numeric := p_femmes; fi numeric := p_filles; h numeric := p_hommes; g numeric := p_garcons; t numeric := p_total;
	com text := nullif(trim(coalesce(p_commentaire, '')), '');
begin
	if public._deja_fait(p_evenement) then return; end if;
	select * into ind from public.indicateurs where id = p_indicateur and archive_le is null;
	if not found then raise exception 'Indicateur introuvable.' using errcode = 'P0001'; end if;
	p := public._exiger_saisie(ind.volet, p_mois);

	foreach x in array array[f, fi, h, g, t] loop
		if x is not null and x < 0 then
			raise exception 'Saisissez des nombres positifs ou laissez la case vide.' using errcode = 'P0001';
		end if;
		if x is not null and ind.type_valeur = 'nombre' and x <> trunc(x) then
			raise exception 'Saisissez des nombres entiers (pas de décimales pour un nombre de personnes ou d’unités).' using errcode = 'P0001';
		end if;
	end loop;
	if ind.type_valeur = 'pourcentage' and t > 100 then
		raise exception 'Un pourcentage ne peut pas dépasser 100.' using errcode = 'P0001';
	end if;
	if ind.desagrege then
		t := case when num_nonnulls(f, fi, h, g) = 0 then null else coalesce(f, 0) + coalesce(fi, 0) + coalesce(h, 0) + coalesce(g, 0) end;
	else
		f := null; fi := null; h := null; g := null;
	end if;

	select * into prec from public.valeurs where indicateur_id = ind.id and mois = p_mois and courante for update;
	a_prec := found;
	if a_prec and (prec.femmes, prec.filles, prec.hommes, prec.garcons, prec.total) is not distinct from (f, fi, h, g, t)
		and prec.commentaire is not distinct from com then
		return; -- rien de nouveau
	end if;
	if a_prec then update public.valeurs set courante = false where id = prec.id; end if;
	insert into public.valeurs (id, indicateur_id, volet, mois, femmes, filles, hommes, garcons, total, commentaire, version, courante, auteur)
	values (coalesce(p_id, gen_random_uuid()::text), ind.id, ind.volet, p_mois, f, fi, h, g, t, com,
		case when a_prec then prec.version + 1 else 1 end, true, p.id);

	perform public._journaliser(p_evenement, p, 'valeur_modifiee', ind.volet, p_mois, 'indicateur', ind.id, ind.libelle, 'a modifié',
		case when a_prec then public._desagregation(prec.femmes, prec.filles, prec.hommes, prec.garcons, prec.total) end,
		public._desagregation(f, fi, h, g, t));
end;
$$;

-- ---------- Activités : avancement, dépenses ----------

create function public.enregistrer_avancement(
	p_evenement text, p_id text, p_activite text, p_mois text,
	p_taux numeric, p_resultats text, p_observations text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	a public.activites := public._activite(p_activite);
	p public.profils;
	prec public.avancements;
	a_prec boolean;
	res text := coalesce(p_resultats, '');
	obs text := coalesce(p_observations, '');
begin
	if public._deja_fait(p_evenement) then return; end if;
	p := public._exiger_saisie(a.volet, p_mois);
	if p_taux is not null and (p_taux < 0 or p_taux > 100) then
		raise exception 'Le taux d’exécution est compris entre 0 et 100 %%.' using errcode = 'P0001';
	end if;
	select * into prec from public.avancements where activite_id = a.id and mois = p_mois and courante for update;
	a_prec := found;
	if a_prec and prec.taux_execution is not distinct from p_taux and prec.resultats = res and prec.observations = obs then
		return;
	end if;
	if a_prec then update public.avancements set courante = false where id = prec.id; end if;
	insert into public.avancements (id, activite_id, volet, mois, taux_execution, resultats, observations, version, courante, auteur)
	values (coalesce(p_id, gen_random_uuid()::text), a.id, a.volet, p_mois, p_taux, res, obs,
		case when a_prec then prec.version + 1 else 1 end, true, p.id);
	perform public._journaliser(p_evenement, p, 'avancement_modifie', a.volet, p_mois, 'activite', a.id, public._libelle_activite(a),
		'a mis à jour l’avancement de',
		case when a_prec then jsonb_build_object('taux', prec.taux_execution) end,
		jsonb_build_object('taux', p_taux));
end;
$$;

create function public.ajouter_depense(
	p_evenement text, p_id text, p_activite text, p_mois text, p_montant numeric, p_libelle text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	a public.activites := public._activite(p_activite);
	p public.profils;
	lib text := trim(coalesce(p_libelle, ''));
	id_dep text := coalesce(p_id, gen_random_uuid()::text);
begin
	if public._deja_fait(p_evenement) then return; end if;
	p := public._exiger_saisie(a.volet, p_mois);
	if p_montant is null or p_montant <= 0 then
		raise exception 'Le montant doit être un nombre positif.' using errcode = 'P0001';
	end if;
	if lib = '' then
		raise exception 'Décrivez la dépense (exemple : « Achat de kits d’hygiène »).' using errcode = 'P0001';
	end if;
	insert into public.depenses (id, activite_id, volet, mois, montant, libelle, auteur)
	values (id_dep, a.id, a.volet, p_mois, p_montant, lib, p.id);
	perform public._journaliser(p_evenement, p, 'depense_ajoutee', a.volet, p_mois, 'depense', id_dep,
		lib || ' (' || a.numero || ')', 'a ajouté une dépense :', null, jsonb_build_object('montant', p_montant));
end;
$$;

-- ---------- Structure : activités, tâches, calendrier ----------

create function public.ajouter_activite(
	p_evenement text, p_id text, p_output text, p_libelle text, p_budget numeric, p_responsable text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	o public.outputs;
	v public.volets;
	lib text := trim(coalesce(p_libelle, ''));
	num text;
	id_act text := coalesce(p_id, gen_random_uuid()::text);
begin
	if public._deja_fait(p_evenement) then return; end if;
	select * into o from public.outputs where id = p_output;
	if not found then raise exception 'Output introuvable.' using errcode = 'P0001'; end if;
	v := public._volet(o.volet);
	if not public._peut_modifier_structure(p, v) then
		if v.cadre_verrouille and public._peut_ecrire_volet(p, v) then
			raise exception 'Le cadre logique de ce volet est verrouillé par APSUD : demandez un déverrouillage.' using errcode = '42501';
		end if;
		raise exception 'Vous ne pouvez pas modifier ce volet.' using errcode = '42501';
	end if;
	if lib = '' then raise exception 'Donnez un intitulé à l’activité.' using errcode = 'P0001'; end if;
	perform 1 from public.outputs where id = o.id for update; -- numérotation sans collision
	select o.numero || '.' || (count(*) + 1) into num from public.activites where output_id = o.id;
	insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie, cree_par)
	values (id_act, v.code, o.id, num, lib, nullif(trim(coalesce(p_responsable, '')), ''), greatest(coalesce(p_budget, 0), 0), p.id);
	perform public._journaliser(p_evenement, p, 'activite_creee', v.code, null, 'activite', id_act, num || ' ' || lib, 'a créé l’activité');
end;
$$;

create function public.ajouter_tache(
	p_evenement text, p_id text, p_activite text, p_libelle text, p_responsable text, p_date_debut date, p_date_fin date
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	a public.activites := public._activite(p_activite);
	lib text := trim(coalesce(p_libelle, ''));
	id_t text := coalesce(p_id, gen_random_uuid()::text);
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._peut_ecrire_volet(p, public._volet(a.volet)) then
		raise exception 'Vous ne pouvez pas modifier ce volet.' using errcode = '42501';
	end if;
	if lib = '' then raise exception 'Décrivez la tâche (« Action à prendre »).' using errcode = 'P0001'; end if;
	if p_date_debut is not null and p_date_fin is not null and p_date_fin < p_date_debut then
		raise exception 'La date de fin doit suivre la date de début.' using errcode = 'P0001';
	end if;
	insert into public.taches (id, volet, activite_id, libelle, responsable, date_debut, date_fin, ordre, cree_par)
	values (id_t, a.volet, a.id, lib, nullif(trim(coalesce(p_responsable, '')), ''), p_date_debut, p_date_fin,
		(select coalesce(max(ordre), 0) + 1 from public.taches where activite_id = a.id), p.id);
	perform public._journaliser(p_evenement, p, 'tache_creee', a.volet, null, 'tache', id_t, lib, 'a ajouté la tâche');
end;
$$;

/**
 * Coche ou décoche une semaine du calendrier S1-S5. L'appareil envoie l'état voulu
 * (et non « inverser ») : rejouer l'appel donne le même résultat.
 */
create function public.definir_semaine(
	p_evenement text, p_tache text, p_mois text, p_semaine smallint, p_champ text, p_valeur boolean
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	t public.taches;
begin
	if public._deja_fait(p_evenement) then return; end if;
	if p_champ not in ('prevu', 'realise') then raise exception 'Champ inconnu : %.', p_champ using errcode = 'P0001'; end if;
	select * into t from public.taches where id = p_tache;
	if not found then raise exception 'Tâche introuvable.' using errcode = 'P0001'; end if;
	if not public._peut_ecrire_volet(p, public._volet(t.volet)) then
		raise exception 'Vous ne pouvez pas modifier ce calendrier.' using errcode = '42501';
	end if;
	insert into public.taches_semaines (tache_id, mois, semaine, prevu, realise)
	values (t.id, p_mois, p_semaine, p_valeur, p_champ = 'realise' and p_valeur) -- réalisé implique prévu
	on conflict (tache_id, mois, semaine) do update set
		prevu = case when p_champ = 'prevu' then p_valeur when p_valeur then true else public.taches_semaines.prevu end,
		realise = case when p_champ = 'realise' then p_valeur else public.taches_semaines.realise end;
	perform public._journaliser(p_evenement, p, 'semaine_cochee', t.volet, p_mois, 'tache', t.id, t.libelle,
		format('a %s S%s (%s) pour', case when p_valeur then 'coché' else 'décoché' end, p_semaine,
			case when p_champ = 'prevu' then 'prévu' else 'réalisé' end));
end;
$$;

-- ---------- Justificatifs ----------

create function public.ajouter_justificatif(
	p_evenement text, p_id text, p_volet text, p_mois text,
	p_rattachement_type text, p_rattachement_id text,
	p_nom_fichier text, p_type_mime text, p_taille bigint, p_moyen text, p_chemin text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils;
	id_j text := coalesce(p_id, gen_random_uuid()::text);
	nom text := trim(coalesce(p_nom_fichier, ''));
begin
	if public._deja_fait(p_evenement) then return; end if;
	p := public._exiger_saisie(p_volet, p_mois);
	if nom = '' then raise exception 'Le fichier n’a pas de nom.' using errcode = 'P0001'; end if;
	insert into public.justificatifs (id, volet, mois, rattachement_type, rattachement_id, nom_fichier, type_mime, taille, chemin_stockage, moyen_verification, auteur)
	values (id_j, p_volet, p_mois, p_rattachement_type, p_rattachement_id, nom,
		coalesce(nullif(p_type_mime, ''), 'application/octet-stream'), greatest(coalesce(p_taille, 0), 0),
		nullif(p_chemin, ''), nullif(trim(coalesce(p_moyen, '')), ''), p.id);
	perform public._journaliser(p_evenement, p, 'justificatif_ajoute', p_volet, p_mois, 'justificatif', id_j, nom, 'a ajouté le justificatif');
end;
$$;

-- ---------- 5W du cluster WASH ----------

create function public.enregistrer_fiche_5w(p_evenement text, p_activite text, p_fiche jsonb) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	a public.activites := public._activite(p_activite);
	fiche jsonb;
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._peut_ecrire_volet(p, public._volet(a.volet)) then
		raise exception 'Seules l’ONG du volet et la coordination APSUD peuvent modifier la fiche 5W.' using errcode = '42501';
	end if;
	if coalesce(p_fiche ->> 'activite_cluster', '') = '' then
		raise exception 'Choisissez l’activité standard du cluster qui correspond à cette activité.' using errcode = 'P0001';
	end if;
	if coalesce(p_fiche ->> 'modalite', '') = '' or coalesce(p_fiche ->> 'type_beneficiaire', '') = '' or coalesce(p_fiche ->> 'reponse', '') = '' then
		raise exception 'Renseignez la modalité, le type de bénéficiaire et le type de réponse.' using errcode = 'P0001';
	end if;
	fiche := jsonb_build_object(
		'activite_cluster', p_fiche ->> 'activite_cluster',
		'modalite', p_fiche ->> 'modalite',
		'type_beneficiaire', p_fiche ->> 'type_beneficiaire',
		'reponse', p_fiche ->> 'reponse',
		'partenaires', nullif(trim(coalesce(p_fiche ->> 'partenaires', '')), '')
	);
	update public.activites set fiche_5w = fiche where id = a.id;
	perform public._journaliser(p_evenement, p, 'fiche_5w_modifiee', a.volet, null, 'activite', a.id, public._libelle_activite(a),
		'a mis à jour la fiche 5W de', a.fiche_5w, fiche);
end;
$$;

/** Contrôles d'une ligne 5W (depot.svelte.ts › #controlerLigne5W). */
create function public._controler_ligne_5w(l public.lignes_5w) returns void
	language plpgsql immutable set search_path = ''
as $$
begin
	if coalesce(l.sous_prefecture, '') = '' or coalesce(l.prefecture, '') = '' then
		raise exception 'Choisissez la sous-préfecture : le cluster demande une ligne par sous-préfecture.' using errcode = 'P0001';
	end if;
	if l.date_debut is not null and l.date_fin is not null and l.date_fin < l.date_debut then
		raise exception 'La date de fin doit suivre la date de début.' using errcode = 'P0001';
	end if;
	if num_nonnulls(l.filles, l.garcons, l.femmes, l.hommes) = 0 then
		raise exception 'Le cluster ne retient que les lignes avec des personnes atteintes : renseignez Filles, Garçons, Femmes ou Hommes.' using errcode = 'P0001';
	end if;
end;
$$;

create function public.ajouter_ligne_5w(p_evenement text, p_id text, p_activite text, p_mois text, p_champs jsonb) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	a public.activites := public._activite(p_activite);
	p public.profils;
	l public.lignes_5w;
begin
	if public._deja_fait(p_evenement) then return; end if;
	p := public._exiger_saisie(a.volet, p_mois);
	if a.fiche_5w is null then
		raise exception 'Complétez d’abord la fiche 5W de l’activité (activité standard, modalité, bénéficiaires).' using errcode = 'P0001';
	end if;
	l := jsonb_populate_record(null::public.lignes_5w, p_champs);
	l.id := coalesce(p_id, gen_random_uuid()::text);
	l.volet := a.volet; l.activite_id := a.id; l.mois := p_mois; l.auteur := p.id; l.date := now(); l.archive_le := null;
	l.statut := coalesce(nullif(l.statut, ''), 'En cours');
	perform public._controler_ligne_5w(l);
	insert into public.lignes_5w select l.*;
	perform public._journaliser(p_evenement, p, 'ligne_5w_ajoutee', a.volet, p_mois, 'activite', a.id,
		a.numero || ', ' || l.sous_prefecture, 'a ajouté une ligne 5W :');
end;
$$;

create function public.modifier_ligne_5w(p_evenement text, p_id text, p_champs jsonb) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	avant public.lignes_5w;
	l public.lignes_5w;
	p public.profils;
	a public.activites;
begin
	if public._deja_fait(p_evenement) then return; end if;
	select * into avant from public.lignes_5w where id = p_id;
	if not found then raise exception 'Ligne 5W introuvable.' using errcode = 'P0001'; end if;
	p := public._exiger_saisie(avant.volet, avant.mois);
	l := jsonb_populate_record(avant, p_champs - array['id', 'volet', 'activite_id', 'mois', 'auteur', 'date', 'archive_le']);
	l.auteur := p.id; l.date := now();
	perform public._controler_ligne_5w(l);
	update public.lignes_5w set
		prefecture = l.prefecture, sous_prefecture = l.sous_prefecture, commune = l.commune, village = l.village,
		latitude = l.latitude, longitude = l.longitude,
		quantite_prevue = l.quantite_prevue, quantite_realisee = l.quantite_realisee, personnes_ciblees = l.personnes_ciblees,
		filles = l.filles, garcons = l.garcons, femmes = l.femmes, hommes = l.hommes,
		date_debut = l.date_debut, date_fin = l.date_fin, statut = l.statut, commentaire = l.commentaire,
		auteur = l.auteur, date = l.date
	where id = p_id;
	a := public._activite(avant.activite_id);
	perform public._journaliser(p_evenement, p, 'ligne_5w_modifiee', avant.volet, avant.mois, 'activite', a.id,
		a.numero || ', ' || l.sous_prefecture, 'a modifié une ligne 5W :', to_jsonb(avant), to_jsonb(l));
end;
$$;

-- ---------- Circuit de validation (ARCHITECTURE.md §6) ----------

create function public.changer_statut_rapport(p_evenement text, p_volet text, p_mois text, p_vers text, p_motif text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	v public.volets := public._volet(p_volet);
	r public.rapports;
	depart text;
	permis boolean := false;
	motif_requis boolean := false;
	v_motif text := nullif(trim(coalesce(p_motif, '')), '');
	type_ev text;
	resume text;
	nb_cibles int;
	nb_saisis int;
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not exists (select 1 from public.periodes where mois = p_mois) then
		raise exception 'Le mois % ne fait pas partie du projet.', p_mois using errcode = 'P0001';
	end if;
	insert into public.rapports (id, volet, mois) values (p_volet || ':' || p_mois, p_volet, p_mois) on conflict (volet, mois) do nothing;
	select * into r from public.rapports where volet = p_volet and mois = p_mois for update;
	depart := r.statut;

	-- regles.ts › transitionsPossibles
	if depart in ('non_commence', 'brouillon', 'a_corriger') and p_vers = 'soumis' then
		permis := public._peut_ecrire_volet(p, v);
	elsif depart = 'soumis' and p_vers in ('valide', 'a_corriger') then
		permis := public._est_coordination(p); motif_requis := p_vers = 'a_corriger';
	elsif depart = 'valide' and p_vers in ('verrouille', 'a_corriger') then
		permis := public._est_coordination(p); motif_requis := p_vers = 'a_corriger';
	elsif depart = 'verrouille' and p_vers = 'valide' then
		permis := public._est_coordination(p); motif_requis := true;
	end if;
	if not permis then
		raise exception 'Action impossible : ce rapport (%) ne peut pas passer à « % » avec votre rôle.', depart, p_vers using errcode = '42501';
	end if;
	if motif_requis and v_motif is null then
		raise exception 'Indiquez le motif : il sera visible par l’ONG et inscrit au journal.' using errcode = 'P0001';
	end if;
	if p_vers = 'soumis' then
		select count(*) into nb_cibles from public.indicateurs i where i.volet = p_volet and i.archive_le is null and coalesce(i.cible_total, 0) <> 0;
		select count(*) into nb_saisis from public.indicateurs i
			join public.valeurs va on va.indicateur_id = i.id and va.mois = p_mois and va.courante
			where i.volet = p_volet and i.archive_le is null and coalesce(i.cible_total, 0) <> 0;
		if nb_cibles > 0 and nb_saisis = 0 then
			raise exception 'Le rapport est vide : saisissez au moins un indicateur avant de le soumettre.' using errcode = 'P0001';
		end if;
		update public.rapports set statut = 'soumis', soumis_par = p.id, soumis_le = now(), motif = null where id = r.id;
	else
		update public.rapports set statut = p_vers, decision_par = p.id, decision_le = now(), motif = v_motif where id = r.id;
	end if;

	type_ev := case p_vers
		when 'soumis' then 'rapport_soumis'
		when 'valide' then case when depart = 'verrouille' then 'rapport_deverrouille' else 'rapport_valide' end
		when 'a_corriger' then 'rapport_a_corriger'
		when 'verrouille' then 'rapport_verrouille' end;
	resume := case p_vers
		when 'soumis' then 'a soumis le rapport'
		when 'valide' then case when depart = 'verrouille' then 'a déverrouillé le rapport' else 'a validé le rapport' end
		when 'a_corriger' then 'a renvoyé pour correction le rapport'
		when 'verrouille' then 'a verrouillé le rapport' end;
	perform public._journaliser(p_evenement, p, type_ev, p_volet, p_mois, 'rapport', r.id, p_volet || ', ' || p_mois, resume,
		to_jsonb(depart), to_jsonb(p_vers));
end;
$$;

create function public.definir_verrou_cadre(p_evenement text, p_volet text, p_verrouille boolean) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	v public.volets := public._volet(p_volet);
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._est_coordination(p) then
		raise exception 'Seule la coordination APSUD verrouille un cadre logique.' using errcode = '42501';
	end if;
	if v.cadre_verrouille = p_verrouille then return; end if;
	update public.volets set cadre_verrouille = p_verrouille where code = v.code;
	perform public._journaliser(p_evenement, p, case when p_verrouille then 'cadre_verrouille' else 'cadre_deverrouille' end,
		v.code, null, 'volet', v.code, 'cadre logique ' || v.code,
		case when p_verrouille then 'a verrouillé le' else 'a déverrouillé le' end);
end;
$$;

-- ---------- Archivage, restauration, suppression définitive ----------

create function public._table_archivable(p_type text) returns text
	language plpgsql immutable set search_path = ''
as $$
begin
	return case p_type
		when 'activite' then 'activites'
		when 'tache' then 'taches'
		when 'indicateur' then 'indicateurs'
		when 'depense' then 'depenses'
		when 'justificatif' then 'justificatifs'
		when 'ligne_5w' then 'lignes_5w'
	end;
end;
$$;

create function public._element(p_type text, p_id text) returns jsonb
	language plpgsql stable security definer set search_path = ''
as $$
declare
	nom_table text := public._table_archivable(p_type);
	e jsonb;
begin
	if nom_table is null then raise exception 'Type d’élément inconnu : %.', p_type using errcode = 'P0001'; end if;
	execute format('select to_jsonb(t) from public.%I t where t.id = $1', nom_table) into e using p_id;
	if e is null then raise exception 'Élément introuvable.' using errcode = 'P0001'; end if;
	return e;
end;
$$;

create function public._libelle_element(e jsonb) returns text
	language sql immutable set search_path = ''
as $$
	select coalesce(e ->> 'libelle', e ->> 'nom_fichier',
		case when e ? 'sous_prefecture' then 'ligne 5W, ' || (e ->> 'sous_prefecture') end, e ->> 'id')
$$;

create function public.archiver(p_evenement text, p_type text, p_id text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	e jsonb := public._element(p_type, p_id);
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._peut_ecrire_volet(p, public._volet(e ->> 'volet')) then
		raise exception 'Vous ne pouvez archiver que les éléments de votre organisation.' using errcode = '42501';
	end if;
	execute format('update public.%I set archive_le = now() where id = $1 and archive_le is null', public._table_archivable(p_type)) using p_id;
	perform public._journaliser(p_evenement, p, 'element_archive', e ->> 'volet', null, p_type, p_id, public._libelle_element(e), 'a archivé');
end;
$$;

create function public.restaurer(p_evenement text, p_type text, p_id text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	e jsonb := public._element(p_type, p_id);
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._est_coordination(p) then
		raise exception 'Seule la coordination APSUD restaure un élément archivé.' using errcode = '42501';
	end if;
	execute format('update public.%I set archive_le = null where id = $1', public._table_archivable(p_type)) using p_id;
	perform public._journaliser(p_evenement, p, 'element_restaure', e ->> 'volet', null, p_type, p_id, public._libelle_element(e), 'a restauré');
end;
$$;

/** Suppression définitive : super-administrateur uniquement, et toujours journalisée (avec la ligne supprimée). */
create function public.supprimer_definitivement(p_evenement text, p_type text, p_id text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	e jsonb;
begin
	if public._deja_fait(p_evenement) then return; end if;
	if p.role <> 'super_admin' then
		raise exception 'Suppression refusée : seul le super-administrateur peut supprimer définitivement. Utilisez « Archiver ».' using errcode = '42501';
	end if;
	e := public._element(p_type, p_id);
	perform public._journaliser(p_evenement, p, 'element_supprime', e ->> 'volet', null, p_type, p_id, public._libelle_element(e),
		'a supprimé définitivement', e, null);
	execute format('delete from public.%I where id = $1', public._table_archivable(p_type)) using p_id;
end;
$$;

-- ---------- Notifications ----------

/** Marque comme lues ses propres notifications (toutes, ou celles d'un événement). */
create function public.marquer_lu(p_evenement_id text default null) returns void
	language plpgsql security definer set search_path = ''
as $$
begin
	perform public._moi();
	update public.notifications set lue = true
	where destinataire = auth.uid() and not lue and (p_evenement_id is null or evenement_id = p_evenement_id);
end;
$$;

-- ---------- Comptes et invitations ----------

/**
 * Crée une invitation et renvoie le code (affiché une seule fois, à transmettre à la personne).
 * Coordination : comptes de saisie et de lecture. Super-administrateur : tous les rôles.
 */
create function public.creer_invitation(p_email text, p_nom text, p_fonction text, p_organisation text, p_role text) returns text
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	adresse text := lower(trim(coalesce(p_email, '')));
	code text := public._nouveau_code();
begin
	if not public._est_coordination(p) then
		raise exception 'Seule la coordination APSUD invite de nouvelles personnes.' using errcode = '42501';
	end if;
	if p_role in ('coordination', 'super_admin') and p.role <> 'super_admin' then
		raise exception 'Seul le super-administrateur crée un compte de coordination ou d’administration.' using errcode = '42501';
	end if;
	if adresse !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
		raise exception 'Saisissez une adresse e-mail valide.' using errcode = 'P0001';
	end if;
	if exists (select 1 from auth.users u where lower(u.email) = adresse) then
		raise exception 'Cette adresse a déjà un compte.' using errcode = 'P0001';
	end if;
	update public.invitations set archive_le = now() where email = adresse and utilisee_le is null and archive_le is null;
	insert into public.invitations (code_hache, email, nom, fonction, organisation, role, cree_par)
	values (public._hacher_code(code), adresse, trim(coalesce(p_nom, '')), trim(coalesce(p_fonction, '')), p_organisation, p_role, p.id);
	return code;
end;
$$;

/** Vérifie un code avant l'inscription (appelable sans compte) ; ne révèle rien si le code est faux. */
create function public.verifier_invitation(p_code text, p_email text)
	returns table (nom text, fonction text, organisation text, role text)
	language sql stable security definer set search_path = ''
as $$
	select i.nom, i.fonction, i.organisation, i.role
	from public.invitations i
	where i.code_hache = public._hacher_code(p_code)
		and i.email = lower(trim(coalesce(p_email, '')))
		and i.utilisee_le is null and i.archive_le is null and i.expire_le > now()
$$;

/** Super-administrateur : change le rôle d'un compte ou le désactive (jamais de suppression). */
create function public.modifier_compte(p_profil uuid, p_role text, p_actif boolean) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
begin
	if p.role <> 'super_admin' then
		raise exception 'Seul le super-administrateur gère les comptes.' using errcode = '42501';
	end if;
	if p_profil = p.id and (p_role <> 'super_admin' or not p_actif) then
		raise exception 'Vous ne pouvez pas retirer vos propres droits d’administration.' using errcode = 'P0001';
	end if;
	update public.profils set role = coalesce(p_role, role), actif = coalesce(p_actif, actif) where id = p_profil;
	if not found then raise exception 'Compte introuvable.' using errcode = 'P0001'; end if;
end;
$$;

/**
 * Amorçage : crée l'invitation du premier super-administrateur et renvoie son code.
 * À exécuter UNE fois dans l'éditeur SQL de Supabase ; refusé dès qu'un super-administrateur existe.
 * Aucun compte de l'application ne peut l'appeler (droits retirés en 0005).
 */
create function public.amorcer_super_admin(p_email text, p_nom text) returns text
	language plpgsql security definer set search_path = ''
as $$
declare
	code text := public._nouveau_code();
begin
	if exists (select 1 from public.profils where role = 'super_admin') then
		raise exception 'Un super-administrateur existe déjà : utilisez l’écran Administration pour inviter.' using errcode = 'P0001';
	end if;
	update public.invitations set archive_le = now() where email = lower(trim(p_email)) and utilisee_le is null and archive_le is null;
	insert into public.invitations (code_hache, email, nom, fonction, organisation, role)
	values (public._hacher_code(code), lower(trim(p_email)), trim(p_nom), 'Administration de la plateforme', 'APSUD', 'super_admin');
	return code;
end;
$$;
