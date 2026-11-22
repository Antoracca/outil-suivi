-- =============================================================================
-- 0003 · Fil d'activité, notifications, journal d'audit inaltérable
--
-- Deux niveaux de traçabilité :
--   - journal       : le fil d'activité lisible (« IDC a soumis le rapport WASH-IDC, 2026-12 »),
--                     écrit par les fonctions d'écriture, montré dans l'application ;
--   - journal_audit : la trace technique de CHAQUE ligne insérée, modifiée ou supprimée
--                     (ancienne et nouvelle valeur), écrite par déclencheur, même si
--                     quelqu'un écrivait dans la base sans passer par l'application.
-- Les deux sont en ajout seul : ni modification, ni suppression, pour personne.
-- =============================================================================

create table public.journal (
	id text primary key default gen_random_uuid()::text,
	date timestamptz not null default now(),
	type text not null check (type in (
		'valeur_modifiee', 'avancement_modifie',
		'rapport_soumis', 'rapport_valide', 'rapport_a_corriger', 'rapport_verrouille', 'rapport_deverrouille',
		'activite_creee', 'tache_creee', 'tache_modifiee', 'semaine_cochee',
		'depense_ajoutee', 'justificatif_ajoute',
		'fiche_5w_modifiee', 'ligne_5w_ajoutee', 'ligne_5w_modifiee',
		'element_archive', 'element_restaure', 'element_supprime',
		'cadre_verrouille', 'cadre_deverrouille'
	)),
	auteur uuid not null references public.profils (id),
	organisation text not null references public.organisations (sigle),
	volet text references public.volets (code),
	mois text references public.periodes (mois),
	cible_type text not null,
	cible_id text not null,
	cible_libelle text not null,
	resume text not null,
	avant jsonb,
	apres jsonb
);
create index journal_date on public.journal (date desc);
create index journal_volet on public.journal (volet, date desc);

create table public.notifications (
	id text primary key default gen_random_uuid()::text,
	evenement_id text not null references public.journal (id),
	destinataire uuid not null references public.profils (id),
	lue boolean not null default false,
	unique (evenement_id, destinataire)
);
create index notifications_non_lues on public.notifications (destinataire) where not lue;

create table public.journal_audit (
	id bigint generated always as identity primary key,
	table_nom text not null,
	ligne_id text not null,
	action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
	auteur_id uuid,
	horodatage timestamptz not null default now(),
	ancien jsonb,
	nouveau jsonb,
	champs_modifies text[]
);
create index journal_audit_ligne on public.journal_audit (table_nom, ligne_id);

-- ---------- Ajout seul ----------

create function public._interdire_modification() returns trigger
	language plpgsql set search_path = ''
as $$
begin
	raise exception 'Le % est en ajout seul : aucune modification ni suppression n''est permise.', tg_table_name using errcode = '42501';
end;
$$;

create trigger journal_ajout_seul before update or delete on public.journal
	for each row execute function public._interdire_modification();
create trigger journal_sans_vidage before truncate on public.journal
	for each statement execute function public._interdire_modification();
create trigger journal_audit_ajout_seul before update or delete on public.journal_audit
	for each row execute function public._interdire_modification();
create trigger journal_audit_sans_vidage before truncate on public.journal_audit
	for each statement execute function public._interdire_modification();

-- ---------- Trace technique de chaque changement ----------

create function public._auditer() returns trigger
	language plpgsql security definer set search_path = ''
as $$
declare
	ancien jsonb;
	nouveau jsonb;
	ligne jsonb;
	champs text[];
begin
	if tg_op <> 'INSERT' then ancien := to_jsonb(old); end if;
	if tg_op <> 'DELETE' then nouveau := to_jsonb(new); end if;
	if tg_op = 'UPDATE' then
		select array_agg(k order by k) into champs
		from jsonb_object_keys(nouveau) k
		where nouveau -> k is distinct from ancien -> k;
		if champs is null then return new; end if; -- rien n'a changé
	end if;
	ligne := coalesce(nouveau, ancien);
	insert into public.journal_audit (table_nom, ligne_id, action, auteur_id, ancien, nouveau, champs_modifies)
	values (
		tg_table_name,
		coalesce(ligne ->> 'id', ligne ->> 'sigle', ligne ->> 'code',
			(ligne ->> 'tache_id') || ':' || (ligne ->> 'mois') || ':' || (ligne ->> 'semaine'),
			ligne ->> 'mois'),
		tg_op,
		auth.uid(),
		ancien,
		nouveau,
		champs
	);
	return coalesce(new, old);
end;
$$;

do $$
declare
	t text;
begin
	foreach t in array array[
		'organisations', 'secteurs', 'projet', 'periodes', 'profils', 'invitations',
		'volets', 'outcomes', 'outputs', 'activites', 'indicateurs', 'taches', 'taches_semaines',
		'valeurs', 'avancements', 'depenses', 'justificatifs', 'lignes_5w', 'rapports'
	] loop
		execute format(
			'create trigger auditer after insert or update or delete on public.%I for each row execute function public._auditer()',
			t
		);
	end loop;
end;
$$;
