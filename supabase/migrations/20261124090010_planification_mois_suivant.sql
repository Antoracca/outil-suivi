-- =============================================================================
-- 0010 — Planification du mois suivant (cahier des charges APSUD du 2026-11-24, §3.4)
-- Onglet « Activités planifiées » : l'ONG coche les activités prévues pour le mois
-- suivant (M+1) et valide. Le mois venu, l'onglet Activités les présente en tête,
-- sans ressaisie. Une ligne par activité et par mois ; jamais supprimée, seulement
-- mise à jour (chaque validation est auditée et inscrite au fil d'activité).
-- =============================================================================

create table public.planifications (
	id text primary key,                       -- « <activité>:<mois> », clé unique pour le temps réel
	activite_id text not null references public.activites (id),
	volet text not null references public.volets (code),
	mois text not null references public.periodes (mois),
	prevue boolean not null,
	valide_par uuid not null references public.profils (id),
	valide_le timestamptz not null default now(),
	unique (activite_id, mois)
);
comment on table public.planifications is 'Activités prévues pour un mois (planification M+1), cochées puis validées par l’ONG du volet ou la coordination.';
create index planifications_volet_mois on public.planifications (volet, mois);

-- ---------- Journal : nouveau type d'événement ----------

alter table public.journal drop constraint journal_type_check;
alter table public.journal add constraint journal_type_check check (type in (
	'valeur_modifiee', 'avancement_modifie',
	'rapport_soumis', 'rapport_valide', 'rapport_a_corriger', 'rapport_verrouille', 'rapport_deverrouille',
	'activite_creee', 'tache_creee', 'tache_modifiee', 'semaine_cochee',
	'depense_ajoutee', 'justificatif_ajoute',
	'fiche_5w_modifiee', 'ligne_5w_ajoutee', 'ligne_5w_modifiee',
	'element_archive', 'element_restaure', 'element_supprime',
	'cadre_verrouille', 'cadre_deverrouille',
	'volet_cree', 'planification_validee'
));

-- ---------- Audit, sécurité, temps réel ----------

create trigger auditer after insert or update or delete on public.planifications
	for each row execute function public._auditer();

alter table public.planifications enable row level security;
create policy lecture_consortium on public.planifications
	for select to authenticated using ((select public.est_actif()));
grant select on public.planifications to authenticated;

do $$
begin
	if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
		alter publication supabase_realtime add table public.planifications;
	end if;
end;
$$;

-- ---------- Fonction d'écriture ----------

/**
 * Enregistre la planification d'un volet pour un mois : les activités listées sont
 * « prévues », toutes les autres activités actives du volet « non prévues ».
 * Règles (identiques à depot.svelte.ts › planifierMois) : droit d'écriture sur le volet,
 * mois du projet, rapport du mois ni validé ni verrouillé, activités du volet et actives.
 */
create function public.planifier_mois(
	p_evenement text, p_volet text, p_mois text, p_activites text[]
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	v public.volets := public._volet(p_volet);
	r public.rapports;
	choisies text[] := coalesce(p_activites, '{}');
	nb integer;
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._peut_ecrire_volet(p, v) then
		raise exception 'Votre organisation (%) ne peut pas planifier le volet %.', p.organisation, p_volet using errcode = '42501';
	end if;
	if not exists (select 1 from public.periodes where mois = p_mois) then
		raise exception 'Le mois % ne fait pas partie du projet.', p_mois using errcode = 'P0001';
	end if;
	select * into r from public.rapports where volet = p_volet and mois = p_mois;
	if found and r.statut in ('soumis', 'valide', 'verrouille') then
		raise exception 'Le rapport de ce mois est déjà soumis ou validé : la planification ne peut plus changer.' using errcode = 'P0001';
	end if;
	if exists (
		select 1 from unnest(choisies) as c(id)
		where not exists (select 1 from public.activites a where a.id = c.id and a.volet = p_volet and a.archive_le is null)
	) then
		raise exception 'Une activité choisie n’appartient pas au volet % ou est archivée.', p_volet using errcode = 'P0001';
	end if;

	insert into public.planifications (id, activite_id, volet, mois, prevue, valide_par, valide_le)
	select a.id || ':' || p_mois, a.id, p_volet, p_mois, a.id = any (choisies), p.id, now()
	from public.activites a
	where a.volet = p_volet and a.archive_le is null
	on conflict (activite_id, mois) do update set
		prevue = excluded.prevue, valide_par = excluded.valide_par, valide_le = excluded.valide_le;

	select count(*) into nb from unnest(choisies);
	perform public._journaliser(p_evenement, p, 'planification_validee', p_volet, p_mois, 'planification', p_volet || ':' || p_mois,
		format('%s activité%s', nb, case when nb > 1 then 's' else '' end),
		'a validé la planification du mois :');
end;
$$;

revoke execute on function public.planifier_mois(text, text, text, text[]) from public, anon;
grant execute on function public.planifier_mois(text, text, text, text[]) to authenticated;
