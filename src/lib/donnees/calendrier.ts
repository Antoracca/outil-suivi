/**
 * Calendrier officiel de soumission des rapports du consortium.
 * Source : « Consortium APSUD – Date de soumission des rapports des partenaires »
 * (PDF reçu d'APSUD le 2026-11-24, analyse : docs/retours/CALENDRIER-SOUMISSION-2026-11-24.md).
 *
 * Un rapport par mois du projet. Le partenaire le soumet à APSUD à la date « partenaire » ;
 * APSUD le transmet au Fonds humanitaire (FH) à la date « fh ».
 * Les mêmes valeurs sont écrites en base par la migration 0011 (table periodes) : en mode
 * réel, l'outil lit la base ; ce fichier sert à la démonstration et de référence aux tests.
 */
import type { Mois } from './types';

export type TypeRapport = 'narratif' | 'trimestriel' | 'final';

export interface EcheanceRapport {
	mois: Mois;
	numero: number;
	type: TypeRapport;
	/** Intitulé exact du PDF, par exemple « Rapport trimestriel 1 ». */
	libelle: string;
	/** Date limite partenaire → APSUD (AAAA-MM-JJ). */
	partenaire: string;
	/** Date limite APSUD → FH (AAAA-MM-JJ). */
	fh: string;
}

export const CALENDRIER_FH: EcheanceRapport[] = [
	{ mois: '2026-11', numero: 1, type: 'narratif', libelle: 'Rapport narratif intermédiaire 1', partenaire: '2026-12-02', fh: '2026-12-07' },
	{ mois: '2026-12', numero: 2, type: 'trimestriel', libelle: 'Rapport trimestriel 1', partenaire: '2027-01-02', fh: '2027-01-14' },
	{ mois: '2027-01', numero: 3, type: 'narratif', libelle: 'Rapport narratif intermédiaire 2', partenaire: '2027-02-02', fh: '2027-02-07' },
	{ mois: '2027-02', numero: 4, type: 'narratif', libelle: 'Rapport narratif intermédiaire 3', partenaire: '2027-03-02', fh: '2027-03-07' },
	{ mois: '2027-03', numero: 5, type: 'trimestriel', libelle: 'Rapport trimestriel 2', partenaire: '2027-04-09', fh: '2027-04-14' },
	{ mois: '2027-04', numero: 6, type: 'narratif', libelle: 'Rapport narratif intermédiaire 4', partenaire: '2027-05-02', fh: '2027-05-07' },
	{ mois: '2027-05', numero: 7, type: 'narratif', libelle: 'Rapport narratif intermédiaire 5', partenaire: '2027-06-02', fh: '2027-06-07' },
	{ mois: '2027-06', numero: 8, type: 'trimestriel', libelle: 'Rapport trimestriel 3', partenaire: '2027-07-09', fh: '2027-07-14' },
	{ mois: '2027-07', numero: 9, type: 'narratif', libelle: 'Rapport narratif intermédiaire 6', partenaire: '2027-08-02', fh: '2027-08-07' },
	{ mois: '2027-08', numero: 10, type: 'final', libelle: 'Rapport narratif final', partenaire: '2027-09-30', fh: '2027-09-30' }
];

export const LIBELLES_TYPE_RAPPORT: Record<TypeRapport, string> = {
	narratif: 'Narratif intermédiaire',
	trimestriel: 'Trimestriel',
	final: 'Final'
};
