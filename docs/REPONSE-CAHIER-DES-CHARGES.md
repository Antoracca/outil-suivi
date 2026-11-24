# Réponse au cahier des charges « Refonte de l'interface et du modèle de suivi-évaluation »

Source : `../docs/excel/Specifications_Techniques_Refonte_Interface.docx`, reçu d'APSUD le 2026-11-24.
Ce document répond point par point au cahier des charges et fixe l'ordre des corrections. Chaque étape est validée avant la suivante.

## 1. Ce que nous avons compris

Le cahier des charges ne change pas le fond du projet : il réorganise l'écran d'un volet autour de quatre portes d'entrée, une par type de donnée. Il ajoute aussi trois éléments : la planification du mois suivant, le budget exécuté saisi par activité et le justificatif joint directement sur la ligne.

Nous avons relu les 5 plans d'action Excel. Ils confirment la structure déjà en base : Outcome → Output → Activité (x.y.z) → tâches, avec un budget planifié et un budget exécuté par activité (colonnes J et K), puis la feuille « Suivi indicateurs » (cadre logique). Les budgets planifiés y valent tous **100**, ce sont des valeurs de remplissage (anomalie A2). Les vrais montants viendront du fichier de référence annoncé au §5 du cahier des charges.

## 2. Écran actuel → écran demandé

| Ordre | Onglet demandé | Ce qui existe aujourd'hui | Ce que nous faisons |
|---|---|---|---|
| 1 | **Synthèse** | Synthèse du volet | Conservée. Elle recevra en plus le **taux d'exécution financière** (étape 4). |
| 2 | **Indicateurs** | Saisie des valeurs dans « Rapports mensuels » + structure dans « Cadre logique » | **Un seul onglet** : saisie des valeurs du mois (Planifié / Actuel / Cumul, désagrégations, justificatif) et gestion du cadre logique. Plus aucune saisie d'indicateur ailleurs. |
| 3 | **Activités** | Partie « Activités et budget » du rapport mensuel | Même tableau (taux d'exécution, résultats obtenus, observations), plus **budget planifié** (lecture seule), **budget exécuté** (champ de saisie) et **taux financier** calculé. La soumission du rapport du mois à APSUD reste ici. |
| 4 | **Activités planifiées** | Absent (le calendrier S1-S5 en tenait lieu) | **Nouvel onglet** : la liste des activités avec une case à cocher par ligne pour le mois suivant (M+1). La validation enregistre le choix ; le mois suivant, l'onglet Activités affiche d'abord les activités prévues, sans rien ressaisir. |

Note sur le §2 : le cahier présente « Indicateurs » comme l'ancien « Plan d'action » et « Activités » comme l'ancien « Rapport mensuel ». Dans notre outil, le « Plan d'action » est le calendrier des tâches (feuille 1 de l'Excel) et les valeurs d'indicateurs se saisissent dans le rapport mensuel. Nous suivons donc l'intention du cahier, un onglet par type de donnée, plutôt que la correspondance mot à mot.

## 3. Réponses point par point

**§3.1 Synthèse.** Conservée telle quelle. Elle agrège déjà les indicateurs et les activités ; le taux financier s'y ajoute.

**§3.2 Indicateurs.**
- Migration des composants : les cartes de saisie actuelles sont reprises sans perte (désagrégation Femmes / Filles / Hommes / Garçons, cumul automatique, case « Justificatif fourni »).
- Centralisation : création, modification et saisie des valeurs se font **uniquement** dans cet onglet. La structure du cadre logique (ajout d'activité, archivage) s'ouvre depuis cet onglet.

**§3.3 Activités.**
- Budget planifié : affiché en lecture seule par activité, alimenté par l'import du fichier de référence.
- Budget exécuté : **un champ numérique par activité et par mois**, en dollars. Le cumul se calcule seul. Ce champ remplace la liste de dépenses libres actuelle, conformément au cahier ; les dépenses déjà saisies restent en base, car on ne supprime jamais une donnée.
- Calcul : taux financier = budget exécuté cumulé ÷ budget planifié, affiché sur la ligne et repris dans la Synthèse.

**§3.4 Activités planifiées (M+1).**
- Source : les activités du volet enregistrées en base.
- Une case à cocher par ligne et un bouton « Valider la planification ». Chaque validation est tracée : qui, quand, quelles activités.
- Effet : dans l'onglet Activités du mois concerné, les activités cochées apparaissent en tête avec la mention « Prévue ». Les autres restent accessibles : une activité non prévue peut avoir avancé.

**§4 Pièces justificatives.** Nous retenons l'**option A, intégrée**, recommandée par le cahier. Sur chaque ligne (activité ou indicateur), une case « Justificatif disponible » fait apparaître le bouton de téléversement. Le fichier est rattaché à cette ligne en base (clé étrangère : type et identifiant de la ligne). La liste de toutes les pièces du mois reste visible en bas de l'onglet Activités pour le contrôle par APSUD.

**§5 Prérequis et livrables.**
- Import initial : nous fournissons un **modèle de fichier** (code du volet, numéro d'activité, montant en USD). APSUD le remplit ; un script l'importe et refuse toute ligne qui ne correspond à aucune activité.
- Base de données : une nouvelle migration ajoute le budget exécuté par activité et par mois, la planification M+1 et le rattachement des pièces à une activité. Chaque règle a son test automatique.
- Ergonomie : aucune donnée ne se saisit à deux endroits. Le mode démonstration est conservé.

## 4. Ordre des corrections

| Étape | Contenu | Base de données |
|---|---|---|
| 1 | Navigation en 4 onglets ; onglet **Indicateurs** (toute la saisie des indicateurs) ; onglet **Activités** (le rapport sans les indicateurs) ; anciens liens redirigés | Non |
| 2 | Onglet **Activités planifiées** (cases à cocher M+1, validation, mention « Prévue » dans Activités) | Oui |
| 3 | **Budget exécuté** par activité, taux financier, justificatif sur la ligne (option A) | Oui |
| 4 | Synthèse : taux financier ; modèle et script d'**import des budgets planifiés** | Oui (import) |

## 5. Questions à APSUD

1. **Calendrier des tâches (S1 à S5).** Le cahier n'en parle pas. Proposition : le garder comme vue détaillée facultative, accessible depuis « Activités planifiées ». Faut-il plutôt le retirer ?
2. **Budget exécuté.** Le montant saisi correspond-il à la dépense **du mois**, avec un cumul calculé (notre proposition), ou au **cumul** depuis le début du projet ?
3. **Fichier des budgets planifiés.** Quand sera-t-il disponible, et en quelle devise (USD par défaut, décision D9) ?
4. **Planification M+1.** Qui valide la sélection : l'ONG seule, ou l'ONG puis APSUD ?
