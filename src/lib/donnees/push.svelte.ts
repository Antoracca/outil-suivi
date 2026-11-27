/**
 * Alertes « push » sur l'appareil (mode réel) : le serveur envoie l'alerte même quand la
 * plateforme est fermée (service worker /sw.js, fonction Edge envoyer-push, migration 0015).
 * Sans clé publique configurée ou en démonstration : alertes du navigateur seulement,
 * pendant que la plateforme est ouverte (NotificationsSurgissantes).
 */
import { browser } from '$app/env';
import { serveur, serveurConfigure } from './reel/client';
import { CLE_PUSH_PUBLIQUE } from './reel/cle-push-publique';

export type EtatAlertes = 'indisponible' | 'a_activer' | 'bloquees' | 'activees_local' | 'activees_push';

function versOctets(base64url: string): Uint8Array<ArrayBuffer> {
	const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
	const brut = atob(b64);
	const octets = new Uint8Array(new ArrayBuffer(brut.length));
	for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
	return octets;
}

const appareil = () => {
	const ua = navigator.userAgent;
	const nav = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
	const sys = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
	return `${nav}${sys ? ` sur ${sys}` : ''}`;
};

class Alertes {
	etat = $state<EtatAlertes>('indisponible');
	erreur = $state<string | null>(null);
	/** L'état a été relu au moins une fois depuis la connexion (avant : on ne sait pas encore). */
	verifie = $state(false);

	/** Le push serveur est-il possible ici ? (navigateur compatible, serveur réel, clé configurée) */
	get pushPossible(): boolean {
		return browser && 'serviceWorker' in navigator && 'PushManager' in window && serveurConfigure && !!CLE_PUSH_PUBLIQUE;
	}

	/** Relit l'état ; en mode réel, rattache l'abonnement existant au compte connecté. */
	async actualiser(reel: boolean) {
		try {
			await this.#relire(reel);
		} finally {
			this.verifie = true;
		}
	}

	async #relire(reel: boolean) {
		if (!browser || typeof Notification === 'undefined') return void (this.etat = 'indisponible');
		if (Notification.permission === 'denied') return void (this.etat = 'bloquees');
		if (Notification.permission !== 'granted') return void (this.etat = 'a_activer');
		if (!reel || !this.pushPossible) return void (this.etat = 'activees_local');
		const reg = await navigator.serviceWorker.register('/sw.js');
		const abo = await reg.pushManager.getSubscription();
		if (!abo) return void (this.etat = 'a_activer');
		await this.#enregistrer(abo);
		this.etat = 'activees_push';
	}

	/** Demande l'autorisation, puis abonne l'appareil aux alertes du serveur (mode réel). */
	async activer(reel: boolean) {
		this.erreur = null;
		if (typeof Notification === 'undefined') return;
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return void (this.etat = permission === 'denied' ? 'bloquees' : 'a_activer');
		if (!reel || !this.pushPossible) {
			this.etat = 'activees_local';
			new Notification('Alertes activées', { body: 'Vous serez prévenu sur cet appareil pendant que la plateforme est ouverte.', icon: '/logo-apsud.jpg' });
			return;
		}
		try {
			const reg = await navigator.serviceWorker.register('/sw.js');
			await navigator.serviceWorker.ready;
			const abo = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(CLE_PUSH_PUBLIQUE) }));
			await this.#enregistrer(abo);
			this.etat = 'activees_push';
			await reg.showNotification('Alertes activées', { body: 'Vous serez prévenu sur cet appareil, même plateforme fermée.', icon: '/logo-apsud.jpg', tag: 'alertes-activees' });
		} catch (e) {
			this.erreur = `Abonnement impossible : ${e instanceof Error ? e.message : String(e)}`;
			this.etat = 'activees_local';
		}
	}

	/** Désabonne cet appareil (le serveur n'y enverra plus rien). */
	async desactiver() {
		this.erreur = null;
		if (!this.pushPossible) return;
		const reg = await navigator.serviceWorker.getRegistration('/sw.js');
		const abo = await reg?.pushManager.getSubscription();
		if (abo) {
			await serveur().rpc('retirer_abonnement_push', { p_endpoint: abo.endpoint });
			await abo.unsubscribe();
		}
		this.etat = 'activees_local';
	}

	/**
	 * À la déconnexion : le serveur oublie cet appareil pour ce compte (sur un appareil partagé,
	 * la personne suivante ne reçoit pas les alertes de la précédente). L'autorisation du navigateur
	 * reste : à la prochaine connexion, l'appareil est rattaché au nouveau compte.
	 */
	async retirerDuCompte() {
		try {
			if (!this.pushPossible) return;
			const reg = await navigator.serviceWorker.getRegistration('/sw.js');
			const abo = await reg?.pushManager.getSubscription();
			if (abo) await serveur().rpc('retirer_abonnement_push', { p_endpoint: abo.endpoint });
		} catch {
			/* hors ligne : la fonction Edge retirera l'abonnement s'il expire */
		} finally {
			this.verifie = false;
		}
	}

	async #enregistrer(abo: PushSubscription) {
		const j = abo.toJSON();
		const { error } = await serveur().rpc('enregistrer_abonnement_push', {
			p_endpoint: abo.endpoint,
			p_p256dh: j.keys?.p256dh ?? '',
			p_auth: j.keys?.auth ?? '',
			p_appareil: appareil()
		});
		if (error) throw new Error(error.message);
	}
}

export const alertes = new Alertes();
