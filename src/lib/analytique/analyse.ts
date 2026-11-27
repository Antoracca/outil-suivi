/**
 * MOTEUR D'ANALYSE de la mesure d'utilisation : transforme les mesures brutes (pages, clics,
 * durées, actions, performances, difficultés) en synthèse lisible, puis en CONSTATS
 * automatiques avec une piste d'amélioration. Fonctions pures, mêmes calculs en démonstration
 * (mesures du navigateur) et en réel (mesures lues en base par le super-administrateur).
 * C'est ici que s'ajoutent les nouvelles analyses ; plus tard, l'export CSV nourrira une IA.
 */

export interface MesureBrute {
	utilisateur?: string | null;
	organisation?: string | null;
	role?: string | null;
	session?: string | null;
	type: string;
	page: string | null;
	cible?: string | null;
	donnees?: Record<string, unknown> | null;
	date: string;
}

export interface Contexte {
	jours: number;
	maintenant: Date;
	/** Organisations à suivre (avec au moins un volet) : sigle et nom. */
	organisations: { sigle: string; nom: string }[];
	/** Nombre de comptes actifs de la plateforme. */
	comptes: number;
	consentements?: { oui: number; non: number } | null;
}

export interface Synthese {
	periode: { debut: Date; fin: Date; jours: number };
	kpi: {
		utilisateurs: number;
		sessions: number;
		pagesVues: number;
		evenements: number;
		dureeSessionMediane: number;
		actions: number;
		erreurs: number;
		frictions: number;
		comptes: number;
		consentements: { oui: number; non: number } | null;
	};
	parJour: { jour: string; sessions: number; utilisateurs: number; evenements: number }[];
	parHeure: number[];
	ecrans: { ecran: string; vues: number; utilisateurs: number; tempsMoyen: number | null; vitesseMediane: number | null }[];
	parcours: { de: string; vers: string; nb: number }[];
	clics: { cible: string; nb: number }[];
	actions: { action: string; nb: number }[];
	formats: { cle: string; nb: number }[];
	connexions: { cle: string; nb: number }[];
	organisations: { sigle: string; nom: string; utilisateurs: number; sessions: number; actions: number; derniere: Date | null }[];
	erreurs: { message: string; ecran: string; nb: number }[];
	frictions: { cible: string; ecran: string; nb: number }[];
}

export type NiveauConstat = 'alerte' | 'attention' | 'info' | 'positif';
export interface Constat {
	niveau: NiveauConstat;
	titre: string;
	detail: string;
	piste: string;
}

/* ---------- Écrans : chemins regroupés et nommés ---------- */

const ECRANS: [RegExp, string][] = [
	[/^\/$/, 'Tableau de bord'],
	[/^\/volets\/[^/]+$/, 'Volet · Synthèse'],
	[/^\/volets\/[^/]+\/indicateurs(\/|$)/, 'Volet · Indicateurs'],
	[/^\/volets\/[^/]+\/activites(\/|$)/, 'Volet · Activités'],
	[/^\/volets\/[^/]+\/planification(\/|$)/, 'Volet · Activités planifiées'],
	[/^\/volets\/[^/]+\/cadre-logique/, 'Volet · Cadre logique'],
	[/^\/volets\/[^/]+\/plan-action/, 'Volet · Calendrier des tâches'],
	[/^\/validation/, 'Validation'],
	[/^\/activite/, 'Fil d’activité'],
	[/^\/exports/, 'Exports'],
	[/^\/archives/, 'Archives'],
	[/^\/administration\/utilisation/, 'Utilisation de l’outil'],
	[/^\/administration/, 'Administration'],
	[/^\/connexion/, 'Connexion']
];
/** Écrans clés dont l'absence d'usage mérite d'être signalée. */
const ECRANS_CLES = ['Volet · Indicateurs', 'Volet · Activités', 'Volet · Activités planifiées', 'Validation', 'Exports'];

export function ecranDe(chemin: string | null | undefined): string {
	const c = (chemin ?? '/').split(/[?#]/)[0] || '/';
	return ECRANS.find(([re]) => re.test(c))?.[1] ?? c;
}

const LIBELLES_ACTIONS: Record<string, string> = {
	valeur_modifiee: 'Valeur d’indicateur saisie',
	avancement_modifie: 'Avancement d’activité saisi',
	rapport_soumis: 'Rapport soumis',
	rapport_valide: 'Rapport validé',
	rapport_a_corriger: 'Rapport renvoyé pour correction',
	activite_creee: 'Activité créée',
	tache_creee: 'Tâche créée',
	depense_ajoutee: 'Dépense ajoutée',
	justificatif_ajoute: 'Justificatif ajouté',
	planification_validee: 'Planification validée',
	volet_cree: 'ONG ajoutée',
	element_archive: 'Élément archivé'
};
export const libelleAction = (a: string) => LIBELLES_ACTIONS[a] ?? a.replace(/_/g, ' ');

/* ---------- Outils ---------- */

const jourDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Heure à Bangui (UTC+1, sans heure d'été), là où travaillent les équipes. */
const heureBangui = (d: Date) => (d.getUTCHours() + 1) % 24;
function mediane(v: number[]): number | null {
	if (!v.length) return null;
	const t = [...v].sort((a, b) => a - b);
	const m = Math.floor(t.length / 2);
	return t.length % 2 ? t[m] : Math.round((t[m - 1] + t[m]) / 2);
}
function compter<T>(liste: T[], cle: (x: T) => string | null | undefined): Map<string, number> {
	const m = new Map<string, number>();
	for (const x of liste) {
		const k = cle(x);
		if (k) m.set(k, (m.get(k) ?? 0) + 1);
	}
	return m;
}
const trier = (m: Map<string, number>, n = 12) =>
	[...m.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([cle, nb]) => ({ cle, nb }));
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/* ---------- Synthèse ---------- */

export function analyser(brutes: MesureBrute[], ctx: Contexte): Synthese {
	const fin = ctx.maintenant;
	const debut = new Date(fin.getTime() - ctx.jours * 86_400_000);
	const m = brutes
		.map((x) => ({ ...x, d: new Date(x.date) }))
		.filter((x) => !Number.isNaN(x.d.getTime()) && x.d >= debut && x.d <= fin)
		.sort((a, b) => a.d.getTime() - b.d.getTime());
	const session = (x: (typeof m)[number]) => x.session || `${x.utilisateur ?? 'inconnu'}:${jourDe(x.d)}`;

	// Sessions : premier et dernier instant de chaque session.
	const bornes = new Map<string, { debut: number; fin: number; utilisateur: string | null | undefined; organisation: string | null | undefined }>();
	for (const x of m) {
		const s = session(x);
		const b = bornes.get(s);
		if (b) b.fin = x.d.getTime();
		else bornes.set(s, { debut: x.d.getTime(), fin: x.d.getTime(), utilisateur: x.utilisateur, organisation: x.organisation });
	}
	const pages = m.filter((x) => x.type === 'page');

	// Par jour (tous les jours de la période, même vides).
	const parJour: Synthese['parJour'] = [];
	for (let i = ctx.jours - 1; i >= 0; i--) {
		const j = jourDe(new Date(fin.getTime() - i * 86_400_000));
		const duJour = m.filter((x) => jourDe(x.d) === j);
		parJour.push({ jour: j, evenements: duJour.length, sessions: new Set(duJour.map(session)).size, utilisateurs: new Set(duJour.map((x) => x.utilisateur).filter(Boolean)).size });
	}
	const parHeure = Array.from({ length: 24 }, () => 0);
	for (const x of m) parHeure[heureBangui(x.d)] += 1;

	// Écrans : vues, comptes, temps moyen passé, vitesse d'affichage.
	const parEcran = new Map<string, { vues: number; utilisateurs: Set<string>; temps: number[]; vitesse: number[] }>();
	const ecran = (e: string) => parEcran.get(e) ?? (parEcran.set(e, { vues: 0, utilisateurs: new Set(), temps: [], vitesse: [] }), parEcran.get(e)!);
	for (const x of m) {
		const e = ecran(ecranDe(x.page));
		if (x.type === 'page') {
			e.vues += 1;
			if (x.utilisateur) e.utilisateurs.add(x.utilisateur);
		} else if (x.type === 'duree') {
			const s = num(x.donnees?.secondes);
			if (s !== null && s > 0 && s < 4 * 3600) e.temps.push(s);
		} else if (x.type === 'performance') {
			const ms = num(x.donnees?.ms);
			if (ms !== null) e.vitesse.push(ms);
		}
	}
	const ecrans = [...parEcran.entries()]
		.filter(([, v]) => v.vues > 0)
		.map(([nom, v]) => ({ ecran: nom, vues: v.vues, utilisateurs: v.utilisateurs.size, tempsMoyen: v.temps.length ? Math.round(v.temps.reduce((a, b) => a + b, 0) / v.temps.length) : null, vitesseMediane: mediane(v.vitesse) }))
		.sort((a, b) => b.vues - a.vues);

	// Parcours : enchaînements d'écrans dans une même session.
	const transitions = new Map<string, number>();
	const precedent = new Map<string, string>();
	for (const x of pages) {
		const s = session(x);
		const e = ecranDe(x.page);
		const p = precedent.get(s);
		if (p && p !== e) transitions.set(`${p}→${e}`, (transitions.get(`${p}→${e}`) ?? 0) + 1);
		precedent.set(s, e);
	}
	const parcours = trier(transitions, 10).map(({ cle, nb }) => {
		const [de, vers] = cle.split('→');
		return { de, vers, nb };
	});

	// Appareils (une mesure « appareil » par session).
	const appareils = m.filter((x) => x.type === 'appareil');
	const formats = trier(compter(appareils, (x) => String(x.donnees?.format ?? 'inconnu')), 5);
	const connexions = trier(compter(appareils, (x) => (x.donnees?.connexion ? String(x.donnees.connexion) : 'inconnue')), 6);

	// Organisations : activité de chacune (même sans aucune visite).
	const organisations = ctx.organisations
		.map((o) => {
			const siennes = m.filter((x) => x.organisation === o.sigle);
			return {
				sigle: o.sigle,
				nom: o.nom,
				utilisateurs: new Set(siennes.map((x) => x.utilisateur).filter(Boolean)).size,
				sessions: new Set(siennes.map(session)).size,
				actions: siennes.filter((x) => x.type === 'action').length,
				derniere: siennes.length ? siennes[siennes.length - 1].d : null
			};
		})
		.sort((a, b) => b.sessions - a.sessions);

	const erreurs = trier(compter(m.filter((x) => x.type === 'erreur'), (x) => `${x.cible ?? 'Erreur'}§${ecranDe(x.page)}`), 8).map(({ cle, nb }) => {
		const [message, e] = cle.split('§');
		return { message, ecran: e, nb };
	});
	const frictions = trier(compter(m.filter((x) => x.type === 'friction'), (x) => `${x.cible ?? ''}§${ecranDe(x.page)}`), 8).map(({ cle, nb }) => {
		const [cible, e] = cle.split('§');
		return { cible, ecran: e, nb };
	});

	const durees = [...bornes.values()].map((b) => Math.round((b.fin - b.debut) / 1000)).filter((s) => s > 0);
	return {
		periode: { debut, fin, jours: ctx.jours },
		kpi: {
			utilisateurs: new Set(m.map((x) => x.utilisateur).filter(Boolean)).size,
			sessions: bornes.size,
			pagesVues: pages.length,
			evenements: m.length,
			dureeSessionMediane: mediane(durees) ?? 0,
			actions: m.filter((x) => x.type === 'action').length,
			erreurs: m.filter((x) => x.type === 'erreur').length,
			frictions: m.filter((x) => x.type === 'friction').length,
			comptes: ctx.comptes,
			consentements: ctx.consentements ?? null
		},
		parJour,
		parHeure,
		ecrans,
		parcours,
		clics: trier(compter(m.filter((x) => x.type === 'clic'), (x) => x.cible), 10).map(({ cle, nb }) => ({ cible: cle, nb })),
		actions: trier(compter(m.filter((x) => x.type === 'action'), (x) => x.cible), 10).map(({ cle, nb }) => ({ action: libelleAction(cle), nb })),
		formats,
		connexions,
		organisations,
		erreurs,
		frictions
	};
}

/* ---------- Constats automatiques ---------- */

const LIBELLES_FORMAT: Record<string, string> = { telephone: 'téléphone', tablette: 'tablette', ordinateur: 'ordinateur' };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function constats(s: Synthese): Constat[] {
	const c: Constat[] = [];
	const k = s.kpi;
	if (!k.evenements) {
		c.push({
			niveau: 'info',
			titre: 'Pas encore de mesure sur la période',
			detail: 'Aucun compte consentant n’a utilisé la plateforme pendant ces jours-là.',
			piste: 'Les mesures apparaissent dès qu’un membre a répondu « Je consens » et utilise l’outil.'
		});
		return c;
	}

	for (const e of s.erreurs.slice(0, 2)) {
		c.push({ niveau: 'alerte', titre: `Erreur répétée sur « ${e.ecran} »`, detail: `« ${e.message} » (${e.nb} fois).`, piste: 'À corriger en priorité : transmettre ce message à l’équipe technique.' });
	}
	for (const f of s.frictions.slice(0, 2)) {
		c.push({
			niveau: 'attention',
			titre: `Bouton « ${f.cible} » cliqué plusieurs fois de suite`,
			detail: `Sur « ${f.ecran} », ${f.nb} fois : la réponse semble lente ou l’action peu claire.`,
			piste: 'Afficher un retour immédiat (chargement, confirmation) ou rendre le libellé plus explicite.'
		});
	}
	for (const e of s.ecrans.filter((x) => (x.vitesseMediane ?? 0) > 3000).slice(0, 2)) {
		c.push({
			niveau: 'attention',
			titre: `Écran lent : « ${e.ecran} »`,
			detail: `Temps d’affichage médian : ${(e.vitesseMediane! / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s.`,
			piste: 'Alléger cet écran (moins de données d’un coup) : important en 3G.'
		});
	}

	const inactives = s.organisations.filter((o) => !o.derniere || s.periode.fin.getTime() - o.derniere.getTime() > 7 * 86_400_000);
	if (inactives.length) {
		c.push({
			niveau: 'attention',
			titre: inactives.length === 1 ? `${inactives[0].sigle} n’a pas utilisé l’outil depuis 7 jours` : `${inactives.length} organisations sans visite depuis 7 jours`,
			detail: inactives.map((o) => o.sigle).join(', ') + ' (parmi les comptes qui consentent à la mesure).',
			piste: 'Relancer les points focaux avant l’échéance du rapport, ou proposer une courte formation.'
		});
	}

	const vus = new Set(s.ecrans.map((e) => e.ecran));
	const absents = ECRANS_CLES.filter((e) => !vus.has(e));
	if (absents.length) {
		c.push({ niveau: 'info', titre: 'Fonctions peu utilisées', detail: `Jamais ouvert sur la période : ${absents.join(', ')}.`, piste: 'Vérifier qu’elles sont connues (formation, lien plus visible) ou utiles.' });
	}

	const longs = s.ecrans.filter((e) => (e.tempsMoyen ?? 0) > 600 && /Indicateurs|Activités/.test(e.ecran));
	for (const e of longs.slice(0, 1)) {
		c.push({
			niveau: 'info',
			titre: `Saisie longue sur « ${e.ecran} »`,
			detail: `${Math.round(e.tempsMoyen! / 60)} min en moyenne par visite.`,
			piste: 'Simplifier la saisie (valeurs par défaut, moins de champs) ou vérifier la bonne compréhension.'
		});
	}

	const totalFormats = s.formats.reduce((a, f) => a + f.nb, 0);
	const mobile = s.formats.filter((f) => f.cle === 'telephone' || f.cle === 'tablette').reduce((a, f) => a + f.nb, 0);
	if (totalFormats && pct(mobile, totalFormats) >= 50) {
		c.push({ niveau: 'info', titre: `Utilisation surtout mobile (${pct(mobile, totalFormats)} %)`, detail: 'La majorité des sessions se font sur téléphone ou tablette.', piste: 'Donner la priorité à l’affichage mobile dans les prochaines améliorations.' });
	}
	const totalCnx = s.connexions.filter((x) => x.cle !== 'inconnue').reduce((a, x) => a + x.nb, 0);
	const lentes = s.connexions.filter((x) => /2g|3g/.test(x.cle)).reduce((a, x) => a + x.nb, 0);
	if (totalCnx && pct(lentes, totalCnx) >= 30) {
		c.push({ niveau: 'info', titre: `Connexions lentes fréquentes (${pct(lentes, totalCnx)} %)`, detail: 'Une part importante des sessions passe en 2G ou 3G.', piste: 'Garder les pages légères et la saisie hors ligne fiable.' });
	}

	if (k.consentements) {
		const total = k.consentements.oui + k.consentements.non;
		if (total && pct(k.consentements.oui, total) < 50) {
			c.push({ niveau: 'info', titre: `Peu de consentements (${pct(k.consentements.oui, total)} %)`, detail: `${k.consentements.oui} comptes consentent, ${k.consentements.non} refusent.`, piste: 'Expliquer à quoi sert la mesure : l’analyse sera plus représentative.' });
		}
	}

	// Tendance : seconde moitié de la période comparée à la première.
	const moitie = Math.floor(s.parJour.length / 2);
	const avant = s.parJour.slice(0, moitie).reduce((a, j) => a + j.sessions, 0);
	const apres = s.parJour.slice(moitie).reduce((a, j) => a + j.sessions, 0);
	if (avant >= 3 && apres >= avant * 1.3) c.push({ niveau: 'positif', titre: 'Usage en hausse', detail: `${apres} sessions sur la seconde moitié de la période, contre ${avant} avant.`, piste: 'Bonne adoption : continuer dans ce sens.' });
	else if (avant >= 3 && apres <= avant * 0.6) c.push({ niveau: 'attention', titre: 'Usage en baisse', detail: `${apres} sessions sur la seconde moitié de la période, contre ${avant} avant.`, piste: 'Chercher la cause (échéance passée, difficulté) et relancer les équipes.' });

	const pic = s.parHeure.indexOf(Math.max(...s.parHeure));
	if (Math.max(...s.parHeure) > 0) {
		c.push({ niveau: 'info', titre: `Activité maximale vers ${pic} h (heure de Bangui)`, detail: 'C’est le créneau où l’outil est le plus utilisé.', piste: 'Programmer les mises à jour et maintenances en dehors de ce créneau.' });
	}
	if (k.comptes && k.utilisateurs) {
		const taux = pct(k.utilisateurs, k.comptes);
		c.push({
			niveau: taux >= 70 ? 'positif' : 'info',
			titre: `${k.utilisateurs} compte${k.utilisateurs > 1 ? 's' : ''} actif${k.utilisateurs > 1 ? 's' : ''} sur ${k.comptes} (${taux} %)`,
			detail: 'Comptes ayant utilisé l’outil sur la période (parmi ceux qui consentent à la mesure).',
			piste: taux >= 70 ? 'Adoption large.' : 'Accompagner les comptes qui n’utilisent pas encore l’outil.'
		});
	}
	const ordre: NiveauConstat[] = ['alerte', 'attention', 'info', 'positif'];
	return c.sort((a, b) => ordre.indexOf(a.niveau) - ordre.indexOf(b.niveau));
}

/** Export CSV (séparateur « ; », pour Excel en français) des mesures brutes, pour l'IA ou un tableur. */
export function versCsv(brutes: MesureBrute[]): string {
	const cellule = (v: unknown) => {
		let t = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
		// Les libellés viennent des appareils des comptes : un texte qui commence comme une formule
		// (= + - @ …) est neutralisé par une apostrophe, sinon Excel l'exécuterait à l'ouverture.
		if (/^[\s]*[=+\-@\t\r\n|%]/.test(t)) t = `'${t}`;
		return /[;"\r\n]/.test(t) || t !== t.trim() ? `"${t.replace(/"/g, '""')}"` : t;
	};
	const tete = ['date', 'type', 'ecran', 'page', 'cible', 'organisation', 'role', 'utilisateur', 'session', 'donnees'];
	const lignes = brutes.map((x) => [x.date, x.type, ecranDe(x.page), x.page, x.cible, x.organisation, x.role, x.utilisateur, x.session, x.donnees].map(cellule).join(';'));
	return '﻿' + [tete.join(';'), ...lignes].join('\n');
}

export { LIBELLES_FORMAT };
