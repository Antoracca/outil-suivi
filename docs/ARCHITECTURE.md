# ARCHITECTURE — Suivi consortium APSUD

> Version 1 du 2026-11-21, **à valider**. Les choix sont argumentés dans [RECHERCHE.md](RECHERCHE.md).

> **Mise à jour du 2026-11-22 (phase 2 réalisée)** : ce qui est en place diffère du texte ci-dessous sur ces points, qui priment :
> - **Supabase offre gratuite** (consigne « zéro abonnement », D2), pas Supabase Pro ; coût d'exploitation : 0 $.
> - **Application statique** (SPA, `adapter-static`) : pas de rendu serveur ni de `hooks.server.ts`. Le navigateur parle directement à Supabase avec la clé publique ; toute la sécurité est dans la base.
> - **Écriture uniquement par fonctions SQL** (`SECURITY DEFINER`, une par action, migration 0004) au lieu de politiques INSERT/UPDATE : aucun rôle de l'application n'a de droit d'écriture direct. Les politiques RLS ne servent qu'à la lecture.
> - **Comptes sur invitation par code** (table `invitations`, code haché, lié à l'adresse) au lieu de `inviteUserByEmail`, qui exigerait la clé `service_role` côté serveur. Aucun e-mail n'est nécessaire.
> - **Temps réel par « Postgres Changes »** filtré par la RLS (suffisant pour ≈ 20 comptes) ; la diffusion `broadcast_changes` reste l'option si la charge augmente.
> - **Identifiants texte** : le cadre importé garde les identifiants lisibles de la maquette (« WASH-IDC:act:1.1.1 ») ; les saisies reçoivent un identifiant généré sur l'appareil, ce qui rend chaque envoi rejouable.
> - **Tests** : PGlite (PostgreSQL complet en WebAssembly) au lieu de pgTAP et de la base locale Supabase, faute de Docker : `npm run test:db`.
> - Fichiers réels : `supabase/migrations/` (7 migrations), `supabase/tests/`, `src/lib/donnees/reel/`. Mise en service : [MISE-EN-SERVICE.md](MISE-EN-SERVICE.md).

---

## 1. Vue d'ensemble

```
 Navigateur (ordinateur / téléphone, 3G)
   │  HTML rendu côté serveur + JS d'enrichissement + file d'attente locale (IndexedDB)
   ▼
 Application SvelteKit ── hébergée sur Cloudflare Pages (suivi.apsud.org)
   │  @supabase/ssr : session dans un cookie sécurisé, requêtes au nom de l'utilisateur
   ▼
 Supabase (région Paris, eu-west-3)
   ├── PostgreSQL ── schéma métier + sécurité par ligne (RLS) + journal d'audit (triggers)
   ├── Realtime   ── diffusion des changements sur un canal privé par projet
   ├── Storage    ── justificatifs (photos, PDF) avec règles par organisation
   └── Auth       ── comptes nominatifs sur invitation (e-mail via SMTP Brevo)
```

**Principe** : la **sécurité vit dans la base**, pas dans l'interface. Même si quelqu'un contourne l'application, PostgreSQL refuse une écriture hors de son organisation et refuse toute suppression (§5).

## 2. Pile technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Application | **SvelteKit 2, Svelte 5, TypeScript strict** | Rendu serveur et formulaires qui marchent sans JS (amélioration progressive), très peu de JS envoyé (adapté à la 3G), routes par fichier |
| Hébergement | **Cloudflare Pages** + `@sveltejs/adapter-cloudflare` | Gratuit à ce volume, réseau mondial avec des points de présence en Afrique, HTTPS automatique. L'hébergement LWS mutualisé du site ne fait pas tourner Node |
| Base de données | **Supabase Pro** (PostgreSQL 15+), région Paris | Modèle relationnel, RLS, Realtime, Storage et Auth intégrés, environ 25 $/mois. Postgres standard, donc portable (plan B : Scaleway) |
| Courriel | SMTP **Brevo** (offre gratuite, 300 e-mails/jour) | Le SMTP par défaut de Supabase est limité à quelques e-mails par heure |
| Styles | CSS natif à tokens (`src/lib/styles/tokens.css`), `@layer` | Même méthode que le site, pas de dépendance |
| Exports Excel | **ExcelJS** côté serveur | Reproduit les deux feuilles des fichiers actuels (fusions, en-têtes, formats) |
| Import Excel | Script Node (`scripts/import-excel/`) avec ExcelJS | Lecture des 5 fichiers, correction du séparateur de milliers, rapport d'anomalies |
| Tests | **Vitest** (logique), **Playwright** (parcours), **pgTAP** (sécurité SQL) | Chaque règle d'accès est prouvée par un test |
| Outillage base | **Supabase CLI** (migrations, génération des types, base locale) | Le schéma n'évolue que par migrations versionnées |

## 3. Arborescence du projet

```
plateforme-consortium/
├── INSTRUCTIONS.md · CLAUDE.md · AGENTS.md
├── docs/                         DESIGN, ARCHITECTURE, PLAN, RECHERCHE
├── package.json · svelte.config.js · vite.config.ts · tsconfig.json · .env.example
├── supabase/
│   ├── config.toml
│   ├── migrations/               0001_socle.sql, 0002_cadre_logique.sql, 0003_saisies.sql,
│   │                             0004_rls.sql, 0005_audit.sql, 0006_temps_reel.sql, 0007_vues.sql …
│   ├── seed/                     organisations, secteurs, zones (admin RCA), référentiel CBPF
│   └── tests/                    pgTAP : un fichier par règle de sécurité
├── scripts/
│   ├── import-excel/             lecture des 5 plans d'action → SQL ou JSON validé + rapport d'anomalies
│   └── import-referentiel-cbpf/  téléchargement de la liste officielle des indicateurs (API OCHA)
├── src/
│   ├── app.html · app.d.ts · hooks.server.ts   (session Supabase, garde des routes)
│   ├── lib/
│   │   ├── styles/               tokens.css, base.css, utilitaires.css
│   │   ├── icones/               SVG maison + Icone.svelte
│   │   ├── composants/
│   │   │   ├── structure/        CadreApplication, BarreLaterale, BarreContexte, PanneauDetails…
│   │   │   ├── donnees/          GrilleSaisie, ArbreCadreLogique, CalendrierSemaines, MatriceRapports…
│   │   │   ├── graphiques/       JaugeJalon
│   │   │   └── ui/               Bouton, Champ, ChampNombre, Dialogue, ResumeErreurs…
│   │   ├── donnees/              accès typé à Supabase (une fonction par requête métier)
│   │   ├── temps-reel/           abonnement au canal, magasin des notifications
│   │   ├── hors-ligne/           file d'attente IndexedDB, synchronisation idempotente
│   │   ├── exports/              Excel plan d'action, tableau de suivi des indicateurs, OneGMS, 5W
│   │   ├── format/               nombres et dates au format français
│   │   └── types/                base.ts (généré par supabase gen types)
│   └── routes/                   (voir §9)
└── tests/                        Vitest + Playwright
```

## 4. Modèle de données

Toutes les tables ont : `id uuid` (généré côté client possible, pour l'idempotence hors-ligne), `cree_le`, `cree_par`, `modifie_le`, `modifie_par`, et, pour les tables métier, `archive_le` (null = actif).

### 4.1 Organisations et personnes

| Table | Colonnes clés | Remarques |
|---|---|---|
| `organisations` | `sigle` (APSUD, ARS, AFPE, GADY, IDC), `nom`, `role_consortium` (`chef_de_file`, `partenaire`), `logo_chemin`, `point_focal` | 5 lignes |
| `profils` | `id` = `auth.users.id`, `nom_complet`, `fonction`, `telephone`, `organisation_id`, `role` (`super_admin`, `coordination`, `saisie`, `lecture`), `actif` | Un compte = une personne. `coordination` est réservé à APSUD |

### 4.2 Projet et référentiels

| Table | Colonnes clés | Remarques |
|---|---|---|
| `projets` | `code_cbpf`, `intitule`, `bailleur`, `date_debut`, `date_fin`, `devise`, `objectif_general` | Prévu pour plusieurs projets (consortiums futurs) |
| `secteurs` | `code` (WASH, NUT, SAN, PE, SECAL), `libelle`, `cluster_cbpf` (WSH, NUT, HEA, PRO, FSA), `pictogramme` | Référentiel |
| `zones` | `prefecture`, `sous_prefecture`, `commune`, `code_admin` | Importé du modèle 5W (feuilles admin) |
| `projet_zones` | `projet_id`, `zone_id` | Nanga-Boguila, Paoua, Bossangoa |
| `referentiel_indicateurs` | `id_cbpf`, `code` (ex. `NUT/C-CA5/N.3a`), `libelle_en`, `unite`, `has_femmes`, `has_filles`, `has_hommes`, `has_garcons`, `cluster`, `est_principal`, `actif` | Liste officielle OCHA (822 lignes, API publique `GLB_INDIC_MST`) |
| `periodes` | `projet_id`, `mois` (1er du mois), `rang` (1 à 10), `echeance`, `ouverte` | Novembre 2026 à août 2027 |

### 4.3 Cadre logique (feuille 2 des Excel)

```
projets 1─n volets 1─n outcomes 1─n outputs 1─n activites 1─n taches
                         │            │            │
                         └────────────┴────────────┴──── indicateurs (rattachés à un des trois niveaux)
```

| Table | Colonnes clés | Remarques |
|---|---|---|
| `volets` | `projet_id`, `organisation_id`, `secteur_code`, `intitule`, `cadre_verrouille` | 5 volets ; quand APSUD verrouille le cadre, la structure ne bouge plus (les saisies continuent) |
| `outcomes` | `volet_id`, `numero` (1, 2), `libelle` | |
| `outputs` | `outcome_id`, `numero` (1.1, 1.2), `libelle` | |
| `activites` | `output_id`, `numero` (1.1.1), `libelle`, `responsable`, `budget_planifie` | Créables par l'ONG du volet tant que le cadre n'est pas verrouillé |
| `indicateurs` | `volet_id`, `niveau` (`outcome`, `output`, `activite`), `outcome_id` / `output_id` / `activite_id` (un seul renseigné, contrainte CHECK), `referentiel_id` (facultatif), `libelle`, `unite`, `type_valeur` (`nombre`, `pourcentage`), `mode_cumul` (`somme`, `derniere_valeur`, `maximum`), `nature_comptage` (`personnes_uniques`, `participations`, `unites`), `desagrege`, `cible_femmes`, `cible_filles`, `cible_hommes`, `cible_garcons`, `cible_total`, `moyens_verification text[]`, `ordre` | `cible_total` = somme des 4 quand l'indicateur est désagrégé (contrainte) |

### 4.4 Plan d'action (feuille 1 des Excel)

| Table | Colonnes clés | Remarques |
|---|---|---|
| `taches` | `activite_id`, `libelle` (« Action à prendre »), `responsable`, `date_debut`, `date_fin`, `ordre` | Contrainte : `date_fin >= date_debut`, dates comprises dans le projet |
| `taches_semaines` | `tache_id`, `periode_id`, `semaine` (1 à 5), `prevu`, `realise` | Les croix S1-S5 ; clé unique (tâche, période, semaine) |
| `avancements_activite` | `activite_id`, `periode_id`, `taux_execution` (0 à 100), `resultats_obtenus`, `observations` | Une ligne par activité et par mois (versionnée, §4.6) |
| `depenses` | `activite_id`, `periode_id`, `montant`, `devise`, `libelle`, `justificatif_id` | Le budget exécuté = somme des dépenses ; le « progrès finance » = exécuté / planifié |

### 4.5 Rapports mensuels et valeurs d'indicateurs

| Table | Colonnes clés | Remarques |
|---|---|---|
| `rapports` | `volet_id`, `periode_id`, `statut` (`brouillon`, `soumis`, `a_corriger`, `valide`, `verrouille`), `soumis_par`, `soumis_le`, `decision_par`, `decision_le`, `motif_correction` | Clé unique (volet, période). Transitions contrôlées par une fonction SQL (§6) |
| `valeurs_indicateur` | `indicateur_id`, `periode_id`, `zone_id` (facultatif), `femmes`, `filles`, `hommes`, `garcons`, `total`, `commentaire`, `version`, `est_courante` | **Réalisé du mois**, jamais le cumul (calculé, §4.7). Contrôles : valeurs ≥ 0, total = somme si désagrégé, pourcentage entre 0 et 100 |

### 4.6 Versionnement plutôt qu'écrasement

Une saisie modifiée **n'écrase pas** l'ancienne : on insère une **nouvelle version** (`version + 1`, `est_courante = true`) et l'ancienne passe à `est_courante = false`.
- L'historique complet d'une cellule est lisible dans le panneau Détails.
- Deux saisies hors-ligne concurrentes ne se détruisent pas : la plus récente devient courante et l'autre reste visible dans l'historique, avec une alerte « conflit » pour la coordination.
- Cela s'applique à `valeurs_indicateur` et `avancements_activite`.

### 4.7 Vues de calcul (lecture seule)

| Vue | Contenu |
|---|---|
| `v_cumul_indicateur` | Par indicateur et par mois : réalisé du mois, cumul (selon `mode_cumul`), cible, taux d'atteinte, écart en % |
| `v_avancement_volet` | Par volet : % d'indicateurs dans les temps, budget planifié / exécuté / %, rapports soumis |
| `v_matrice_rapports` | Volets × mois avec statut et retard |
| `v_plan_action` | Reconstitution de la feuille 1 (pour l'export Excel) |
| `v_suivi_indicateurs` | Reconstitution de la feuille 2 avec les lignes Planifié / Actuel / Cumul |
| `v_export_5w` | Lignes au format des colonnes du modèle 5W WASH |
| `v_export_onegms` | Valeurs cumulées par indicateur, personnes atteintes par sexe et âge, dépenses par sous-partenaire (onglet Subgrants), écarts de plus de 15 % à justifier |

### 4.8 Justificatifs, journal, notifications

| Table | Colonnes clés | Remarques |
|---|---|---|
| `justificatifs` | `organisation_id`, `rattachement_type` (`indicateur`, `activite`, `tache`, `rapport`, `depense`), `rattachement_id`, `periode_id`, `chemin_stockage`, `nom_fichier`, `type_mime`, `taille`, `moyen_verification` | Fichier dans Storage, bucket privé `justificatifs/<organisation>/<période>/…` |
| `journal_audit` | `id bigserial`, `table_nom`, `ligne_id`, `action` (`INSERT`, `UPDATE`, `ARCHIVE`, `DELETE`), `auteur_id`, `organisation_id`, `horodatage`, `ancien jsonb`, `nouveau jsonb`, `champs_modifies text[]` | Alimenté **uniquement** par trigger ; aucun droit UPDATE ni DELETE, pour personne |
| `notifications` | `destinataire_id`, `type`, `titre`, `lien`, `evenement_audit_id`, `lue_le` | Historique « non lu » ; créées par trigger à partir des événements importants |

## 5. Sécurité

### 5.1 Rôles

| Rôle | Peut |
|---|---|
| `lecture` | Tout consulter (selon D3), rien modifier |
| `saisie` (ONG) | Ajouter et modifier les données **de son organisation** : activités et tâches (si le cadre n'est pas verrouillé), calendrier, valeurs, dépenses, avancements, justificatifs ; soumettre ses rapports ; archiver ses propres lignes |
| `coordination` (APSUD) | Tout ce que fait `saisie`, sur **tous** les volets ; valider ou renvoyer pour correction ; verrouiller ou déverrouiller un cadre ou un rapport ; gérer les périodes |
| `super_admin` | Tout, y compris **supprimer définitivement**, gérer les comptes et lire le journal complet |

### 5.2 Règles appliquées dans PostgreSQL

1. **RLS activée sur toutes les tables** du schéma `public`.
2. **SELECT** : tout profil actif du projet (D3, lecture de tout le consortium).
3. **INSERT / UPDATE** : `organisation_id = mon_organisation()` (ou rôle `coordination` / `super_admin`), et seulement si le rapport du mois n'est ni `valide` ni `verrouille`.
4. **DELETE** :
   - `REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM authenticated, anon` ;
   - une seule politique DELETE par table : `USING (est_super_admin())` ;
   - le droit est rendu au seul rôle de base utilisé par les fonctions d'administration (fonction `supprimer_definitivement()` en `SECURITY DEFINER`, qui vérifie `est_super_admin()` et inscrit l'action au journal).
5. **Archivage** : fonction `archiver(table, id)` qui remplit `archive_le` (les vues filtrent les lignes archivées ; un écran « Archives » permet de les revoir et de les restaurer).
6. **Fonctions d'aide** (`SECURITY DEFINER`, `search_path` fixé) : `mon_organisation()`, `mon_role()`, `est_super_admin()`, `est_coordination()`. Les colonnes utilisées par les politiques sont indexées.
7. **Clés** : seule la clé publique (`anon`) va dans le navigateur. La clé `service_role` reste sur le serveur (variables d'environnement Cloudflare), pour les invitations et les scripts d'import uniquement.
8. **Storage** : bucket privé, lecture par URL signée de courte durée, écriture limitée au dossier de son organisation, aucune politique de suppression sauf super-admin.

### 5.3 Authentification

- **Pas d'inscription libre** : un compte n'existe que sur **invitation** par la coordination ou le super-admin (`auth.admin.inviteUserByEmail`, côté serveur).
- Connexion par **e-mail et mot de passe** (compatible avec les gestionnaires de mots de passe) avec, en option, un **lien magique** ; double authentification (TOTP) proposée aux rôles `coordination` et `super_admin`.
- Session en cookie `HttpOnly`, `Secure`, `SameSite=Lax` via `@supabase/ssr`.

## 6. Circuit de validation

```
 brouillon ──(ONG : Soumettre)──▶ soumis ──(APSUD : Valider)──▶ valide ──(APSUD : Verrouiller)──▶ verrouille
     ▲                              │
     └──(APSUD : Renvoyer pour correction, motif obligatoire)── a_corriger ◀┘
```

- Les transitions passent **uniquement** par la fonction SQL `changer_statut_rapport(rapport_id, nouveau_statut, motif)`, qui vérifie le rôle, l'état de départ et les contrôles bloquants (valeurs invalides, justificatifs obligatoires manquants).
- Un rapport `valide` ou `verrouille` n'accepte plus de modification. Le déverrouillage est une action tracée de la coordination, avec motif.
- Chaque transition crée une notification pour les personnes concernées (l'ONG du volet, la coordination).

## 7. Temps réel et notifications

- **Diffusion** : un trigger sur les tables métier appelle `realtime.broadcast_changes()` vers le canal privé `projet:<id>`. Ce mode est recommandé par Supabase pour la sécurité et la montée en charge, contrairement à « Postgres Changes ».
- **Autorisation** : une politique RLS sur `realtime.messages` n'autorise l'abonnement au canal qu'aux profils actifs du projet.
- **Côté navigateur** (`src/lib/temps-reel/`) : un abonnement unique par session met à jour les vues ouvertes. La cellule concernée reçoit la trace « modifiée à l'instant », le fil d'activité s'enrichit, le compteur de la cloche augmente et le changement est annoncé en `role="status"`.
- **Persistance** : les notifications sont aussi écrites dans `notifications`, pour que l'utilisateur déconnecté les retrouve à son retour.
- **Événements notifiés** : rapport soumis, validé, renvoyé pour correction ; nouvelle activité ou tâche ; valeur modifiée après soumission ; échéance à J-2 et dépassée ; justificatif ajouté ; conflit de saisie hors-ligne.
- **Résumé par e-mail** (facultatif, phase 5) : un message quotidien pour les notifications non lues, via une fonction planifiée.

## 8. Connexions lentes et hors-ligne

- **Version 1** :
  - application installable (PWA) avec un service worker qui met en cache l'interface et les données du mois ouvert ;
  - chaque saisie est d'abord écrite dans une **file IndexedDB** avec un `uuid` généré sur l'appareil, puis envoyée ;
  - l'envoi est **idempotent** : un renvoi ne crée pas de doublon ;
  - un bandeau signale ce qui attend d'être envoyé.
- **Version 2, si le terrain l'exige (D8)** : PowerSync (base SQLite locale synchronisée avec Postgres, en respectant la RLS).
- Images compressées dans le navigateur avant l'envoi (largeur max 1 600 px, WebP), envoi reprenable.

## 9. Routes

| Route | Écran | Rôles |
|---|---|---|
| `/connexion`, `/invitation/[jeton]`, `/mot-de-passe` | Accès | Public |
| `/` | Tableau de bord du consortium | Tous |
| `/volets/[code]` | Fiche du volet : synthèse, onglets | Tous |
| `/volets/[code]/cadre-logique` | Arbre du cadre logique | Tous (édition : saisie de l'ONG, coordination) |
| `/volets/[code]/plan-action` | Calendrier S1-S5, tâches, budget | Tous (édition idem) |
| `/volets/[code]/rapports/[mois]` | Saisie du mois (indicateurs, activités, budget, résultats, justificatifs) | Tous (édition idem) |
| `/validation` | File des rapports soumis | Coordination |
| `/activite` | Fil d'activité complet et filtrable | Tous |
| `/exports` | Excel, tableau de suivi des indicateurs, OneGMS, 5W | Tous (selon droits) |
| `/archives` | Lignes archivées, restauration | Coordination, super-admin |
| `/administration/{organisations,utilisateurs,periodes,referentiels,journal}` | Administration | Super-admin (périodes : coordination) |
| `/profil` | Mon compte, préférences (densité, notifications) | Tous |
| `/dev/icones`, `/dev/composants` | Planches de contrôle (non publiées en production) | Développement |

## 10. Import et exports

- **Import initial** (`scripts/import-excel/`) :
  - lit les 5 fichiers de `../docs/excel/` ;
  - reconstruit outcomes, outputs, activités, tâches, indicateurs et cibles ;
  - corrige le séparateur de milliers (anomalies A7 à A9) ;
  - produit un **rapport d'anomalies** à faire valider par APSUD avant tout chargement ;
  - ne charge rien en production sans validation (D1).
- **Référentiel CBPF** (`scripts/import-referentiel-cbpf/`) : télécharge la liste officielle (API publique OCHA) et rattache les indicateurs du projet par leur code.
- **Exports** :
  - Plan d'action au format Excel actuel (2 feuilles, une par volet ou toutes réunies) ;
  - tableau de suivi des indicateurs (indicateur × mois : planifié, réalisé, cumul, %) ;
  - fiche OneGMS (valeurs à recopier) ;
  - 5W WASH (colonnes du modèle PRH) ;
  - CSV brut.
- Pas d'intégration automatique avec OneGMS : OCHA ne publie pas d'API d'écriture, son API publique est en lecture seule.

## 11. Tests et qualité

- **pgTAP**, un test par règle :
  - une ONG ne peut pas écrire dans le volet d'une autre ;
  - un DELETE échoue pour `saisie` et `coordination` ;
  - un DELETE réussit pour `super_admin` et apparaît au journal ;
  - une valeur ne se modifie plus après validation ;
  - le journal est inaltérable ;
  - l'abonnement au canal temps réel est refusé à un inconnu.
- **Vitest** : calcul des cumuls et des taux, format français, file hors-ligne.
- **Playwright** : saisie complète d'un mois au clavier seul, soumission, validation, notification reçue dans un second navigateur, captures aux 8 largeurs.
- **Accessibilité** : axe-core dans Playwright sur chaque écran.

## 12. Environnements, sauvegardes, coûts

- **Environnements** : base locale (Supabase CLI) pour le développement ; un projet Supabase « préproduction » (offre gratuite, données fictives) ; un projet « production » (Pro).
- **Sauvegardes** :
  - sauvegarde quotidienne Supabase (7 jours) ;
  - plus un `pg_dump` hebdomadaire chiffré vers un stockage externe ;
  - restauration testée une fois avant la mise en ligne.
- **Coût d'exploitation estimé sur 12 mois** :

| Poste | Montant |
|---|---|
| Supabase Pro | ≈ 300 $ |
| Cloudflare Pages | 0 $ |
| Brevo | 0 $ (offre gratuite) |
| Domaine | 0 $ (sous-domaine d'apsud.org) |
| En option : restauration à la minute près (PITR) | + 100 $/mois |
| En option : PowerSync | + 49 $/mois |

- **Plafond de dépense** activé sur Supabase pour éviter toute surprise de facturation.
