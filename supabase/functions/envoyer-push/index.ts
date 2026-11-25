/**
 * Fonction Edge « envoyer-push » (Supabase, Deno) : envoie l'alerte d'une notification
 * à tous les appareils abonnés de son destinataire (Web Push, clés VAPID).
 *
 * Appelée par le déclencheur `notifications_push` (migration 0015) avec { notification_id }.
 * Déployée SANS vérification de jeton (--no-verify-jwt) : la protection vient de la base :
 * seule une notification récente (10 min) et pas encore poussée est envoyée, puis marquée.
 *
 * Secrets de la fonction (jamais dans le dépôt) : VAPID_CLE_PUBLIQUE, VAPID_CLE_PRIVEE,
 * VAPID_SUJET (adresse https de la plateforme). Accès à la base : connexion Postgres directe
 * par SUPABASE_DB_URL, fournie par Supabase à la fonction (ne quitte pas le serveur). On
 * n'utilise pas l'API avec la clé service_role : avec le nouveau système de clés du projet,
 * elle était traitée comme un visiteur (« permission denied for table notifications »).
 *
 * Titres et liens : mêmes règles que src/lib/donnees/notifications.ts (à garder alignés).
 */
import webpush from 'npm:web-push@3.6.7';
import postgres from 'npm:postgres@3.4.5';

const TITRES: Record<string, string> = {
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

interface Evenement {
	id: string;
	type: string;
	date: Date;
	volet: string | null;
	mois: string | null;
	cible_type: string;
	cible_id: string;
	cible_libelle: string;
	resume: string;
	organisation: string;
	auteur: string;
	auteur_nom: string | null;
}

function lien(e: Evenement): string {
	if (!e.volet) return '/';
	if (e.cible_type === 'rapport' && e.mois) return `/volets/${e.volet}/activites/${e.mois}`;
	if (e.type === 'valeur_modifiee' && e.mois) return `/volets/${e.volet}/indicateurs/${e.mois}#${encodeURIComponent(e.cible_id)}`;
	if (e.type === 'planification_validee' && e.mois) return `/volets/${e.volet}/planification/${e.mois}`;
	if (e.cible_type === 'tache' || e.type === 'semaine_cochee') return `/volets/${e.volet}/plan-action`;
	if (['activite', 'depense', 'justificatif'].includes(e.cible_type)) return e.mois ? `/volets/${e.volet}/activites/${e.mois}` : `/volets/${e.volet}/activites`;
	return `/volets/${e.volet}`;
}

const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
	if (req.method !== 'POST') return reponse(405, { erreur: 'POST seulement' });
	let notificationId: string | undefined;
	try {
		notificationId = (await req.json())?.notification_id;
	} catch {
		return reponse(400, { erreur: 'Corps JSON attendu' });
	}
	if (!notificationId || typeof notificationId !== 'string') return reponse(400, { erreur: 'notification_id manquant' });

	const publique = Deno.env.get('VAPID_CLE_PUBLIQUE');
	const privee = Deno.env.get('VAPID_CLE_PRIVEE');
	const sujet = Deno.env.get('VAPID_SUJET') ?? 'https://outil-suivi.vercel.app';
	if (!publique || !privee) return reponse(503, { erreur: 'Clés VAPID non configurées' });
	webpush.setVapidDetails(sujet, publique, privee);

	const url = Deno.env.get('SUPABASE_DB_URL');
	if (!url) return reponse(503, { erreur: 'Connexion à la base indisponible' });
	const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5 });
	try {
		// Réservation atomique : seule une notification pas encore poussée passe (pas de double envoi).
		const [reservee] = await sql<{ id: string; evenement_id: string; destinataire: string }[]>`
			update public.notifications set push_envoye_le = now()
			where id = ${notificationId} and push_envoye_le is null
			returning id, evenement_id, destinataire`;
		if (!reservee) return reponse(200, { envoye: 0, motif: 'déjà poussée ou inconnue' });

		const [ev] = await sql<Evenement[]>`
			select j.id, j.type, j.date, j.volet, j.mois, j.cible_type, j.cible_id, j.cible_libelle, j.resume, j.organisation, j.auteur, p.nom as auteur_nom
			from public.journal j left join public.profils p on p.id = j.auteur
			where j.id = ${reservee.evenement_id}`;
		if (!ev) return reponse(500, { erreur: 'événement introuvable' });
		if (Date.now() - new Date(ev.date).getTime() > 10 * 60 * 1000) return reponse(200, { envoye: 0, motif: 'notification trop ancienne' });

		const abonnements = await sql<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
			select id, endpoint, p256dh, auth from public.abonnements_push where utilisateur = ${reservee.destinataire}`;
		if (!abonnements.length) return reponse(200, { envoye: 0, motif: 'aucun appareil abonné' });

		const charge = JSON.stringify({
			titre: `${TITRES[ev.type] ?? 'Nouveauté'}${ev.volet ? ` · ${ev.volet}` : ''}`,
			corps: `${ev.auteur_nom ?? 'Quelqu’un'} (${ev.organisation}) ${ev.resume} ${ev.cible_libelle}`,
			lien: lien(ev),
			tag: ev.id,
			evenement_id: ev.id
		});

		let envoye = 0;
		for (const a of abonnements) {
			try {
				await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, { TTL: 24 * 3600, urgency: 'high' });
				envoye += 1;
				await sql`update public.abonnements_push set dernier_envoi = now() where id = ${a.id}`;
			} catch (err) {
				const code = (err as { statusCode?: number }).statusCode;
				// Abonnement expiré ou révoqué par le navigateur : on le retire.
				if (code === 404 || code === 410) await sql`delete from public.abonnements_push where id = ${a.id}`;
			}
		}
		return reponse(200, { envoye });
	} catch (e) {
		return reponse(500, { erreur: e instanceof Error ? e.message : String(e) });
	} finally {
		await sql.end({ timeout: 2 });
	}
});
