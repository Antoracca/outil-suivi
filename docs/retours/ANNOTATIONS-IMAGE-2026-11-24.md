# Maquette annotée d'APSUD du 2026-11-24 : lecture et écarts

Source : `../docs/excel/1000058943.jpg`, photo d'une feuille A4 annotée au stylo rouge, envoyée par APSUD.
Méthode : photo lue en entier, puis chaque zone découpée et agrandie (×2 ou ×3) pour la transcription.
Ce document ne modifie aucun fichier de code : il transcrit la feuille, la compare à la lecture du développeur et à l'écran actuel, puis propose les modifications.

Conventions : `[illisible]` = rien de sûr ; `[incertain : …]` = lecture probable, à confirmer. Orthographe et abréviations de la feuille conservées dans les citations.

---

## 1. Transcription zone par zone

La feuille se lit de haut en bas. Le haut est en partie masqué par le pli d'une deuxième feuille posée dessous.

### Zone A : tout en haut, à gauche (en partie masquée)

> « I I O N G . » `[illisible]`

Quelques lettres coupées par le pli de la feuille. Aucune lecture fiable. Elles ne semblent pas liées au reste.

### Zone B : moyens de vérification (haut gauche)

> **Moyens de Verification :**
> • Fiche de depistage **[case cochée ✓]** → telecharger
> • Rapports des relais
> • Rapport d'activités
> ✗ Justificatif fourni en nov = à supp.

Détails :
- Seule la première ligne porte une **case dessinée, cochée** (✓ dans un carré), suivie d'une flèche vers le mot **« telecharger »**.
- Les deux lignes suivantes ont une simple puce, sans case dessinée.
- La 4e ligne commence par une **croix (✗)** au lieu d'une puce : elle désigne un élément à retirer. « à supp. » = à supprimer.
- « en nov » se lit nettement (« en », puis « nov » avec un *v*). Ce n'est pas « oui/non ».
- Une **grande accolade** verticale, à droite, part de la hauteur de « telecharger » et descend jusqu'au trait qui sépare cette zone de la zone C. Elle regroupe les trois moyens et les rattache au bloc chiffré en dessous `[incertain : rattachement au bloc chiffré, ou simple regroupement des trois moyens]`.

### Zone C : bloc « Cibles », relié à « Déc 2026 » (milieu gauche)

> **Cibles** – Planifié 10.000
> – Precedent 1000
> – Actuel 2000
> – Cumul ✱ 3000 ———— **Dèc 202[6]**

- Un trait horizontal part de « 3000 » (ligne Cumul) vers la droite et aboutit à **« Dèc 202? »**.
- Dernier chiffre de l'année : un tracé bouclé, lu `[incertain : 2026]`. Le projet commence en novembre 2026, et l'enchaînement des chiffres (§3.1) confirme que ce bloc suit novembre.
- Un astérisque (✱) entre « Cumul » et « 3000 » `[incertain : sens de l'astérisque, peut-être « valeur calculée »]`.
- « Cibles » est le titre du bloc ; les quatre lignes en dépendent (tirets).

### Zone D : bloc « Nov » (haut droite)

> **Nov**
> Planifié 10.000.
> Precedent : 0
> Actuel : 1000
> ✱Cumul : 1000

Même astérisque devant « Cumul ».

### Zone E : bloc relié à « Janv. » (milieu)

> Planifié : 10.000
> Precedent : 3000
> Actuel : 500
> Cumul : 3.500 ———— **Janv.**

- Le trait part de « 3.500 » et aboutit à **« Janv. »** (et non « Déc »). Lecture sûre : majuscule J, puis « anv. ».
- Les milliers sont séparés par un **point** (« 10.000 », « 3.500 ») : c'est la même habitude d'écriture que dans les fichiers Excel (anomalies A7 à A9).

### Zone F : étiquette en biais (bord gauche)

> « [Indi]cateurs » `[incertain : début coupé par le bord de la photo]`

Écrit en diagonale et souligné, entre le bloc C et le bloc E. Il nomme la zone des chiffres.

### Zone G : flèche courbe

Une longue flèche part du soulignement d'**« Indicateurs »** (zone H, 2e ligne), passe sous la navigation, remonte le long du bord gauche et pointe vers le **bloc « Janv. »** (zone E). Elle relie l'onglet Indicateurs au contenu dessiné au-dessus : **ces blocs sont le contenu de l'onglet Indicateurs**.

### Zone H : navigation (bas de la feuille)

Un trait horizontal traverse la feuille juste au-dessus.

**1re ligne (l'existant) :**

> Synthèse · Cadre ~~logiq~~ · Plan ~~d'action~~ · Rapport ~~mensuel~~

- « Synthèse » est souligné, **non barré**.
- « Cadre logiq[ue] », « Plan d'action » et « Rapport mensuel » sont soulignés et **barrés d'un trait oblique** (sur la 2e moitié de chaque mot).

**2e ligne (le demandé), précédée d'une double flèche ⇒ :**

> Synthèse – Indicateurs – Activité – Activité Planif[iée]
>                                    ✗ / OK           Mois proch[ain]

- 1er mot : « Synthèse », réécrit **par-dessus un autre mot** `[incertain : mot d'origine illisible ; lecture finale « Synthèse »]`. Souligné.
- « Indicateurs » : souligné ; c'est le point de départ de la flèche courbe (zone G).
- « Activité » : souligné. Dessous, une petite croix au-dessus de **« OK »** `[incertain : « OK » = déjà conforme ? la croix est peut-être une rature]`.
- « Activité Planif… » : le mot est coupé par le bord droit de la photo. Dessous : **« Mois proch… »** `[incertain : « Mois prochain », coupé par le bord]`. Souligné.

---

## 2. Lecture du développeur → ce que je lis

| # | Lecture du développeur | Ce que je lis | Verdict |
|---|---|---|---|
| 1 | En bas, une navigation « Synthèse » qui remplace les anciens onglets | « Synthèse » figure **sur les deux lignes** : elle n'est pas barrée et elle est conservée. Ce sont **Cadre logique, Plan d'action et Rapport mensuel** qui sont barrés et remplacés | Corrigé (nuance : Synthèse ne remplace rien, elle reste) |
| 2 | Anciens onglets barrés, remplacés par Indicateurs, Activités, Activités planifiées | Oui. Nouvelle ligne : **Synthèse – Indicateurs – Activité – Activité Planif[iée]**, avec « Mois proch[ain] » sous le dernier onglet | Confirmé (+ précision « mois prochain ») |
| 3 | Lignes Planifié / Précédent / Actuel / Cumul par indicateur | Oui, sous le titre **« Cibles »** | Confirmé |
| 4 | Décembre 2026, 1er exemple : 10 000 / 3 000 / 500 / 3 500 | Ces chiffres sont reliés à **« Janv. »**, pas à décembre | **Corrigé : c'est janvier (2027)** |
| 5 | Décembre 2026, 2e exemple : cible planifiée 10 000 / 1 000 / 2 000 / 3 000 | Oui, c'est le bloc « Cibles », relié à « Dèc 202[6] » | Confirmé (dernier chiffre de l'année un peu incertain) |
| 6 | Novembre 2026 : 10 000 / 0 / 1 000 / 1 000 | Oui (« Nov », sans année écrite) | Confirmé |
| 7 | « Fiche de dépistage » à télécharger | Oui : case cochée → « telecharger ». Le mot écrit est bien **« télécharger »** | Confirmé |
| 8 | Une case à cocher puis téléversement | Une case cochée n'est dessinée **que** devant « Fiche de dépistage ». Le sens « téléverser » est probable (le mot « télécharger » s'emploie couramment pour l'envoi d'un fichier), mais ce n'est pas écrit. L'accolade suggère que la règle vaut pour les trois moyens | Incertain (sens probable, à confirmer) |
| 9 | « Rapport des relais » | « Rapport**s** des relais » | Confirmé |
| 10 | « Rapport d'activité » | « Rapport d'activités » | Confirmé |
| 11 | « Justificatif fourni » en novembre serait à supprimer | La ligne dit « ✗ Justificatif fourni en nov = à supp. ». « En nov » reprend **le libellé affiché à l'écran** (« Justificatif fourni en novembre : Oui/Non », dans la structure du cadre logique) : APSUD demande de supprimer **cet élément**, pas seulement pour novembre | Confirmé, sens précisé |
| — | (non relevé) | L'étiquette en biais « [Indi]cateurs » et la flèche courbe rattachent tous les blocs chiffrés et les moyens de vérification à l'**onglet Indicateurs** | Ajout |
| — | (non relevé) | Les trois moyens de vérification de la feuille sont **mot pour mot** ceux de l'indicateur « Nombre total d'enfants dépistés » du volet **NUT-ARS** (fichier Excel : « Fiches de dépistage », « rapports des relais », « rapport d'activité »). Dans le fichier, sa cible est **7 525**, pas 10 000 : les chiffres de la feuille sont un **exemple** | Ajout |

---

## 3. Interprétation métier

### 3.1 Les quatre lignes et la cohérence des chiffres

| Ligne | Sens | Origine dans l'outil |
|---|---|---|
| **Planifié** | Cible totale de l'indicateur sur le projet. Elle reste à 10 000 chaque mois : ce n'est **pas** une prévision mensuelle | `ind.cible` (déjà affiché, libellé « Cible ») |
| **Précédent** | Cumul jusqu'à la fin du mois précédent | `cumul(etat, ind, mois, false)`, déjà calculé (`precedent`) mais **non affiché en chiffres** (seulement dans la jauge) |
| **Actuel** | Réalisé du mois, la seule ligne saisie | la case de saisie (libellé « Ce mois ») |
| **Cumul** | Précédent + Actuel | `cumul(etat, ind, mois, true)` (déjà affiché) |

Vérification des trois blocs, rangés par mois :

| Mois | Précédent | Actuel | Cumul écrit | Précédent + Actuel | Précédent = cumul du mois d'avant ? |
|---|---|---|---|---|---|
| Nov. 2026 | 0 | 1 000 | 1 000 | 1 000 ✓ | 0 (1er mois du projet) ✓ |
| Déc. 2026 | 1 000 | 2 000 | 3 000 | 3 000 ✓ | 1 000 = cumul de novembre ✓ |
| Janv. 2027 | 3 000 | 500 | 3 500 | 3 500 ✓ | 3 000 = cumul de décembre ✓ |

Les trois blocs forment **une seule suite de trois mois** pour le même indicateur. C'est ce qui confirme que le 2e exemple est janvier et non un second décembre : un « Précédent » de 3 000 en décembre serait incompatible avec un cumul de 1 000 en novembre.

Cette règle n'est vraie que pour les indicateurs **en somme** (`mode_cumul = 'somme'`). Pour les pourcentages (`derniere_valeur`, par exemple « Taux de guérison »), « Précédent + Actuel » n'a pas de sens : il faut afficher « Précédent » = dernière valeur connue avant le mois et « Cumul » = dernière valeur connue (question 4, §5).

Ces libellés reprennent ceux des fichiers Excel (« Planifié / Actuel / Cumul », INSTRUCTIONS §3). APSUD y **ajoute une seule ligne, « Précédent »**.

### 3.2 Supprimer « Justificatif fourni »

Aujourd'hui, la colonne « Oui/Non » des fichiers Excel est rendue par un indicateur calculé (décision D11, proposition non confirmée par APSUD) :
- carte de saisie (onglet Indicateurs) : « Justificatif fourni : Oui (n) / Non » ;
- structure du cadre logique : « Justificatif fourni en novembre : Oui (n) / Non » (d'où le « en nov » de la feuille) ;
- export du suivi des indicateurs : colonne « Justificatif fourni (Oui/Non) ».

APSUD ne veut plus de ce **résumé global par indicateur**. Le constat « justifié ou non » se lira désormais **moyen par moyen** (§3.3). Cela répond aussi à la question D11 : la colonne « Oui/Non » de l'Excel devient, dans l'outil, l'état de chaque moyen de vérification.

À ne pas confondre : il ne s'agit pas de supprimer des pièces jointes déjà déposées. Elles restent en base (règle 4 : on ne supprime jamais une donnée métier) ; seul l'affichage « Justificatif fourni » disparaît.

### 3.3 Moyens de vérification : une case et un téléversement par ligne

Aujourd'hui, les moyens de vérification sont une ligne de texte en bas de la carte (« Moyens de vérification : A · B · C »), et un seul bouton « Joindre un justificatif » renvoie au panneau des pièces en bas de page.

Ce que demande la feuille, lu au plus près :
- chaque moyen de vérification devient **une ligne** de la carte de l'indicateur ;
- chaque ligne porte une **case à cocher** ; cochée, elle fait apparaître l'envoi du fichier (« télécharger », au sens probable de téléverser) ;
- la pièce envoyée est rattachée à **cet indicateur, ce mois et ce moyen**.

La base le permet déjà : une pièce a un rattachement (`type: 'indicateur'`, `id`) et un champ `moyen_verification` (colonne présente dans la migration `…090002_cadre_et_saisies.sql` et dans la fonction d'écriture). Le panneau des pièces propose déjà de choisir le moyen. Seule l'interface change.

Points à trancher avec APSUD (§5) : la case vaut-elle déclaration sans fichier ? la règle vaut-elle pour les trois moyens ou seulement pour la fiche de dépistage ?

### 3.4 Navigation

La 2e ligne de la feuille correspond **exactement** à la navigation déjà en place depuis les étapes 1 et 2 de la refonte : **Synthèse · Indicateurs · Activités · Activités planifiées**, ce dernier onglet ouvrant le mois suivant (M+1), ce que dit « Mois prochain ». La 1re ligne barrée décrit l'ancienne navigation. Rien à changer, sauf éventuellement un rappel visible « mois prochain » (§4, P3).

---

## 4. Écarts avec l'écran actuel et modifications proposées

Écran de référence : `src/routes/(app)/volets/[code]/indicateurs/[mois]/` (`+page.svelte`, `CarteIndicateur.svelte`, `CarteIndicateur.css`).

### Synthèse des écarts

| Élément | Écran actuel | Feuille d'APSUD | Écart |
|---|---|---|---|
| Navigation | Synthèse · Indicateurs · Activités · Activités planifiées (`+layout.svelte`) | Identique | Aucun |
| Lignes de la carte (désagrégée) | Cible / Ce mois / Cumul | Planifié / Précédent / Actuel / Cumul | Ligne **Précédent** absente ; libellés différents |
| Chiffres de la carte (non désagrégée) | Cible / Réalisé ce mois / Cumul | Idem | Même écart |
| « Justificatif fourni » | Affiché dans la carte de saisie, dans la structure du cadre logique et dans l'export | À supprimer | À retirer |
| Moyens de vérification | Texte en bas de carte, un seul bouton « Joindre un justificatif » | Une ligne par moyen, case à cocher, envoi du fichier | À refaire |

### P1 : libellés et ligne « Précédent » (sans base de données, petit)

1. **`indicateurs/[mois]/CarteIndicateur.svelte`**
   - Tableau désagrégé : « Cible » → **« Planifié »** ; ajouter la ligne **« Précédent »** (valeurs de `precedent`, déjà calculé l. 38) entre Planifié et la saisie ; « Ce mois » → **« Actuel »**. Mettre à jour la légende cachée du tableau et les `aria-label` des cases (« réalisé ce mois » → « actuel, réalisé du mois »).
   - Bloc simple (`c-carte-ind__chiffres`) : quatre entrées Planifié / Précédent / Actuel / Cumul. Pour les pourcentages : « Précédent » = dernière valeur avant le mois, « Cumul » garde le libellé « Dernière valeur » en attendant la réponse d'APSUD.
2. **`indicateurs/[mois]/CarteIndicateur.css`**
   - Nouvelle classe de ligne `c-carte-ind__ligne--precedent` (même traitement que Planifié : lecture seule, atténuée).
   - `c-carte-ind__chiffres` : `repeat(3, …)` → 4 colonnes en ordinateur ; revoir la requête de conteneur `@container (max-width: 34rem)` (2 × 2 sur téléphone) et la mise en fiche des lignes du tableau sur petit écran. Vérifier aux 8 largeurs.
3. **`cadre-logique/CarteIndicateur.svelte`** : le libellé « Cumul avant <mois> » devient « Précédent », pour employer les mêmes mots partout.
4. Facultatif : **`exports/csv.ts`** (`exporterIndicateurs`) : ajouter une colonne « Précédent (cumul du mois d'avant) » et renommer « Réalisé total » en « Actuel total ».

### P1 : retirer « Justificatif fourni » (sans base de données, petit)

5. **`indicateurs/[mois]/CarteIndicateur.svelte`** : retirer le paragraphe `c-carte-ind__ouinon` (l. 211-215) et `nbJustificatifs` s'il ne sert plus. Le bouton d'envoi est remplacé par le bloc P2 (point 7).
6. **`cadre-logique/CarteIndicateur.svelte`** : retirer « Justificatif fourni en <mois> » (l. 78-82) ; afficher à la place, sous chaque moyen de vérification, l'état du mois (case ou nombre de pièces), en lecture seule.
   - CSS associées : `c-carte-ind__ouinon` (`indicateurs/[mois]/CarteIndicateur.css`), `p-cadre-logique__ouinon` (`cadre-logique/CarteIndicateur.css`).
   - **`src/lib/composants/donnees/PanneauJustificatifs.svelte`** : texte d'aide « La case « Justificatif fourni » de l'indicateur passe à Oui » (l. 118) et commentaire l. 15 à réécrire.
   - **`exports/csv.ts`** : la colonne « Justificatif fourni (Oui/Non) » reprend la colonne Oui/Non de l'Excel. **Ne pas la retirer sans l'accord d'APSUD** (question 5) ; proposition : une colonne par moyen de vérification (« Fiches de dépistage : Oui/Non »…).
   - `src/lib/donnees/calculs.ts` : `justificatifsIndicateur` reste utile à l'export tant que la question 5 n'est pas tranchée.

### P2 : moyens de vérification à cocher, envoi par ligne (interface seule si la case ne vaut pas déclaration)

7. **Nouveau composant** dans `indicateurs/[mois]/` (par exemple `MoyensVerification.svelte` + `MoyensVerification.css`, conformément à « un fichier par chose ») :
   - titre « Moyens de vérification », une ligne par élément de `ind.moyens_verification` (première lettre en majuscule à l'affichage, texte d'origine conservé) ;
   - case à cocher par ligne ; cochée, elle montre un champ fichier et le bouton « Envoyer » ; les pièces déjà déposées pour ce moyen et ce mois sont listées sous la ligne ;
   - envoi par `depot.ajouterJustificatif(code, mois, { type: 'indicateur', id: ind.id }, fichier, moyen, fichier)`, qui gère déjà le champ `moyen_verification` dans les deux sources (démonstration et serveur réel) ;
   - si l'indicateur n'a aucun moyen dans le fichier (cas fréquent, anomalie A11 voisine), garder un envoi « Autre justificatif ».
8. **`src/lib/donnees/calculs.ts`** : nouvelle fonction pure, par exemple `justificatifsMoyen(etat, indicateurId, mois, moyen)`. Comparer les libellés sans tenir compte de la casse.
9. **`indicateurs/[mois]/+page.svelte`** : `preparerJustificatif` et le défilement vers le panneau du bas ne servent plus depuis la carte ; garder `PanneauJustificatifs` en bas comme **liste de contrôle** des pièces du mois.
10. **Si APSUD veut qu'une case cochée sans fichier vaille déclaration** (question 3) : il faut stocker cet état, donc une **migration** (table ou colonne « moyen déclaré » par indicateur, mois et moyen, jamais supprimée, auditée), une **fonction d'écriture SQL**, la même règle dans `regles.ts` et le dépôt, et son **test** dans `supabase/tests/`. Sans cette exigence, la case se déduit de la présence d'une pièce et aucune base n'est touchée.

### P3 : documents et détails

11. **`docs/REPONSE-CAHIER-DES-CHARGES.md`** : §3.2 (« case « Justificatif fourni » » conservée) et §4 (« une case « Justificatif disponible » par ligne d'indicateur ») sont dépassés par la feuille : la case porte sur **chaque moyen de vérification**, pas sur l'indicateur.
12. **`INSTRUCTIONS.md`** : D11 à mettre à jour (sens de la colonne Oui/Non tranché par la feuille, sous réserve des questions 3 et 5) ; Journal et carte des fichiers (`docs/retours/`) après validation.
13. Facultatif, **`volets/[code]/+layout.svelte`** : la feuille écrit « Mois prochain » sous « Activités planifiées ». L'onglet ouvre déjà M+1 ; on peut ajouter le nom du mois visé dans l'onglet ou dans une info-bulle, si APSUD le souhaite.

Rien à faire sur la navigation elle-même : elle est déjà conforme.

---

## 5. Questions à poser à APSUD

1. **Année du bloc « Déc »** : la feuille porte « Déc 202? » ; nous lisons 2026. Confirmez-vous ? (Le bloc suivant est janvier 2027.)
2. **« Télécharger »** à côté de « Fiche de dépistage » : s'agit-il bien d'**envoyer** la fiche remplie (téléverser), et non de récupérer un modèle vierge ? La case et l'envoi valent-ils pour **les trois moyens** de vérification ?
3. **Case cochée sans fichier** : peut-on cocher un moyen (« la pièce existe, elle est au bureau ») sans envoyer de fichier, ou la case ne sert-elle qu'à ouvrir l'envoi ?
4. **Indicateurs en pourcentage** (« Taux de guérison ») : quelles valeurs afficher dans « Précédent » et « Cumul » ?
5. **Export du suivi des indicateurs** : faut-il garder la colonne Oui/Non de l'Excel, la remplacer par une colonne par moyen de vérification, ou la retirer ?
6. Les chiffres de la feuille (cible 10 000) sont-ils un exemple ? Dans le fichier NUT-ARS, la cible de « Nombre total d'enfants dépistés » est 7 525.
