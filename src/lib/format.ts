/** Mise en forme française des nombres, montants, dates et mois. */

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nfEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nfMonnaie = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** 7525 → « 7 525 » (espace fine insécable U+202F, fournie par Intl). */
export function nombre(n: number | null | undefined): string {
	if (n === null || n === undefined || Number.isNaN(n)) return '–';
	return nf.format(n);
}

export function entier(n: number | null | undefined): string {
	if (n === null || n === undefined || Number.isNaN(n)) return '–';
	return nfEntier.format(n);
}

/** 40.5 → « 40,5 % » */
export function pourcent(n: number | null | undefined): string {
	if (n === null || n === undefined || Number.isNaN(n)) return '–';
	return `${nf.format(n)} %`;
}

/** 412000 → « 412 000 $ » */
export function montant(n: number | null | undefined, devise = 'USD'): string {
	if (n === null || n === undefined || Number.isNaN(n)) return '–';
	const symbole = devise === 'USD' ? '$' : devise;
	return `${nfMonnaie.format(n)} ${symbole}`;
}

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 2026-12 » → « décembre 2026 » */
export function libelleMois(mois: string, avecAnnee = true): string {
	const [a, m] = mois.split('-').map(Number);
	return avecAnnee ? `${NOMS_MOIS[m - 1]} ${a}` : NOMS_MOIS[m - 1];
}

/** « 2026-12 » → « déc. » */
export function moisCourt(mois: string): string {
	const [, m] = mois.split('-').map(Number);
	return MOIS_COURTS[m - 1];
}

export function majuscule(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** ISO → « 3 déc. 2026 » */
export function date(iso: string | null | undefined): string {
	if (!iso) return '–';
	const d = new Date(iso);
	return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO → « 3 déc. à 14 h 05 » */
export function dateHeure(iso: string): string {
	const d = new Date(iso);
	const h = String(d.getHours()).padStart(2, '0');
	const mn = String(d.getMinutes()).padStart(2, '0');
	return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]} à ${h} h ${mn}`;
}

/** Durée relative courte : « à l'instant », « il y a 12 min », « hier », « 3 déc. » */
export function relatif(iso: string, maintenant: Date = new Date()): string {
	const d = new Date(iso);
	const s = Math.round((maintenant.getTime() - d.getTime()) / 1000);
	if (s < 45) return 'à l’instant';
	if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
	if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
	if (s < 172800) return 'hier';
	return date(iso);
}

export function taille(octets: number): string {
	if (octets < 1024) return `${octets} o`;
	if (octets < 1024 * 1024) return `${nf.format(octets / 1024)} Ko`;
	return `${nf.format(octets / 1024 / 1024)} Mo`;
}

/** Lecture tolérante d'un nombre saisi : « 1 350 », « 1350 », « 40,5 ». */
export function lireNombre(saisie: string): number | null {
	const t = saisie.replace(/[\s  ]/g, '').replace(',', '.');
	if (t === '') return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : NaN;
}
