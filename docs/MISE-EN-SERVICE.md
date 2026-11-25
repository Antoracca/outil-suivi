# Mise en service du mode réel (Supabase, offre gratuite)

> Guide pas à pas, à suivre une fois. Durée : environ 30 minutes. Aucun abonnement.
> Le **mode démonstration reste toujours disponible** : l'interrupteur de l'écran de connexion passe de l'un à l'autre.

---

## Ce qui est prêt

| Élément | Où | État |
|---|---|---|
| Schéma de la base (22 tables, 7 migrations) | `supabase/migrations/` | ✅ testé |
| Sécurité : lecture du consortium, écriture par fonctions contrôlées, aucune suppression hors super-admin | migrations 0004 et 0005 | ✅ 29 tests |
| Journal d'activité + journal d'audit inaltérables | migration 0003 | ✅ testé |
| Temps réel, stockage privé des justificatifs | migration 0006 | ✅ (stockage testé, temps réel à vérifier sur le vrai projet) |
| Cadre logique des 5 plans d'action (51 indicateurs) | `supabase/seed/cadre-logique.sql` | ✅ généré |
| Installation en un seul fichier | `supabase/installation/` | ✅ testé |
| Interface en mode réel : connexion, inscription par code, saisies, file hors ligne, invitations | `src/lib/donnees/` | ✅ types et contrat d'appels vérifiés ; **à essayer sur le vrai projet** |

---

## Étape 1 : créer le projet Supabase (gratuit)

1. Créer un compte sur supabase.com avec une adresse **d'APSUD** (pas une adresse personnelle), puis **New project**.
2. Nom : `suivi-consortium-apsud`. Région : **Europe (Paris ou Frankfurt)**.
3. Mot de passe de la base : long, généré, **conservé par APSUD** dans un gestionnaire de mots de passe. Il ne va jamais dans l'application.
4. Offre : **Free**. Ne saisir aucun moyen de paiement.

Limites de l'offre gratuite, à reconfirmer à la création (D2) : environ 500 Mo de base, 1 Go de fichiers, mise en pause après 7 jours **sans aucune activité** (une utilisation normale l'évite).

## Étape 2 : installer la base

Dans **SQL Editor** › **New query** :

1. Coller tout le contenu de `supabase/installation/1-schema.sql`, puis **Run**. Résultat attendu : « Success. No rows returned ».
   Le fichier contient aussi le cadre logique provisoire (migration 0009). Méthode recommandée : la CLI (section « Migrations par la CLI Supabase »).

Variante en ligne de commande (développeur) : `npx supabase link` puis `npx supabase db push`, qui applique `supabase/migrations/`.

## Étape 3 : régler l'authentification

**Authentication** › **Sign In / Providers** › **Email** :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Enable Email provider | Activé | Connexion par e-mail et mot de passe |
| Allow new users to sign up | **Activé** | Nécessaire à l'inscription par code. La base refuse toute inscription sans invitation valide (déclencheur de la migration 0001) |
| Confirm email | **Désactivé** | Le code d'invitation, lié à l'adresse, joue déjà ce rôle. L'envoi d'e-mails gratuit de Supabase est très limité |
| Minimum password length | **10** | Même règle que l'écran d'inscription |

**Authentication** › **URL Configuration** › **Site URL** : l'adresse de l'application (par exemple `https://suivi.apsud.org`, D7).

## Étape 4 : créer le premier super-administrateur

Dans **SQL Editor**, en remplaçant l'adresse et le nom :

```sql
select public.amorcer_super_admin('administration@apsud.org', 'Administration de la plateforme');
```

La requête renvoie un **code** (ex. `7K4P-92QD`), valable 14 jours. Cette fonction ne marche qu'une fois : elle refuse dès qu'un super-administrateur existe.

## Étape 5 : relier l'application

1. **Project Settings** › **API** (ou bouton **Connect**) : copier **Project URL** et la **Publishable key** (ou « anon public » sur les anciens projets).
   **Jamais** la clé `service_role` / `secret`.
2. Dans `plateforme-consortium/`, copier `.env.example` en `.env` et remplir les deux lignes.
3. `npm run build` : le dossier `build/` contient l'application reliée au serveur.

## Étape 6 : premier accès

1. Ouvrir l'application, **désactiver** « Mode démonstration ».
2. Onglet **Inscription** : adresse de l'étape 4 et code, puis nom et mot de passe.
3. **Administration** › **Inviter une personne** : créer le compte de la coordination et ceux de saisie des ONG.
4. Une 6e ONG rejoint le consortium : **Administration** › **Nouvelle ONG** (sigle, nom, secteur), puis inviter son point focal.
   Le code s'affiche une seule fois : le transmettre à la personne (e-mail, WhatsApp). Il ne marche qu'avec son adresse.

## Étape 7 : mettre en ligne (gratuit)

Cloudflare Pages (offre gratuite) : **Create a project** › **Direct upload** › déposer le dossier `build/`. Puis domaine `suivi.apsud.org` (DNS chez LWS, D7).
Pour tester sur le Wi-Fi local : serveur « suivi-consortium-wifi » (voir INSTRUCTIONS.md §9).

---

## Le projet en service (2026-11-22)

| Élément | Valeur |
|---|---|
| Projet | `npcqqivoorfwkfaznsbc`, région **eu-west-1 (Irlande)**, offre gratuite |
| Schéma | 9 migrations appliquées et suivies par la CLI (`supabase_migrations.schema_migrations`) ; rôles : super-administrateur, coordination, saisie |
| Cadre logique | **Chargé, provisoire** (migration 0009) : 51 indicateurs, budgets à 0, sans tâches ; à corriger par une nouvelle migration après validation d’APSUD (D1) |
| Premier super-administrateur | **Pas encore amorcé** (étape 4) |
| Application | `.env` rempli (adresse et clé publique) ; `npm run build` produit la version reliée |

### Migrations par la CLI Supabase

La CLI est installée dans le projet (`npx supabase`, dépendance de développement, gratuite). L'adresse directe `db.<projet>.supabase.co` n'est joignable qu'en IPv6 : depuis un réseau IPv4, passer par le **pooler de session** (Supabase › Connect › Session pooler) :

```
npx supabase migration list --db-url "postgresql://postgres.npcqqivoorfwkfaznsbc:<MOT_DE_PASSE>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
npx supabase db push        --db-url "…même adresse…"
```

- Une nouvelle migration = un nouveau fichier `supabase/migrations/<horodatage>_<nom>.sql`, testé par `npm run test:db`, puis `db push`. Ne jamais modifier une migration déjà poussée.
- Le mot de passe ne s'écrit dans aucun fichier du projet : il se tape dans la commande, ou on utilise `npx supabase login` puis `npx supabase link --project-ref npcqqivoorfwkfaznsbc` sur le poste du développeur.
- Le schéma avait été collé dans l'éditeur SQL avant l'arrivée de la CLI : l'historique a été aligné par `migration repair --status applied` après vérification que la base en ligne était identique aux 7 migrations (22 tables, 45 fonctions du projet, 22 politiques, 19 déclencheurs d'audit, 14 tables en temps réel). La seule fonction en plus, `rls_auto_enable()`, est ajoutée par Supabase lui-même.

## Alertes push (notifications même plateforme fermée), 2026-11-25

Circuit : une notification est créée en base → déclencheur `notifications_push` (migration 0015, extension `pg_net`) → fonction Edge `envoyer-push` (`supabase/functions/envoyer-push/`) → alerte Web Push sur chaque appareil abonné du destinataire → le service worker `static/sw.js` l'affiche ; un clic ouvre l'élément concerné.

Mise en service, à faire une fois, dans un terminal, depuis `plateforme-consortium/` :

1. Se connecter au CLI Supabase (ouvre le navigateur) : `node node_modules/supabase/dist/supabase.js login`
2. Générer les clés et déployer : `node scripts/push/configurer-push.mjs` (demande l'adresse https de la plateforme). La clé privée part directement dans les secrets de la fonction Edge (`VAPID_CLE_PRIVEE`, avec `VAPID_CLE_PUBLIQUE` et `VAPID_SUJET`) : elle n'est ni affichée ni écrite dans le projet. La clé publique est écrite dans `src/lib/donnees/reel/cle-push-publique.ts` (publique par nature, à committer).
3. Appliquer la migration 0015 : `node scripts/supabase/pousser.mjs` (mot de passe de la base, masqué).
4. Mettre le code en ligne (commit de la clé publique, push).
5. Sur chaque appareil : cloche › « Activer » (le navigateur demande l'autorisation).

Sécurité : aucun secret dans la base ni dans le dépôt. La fonction Edge est déployée sans vérification de jeton, mais n'envoie que pour une notification de moins de 10 minutes pas encore poussée (`push_envoye_le`), qu'elle marque aussitôt : un appel forgé ne peut déclencher qu'une alerte qui serait partie de toute façon. Les abonnements (`abonnements_push`) ne sont lisibles par aucun compte ; chacun abonne ou retire son appareil par deux fonctions SQL. Redéployer la fonction après une modification : `node scripts/push/configurer-push.mjs --redeployer`.

Limites : iPhone et iPad reçoivent le push seulement si la plateforme est ajoutée à l'écran d'accueil (iOS 16.4 ou plus) ; un appareil dont l'utilisateur a bloqué les notifications ne reçoit rien (la cloche l'indique).

## Reste à faire (prochaines étapes, toujours gratuites)

- **Automatisations GitHub Actions** : sollicitation quotidienne de la base (contre la mise en pause) et sauvegarde `pg_dump` hebdomadaire, avec un test de restauration (PLAN.md, phase 2, point 5).
- **Mot de passe oublié** : brancher un SMTP gratuit (Brevo, 300 e-mails par jour). En attendant, le super-administrateur désactive le compte et réinvite la personne avec une autre adresse.
- **Désactivation d'un compte depuis l'écran Administration** (la fonction `modifier_compte` existe déjà).
- **Ouverture des justificatifs** depuis l'écran (lien temporaire : `depot.lienJustificatif`, déjà écrit).
- **Types TypeScript générés** depuis la base (`npx supabase gen types`) une fois le projet créé.
- **Essai complet sur le vrai projet** : deux comptes de deux ONG sur deux appareils (critère de la phase 3).
- **Changer le mot de passe de la base** (Project Settings › Database › Reset database password) : il a circulé en clair dans une conversation le 2026-11-22.
