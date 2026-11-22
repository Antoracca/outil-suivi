-- Installation complète du schéma (généré par npm run base:assembler, ne pas modifier à la main).
-- À coller UNE fois dans Supabase › SQL Editor, sur un projet neuf.
-- 9 migrations : 20261122090001_socle.sql, 20261122090002_cadre_et_saisies.sql, 20261122090003_journal_et_audit.sql, 20261122090004_fonctions_ecriture.sql, 20261122090005_securite.sql, 20261122090006_temps_reel_et_stockage.sql, 20261122090007_donnees_reference.sql, 20261122090008_roles_et_nouvelles_ong.sql, 20261122090009_cadre_logique_provisoire.sql

-- >>>>>>>>>> 20261122090001_socle.sql
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


-- >>>>>>>>>> 20261122090002_cadre_et_saisies.sql
-- =============================================================================
-- 0002 · Cadre logique, plan d'action, saisies mensuelles, 5W, rapports
-- Feuille 1 des Excel (plan d'action) et feuille 2 (suivi des indicateurs).
-- Les identifiants sont des textes : ceux du cadre importé gardent la forme lisible
-- de la maquette (« WASH-IDC:act:1.1.1 »), les saisies reçoivent un identifiant
-- généré sur l'appareil, ce qui rend chaque envoi rejouable sans doublon.
-- La cohérence « même volet que le parent » est garantie par des clés composées.
-- =============================================================================

create table public.volets (
	code text primary key,
	organisation text not null references public.organisations (sigle),
	secteur text not null references public.secteurs (code),
	cadre_verrouille boolean not null default false,
	constraint volets_code check (code = secteur || '-' || organisation)
);
comment on table public.volets is 'Un volet = un fichier Excel = une ONG sur un secteur.';

create table public.outcomes (
	id text primary key default gen_random_uuid()::text,
	volet text not null references public.volets (code),
	numero text not null,
	libelle text not null,
	unique (volet, numero),
	unique (id, volet)
);

create table public.outputs (
	id text primary key default gen_random_uuid()::text,
	volet text not null,
	outcome_id text not null,
	numero text not null,
	libelle text not null,
	foreign key (outcome_id, volet) references public.outcomes (id, volet) on delete cascade,
	unique (volet, numero),
	unique (id, volet)
);

create table public.activites (
	id text primary key default gen_random_uuid()::text,
	volet text not null,
	output_id text not null,
	numero text not null,
	libelle text not null check (length(trim(libelle)) > 0),
	responsable text,
	budget_planifie numeric(14, 2) not null default 0 check (budget_planifie >= 0),
	fiche_5w jsonb,
	archive_le timestamptz,
	cree_par uuid references public.profils (id),
	cree_le timestamptz not null default now(),
	foreign key (output_id, volet) references public.outputs (id, volet) on delete cascade,
	unique (volet, numero),
	unique (id, volet)
);
comment on column public.activites.fiche_5w is 'Correspondance avec la nomenclature 5W du cluster WASH : activite_cluster, modalite, type_beneficiaire, reponse, partenaires.';

create table public.indicateurs (
	id text primary key default gen_random_uuid()::text,
	volet text not null references public.volets (code),
	niveau text not null check (niveau in ('outcome', 'output', 'activite')),
	outcome_id text,
	output_id text,
	activite_id text,
	parent_id text generated always as (coalesce(outcome_id, output_id, activite_id)) stored,
	ordre integer not null default 0,
	code_cbpf text,
	libelle text not null,
	type_valeur text not null default 'nombre' check (type_valeur in ('nombre', 'pourcentage')),
	mode_cumul text not null default 'somme' check (mode_cumul in ('somme', 'derniere_valeur')),
	desagrege boolean not null default false,
	cible_femmes numeric check (cible_femmes >= 0),
	cible_filles numeric check (cible_filles >= 0),
	cible_hommes numeric check (cible_hommes >= 0),
	cible_garcons numeric check (cible_garcons >= 0),
	cible_total numeric check (cible_total >= 0),
	moyens_verification text[] not null default '{}',
	commentaire text,
	archive_le timestamptz,
	foreign key (outcome_id, volet) references public.outcomes (id, volet) on delete cascade,
	foreign key (output_id, volet) references public.outputs (id, volet) on delete cascade,
	foreign key (activite_id, volet) references public.activites (id, volet) on delete cascade,
	constraint indicateurs_un_parent check (num_nonnulls(outcome_id, output_id, activite_id) = 1),
	constraint indicateurs_niveau check (
		(niveau = 'outcome') = (outcome_id is not null)
		and (niveau = 'output') = (output_id is not null)
		and (niveau = 'activite') = (activite_id is not null)
	)
);

-- ---------- Plan d'action (feuille 1) ----------

create table public.taches (
	id text primary key default gen_random_uuid()::text,
	volet text not null,
	activite_id text not null,
	libelle text not null check (length(trim(libelle)) > 0),
	responsable text,
	date_debut date,
	date_fin date,
	ordre integer not null default 0,
	archive_le timestamptz,
	cree_par uuid references public.profils (id),
	cree_le timestamptz not null default now(),
	foreign key (activite_id, volet) references public.activites (id, volet) on delete cascade,
	constraint taches_dates check (date_debut is null or date_fin is null or date_fin >= date_debut)
);

create table public.taches_semaines (
	tache_id text not null references public.taches (id) on delete cascade,
	mois text not null references public.periodes (mois),
	semaine smallint not null check (semaine between 1 and 5),
	prevu boolean not null default false,
	realise boolean not null default false,
	primary key (tache_id, mois, semaine)
);
comment on table public.taches_semaines is 'Les croix « x » S1 à S5 du calendrier, prévu et réalisé.';

-- ---------- Saisies mensuelles ----------

create table public.valeurs (
	id text primary key default gen_random_uuid()::text,
	indicateur_id text not null references public.indicateurs (id) on delete cascade,
	volet text not null references public.volets (code),
	mois text not null references public.periodes (mois),
	femmes numeric check (femmes >= 0),
	filles numeric check (filles >= 0),
	hommes numeric check (hommes >= 0),
	garcons numeric check (garcons >= 0),
	total numeric check (total >= 0),
	commentaire text,
	version integer not null check (version >= 1),
	courante boolean not null default true,
	auteur uuid not null references public.profils (id),
	date timestamptz not null default now(),
	unique (indicateur_id, mois, version)
);
comment on table public.valeurs is 'Réalisé du mois (jamais le cumul). Versionné : une modification ajoute une version, l''ancienne reste lisible.';
create unique index valeurs_une_courante on public.valeurs (indicateur_id, mois) where courante;
create index valeurs_volet_mois on public.valeurs (volet, mois);

create table public.avancements (
	id text primary key default gen_random_uuid()::text,
	activite_id text not null references public.activites (id) on delete cascade,
	volet text not null references public.volets (code),
	mois text not null references public.periodes (mois),
	taux_execution numeric check (taux_execution between 0 and 100),
	resultats text not null default '',
	observations text not null default '',
	version integer not null check (version >= 1),
	courante boolean not null default true,
	auteur uuid not null references public.profils (id),
	date timestamptz not null default now(),
	unique (activite_id, mois, version)
);
create unique index avancements_une_courante on public.avancements (activite_id, mois) where courante;

create table public.depenses (
	id text primary key default gen_random_uuid()::text,
	activite_id text not null references public.activites (id) on delete cascade,
	volet text not null references public.volets (code),
	mois text not null references public.periodes (mois),
	montant numeric(14, 2) not null check (montant > 0),
	libelle text not null check (length(trim(libelle)) > 0),
	auteur uuid not null references public.profils (id),
	date timestamptz not null default now(),
	archive_le timestamptz
);
create index depenses_activite on public.depenses (activite_id);

create table public.justificatifs (
	id text primary key default gen_random_uuid()::text,
	volet text not null references public.volets (code),
	mois text not null references public.periodes (mois),
	rattachement_type text not null check (rattachement_type in ('indicateur', 'activite', 'rapport', 'depense')),
	rattachement_id text not null,
	nom_fichier text not null,
	type_mime text not null default 'application/octet-stream',
	taille bigint not null default 0 check (taille >= 0),
	chemin_stockage text,
	moyen_verification text,
	auteur uuid not null references public.profils (id),
	date timestamptz not null default now(),
	archive_le timestamptz
);
comment on column public.justificatifs.chemin_stockage is 'Chemin dans le bucket privé « justificatifs » : <organisation>/<mois>/<id>-<nom>.';

create table public.lignes_5w (
	id text primary key default gen_random_uuid()::text,
	volet text not null references public.volets (code),
	activite_id text not null references public.activites (id) on delete cascade,
	mois text not null references public.periodes (mois),
	prefecture text not null,
	sous_prefecture text not null,
	commune text,
	village text,
	latitude numeric check (latitude between -90 and 90),
	longitude numeric check (longitude between -180 and 180),
	quantite_prevue integer check (quantite_prevue >= 0),
	quantite_realisee integer check (quantite_realisee >= 0),
	personnes_ciblees integer check (personnes_ciblees >= 0),
	filles integer check (filles >= 0),
	garcons integer check (garcons >= 0),
	femmes integer check (femmes >= 0),
	hommes integer check (hommes >= 0),
	date_debut date,
	date_fin date,
	statut text not null default 'En cours',
	commentaire text,
	auteur uuid not null references public.profils (id),
	date timestamptz not null default now(),
	archive_le timestamptz,
	constraint lignes_5w_dates check (date_debut is null or date_fin is null or date_fin >= date_debut)
);
comment on table public.lignes_5w is 'Une ligne du 5W du cluster WASH : une activité, une sous-préfecture, un mois.';

-- ---------- Rapports mensuels (circuit de validation) ----------

create table public.rapports (
	id text primary key,
	volet text not null references public.volets (code),
	mois text not null references public.periodes (mois),
	statut text not null default 'non_commence'
		check (statut in ('non_commence', 'brouillon', 'soumis', 'a_corriger', 'valide', 'verrouille')),
	soumis_par uuid references public.profils (id),
	soumis_le timestamptz,
	decision_par uuid references public.profils (id),
	decision_le timestamptz,
	motif text,
	unique (volet, mois),
	constraint rapports_id check (id = volet || ':' || mois)
);


-- >>>>>>>>>> 20261122090003_journal_et_audit.sql
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


-- >>>>>>>>>> 20261122090004_fonctions_ecriture.sql
-- =============================================================================
-- 0004 · Fonctions d'écriture : la seule porte d'entrée des modifications
--
-- Le navigateur n'a AUCUN droit d'insertion, de modification ou de suppression
-- directe sur les tables (0005). Chaque action de l'application appelle une de ces
-- fonctions, qui :
--   1. vérifie le compte, le rôle, l'organisation et le statut du mois
--      (miroir exact de src/lib/donnees/regles.ts) ;
--   2. contrôle les valeurs (miroir de depot.svelte.ts) ;
--   3. écrit la donnée et l'événement du fil d'activité dans la même transaction ;
--   4. notifie les personnes concernées.
-- Chaque appel porte l'identifiant de son événement, généré sur l'appareil :
-- un appel rejoué (réseau coupé puis rétabli) ne fait rien la seconde fois.
-- =============================================================================

-- ---------- Socle commun ----------

/** Le profil actif de la personne connectée, sinon refus. */
create function public._moi() returns public.profils
	language plpgsql stable security definer set search_path = ''
as $$
declare
	p public.profils;
begin
	select * into p from public.profils where id = auth.uid() and actif;
	if not found then
		raise exception 'Connectez-vous avec un compte actif pour continuer.' using errcode = '42501';
	end if;
	return p;
end;
$$;

create function public._volet(p_code text) returns public.volets
	language plpgsql stable security definer set search_path = ''
as $$
declare
	v public.volets;
begin
	select * into v from public.volets where code = p_code;
	if not found then raise exception 'Volet inconnu : %.', p_code using errcode = 'P0001'; end if;
	return v;
end;
$$;

create function public._est_coordination(p public.profils) returns boolean
	language sql immutable set search_path = ''
as $$ select p.role in ('coordination', 'super_admin') $$;

/** regles.ts › peutEcrireVolet */
create function public._peut_ecrire_volet(p public.profils, v public.volets) returns boolean
	language sql immutable set search_path = ''
as $$ select p.role in ('coordination', 'super_admin') or (p.role = 'saisie' and p.organisation = v.organisation) $$;

/** regles.ts › peutModifierStructure */
create function public._peut_modifier_structure(p public.profils, v public.volets) returns boolean
	language sql immutable set search_path = ''
as $$ select p.role in ('coordination', 'super_admin') or (p.role = 'saisie' and p.organisation = v.organisation and not v.cadre_verrouille) $$;

create function public._deja_fait(p_evenement text) returns boolean
	language sql stable security definer set search_path = ''
as $$ select p_evenement is not null and exists (select 1 from public.journal where id = p_evenement) $$;

/**
 * regles.ts › peutSaisirMois : écriture permise dans le volet ET rapport du mois
 * ni validé ni verrouillé. Le premier enregistrement passe le rapport en brouillon.
 */
create function public._exiger_saisie(p_volet text, p_mois text) returns public.profils
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	v public.volets := public._volet(p_volet);
	r public.rapports;
begin
	if not public._peut_ecrire_volet(p, v) then
		raise exception 'Votre organisation (%) ne peut pas modifier le volet %.', p.organisation, p_volet using errcode = '42501';
	end if;
	if not exists (select 1 from public.periodes where mois = p_mois) then
		raise exception 'Le mois % ne fait pas partie du projet.', p_mois using errcode = 'P0001';
	end if;
	select * into r from public.rapports where volet = p_volet and mois = p_mois for update;
	if found and r.statut not in ('non_commence', 'brouillon', 'a_corriger') then
		raise exception 'Ce rapport est validé ou verrouillé : demandez une réouverture à la coordination APSUD.' using errcode = 'P0001';
	end if;
	if not found then
		insert into public.rapports (id, volet, mois, statut) values (p_volet || ':' || p_mois, p_volet, p_mois, 'brouillon');
	elsif r.statut = 'non_commence' then
		update public.rapports set statut = 'brouillon' where id = r.id;
	end if;
	return p;
end;
$$;

/**
 * Inscrit l'événement au fil d'activité et notifie : la coordination, le super-admin
 * et l'ONG du volet (sauf comptes en lecture seule), jamais l'auteur (regles.ts › destinataires).
 */
create function public._journaliser(
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
		and (u.role in ('coordination', 'super_admin') or (org_volet is not null and u.organisation = org_volet and u.role <> 'lecture'));
end;
$$;

create function public._desagregation(f numeric, fi numeric, h numeric, g numeric, t numeric) returns jsonb
	language sql immutable set search_path = ''
as $$ select jsonb_build_object('femmes', f, 'filles', fi, 'hommes', h, 'garcons', g, 'total', t) $$;

create function public._libelle_activite(a public.activites) returns text
	language sql immutable set search_path = ''
as $$ select a.numero || ' ' || a.libelle $$;

create function public._activite(p_id text) returns public.activites
	language plpgsql stable security definer set search_path = ''
as $$
declare
	a public.activites;
begin
	select * into a from public.activites where id = p_id;
	if not found then raise exception 'Activité introuvable.' using errcode = 'P0001'; end if;
	return a;
end;
$$;

-- ---------- Indicateurs : réalisé du mois ----------

create function public.enregistrer_valeur(
	p_evenement text, p_id text, p_indicateur text, p_mois text,
	p_femmes numeric, p_filles numeric, p_hommes numeric, p_garcons numeric, p_total numeric,
	p_commentaire text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	ind public.indicateurs;
	p public.profils;
	prec public.valeurs;
	a_prec boolean;
	x numeric;
	f numeric := p_femmes; fi numeric := p_filles; h numeric := p_hommes; g numeric := p_garcons; t numeric := p_total;
	com text := nullif(trim(coalesce(p_commentaire, '')), '');
begin
	if public._deja_fait(p_evenement) then return; end if;
	select * into ind from public.indicateurs where id = p_indicateur and archive_le is null;
	if not found then raise exception 'Indicateur introuvable.' using errcode = 'P0001'; end if;
	p := public._exiger_saisie(ind.volet, p_mois);

	foreach x in array array[f, fi, h, g, t] loop
		if x is not null and x < 0 then
			raise exception 'Saisissez des nombres positifs ou laissez la case vide.' using errcode = 'P0001';
		end if;
		if x is not null and ind.type_valeur = 'nombre' and x <> trunc(x) then
			raise exception 'Saisissez des nombres entiers (pas de décimales pour un nombre de personnes ou d’unités).' using errcode = 'P0001';
		end if;
	end loop;
	if ind.type_valeur = 'pourcentage' and t > 100 then
		raise exception 'Un pourcentage ne peut pas dépasser 100.' using errcode = 'P0001';
	end if;
	if ind.desagrege then
		t := case when num_nonnulls(f, fi, h, g) = 0 then null else coalesce(f, 0) + coalesce(fi, 0) + coalesce(h, 0) + coalesce(g, 0) end;
	else
		f := null; fi := null; h := null; g := null;
	end if;

	select * into prec from public.valeurs where indicateur_id = ind.id and mois = p_mois and courante for update;
	a_prec := found;
	if a_prec and (prec.femmes, prec.filles, prec.hommes, prec.garcons, prec.total) is not distinct from (f, fi, h, g, t)
		and prec.commentaire is not distinct from com then
		return; -- rien de nouveau
	end if;
	if a_prec then update public.valeurs set courante = false where id = prec.id; end if;
	insert into public.valeurs (id, indicateur_id, volet, mois, femmes, filles, hommes, garcons, total, commentaire, version, courante, auteur)
	values (coalesce(p_id, gen_random_uuid()::text), ind.id, ind.volet, p_mois, f, fi, h, g, t, com,
		case when a_prec then prec.version + 1 else 1 end, true, p.id);

	perform public._journaliser(p_evenement, p, 'valeur_modifiee', ind.volet, p_mois, 'indicateur', ind.id, ind.libelle, 'a modifié',
		case when a_prec then public._desagregation(prec.femmes, prec.filles, prec.hommes, prec.garcons, prec.total) end,
		public._desagregation(f, fi, h, g, t));
end;
$$;

-- ---------- Activités : avancement, dépenses ----------

create function public.enregistrer_avancement(
	p_evenement text, p_id text, p_activite text, p_mois text,
	p_taux numeric, p_resultats text, p_observations text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	a public.activites := public._activite(p_activite);
	p public.profils;
	prec public.avancements;
	a_prec boolean;
	res text := coalesce(p_resultats, '');
	obs text := coalesce(p_observations, '');
begin
	if public._deja_fait(p_evenement) then return; end if;
	p := public._exiger_saisie(a.volet, p_mois);
	if p_taux is not null and (p_taux < 0 or p_taux > 100) then
		raise exception 'Le taux d’exécution est compris entre 0 et 100 %%.' using errcode = 'P0001';
	end if;
	select * into prec from public.avancements where activite_id = a.id and mois = p_mois and courante for update;
	a_prec := found;
	if a_prec and prec.taux_execution is not distinct from p_taux and prec.resultats = res and prec.observations = obs then
		return;
	end if;
	if a_prec then update public.avancements set courante = false where id = prec.id; end if;
	insert into public.avancements (id, activite_id, volet, mois, taux_execution, resultats, observations, version, courante, auteur)
	values (coalesce(p_id, gen_random_uuid()::text), a.id, a.volet, p_mois, p_taux, res, obs,
		case when a_prec then prec.version + 1 else 1 end, true, p.id);
	perform public._journaliser(p_evenement, p, 'avancement_modifie', a.volet, p_mois, 'activite', a.id, public._libelle_activite(a),
		'a mis à jour l’avancement de',
		case when a_prec then jsonb_build_object('taux', prec.taux_execution) end,
		jsonb_build_object('taux', p_taux));
end;
$$;

create function public.ajouter_depense(
	p_evenement text, p_id text, p_activite text, p_mois text, p_montant numeric, p_libelle text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	a public.activites := public._activite(p_activite);
	p public.profils;
	lib text := trim(coalesce(p_libelle, ''));
	id_dep text := coalesce(p_id, gen_random_uuid()::text);
begin
	if public._deja_fait(p_evenement) then return; end if;
	p := public._exiger_saisie(a.volet, p_mois);
	if p_montant is null or p_montant <= 0 then
		raise exception 'Le montant doit être un nombre positif.' using errcode = 'P0001';
	end if;
	if lib = '' then
		raise exception 'Décrivez la dépense (exemple : « Achat de kits d’hygiène »).' using errcode = 'P0001';
	end if;
	insert into public.depenses (id, activite_id, volet, mois, montant, libelle, auteur)
	values (id_dep, a.id, a.volet, p_mois, p_montant, lib, p.id);
	perform public._journaliser(p_evenement, p, 'depense_ajoutee', a.volet, p_mois, 'depense', id_dep,
		lib || ' (' || a.numero || ')', 'a ajouté une dépense :', null, jsonb_build_object('montant', p_montant));
end;
$$;

-- ---------- Structure : activités, tâches, calendrier ----------

create function public.ajouter_activite(
	p_evenement text, p_id text, p_output text, p_libelle text, p_budget numeric, p_responsable text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	o public.outputs;
	v public.volets;
	lib text := trim(coalesce(p_libelle, ''));
	num text;
	id_act text := coalesce(p_id, gen_random_uuid()::text);
begin
	if public._deja_fait(p_evenement) then return; end if;
	select * into o from public.outputs where id = p_output;
	if not found then raise exception 'Output introuvable.' using errcode = 'P0001'; end if;
	v := public._volet(o.volet);
	if not public._peut_modifier_structure(p, v) then
		if v.cadre_verrouille and public._peut_ecrire_volet(p, v) then
			raise exception 'Le cadre logique de ce volet est verrouillé par APSUD : demandez un déverrouillage.' using errcode = '42501';
		end if;
		raise exception 'Vous ne pouvez pas modifier ce volet.' using errcode = '42501';
	end if;
	if lib = '' then raise exception 'Donnez un intitulé à l’activité.' using errcode = 'P0001'; end if;
	perform 1 from public.outputs where id = o.id for update; -- numérotation sans collision
	select o.numero || '.' || (count(*) + 1) into num from public.activites where output_id = o.id;
	insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie, cree_par)
	values (id_act, v.code, o.id, num, lib, nullif(trim(coalesce(p_responsable, '')), ''), greatest(coalesce(p_budget, 0), 0), p.id);
	perform public._journaliser(p_evenement, p, 'activite_creee', v.code, null, 'activite', id_act, num || ' ' || lib, 'a créé l’activité');
end;
$$;

create function public.ajouter_tache(
	p_evenement text, p_id text, p_activite text, p_libelle text, p_responsable text, p_date_debut date, p_date_fin date
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	a public.activites := public._activite(p_activite);
	lib text := trim(coalesce(p_libelle, ''));
	id_t text := coalesce(p_id, gen_random_uuid()::text);
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._peut_ecrire_volet(p, public._volet(a.volet)) then
		raise exception 'Vous ne pouvez pas modifier ce volet.' using errcode = '42501';
	end if;
	if lib = '' then raise exception 'Décrivez la tâche (« Action à prendre »).' using errcode = 'P0001'; end if;
	if p_date_debut is not null and p_date_fin is not null and p_date_fin < p_date_debut then
		raise exception 'La date de fin doit suivre la date de début.' using errcode = 'P0001';
	end if;
	insert into public.taches (id, volet, activite_id, libelle, responsable, date_debut, date_fin, ordre, cree_par)
	values (id_t, a.volet, a.id, lib, nullif(trim(coalesce(p_responsable, '')), ''), p_date_debut, p_date_fin,
		(select coalesce(max(ordre), 0) + 1 from public.taches where activite_id = a.id), p.id);
	perform public._journaliser(p_evenement, p, 'tache_creee', a.volet, null, 'tache', id_t, lib, 'a ajouté la tâche');
end;
$$;

/**
 * Coche ou décoche une semaine du calendrier S1-S5. L'appareil envoie l'état voulu
 * (et non « inverser ») : rejouer l'appel donne le même résultat.
 */
create function public.definir_semaine(
	p_evenement text, p_tache text, p_mois text, p_semaine smallint, p_champ text, p_valeur boolean
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	t public.taches;
begin
	if public._deja_fait(p_evenement) then return; end if;
	if p_champ not in ('prevu', 'realise') then raise exception 'Champ inconnu : %.', p_champ using errcode = 'P0001'; end if;
	select * into t from public.taches where id = p_tache;
	if not found then raise exception 'Tâche introuvable.' using errcode = 'P0001'; end if;
	if not public._peut_ecrire_volet(p, public._volet(t.volet)) then
		raise exception 'Vous ne pouvez pas modifier ce calendrier.' using errcode = '42501';
	end if;
	insert into public.taches_semaines (tache_id, mois, semaine, prevu, realise)
	values (t.id, p_mois, p_semaine, p_valeur, p_champ = 'realise' and p_valeur) -- réalisé implique prévu
	on conflict (tache_id, mois, semaine) do update set
		prevu = case when p_champ = 'prevu' then p_valeur when p_valeur then true else public.taches_semaines.prevu end,
		realise = case when p_champ = 'realise' then p_valeur else public.taches_semaines.realise end;
	perform public._journaliser(p_evenement, p, 'semaine_cochee', t.volet, p_mois, 'tache', t.id, t.libelle,
		format('a %s S%s (%s) pour', case when p_valeur then 'coché' else 'décoché' end, p_semaine,
			case when p_champ = 'prevu' then 'prévu' else 'réalisé' end));
end;
$$;

-- ---------- Justificatifs ----------

create function public.ajouter_justificatif(
	p_evenement text, p_id text, p_volet text, p_mois text,
	p_rattachement_type text, p_rattachement_id text,
	p_nom_fichier text, p_type_mime text, p_taille bigint, p_moyen text, p_chemin text
) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils;
	id_j text := coalesce(p_id, gen_random_uuid()::text);
	nom text := trim(coalesce(p_nom_fichier, ''));
begin
	if public._deja_fait(p_evenement) then return; end if;
	p := public._exiger_saisie(p_volet, p_mois);
	if nom = '' then raise exception 'Le fichier n’a pas de nom.' using errcode = 'P0001'; end if;
	insert into public.justificatifs (id, volet, mois, rattachement_type, rattachement_id, nom_fichier, type_mime, taille, chemin_stockage, moyen_verification, auteur)
	values (id_j, p_volet, p_mois, p_rattachement_type, p_rattachement_id, nom,
		coalesce(nullif(p_type_mime, ''), 'application/octet-stream'), greatest(coalesce(p_taille, 0), 0),
		nullif(p_chemin, ''), nullif(trim(coalesce(p_moyen, '')), ''), p.id);
	perform public._journaliser(p_evenement, p, 'justificatif_ajoute', p_volet, p_mois, 'justificatif', id_j, nom, 'a ajouté le justificatif');
end;
$$;

-- ---------- 5W du cluster WASH ----------

create function public.enregistrer_fiche_5w(p_evenement text, p_activite text, p_fiche jsonb) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	a public.activites := public._activite(p_activite);
	fiche jsonb;
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._peut_ecrire_volet(p, public._volet(a.volet)) then
		raise exception 'Seules l’ONG du volet et la coordination APSUD peuvent modifier la fiche 5W.' using errcode = '42501';
	end if;
	if coalesce(p_fiche ->> 'activite_cluster', '') = '' then
		raise exception 'Choisissez l’activité standard du cluster qui correspond à cette activité.' using errcode = 'P0001';
	end if;
	if coalesce(p_fiche ->> 'modalite', '') = '' or coalesce(p_fiche ->> 'type_beneficiaire', '') = '' or coalesce(p_fiche ->> 'reponse', '') = '' then
		raise exception 'Renseignez la modalité, le type de bénéficiaire et le type de réponse.' using errcode = 'P0001';
	end if;
	fiche := jsonb_build_object(
		'activite_cluster', p_fiche ->> 'activite_cluster',
		'modalite', p_fiche ->> 'modalite',
		'type_beneficiaire', p_fiche ->> 'type_beneficiaire',
		'reponse', p_fiche ->> 'reponse',
		'partenaires', nullif(trim(coalesce(p_fiche ->> 'partenaires', '')), '')
	);
	update public.activites set fiche_5w = fiche where id = a.id;
	perform public._journaliser(p_evenement, p, 'fiche_5w_modifiee', a.volet, null, 'activite', a.id, public._libelle_activite(a),
		'a mis à jour la fiche 5W de', a.fiche_5w, fiche);
end;
$$;

/** Contrôles d'une ligne 5W (depot.svelte.ts › #controlerLigne5W). */
create function public._controler_ligne_5w(l public.lignes_5w) returns void
	language plpgsql immutable set search_path = ''
as $$
begin
	if coalesce(l.sous_prefecture, '') = '' or coalesce(l.prefecture, '') = '' then
		raise exception 'Choisissez la sous-préfecture : le cluster demande une ligne par sous-préfecture.' using errcode = 'P0001';
	end if;
	if l.date_debut is not null and l.date_fin is not null and l.date_fin < l.date_debut then
		raise exception 'La date de fin doit suivre la date de début.' using errcode = 'P0001';
	end if;
	if num_nonnulls(l.filles, l.garcons, l.femmes, l.hommes) = 0 then
		raise exception 'Le cluster ne retient que les lignes avec des personnes atteintes : renseignez Filles, Garçons, Femmes ou Hommes.' using errcode = 'P0001';
	end if;
end;
$$;

create function public.ajouter_ligne_5w(p_evenement text, p_id text, p_activite text, p_mois text, p_champs jsonb) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	a public.activites := public._activite(p_activite);
	p public.profils;
	l public.lignes_5w;
begin
	if public._deja_fait(p_evenement) then return; end if;
	p := public._exiger_saisie(a.volet, p_mois);
	if a.fiche_5w is null then
		raise exception 'Complétez d’abord la fiche 5W de l’activité (activité standard, modalité, bénéficiaires).' using errcode = 'P0001';
	end if;
	l := jsonb_populate_record(null::public.lignes_5w, p_champs);
	l.id := coalesce(p_id, gen_random_uuid()::text);
	l.volet := a.volet; l.activite_id := a.id; l.mois := p_mois; l.auteur := p.id; l.date := now(); l.archive_le := null;
	l.statut := coalesce(nullif(l.statut, ''), 'En cours');
	perform public._controler_ligne_5w(l);
	insert into public.lignes_5w select l.*;
	perform public._journaliser(p_evenement, p, 'ligne_5w_ajoutee', a.volet, p_mois, 'activite', a.id,
		a.numero || ', ' || l.sous_prefecture, 'a ajouté une ligne 5W :');
end;
$$;

create function public.modifier_ligne_5w(p_evenement text, p_id text, p_champs jsonb) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	avant public.lignes_5w;
	l public.lignes_5w;
	p public.profils;
	a public.activites;
begin
	if public._deja_fait(p_evenement) then return; end if;
	select * into avant from public.lignes_5w where id = p_id;
	if not found then raise exception 'Ligne 5W introuvable.' using errcode = 'P0001'; end if;
	p := public._exiger_saisie(avant.volet, avant.mois);
	l := jsonb_populate_record(avant, p_champs - array['id', 'volet', 'activite_id', 'mois', 'auteur', 'date', 'archive_le']);
	l.auteur := p.id; l.date := now();
	perform public._controler_ligne_5w(l);
	update public.lignes_5w set
		prefecture = l.prefecture, sous_prefecture = l.sous_prefecture, commune = l.commune, village = l.village,
		latitude = l.latitude, longitude = l.longitude,
		quantite_prevue = l.quantite_prevue, quantite_realisee = l.quantite_realisee, personnes_ciblees = l.personnes_ciblees,
		filles = l.filles, garcons = l.garcons, femmes = l.femmes, hommes = l.hommes,
		date_debut = l.date_debut, date_fin = l.date_fin, statut = l.statut, commentaire = l.commentaire,
		auteur = l.auteur, date = l.date
	where id = p_id;
	a := public._activite(avant.activite_id);
	perform public._journaliser(p_evenement, p, 'ligne_5w_modifiee', avant.volet, avant.mois, 'activite', a.id,
		a.numero || ', ' || l.sous_prefecture, 'a modifié une ligne 5W :', to_jsonb(avant), to_jsonb(l));
end;
$$;

-- ---------- Circuit de validation (ARCHITECTURE.md §6) ----------

create function public.changer_statut_rapport(p_evenement text, p_volet text, p_mois text, p_vers text, p_motif text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	v public.volets := public._volet(p_volet);
	r public.rapports;
	depart text;
	permis boolean := false;
	motif_requis boolean := false;
	v_motif text := nullif(trim(coalesce(p_motif, '')), '');
	type_ev text;
	resume text;
	nb_cibles int;
	nb_saisis int;
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not exists (select 1 from public.periodes where mois = p_mois) then
		raise exception 'Le mois % ne fait pas partie du projet.', p_mois using errcode = 'P0001';
	end if;
	insert into public.rapports (id, volet, mois) values (p_volet || ':' || p_mois, p_volet, p_mois) on conflict (volet, mois) do nothing;
	select * into r from public.rapports where volet = p_volet and mois = p_mois for update;
	depart := r.statut;

	-- regles.ts › transitionsPossibles
	if depart in ('non_commence', 'brouillon', 'a_corriger') and p_vers = 'soumis' then
		permis := public._peut_ecrire_volet(p, v);
	elsif depart = 'soumis' and p_vers in ('valide', 'a_corriger') then
		permis := public._est_coordination(p); motif_requis := p_vers = 'a_corriger';
	elsif depart = 'valide' and p_vers in ('verrouille', 'a_corriger') then
		permis := public._est_coordination(p); motif_requis := p_vers = 'a_corriger';
	elsif depart = 'verrouille' and p_vers = 'valide' then
		permis := public._est_coordination(p); motif_requis := true;
	end if;
	if not permis then
		raise exception 'Action impossible : ce rapport (%) ne peut pas passer à « % » avec votre rôle.', depart, p_vers using errcode = '42501';
	end if;
	if motif_requis and v_motif is null then
		raise exception 'Indiquez le motif : il sera visible par l’ONG et inscrit au journal.' using errcode = 'P0001';
	end if;
	if p_vers = 'soumis' then
		select count(*) into nb_cibles from public.indicateurs i where i.volet = p_volet and i.archive_le is null and coalesce(i.cible_total, 0) <> 0;
		select count(*) into nb_saisis from public.indicateurs i
			join public.valeurs va on va.indicateur_id = i.id and va.mois = p_mois and va.courante
			where i.volet = p_volet and i.archive_le is null and coalesce(i.cible_total, 0) <> 0;
		if nb_cibles > 0 and nb_saisis = 0 then
			raise exception 'Le rapport est vide : saisissez au moins un indicateur avant de le soumettre.' using errcode = 'P0001';
		end if;
		update public.rapports set statut = 'soumis', soumis_par = p.id, soumis_le = now(), motif = null where id = r.id;
	else
		update public.rapports set statut = p_vers, decision_par = p.id, decision_le = now(), motif = v_motif where id = r.id;
	end if;

	type_ev := case p_vers
		when 'soumis' then 'rapport_soumis'
		when 'valide' then case when depart = 'verrouille' then 'rapport_deverrouille' else 'rapport_valide' end
		when 'a_corriger' then 'rapport_a_corriger'
		when 'verrouille' then 'rapport_verrouille' end;
	resume := case p_vers
		when 'soumis' then 'a soumis le rapport'
		when 'valide' then case when depart = 'verrouille' then 'a déverrouillé le rapport' else 'a validé le rapport' end
		when 'a_corriger' then 'a renvoyé pour correction le rapport'
		when 'verrouille' then 'a verrouillé le rapport' end;
	perform public._journaliser(p_evenement, p, type_ev, p_volet, p_mois, 'rapport', r.id, p_volet || ', ' || p_mois, resume,
		to_jsonb(depart), to_jsonb(p_vers));
end;
$$;

create function public.definir_verrou_cadre(p_evenement text, p_volet text, p_verrouille boolean) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	v public.volets := public._volet(p_volet);
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._est_coordination(p) then
		raise exception 'Seule la coordination APSUD verrouille un cadre logique.' using errcode = '42501';
	end if;
	if v.cadre_verrouille = p_verrouille then return; end if;
	update public.volets set cadre_verrouille = p_verrouille where code = v.code;
	perform public._journaliser(p_evenement, p, case when p_verrouille then 'cadre_verrouille' else 'cadre_deverrouille' end,
		v.code, null, 'volet', v.code, 'cadre logique ' || v.code,
		case when p_verrouille then 'a verrouillé le' else 'a déverrouillé le' end);
end;
$$;

-- ---------- Archivage, restauration, suppression définitive ----------

create function public._table_archivable(p_type text) returns text
	language plpgsql immutable set search_path = ''
as $$
begin
	return case p_type
		when 'activite' then 'activites'
		when 'tache' then 'taches'
		when 'indicateur' then 'indicateurs'
		when 'depense' then 'depenses'
		when 'justificatif' then 'justificatifs'
		when 'ligne_5w' then 'lignes_5w'
	end;
end;
$$;

create function public._element(p_type text, p_id text) returns jsonb
	language plpgsql stable security definer set search_path = ''
as $$
declare
	nom_table text := public._table_archivable(p_type);
	e jsonb;
begin
	if nom_table is null then raise exception 'Type d’élément inconnu : %.', p_type using errcode = 'P0001'; end if;
	execute format('select to_jsonb(t) from public.%I t where t.id = $1', nom_table) into e using p_id;
	if e is null then raise exception 'Élément introuvable.' using errcode = 'P0001'; end if;
	return e;
end;
$$;

create function public._libelle_element(e jsonb) returns text
	language sql immutable set search_path = ''
as $$
	select coalesce(e ->> 'libelle', e ->> 'nom_fichier',
		case when e ? 'sous_prefecture' then 'ligne 5W, ' || (e ->> 'sous_prefecture') end, e ->> 'id')
$$;

create function public.archiver(p_evenement text, p_type text, p_id text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	e jsonb := public._element(p_type, p_id);
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._peut_ecrire_volet(p, public._volet(e ->> 'volet')) then
		raise exception 'Vous ne pouvez archiver que les éléments de votre organisation.' using errcode = '42501';
	end if;
	execute format('update public.%I set archive_le = now() where id = $1 and archive_le is null', public._table_archivable(p_type)) using p_id;
	perform public._journaliser(p_evenement, p, 'element_archive', e ->> 'volet', null, p_type, p_id, public._libelle_element(e), 'a archivé');
end;
$$;

create function public.restaurer(p_evenement text, p_type text, p_id text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	e jsonb := public._element(p_type, p_id);
begin
	if public._deja_fait(p_evenement) then return; end if;
	if not public._est_coordination(p) then
		raise exception 'Seule la coordination APSUD restaure un élément archivé.' using errcode = '42501';
	end if;
	execute format('update public.%I set archive_le = null where id = $1', public._table_archivable(p_type)) using p_id;
	perform public._journaliser(p_evenement, p, 'element_restaure', e ->> 'volet', null, p_type, p_id, public._libelle_element(e), 'a restauré');
end;
$$;

/** Suppression définitive : super-administrateur uniquement, et toujours journalisée (avec la ligne supprimée). */
create function public.supprimer_definitivement(p_evenement text, p_type text, p_id text) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
	e jsonb;
begin
	if public._deja_fait(p_evenement) then return; end if;
	if p.role <> 'super_admin' then
		raise exception 'Suppression refusée : seul le super-administrateur peut supprimer définitivement. Utilisez « Archiver ».' using errcode = '42501';
	end if;
	e := public._element(p_type, p_id);
	perform public._journaliser(p_evenement, p, 'element_supprime', e ->> 'volet', null, p_type, p_id, public._libelle_element(e),
		'a supprimé définitivement', e, null);
	execute format('delete from public.%I where id = $1', public._table_archivable(p_type)) using p_id;
end;
$$;

-- ---------- Notifications ----------

/** Marque comme lues ses propres notifications (toutes, ou celles d'un événement). */
create function public.marquer_lu(p_evenement_id text default null) returns void
	language plpgsql security definer set search_path = ''
as $$
begin
	perform public._moi();
	update public.notifications set lue = true
	where destinataire = auth.uid() and not lue and (p_evenement_id is null or evenement_id = p_evenement_id);
end;
$$;

-- ---------- Comptes et invitations ----------

/**
 * Crée une invitation et renvoie le code (affiché une seule fois, à transmettre à la personne).
 * Coordination : comptes de saisie et de lecture. Super-administrateur : tous les rôles.
 */
create function public.creer_invitation(p_email text, p_nom text, p_fonction text, p_organisation text, p_role text) returns text
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
	if p_role in ('coordination', 'super_admin') and p.role <> 'super_admin' then
		raise exception 'Seul le super-administrateur crée un compte de coordination ou d’administration.' using errcode = '42501';
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

/** Vérifie un code avant l'inscription (appelable sans compte) ; ne révèle rien si le code est faux. */
create function public.verifier_invitation(p_code text, p_email text)
	returns table (nom text, fonction text, organisation text, role text)
	language sql stable security definer set search_path = ''
as $$
	select i.nom, i.fonction, i.organisation, i.role
	from public.invitations i
	where i.code_hache = public._hacher_code(p_code)
		and i.email = lower(trim(coalesce(p_email, '')))
		and i.utilisee_le is null and i.archive_le is null and i.expire_le > now()
$$;

/** Super-administrateur : change le rôle d'un compte ou le désactive (jamais de suppression). */
create function public.modifier_compte(p_profil uuid, p_role text, p_actif boolean) returns void
	language plpgsql security definer set search_path = ''
as $$
declare
	p public.profils := public._moi();
begin
	if p.role <> 'super_admin' then
		raise exception 'Seul le super-administrateur gère les comptes.' using errcode = '42501';
	end if;
	if p_profil = p.id and (p_role <> 'super_admin' or not p_actif) then
		raise exception 'Vous ne pouvez pas retirer vos propres droits d’administration.' using errcode = 'P0001';
	end if;
	update public.profils set role = coalesce(p_role, role), actif = coalesce(p_actif, actif) where id = p_profil;
	if not found then raise exception 'Compte introuvable.' using errcode = 'P0001'; end if;
end;
$$;

/**
 * Amorçage : crée l'invitation du premier super-administrateur et renvoie son code.
 * À exécuter UNE fois dans l'éditeur SQL de Supabase ; refusé dès qu'un super-administrateur existe.
 * Aucun compte de l'application ne peut l'appeler (droits retirés en 0005).
 */
create function public.amorcer_super_admin(p_email text, p_nom text) returns text
	language plpgsql security definer set search_path = ''
as $$
declare
	code text := public._nouveau_code();
begin
	if exists (select 1 from public.profils where role = 'super_admin') then
		raise exception 'Un super-administrateur existe déjà : utilisez l’écran Administration pour inviter.' using errcode = 'P0001';
	end if;
	update public.invitations set archive_le = now() where email = lower(trim(p_email)) and utilisee_le is null and archive_le is null;
	insert into public.invitations (code_hache, email, nom, fonction, organisation, role)
	values (public._hacher_code(code), lower(trim(p_email)), trim(p_nom), 'Administration de la plateforme', 'APSUD', 'super_admin');
	return code;
end;
$$;


-- >>>>>>>>>> 20261122090005_securite.sql
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


-- >>>>>>>>>> 20261122090006_temps_reel_et_stockage.sql
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


-- >>>>>>>>>> 20261122090007_donnees_reference.sql
-- =============================================================================
-- 0007 · Données de référence du consortium FH
-- Organisations, secteurs, projet, mois de reporting, volets et rapports mensuels.
-- Le cadre logique (outcomes, outputs, activités, indicateurs) se charge à part,
-- après validation des anomalies par APSUD (D1) : supabase/seed/cadre-logique.sql.
-- =============================================================================

insert into public.organisations (sigle, nom, role_consortium, ville) values
	('APSUD', 'Action pour la Population et le Développement Durable', 'chef_de_file', 'Bimbo'),
	('ARS', 'African Relief Service', 'partenaire', null),
	('AFPE', 'Association des Femmes pour la Promotion de l’Entrepreneuriat', 'partenaire', null),
	('GADY', 'GADY, ONG nationale (nom développé à confirmer)', 'partenaire', null),
	('IDC', 'Initiative Développement Centrafrique', 'partenaire', null);

insert into public.secteurs (code, libelle, libelle_court, cluster_cbpf) values
	('WASH', 'Eau, hygiène et assainissement', 'WASH', 'WSH'),
	('NUT', 'Nutrition', 'Nutrition', 'NUT'),
	('SAN', 'Santé', 'Santé', 'HEA'),
	('PE', 'Protection de l’enfance et VBG', 'Protection', 'PRO'),
	('SECAL', 'Sécurité alimentaire', 'Sécurité alimentaire', 'FSA');

insert into public.projet (code_cbpf, intitule, bailleur, date_debut, date_fin, devise, zones, objectif_general) values (
	'CBPF-CAR-26-R-NGO-NSFT-41469',
	'Projet d''assistance d''urgence intégrée en WASH, Sécurité alimentaire, Santé, Nutrition et Protection (Enfance et VBG) à Nanga-Boguila, Paoua et Bossangoa',
	'Fonds humanitaire RCA (FH)',
	'2026-11-08', '2027-08-30', 'USD',
	array['Nanga-Boguila', 'Paoua', 'Bossangoa'],
	'Contribuer à la réduction de la mortalité et de la morbidité, et améliorer les conditions de vie et la dignité des populations affectées par la crise dans les sous-préfectures de Nanga-Boguila, Paoua et Bossangoa.'
);

-- 10 mois de reporting ; échéance le 5 du mois suivant (D4).
insert into public.periodes (mois, rang, echeance)
select to_char(m, 'YYYY-MM'), row_number() over (order by m), (m + interval '1 month' + interval '4 days')::date
from generate_series(date '2026-11-01', date '2027-08-01', interval '1 month') m;

insert into public.volets (code, organisation, secteur) values
	('NUT-ARS', 'ARS', 'NUT'),
	('SAN-ARS', 'ARS', 'SAN'),
	('PE-AFPE', 'AFPE', 'PE'),
	('SECAL-GADY', 'GADY', 'SECAL'),
	('WASH-IDC', 'IDC', 'WASH');

insert into public.rapports (id, volet, mois)
select v.code || ':' || p.mois, v.code, p.mois from public.volets v cross join public.periodes p;


-- >>>>>>>>>> 20261122090008_roles_et_nouvelles_ong.sql
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


-- >>>>>>>>>> 20261122090009_cadre_logique_provisoire.sql
-- =============================================================================
-- 0009 · Cadre logique PROVISOIRE des 5 plans d'action du consortium FH
-- (généré par scripts/import-excel/vers-sql.mjs, ne pas modifier à la main)
-- Source : docs/excel (5 plans d’action du consortium FH), structure lue le 2026-11-21T22:41:02.973Z
-- 6 outcomes, 12 outputs, 37 activités, 51 indicateurs.
--
-- Chargé AVANT la validation des anomalies par APSUD (D1), pour que l'outil soit utilisable :
--   - séparateurs de milliers corrigés à l'import (A7 à A9) ;
--   - budgets planifiés à 0 (valeurs de remplissage à 100 dans les fichiers, A2) ;
--   - tâches non reprises (modèle identique dans les 5 fichiers, A3) : chaque ONG crée les siennes ;
--   - les autres anomalies restent visibles dans Administration › Anomalies d'import.
-- Les corrections validées par APSUD passeront par une NOUVELLE migration (jamais en
-- modifiant celle-ci, déjà appliquée au projet en ligne).
-- =============================================================================

-- ===== Volet NUT-ARS (Plan d'action_FH - US Consortium APSUD - NUT ARS.xlsx) =====
insert into public.outcomes (id, volet, numero, libelle) values ('NUT-ARS:oc:1', 'NUT-ARS', '1', 'Renforcer le dépistage, le référencement et la prise en charge de la malnutrition aiguë sévère chez les enfants de 6-59 mois dans les 5 formations sanitaires ciblées ( Dispensaire de Boguila, l’UNT de l’hopital de district de Booguila, CS de Boanssen, PS de Boya et PS de Bomantana)');
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('NUT-ARS:ind:1', 'NUT-ARS', 'outcome', 'NUT-ARS:oc:1', 1, null, 'Nombre total d''enfants dépistés', 'nombre', 'somme', true, 0, 3838, 0, 3687, 7525, array['Fiches de dépistage', 'rapports des relais', 'rapport d''activité']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('NUT-ARS:ind:2', 'NUT-ARS', 'outcome', 'NUT-ARS:oc:1', 2, null, 'Taux de guérison', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 75, array['Registre UNT', 'UNTA', 'rapport']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('NUT-ARS:ind:3', 'NUT-ARS', 'outcome', 'NUT-ARS:oc:1', 3, null, 'Nombre des agents de santé formés sur la PCIMA', 'nombre', 'somme', false, 0, 0, 0, 0, 25, array['Rapport de formation', 'TDR, fiche de présence', 'images']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('NUT-ARS:ind:4', 'NUT-ARS', 'outcome', 'NUT-ARS:oc:1', 4, null, 'Nombre des enfants MAS prise en charge dans les UNTA= 200 (Garçon =98, filles=102)', 'nombre', 'somme', false, 0, 0, 0, 0, 200, array['Registre d’admission MAS,', 'rapport mensuel de prise en charge UNTA']::text[], null);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('NUT-ARS:op:1.1', 'NUT-ARS', 'NUT-ARS:oc:1', '1.1', 'Le dépistage actif et passif de la malnutrition aiguë est renforcé dans les 5 formations sanitaires, et les enfants dépistés MAS sont référés et pris en charge en UNT/UNTA.');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('NUT-ARS:act:1.1.1', 'NUT-ARS', 'NUT-ARS:op:1.1', '1.1.1', 'Prise en charge en UNT (Unité Nutritionnelle Thérapeutique)', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('NUT-ARS:ind:5', 'NUT-ARS', 'activite', 'NUT-ARS:act:1.1.1', 5, null, 'Nomvre d''enfants pris en charge en UNT', 'nombre', 'somme', false, null, null, null, null, null, '{}'::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('NUT-ARS:act:1.1.2', 'NUT-ARS', 'NUT-ARS:op:1.1', '1.1.2', 'Prise en charge en UNTA (Unité de Nutrition Thérapeutique Ambulatoire)', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('NUT-ARS:ind:6', 'NUT-ARS', 'activite', 'NUT-ARS:act:1.1.2', 6, null, 'Nomvre d''enfants pris en charge en UNTA', 'nombre', 'somme', false, null, null, null, null, null, '{}'::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('NUT-ARS:act:1.1.3', 'NUT-ARS', 'NUT-ARS:op:1.1', '1.1.3', 'Formation/recyclage des agents de santé sur La PEC selon le protocole national', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('NUT-ARS:ind:7', 'NUT-ARS', 'activite', 'NUT-ARS:act:1.1.3', 7, null, 'Nombre des agents de santé formés sur la PEC selon le protocole national', 'nombre', 'somme', false, null, null, null, null, null, '{}'::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('NUT-ARS:act:1.1.4', 'NUT-ARS', 'NUT-ARS:op:1.1', '1.1.4', 'Formation/recyclage des agents de santé communautaires', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('NUT-ARS:ind:8', 'NUT-ARS', 'activite', 'NUT-ARS:act:1.1.4', 8, null, 'Nombres des agents de ssantés communautaires formés', 'nombre', 'somme', false, null, null, null, null, null, '{}'::text[], null);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('NUT-ARS:ind:9', 'NUT-ARS', 'activite', 'NUT-ARS:act:1.1.4', 9, 'NUT/C-CA5/N.3a', 'Number of people admitted to SAM treatment programme (therapeutic feeding)', 'nombre', 'somme', true, 0, 0, 26, 24, 50, '{}'::text[], null);

-- ===== Volet SAN-ARS (Plan d'action_FH - US Consortium APSUD- SANTE ARS.xlsx) =====
insert into public.outcomes (id, volet, numero, libelle) values ('SAN-ARS:oc:1', 'SAN-ARS', '1', 'Améliorer l''accès à des soins curatifs, à l''accouchement assisté et à la PEC des VBG dans les 5 FOSA');
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SAN-ARS:ind:1', 'SAN-ARS', 'outcome', 'SAN-ARS:oc:1', 1, null, 'Nombre de consultations curatives réalisées : 8362', 'nombre', 'somme', false, 0, 0, 0, 0, 8362, array['Registres de consultation', 'rapports GBV désagrégés et sécurisés', 'registres de maternité']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SAN-ARS:ind:2', 'SAN-ARS', 'outcome', 'SAN-ARS:oc:1', 2, null, 'Taux d''accouchements assistés : 40%', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 40, array['Registres de consultation', 'rapports GBV désagrégés et sécurisés', 'registres de maternité']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SAN-ARS:ind:3', 'SAN-ARS', 'outcome', 'SAN-ARS:oc:1', 3, null, 'Taux de rupture de stock des médicaments traceurs inferieur à (< 10 %)', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 10, array['Fiches de stock', 'rapports d''approvisionnement']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SAN-ARS:ind:4', 'SAN-ARS', 'outcome', 'SAN-ARS:oc:1', 4, null, 'Nombre d''agents appuyés', 'nombre', 'somme', true, 11, 0, 14, 0, 25, array['Registres de consultation', 'fiches de paie/primes']::text[], null);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('SAN-ARS:op:1.1', 'SAN-ARS', 'SAN-ARS:oc:1', '1.1', 'L''offre de consultations curatives de qualité est renforcée dans les 5 formations sanitaires');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SAN-ARS:act:1.1.1', 'SAN-ARS', 'SAN-ARS:op:1.1', '1.1.1', 'Consultations curatives réalisées désagrégées par sexe/CONSULTATION CURATIVE', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SAN-ARS:ind:5', 'SAN-ARS', 'activite', 'SAN-ARS:act:1.1.1', 5, null, 'Number of primary healthcare consultations provided', 'nombre', 'somme', false, 0, 0, 0, 0, 8362, array['Registres de consultation', 'registres de maternité', 'rapports GBV désagrégés et sécurisés']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SAN-ARS:act:1.1.2', 'SAN-ARS', 'SAN-ARS:op:1.1', '1.1.2', 'Accouchements assistés par un personnel qualifié dans les zones affectées par un choc humanitaire/ACCOUCHEMENT ASSISTE', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SAN-ARS:ind:6', 'SAN-ARS', 'activite', 'SAN-ARS:act:1.1.2', 6, null, 'Number of functional health facilities supported', 'nombre', 'somme', false, 0, 0, 0, 0, 5, array['Rapport mensuel de FOSA', 'Rapports hebdomadaires', 'images']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SAN-ARS:act:1.1.3', 'SAN-ARS', 'SAN-ARS:op:1.1', '1.1.3', 'Pris en charge des cas de viol dans les 72 heures désagrégés par sexe et par tranche d''âge/ PRISE EN CHARGE MEDICALE DES VBG (VIOL)', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SAN-ARS:ind:7', 'SAN-ARS', 'activite', 'SAN-ARS:act:1.1.3', 7, null, 'Number of frontline or community health workers trained/oriented on emergency surveillance or reporting', 'nombre', 'somme', true, 14, 11, 0, 0, 25, array['TDR, rapport de formation', 'fiche de présence', 'images']::text[], null);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SAN-ARS:ind:8', 'SAN-ARS', 'activite', 'SAN-ARS:act:1.1.3', 8, null, 'Number of violence survivors receiving medical assistance, including clinical management of rape', 'nombre', 'somme', true, 0, 20, 0, 40, 60, array['Registres de consultation', 'rapports GBV désagrégés et sécurisés']::text[], null);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('SAN-ARS:op:1.2', 'SAN-ARS', 'SAN-ARS:oc:1', '1.2', 'L''accès à un accouchement assisté par du personnel qualifié est amélioré');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SAN-ARS:act:1.2.1', 'SAN-ARS', 'SAN-ARS:op:1.2', '1.2.1', 'Accouchements assistés par un personnel qualifié dans les zones affectées par un choc humanitaire/ACCOUCHEMENT ASSISTE', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SAN-ARS:ind:9', 'SAN-ARS', 'activite', 'SAN-ARS:act:1.2.1', 9, null, 'Number of births attended by skilled health personnel', 'nombre', 'somme', false, 0, 0, 0, 0, 614, array['registres de maternité', 'Fiches de stock']::text[], null);

-- ===== Volet PE-AFPE (Plan d'action_FH - US Consortium APSUD- PE AFPE.xlsx) =====
insert into public.outcomes (id, volet, numero, libelle) values ('PE-AFPE:oc:1', 'PE-AFPE', '1', 'Assurer un environnement protecteur pour les enfants affectés par les conflits et répondre à leurs besoins de protection');
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('PE-AFPE:ind:1', 'PE-AFPE', 'outcome', 'PE-AFPE:oc:1', 1, null, 'Nombre d''enfants pris en charge dans les deux sous préfecture (Bossangoa et Nanga-Boguila): 400', 'nombre', 'somme', false, 0, 0, 0, 0, 400, array['Fiche d''enregistrement,', 'rapport d''activités']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('PE-AFPE:ind:2', 'PE-AFPE', 'outcome', 'PE-AFPE:oc:1', 2, null, 'Nombre de personnes touchées par la sensibilisation sur les droits des enfants', 'nombre', 'somme', true, 940, 880, 450, 900, 3170, array['Images, rapports,', 'comptes rendu causerie éducative']::text[], null);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('PE-AFPE:op:1.1', 'PE-AFPE', 'PE-AFPE:oc:1', '1.1', 'Les enfants séparés, non accompagnés ou vulnérables bénéficient d’une prise en charge holistique');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('PE-AFPE:act:1.1.1', 'PE-AFPE', 'PE-AFPE:op:1.1', '1.1.1', 'Prise en charge psychosociale communautaire des enfants et adolescent(e)s affectés par les chocs', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('PE-AFPE:ind:3', 'PE-AFPE', 'activite', 'PE-AFPE:act:1.1.1', 3, null, 'Number of children receiving protection support (e.g. family tracing, reunification, reintegration, case management services, etc)', 'nombre', 'somme', true, 0, 0, 10, 20, 30, array['Rapport d''activité']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('PE-AFPE:act:1.1.2', 'PE-AFPE', 'PE-AFPE:op:1.1', '1.1.2', 'Protection et réintégration des filles et garçons associés aux forces et groupes armés (EAFGA)', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('PE-AFPE:ind:4', 'PE-AFPE', 'activite', 'PE-AFPE:act:1.1.2', 4, 'PRO/C-CA5/AS.10', 'Number of people receiving recurrent services', 'nombre', 'somme', true, 0, 0, 150, 250, 400, array['Rapport d''activité']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('PE-AFPE:act:1.1.3', 'PE-AFPE', 'PE-AFPE:op:1.1', '1.1.3', 'Prise en charge et/ou référencement des survivant(e)s de violences physiques ou sexuelles', null, 0);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('PE-AFPE:op:1.2', 'PE-AFPE', 'PE-AFPE:oc:1', '1.2', 'Le bien-être psychosocial des enfants est amélioré');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('PE-AFPE:act:1.2.1', 'PE-AFPE', 'PE-AFPE:op:1.2', '1.2.1', 'Sensibilisation de proximité pour réduire l''exposition des enfants aux risques de protection', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('PE-AFPE:ind:5', 'PE-AFPE', 'activite', 'PE-AFPE:act:1.2.1', 5, null, 'Number of children receiving protection support (e.g. family tracing, reunification, reintegration, case management services, etc)', 'nombre', 'somme', true, 0, 0, 20, 10, 30, array['Rapport d''activité']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('PE-AFPE:act:1.2.2', 'PE-AFPE', 'PE-AFPE:op:1.2', '1.2.2', 'Renforcement des capacités des groupes communautaires en PE', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('PE-AFPE:ind:6', 'PE-AFPE', 'activite', 'PE-AFPE:act:1.2.2', 6, null, 'Number of children receiving protection support (e.g. family tracing, reunification, reintegration, case management services, etc)', 'nombre', 'somme', true, 0, 0, 150, 250, 400, array['Rapport d''activité']::text[], null);

-- ===== Volet SECAL-GADY (Plan d'action_FH - US Consortium APSUD- SECAL- GADY.xlsx) =====
insert into public.outcomes (id, volet, numero, libelle) values ('SECAL-GADY:oc:1', 'SECAL-GADY', '1', 'Améliorer l’accès immédiat à la nourriture aux  personnes vulnérables');
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:1', 'SECAL-GADY', 'outcome', 'SECAL-GADY:oc:1', 1, null, 'Nombre de personnes touchées par l''assistance alimentaire pendant 3 mois (demi-ration)', 'nombre', 'somme', true, 1000, 0, 1000, 0, 2000, array['Listes d''émargement des bénéficiaires', 'Rapports de distribution', 'images']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:2', 'SECAL-GADY', 'outcome', 'SECAL-GADY:oc:1', 2, null, 'Pourcentage de bénéficiaires ciblés ayant effectivement reçu la demi-ration standard prévue (50% des besoins caloriques)', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 100, array['Décharge', 'images', 'rapport d''activité']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:3', 'SECAL-GADY', 'outcome', 'SECAL-GADY:oc:1', 3, null, 'Pourcentage de ménages ciblés ayant un score de consommation alimentaire « acceptable » à la fin des 3 mois, comparé à la situation de référence (baseline).', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 80, array['Rapport PDM réalisé après la distribution']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:4', 'SECAL-GADY', 'outcome', 'SECAL-GADY:oc:1', 4, null, 'Pourcentage de bénéficiaires satisfaits des modalités de distribution, de la qualité des produits et du comportement du personnel', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 70, array['Rapport d''enquête', 'Rapport PDM']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:5', 'SECAL-GADY', 'outcome', 'SECAL-GADY:oc:1', 5, null, 'Taux de réception de ration conforme', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 90, array['Rapport PDM']::text[], null);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('SECAL-GADY:op:1.1', 'SECAL-GADY', 'SECAL-GADY:oc:1', '1.1', 'L''accès immédiat à la nourriture est garanti pour les ménages en insécurité alimentaire sévère (IPC 3) en demi ration pendant trois mois');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:1.1.1', 'SECAL-GADY', 'SECAL-GADY:op:1.1', '1.1.1', 'Assistance alimentaire — 3 mois, demi-ration /Général', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:6', 'SECAL-GADY', 'activite', 'SECAL-GADY:act:1.1.1', 6, null, 'Number of people receiving recurrent services', 'nombre', 'somme', true, 1000, 0, 1000, 0, 2000, array['Listes d''émargement des bénéficiaires', 'Rapports de distribution et images']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:1.1.2', 'SECAL-GADY', 'SECAL-GADY:op:1.1', '1.1.2', 'CIBLAGES DES BENEFICIAIRES /OS1-1 : Assistance alimentaire — 3 mois, demi-ration', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:7', 'SECAL-GADY', 'activite', 'SECAL-GADY:act:1.1.2', 7, null, 'Quantity of food assistance distributed in MT', 'nombre', 'somme', false, 0, 0, 0, 0, 124, '{}'::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:1.1.3', 'SECAL-GADY', 'SECAL-GADY:op:1.1', '1.1.3', 'ORGANISATION DE LA DISTRIBUTION / OS1-1 : Assistance alimentaire — 3 mois, demi-ration', null, 0);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:1.1.4', 'SECAL-GADY', 'SECAL-GADY:op:1.1', '1.1.4', 'DISTRIBUTION ALIMENTAIRE /OS1-1 : Assistance alimentaire — 3 mois, demi-ration', null, 0);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:1.1.5', 'SECAL-GADY', 'SECAL-GADY:op:1.1', '1.1.5', 'EDUCATION NUTRITIONNELLE / OS1-1 : Assistance alimentaire — 3 mois, demi-ration', null, 0);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:1.1.6', 'SECAL-GADY', 'SECAL-GADY:op:1.1', '1.1.6', 'PHASE DE SUIVI ET CLOTURE (Après la distribution)/ OS1-1 : Assistance alimentaire — 3 mois, demi-ration', null, 0);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('SECAL-GADY:op:1.2', 'SECAL-GADY', 'SECAL-GADY:oc:1', '1.2', 'L''accès immédiat à la nourriture est garanti pour les ménages en insécurité alimentaire sévère (IPC 4) avec 80% de ration couverte pendant pendant 6 mois');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:1.2.1', 'SECAL-GADY', 'SECAL-GADY:op:1.2', '1.2.1', 'Phase Pré-distribution (Planification et Ciblage)/ OS1-2 : Assistance alimentaire — 6 mois, 80% ration complète', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:8', 'SECAL-GADY', 'activite', 'SECAL-GADY:act:1.2.1', 8, null, 'Quantity of food assistance distributed in MT', 'nombre', 'somme', false, 0, 0, 0, 0, 51, array['Fiche de distribution', 'rapport de distribution', 'images']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:1.2.2', 'SECAL-GADY', 'SECAL-GADY:op:1.2', '1.2.2', 'Phase de Distribution (Opérations sur le site)/ OS1-2 : Assistance alimentaire — 6 mois, 80% ration complète', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:9', 'SECAL-GADY', 'activite', 'SECAL-GADY:act:1.2.2', 9, 'FSA/C-CA5/AS.10', 'Number of people receiving recurrent services', 'nombre', 'somme', true, 150, 0, 150, 0, 300, array['décharges signée par les bénéficiaires, de vivres', 'rapports de distribution', 'rapport PDM']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:1.2.3', 'SECAL-GADY', 'SECAL-GADY:op:1.2', '1.2.3', 'Phase Post-distribution (Suivi et Redevabilité)/ OS1-2 : Assistance alimentaire — 6 mois, 80% ration complète', null, 0);
insert into public.outcomes (id, volet, numero, libelle) values ('SECAL-GADY:oc:2', 'SECAL-GADY', '2', 'Améliorer la sécurité alimentaire et nutritionnelle des ménages vulnérables à travers l''appui à leur production agricoles et l''optimisation de leur capital d''élevage d''urgence.');
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:10', 'SECAL-GADY', 'outcome', 'SECAL-GADY:oc:2', 10, null, '(FSA/AP.2b) Percentage of affected people who state that they are aware of feedback and complaints mechanisms established for their use', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 70, array['Rapport MEAL']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:11', 'SECAL-GADY', 'outcome', 'SECAL-GADY:oc:2', 11, null, 'Nombre de bénéficiaires assistés en production animale', 'nombre', 'somme', true, 250, 0, 250, 0, 500, array['Listes d''émargement des chefs de ménages bénéficiaire', 'images', 'Rapports de distribution des petits ruminants et autres kits']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:12', 'SECAL-GADY', 'outcome', 'SECAL-GADY:oc:2', 12, null, '% de ménage satisfait de l''appui', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 80, array['rapport Evaluation finale', 'Rapport PDM']::text[], null);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('SECAL-GADY:op:2.1', 'SECAL-GADY', 'SECAL-GADY:oc:2', '2.1', 'Les capacités de production agricole des ménages vulnérables sont renforcées');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:2.1.1', 'SECAL-GADY', 'SECAL-GADY:op:2.1', '2.1.1', 'Distribution de kits d''intrants maraîchers d''urgence', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:13', 'SECAL-GADY', 'activite', 'SECAL-GADY:act:2.1.1', 13, 'FSA/C-CA4/Ag.1', 'Number of people receiving agricultural inputs (items/packages/kits)', 'nombre', 'somme', true, 1125, 625, 250, 500, 2500, array['Listes d''émargement des bénéficiaires', 'Rapports de distribution et images']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:2.1.2', 'SECAL-GADY', 'SECAL-GADY:op:2.1', '2.1.2', 'Dotation en matériel et petits équipements de production (Outils aratoires de base)', null, 0);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:2.1.3', 'SECAL-GADY', 'SECAL-GADY:op:2.1', '2.1.3', 'Renforcement des capacités express et éducation nutritionnelle', null, 0);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:2.1.4', 'SECAL-GADY', 'SECAL-GADY:op:2.1', '2.1.4', 'SUIVI DE PROXIMITE', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:14', 'SECAL-GADY', 'activite', 'SECAL-GADY:act:2.1.4', 14, 'FSA/C-CA3/AS.8', 'Percentage of issues identified in feedback processes for which solutions are in process or closed', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 70, '{}'::text[], null);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('SECAL-GADY:op:2.2', 'SECAL-GADY', 'SECAL-GADY:oc:2', '2.2', 'Les capacités de production animale des ménages vulnérables sont renforcées');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:2.2.1', 'SECAL-GADY', 'SECAL-GADY:op:2.2', '2.2.1', 'APPUI AUX PETITS RUMINANTS/ANIMAUX D''ELEVAGE', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:15', 'SECAL-GADY', 'activite', 'SECAL-GADY:act:2.2.1', 15, 'FSA/C-CA8/Ag.4', 'Number of animals distributed', 'nombre', 'somme', false, null, null, null, null, 500, array['Fiche de distribution', 'rapport de distribution', 'images']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:2.2.2', 'SECAL-GADY', 'SECAL-GADY:op:2.2', '2.2.2', 'DISTRIBUTION D''ALIMENT ET COMPLEMENTS POUR BETAIL', null, 0);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('SECAL-GADY:act:2.2.3', 'SECAL-GADY', 'SECAL-GADY:op:2.2', '2.2.3', 'FORMATION SUR LES BONNES PRATIQUES D''ELEVAGE', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('SECAL-GADY:ind:16', 'SECAL-GADY', 'activite', 'SECAL-GADY:act:2.2.3', 16, 'FSA/C-CA6/AS.11', 'Number of people receiving recurrent in-kind assistance', 'nombre', 'somme', true, 1125, 625, 250, 500, 2500, '{}'::text[], null);

-- ===== Volet WASH-IDC (Plan d'action_FH - US Consortium APSUD- WASH - IDC.xlsx) =====
insert into public.outcomes (id, volet, numero, libelle) values ('WASH-IDC:oc:1', 'WASH-IDC', '1', 'Améliorer l’accès inclusif, adapté et équitable aux infrastructures d’eau potable, aux infrastructures d’assainissement et aux programmes de changement de comportement en faveur de bonnes pratiques d''hygiène aux communautés de Paoua, Bossangoa et Nanga Boguila');
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:1', 'WASH-IDC', 'outcome', 'WASH-IDC:oc:1', 1, null, 'Nombre de forages réhabilités suivant les principes et normes nationales et opérationnels', 'nombre', 'somme', false, 0, 0, 0, 0, 6, array['images', 'rapport d''activité', 'attestation de remises des forages réhabilités']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:2', 'WASH-IDC', 'outcome', 'WASH-IDC:oc:1', 2, null, '# de personnes ayant subi un choc qui collectent de l''eau depuis les points d’eau améliorés pour leurs besoins essentiels dans les zones ciblées', 'nombre', 'somme', false, 0, 0, 0, 0, 3000, array['Rapport d''activités', 'images de points d''eau réhabilités', 'attestation de remiseComments']::text[], null);
insert into public.indicateurs (id, volet, niveau, outcome_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:3', 'WASH-IDC', 'outcome', 'WASH-IDC:oc:1', 3, null, 'Nombre de comités de gestion de points d''eau mis en place/redynamisés/formés et dotés en kits d''entretien des forages, de pièces de rechanges de pompes à motricité humaine et en fourniture de bureau', 'nombre', 'somme', false, 0, 0, 0, 0, 6, array['Images', 'Compte rendu atelier de formation', 'fiches de présence']::text[], null);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('WASH-IDC:op:1.1', 'WASH-IDC', 'WASH-IDC:oc:1', '1.1', '3000 personnes (femmes, hommes, filles et garçons) ciblées ont un accès sécurisé à l’eau en qualité et quantité suffisante dans les sous-préfectures de Paoua et Bossangoa');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('WASH-IDC:act:1.1.1', 'WASH-IDC', 'WASH-IDC:op:1.1', '1.1.1', 'Réhabilitation de forages avec remplacement de pompe India mark II:', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:4', 'WASH-IDC', 'activite', 'WASH-IDC:act:1.1.1', 4, null, 'Number of people accessing sufficient and safe water for drinking, cooking and/or personal hygiene use as per agreed sector standard', 'nombre', 'somme', true, 300, 1350, 600, 750, 3000, array['images des forages réhabilités et opérationnel', 'rapport d''activités et d''enquêtes CAP', 'Certificat de remise de forages réhabilités']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('WASH-IDC:act:1.1.2', 'WASH-IDC', 'WASH-IDC:op:1.1', '1.1.2', 'Formation du personnel de terrain dont 50% des femmes avant la sensibilisation', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:5', 'WASH-IDC', 'activite', 'WASH-IDC:act:1.1.2', 5, null, 'Number of implementing partner staff receiving training to support programme implementation', 'nombre', 'somme', true, 15, 15, 0, 0, 30, array['Compte rendu de l''atelier de formation', 'images', 'Rapport d''activités']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('WASH-IDC:act:1.1.3', 'WASH-IDC', 'WASH-IDC:op:1.1', '1.1.3', 'Réunion de Suivi Evaluation, Redevabilité et Apprentissage', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:6', 'WASH-IDC', 'activite', 'WASH-IDC:act:1.1.3', 6, null, 'Percentage of issues identified in feedback processes for which solutions are in process or closed', 'pourcentage', 'derniere_valeur', false, 0, 0, 0, 0, 70, array['Compte rendu des réunions AAP', 'les feedbacks remontés et traités', 'images']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('WASH-IDC:act:1.1.4', 'WASH-IDC', 'WASH-IDC:op:1.1', '1.1.4', 'Mise en place et formation des Comités de Gestion de Points d''Eau', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:7', 'WASH-IDC', 'activite', 'WASH-IDC:act:1.1.4', 7, null, 'Nombre de comités de gestion de points d''eau mis en place/redynamisés/formés et dotés en kits d''entretien des forages, de pièces de rechanges de pompes à motricité humaine et en fourniture de bureau', 'nombre', 'somme', false, 0, 0, 0, 0, 6, array['fiche de présence', 'TDR de la formation', 'images de formation et photo de famille']::text[], null);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('WASH-IDC:op:1.2', 'WASH-IDC', 'WASH-IDC:oc:1', '1.2', '13400 personnes à Paoua et Nangaa Boguila (femmes, hommes, filles et garçons) bénéficiaires comprennent et mettent en pratique les connaissances acquises en pratiques d’hygiène et sont sensibilisées à la construction de latrines');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('WASH-IDC:act:1.2.1', 'WASH-IDC', 'WASH-IDC:op:1.2', '1.2.1', 'Distribution de kits d''hygiène Intimes', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:8', 'WASH-IDC', 'activite', 'WASH-IDC:act:1.2.1', 8, null, 'Nombre de kits d''hygiène distribués aux ménages vulnérables', 'nombre', 'somme', true, 1000, 1000, 0, 0, 2000, array['images', 'fiche de décharge de kits intimes', 'rapport PDM']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('WASH-IDC:act:1.2.2', 'WASH-IDC', 'WASH-IDC:op:1.2', '1.2.2', 'Sensibilisation à l''hygiène', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:9', 'WASH-IDC', 'activite', 'WASH-IDC:act:1.2.2', 9, null, 'Nombre de personnes sensibilisées', 'nombre', 'somme', true, 3000, 2500, 1000, 1500, 8000, array['Rapport d''activité', 'images']::text[], null);
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('WASH-IDC:act:1.2.3', 'WASH-IDC', 'WASH-IDC:op:1.2', '1.2.3', 'Distribution de kits d''hygiène aux ménages vulnérables', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:10', 'WASH-IDC', 'activite', 'WASH-IDC:act:1.2.3', 10, null, 'Nombre de kits d''hygiène distribués aux ménages vulnérables', 'nombre', 'somme', true, 1100, 0, 1100, 0, 2200, array['images', 'fiche de décharge de kits d''hygiènes', 'rapport PDM']::text[], null);
insert into public.outputs (id, volet, outcome_id, numero, libelle) values ('WASH-IDC:op:1.3', 'WASH-IDC', 'WASH-IDC:oc:1', '1.3', '13400 personnes (femmes, hommes, filles et garçons) ont un accès amélioré à l’assainissement dans Bossangoa, Nanga PAOUA  et Paoua couvrant aussi les besoins des retournés');
insert into public.activites (id, volet, output_id, numero, libelle, responsable, budget_planifie) values ('WASH-IDC:act:1.3.1', 'WASH-IDC', 'WASH-IDC:op:1.3', '1.3.1', 'Appui à la construction des latrines familiales – PHAST', null, 0);
insert into public.indicateurs (id, volet, niveau, activite_id, ordre, code_cbpf, libelle, type_valeur, mode_cumul, desagrege, cible_femmes, cible_filles, cible_hommes, cible_garcons, cible_total, moyens_verification, commentaire) values ('WASH-IDC:ind:11', 'WASH-IDC', 'activite', 'WASH-IDC:act:1.3.1', 11, null, 'Number of communal sanitation facilities (e.g. latrines) and/or communal bathing facilities constructed or rehabilitated', 'nombre', 'somme', false, 0, 0, 0, 0, 300, array['images', 'rapportd''activités', 'Fiche de décharges de kits de creusage de latrines familiales']::text[], null);
