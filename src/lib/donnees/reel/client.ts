/**
 * Client du serveur réel (Supabase, offre gratuite — décision D2).
 *
 * Seules l'adresse du projet et sa clé PUBLIQUE vont dans le navigateur (fichier .env,
 * jamais versionné ; modèle : .env.example). La clé secrète « service_role » n'est
 * utilisée nulle part dans l'application. La sécurité est appliquée par la base
 * (supabase/migrations) : la clé publique seule ne donne accès à rien sans compte.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Variables lues par Vite à la construction (préfixe VITE_ : publiques par nature).
const URL_SERVEUR = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const CLE_PUBLIQUE = (import.meta.env.VITE_SUPABASE_CLE_PUBLIQUE as string | undefined)?.trim();

/** Le serveur réel est-il configuré pour ce déploiement ? */
export const serveurConfigure = !!(URL_SERVEUR && CLE_PUBLIQUE);

let client: SupabaseClient | null = null;

export function serveur(): SupabaseClient {
	if (!serveurConfigure) throw new Error('Serveur non configuré : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_CLE_PUBLIQUE dans .env.');
	client ??= createClient(URL_SERVEUR!, CLE_PUBLIQUE!, {
		auth: { persistSession: true, autoRefreshToken: true, storageKey: 'apsud-suivi:session-reelle' },
		realtime: { params: { eventsPerSecond: 10 } }
	});
	return client;
}

/** Messages d'erreur d'authentification, en français et sans jargon. */
export function traduireErreurAuth(message: string): string {
	const m = message.toLowerCase();
	if (m.includes('invalid login credentials')) return 'Adresse e-mail ou mot de passe incorrect.';
	if (m.includes('email not confirmed')) return 'Confirmez d’abord votre adresse avec le lien reçu par e-mail.';
	if (m.includes('already registered') || m.includes('already been registered')) return 'Cette adresse a déjà un compte : connectez-vous.';
	if (m.includes('password should be') || m.includes('weak password')) return 'Mot de passe trop faible : 10 caractères au moins, avec lettres et chiffres.';
	if (m.includes('database error saving new user')) return 'Code d’invitation invalide, expiré ou destiné à une autre adresse e-mail.';
	if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives : patientez quelques minutes avant de réessayer.';
	if (m.includes('failed to fetch') || m.includes('network')) return 'Serveur injoignable : vérifiez votre connexion internet.';
	return message;
}

/** Une erreur venant du réseau (à réessayer) plutôt que d'une règle refusée par la base. */
export function estErreurReseau(erreur: { message?: string; code?: string } | null | undefined): boolean {
	if (!erreur) return false;
	const m = (erreur.message ?? '').toLowerCase();
	return !erreur.code && (m.includes('fetch') || m.includes('network') || m.includes('load failed') || m.includes('timeout'));
}
