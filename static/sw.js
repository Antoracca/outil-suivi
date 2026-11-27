/**
 * Service worker de la plateforme : reçoit les alertes « push » envoyées par le serveur
 * (fonction Edge envoyer-push) et les affiche, même quand la plateforme est fermée.
 * Un clic sur l'alerte ouvre (ou ramène au premier plan) la plateforme sur l'élément concerné.
 * Aucun cache : l'application reste servie normalement par le réseau.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
	let d = {};
	try {
		d = e.data ? e.data.json() : {};
	} catch {
		d = { corps: e.data ? e.data.text() : '' };
	}
	const titre = d.titre || 'Suivi consortium APSUD';
	e.waitUntil(
		self.registration.showNotification(titre, {
			body: d.corps || 'Nouvelle notification',
			icon: '/logo-apsud.jpg',
			badge: '/logo-apsud.jpg',
			tag: d.tag || undefined,
			renotify: !!d.tag,
			requireInteraction: true,
			data: { lien: d.lien || '/', evenement_id: d.evenement_id || null }
		})
	);
});

self.addEventListener('notificationclick', (e) => {
	e.notification.close();
	// Seulement une adresse de la plateforme : jamais un site extérieur, même si l'alerte en contenait un.
	let cible = new URL('/', self.location.origin).href;
	try {
		const u = new URL(e.notification.data?.lien || '/', self.location.origin);
		if (u.origin === self.location.origin) cible = u.href;
	} catch {
		/* lien illisible : accueil */
	}
	e.waitUntil(
		(async () => {
			const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const ouverte = fenetres.find((c) => new URL(c.url).origin === self.location.origin);
			if (ouverte) {
				await ouverte.focus();
				if ('navigate' in ouverte) await ouverte.navigate(cible).catch(() => undefined);
				return;
			}
			await self.clients.openWindow(cible);
		})()
	);
});
