-- =============================================================================
-- 0016 · Annonces aux membres et mesure d'utilisation (demandes du développeur, 2026-11-25)
--
-- 1. ANNONCES : messages destinés à TOUS les comptes, y compris ceux créés plus tard
--    (contrairement aux notifications, créées pour les comptes existants au moment de
--    l'événement). Première annonce : l'arrivée des 5 organisations du consortium.
--    Chaque compte les voit une par une à l'arrivée, jusqu'à les marquer « lues ».
--    Toute nouvelle organisation produit son annonce (déclencheur sur organisations).
--
-- 2. MESURE D'UTILISATION (analytique) : seulement avec le CONSENTEMENT du compte.
--    Le choix est enregistré ici ; sans consentement, la base refuse tout envoi.
--    On enregistre la façon d'utiliser l'outil (pages, boutons, durées, appareil),
--    jamais le contenu des saisies. Lecture réservée au super-administrateur.
-- =============================================================================

-- ---------- 1. Annonces ----------

create table public.annonces (
	id text primary key default gen_random_uuid()::text,
	titre text not null check (length(trim(titre)) between 2 and 120),
	texte text not null check (length(trim(texte)) between 2 and 600),
	organisation text references public.organisations (sigle),
	cree_le timestamptz not null default now(),
	archive_le timestamptz
);

create table public.annonces_lues (
	id text primary key,
	annonce_id text not null references public.annonces (id),
	utilisateur uuid not null references public.profils (id),
	lue_le timestamptz not null default now(),
	unique (annonce_id, utilisateur)
);

alter table public.annonces enable row level security;
alter table public.annonces_lues enable row level security;
create policy lecture_consortium on public.annonces for select to authenticated using ((select public.est_actif()));
grant select on public.annonces to authenticated;
create policy mes_lectures on public.annonces_lues for select to authenticated using (utilisateur = (select auth.uid()));
grant select on public.annonces_lues to authenticated;

/** Libellé lisible d'un rôle d'organisation (mêmes textes que referentiels/secteurs.ts). */
create function public._libelle_role_organisation(r text) returns text
	language sql immutable set search_path = ''
as $$
	select case r
		when 'chef_de_file' then 'chef de file'
		when 'partenaire' then 'partenaire de mise en œuvre'
		when 'partenaire_technique' then 'partenaire technique'
		when 'associe' then 'membre associé'
		when 'bailleur' then 'bailleur / investisseur'
		when 'observateur' then 'observateur'
		else 'membre'
	end
$$;

-- Les 5 organisations du consortium (APSUD, chef de file, puis les 4 partenaires).
insert into public.annonces (id, titre, texte, organisation, cree_le)
select
	'arrivee-' || lower(o.sigle),
	case when o.role_consortium = 'chef_de_file' then 'Le consortium sur la plateforme' else 'Nouvelle ONG dans le consortium' end,
	case
		when o.role_consortium = 'chef_de_file' then o.sigle || ' (' || o.nom || '), chef de file du consortium, coordonne la plateforme de suivi : rapports, validation et consolidation pour le Fonds humanitaire.'
		else o.sigle || ' (' || o.nom || ') a rejoint le consortium, ' || public._libelle_role_organisation(o.role_consortium)
			|| coalesce(' : volet' || case when (select count(*) from public.volets v where v.organisation = o.sigle) > 1 then 's ' else ' ' end
				|| (select string_agg(coalesce(s.libelle_court, s.libelle, v.secteur), ' et ' order by v.code) from public.volets v left join public.secteurs s on s.code = v.secteur where v.organisation = o.sigle), '')
			|| '.'
	end,
	o.sigle,
	now() + (case o.sigle when 'APSUD' then 0 when 'ARS' then 1 when 'AFPE' then 2 when 'GADY' then 3 when 'IDC' then 4 else 5 end) * interval '1 second'
from public.organisations o
where o.sigle in ('APSUD', 'ARS', 'AFPE', 'GADY', 'IDC')
on conflict (id) do nothing;

/** Toute organisation ajoutée plus tard est annoncée à tous les comptes. */
create function public._annoncer_organisation() returns trigger
	language plpgsql security definer set search_path = ''
as $$
begin
	insert into public.annonces (id, titre, texte, organisation)
	values ('arrivee-' || lower(new.sigle), 'Nouvelle ONG dans le consortium',
		new.sigle || ' (' || new.nom || ') a rejoint le consortium, ' || public._libelle_role_organisation(new.role_consortium) || '.', new.sigle)
	on conflict (id) do nothing;
	return new;
end;
$$;
revoke all on function public._annoncer_organisation() from public, anon, authenticated;
create trigger organisations_annonce after insert on public.organisations
	for each row execute function public._annoncer_organisation();

/** Marque une annonce comme lue pour le compte connecté (une fois pour toutes). */
create function public.marquer_annonce_lue(p_annonce text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	moi public.profils := public._moi();
begin
	if not exists (select 1 from public.annonces where id = p_annonce) then raise exception 'Annonce inconnue.'; end if;
	insert into public.annonces_lues (id, annonce_id, utilisateur) values (p_annonce || ':' || moi.id, p_annonce, moi.id)
	on conflict (annonce_id, utilisateur) do nothing;
end;
$$;
revoke all on function public.marquer_annonce_lue(text) from public, anon;
grant execute on function public.marquer_annonce_lue(text) to authenticated;

-- ---------- 2. Mesure d'utilisation ----------

create table public.consentements (
	utilisateur uuid primary key references public.profils (id),
	analytique boolean not null,
	version integer not null default 1,
	decide_le timestamptz not null default now()
);
alter table public.consentements enable row level security;
create policy mon_consentement on public.consentements for select to authenticated using (utilisateur = (select auth.uid()));
grant select on public.consentements to authenticated;

create table public.analytique_evenements (
	id bigint generated always as identity primary key,
	utilisateur uuid not null references public.profils (id),
	organisation text,
	role text,
	session text not null check (length(session) <= 64),
	type text not null check (type in ('page', 'clic', 'duree', 'appareil', 'erreur', 'recherche', 'action')),
	page text check (length(page) <= 300),
	cible text check (length(cible) <= 200),
	donnees jsonb check (pg_column_size(donnees) <= 4000),
	date timestamptz not null default now()
);
create index analytique_date on public.analytique_evenements (date desc);
alter table public.analytique_evenements enable row level security;
create policy analytique_super_admin on public.analytique_evenements for select to authenticated using ((select public.est_super_admin()));
grant select on public.analytique_evenements to authenticated;

/** Enregistre le choix du compte connecté (consentement ou refus), modifiable à tout moment. */
create function public.enregistrer_consentement(p_analytique boolean) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	moi public.profils := public._moi();
begin
	if p_analytique is null then raise exception 'Choix manquant.'; end if;
	insert into public.consentements (utilisateur, analytique) values (moi.id, p_analytique)
	on conflict (utilisateur) do update set analytique = excluded.analytique, decide_le = now();
end;
$$;

/**
 * Reçoit un lot d'événements d'utilisation (100 au plus). Refusé sans consentement :
 * la base, et pas seulement l'interface, garantit qu'aucune donnée n'est gardée sans accord.
 */
create function public.enregistrer_analytique(p_session text, p_evenements jsonb) returns integer
	language plpgsql security definer set search_path = ''
as $$
declare
	moi public.profils := public._moi();
	e jsonb;
	n integer := 0;
begin
	if not exists (select 1 from public.consentements where utilisateur = moi.id and analytique) then
		raise exception 'Mesure d’utilisation refusée : pas de consentement.' using errcode = '42501';
	end if;
	if jsonb_typeof(p_evenements) <> 'array' or jsonb_array_length(p_evenements) > 100 then raise exception 'Lot invalide (100 événements au plus).'; end if;
	for e in select * from jsonb_array_elements(p_evenements) loop
		insert into public.analytique_evenements (utilisateur, organisation, role, session, type, page, cible, donnees, date)
		values (moi.id, moi.organisation, moi.role, left(p_session, 64), e ->> 'type', left(e ->> 'page', 300), left(e ->> 'cible', 200),
			case when jsonb_typeof(e -> 'donnees') = 'object' then e -> 'donnees' else null end,
			least(now(), coalesce((e ->> 'date')::timestamptz, now())));
		n := n + 1;
	end loop;
	return n;
end;
$$;

/** Synthèse pour le super-administrateur : 30 derniers jours. */
create function public.resume_analytique() returns jsonb
	language plpgsql stable security definer set search_path = ''
as $$
begin
	if not public.est_super_admin() then raise exception 'Réservé au super-administrateur.' using errcode = '42501'; end if;
	return jsonb_build_object(
		'consentements', (select jsonb_build_object('oui', count(*) filter (where analytique), 'non', count(*) filter (where not analytique)) from public.consentements),
		'evenements', (select count(*) from public.analytique_evenements where date > now() - interval '30 days'),
		'sessions', (select count(distinct session) from public.analytique_evenements where date > now() - interval '30 days'),
		'pages', (select coalesce(jsonb_agg(x order by x.nb desc), '[]') from (select page, count(*) as nb from public.analytique_evenements where type = 'page' and date > now() - interval '30 days' group by page order by nb desc limit 12) x),
		'clics', (select coalesce(jsonb_agg(x order by x.nb desc), '[]') from (select cible, count(*) as nb from public.analytique_evenements where type = 'clic' and date > now() - interval '30 days' group by cible order by nb desc limit 12) x),
		'organisations', (select coalesce(jsonb_agg(x order by x.nb desc), '[]') from (select organisation, count(*) as nb from public.analytique_evenements where date > now() - interval '30 days' group by organisation) x)
	);
end;
$$;

revoke all on function public.enregistrer_consentement(boolean) from public, anon;
revoke all on function public.enregistrer_analytique(text, jsonb) from public, anon;
revoke all on function public.resume_analytique() from public, anon;
grant execute on function public.enregistrer_consentement(boolean) to authenticated;
grant execute on function public.enregistrer_analytique(text, jsonb) to authenticated;
grant execute on function public.resume_analytique() to authenticated;

do $$
begin
	if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
		alter publication supabase_realtime add table public.annonces, public.annonces_lues;
	end if;
end;
$$;
