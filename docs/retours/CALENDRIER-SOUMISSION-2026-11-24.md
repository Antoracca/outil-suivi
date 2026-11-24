# Calendrier de soumission des rapports : analyse du PDF d'APSUD et écarts avec l'outil

Source : `../docs/excel/Consortium APSUD -   Date de soumission des rappor_261124_122112.pdf` (1 page), reçu d'APSUD le 2026-11-24.
Rédigé le 2026-11-24. Aucun fichier de code n'a été modifié : ce document propose, il ne fait rien.

> **Urgence.** La première échéance du PDF tombe le **mercredi 2 décembre 2026**, dans 8 jours. L'outil affiche aujourd'hui le **5 décembre**. Si rien ne change d'ici là, les partenaires croiront avoir trois jours de plus qu'en réalité.

---

## 1. Ce que dit le PDF (restitution fidèle)

Titre : « Consortium APSUD – Date de soumission des rapports des partenaires ».
Un seul tableau de 4 colonnes et 10 lignes. Aucun autre texte, aucune consigne, aucune signature, aucune date d'émission.

| N° | Type de rapport (texte exact) | Date limite de soumission **AFPE à APSUD** | Date limite de soumission **APSUD au FH** |
|---|---|---|---|
| 1 | Rapport narratif intermédiaire 1 | 02 décembre 2026 | 07 décembre 2026 |
| 2 | Rapport trimestriel 1 | 02 janvier 2027 | 14 janvier 2027 |
| 3 | Rapport narratif intermédiaire 2 | 02 février 2027 | 07 février 2027 |
| 4 | Rapport narratif intermédiaire 3 | 02 mars 2027 | 07 mars 2027 |
| 5 | Rapport trimestriel 2 | 09 avril 2027 | 14 avril 2027 |
| 6 | Rapport narratif intermédiaire 4 | 02 mai 2027 | 07 mai 2027 |
| 7 | Rapport narratif intermédiaire 5 | 02 juin 2027 | 07 juin 2027 |
| 8 | Rapport trimestriel 3 | 09 juillet 2027 | 14 juillet 2027 |
| 9 | Rapport narratif intermédiaire 6 | 02 août 2027 | 07 août 2027 |
| 10 | Rapport narratif final. | 30 septembre 2027 | 30 septembre 2027 |

### 1.1 Ce qu'on peut en déduire (déductions, pas écrites dans le PDF)

Le projet dure 10 mois (08/11/2026 → 30/08/2027) et le PDF compte **10 rapports**, chacun dû au début du mois qui suit un mois du projet. Le PDF ne nomme pas les mois couverts, mais la correspondance est régulière :

| Mois du projet | Rapport attendu (déduit) | Partenaire → APSUD | APSUD → FH | Délai laissé à APSUD | Jour de la semaine (ONG / FH) |
|---|---|---|---|---|---|
| Mois 1 · novembre 2026 | Narratif intermédiaire 1 | 02/12/2026 | 07/12/2026 | 5 jours | mercredi / lundi |
| Mois 2 · décembre 2026 | **Trimestriel 1** (nov.-déc. ?) | 02/01/2027 | 14/01/2027 | **12 jours** | **samedi** / jeudi |
| Mois 3 · janvier 2027 | Narratif intermédiaire 2 | 02/02/2027 | 07/02/2027 | 5 jours | mardi / **dimanche** |
| Mois 4 · février 2027 | Narratif intermédiaire 3 | 02/03/2027 | 07/03/2027 | 5 jours | mardi / **dimanche** |
| Mois 5 · mars 2027 | **Trimestriel 2** (janv.-mars) | **09**/04/2027 | 14/04/2027 | 5 jours | vendredi / mercredi |
| Mois 6 · avril 2027 | Narratif intermédiaire 4 | 02/05/2027 | 07/05/2027 | 5 jours | **dimanche** / vendredi |
| Mois 7 · mai 2027 | Narratif intermédiaire 5 | 02/06/2027 | 07/06/2027 | 5 jours | mercredi / lundi |
| Mois 8 · juin 2027 | **Trimestriel 3** (avr.-juin) | **09**/07/2027 | 14/07/2027 | 5 jours | vendredi / mercredi |
| Mois 9 · juillet 2027 | Narratif intermédiaire 6 | 02/08/2027 | 07/08/2027 | 5 jours | lundi / **samedi** |
| Mois 10 · août 2027 | **Narratif final** (tout le projet ?) | **30/09/2027** | 30/09/2027 | **0 jour** | jeudi / jeudi |

Règles qui en découlent :

1. **Un rapport par mois et par partenaire**, comme dans l'outil, mais son **type change** : 6 narratifs intermédiaires, 3 trimestriels (fin décembre, fin mars, fin juin, soit des trimestres civils), 1 final. Les mois de trimestre n'ont pas de narratif intermédiaire : le trimestriel en tient lieu.
2. **Échéance partenaire → APSUD** : le **2** du mois suivant pour les narratifs intermédiaires et le trimestriel 1 ; le **9** pour les trimestriels 2 et 3 ; le **30 septembre 2027** (un mois après la fin du projet) pour le final.
3. **Échéance APSUD → FH** : le **7** du mois suivant pour les narratifs, le **14** pour les trimestriels, le 30/09/2027 pour le final.
4. **Circuit implicite** : partenaire → APSUD (contrôle, consolidation) → FH. Le temps de validation d'APSUD est donc borné : 5 jours en règle générale.

### 1.2 Ce qui est ambigu (à faire confirmer par APSUD)

| # | Ambiguïté | Pourquoi c'est important pour l'outil |
|---|---|---|
| Q1 | La colonne dit « soumission **AFPE** à APSUD », le titre dit « rapports **des partenaires** ». Ce calendrier vaut-il pour **les quatre partenaires** (ARS pour ses deux volets, AFPE, GADY, IDC), ou a-t-il été fait pour AFPE seule ? | L'outil a une échéance par mois, commune aux 5 volets. Si chaque ONG a ses propres dates, il faut une échéance par volet. |
| Q2 | Le trimestriel 1 est dû par le partenaire le **2 janvier** (un samedi, lendemain du jour de l'an), alors que les trimestriels 2 et 3 sont dus le **9**, et que le FH attend le 14 dans les trois cas. **Faute de frappe pour le 9 janvier ?** | Change l'échéance et le calcul du retard de la période de décembre. |
| Q3 | Le rapport final a la **même date** pour les deux colonnes (30/09/2027) : APSUD n'a aucun jour pour contrôler et consolider. Faut-il une date interne plus tôt pour les partenaires (par exemple le 23 ou le 25 septembre) ? | Sans date interne, l'outil affichera « à temps » un rapport remis le 30 au soir, trop tard pour APSUD. |
| Q4 | Le PDF ne dit pas **quels mois couvre chaque rapport**. Le trimestriel 1 couvre-t-il novembre et décembre (le projet commence le 8 novembre), ou seulement décembre ? Le final couvre-t-il tout le projet, ou août plus une synthèse ? | Détermine les cumuls à afficher dans le trimestriel et le final. |
| Q5 | Cinq dates tombent un **samedi ou un dimanche** (02/01, 07/02, 07/03, 02/05, 07/08). L'échéance glisse-t-elle au lundi suivant, au vendredi précédent, ou reste-t-elle telle quelle ? | Par fidélité, l'outil reprendra les dates telles quelles tant qu'APSUD ne dit rien. |
| Q6 | « Date limite » : jusqu'à quelle heure ? Proposition : fin de journée à Bangui (23 h 59, heure d'Afrique de l'Ouest, UTC+1). | Le calcul du retard en dépend. |
| Q7 | Que contient un **rapport narratif** ? Un texte (réalisations, difficultés, mesures correctives, perspectives) en plus des indicateurs et des activités ? Le **trimestriel** comprend-il une partie financière ? | L'outil ne recueille aujourd'hui aucun texte de synthèse au niveau du rapport (voir écart E8). |
| Q8 | Les mois de trimestre, les partenaires saisissent-ils toujours les valeurs mensuelles des indicateurs, le trimestriel s'y ajoutant ? (Notre hypothèse : oui.) | Conditionne la saisie de décembre, mars et juin. |
| Q9 | Le PDF ne parle pas des **rapports financiers**. Suivent-ils le même calendrier ? | Le budget exécuté par activité (étape 3 du cahier des charges) pourrait être rattaché aux trimestriels. |

---

## 2. Ce que dit APSUD → ce que fait l'outil → écart

Références : `INSTRUCTIONS.md` §8 (D4, D5) ; `supabase/migrations/20261122090007_donnees_reference.sql` ; `src/lib/donnees/calculs.ts` ; `src/lib/donnees/demo/graine.ts` ; `docs/REPONSE-CAHIER-DES-CHARGES.md`.

| # | Ce que dit APSUD (PDF) | Ce que fait l'outil aujourd'hui | Écart |
|---|---|---|---|
| E1 | Échéance partenaire → APSUD : le **2** du mois suivant (narratifs, trimestriel 1), le **9** (trimestriels 2 et 3), le **30/09/2027** (final) | **Le 5 du mois suivant** pour les 10 mois. Décision D4 (« échéance le 5 du mois suivant », à valider). En base : `periodes.echeance = mois + 1 mois + 4 jours` (migration 0007, ligne 32-35). Dans l'interface : `echeance(mois)` renvoie `new Date(a, m, 5, 23, 59)` (`calculs.ts`, ligne 106-109) | **Toutes les dates sont fausses.** Narratifs et trimestriel 1 : l'outil laisse **3 jours de trop** (8 périodes). Trimestriels 2 et 3 : l'outil annonce un retard **4 jours trop tôt**. Final : l'outil attend le rapport le **5 septembre** au lieu du **30 septembre** (25 jours trop tôt) |
| E2 | (même règle) | L'interface **n'utilise pas** la colonne `periodes.echeance` de la base : `correspondance.ts` (ligne 309) ne garde que la liste des mois, et `echeance()` recalcule le 5 en dur | Corriger la seule migration ne suffit pas : **base et interface** doivent lire la même échéance |
| E3 | Échéance **APSUD → FH** (7, 14, 30/09) | N'existe nulle part : ni colonne, ni calcul, ni affichage | La coordination ne voit pas de combien de jours elle dispose pour valider et consolider |
| E4 | **Type** de rapport : narratif intermédiaire 1 à 6, trimestriel 1 à 3, narratif final | Un seul type, « rapport mensuel » (« Rapports de décembre attendus le 5 janvier ») | Libellés, numéros et types absents |
| E5 | Qui soumet : « AFPE » (Q1) ; à qui : APSUD, puis APSUD au FH | Chaque volet (NUT-ARS, SAN-ARS, PE-AFPE, SECAL-GADY, WASH-IDC, et toute ONG ajoutée) soumet à la coordination APSUD | Conforme si le calendrier vaut pour tous (Q1). Sinon, il faudra des échéances par volet |
| E6 | Circuit : partenaire → APSUD → FH, avec **5 jours** de validation (12 pour le T1, 0 pour le final) | D5 : la coordination valide ou renvoie (`changer_statut_rapport`, migration 0004 : `soumis → valide / a_corriger`, puis `verrouille`). Aucun lien entre la validation et une date | Le circuit est le bon (D5 confirmé dans son principe). Il manque : la date butoir de validation, l'alerte « à valider avant le … », et la trace de la transmission au FH (qui se fait dans OneGMS, hors de l'outil) |
| E7 | Rapport final dû le 30/09/2027, **après** la fin du projet (30/08/2027) | `moisCourant()` bloque sur août après la fin du projet, puis `moisARapporter()` renvoie le **mois précédent**, soit **juillet** | **Défaut** : en septembre 2027, l'outil réclamera le rapport de juillet au lieu du final (août) |
| E8 | Rapports **narratifs** (texte implicite, Q7) ; trimestriels et final = synthèses | L'outil recueille des valeurs d'indicateurs, le taux d'exécution, les « Résultats obtenus » et « Observations » **par activité**. Aucun texte de synthèse au niveau du rapport, aucune vue trimestrielle ou finale | Contenu narratif et synthèses trimestrielle et finale absents (à préciser avec APSUD avant de coder) |
| E9 | Dates telles qu'écrites, même le week-end (Q5) | Sans objet aujourd'hui (le 5 est fixe) | À décider ; par défaut, reprendre les dates telles quelles |
| E10 | (calendrier) | Textes en dur « le 5 du mois suivant » : `validation/+page.svelte` (lignes 249 et 374), `administration/+page.svelte` (ligne 458), commentaire de `moisARapporter` (`calculs.ts`, ligne 99) ; commentaire de la table `periodes` (« échéance du rapport mensuel (D4) », migration 0001) | Textes à reprendre |
| E11 | (calendrier) | Démonstration (`graine.ts`, « aujourd'hui » = 12/01/2027) : soumissions datées du **3 au 6** du mois suivant (ligne 291), décisions du **7 au 9** (ligne 295) | Avec le nouveau calendrier, **toutes** les soumissions de novembre deviennent en retard (échéance le 2/12), et les décisions de novembre tombent après l'échéance FH (7/12). La démonstration montrerait un consortium constamment en retard |
| E12 | (calendrier) | `docs/REPONSE-CAHIER-DES-CHARGES.md` ne parle pas du calendrier ; `docs/ARCHITECTURE.md` prévoit des notifications « échéance à J-2 et dépassée » (ligne 215), non réalisées | Le calendrier est une demande nouvelle, à ajouter à l'ordre des corrections. Les rappels J-2 deviennent utiles maintenant que les délais sont serrés |
| E13 | Aucune règle de blocage après l'échéance | L'outil ne bloque pas une soumission tardive (il affiche « N jours de retard ») | Conforme. On garde : un rapport en retard reste meilleur qu'un rapport absent. Proposition : garder la trace « soumis avec N jours de retard » |

### 2.1 Effet chiffré sur les 10 périodes

| Période | Outil (le 5) | PDF (partenaire → APSUD) | Écart |
|---|---|---|---|
| 2026-11 | 05/12/2026 | 02/12/2026 | outil 3 jours trop tard |
| 2026-12 | 05/01/2027 | 02/01/2027 (Q2) | outil 3 jours trop tard |
| 2027-01 | 05/02/2027 | 02/02/2027 | outil 3 jours trop tard |
| 2027-02 | 05/03/2027 | 02/03/2027 | outil 3 jours trop tard |
| 2027-03 | 05/04/2027 | 09/04/2027 | outil 4 jours trop tôt |
| 2027-04 | 05/05/2027 | 02/05/2027 | outil 3 jours trop tard |
| 2027-05 | 05/06/2027 | 02/06/2027 | outil 3 jours trop tard |
| 2027-06 | 05/07/2027 | 09/07/2027 | outil 4 jours trop tôt |
| 2027-07 | 05/08/2027 | 02/08/2027 | outil 3 jours trop tard |
| 2027-08 | 05/09/2027 | 30/09/2027 | outil 25 jours trop tôt |

---

## 3. Modifications proposées

Principes rappelés : le schéma n'évolue que par **nouvelle migration** (jamais en réécrivant 0001 à 0010) ; toute règle s'écrit **en SQL et dans le dépôt** ; chaque règle a son **test** dans `supabase/tests/`. État actuel : migrations 0001 à 0009 poussées sur le Supabase en ligne, **0010 pas encore poussée** (INSTRUCTIONS.md §10). La nouvelle migration sera poussée après 0010, avec l'accord du développeur.

### Priorité 1 : avant le 2 décembre 2026 (échéances justes partout)

**3.1 Nouvelle migration `supabase/migrations/20261124090011_calendrier_soumission.sql`** (vérifier avant de créer qu'aucune autre session n'a pris le numéro 0011).

- Ajoute à `periodes` : `type_rapport` (`narratif_intermediaire`, `trimestriel`, `final`), `numero_rapport` (1 à 6, 1 à 3, 1), `libelle_rapport` (texte exact du PDF), `echeance_fh` (date APSUD → FH).
- Met à jour `echeance` (partenaire → APSUD) avec les dates du PDF.
- Contraintes : `type_rapport` et `echeance_fh` non nuls après mise à jour ; `echeance <= echeance_fh`.
- Met à jour le commentaire de la table (« échéance du rapport mensuel (D4) » devient « calendrier de soumission APSUD du 24/11/2026 »).
- Les droits ne changent pas : `periodes` est lue par tout compte actif (`grant select` sur la table, migration 0005), les nouvelles colonnes sont donc lisibles sans autre droit. La mise à jour passe par le déclencheur d'audit existant (`auditer`, migration 0003), ce qui laisse une trace de l'ancienne échéance.

Esquisse :

```sql
-- 0011 · Calendrier de soumission des rapports (PDF d'APSUD du 2026-11-24)
alter table public.periodes
	add column type_rapport text check (type_rapport in ('narratif_intermediaire', 'trimestriel', 'final')),
	add column numero_rapport smallint,
	add column libelle_rapport text,
	add column echeance_fh date;

update public.periodes p set type_rapport = c.t, numero_rapport = c.n, libelle_rapport = c.l, echeance = c.e, echeance_fh = c.f
from (values
	('2026-11', 'narratif_intermediaire', 1, 'Rapport narratif intermédiaire 1', date '2026-12-02', date '2026-12-07'),
	('2026-12', 'trimestriel',            1, 'Rapport trimestriel 1',            date '2027-01-02', date '2027-01-14'),
	('2027-01', 'narratif_intermediaire', 2, 'Rapport narratif intermédiaire 2', date '2027-02-02', date '2027-02-07'),
	('2027-02', 'narratif_intermediaire', 3, 'Rapport narratif intermédiaire 3', date '2027-03-02', date '2027-03-07'),
	('2027-03', 'trimestriel',            2, 'Rapport trimestriel 2',            date '2027-04-09', date '2027-04-14'),
	('2027-04', 'narratif_intermediaire', 4, 'Rapport narratif intermédiaire 4', date '2027-05-02', date '2027-05-07'),
	('2027-05', 'narratif_intermediaire', 5, 'Rapport narratif intermédiaire 5', date '2027-06-02', date '2027-06-07'),
	('2027-06', 'trimestriel',            3, 'Rapport trimestriel 3',            date '2027-07-09', date '2027-07-14'),
	('2027-07', 'narratif_intermediaire', 6, 'Rapport narratif intermédiaire 6', date '2027-08-02', date '2027-08-07'),
	('2027-08', 'final',                  1, 'Rapport narratif final',           date '2027-09-30', date '2027-09-30')
) as c (mois, t, n, l, e, f)
where p.mois = c.mois;

alter table public.periodes
	alter column type_rapport set not null,
	alter column numero_rapport set not null,
	alter column libelle_rapport set not null,
	alter column echeance_fh set not null,
	add constraint periodes_echeances check (echeance <= echeance_fh);
```

Si APSUD corrige une date plus tard (Q2, Q3, Q5), ce sera une **migration suivante** de quelques `update`, avec son test.

**3.2 Test** : ajouter à `supabase/tests/securite.test.mjs` (lancé par `npm run test:db`) :

- « Calendrier APSUD : 10 périodes, échéances et types conformes au PDF » : lit `periodes` en compte de saisie, compare les 10 lignes (mois, type, numéro, `echeance`, `echeance_fh`), vérifie 6 narratifs, 3 trimestriels, 1 final et `echeance <= echeance_fh` partout.
- « Calendrier : aucune ONG ni coordination ne modifie une échéance » : `update public.periodes …` refusé pour les trois rôles (aucun droit d'écriture directe, migration 0005).
- Vérifier que le test « Nouvelle ONG … ses 10 rapports » passe toujours (la fonction `ajouter_volet` lit `periodes`, migration 0008, ligne 145).

**3.3 Types et données** (même calendrier des deux côtés, règle « aux deux endroits ») :

- `src/lib/donnees/types.ts` : nouvelle interface `Periode` (`mois`, `rang`, `type_rapport`, `numero_rapport`, `libelle_rapport`, `echeance`, `echeance_fh`) ; `Projet` reçoit `periodes: Periode[]` (on garde `mois: Mois[]` pour ne rien casser).
- `src/lib/donnees/reel/correspondance.ts` (ligne 309) : remplir `periodes` à partir de la table, en plus de `mois`.
- Nouveau fichier `src/lib/donnees/calendrier.ts` : les 10 lignes du PDF, utilisées par la démonstration (`graine.ts`), mêmes valeurs que la migration. Le contrôle de cohérence peut être ajouté à `supabase/tests/contrat-appels.test.mjs` (comparer `calendrier.ts` et la migration 0011).
- `src/lib/donnees/demo/graine.ts` : `projet.periodes` depuis `calendrier.ts` ; `VERSION_SCHEMA` passe de 9 à **10** (les navigateurs rechargent la démonstration).

**3.4 Calculs** (`src/lib/donnees/calculs.ts`) :

- `echeance(etat, mois)` : lit `periode.echeance`, fin de journée à Bangui (`${echeance}T23:59:59+01:00`), au lieu du 5 en dur et de l'heure du navigateur.
- Nouveau `echeanceFH(etat, mois)` : même chose avec `echeance_fh`.
- `joursRetard(etat, r, maintenant)` : même règle qu'aujourd'hui (statuts `non_commence`, `brouillon`, `a_corriger`), comparée à la nouvelle échéance.
- `moisARapporter(etat, maintenant)` : **le dernier mois du projet entièrement écoulé** (et le premier mois tant qu'aucun n'est terminé). Corrige E7 : en septembre 2027, renvoie août, donc le rapport final.
- Nouveau `libelleRapport(etat, mois)` : « Rapport trimestriel 1 », etc.

Appels à adapter (changement de signature) : `src/lib/composants/donnees/EnTeteRapport.svelte`, `src/lib/composants/structure/BarreBasse.svelte`, `src/lib/donnees/contexte.svelte.ts`, `src/routes/(app)/+page.svelte`, `src/routes/(app)/administration/+page.svelte`, `src/routes/(app)/validation/+page.svelte`, `src/routes/(app)/volets/[code]/+page.svelte`.

**3.5 Textes en dur** : retirer « le 5 du mois suivant » de `validation/+page.svelte` (lignes 249 et 374) et `administration/+page.svelte` (ligne 458), et reprendre le commentaire de `moisARapporter`.

### Priorité 2 : affichage des retards et du circuit (semaine du 30 novembre)

**3.6 Affichage du type et des deux échéances :**

- En-tête du rapport (`EnTeteRapport.svelte`) et tuile du volet (`volets/[code]/+page.svelte`) : « Rapport narratif intermédiaire 1 · novembre 2026 · à remettre à APSUD le mercredi 2 décembre 2026 ».
- Accueil (`(app)/+page.svelte`, ligne 75) : « Rapport trimestriel 1 (décembre 2026) attendu le 2 janvier 2027 » au lieu de « Rapports de décembre attendus le 5 janvier ».
- Administration › Périodes (`administration/+page.svelte`, lignes 457-482) : colonnes « Type de rapport », « Partenaire → APSUD », « APSUD → FH », « Délai de validation » ; la colonne « Situation » se calcule sur la nouvelle échéance.

**3.7 Retards côté coordination** (`validation/+page.svelte`) :

- Rapports soumis : « à valider avant le lundi 7 décembre (échéance FH) », triés par échéance FH, avec mise en avant à J-2 et une fois l'échéance FH passée.
- Nouveau calcul `joursAvantFH(etat, mois, maintenant)` dans `calculs.ts`.
- Historique : « soumis avec N jours de retard » (comparaison `soumis_le` / `echeance`), sans rien bloquer (E13).

**3.8 Démonstration** (`graine.ts`) : soumissions le 1er ou le 2 du mois suivant (une seule volontairement en retard, pour montrer le cas), décisions entre l'échéance partenaire et l'échéance FH (du 3 au 6 pour les narratifs, du 3 au 13 pour le trimestriel 1). Au 12/01/2027 de la démonstration, les rapports de décembre de PE-AFPE (à corriger) et WASH-IDC (brouillon) apparaîtront avec 10 jours de retard, et l'échéance FH du trimestriel 1 à J-2 : un bon cas à montrer.

**3.9 Documents** :

- `INSTRUCTIONS.md` §8 : D4 devient « calendrier APSUD du 24/11/2026 : 10 rapports (6 narratifs intermédiaires, 3 trimestriels, 1 final), dû le 2 (le 9 pour les trimestriels 2 et 3, le 30/09/2027 pour le final), transmis au FH le 7 (le 14, le 30/09) » ; D5 précise le délai de validation. Journal §10 et carte §9 (migration 0011, `calendrier.ts`) à mettre à jour.
- `docs/REPONSE-CAHIER-DES-CHARGES.md` : ajouter le calendrier à l'ordre des corrections (en tête, à cause de l'échéance du 2 décembre) et les questions Q1 à Q9.
- `docs/ARCHITECTURE.md` (ligne 105) : colonnes de `periodes`.

### Priorité 3 : après les réponses d'APSUD (Q3, Q4, Q7, Q8, Q9)

**3.10 Contenu narratif** (si Q7 le confirme) : quelques champs de texte au niveau du rapport (réalisations, difficultés, mesures correctives, perspectives). Nouvelle migration (table `rapports_narratifs`, une ligne par rapport et par version, jamais supprimée, auditée), fonction d'écriture `enregistrer_narratif` avec les mêmes contrôles que la saisie (ONG du volet, rapport ni soumis ni validé), règle miroir dans `regles.ts` et le dépôt, tests dans `securite.test.mjs`.

**3.11 Trimestriels et final** : vue de synthèse sur le trimestre (cumul des indicateurs sur les mois couverts, Q4), puis sur tout le projet pour le final ; export consolidé du consortium prêt à recopier dans OneGMS.

**3.12 Transmission au FH** : trace côté coordination « transmis au FH le … par … » pour chaque période (table `transmissions_fh` par mois, consortium entier ; nouvelle migration, fonction réservée à la coordination, test). Le FH étant servi par OneGMS, c'est une trace, pas un envoi.

**3.13 Rappels** : notifications à J-2 et le jour de l'échéance, pour les ONG (échéance partenaire) et la coordination (échéance FH), comme prévu dans `docs/ARCHITECTURE.md` (ligne 215). Il faudra une tâche planifiée gratuite (GitHub Actions, déjà envisagée pour D2).

**3.14 Date interne du final** (Q3) et **report des échéances du week-end** (Q5) : une migration de quelques `update` si APSUD tranche.

### Ordre conseillé

| Ordre | Contenu | Base de données | Fichiers |
|---|---|---|---|
| 1 | Migration 0011 + tests, puis `db push` (après 0010, avec accord) | Oui | `supabase/migrations/20261124090011_calendrier_soumission.sql`, `supabase/tests/securite.test.mjs` |
| 2 | Types, correspondance, calendrier de démonstration, calculs, textes en dur | Non | `types.ts`, `reel/correspondance.ts`, `calendrier.ts` (nouveau), `demo/graine.ts`, `calculs.ts`, les 7 fichiers qui appellent les calculs |
| 3 | Affichage du type, des deux échéances, des retards de validation | Non | `EnTeteRapport.svelte`, `(app)/+page.svelte`, `administration/+page.svelte`, `validation/+page.svelte`, `volets/[code]/+page.svelte` |
| 4 | Démonstration recalée, documents à jour | Non | `demo/graine.ts`, `INSTRUCTIONS.md`, `REPONSE-CAHIER-DES-CHARGES.md`, `ARCHITECTURE.md` |
| 5 | Contenu narratif, trimestriels et final, transmission FH, rappels | Oui (chacun sa migration et ses tests) | après réponses d'APSUD |

Les étapes 1 et 2 doivent être en ligne **avant le 2 décembre 2026**.

---

## 4. Questions à envoyer à APSUD (récapitulatif)

1. Ce calendrier vaut-il pour les quatre partenaires (ARS, AFPE, GADY, IDC), ou seulement pour AFPE ? (Q1)
2. Trimestriel 1 : le 2 janvier est-il voulu, ou faut-il lire le 9 janvier comme pour les deux autres trimestriels ? (Q2)
3. Rapport final : quelle date limite pour les partenaires, sachant qu'APSUD doit le remettre au FH le même jour, le 30 septembre ? (Q3)
4. Quelle période couvre chaque trimestriel (le T1 couvre-t-il novembre et décembre ?) et le final (tout le projet ?) (Q4)
5. Quand une date tombe un samedi ou un dimanche, est-elle maintenue ? (Q5)
6. Que doit contenir un rapport narratif, un trimestriel, le final ? Un modèle existe-t-il ? (Q7)
7. Les rapports financiers suivent-ils le même calendrier ? (Q9)
