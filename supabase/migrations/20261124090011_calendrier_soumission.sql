-- =============================================================================
-- 0011 — Calendrier officiel de soumission des rapports (PDF d'APSUD du 2026-11-24)
-- Remplace l'échéance provisoire « le 5 du mois suivant » (décision D4) par les dates
-- du PDF : partenaire → APSUD le 2 du mois suivant (le 9 pour les trimestriels 2 et 3,
-- le 30/09/2027 pour le final), APSUD → FH le 7 (le 14 pour les trimestriels).
-- Mêmes valeurs que src/lib/donnees/calendrier.ts (vérifié par securite.test.mjs).
-- =============================================================================

alter table public.periodes
	add column numero_rapport smallint check (numero_rapport between 1 and 36),
	add column type_rapport text check (type_rapport in ('narratif', 'trimestriel', 'final')),
	add column libelle_rapport text,
	add column echeance_fh date;

comment on column public.periodes.echeance is 'Date limite de soumission du rapport du mois par le partenaire à APSUD.';
comment on column public.periodes.echeance_fh is 'Date limite de transmission du rapport par APSUD au Fonds humanitaire.';
comment on column public.periodes.type_rapport is 'Nature du rapport attendu pour ce mois : narratif intermédiaire, trimestriel ou final.';

update public.periodes p set
	numero_rapport = c.numero,
	type_rapport = c.type_rapport,
	libelle_rapport = c.libelle,
	echeance = c.partenaire,
	echeance_fh = c.fh
from (values
	('2026-11', 1, 'narratif', 'Rapport narratif intermédiaire 1', date '2026-12-02', date '2026-12-07'),
	('2026-12', 2, 'trimestriel', 'Rapport trimestriel 1', date '2027-01-02', date '2027-01-14'),
	('2027-01', 3, 'narratif', 'Rapport narratif intermédiaire 2', date '2027-02-02', date '2027-02-07'),
	('2027-02', 4, 'narratif', 'Rapport narratif intermédiaire 3', date '2027-03-02', date '2027-03-07'),
	('2027-03', 5, 'trimestriel', 'Rapport trimestriel 2', date '2027-04-09', date '2027-04-14'),
	('2027-04', 6, 'narratif', 'Rapport narratif intermédiaire 4', date '2027-05-02', date '2027-05-07'),
	('2027-05', 7, 'narratif', 'Rapport narratif intermédiaire 5', date '2027-06-02', date '2027-06-07'),
	('2027-06', 8, 'trimestriel', 'Rapport trimestriel 3', date '2027-07-09', date '2027-07-14'),
	('2027-07', 9, 'narratif', 'Rapport narratif intermédiaire 6', date '2027-08-02', date '2027-08-07'),
	('2027-08', 10, 'final', 'Rapport narratif final', date '2027-09-30', date '2027-09-30')
) as c (mois, numero, type_rapport, libelle, partenaire, fh)
where p.mois = c.mois;
