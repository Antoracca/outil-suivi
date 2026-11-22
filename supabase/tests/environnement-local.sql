-- =============================================================================
-- Environnement Supabase MINIMAL pour les tests locaux (PGlite, sans Docker).
-- Reproduit seulement ce dont les migrations ont besoin : rôles, auth.users et
-- auth.uid(), storage.buckets et storage.objects, publication supabase_realtime.
-- N'est JAMAIS exécuté sur le vrai projet Supabase, qui fournit déjà tout cela.
-- =============================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (
	id uuid primary key default gen_random_uuid(),
	email text unique,
	raw_user_meta_data jsonb not null default '{}'
);
-- Comme Supabase : l'identité vient du jeton de la requête.
create function auth.uid() returns uuid language sql stable as $$
	select nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
grant usage on schema storage to anon, authenticated;
create table storage.buckets (
	id text primary key,
	name text not null,
	public boolean not null default false,
	file_size_limit bigint,
	allowed_mime_types text[]
);
create table storage.objects (
	id uuid primary key default gen_random_uuid(),
	bucket_id text references storage.buckets (id),
	name text not null,
	owner uuid default auth.uid()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
	select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to authenticated;

create publication supabase_realtime;
