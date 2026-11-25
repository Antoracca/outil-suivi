/**
 * Fonction Edge « envoyer-push » (Supabase, Deno) : envoie l'alerte d'une notification
 * à tous les appareils abonnés de son destinataire (Web Push, clés VAPID).
 *
 * Appelée par le déclencheur `notifications_push` (migration 0015) avec { notification_id }.
 * Déployée SANS vérification de jeton (--no-verify-jwt) : la protection vient de la base :
 * seule une notification récente (10 min) et pas encore poussée est envoyée, puis marquée.
 *
 * Secrets de la fonction (jamais dans le dépôt) : VAPID_CLE_PUBLIQUE, VAPID_CLE_PRIVEE,
 * VAPID_SUJET (adresse https de la plateforme). SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
 * sont fournis par Supabase à la fonction ; la clé service_role ne quitte pas le serveur.
 *
 * Titres et liens : mêmes règles que src/lib/donnees/notifications.ts (à garder alignés).
 */
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

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
	date: string;
	volet: string | null;
	mois: string | null;
	cible_type: string;
	cible_id: string;
	cible_libelle: string;
	resume: string;
	organisation: string;
	auteur: string;
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

	const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

	// Réservation atomique : seule une notification pas encore poussée passe (pas de double envoi).
	const { data: reservee, error: e1 } = await sb
		.from('notifications')
		.update({ push_envoye_le: new Date().toISOString() })
		.eq('id', notificationId)
		.is('push_envoye_le', null)
		.select('id, evenement_id, destinataire')
		.maybeSingle();
	if (e1) return reponse(500, { erreur: e1.message });
	if (!reservee) return reponse(200, { envoye: 0, motif: 'déjà poussée ou inconnue' });

	const { data: ev, error: e2 } = await sb.from('journal').select('*').eq('id', reservee.evenement_id).maybeSingle<Evenement>();
	if (e2 || !ev) return reponse(500, { erreur: e2?.message ?? 'événement introuvable' });
	if (Date.now() - new Date(ev.date).getTime() > 10 * 60 * 1000) return reponse(200, { envoye: 0, motif: 'notification trop ancienne' });

	const { data: auteur } = await sb.from('profils').select('nom').eq('id', ev.auteur).maybeSingle();
	const { data: abonnements } = await sb.from('abonnements_push').select('id, endpoint, p256dh, auth').eq('utilisateur', reservee.destinataire);
	if (!abonnements?.length) return reponse(200, { envoye: 0, motif: 'aucun appareil abonné' });

	const charge = JSON.stringify({
		titre: `${TITRES[ev.type] ?? 'Nouveauté'}${ev.volet ? ` · ${ev.volet}` : ''}`,
		corps: `${auteur?.nom ?? 'Quelqu’un'} (${ev.organisation}) ${ev.resume} ${ev.cible_libelle}`,
		lien: lien(ev),
		tag: ev.id,
		evenement_id: ev.id
	});

	let envoye = 0;
	for (const a of abonnements) {
		try {
			await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, { TTL: 24 * 3600, urgency: 'high' });
			envoye += 1;
			await sb.from('abonnements_push').update({ dernier_envoi: new Date().toISOString() }).eq('id', a.id);
		} catch (err) {
			const code = (err as { statusCode?: number }).statusCode;
			// Abonnement expiré ou révoqué par le navigateur : on le retire.
			if (code === 404 || code === 410) await sb.from('abonnements_push').delete().eq('id', a.id);
		}
	}
	return reponse(200, { envoye });
});
