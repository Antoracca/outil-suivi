# RECHERCHE — Ce qui existe déjà, et nos choix

> Synthèse de la recherche du 2026-11-21 : 4 recherches web en parallèle, puis une contre-vérification. On ne réinvente pas la roue : ce document dit **ce qu'on reprend, d'où, et pourquoi**.

---

## 1. Le lien envoyé par le client (OCHA GMS)

Lien : https://gms.unocha.org/en/content/gms-training-upcoming-release-june-2020

- **Source** : officielle. C'est le portail d'aide du **Grant Management System** d'OCHA (« GMS Support / Help Portal », service fourni par OCHA, licence CC BY 4.0). L'application elle-même se trouve sur `onegms.unocha.org`.
- **Contenu de la page** : une note de formation interne du 06/07/2020, sur une ancienne version du GMS. Elle traite des signataires, des avenants et des tableaux de bord de l'époque, mais **pas du suivi d'indicateurs**.
- **Le rapport avec notre projet** : le GMS, devenu **OneGMS**, est **obligatoire pour les fonds communs pays (CBPF), donc pour le FH RCA**. APSUD, titulaire de la subvention, y déclare :
  - le cadre logique ;
  - les indicateurs standard (codes du type `NUT/C-CA5/N.3a`) ;
  - les rapports narratifs (avancement, final) ;
  - les rapports financiers (intermédiaires, final) ;
  - **pour le compte de ses sous-partenaires** (onglet Subgrants).
- **Ce que OneGMS ne fait pas**, et qui justifie notre plateforme :

| Besoin du consortium | OneGMS |
|---|---|
| Espace de saisie pour chaque sous-partenaire (ARS, AFPE, GADY, IDC) | Non : le chef de file saisit tout |
| Tâches, responsables, dates, semaines S1-S5 | Non : une case par mois et par activité |
| Budget planifié / exécuté par activité au fil de l'eau | Non : seulement aux échéances des rapports financiers |
| Notifications entre ONG du consortium | Non |
| Suppression réservée au super-administrateur | Partiel |
| 5W du cluster WASH | Non |

- **Conclusion** : le lien **a un rapport**. Il désigne le système officiel que la plateforme doit **alimenter** (exports prêts à recopier), **pas un modèle à copier**.
- **Ressource utile trouvée** : la **liste officielle des indicateurs CBPF** est publique et téléchargeable (`https://cbpfapi.unocha.org/vo3/odata/GlobalGenericDataExtract?SPCode=GLB_INDIC_MST&PoolfundCodeAbbrv=&GlobalIndicatorType=&$format=csv`).
  - Elle compte 822 indicateurs, dont 712 actifs.
  - Elle précise la désagrégation de chacun (colonnes HasM / HasW / HasB / HasG).
  - Elle contient l'indicateur `NUT/C-CA5/N.3a` des fichiers du client.
  - On l'importe comme référentiel (PLAN.md, phase 2).
- **À noter pour APSUD** : un écart de plus de 15 % entre cible et réalisé doit être justifié dans le rapport final OneGMS. La plateforme le signale (vue `v_export_onegms`).

## 2. Solutions existantes dans le monde

| Solution | Éditeur | Points forts | Limites pour nous | Prix |
|---|---|---|---|---|
| **ActivityInfo** | BeDataDriven (Pays-Bas) | Référence des clusters et de l'ONU pour le reporting des partenaires ; rôle « partenaire » qui ne voit que ses lignes ; hors-ligne ; journal d'audit avec restauration ; circuit de validation (champ « Reviewer only ») ; automatisations par e-mail ou webhook ; interface en français ; **utilisé en RCA par REACH depuis 2016** | Ne reproduit pas le plan d'action (tâches, budget, semaines) sans tout remodéliser ; aucune notification instantanée dans l'interface (seulement des e-mails) ; outil générique | Programme dès 3 700 €/an (5 utilisateurs complets + 15 basiques ; +75 € par complet, +55 € par basique ; un basique peut saisir) |
| **ReportHub** | iMMAP | Reporting mensuel des clusters (Afghanistan, Nigeria WASH…), alertes, tableaux de bord en direct | Documentation publique quasi inexistante ; pas de trace en RCA | Fourni aux clusters |
| **UNICEF PRP** | UNICEF (open source) | Désagrégations définies à l'avance ; une saisie alimente deux rapports (cluster + bailleur) | Conçu pour les partenaires de l'UNICEF | Gratuit |
| **Akvo RSR** | Akvo (open source AGPL) | Résultat → indicateur → période ; **programme chef de file** dont la structure se propage aux projets contributeurs | Lourd à héberger et à adapter | Gratuit si auto-hébergé |
| **DHIS2** | Université d'Oslo (open source) | Meilleure grille de saisie (états de cellule, historique, hors-ligne) ; approbation à deux niveaux | Orienté santé et agrégats ; configuration lourde ; interface dense | Gratuit + hébergement |
| **LogAlto** | DevAlto (Canada) | Cadres logiques natifs, grille Passé / Actuel / Futur / Cible finale avec taux | Générique en offre standard ; configuration sur mesure coûteuse | SaaS standard 500 $/mois (10 utilisateurs) ou 1 000 $/mois (50) ; offre configurée 20 000 $/an + 20 000 $ de mise en place |
| **DevResults** | DevResults (États-Unis) | Statut par période (Aucune donnée / En cours / Soumis / Approuvé), désagrégation géographique | Cher ; cibles non désagrégées ; modifier une désagrégation efface les données | 28 000 $/an + 33 800 $ de mise en place (prix officiel) |
| **TolaData** | TolaData (Allemagne) | Tableau de suivi des indicateurs (IPTT) qui correspond à la feuille 2 des Excel | Écrans de désagrégation peu documentés ; grille de prix ambiguë | Dès 49 €/mois HT pour 2 utilisateurs (offre ONG), 109 € pour 5, engagement de 12 mois |
| **KoboToolbox** | Kobo (open source) | Collecte terrain hors-ligne, très répandu en RCA | Collecte seulement : ni cadre logique, ni cibles, ni consolidation | Gratuit (serveur humanitaire) |
| OCHA RPM, Projects Module | OCHA | Niveau cluster et plan de réponse | Pas un outil de pilotage de consortium | Imposés |
| Salesforce, Airtable | — | Génériques et souples | Tout est à construire ; pas de moteur de cadre logique | 12 à 125 $ par utilisateur/mois |

### Décision : créer sur mesure, en imitant les meilleurs

Pourquoi ne pas adopter ActivityInfo tel quel :
1. il ne reproduit pas le plan d'action des fichiers ;
2. ses notifications passent par e-mail (automatisations), sans mise à jour instantanée à l'écran, et une licence « basique » permet de supprimer des enregistrements : la règle « suppression réservée au super-administrateur » demanderait un paramétrage fin des rôles ;
3. c'est un abonnement générique, pas un outil APSUD réutilisable pour les prochains consortiums.

ActivityInfo reste le **plan B** si le développement dérapait.

**Ce qu'on reprend, et d'où** :
- **ActivityInfo** : rôle partenaire limité à ses lignes ; brouillon distinct de « soumis » ; journal d'audit avec restauration ; import Excel validé.
- **Akvo RSR** : APSUD en programme chef de file, les cibles et désagrégations du cadre se propagent aux volets.
- **UNICEF PRP** : désagrégations verrouillées avant la saisie ; une saisie, plusieurs sorties (cadre logique + 5W + OneGMS).
- **DHIS2** : barre de contexte (volet, mois) ; états de cellule ; panneau historique et audit ; badge hors ligne ; approbation puis verrouillage.
- **LogAlto et DevResults** : colonnes Passé / Ce mois / Cible et taux ; matrice de statut par période ; totaux calculés, jamais saisis. À l'inverse de DevResults, on ne perd jamais de données en modifiant une structure : on versionne.
- **TolaData** : tableau de suivi des indicateurs (indicateur × mois).
- **ReportHub** : flux d'alertes (soumis, en retard, sous le seuil).

## 3. Base de données

| Option | Verdict | Raison principale |
|---|---|---|
| **Supabase** (PostgreSQL managé) | ✅ **Retenu** | Données relationnelles et agrégées (projet → volet → outcome → output → activité → indicateur → mois × désagrégation × ONG) : c'est du SQL. Sécurité par ligne pour les droits par ONG, suppression interdite par la base elle-même, temps réel, stockage, authentification. ≈ 25 $/mois |
| PostgreSQL managé + API maison (Scaleway, Neon) | Plan B | Même schéma, hébergeur européen, mais tout le serveur (authentification, temps réel, fichiers) est à écrire et à maintenir |
| Firebase (Firestore) | ❌ Écarté | Modèle documentaire, agrégations limitées (pas de regroupement, pas d'agrégation en temps réel ni hors-ligne), règles de sécurité qui ne filtrent pas. Seul atout : le hors-ligne natif |
| MongoDB Atlas | ❌ Écarté | **Pas plus sécurisé** : la sécurité dépend des droits, du chiffrement, de l'audit et des sauvegardes, pas du type de base. L'audit exige un cluster M10 (≈ 57 $/mois) ; les règles d'accès, l'authentification et la synchronisation mobile d'App Services sont dépréciées ou retirées. Il faudrait tout coder |
| Appwrite, Convex, PocketBase, serveur auto-hébergé | ❌ Écartés | Requêtes relationnelles plus limitées, plateforme propriétaire, PocketBase pas encore en version 1, maintenance à notre charge |

**Points de vigilance avec Supabase** (et leur parade) :

| Point | Parade |
|---|---|
| Pas de région en Afrique | Paris, probablement proche en latence grâce à la fibre via le Cameroun ; à mesurer depuis Bangui |
| Extension d'audit officielle archivée | Trigger d'audit maison, qui enregistre aussi l'auteur |
| Offre gratuite mise en pause après une semaine d'inactivité | Production obligatoirement en offre Pro |
| SMTP par défaut limité | SMTP Brevo |
| Pas de hors-ligne natif | File d'attente locale en version 1, PowerSync si nécessaire |

## 4. Références d'interface

- **DHIS2 Data Entry** : la mise en page en 4 zones (contexte, travail, barre d'actions, panneau de détails) et les états de cellule.
- **ActivityInfo** : brouillon local et statut, champ réservé au relecteur.
- **LogAlto** : grille indicateur avec blocs de colonnes et colonnes masquables mémorisées.
- **CBPF Data Hub et HDX** : tuiles de synthèse cliquables ; indicateur de fraîcheur (« à jour »).
- **GOV.UK Design System** : liste de tâches, résumé d'erreurs, amélioration progressive.
- **IBM Carbon** : tableaux de données accessibles ; statut forme + couleur + texte.
- **USWDS** : indicateur d'étapes.
- **WCAG 2.2 AA** : focus non masqué, alternative au glisser-déposer, cibles de 24 px minimum, messages de statut.

## 5. Sources principales

- OCHA GMS / OneGMS :
  - https://gms.unocha.org/en/content/one-grant-management-system-onegms-overview-1
  - https://gms.unocha.org/en/content/log-frame-2
  - https://gms.unocha.org/en/content/work-plan-1
  - https://gms.unocha.org/en/content/fill-narrative-report-partner
  - https://gms.unocha.org/en/content/financial-reporting-6
  - https://gms.unocha.org/en/content/operational-modalities
- CBPF Data Hub : https://cbpf.data.unocha.org/
- ActivityInfo :
  - https://www.activityinfo.org/about/pricing.html
  - https://activityinfo.org/about/casestudies/reach.html
  - https://www.activityinfo.org/support/docs/working-with-data/understanding-drafts-in-activityinfo.html
- DHIS2 :
  - https://docs.dhis2.org/en/use/user-guides/dhis-core-version-242/collecting-data/data-entry.html
  - https://docs.dhis2.org/en/use/user-guides/dhis-core-version-240/approving-data/data-approval.html
- LogAlto : https://help.logalto.com/article/84-overview-indicators-data-entry-grid
- DevResults : https://devresults.knowledgeowl.com/help/enter-direct-entry-data
- iMMAP ReportHub : https://immap.org/publications-and-resources/reporthub
- Mémo 5W du cluster Sécurité alimentaire RCA : https://fscluster.org/sites/default/files/documents/fsc_car_memo_remplissage5w_2023.pdf
- Supabase :
  - https://supabase.com/pricing
  - https://supabase.com/docs/guides/database/postgres/row-level-security
  - https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
  - https://supabase.com/docs/guides/platform/regions
- Firebase :
  - https://firebase.google.com/docs/firestore/query-data/aggregation-queries
  - https://firebase.google.com/docs/firestore/manage-data/enable-offline
- MongoDB :
  - https://www.mongodb.com/pricing
  - https://www.mongodb.com/docs/atlas/app-services/deprecation/
  - https://www.mongodb.com/docs/atlas/architecture/current/auditing/
- PowerSync : https://powersync.com/pricing
- GOV.UK Design System : https://design-system.service.gov.uk/components/task-list/
- IBM Carbon : https://carbondesignsystem.com/patterns/status-indicator-pattern/
- WCAG 2.2 : https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

## 6. Contre-vérification (2026-11-21)

24 affirmations ont été revérifiées sur les sources primaires. Corrections intégrées ci-dessus :
- **ActivityInfo** : un circuit de validation existe bien, ainsi que des notifications par e-mail via ses automatisations ; il n'y a pas de notification instantanée dans l'interface. Pas de remise « urgence » sur les prix. Interface disponible en français.
- **LogAlto** : les 8 000 $/an venaient d'un site tiers ; prix officiels corrigés.
- **DevResults** : le prix de 28 000 $/an est officiel, plus 33 800 $ de mise en place.
- **TolaData** : 49 €/mois HT pour 2 utilisateurs ; la grille officielle est ambiguë (devis à demander).

Points confirmés :
- OneGMS est obligatoire pour les CBPF depuis 2023, et le projet 41469 figure dans l'API publique ;
- 822 indicateurs, dont 712 actifs ;
- dispense probable de l'état financier au 31/01/2027 pour un projet démarrant le 08/11 ;
- quotas du plan Pro de Supabase (5 M de messages temps réel, 500 connexions simultanées) ;
- DPA RGPD et chiffrement AES-256 au repos chez Supabase ;
- validation indisponible hors ligne dans la nouvelle app de saisie de DHIS2.

Restent **incertains**, à vérifier sur place :
- la latence réelle depuis Bangui et le terrain vers Paris ;
- l'outil 5W actuellement utilisé par les clusters en RCA ;
- les modalités opérationnelles du projet (à demander à la HFU OCHA RCA) ;
- l'absence d'API d'écriture vers OneGMS (aucune documentation trouvée).
