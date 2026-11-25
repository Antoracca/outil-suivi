/**
 * Message d'invitation à transmettre à une personne invitée sur la plateforme.
 * Affiché sur la page de succès de l'Administration (copier, partager, messagerie).
 *
 * L'envoi automatique par e-mail sera branché plus tard (service d'envoi gratuit à choisir) :
 * `envoyerInvitationParEmail` est le point d'accroche unique, déjà appelé par l'interface.
 * Il ne doit jamais recevoir de secret : le code d'invitation voyage seulement dans le message.
 */

/** Durée de validité d'un code d'invitation (même valeur que la fonction SQL creer_invitation). */
export const JOURS_VALIDITE_INVITATION = 14;

export interface Invitation {
	code: string;
	email: string;
	nom: string;
	fonction: string;
	organisation: string;
	/** Nom complet de l'organisation, s'il est connu. */
	nomOrganisation?: string;
	role: string;
	libelleRole: string;
	cree_le: Date;
	expire_le: Date;
	/** Nom de la personne qui invite (signature du message). */
	invitePar: string;
	demonstration: boolean;
}

/**
 * Adresse publique de la plateforme. `VITE_ADRESSE_PLATEFORME` la fixe (domaine définitif,
 * ex. https://suivi.apsud.org) ; sinon l'adresse où l'outil est ouvert.
 */
export function adressePlateforme(): string {
	const fixee = (import.meta.env.VITE_ADRESSE_PLATEFORME as string | undefined)?.trim();
	if (fixee) return fixee.replace(/\/+$/, '');
	return typeof location === 'undefined' ? '' : location.origin;
}

/** Lien direct vers l'onglet « Inscription » (ni adresse e-mail ni code dans le lien). */
export const lienInscription = () => `${adressePlateforme()}/connexion?inscription`;

const dateLongue = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function messageInvitation(inv: Invitation): { objet: string; corps: string } {
	const org = inv.nomOrganisation && inv.nomOrganisation !== inv.organisation ? `${inv.organisation} (${inv.nomOrganisation})` : inv.organisation;
	const objet = 'Invitation : plateforme de suivi du consortium APSUD';
	const corps = [
		`Bonjour ${inv.nom},`,
		'',
		`Vous êtes invité(e) à rejoindre la plateforme de suivi du consortium APSUD (Fonds humanitaire RCA, projet CBPF-CAR-26-R-NGO-NSFT-41469), pour ${org}, avec le rôle « ${inv.libelleRole} ».`,
		'',
		'Vos accès pour créer votre compte :',
		`- Adresse de la plateforme : ${lienInscription()}`,
		`- Adresse e-mail : ${inv.email}`,
		`- Code d’invitation : ${inv.code}`,
		'',
		'Pour vous inscrire :',
		'1. Ouvrez l’adresse de la plateforme, onglet « Inscription ».',
		'2. Saisissez votre adresse e-mail et le code d’invitation.',
		'3. Choisissez votre mot de passe (personne d’autre ne le connaîtra).',
		'',
		`Le code est valable jusqu’au ${dateLongue(inv.expire_le)}, une seule fois, et uniquement avec cette adresse e-mail.`,
		'',
		'Cordialement,',
		inv.invitePar,
		'Coordination du consortium APSUD'
	].join('\n');
	return { objet, corps };
}

/** Lien « mailto: » vers la messagerie de l'appareil, message prérempli. */
export function lienMessagerie(inv: Invitation): string {
	const { objet, corps } = messageInvitation(inv);
	return `mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
}

/** L'envoi automatique est-il branché ? (Pas encore : à relier à un service d'envoi.) */
export const ENVOI_AUTOMATIQUE_DISPONIBLE = false;

/**
 * Envoi automatique du message d'invitation par e-mail. À brancher plus tard
 * (fonction Supabase « Edge Function » + service d'envoi gratuit). D'ici là : refus explicite.
 */
export async function envoyerInvitationParEmail(inv: Invitation): Promise<void> {
	void inv;
	throw new Error('L’envoi automatique par e-mail n’est pas encore branché : copiez le message ou ouvrez votre messagerie.');
}
