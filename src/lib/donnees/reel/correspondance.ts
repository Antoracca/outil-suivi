/**
 * Correspondance entre les lignes de la base (supabase/migrations) et les types de
 * l'application (types.ts). Les colonnes portent les mêmes noms que les champs ; seules
 * les valeurs regroupées (cibles, désagrégations, rattachements, cibles d'événement,
 * semaines des tâches) sont recomposées ici. Les horodatages du serveur sont ramenés à
 * l'heure locale, au même format que la démonstration (« 2027-01-12T09:30:00 »).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { VERSION_SCHEMA } from '../demo/graine';
import type {
	Activite,
	AvancementActivite,
	Depense,
	Desagregation,
	EtatDepot,
	Evenement,
	Indicateur,
	Justificatif,
	Ligne5W,
	Notification,
	Organisation,
	Outcome,
	Output,
	Planification,
	Rapport,
	Secteur,
	SemaineTache,
	Tache,
	Utilisateur,
	ValeurIndicateur,
	Volet
} from '../types';

type Ligne = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const nb = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

/** Horodatage du serveur → heure locale « AAAA-MM-JJTHH:MM:SS ». */
export function heureLocale(ts: string | null | undefined): string | null {
	if (!ts) return null;
	const d = new Date(ts);
	if (Number.isNaN(d.getTime())) return ts;
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function initiales(nom: string): string {
	const mots = nom.trim().split(/[\s-]+/).filter(Boolean);
	return ((mots[0]?.[0] ?? '') + (mots[1]?.[0] ?? mots[0]?.[1] ?? '')).toUpperCase();
}

const desagregation = (r: Ligne, prefixe = ''): Desagregation => ({
	femmes: nb(r[`${prefixe}femmes`]),
	filles: nb(r[`${prefixe}filles`]),
	hommes: nb(r[`${prefixe}hommes`]),
	garcons: nb(r[`${prefixe}garcons`]),
	total: nb(r[`${prefixe}total`])
});

export const vers = {
	organisations: (r: Ligne): Organisation => ({ sigle: r.sigle, nom: r.nom, role_consortium: r.role_consortium, ville: r.ville }),
	secteurs: (r: Ligne): Secteur => ({ code: r.code, libelle: r.libelle, libelle_court: r.libelle_court, cluster_cbpf: r.cluster_cbpf }),
	profils: (r: Ligne): Utilisateur => ({ id: r.id, nom: r.nom, fonction: r.fonction ?? '', organisation: r.organisation, role: r.role, initiales: initiales(r.nom) }),
	volets: (r: Ligne): Volet => ({ code: r.code, organisation: r.organisation, secteur: r.secteur, cadre_verrouille: r.cadre_verrouille }),
	outcomes: (r: Ligne): Outcome => ({ id: r.id, volet: r.volet, numero: r.numero, libelle: r.libelle }),
	outputs: (r: Ligne): Output => ({ id: r.id, volet: r.volet, outcome_id: r.outcome_id, numero: r.numero, libelle: r.libelle }),
	activites: (r: Ligne): Activite => ({
		id: r.id,
		volet: r.volet,
		output_id: r.output_id,
		numero: r.numero,
		libelle: r.libelle,
		responsable: r.responsable,
		budget_planifie: Number(r.budget_planifie ?? 0),
		archive_le: heureLocale(r.archive_le),
		cree_par: r.cree_par,
		fiche_5w: r.fiche_5w ?? null
	}),
	indicateurs: (r: Ligne): Indicateur => ({
		id: r.id,
		volet: r.volet,
		niveau: r.niveau,
		parent_id: r.parent_id,
		ordre: r.ordre,
		code_cbpf: r.code_cbpf,
		libelle: r.libelle,
		type_valeur: r.type_valeur,
		mode_cumul: r.mode_cumul,
		desagrege: r.desagrege,
		cible: desagregation(r, 'cible_'),
		moyens_verification: r.moyens_verification ?? [],
		commentaire: r.commentaire,
		archive_le: heureLocale(r.archive_le)
	}),
	taches: (r: Ligne, semaines: SemaineTache[] = []): Tache => ({
		id: r.id,
		volet: r.volet,
		activite_id: r.activite_id,
		libelle: r.libelle,
		responsable: r.responsable,
		date_debut: r.date_debut,
		date_fin: r.date_fin,
		semaines,
		archive_le: heureLocale(r.archive_le)
	}),
	semaine: (r: Ligne): SemaineTache => ({ mois: r.mois, semaine: r.semaine, prevu: r.prevu, realise: r.realise }),
	valeurs: (r: Ligne): ValeurIndicateur => ({
		id: r.id,
		indicateur_id: r.indicateur_id,
		volet: r.volet,
		mois: r.mois,
		valeurs: desagregation(r),
		commentaire: r.commentaire,
		version: r.version,
		courante: r.courante,
		auteur: r.auteur,
		date: heureLocale(r.date)!
	}),
	avancements: (r: Ligne): AvancementActivite => ({
		id: r.id,
		activite_id: r.activite_id,
		volet: r.volet,
		mois: r.mois,
		taux_execution: nb(r.taux_execution),
		resultats: r.resultats ?? '',
		observations: r.observations ?? '',
		version: r.version,
		courante: r.courante,
		auteur: r.auteur,
		date: heureLocale(r.date)!
	}),
	depenses: (r: Ligne): Depense => ({
		id: r.id,
		activite_id: r.activite_id,
		volet: r.volet,
		mois: r.mois,
		montant: Number(r.montant),
		libelle: r.libelle,
		auteur: r.auteur,
		date: heureLocale(r.date)!,
		archive_le: heureLocale(r.archive_le)
	}),
	justificatifs: (r: Ligne): Justificatif => ({
		id: r.id,
		volet: r.volet,
		mois: r.mois,
		rattachement: { type: r.rattachement_type, id: r.rattachement_id },
		nom_fichier: r.nom_fichier,
		type_mime: r.type_mime,
		taille: Number(r.taille ?? 0),
		moyen_verification: r.moyen_verification,
		chemin_stockage: r.chemin_stockage ?? null,
		auteur: r.auteur,
		date: heureLocale(r.date)!,
		archive_le: heureLocale(r.archive_le)
	}),
	lignes_5w: (r: Ligne): Ligne5W => ({
		id: r.id,
		volet: r.volet,
		activite_id: r.activite_id,
		mois: r.mois,
		prefecture: r.prefecture,
		sous_prefecture: r.sous_prefecture,
		commune: r.commune,
		village: r.village,
		latitude: nb(r.latitude),
		longitude: nb(r.longitude),
		quantite_prevue: nb(r.quantite_prevue),
		quantite_realisee: nb(r.quantite_realisee),
		personnes_ciblees: nb(r.personnes_ciblees),
		filles: nb(r.filles),
		garcons: nb(r.garcons),
		femmes: nb(r.femmes),
		hommes: nb(r.hommes),
		date_debut: r.date_debut,
		date_fin: r.date_fin,
		statut: r.statut,
		commentaire: r.commentaire,
		auteur: r.auteur,
		date: heureLocale(r.date)!,
		archive_le: heureLocale(r.archive_le)
	}),
	planifications: (r: Ligne): Planification => ({
		id: r.id,
		activite_id: r.activite_id,
		volet: r.volet,
		mois: r.mois,
		prevue: !!r.prevue,
		valide_par: r.valide_par,
		valide_le: heureLocale(r.valide_le)!
	}),
	rapports: (r: Ligne): Rapport => ({
		id: r.id,
		volet: r.volet,
		mois: r.mois,
		statut: r.statut,
		soumis_par: r.soumis_par,
		soumis_le: heureLocale(r.soumis_le),
		decision_par: r.decision_par,
		decision_le: heureLocale(r.decision_le),
		motif: r.motif
	}),
	journal: (r: Ligne): Evenement => ({
		id: r.id,
		date: heureLocale(r.date)!,
		type: r.type,
		auteur: r.auteur,
		organisation: r.organisation,
		volet: r.volet,
		mois: r.mois,
		cible: { type: r.cible_type, id: r.cible_id, libelle: r.cible_libelle },
		resume: r.resume,
		avant: r.avant,
		apres: r.apres
	}),
	notifications: (r: Ligne): Notification => ({ id: r.id, evenement_id: r.evenement_id, destinataire: r.destinataire, lue: r.lue })
};

/** Table de la base → collection de l'état et clé d'identité, pour le temps réel. */
export const COLLECTIONS = {
	organisations: { cle: 'sigle', etat: 'organisations' },
	outcomes: { cle: 'id', etat: 'outcomes' },
	outputs: { cle: 'id', etat: 'outputs' },
	volets: { cle: 'code', etat: 'volets' },
	activites: { cle: 'id', etat: 'activites' },
	indicateurs: { cle: 'id', etat: 'indicateurs' },
	taches: { cle: 'id', etat: 'taches' },
	valeurs: { cle: 'id', etat: 'valeurs' },
	avancements: { cle: 'id', etat: 'avancements' },
	depenses: { cle: 'id', etat: 'depenses' },
	justificatifs: { cle: 'id', etat: 'justificatifs' },
	lignes_5w: { cle: 'id', etat: 'lignes_5w' },
	planifications: { cle: 'id', etat: 'planifications' },
	rapports: { cle: 'id', etat: 'rapports' },
	journal: { cle: 'id', etat: 'journal' },
	notifications: { cle: 'id', etat: 'notifications' },
	profils: { cle: 'id', etat: 'utilisateurs' }
} as const;

/** Lit toute une table, par pages de 1 000 lignes (limite par requête du serveur). */
async function tout(sb: SupabaseClient, table: string, ordre?: string): Promise<Ligne[]> {
	const lignes: Ligne[] = [];
	for (let debut = 0; ; debut += 1000) {
		let requete = sb.from(table).select('*').range(debut, debut + 999);
		if (ordre) requete = requete.order(ordre);
		const { data, error } = await requete;
		if (error) throw new Error(`Lecture de « ${table} » impossible : ${error.message}`);
		lignes.push(...(data ?? []));
		if (!data || data.length < 1000) return lignes;
	}
}

/** Nombre d'événements du fil d'activité chargés à l'ouverture (les plus récents). */
export const LIMITE_JOURNAL = 1000;

/** Charge tout l'état du consortium visible par le compte connecté. */
export async function chargerEtatReel(sb: SupabaseClient): Promise<EtatDepot> {
	const lecture = (table: string, ordre?: string) => tout(sb, table, ordre);
	const [organisations, secteurs, projets, periodes, profils, volets, outcomes, outputs, activites, indicateurs, taches, semaines, valeurs, avancements, depenses, justificatifs, lignes5w, planifications, rapports, notifications] =
		await Promise.all([
			lecture('organisations'),
			lecture('secteurs'),
			lecture('projet'),
			lecture('periodes', 'rang'),
			lecture('profils', 'nom'),
			lecture('volets', 'code'),
			lecture('outcomes', 'numero'),
			lecture('outputs', 'numero'),
			lecture('activites', 'numero'),
			lecture('indicateurs', 'ordre'),
			lecture('taches', 'ordre'),
			lecture('taches_semaines'),
			lecture('valeurs'),
			lecture('avancements'),
			lecture('depenses', 'date'),
			lecture('justificatifs', 'date'),
			lecture('lignes_5w', 'date'),
			lecture('planifications'),
			lecture('rapports'),
			lecture('notifications')
		]);
	const { data: journal, error } = await sb.from('journal').select('*').order('date', { ascending: false }).range(0, LIMITE_JOURNAL - 1);
	if (error) throw new Error(`Lecture du fil d’activité impossible : ${error.message}`);

	const p = projets[0];
	if (!p) throw new Error('Votre compte n’a accès à aucune donnée : il est peut-être désactivé. Contactez la coordination APSUD.');
	const semainesParTache = new Map<string, SemaineTache[]>();
	for (const s of semaines) {
		const liste = semainesParTache.get(s.tache_id) ?? [];
		liste.push(vers.semaine(s));
		semainesParTache.set(s.tache_id, liste);
	}

	return {
		version_schema: VERSION_SCHEMA,
		aujourdhui: heureLocale(new Date().toISOString())!,
		organisations: organisations.map(vers.organisations),
		utilisateurs: profils.map(vers.profils),
		secteurs: secteurs.map(vers.secteurs),
		projet: {
			code_cbpf: p.code_cbpf,
			intitule: p.intitule,
			bailleur: p.bailleur,
			date_debut: p.date_debut,
			date_fin: p.date_fin,
			devise: p.devise,
			zones: p.zones ?? [],
			objectif_general: p.objectif_general,
			mois: periodes.map((x) => x.mois),
			echeances: periodes
				.filter((x) => x.numero_rapport && x.type_rapport)
				.map((x) => ({ mois: x.mois, numero: x.numero_rapport, type: x.type_rapport, libelle: x.libelle_rapport ?? '', partenaire: x.echeance, fh: x.echeance_fh ?? x.echeance }))
		},
		volets: volets.map(vers.volets),
		outcomes: outcomes.map(vers.outcomes),
		outputs: outputs.map(vers.outputs),
		activites: activites.map(vers.activites),
		taches: taches.map((t) => vers.taches(t, semainesParTache.get(t.id) ?? [])),
		indicateurs: indicateurs.map(vers.indicateurs),
		valeurs: valeurs.map(vers.valeurs),
		avancements: avancements.map(vers.avancements),
		depenses: depenses.map(vers.depenses),
		justificatifs: justificatifs.map(vers.justificatifs),
		lignes_5w: lignes5w.map(vers.lignes_5w),
		planifications: planifications.map(vers.planifications),
		rapports: rapports.map(vers.rapports),
		journal: (journal ?? []).map(vers.journal),
		notifications: notifications.map(vers.notifications)
	};
}

/** État vide (avant connexion au serveur réel). */
export function etatVide(): EtatDepot {
	return {
		version_schema: VERSION_SCHEMA,
		aujourdhui: heureLocale(new Date().toISOString())!,
		organisations: [],
		utilisateurs: [],
		secteurs: [],
		projet: { code_cbpf: '', intitule: '', bailleur: '', date_debut: '', date_fin: '', devise: 'USD', zones: [], objectif_general: '', mois: [], echeances: [] },
		volets: [],
		outcomes: [],
		outputs: [],
		activites: [],
		taches: [],
		indicateurs: [],
		valeurs: [],
		avancements: [],
		depenses: [],
		justificatifs: [],
		lignes_5w: [],
		planifications: [],
		rapports: [],
		journal: [],
		notifications: []
	};
}
