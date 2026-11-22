/**
 * Référentiel 5W du cluster WASH (EHA), extrait du modèle Excel reçu
 * (scripts/import-excel/referentiel-5w.mjs → 5w-wash.json). Données réelles, pas de démonstration.
 */
import donnees from './5w-wash.json';

export interface ActiviteCluster {
	code: string;
	sous_cluster: string;
	libelle: string;
	unite: string | null;
	indicateur: string | null;
}

export const COLONNES_5W: string[] = donnees.colonnes;
export const ACTIVITES_CLUSTER: ActiviteCluster[] = donnees.activites;
export const LISTES_5W = donnees.listes;
export const LIEUX = donnees.lieux;

export function activiteCluster(code: string | null | undefined): ActiviteCluster | undefined {
	return ACTIVITES_CLUSTER.find((a) => a.code === code);
}

/** Activités standard regroupées par sous-cluster (pour une liste à groupes). */
export function activitesParSousCluster(): { sous_cluster: string; activites: ActiviteCluster[] }[] {
	return LISTES_5W.sous_clusters.map((sc) => ({ sous_cluster: sc, activites: ACTIVITES_CLUSTER.filter((a) => a.sous_cluster === sc) }));
}

export function sousPrefectures(prefecture: string): string[] {
	return LIEUX.find((l) => l.prefecture === prefecture)?.sous_prefectures.map((s) => s.nom) ?? [];
}

export function communes(prefecture: string, sousPrefecture: string): string[] {
	return LIEUX.find((l) => l.prefecture === prefecture)?.sous_prefectures.find((s) => s.nom === sousPrefecture)?.communes ?? [];
}

export function prefectureDe(sousPrefecture: string): string | undefined {
	return LIEUX.find((l) => l.sous_prefectures.some((s) => s.nom === sousPrefecture))?.prefecture;
}

/** Sous-préfectures du projet (dans l'orthographe du référentiel du cluster). */
export const ZONES_PROJET = ['Nanga Boguila', 'Paoua', 'Bossangoa'];
