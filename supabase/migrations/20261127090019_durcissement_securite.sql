-- =============================================================================
-- 0019 · Durcissement de la sécurité (audit du 2026-11-27, demande du développeur)
--   1. Anti-remplissage de la base gratuite (500 Mo) : quota de mesures d'utilisation,
--      dates bornées, limite d'actions par minute, longueur des textes saisis.
--   2. Nombres invalides refusés : NaN et infini faussaient les cumuls du consortium.
--   3. Archivage et calendrier : plus de modification d'un rapport soumis, validé ou
--      verrouillé, ni du cadre logique verrouillé, par ce détour.
--   4. Alertes push : seules les adresses des services de push connus sont acceptées
--      (pas d'appel de la fonction Edge vers une adresse choisie par l'attaquant),
--      10 appareils au plus par compte.
--   5. Droits : aucune écriture directe ni lecture anonyme sur aucune table ; les
--      fonctions internes (préfixe _) ne sont appelables par aucun rôle de l'application ;
--      les fonctions futures ne sont plus ouvertes à tous par défaut.
--   6. Bucket « logos » : plus de liste anonyme de son contenu (les images restent
--      publiques par leur adresse).
-- Les contraintes sont posées NOT VALID : elles s'appliquent à toute nouvelle écriture
-- sans bloquer la migration sur une ligne ancienne.
-- =============================================================================

-- ---------- 1. Longueur des textes saisis ----------

alter table public.activites add constraint activites_longueurs
	check (length(libelle) <= 1000 and coalesce(length(responsable), 0) <= 200) not valid;
alter table public.taches add constraint taches_longueurs
	check (length(libelle) <= 500 and coalesce(length(responsable), 0) <= 200) not valid;
alter table public.valeurs add constraint valeurs_longueurs
	check (coalesce(length(commentaire), 0) <= 2000) not valid;
alter table public.avancements add constraint avancements_longueurs
	check (length(resultats) <= 5000 and length(observations) <= 5000) not valid;
alter table public.depenses add constraint depenses_longueurs
	check (length(libelle) <= 500) not valid;
alter table public.justificatifs add constraint justificatifs_longueurs
	check (length(nom_fichier) <= 255 and length(type_mime) <= 150 and length(rattachement_id) <= 100
		and coalesce(length(chemin_stockage), 0) <= 500 and coalesce(length(moyen_verification), 0) <= 500
		and taille <= 52428800) not valid;
alter table public.lignes_5w add constraint lignes_5w_longueurs
	check (length(prefecture) <= 200 and length(sous_prefecture) <= 200 and coalesce(length(commune), 0) <= 200
		and coalesce(length(village), 0) <= 200 and length(statut) <= 100 and coalesce(length(commentaire), 0) <= 2000) not valid;
-- L'identifiant d'événement est fourni par l'appareil (rejeu) : borné lui aussi.
alter table public.journal add constraint journal_id_longueur check (length(id) <= 64) not valid;

-- ---------- 2. Nombres finis seulement ----------
-- Dans PostgreSQL, NaN est plus grand que tout nombre : « < 1e12 » refuse NaN et l'infini.

alter table public.valeurs add constraint valeurs_nombres_finis
	check (coalesce(total, 0) < 1e12 and coalesce(femmes, 0) < 1e12 and coalesce(filles, 0) < 1e12
		and coalesce(hommes, 0) < 1e12 and coalesce(garcons, 0) < 1e12) not valid;
alter table public.depenses add constraint depenses_nombre_fini check (montant < 1e12) not valid;
alter table public.activites add constraint activites_budget_fini check (budget_planifie < 1e12) not valid;
alter table public.indicateurs add constraint indicateurs_cibles_finies
	check (coalesce(cible_total, 0) < 1e12 and coalesce(cible_femmes, 0) < 1e12 and coalesce(cible_filles, 0) < 1e12
		and coalesce(cible_hommes, 0) < 1e12 and coalesce(cible_garcons, 0) < 1e12) not valid;

-- ---------- 1 bis. Limite d'actions par minute ----------
-- Chaque action passe par le fil d'activité : au-delà de 200 actions en une minute pour un
-- même compte, l'action est refusée (protège la base, les notifications et les alertes).

create index if not exists journal_auteur_date on public.journal (auteur, date desc);

create function public._limiter_debit_journal() returns trigger
	language plpgsql security definer set search_path = ''
as $$
begin
	if (select count(*) from public.journal where auteur = new.auteur and date > now() - interval '1 minute') >= 200 then
		raise exception 'Trop d’actions en peu de temps : patientez une minute.' using errcode = '54000';
	end if;
	return new;
end;
$$;
create trigger journal_limite_debit before insert on public.journal
	for each row execute function public._limiter_debit_journal();

-- ---------- 1 ter. Mesure d'utilisation : quota et dates bornées ----------

create or replace function public.enregistrer_analytique(p_session text, p_evenements jsonb) returns integer
	language plpgsql security definer set search_path = ''
as $$
declare
	moi public.profils := public._moi();
	e jsonb;
	n integer := 0;
	d timestamptz;
begin
	if not exists (select 1 from public.consentements where utilisateur = moi.id and analytique) then
		raise exception 'Mesure d’utilisation refusée : pas de consentement.' using errcode = '42501';
	end if;
	if jsonb_typeof(p_evenements) <> 'array' or jsonb_array_length(p_evenements) > 100 then raise exception 'Lot invalide (100 événements au plus).'; end if;
	-- Quota : 3 000 mesures par compte et par 24 heures (un usage normal en produit quelques centaines).
	if (select count(*) from public.analytique_evenements where utilisateur = moi.id and date > now() - interval '1 day')
		+ jsonb_array_length(p_evenements) > 3000 then
		return 0; -- au-delà, les mesures sont ignorées sans erreur (l'appareil ne réessaie pas en boucle)
	end if;
	for e in select * from jsonb_array_elements(p_evenements) loop
		begin
			d := (e ->> 'date')::timestamptz;
		exception when others then
			d := null;
		end;
		insert into public.analytique_evenements (utilisateur, organisation, role, session, type, page, cible, donnees, date)
		values (moi.id, moi.organisation, moi.role, left(p_session, 64), e ->> 'type', left(e ->> 'page', 300), left(e ->> 'cible', 200),
			case when jsonb_typeof(e -> 'donnees') = 'object' and pg_column_size(e -> 'donnees') <= 2000 then e -> 'donnees' else null end,
			-- ni dans le futur, ni plus d'un jour en arrière (sinon une mesure pourrait se cacher hors des analyses)
			greatest(now() - interval '1 day', least(now(), coalesce(d, now()))));
		n := n + 1;
	end loop;
	return n;
end;
$$;

-- ---------- 3. Archivage : mêmes verrous que la saisie ----------

create or replace function public.archiver(p_evenement text, p_type text, p_id text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	e jsonb := public._element(p_type, p_id);
	v public.volets := public._volet(e ->> 'volet');
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._peut_ecrire_volet(p, v) then
		raise exception 'Vous ne pouvez archiver que les éléments de votre organisation.' using errcode = '42501';
	end if;
	-- Cadre logique verrouillé : une activité ou un indicateur ne sort pas par l'archivage.
	if p_type in ('activite', 'indicateur') and not public._peut_modifier_structure(p, v) then
		raise exception 'Le cadre logique de ce volet est verrouillé par la coordination APSUD.' using errcode = '42501';
	end if;
	-- Élément d'un mois dont le rapport est soumis, validé ou verrouillé : réouverture d'abord.
	if e ? 'mois' and exists (
		select 1 from public.rapports r
		where r.volet = e ->> 'volet' and r.mois = e ->> 'mois' and r.statut not in ('non_commence', 'brouillon', 'a_corriger')
	) then
		raise exception 'Ce rapport est soumis, validé ou verrouillé : demandez une réouverture à la coordination APSUD.' using errcode = 'P0001';
	end if;
	execute format('update public.%I set archive_le = now() where id = $1 and archive_le is null', public._table_archivable(p_type)) using p_id;
	perform public._journaliser(p_evenement, p, 'element_archive', e ->> 'volet', null, p_type, p_id, public._libelle_element(e), 'a archivé');
end;
$$;

-- ---------- 3 bis. Calendrier S1-S5 : pas de retouche d'un mois soumis ou validé ----------

create or replace function public.definir_semaine(
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
	if not exists (select 1 from public.periodes where mois = p_mois) then
		raise exception 'Le mois % ne fait pas partie du projet.', p_mois using errcode = 'P0001';
	end if;
	if exists (
		select 1 from public.rapports r
		where r.volet = t.volet and r.mois = p_mois and r.statut not in ('non_commence', 'brouillon', 'a_corriger')
	) then
		raise exception 'Ce rapport est soumis, validé ou verrouillé : demandez une réouverture à la coordination APSUD.' using errcode = 'P0001';
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

-- ---------- 4. Alertes push : services connus, 10 appareils par compte ----------

create function public._endpoint_push_valide(p text) returns boolean
	language sql immutable set search_path = ''
as $$
	select coalesce(length(p) <= 1000 and p ~ ('^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com'
		|| '|[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.apple\.com)/'), false)
$$;

create or replace function public.enregistrer_abonnement_push(p_endpoint text, p_p256dh text, p_auth text, p_appareil text default null) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	moi public.profils;
begin
	select * into moi from public.profils where id = auth.uid() and actif;
	if moi.id is null then raise exception 'Compte inconnu ou désactivé.'; end if;
	if not public._endpoint_push_valide(p_endpoint) then raise exception 'Adresse d’abonnement invalide.'; end if;
	if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_=-]{20,200}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_=-]{8,100}$' then
		raise exception 'Clés d’abonnement invalides.';
	end if;
	insert into public.abonnements_push (utilisateur, endpoint, p256dh, auth, appareil)
	values (moi.id, p_endpoint, p_p256dh, p_auth, left(p_appareil, 200))
	on conflict (endpoint) do update
		set utilisateur = excluded.utilisateur, p256dh = excluded.p256dh, auth = excluded.auth, appareil = excluded.appareil, cree_le = now();
	-- 10 appareils au plus : les plus anciens sont retirés.
	delete from public.abonnements_push
	where utilisateur = moi.id
		and id not in (select id from public.abonnements_push where utilisateur = moi.id order by cree_le desc limit 10);
end;
$$;

-- Abonnements déjà enregistrés vers une adresse inconnue : retirés.
delete from public.abonnements_push where not public._endpoint_push_valide(endpoint);
alter table public.abonnements_push add constraint abonnements_push_endpoint_connu
	check (public._endpoint_push_valide(endpoint)) not valid;

-- ---------- 5. Droits ----------

-- Aucune écriture directe, pour aucun rôle de l'application (les fonctions écrivent) ; rien pour anon.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke select on all tables in schema public from anon;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public revoke select on tables from anon;

-- PostgreSQL ouvre toute nouvelle fonction à PUBLIC : ce réglage global (sans « in schema »)
-- est le seul qui l'empêche. Les fonctions futures devront être ouvertes explicitement.
alter default privileges revoke execute on functions from public;

do $$
declare
	f record;
begin
	for f in
		select p.oid::regprocedure as sig, p.proname as nom, p.prorettype = 'trigger'::regtype as declencheur
		from pg_proc p join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public'
	loop
		execute format('revoke execute on function %s from public, anon', f.sig);
		if f.nom like '\_%' or f.declencheur or f.nom = 'amorcer_super_admin' then
			-- fonctions internes, déclencheurs, amorçage : aucun rôle de l'application
			execute format('revoke execute on function %s from authenticated', f.sig);
		else
			-- fonctions de l'application : comptes connectés seulement (elles refont leurs contrôles)
			execute format('grant execute on function %s to authenticated', f.sig);
		end if;
	end loop;
end;
$$;
-- Seule fonction ouverte sans compte : vérifier son code avant de créer son compte.
grant execute on function public.verifier_invitation(text, text) to anon;

-- ---------- 6. Bucket des logos : pas de liste anonyme ----------

drop policy if exists "logos : lecture publique" on storage.objects;
-- Le super-administrateur garde la lecture (nécessaire pour remplacer un logo) ;
-- tout le monde voit les images par leur adresse publique, sans pouvoir lister le bucket.
create policy "logos : lecture par le super-administrateur" on storage.objects
	for select to authenticated using (bucket_id = 'logos' and (select public.est_super_admin()));
