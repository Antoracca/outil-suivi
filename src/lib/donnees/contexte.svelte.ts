/**
 * Contexte de navigation partagé : mois sélectionné, ouverture des panneaux flottants.
 * Le volet vient de l'adresse (/volets/[code]/…).
 */
import { depot } from './depot.svelte';
import { moisARapporter } from './calculs';
import type { Mois } from './types';

class Contexte {
	#mois = $state<Mois | null>(null);
	tiroirOuvert = $state(false);
	navRepliee = $state(false);

	/** Par défaut : le mois dont le rapport est attendu (le mois précédent). */
	get mois(): Mois {
		return this.#mois ?? moisARapporter(depot.etat, depot.maintenant());
	}
	set mois(m: Mois) {
		this.#mois = m;
	}

	decaler(pas: number) {
		const liste = depot.etat.projet.mois;
		const i = liste.indexOf(this.mois);
		const j = Math.min(liste.length - 1, Math.max(0, i + pas));
		this.#mois = liste[j];
		return this.#mois;
	}
}

export const contexte = new Contexte();
