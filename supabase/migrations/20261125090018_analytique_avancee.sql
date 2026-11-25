-- =============================================================================
-- 0018 · Mesure d'utilisation avancée (demande du développeur, 2026-11-25)
--   - deux nouveaux types de mesures : « performance » (temps d'affichage d'un écran)
--     et « friction » (signe de difficulté : bouton cliqué plusieurs fois de suite…) ;
--   - le super-administrateur lit tous les consentements (taux d'adhésion dans l'analyse) ;
--   - index pour les analyses par compte et par période.
-- Toujours : rien n'est enregistré sans consentement (enregistrer_analytique, migration 0016).
-- =============================================================================

alter table public.analytique_evenements drop constraint analytique_evenements_type_check;
alter table public.analytique_evenements add constraint analytique_evenements_type_check
	check (type in ('page', 'clic', 'duree', 'appareil', 'erreur', 'recherche', 'action', 'performance', 'friction'));

create policy consentements_super_admin on public.consentements
	for select to authenticated using ((select public.est_super_admin()));

create index analytique_utilisateur_date on public.analytique_evenements (utilisateur, date desc);
