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
