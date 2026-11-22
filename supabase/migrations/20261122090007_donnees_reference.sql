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
