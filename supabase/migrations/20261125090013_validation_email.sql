-- =============================================================================
-- 0013 — Adresses e-mail des invitations : toute messagerie, extension en lettres
-- Demande du 2026-11-25 : Gmail, Yahoo, adresses d'organisation… toutes acceptées,
-- majuscules ou minuscules indifférentes (l'adresse est enregistrée en minuscules).
-- Refusé : pas de « @ », espaces, extension finale en chiffres (« nom@ong.90 »).
-- Même règle que src/lib/donnees/regles.ts › estEmailValide.
-- =============================================================================

create function public._email_valide(p_email text) returns boolean
	language sql immutable set search_path = ''
as $$
	select lower(trim(coalesce(p_email, ''))) ~ '^[^[:space:]@]+@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$';
$$;

-- Les invitations existantes respectent déjà cette règle (adresses d'organisation).
alter table public.invitations drop constraint invitations_email_check;
alter table public.invitations add constraint invitations_email_check
	check (email = lower(trim(email)) and public._email_valide(email));

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
	if not public._email_valide(adresse) then
		raise exception 'Adresse e-mail incomplète : il faut un « @ » et une extension en lettres, par exemple prenom.nom@gmail.com ou contact@ong.org.' using errcode = 'P0001';
	end if;
	if length(trim(coalesce(p_nom, ''))) < 2 then
		raise exception 'Indiquez le nom de la personne ou l’intitulé du poste.' using errcode = 'P0001';
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
