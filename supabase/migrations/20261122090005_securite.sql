-- =============================================================================
-- 0005 · Sécurité : sécurité par ligne (RLS) et droits
--
--   - Visiteur sans compte (anon) : rien, sauf vérifier un code d'invitation.
--   - Compte actif : LECTURE de tout le consortium (décision D3).
--   - Écriture : uniquement par les fonctions de 0004 (aucun INSERT, UPDATE,
--     DELETE direct, pour aucun rôle de l'application).
--   - Notifications : chacun ne voit que les siennes.
--   - Invitations : coordination ; journal d'audit technique : super-administrateur.
-- =============================================================================

do $$
declare
	t text;
begin
	foreach t in array array[
		'organisations', 'secteurs', 'projet', 'periodes', 'profils', 'invitations',
		'volets', 'outcomes', 'outputs', 'activites', 'indicateurs', 'taches', 'taches_semaines',
		'valeurs', 'avancements', 'depenses', 'justificatifs', 'lignes_5w', 'rapports',
		'journal', 'notifications', 'journal_audit'
	] loop
		execute format('alter table public.%I enable row level security', t);
	end loop;
end;
$$;
-- Les fonctions SECURITY DEFINER appartiennent au propriétaire des tables, qui n'est pas
-- soumis à la RLS : ce sont elles, et elles seules, qui écrivent, après leurs contrôles.

-- ---------- Aucun droit par défaut ----------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------- Lecture du consortium (comptes actifs) ----------

do $$
declare
	t text;
begin
	foreach t in array array[
		'organisations', 'secteurs', 'projet', 'periodes', 'profils',
		'volets', 'outcomes', 'outputs', 'activites', 'indicateurs', 'taches', 'taches_semaines',
		'valeurs', 'avancements', 'depenses', 'justificatifs', 'lignes_5w', 'rapports', 'journal'
	] loop
		execute format('create policy lecture_consortium on public.%I for select to authenticated using ((select public.est_actif()))', t);
		execute format('grant select on public.%I to authenticated', t);
	end loop;
end;
$$;

create policy mes_notifications on public.notifications
	for select to authenticated using (destinataire = (select auth.uid()));
grant select on public.notifications to authenticated;

create policy invitations_coordination on public.invitations
	for select to authenticated using ((select public.est_coordination()));
grant select (id, email, nom, fonction, organisation, role, cree_par, cree_le, expire_le, utilisee_le, utilisee_par, archive_le)
	on public.invitations to authenticated; -- jamais le code haché

create policy audit_super_admin on public.journal_audit
	for select to authenticated using ((select public.est_super_admin()));
grant select on public.journal_audit to authenticated;

-- ---------- Fonctions appelables ----------

-- Utilisées par les politiques : le rôle qui lit doit pouvoir les exécuter.
grant execute on function public.mon_role(), public.mon_organisation(), public.est_actif(),
	public.est_coordination(), public.est_super_admin() to authenticated;

-- Les actions de l'application.
grant execute on function
	public.enregistrer_valeur(text, text, text, text, numeric, numeric, numeric, numeric, numeric, text),
	public.enregistrer_avancement(text, text, text, text, numeric, text, text),
	public.ajouter_depense(text, text, text, text, numeric, text),
	public.ajouter_activite(text, text, text, text, numeric, text),
	public.ajouter_tache(text, text, text, text, text, date, date),
	public.definir_semaine(text, text, text, smallint, text, boolean),
	public.ajouter_justificatif(text, text, text, text, text, text, text, text, bigint, text, text),
	public.enregistrer_fiche_5w(text, text, jsonb),
	public.ajouter_ligne_5w(text, text, text, text, jsonb),
	public.modifier_ligne_5w(text, text, jsonb),
	public.changer_statut_rapport(text, text, text, text, text),
	public.definir_verrou_cadre(text, text, boolean),
	public.archiver(text, text, text),
	public.restaurer(text, text, text),
	public.supprimer_definitivement(text, text, text),
	public.marquer_lu(text),
	public.creer_invitation(text, text, text, text, text),
	public.modifier_compte(uuid, text, boolean)
to authenticated;

-- Seule fonction ouverte sans compte : vérifier son code avant de créer son compte.
grant execute on function public.verifier_invitation(text, text) to anon, authenticated;

-- amorcer_super_admin et les fonctions internes (préfixe _) ne sont accessibles à aucun rôle de l'application.
