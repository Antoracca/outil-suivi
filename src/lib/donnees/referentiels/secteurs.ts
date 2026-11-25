/**
 * Référentiel des secteurs d'intervention et des rôles d'organisation dans le consortium.
 *
 * Secteurs : les clusters humanitaires (IASC / OCHA RCA) et leurs domaines courants, avec des
 * mots-clés pour la recherche (« faim », « eau », « nourriture »… retrouvent le bon secteur).
 * Le super-administrateur peut en ajouter un (« Autre ») depuis Administration › Nouvelle ONG.
 * Mêmes valeurs en base : migration 0014 (vérifié par supabase/tests/securite.test.mjs).
 */
import type { Secteur } from '../types';

export const SECTEURS_REFERENCE: Secteur[] = [
	{ code: 'WASH', libelle: 'Eau, hygiène et assainissement', libelle_court: 'WASH', cluster_cbpf: 'WSH', mots_cles: ['eau', 'eau potable', 'hygiène', 'assainissement', 'latrines', 'forage', 'puits', 'kits d’hygiène', 'lavage des mains', 'EHA'] },
	{ code: 'NUT', libelle: 'Nutrition', libelle_court: 'Nutrition', cluster_cbpf: 'NUT', mots_cles: ['malnutrition', 'faim', 'action contre la faim', 'MAS', 'MAM', 'dépistage', 'nourrisson', 'UNTA', 'UNT', 'allaitement'] },
	{ code: 'SAN', libelle: 'Santé', libelle_court: 'Santé', cluster_cbpf: 'HEA', mots_cles: ['soins', 'médical', 'médicaments', 'consultations', 'vaccination', 'paludisme', 'choléra', 'centre de santé', 'accouchement', 'hôpital'] },
	{ code: 'PE', libelle: 'Protection de l’enfance et VBG', libelle_court: 'Protection', cluster_cbpf: 'PRO', mots_cles: ['enfance', 'enfants', 'protection de l’enfance', 'enfants non accompagnés', 'espaces amis des enfants', 'VBG'] },
	{ code: 'SECAL', libelle: 'Sécurité alimentaire', libelle_court: 'Sécurité alimentaire', cluster_cbpf: 'FSA', mots_cles: ['nourriture', 'vivres', 'faim', 'distribution alimentaire', 'ration', 'alimentation', 'cantine'] },
	{ code: 'PROT', libelle: 'Protection générale', libelle_court: 'Protection', cluster_cbpf: 'PRO', mots_cles: ['protection', 'droits humains', 'monitoring de protection', 'documentation civile', 'cohésion sociale'] },
	{ code: 'VBG', libelle: 'Violences basées sur le genre', libelle_court: 'VBG', cluster_cbpf: 'PRO-GBV', mots_cles: ['violences sexuelles', 'violences faites aux femmes', 'femmes', 'prise en charge psychosociale', 'genre'] },
	{ code: 'LAM', libelle: 'Lutte antimines', libelle_court: 'Lutte antimines', cluster_cbpf: 'PRO-MA', mots_cles: ['mines', 'engins explosifs', 'déminage', 'restes explosifs de guerre', 'sensibilisation aux risques'] },
	{ code: 'EDU', libelle: 'Éducation', libelle_court: 'Éducation', cluster_cbpf: 'EDU', mots_cles: ['école', 'enseignants', 'scolarisation', 'alphabétisation', 'éducation d’urgence', 'fournitures scolaires'] },
	{ code: 'ABRI', libelle: 'Abris et articles ménagers essentiels', libelle_court: 'Abris', cluster_cbpf: 'SHL', mots_cles: ['abris', 'logement d’urgence', 'articles ménagers essentiels', 'AME', 'NFI', 'bâches', 'kits ménagers'] },
	{ code: 'CCCM', libelle: 'Coordination et gestion des sites de déplacés', libelle_court: 'Gestion des sites', cluster_cbpf: 'CCM', mots_cles: ['camps', 'sites de déplacés', 'déplacés internes', 'PDI', 'gestion des sites'] },
	{ code: 'RELV', libelle: 'Relèvement précoce et moyens d’existence', libelle_court: 'Relèvement', cluster_cbpf: 'ERY', mots_cles: ['relèvement', 'moyens d’existence', 'résilience', 'activités génératrices de revenus', 'AGR', 'emploi', 'formation professionnelle'] },
	{ code: 'AGRI', libelle: 'Agriculture, élevage et pêche', libelle_court: 'Agriculture', cluster_cbpf: 'FSA', mots_cles: ['agriculture', 'semences', 'élevage', 'pêche', 'outils agricoles', 'maraîchage', 'production animale'] },
	{ code: 'CASH', libelle: 'Transferts monétaires à usages multiples', libelle_court: 'Transferts monétaires', cluster_cbpf: 'MPC', mots_cles: ['argent', 'transferts monétaires', 'cash', 'coupons', 'bons d’achat', 'monnaie électronique'] },
	{ code: 'SMSPS', libelle: 'Santé mentale et soutien psychosocial', libelle_court: 'Santé mentale', cluster_cbpf: 'HEA', mots_cles: ['santé mentale', 'soutien psychosocial', 'traumatisme', 'écoute', 'SMSPS'] },
	{ code: 'LOG', libelle: 'Logistique', libelle_court: 'Logistique', cluster_cbpf: 'LOG', mots_cles: ['transport', 'entrepôt', 'approvisionnement', 'chaîne d’approvisionnement', 'stockage'] },
	{ code: 'TELU', libelle: 'Télécommunications d’urgence', libelle_court: 'Télécommunications', cluster_cbpf: 'ETC', mots_cles: ['télécommunications', 'radio', 'connectivité', 'internet', 'téléphone'] },
	{ code: 'COORD', libelle: 'Coordination et services communs', libelle_court: 'Coordination', cluster_cbpf: 'CSS', mots_cles: ['coordination', 'services communs', 'gestion de l’information', 'chef de file'] },
	{ code: 'RRC', libelle: 'Réduction des risques de catastrophe', libelle_court: 'Risques de catastrophe', cluster_cbpf: 'DRR', mots_cles: ['catastrophes', 'inondations', 'préparation aux urgences', 'alerte précoce', 'risques'] },
	{ code: 'ENV', libelle: 'Environnement et climat', libelle_court: 'Environnement', cluster_cbpf: 'ENV', mots_cles: ['environnement', 'climat', 'reboisement', 'énergie', 'foyers améliorés', 'déchets'] },
	{ code: 'GENRE', libelle: 'Égalité de genre et autonomisation des femmes', libelle_court: 'Genre', cluster_cbpf: 'GEN', mots_cles: ['genre', 'femmes', 'autonomisation', 'égalité', 'leadership féminin'] },
	{ code: 'HLP', libelle: 'Logement, terre et propriété', libelle_court: 'Logement et foncier', cluster_cbpf: 'PRO-HLP', mots_cles: ['terre', 'foncier', 'propriété', 'logement', 'litiges fonciers'] },
	{ code: 'AAP', libelle: 'Redevabilité envers les populations affectées', libelle_court: 'Redevabilité', cluster_cbpf: 'AAP', mots_cles: ['redevabilité', 'plaintes', 'retours communautaires', 'participation', 'communication avec les communautés'] },
	{ code: 'REFUG', libelle: 'Réfugiés, retournés et migrants', libelle_court: 'Réfugiés et retournés', cluster_cbpf: 'MS', mots_cles: ['réfugiés', 'retournés', 'migrants', 'apatrides', 'rapatriement'] },
	{ code: 'MULTI', libelle: 'Réponse multisectorielle intégrée', libelle_court: 'Multisectoriel', cluster_cbpf: 'MS', mots_cles: ['multisectoriel', 'intégré', 'réponse intégrée', 'RRM', 'réponse rapide'] }
];

/** Rôle d'une organisation dans le consortium. */
export type RoleConsortium = 'chef_de_file' | 'partenaire' | 'partenaire_technique' | 'associe' | 'bailleur' | 'observateur';

export const ROLES_CONSORTIUM: { valeur: RoleConsortium; libelle: string; description: string }[] = [
	{ valeur: 'partenaire', libelle: 'Partenaire de mise en œuvre', description: 'Met en œuvre un ou plusieurs volets et rapporte chaque mois.' },
	{ valeur: 'partenaire_technique', libelle: 'Partenaire technique', description: 'Apporte une expertise ou un appui technique au consortium.' },
	{ valeur: 'associe', libelle: 'Membre associé', description: 'Associé au consortium sans volet de mise en œuvre propre.' },
	{ valeur: 'bailleur', libelle: 'Bailleur / investisseur', description: 'Finance tout ou partie des activités.' },
	{ valeur: 'observateur', libelle: 'Observateur', description: 'Suit les travaux du consortium.' },
	{ valeur: 'chef_de_file', libelle: 'Chef de file', description: 'Coordonne le consortium et rend compte au bailleur (APSUD).' }
];

export const libelleRoleConsortium = (r: string) => ROLES_CONSORTIUM.find((x) => x.valeur === r)?.libelle ?? r;

/** Texte comparable : minuscules, sans accents ni apostrophes typographiques. */
export function texteRecherche(t: string): string {
	return t
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/[’']/g, ' ')
		.toLowerCase()
		.trim();
}

/**
 * Recherche intelligente d'un secteur : chaque mot tapé doit se retrouver dans le libellé,
 * le code, le cluster ou les mots-clés. Classement : début du libellé, puis libellé, puis mots-clés.
 */
export function chercherSecteurs(secteurs: Secteur[], requete: string): Secteur[] {
	const mots = texteRecherche(requete).split(/\s+/).filter(Boolean);
	if (!mots.length) return secteurs;
	const notes = secteurs
		.map((s) => {
			const libelle = texteRecherche(`${s.libelle} ${s.libelle_court}`);
			const code = texteRecherche(`${s.code} ${s.cluster_cbpf}`);
			const cles = texteRecherche((s.mots_cles ?? []).join(' | '));
			let note = 0;
			for (const m of mots) {
				if (libelle.startsWith(m)) note += 4;
				else if (libelle.split(/\s+/).some((x) => x.startsWith(m))) note += 3;
				else if (code.split(/\s+/).some((x) => x.startsWith(m))) note += 3;
				else if (cles.includes(m)) note += 2;
				else if (libelle.includes(m)) note += 1;
				else return { s, note: -1 };
			}
			return { s, note };
		})
		.filter((x) => x.note > 0);
	return notes.sort((a, b) => b.note - a.note || a.s.libelle.localeCompare(b.s.libelle, 'fr')).map((x) => x.s);
}

/** Code proposé pour un secteur saisi en « Autre » : lettres majuscules, 2 à 10 caractères, unique. */
export function codeSecteurPropose(libelle: string, existants: string[]): string {
	const mots = texteRecherche(libelle)
		.replace(/[^a-z\s]/g, ' ')
		.split(/\s+/)
		.filter((m) => m.length > 2 && !['des', 'les', 'aux', 'pour', 'avec', 'dans'].includes(m));
	let base = (mots.length > 1 ? mots.map((m) => m[0]).join('') : (mots[0] ?? 'AUTRE').slice(0, 6)).toUpperCase().slice(0, 8);
	if (base.length < 2) base = `${base}X`.slice(0, 2);
	let code = base;
	for (let i = 2; existants.includes(code); i++) code = `${base}${i}`.slice(0, 10);
	return code;
}
