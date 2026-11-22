-- =============================================================================
-- 0006 · Temps réel et stockage des justificatifs
--
-- Temps réel : les tables métier sont publiées dans « supabase_realtime ».
-- Chaque navigateur connecté reçoit les lignes ajoutées ou modifiées, filtrées par
-- la sécurité par ligne (chacun ne reçoit que ce qu'il a le droit de lire).
-- Volume du projet (≈ 20 comptes) : très en deçà des limites de l'offre gratuite.
--
-- Stockage : bucket PRIVÉ « justificatifs », un dossier par organisation
-- (<organisation>/<mois>/<id>-<nom>), lecture par lien signé de courte durée.
-- =============================================================================

do $$
begin
	if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
		alter publication supabase_realtime add table
			public.volets, public.activites, public.indicateurs, public.taches, public.taches_semaines,
			public.valeurs, public.avancements, public.depenses, public.justificatifs, public.lignes_5w,
			public.rapports, public.journal, public.notifications, public.profils;
	end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'justificatifs', 'justificatifs', false, 10485760,
	array[
		'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.ms-excel', 'application/msword', 'text/csv'
	]
)
on conflict (id) do nothing;

create policy "justificatifs : lecture des membres" on storage.objects
	for select to authenticated
	using (bucket_id = 'justificatifs' and (select public.est_actif()));

create policy "justificatifs : dépôt dans le dossier de son organisation" on storage.objects
	for insert to authenticated
	with check (
		bucket_id = 'justificatifs'
		and (select public.mon_role()) in ('saisie', 'coordination', 'super_admin')
		and ((storage.foldername(name))[1] = (select public.mon_organisation()) or (select public.est_coordination()))
	);

-- Ni remplacement ni suppression d'un fichier déposé, sauf par le super-administrateur.
create policy "justificatifs : suppression par le super-administrateur" on storage.objects
	for delete to authenticated
	using (bucket_id = 'justificatifs' and (select public.est_super_admin()));
