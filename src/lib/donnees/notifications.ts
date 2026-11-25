import type { EtatDepot, Evenement, Notification } from './types';

/**
 * Notifications : à quel onglet du volet une nouveauté appartient, où elle mène, et les
 * nouveautés non lues d'un compte. Les notifications elles-mêmes sont créées par le serveur
 * (mode réel, fonctions SQL) ou par le dépôt (démonstration) : coordination APSUD et comptes
 * de l'organisation du volet, jamais l'auteur.
 */

export type OngletVolet = 'synthese' | 'indicateurs' | 'activites' | 'planification';

export const LIBELLES_ONGLET: Record<OngletVolet, string> = {
	synthese: 'Synthèse',
	indicateurs: 'Indicateurs',
	activites: 'Activités',
	planification: 'Activités planifiées'
};

/** Onglet du volet où se trouve la nouveauté (null : hors volet, ex. un secteur créé). */
export function ongletDe(ev: Evenement, etat: EtatDepot): OngletVolet | null {
	if (!ev.volet) return null;
	switch (ev.type) {
		case 'valeur_modifiee':
			return 'indicateurs';
		case 'planification_validee':
			return 'planification';
		case 'justificatif_ajoute': {
			const j = etat.justificatifs.find((x) => x.id === ev.cible.id);
			return j?.rattachement.type === 'indicateur' ? 'indicateurs' : 'activites';
		}
		case 'avancement_modifie':
		case 'depense_ajoutee':
		case 'activite_creee':
		case 'tache_creee':
		case 'tache_modifiee':
		case 'semaine_cochee':
		case 'fiche_5w_modifiee':
		case 'ligne_5w_ajoutee':
		case 'ligne_5w_modifiee':
		case 'rapport_soumis':
		case 'rapport_valide':
		case 'rapport_a_corriger':
		case 'rapport_verrouille':
		case 'rapport_deverrouille':
			return 'activites';
		default:
			return 'synthese';
	}
}

/** Page où ouvrir la nouveauté. */
export function lienEvenement(e: Evenement): string | null {
	if (!e.volet) return null;
	if (e.cible.type === 'rapport' && e.mois) return `/volets/${e.volet}/activites/${e.mois}`;
	if (e.type === 'valeur_modifiee' && e.mois) return `/volets/${e.volet}/indicateurs/${e.mois}#${encodeURIComponent(e.cible.id)}`;
	if (e.type === 'planification_validee' && e.mois) return `/volets/${e.volet}/planification/${e.mois}`;
	if (e.cible.type === 'tache' || e.type === 'semaine_cochee') return `/volets/${e.volet}/plan-action`;
	if (e.cible.type === 'activite' || e.cible.type === 'depense' || e.cible.type === 'justificatif') {
		// Sans mois (activité créée, fiche 5W) : l'onglet Activités du mois sélectionné.
		return e.mois ? `/volets/${e.volet}/activites/${e.mois}` : `/volets/${e.volet}/activites`;
	}
	return `/volets/${e.volet}`;
}

/** Titre court d'une nouveauté (fenêtre surgissante, alerte du navigateur). */
export function titreEvenement(e: Evenement): string {
	const titres: Partial<Record<Evenement['type'], string>> = {
		activite_creee: 'Nouvelle activité',
		tache_creee: 'Nouvelle tâche',
		valeur_modifiee: 'Indicateur mis à jour',
		avancement_modifie: 'Activité mise à jour',
		depense_ajoutee: 'Nouvelle dépense',
		justificatif_ajoute: 'Nouveau justificatif',
		planification_validee: 'Planification validée',
		rapport_soumis: 'Rapport soumis',
		rapport_valide: 'Rapport validé',
		rapport_a_corriger: 'Rapport à corriger',
		volet_cree: 'Nouvelle ONG',
		element_archive: 'Élément archivé'
	};
	return titres[e.type] ?? 'Nouveauté';
}

export interface NonLue {
	n: Notification;
	ev: Evenement;
}

/** Notifications non lues du compte, la plus récente d'abord. */
export function nonLuesDe(etat: EtatDepot, utilisateurId: string | null): NonLue[] {
	if (!utilisateurId) return [];
	const parId = new Map(etat.journal.map((e) => [e.id, e]));
	return etat.notifications
		.filter((n) => n.destinataire === utilisateurId && !n.lue)
		.map((n) => ({ n, ev: parId.get(n.evenement_id) }))
		.filter((x): x is NonLue => !!x.ev)
		.sort((a, b) => b.ev.date.localeCompare(a.ev.date));
}
