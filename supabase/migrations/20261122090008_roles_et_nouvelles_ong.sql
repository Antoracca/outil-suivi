-- =============================================================================
-- 0008 · Trois rôles seulement, et ouverture à de nouvelles ONG
-- Consigne du développeur (2026-11-22) :
--   - coordination APSUD sur deux niveaux : super-administrateur (tout, y compris
--     supprimer) et coordination (pilote, contrôle, valide, suivi ; ne supprime pas) ;
--   - saisie pour chaque ONG ;
--   - le rôle « lecture » (consultation seule) est retiré ;
--   - une 6e ONG (ou plus) doit pouvoir rejoindre le consortium sans changer le code.
-- =============================================================================

-- ---------- Rôles ----------

do $$
begin
	if exists (select 1 from public.profils where role = 'lecture') then
		raise exception 'Des comptes ont encore le rôle « lecture » : attribuez-leur un autre rôle avant cette migration.';
	end if;
end;
$$;
update public.invitations set archive_le = now() where role = 'lecture' and archive_le is null;

alter table public.profils drop constraint profils_role_check;
alter table public.profils add constraint profils_role_check check (role in ('super_admin', 'coordination', 'saisie'));
alter table public.invitations drop constraint invitations_role_check;
alter table public.invitations add constraint invitations_role_check
	check (role in ('super_admin', 'coordination', 'saisie') or archive_le is not null);

-- ---------- Organisations ouvertes ----------

alter table public.organisations drop constraint organisations_sigle_check;
alter table public.organisations add constraint organisations_sigle_check check (sigle ~ '^[A-Z0-9]{2,12}$');
comment on table public.organisations is 'Organisations du consortium : les 5 du projet FH, puis celles ajoutées par le super-administrateur.';

alter table public.journal drop constraint journal_type_check;
alter table public.journal add constraint journal_type_check check (type in (
	'valeur_modifiee', 'avancement_modifie',
	'rapport_soumis', 'rapport_valide', 'rapport_a_corriger', 'rapport_verrouille', 'rapport_deverrouille',
	'activite_creee', 'tache_creee', 'tache_modifiee', 'semaine_cochee',
	'depense_ajoutee', 'justificatif_ajoute',
	'fiche_5w_modifiee', 'ligne_5w_ajoutee', 'ligne_5w_modifiee',
	'element_archive', 'element_restaure', 'element_supprime',
	'cadre_verrouille', 'cadre_deverrouille',
	'volet_cree'
));

-- ---------- Fonctions mises à jour ----------

/** Notifications : la coordination, le super-admin et l'ONG du volet, jamais l'auteur. */
create or replace function public._journaliser(
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
		and (u.role in ('coordination', 'super_admin') or (org_volet is not null and u.organisation = org_volet));
end;
$$;

/** Coordination : comptes de saisie. Super-administrateur : tous les rôles. */
create or replace function public.creer_invitation(p_email text, p_nom text, p_fonction text, p_organisation text, p_role text) returns text
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
	if p_role not in ('super_admin', 'coordination', 'saisie') then
		raise exception 'Rôle inconnu : %. Rôles possibles : super-administrateur, coordination, saisie.', p_role using errcode = 'P0001';
	end if;
	if p_role in ('coordination', 'super_admin') and p.role <> 'super_admin' then
		raise exception 'Seul le super-administrateur crée un compte de coordination ou d’administration.' using errcode = '42501';
	end if;
	if not exists (select 1 from public.organisations where sigle = p_organisation) then
		raise exception 'Organisation inconnue : %.', p_organisation using errcode = 'P0001';
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

-- ---------- Nouvelle ONG ou nouveau volet ----------

/**
 * Super-administrateur : ajoute un volet (secteur × organisation) et, si l'organisation
 * n'existe pas encore, l'organisation elle-même. Les 10 rapports mensuels du volet sont
 * créés. Le cadre logique du volet s'importe ensuite depuis le plan d'action Excel de l'ONG.
 */
create function public.ajouter_volet(p_evenement text, p_sigle text, p_nom text, p_secteur text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	s text := upper(trim(coalesce(p_sigle, '')));
	nom_org text := trim(coalesce(p_nom, ''));
	code_volet text;
	nouvelle boolean := false;
begin
	if public._deja_fait(p_evenement) then return; end if;
	if p.role <> 'super_admin' then
		raise exception 'Seul le super-administrateur ajoute une ONG ou un volet.' using errcode = '42501';
	end if;
	if s !~ '^[A-Z0-9]{2,12}$' then
		raise exception 'Sigle invalide : 2 à 12 lettres majuscules ou chiffres, sans espace ni tiret (ex. MSF, CARE).' using errcode = 'P0001';
	end if;
	if not exists (select 1 from public.secteurs where code = p_secteur) then
		raise exception 'Secteur inconnu : %.', p_secteur using errcode = 'P0001';
	end if;
	if not exists (select 1 from public.organisations where sigle = s) then
		if length(nom_org) < 3 then
			raise exception 'Indiquez le nom complet de la nouvelle ONG.' using errcode = 'P0001';
		end if;
		insert into public.organisations (sigle, nom, role_consortium) values (s, nom_org, 'partenaire');
		nouvelle := true;
	end if;
	code_volet := p_secteur || '-' || s;
	if exists (select 1 from public.volets where code = code_volet) then
		raise exception 'Le volet % existe déjà.', code_volet using errcode = 'P0001';
	end if;
	insert into public.volets (code, organisation, secteur) values (code_volet, s, p_secteur);
	insert into public.rapports (id, volet, mois) select code_volet || ':' || mois, code_volet, mois from public.periodes;
	perform public._journaliser(p_evenement, p, 'volet_cree', code_volet, null, 'volet', code_volet,
		code_volet || ' (' || (select nom from public.organisations where sigle = s) || ')',
		case when nouvelle then 'a ajouté une nouvelle ONG et son volet' else 'a ajouté le volet' end);
end;
$$;

revoke execute on function public.ajouter_volet(text, text, text, text) from public, anon;
grant execute on function public.ajouter_volet(text, text, text, text) to authenticated;

-- ---------- Temps réel : une nouvelle ONG ou un nouveau cadre apparaît chez tous ----------

do $$
begin
	if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
		alter publication supabase_realtime add table public.organisations, public.outcomes, public.outputs;
	end if;
end;
$$;
