import type { Volet } from './types';

/**
 * Les volets d'une même organisation se suivent TOUJOURS (consigne du développeur, 2026-11-25) :
 * ARS Nutrition puis ARS Santé, jamais séparés par un autre volet. Les organisations gardent
 * l'ordre de leur premier volet ; à l'intérieur d'une organisation, l'ordre d'origine est gardé.
 * Appliqué à chaque chargement et à chaque ajout de volet : toutes les listes de l'interface
 * (barre latérale, tableau de bord, sélecteurs, administration, exports) lisent `etat.volets`.
 */
export function ordonnerVolets<T extends Pick<Volet, 'organisation'>>(volets: T[]): T[] {
	const rang = new Map<string, number>();
	for (const v of volets) if (!rang.has(v.organisation)) rang.set(v.organisation, rang.size);
	return volets
		.map((v, i) => ({ v, i }))
		.sort((a, b) => rang.get(a.v.organisation)! - rang.get(b.v.organisation)! || a.i - b.i)
		.map((x) => x.v);
}
