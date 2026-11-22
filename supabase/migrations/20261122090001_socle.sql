-- =============================================================================
-- 0001 · Socle : référentiels, comptes, invitations, fonctions d'aide
-- Plateforme de suivi du consortium APSUD (Fonds humanitaire RCA)
--
-- Règles permanentes (INSTRUCTIONS.md §0) :
--   - on ne supprime jamais une donnée métier : on archive (colonne archive_le) ;
--   - seul le super-administrateur supprime, et toujours au journal ;
--   - la sécurité vit dans la base : le navigateur ne reçoit que la clé publique.
-- Les noms de colonnes reprennent ceux des types de l'application
-- (src/lib/donnees/types.ts) pour que la correspondance reste évidente.
-- =============================================================================

-- ---------- Référentiels ----------

create table public.organisations (
	sigle text primary key check (sigle in ('APSUD', 'ARS', 'AFPE', 'GADY', 'IDC')),
	nom text not null,
	role_consortium text not null check (role_consortium in ('chef_de_file', 'partenaire')),
	ville text
);
comment on table public.organisations is 'Les 5 organisations du consortium FH.';

create table public.secteurs (
	code text primary key check (code in ('WASH', 'NUT', 'SAN', 'PE', 'SECAL')),
	libelle text not null,
	libelle_court text not null,
	cluster_cbpf text not null
);

create table public.projet (
	id smallint primary key default 1 check (id = 1),
	code_cbpf text not null,
	intitule text not null,
	bailleur text not null,
	date_debut date not null,
	date_fin date not null,
	devise text not null default 'USD',
	zones text[] not null default '{}',
	objectif_general text not null,
	constraint projet_dates check (date_fin > date_debut)
);
comment on table public.projet is 'Le projet financé (une seule ligne).';

create table public.periodes (
	mois text primary key check (mois ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	rang smallint not null unique check (rang between 1 and 36),
	echeance date not null,
	ouverte boolean not null default true
);
comment on table public.periodes is 'Mois de reporting (« 2026-11 ») ; échéance du rapport mensuel (D4).';

-- ---------- Comptes ----------

create table public.profils (
	id uuid primary key references auth.users (id),
	nom text not null check (length(trim(nom)) between 2 and 120),
	fonction text not null default '',
	organisation text not null references public.organisations (sigle),
	role text not null check (role in ('super_admin', 'coordination', 'saisie', 'lecture')),
	actif boolean not null default true,
	cree_le timestamptz not null default now(),
	constraint profils_role_apsud check (role not in ('coordination', 'super_admin') or organisation = 'APSUD')
);
comment on table public.profils is 'Une personne = un compte nominatif, créé uniquement sur invitation. On désactive, on ne supprime pas.';
create index profils_organisation on public.profils (organisation) where actif;

-- ---------- Fonctions d'aide (utilisées par les politiques de sécurité) ----------

create function public.mon_role() returns text
	language sql stable security definer set search_path = ''
as $$ select p.role from public.profils p where p.id = auth.uid() and p.actif $$;

create function public.mon_organisation() returns text
	language sql stable security definer set search_path = ''
as $$ select p.organisation from public.profils p where p.id = auth.uid() and p.actif $$;

create function public.est_actif() returns boolean
	language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profils p where p.id = auth.uid() and p.actif) $$;

create function public.est_coordination() returns boolean
	language sql stable security definer set search_path = ''
as $$ select coalesce(public.mon_role() in ('coordination', 'super_admin'), false) $$;

create function public.est_super_admin() returns boolean
	language sql stable security definer set search_path = ''
as $$ select coalesce(public.mon_role() = 'super_admin', false) $$;

-- ---------- Invitations ----------
-- Aucune inscription libre : la coordination crée une invitation (adresse, organisation,
-- rôle) et transmet le code à la personne. Le code n'est conservé que sous forme hachée.

create table public.invitations (
	id uuid primary key default gen_random_uuid(),
	code_hache text not null unique,
	email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
	nom text not null check (length(trim(nom)) between 2 and 120),
	fonction text not null default '',
	organisation text not null references public.organisations (sigle),
	role text not null check (role in ('super_admin', 'coordination', 'saisie', 'lecture')),
	cree_par uuid references public.profils (id),
	cree_le timestamptz not null default now(),
	expire_le timestamptz not null default now() + interval '14 days',
	utilisee_le timestamptz,
	utilisee_par uuid references auth.users (id),
	archive_le timestamptz,
	constraint invitations_role_apsud check (role not in ('coordination', 'super_admin') or organisation = 'APSUD')
);
create index invitations_email on public.invitations (email) where utilisee_le is null and archive_le is null;

/** Normalise puis hache un code (« 7k4p 92qd » = « 7K4P-92QD »). */
create function public._hacher_code(p_code text) returns text
	language sql immutable set search_path = ''
as $$
	select encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex')
$$;

/** Code de 8 caractères sans ambiguïté (ni 0/O, ni 1/I/L), tiré de l'aléa fort de gen_random_uuid(). */
create function public._nouveau_code() returns text
	language plpgsql volatile set search_path = ''
as $$
declare
	alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	octets bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
	code text := '';
begin
	-- Octets 1, 5, 9, 13 de chaque uuid : jamais les octets de version et de variante (6 et 8).
	for i in 0..7 loop
		code := code || substr(alphabet, (get_byte(octets, i * 4 + 1) % 31) + 1, 1);
	end loop;
	return substr(code, 1, 4) || '-' || substr(code, 5, 4);
end;
$$;

/**
 * À la création d'un compte (inscription depuis l'application), le profil est créé
 * d'après l'invitation correspondante. Sans invitation valide, l'inscription échoue.
 */
create function public._creer_profil_sur_invitation() returns trigger
	language plpgsql security definer set search_path = ''
as $$
declare
	inv public.invitations;
	nom_saisi text := nullif(trim(new.raw_user_meta_data ->> 'nom'), '');
begin
	select * into inv
	from public.invitations i
	where i.code_hache = public._hacher_code(new.raw_user_meta_data ->> 'code_invitation')
		and i.email = lower(new.email)
		and i.utilisee_le is null
		and i.archive_le is null
		and i.expire_le > now()
	for update;
	if not found then
		raise exception 'Code d''invitation invalide, expiré ou destiné à une autre adresse e-mail.' using errcode = 'P0001';
	end if;
	insert into public.profils (id, nom, fonction, organisation, role)
	values (new.id, coalesce(nom_saisi, inv.nom), inv.fonction, inv.organisation, inv.role);
	update public.invitations set utilisee_le = now(), utilisee_par = new.id where id = inv.id;
	return new;
end;
$$;

create trigger creer_profil_sur_invitation
	after insert on auth.users
	for each row execute function public._creer_profil_sur_invitation();
