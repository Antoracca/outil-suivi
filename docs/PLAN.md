# PLAN — Mise en œuvre de la plateforme

> Version 2 du 2026-11-21. Deux consignes du développeur la fondent : **zéro abonnement**, et **l'interface d'abord, le serveur ensuite**. Chaque phase se termine par une démonstration et une **validation du développeur** avant la suivante. Après chaque phase : mettre à jour le Journal et la Carte d'INSTRUCTIONS.md.

---

## Phase 0 : Cadrage ✅

**Livrables** :
- analyse des 5 plans d'action et du modèle 5W ;
- recherche (lien OCHA, solutions existantes, base de données, interface) et sa contre-vérification ;
- INSTRUCTIONS, DESIGN (format Expo), ARCHITECTURE, PLAN, RECHERCHE.

## Phase 1 : Maquette interactive, front-end seul 🔶 (en cours)

**But** : voir et manipuler tout l'outil, avec toutes ses règles, avant d'écrire une ligne de serveur.

1. ✅ Projet SvelteKit 3 statique, police Mona Sans, tokens issus de DESIGN.md, base CSS en couches.
2. ✅ Import des 5 Excel en données de démonstration (`npm run donnees:demo`), avec un rapport des 46 anomalies.
3. ✅ Dépôt simulé dans le navigateur (`depot.svelte.ts`), qui applique les règles de `regles.ts` :
   - droits par rôle et par organisation ;
   - pas de suppression sauf super-admin, archivage et restauration ;
   - versions des valeurs, journal d'audit inaltérable ;
   - circuit Brouillon → Soumis → Validé / À corriger → Verrouillé, avec motif obligatoire ;
   - notifications, temps réel entre onglets, simulation hors-ligne.
4. ✅ Icônes et pictogrammes de secteur maison ; 12 composants d'interface et 6 de structure.
5. ✅ Écrans : connexion (comptes fictifs), tableau de bord, volet (synthèse, cadre logique, plan d'action S1-S5, saisie du mois), validation, activité, archives, administration, exports CSV.
6. ✅ Passe responsive native sur les 8 largeurs (téléphone : barre basse, fiches par indicateur, calendrier en liste) : 88 mesures sans débordement.
7. ✅ Revue d'accessibilité : audit axe-core sans défaut (11 écrans, 3 largeurs), contrastes corrigés, parcours au clavier seul vérifié. Reste un test avec un vrai lecteur d'écran (NVDA) au moment de la recette.
8. ⏳ Démonstration au développeur, puis au client APSUD.

**Critères d'acceptation** :
- un mois complet saisi au clavier seul ;
- soumission, renvoi et validation visibles en direct dans un second onglet ;
- aucune suppression possible hors super-admin ;
- aucun débordement aux 8 largeurs ;
- `npm run check` et `npm run build` sans erreur.

## Phase 2 : Back-end gratuit 🔶 (schéma, sécurité et tests faits le 2026-11-22)

Choix selon D2 (INSTRUCTIONS.md §8) : **Supabase, offre gratuite**. Fait : points 2, 3 et 4 (7 migrations, 29 tests réussis), plus le branchement de l'interface (phase 3, point 1 et une partie du point 2). Reste : point 1 (création du projet par APSUD, voir MISE-EN-SERVICE.md) et point 5 (automatisations).
1. Création du projet par le développeur, sur son compte. Clés dans `.env`, jamais dans le dépôt.
2. Migrations SQL du modèle d'ARCHITECTURE.md §4.
3. Sécurité de §5 :
   - sécurité par ligne ;
   - `REVOKE DELETE` et suppression réservée au super-admin ;
   - archivage ;
   - journal d'audit par déclencheur ;
   - fonction de changement de statut.
4. Tests pgTAP de chaque règle, en local avec une base PostgreSQL de test.
5. Automatisations gratuites (GitHub Actions) :
   - sollicitation quotidienne de la base, contre la mise en pause ;
   - sauvegarde hebdomadaire `pg_dump`.

**Critères** : tests verts ; un compte ONG ne peut ni supprimer ni écrire chez une autre ONG ; toute modification apparaît au journal ; restauration d'une sauvegarde testée.

## Phase 3 : Branchement des écrans au back-end

1. Remplacer l'intérieur de `depot.svelte.ts` par des appels au back-end, avec la même interface publique.
2. Remplacer la simulation par les vrais services :
   - authentification par invitation, avec un SMTP gratuit (Brevo) ;
   - temps réel par diffusion sur un canal privé ;
   - notifications persistantes.
3. Import des données validées par APSUD (anomalies corrigées, D1).

**Critères** : deux comptes de deux ONG sur deux appareils voient les mises à jour de l'autre en moins de 2 secondes.

## Phase 4 : Justificatifs réels et export Excel natif

- Envoi des fichiers : compression des images, envoi reprenable, règles par organisation.
- Export `.xlsx` identique aux fichiers actuels (deux feuilles par volet), en plus des CSV déjà présents dans la maquette.

## Phase 5 : Hors-ligne réel et performance 3G

- Application installable (service worker, cache du mois ouvert).
- File IndexedDB avec envoi idempotent.
- Budgets de DESIGN.md mesurés en 3G simulée.

## Phase 6 : Recette, formation, mise en ligne

- Hébergement gratuit, sous-domaine `suivi.apsud.org` (DNS chez LWS).
- Recette avec un utilisateur de chaque ONG.
- Formation d'une heure par ONG et guide illustré.
- Sauvegarde vérifiée.

---

## Hors périmètre de la version 1

- Collecte terrain par KoboToolbox reliée à la plateforme.
- Version anglaise.
- Plusieurs consortiums en parallèle (le modèle le permet déjà).
- Affichage public de chiffres validés sur le site APSUD (avec l'accord d'APSUD).
