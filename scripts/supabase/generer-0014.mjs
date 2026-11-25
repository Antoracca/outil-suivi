/**
 * Génère la migration 0014 depuis le référentiel des secteurs et des rôles
 * (src/lib/donnees/referentiels/secteurs.ts), pour que la base et l'écran aient le même contenu.
 * Usage unique : node scripts/supabase/generer-0014.mjs (refuse de réécrire une migration existante).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cible = fileURLToPath(new URL('../../supabase/migrations/20261125090014_ong_secteurs_roles_logos.sql', import.meta.url));
if (existsSync(cible) && !process.argv.includes('--forcer')) {
	console.error('La migration 0014 existe déjà (et a peut-être été appliquée en ligne) : rien n’est réécrit. Option --forcer pour passer outre.');
	process.exit(1);
}
const { SECTEURS_REFERENCE, ROLES_CONSORTIUM } = await import('../../src/lib/donnees/referentiels/secteurs.ts');
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const tableau = (a) => `array[${a.map(q).join(', ')}]::text[]`;
const lignes = SECTEURS_REFERENCE.map((s) => `\t(${q(s.code)}, ${q(s.libelle)}, ${q(s.libelle_court)}, ${q(s.cluster_cbpf)}, ${tableau(s.mots_cles)})`).join(',\n');
const roles = ROLES_CONSORTIUM.map((r) => q(r.valeur)).join(', ');

const sql = `-- =============================================================================
-- 0014 — Nouvelles ONG : secteurs enrichis, rôle dans le consortium, logo
-- Demande du 2026-11-25 :
--   * secteurs : les clusters humanitaires et leurs domaines, avec mots-clés de recherche,
--     plus un secteur « Autre » ajouté par le super-administrateur (ajouter_secteur) ;
--   * rôle de l'organisation : partenaire de mise en œuvre, partenaire technique, membre
--     associé, bailleur / investisseur, observateur, chef de file ;
--   * logo : bucket public « logos », modifiable par le super-administrateur.
-- Généré par scripts/supabase/generer-0014.mjs depuis src/lib/donnees/referentiels/secteurs.ts.
-- =============================================================================

-- ---------- Secteurs ----------

alter table public.secteurs drop constraint secteurs_code_check;
alter table public.secteurs add constraint secteurs_code_check check (code ~ '^[A-Z][A-Z0-9]{1,9}$');
alter table public.secteurs add column mots_cles text[] not null default '{}';
comment on table public.secteurs is 'Secteurs d’intervention (clusters humanitaires), avec mots-clés pour la recherche.';

insert into public.secteurs (code, libelle, libelle_court, cluster_cbpf, mots_cles) values
${lignes}
on conflict (code) do update set
	libelle = excluded.libelle, libelle_court = excluded.libelle_court,
	cluster_cbpf = excluded.cluster_cbpf, mots_cles = excluded.mots_cles;

-- ---------- Organisations : rôle et logo ----------

alter table public.organisations drop constraint organisations_role_consortium_check;
alter table public.organisations add constraint organisations_role_consortium_check
	check (role_consortium in (${roles}));
alter table public.organisations add column logo_url text
	check (logo_url is null or logo_url ~ '^(https://|/logos/)');
comment on column public.organisations.logo_url is 'Adresse du logo (bucket public « logos » ou fichier fourni dans static/logos/).';

-- ---------- Journal ----------

alter table public.journal drop constraint journal_type_check;
alter table public.journal add constraint journal_type_check check (type in (
	'valeur_modifiee', 'avancement_modifie',
	'rapport_soumis', 'rapport_valide', 'rapport_a_corriger', 'rapport_verrouille', 'rapport_deverrouille',
	'activite_creee', 'tache_creee', 'tache_modifiee', 'semaine_cochee',
	'depense_ajoutee', 'justificatif_ajoute',
	'fiche_5w_modifiee', 'ligne_5w_ajoutee', 'ligne_5w_modifiee',
	'element_archive', 'element_restaure', 'element_supprime',
	'cadre_verrouille', 'cadre_deverrouille',
	'volet_cree', 'planification_validee', 'secteur_cree', 'organisation_modifiee'
));

-- ---------- Écriture (super-administrateur) ----------

/** Secteur « Autre » : ajouté quand aucun secteur de la liste ne convient. */
create function public.ajouter_secteur(p_evenement text, p_code text, p_libelle text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	c text := upper(trim(coalesce(p_code, '')));
	lib text := trim(coalesce(p_libelle, ''));
begin
	if public._deja_fait(p_evenement) then return; end if;
	if p.role <> 'super_admin' then
		raise exception 'Seul le super-administrateur ajoute un secteur.' using errcode = '42501';
	end if;
	if c !~ '^[A-Z][A-Z0-9]{1,9}$' then
		raise exception 'Code de secteur invalide : 2 à 10 lettres majuscules ou chiffres.' using errcode = 'P0001';
	end if;
	if length(lib) < 3 then
		raise exception 'Indiquez le nom du secteur.' using errcode = 'P0001';
	end if;
	if exists (select 1 from public.secteurs where code = c) then
		raise exception 'Le secteur % existe déjà.', c using errcode = 'P0001';
	end if;
	if exists (select 1 from public.secteurs where lower(libelle) = lower(lib)) then
		raise exception 'Un secteur porte déjà ce nom : choisissez-le dans la liste.' using errcode = 'P0001';
	end if;
	insert into public.secteurs (code, libelle, libelle_court, cluster_cbpf, mots_cles) values (c, lib, left(lib, 40), 'AUTRE', '{}');
	perform public._journaliser(p_evenement, p, 'secteur_cree', null, null, 'secteur', c, lib, 'a ajouté le secteur');
end;
$$;

/** Nouvelle ONG (avec son volet) ou nouveau volet d'une ONG membre. Remplace la version à 4 paramètres. */
drop function public.ajouter_volet(text, text, text, text);
create function public.ajouter_volet(p_evenement text, p_sigle text, p_nom text, p_secteur text, p_role text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	s text := upper(trim(coalesce(p_sigle, '')));
	nom_org text := trim(coalesce(p_nom, ''));
	role_org text := coalesce(nullif(trim(coalesce(p_role, '')), ''), 'partenaire');
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
		raise exception 'Choisissez le secteur du volet.' using errcode = 'P0001';
	end if;
	if role_org not in (${roles}) then
		raise exception 'Rôle inconnu : %.', role_org using errcode = 'P0001';
	end if;
	if not exists (select 1 from public.organisations where sigle = s) then
		if length(nom_org) < 3 then
			raise exception 'Indiquez le nom complet de la nouvelle ONG.' using errcode = 'P0001';
		end if;
		insert into public.organisations (sigle, nom, role_consortium) values (s, nom_org, role_org);
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

/** Nom, rôle et logo d'une organisation. */
create function public.modifier_organisation(p_evenement text, p_sigle text, p_nom text, p_role text, p_logo_url text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	o public.organisations;
	nom_org text := trim(coalesce(p_nom, ''));
	logo text := nullif(trim(coalesce(p_logo_url, '')), '');
begin
	if public._deja_fait(p_evenement) then return; end if;
	if p.role <> 'super_admin' then
		raise exception 'Seul le super-administrateur modifie une organisation.' using errcode = '42501';
	end if;
	select * into o from public.organisations where sigle = upper(trim(coalesce(p_sigle, '')));
	if not found then raise exception 'Organisation inconnue.' using errcode = 'P0001'; end if;
	if length(nom_org) < 2 then raise exception 'Indiquez le nom complet de l’organisation.' using errcode = 'P0001'; end if;
	if p_role not in (${roles}) then raise exception 'Rôle inconnu : %.', p_role using errcode = 'P0001'; end if;
	if logo is not null and logo !~ '^(https://|/logos/)' then
		raise exception 'Adresse de logo invalide.' using errcode = 'P0001';
	end if;
	update public.organisations set nom = nom_org, role_consortium = p_role, logo_url = logo where sigle = o.sigle;
	perform public._journaliser(p_evenement, p, 'organisation_modifiee', null, null, 'organisation', o.sigle, o.sigle || ' (' || nom_org || ')', 'a modifié l’organisation');
end;
$$;

revoke execute on function public.ajouter_secteur(text, text, text) from public, anon;
revoke execute on function public.ajouter_volet(text, text, text, text, text) from public, anon;
revoke execute on function public.modifier_organisation(text, text, text, text, text) from public, anon;
grant execute on function public.ajouter_secteur(text, text, text) to authenticated;
grant execute on function public.ajouter_volet(text, text, text, text, text) to authenticated;
grant execute on function public.modifier_organisation(text, text, text, text, text) to authenticated;

-- ---------- Logos : bucket public, écriture par le super-administrateur ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "logos : lecture publique" on storage.objects
	for select to anon, authenticated using (bucket_id = 'logos');
create policy "logos : dépôt par le super-administrateur" on storage.objects
	for insert to authenticated with check (bucket_id = 'logos' and (select public.est_super_admin()));
create policy "logos : remplacement par le super-administrateur" on storage.objects
	for update to authenticated using (bucket_id = 'logos' and (select public.est_super_admin()));

-- ---------- Temps réel : un nouveau secteur apparaît chez tous ----------

do $$
begin
	if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
		alter publication supabase_realtime add table public.secteurs;
	end if;
end;
$$;
`;
writeFileSync(cible, sql);
console.log(`Migration 0014 écrite (${SECTEURS_REFERENCE.length} secteurs, ${ROLES_CONSORTIUM.length} rôles).`);
