---
version: 2
name: Suivi-consortium-APSUD
description: Plateforme de suivi d'un consortium humanitaire (APSUD, chef de file, et 4 ONG partenaires, Fonds humanitaire RCA). L'interface se présente comme un outil de travail sûr de lui, calme et précis. Toile blanche, encre Forêt (`#0B2A1A`) pour le texte comme pour les titres, un seul bouton d'action fort, en Forêt plein, utilisé avec parcimonie. Le Vert APSUD (`#226E30`) sert aux liens et à l'avancement. Une seule famille, Mona Sans variable (titres 600, texte 400, chasse étroite dans les tableaux). Signature visuelle : la jauge à jalon, où le cumul (Pousse) et l'apport du mois (Vert) avancent vers un piquet de cible (Forêt). Un voile vert très léger, à la manière d'une brume du matin, n'apparaît que derrière le bandeau du consortium sur le tableau de bord.

colors:
  primary: "#0B2A1A"
  primary-active: "#163826"
  link: "#226E30"
  link-hover: "#1B5A28"
  brand-mark: "#2A8238"
  ink: "#0B2A1A"
  body: "#5A655E"
  body-strong: "#0B2A1A"
  muted: "#626D66"
  muted-soft: "#B6BFB9"
  hairline: "#EEF1EE"
  hairline-soft: "#F4F6F4"
  hairline-strong: "#DCE2DD"
  border-control: "#859089"
  canvas: "#FFFFFF"
  canvas-soft: "#F8FAF8"
  surface-card: "#FFFFFF"
  surface-strong: "#EEF1EE"
  surface-row-active: "#F1FAEA"
  surface-dark: "#0B2A1A"
  surface-dark-elevated: "#163826"
  on-primary: "#FFFFFF"
  on-dark: "#FFFFFF"
  on-dark-soft: "#B5C6BA"
  wash-pousse-light: "#F1FAEA"
  wash-pousse-mid: "#E3F7CF"
  jauge-cumul: "#A8E87C"
  jauge-mois: "#226E30"
  jauge-jalon: "#0B2A1A"
  jauge-fond: "#EEF1EE"
  live: "#FCEBC2"
  status-soumis: "#F4B731"
  status-valide: "#226E30"
  status-verrouille: "#0B2A1A"
  status-brouillon: "#5A655E"
  status-non-commence: "#859089"
  semantic-error: "#B42318"
  semantic-error-soft: "#FCE8E6"
  semantic-warning: "#8A5E00"
  semantic-warning-soft: "#FCEBC2"
  semantic-success: "#226E30"
  semantic-success-soft: "#EFF8EC"
  secteur-wash: "#1D6A8A"
  secteur-nut: "#8A6110"
  secteur-san: "#A4432A"
  secteur-pe: "#6A3F8F"
  secteur-secal: "#5E6B17"

typography:
  display-xl:
    fontFamily: "'Mona Sans Variable', system-ui, sans-serif"
    fontSize: 40px
    fontWeight: 600
    fontStretch: 87%
    lineHeight: 1.1
    letterSpacing: -1.2px
  display-lg:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 32px
    fontWeight: 600
    fontStretch: 87%
    lineHeight: 1.15
    letterSpacing: -0.96px
  display-md:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.6px
  display-sm:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 21px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.3px
  figure:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 44px
    fontWeight: 600
    fontStretch: 80%
    lineHeight: 1.0
    letterSpacing: -1.3px
    fontVariantNumeric: tabular-nums
  title-md:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  title-sm:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  body-md:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  table:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 14px
    fontWeight: 430
    fontStretch: 87%
    lineHeight: 1.3
    letterSpacing: 0
    fontVariantNumeric: tabular-nums
  table-head:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 13px
    fontWeight: 560
    fontStretch: 87%
    lineHeight: 1.3
    letterSpacing: 0.1px
  code-cbpf:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 13px
    fontWeight: 500
    fontStretch: 80%
    lineHeight: 1.4
    letterSpacing: 0.2px
    fontVariantNumeric: tabular-nums
  caption:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  badge:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 12px
    fontWeight: 560
    lineHeight: 1.3
    letterSpacing: 0.1px
  button:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  nav-link:
    fontFamily: "'Mona Sans Variable', sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0

rounded:
  none: 0px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px
  goutte: "50% 50% 50% 0"

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  base: 16px
  md: 20px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

components:
  app-shell:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
  side-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.nav-link}"
    width: 248px
    widthCollapsed: 64px
  side-nav-item:
    backgroundColor: transparent
    textColor: "{colors.body}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.sm}"
    padding: 8px 12px
    height: 36px
  side-nav-item-active:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.sm}"
  context-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    height: 56px
  consortium-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-xl}"
    padding: 32px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 18px
    height: 40px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 9px 17px
    height: 40px
  button-tertiary-text:
    backgroundColor: transparent
    textColor: "{colors.link}"
    typography: "{typography.button}"
  button-danger:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.semantic-error}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 40px
  text-input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 10px 14px
    height: 44px
  number-cell:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.table}"
    rounded: "{rounded.xs}"
    padding: 6px 10px
    height: 36px
  data-panel:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 0
  data-table-head:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.body}"
    typography: "{typography.table-head}"
    height: 40px
  data-table-row:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.table}"
    height: 44px
  data-table-row-active:
    backgroundColor: "{colors.surface-row-active}"
    textColor: "{colors.ink}"
  stat-tile:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.lg}"
    padding: 20px
  stat-tile-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.figure}"
    rounded: "{rounded.lg}"
    padding: 20px
  jauge-jalon:
    backgroundColor: "{colors.jauge-fond}"
    rounded: "{rounded.xs}"
    height: 10px
    heightLarge: 16px
  status-marker:
    rounded: "{rounded.goutte}"
    size: 12px
    typography: "{typography.badge}"
  badge-pill:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  sector-tag:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.sm}"
    padding: 3px 8px
  report-matrix-cell:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.sm}"
    size: 40px
  week-cell:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.xs}"
    size: 24px
  week-cell-prevu:
    backgroundColor: "{colors.wash-pousse-mid}"
    rounded: "{rounded.xs}"
  week-cell-realise:
    backgroundColor: "{colors.jauge-mois}"
    rounded: "{rounded.xs}"
  detail-panel:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    width: 400px
  notification-drawer:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    width: 380px
  activity-item:
    backgroundColor: transparent
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
    padding: 12px 0
  offline-banner:
    backgroundColor: "{colors.semantic-warning-soft}"
    textColor: "{colors.semantic-warning}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  tabs:
    backgroundColor: transparent
    textColor: "{colors.body}"
    typography: "{typography.nav-link}"
    height: 40px
  dialog:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  avatar:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    size: 28px
  empty-state:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.body}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 48px
---

# DESIGN — Suivi consortium APSUD

> Version 2 du 2026-11-21, **à valider**. Elle reprend le **format** et l'**esprit** du DESIGN.md d'Expo (référence : [reference/expo-DESIGN.md](reference/expo-DESIGN.md), licence MIT, dépôt VoltAgent/awesome-design-md) : des tokens déclarés en tête, puis des règles d'usage. Elle les transpose à l'identité APSUD et à un outil de saisie de données humanitaires.
> Règle d'or : un composant n'utilise **que** des tokens `{…}`. Une valeur absente se crée d'abord ici, puis dans `src/lib/styles/tokens.css`.

## Vue d'ensemble

La plateforme se présente comme un **outil de travail sûr de lui, calme et précis**. Le ton reste celui d'Expo : des outils de développeur sans esbroufe. Le fond est une **toile blanche** (`{colors.canvas}`) posée sur un très léger gris vert (`{colors.canvas-soft}`, #F8FAF8) qui délimite l'espace de travail. L'**encre Forêt** (`{colors.ink}`, #0B2A1A), le vert profond d'APSUD, porte le texte et les titres.

**Une seule tension forte** : le bouton d'action principal en **Forêt plein** (`{colors.primary}`), utilisé avec parcimonie : « Soumettre à APSUD », « Valider », « Enregistrer ». Le **Vert APSUD** (`{colors.link}`, #226E30) est réservé aux liens et à l'avancement (part « ce mois » de la jauge, statut Validé). Le vert du logo (`{colors.brand-mark}`, #2A8238) n'apparaît que dans le logo.

**Typographie** : **Mona Sans variable**, la police du site APSUD, sert pour tout. Titres en 600 avec un interlettrage légèrement négatif, texte en 400. Dans les tableaux, la **chasse étroite** (87 %) fait tenir Femmes / Filles / Hommes / Garçons / Total sans réduire la taille.

**Signature visuelle** : la **jauge à jalon**. Elle joue ici le rôle que le montage d'appareils joue chez Expo : c'est le produit lui-même qui fait le décor. Partout où l'on compare un réalisé à une cible, le même instrument apparaît : le **cumul** en Pousse, l'**apport du mois** en Vert, un **jalon de cible** en Forêt.

**Caractéristiques clés** :
- Toile blanche ; voile vert très léger (`{colors.wash-pousse-light}` vers `{colors.wash-pousse-mid}`) **uniquement** derrière le bandeau du consortium sur le tableau de bord.
- Un seul bouton plein : Forêt, `{rounded.md}` (8 px), 40 px de haut.
- Vert APSUD pour les liens et l'avancement, jamais pour un bouton plein.
- Une seule famille, Mona Sans ; chiffres tabulaires dans tout ce qui se compare.
- Panneaux de données blancs à `{rounded.lg}` (12 px), filet de 1 px `{colors.hairline-strong}`, sans ombre au repos.
- Statuts en goutte-feuille APSUD + texte, jamais la couleur seule.
- Rythme vertical de 64 px entre les grandes zones ; tableaux denses à l'intérieur.

## Couleurs

### Action et marque
- **Forêt** (`{colors.primary}`, #0B2A1A) : remplissage du bouton principal. Utilisé avec parcimonie : un seul bouton plein par zone d'action.
- **Forêt actif** (`{colors.primary-active}`, #163826) : état pressé.
- **Vert APSUD** (`{colors.link}`, #226E30) : liens dans le texte, boutons texte, part « ce mois » de la jauge, statut Validé.
- **Vert du logo** (`{colors.brand-mark}`, #2A8238) : logo uniquement. Jamais en petit texte (contraste insuffisant sous 19 px gras).

### Surfaces
- **Toile** (`{colors.canvas}`, #FFFFFF) : barre latérale, barre de contexte, panneaux.
- **Toile douce** (`{colors.canvas-soft}`, #F8FAF8) : fond de l'application derrière les panneaux, en-têtes de tableau, états vides.
- **Surface forte** (`{colors.surface-strong}`, #EEF1EE) : élément de navigation actif, badges, fond de jauge.
- **Ligne active** (`{colors.surface-row-active}`, #F1FAEA) : ligne de tableau sélectionnée.
- **Surface sombre** (`{colors.surface-dark}`, #0B2A1A) : **une seule** tuile inversée sur le tableau de bord (« Rapports du mois »), et l'écran de connexion.

### Voile d'atmosphère
- **Pousse clair** (`{colors.wash-pousse-light}`, #F1FAEA) et **Pousse moyen** (`{colors.wash-pousse-mid}`, #E3F7CF) : dégradé radial très doux derrière le bandeau du consortium, **et nulle part ailleurs**. Ce ne sont pas des couleurs d'action.

### Filets
- **Filet** (`{colors.hairline}`, #EEF1EE) : séparateur de lignes de tableau.
- **Filet doux** (`{colors.hairline-soft}`, #F4F6F4) : séparations internes légères.
- **Filet fort** (`{colors.hairline-strong}`, #DCE2DD) : contour des panneaux et des boutons secondaires.
- **Bordure de contrôle** (`{colors.border-control}`, #859089) : contour des champs de saisie et des cases (3:1 minimum, WCAG 1.4.11).

### Texte
- **Encre** (`{colors.ink}`, #0B2A1A) : titres, valeurs, texte important (15:1 sur blanc).
- **Corps** (`{colors.body}`, #5A655E) : texte courant et libellés, un gris légèrement vert (6:1).
- **Atténué** (`{colors.muted}`, #626D66) : métadonnées, aides, horodatages (4,7:1 au minimum, sur tous les fonds clairs).
- **Atténué doux** (`{colors.muted-soft}`, #B6BFB9) : désactivé uniquement, jamais pour une information.
- **Sur action / sur sombre** (`{colors.on-primary}`, `{colors.on-dark}`, #FFFFFF) ; **sur sombre doux** (`{colors.on-dark-soft}`, #B5C6BA).

### Jauge et direct
- **Cumul** (`{colors.jauge-cumul}`, #A8E87C, Pousse), **Ce mois** (`{colors.jauge-mois}`, #226E30), **Jalon** (`{colors.jauge-jalon}`, #0B2A1A), **Fond** (`{colors.jauge-fond}`, #EEF1EE).
- **Direct** (`{colors.live}`, #FCEBC2, Soleil pâle) : trace d'une valeur modifiée à l'instant par quelqu'un d'autre.

### Statuts
`{colors.status-non-commence}` · `{colors.status-brouillon}` · `{colors.status-soumis}` (Soleil #F4B731) · `{colors.status-valide}` · `{colors.status-verrouille}`. Voir **Statuts** plus bas : toujours avec une forme et un texte.

### Sémantique
- **Erreur** (`{colors.semantic-error}`, #B42318) avec son fond (`{colors.semantic-error-soft}`, #FCE8E6).
- **Avertissement** (`{colors.semantic-warning}`, #8A5E00) avec son fond (`{colors.semantic-warning-soft}`).
- **Succès** (`{colors.semantic-success}`, #226E30) avec son fond (`{colors.semantic-success-soft}`).

### Secteurs (fonctionnels)
Ces couleurs identifient un volet. Elles servent pour le pictogramme, la puce d'un `sector-tag` et le filet de 3 px à gauche de l'en-tête d'un volet, **jamais en aplat ni pour un statut**. Elles viennent du terrain :

| Secteur | Token | Hex | Inspiration |
|---|---|---|---|
| WASH | `{colors.secteur-wash}` | #1D6A8A | L'eau de l'Ouham |
| Nutrition | `{colors.secteur-nut}` | #8A6110 | Le mil et l'arachide des rations |
| Santé | `{colors.secteur-san}` | #A4432A | La latérite des pistes vers les formations sanitaires |
| Protection de l'enfance | `{colors.secteur-pe}` | #6A3F8F | Les pagnes des espaces amis des enfants |
| Sécurité alimentaire | `{colors.secteur-secal}` | #5E6B17 | Les feuilles de manioc |

Tous dépassent 5,5:1 sur blanc.

## Typographie

### Famille
**Mona Sans variable** (licence OFL, la même que le site APSUD) sert pour tous les rôles. Elle est auto-hébergée en sous-ensemble latin, avec les axes `wght` (200 à 900) et `wdth` (75 à 125). Police de secours : `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

### Hiérarchie

| Token | Taille | Graisse | Chasse | Interligne | Interlettrage | Usage |
|---|---|---|---|---|---|---|
| `{typography.display-xl}` | 40 px | 600 | 87 % | 1,1 | −1,2 px | Titre du bandeau du consortium |
| `{typography.display-lg}` | 32 px | 600 | 87 % | 1,15 | −0,96 px | Titre de page |
| `{typography.display-md}` | 26 px | 600 | 100 % | 1,2 | −0,6 px | Titre de section |
| `{typography.display-sm}` | 21 px | 600 | 100 % | 1,25 | −0,3 px | Titre de panneau |
| `{typography.figure}` | 44 px | 600 | 80 % | 1,0 | −1,3 px | Chiffre d'une tuile (chiffres tabulaires) |
| `{typography.title-md}` | 18 px | 600 | 100 % | 1,4 | 0 | Nom d'indicateur ouvert, titre de dialogue |
| `{typography.title-sm}` | 16 px | 600 | 100 % | 1,4 | 0 | Libellés de liste |
| `{typography.body-md}` | 16 px | 400 | 100 % | 1,5 | 0 | Texte courant, champs |
| `{typography.body-sm}` | 14 px | 400 | 100 % | 1,5 | 0 | Fil d'activité, aides |
| `{typography.table}` | 14 px | 430 | 87 % | 1,3 | 0 | Cellules (chiffres tabulaires) |
| `{typography.table-head}` | 13 px | 560 | 87 % | 1,3 | 0,1 px | En-têtes de colonnes |
| `{typography.code-cbpf}` | 13 px | 500 | 80 % | 1,4 | 0,2 px | Codes d'indicateurs (`NUT/C-CA5/N.3a`) |
| `{typography.caption}` | 13 px | 400 | 100 % | 1,4 | 0 | Métadonnées, horodatages |
| `{typography.badge}` | 12 px | 560 | 100 % | 1,3 | 0,1 px | Badges, statuts |
| `{typography.button}` | 14 px | 500 | 100 % | 1,0 | 0 | Libellés de boutons |
| `{typography.nav-link}` | 14 px | 500 | 100 % | 1,4 | 0 | Navigation, onglets |

### Principes
- **Les titres restent à 600** : assurés sans être criards.
- **Interlettrage négatif sur les grands titres** (−0,3 à −1,3 px), nul sur le texte.
- **Chiffres tabulaires** (`font-variant-numeric: tabular-nums`) dans les tableaux, tuiles et jauges, alignés à droite.
- **Format français** : 7 525 (espace fine insécable U+202F), 40,5 %, 3 déc. 2026.
- **Casse de phrase** partout, y compris les badges (écart assumé par rapport à Expo, qui met ses badges en capitales : en français, les libellés longs comme « Renvoyé pour correction » deviennent illisibles en capitales).
- **Pas de police à chasse fixe** : les codes CBPF sont en Mona Sans étroite, ce qui garde une seule voix typographique (Expo réserve sa police à chasse fixe au code informatique, qu'on n'affiche pas ici).

## Mise en page

### Espacements
- **Unité de base** : 4 px.
- **Tokens** : `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 · `{spacing.base}` 16 · `{spacing.md}` 20 · `{spacing.lg}` 24 · `{spacing.xl}` 32 · `{spacing.xxl}` 48 · `{spacing.section}` 64.
- **Écart entre panneaux** : 24 px. **Marges de l'espace de travail** : 32 px sur ordinateur, 16 px sur téléphone.

### Grille et cadre

```
┌────────────┬────────────────────────────────────────────────────────────────────┐
│ side-nav   │ context-bar  Volet ▾ · ◂ Décembre 2026 ▸ · En ligne · cloche · AK   │
│ 248 px     ├────────────────────────────────────────────────────┬───────────────┤
│            │ espace de travail (canvas-soft, marges 32 px)       │ detail-panel  │
│ logo APSUD │  ┌ data-panel ───────────────────────────────────┐  │ 400 px        │
│ Consortium │  │ tableau, jauges…                              │  │ (si ouvert)   │
│ FH 41469   │  └───────────────────────────────────────────────┘  │               │
└────────────┴────────────────────────────────────────────────────┴───────────────┘
```

- Largeur utile maximale de l'espace de travail : 1 280 px (au-delà, les panneaux restent centrés et le panneau de détails s'ouvre sans masquer).
- Tuiles du tableau de bord : 4 côte à côte sur ordinateur, 2 sur tablette, 1 sur téléphone, avec `repeat(auto-fit, minmax(…))`.

### Respiration
Généreuse **autour** des panneaux, serrée **dedans** : la toile douce isole chaque bloc, et les tableaux restent denses (lignes de 44 px, 36 px en mode compact) pour voir un volet entier sans faire défiler.

## Élévation et profondeur

| Niveau | Traitement | Usage |
|---|---|---|
| Fond | `{colors.canvas-soft}` | Fond de l'application |
| Panneau | `{colors.surface-card}` + filet 1 px `{colors.hairline-strong}` | Panneaux de données, tuiles |
| Survol | `0 4px 12px rgb(11 42 26 / 0.05)` | Tuile ou ligne cliquable survolée (seul niveau d'ombre au repos) |
| Flottant | `0 12px 32px rgb(11 42 26 / 0.14)` | Panneau de détails, tiroir de notifications, dialogue, menus |
| Inversion | `{colors.surface-dark}` | Une seule tuile du tableau de bord, écran de connexion |
| Voile | Dégradé radial `{colors.wash-pousse-light}` → transparent | Derrière le bandeau du consortium uniquement |

## Formes

| Token | Valeur | Usage |
|---|---|---|
| `{rounded.none}` | 0 | Cellules de tableau à l'intérieur d'un panneau |
| `{rounded.xs}` | 4 px | Cellules de saisie, cases de semaine, jauge |
| `{rounded.sm}` | 6 px | Éléments de navigation, étiquettes de secteur, cases de la matrice |
| `{rounded.md}` | 8 px | Boutons, champs, menus |
| `{rounded.lg}` | 12 px | Panneaux de données, tuiles, états vides |
| `{rounded.xl}` | 16 px | Panneau de détails, tiroir, dialogues |
| `{rounded.pill}` | 9999 px | Badges et avatars uniquement, jamais un bouton |
| `{rounded.goutte}` | 50% 50% 50% 0 | Marqueurs de statut (goutte-feuille APSUD) |

Des rayons compacts, d'outil de travail : 8 px pour les boutons, 12 px pour les panneaux. La pilule est réservée aux badges.

## Statuts

Un statut se lit par **trois éléments** : forme, couleur, texte.

| Statut | Forme (12 px) | Couleur | Texte affiché |
|---|---|---|---|
| Non commencé | Cercle, contour 1,5 px | `{colors.status-non-commence}` | « Non commencé » |
| Brouillon | Goutte, contour 1,5 px | `{colors.status-brouillon}` | « Brouillon » |
| Soumis | Goutte à moitié remplie (bas), contour Forêt | `{colors.status-soumis}` | « Soumis le 3 déc. » |
| À corriger | Goutte, contour 2 px, point central | `{colors.semantic-error}` | « À corriger » |
| Validé | Goutte pleine | `{colors.status-valide}` | « Validé par APSUD » |
| Verrouillé | Goutte pleine + cadenas de 8 px | `{colors.status-verrouille}` | « Verrouillé » |
| En retard | Trait diagonal ajouté au marqueur | `{colors.semantic-error}` | « En retard de 4 jours » |

**États d'une cellule de saisie** (repris de DHIS2) :
- enregistrée : aucun signe ;
- en attente d'envoi : petite horloge et aide « Enregistrée sur cet appareil » ;
- invalide : bordure 2 px `{colors.semantic-error}` et icône « ! » ;
- commentée : coin replié de 6 px ;
- verrouillée : fond `{colors.canvas-soft}` et info-bulle ;
- modifiée par un autre : fond `{colors.live}` qui s'estompe en 1,5 s, initiales de l'auteur pendant 10 s.

## Composants

### Structure

**`app-shell`** : fond `{colors.canvas-soft}`. `side-nav` à gauche, `context-bar` en haut, espace de travail, `detail-panel` à droite (facultatif).

**`side-nav`** : fond `{colors.canvas}`, filet droit `{colors.hairline-strong}`, 248 px (64 px replié).
- Ordre de haut en bas : logo APSUD, nom court du projet et code CBPF en `{typography.code-cbpf}`, puis la navigation : Tableau de bord, **Volets** (les 5 avec leur pictogramme de secteur), Validation (coordination), Activité, Exports, Administration (super-admin).
- **`side-nav-item-active`** : fond `{colors.surface-strong}`, texte `{colors.ink}`, graisse 600.

**`context-bar`** : fond `{colors.canvas}`, 56 px, filet bas `{colors.hairline}`.
- Contenu : sélecteur de **volet**, sélecteur de **mois** avec flèches précédent / suivant, état de connexion (en ligne, hors ligne, synchronisation), cloche avec compteur, `avatar`.
- Elle reste visible sans jamais masquer le focus.

**`consortium-band`** : en tête du tableau de bord seulement, sur le voile Pousse.
- Titre en `{typography.display-xl}` : « Consortium FH, Nanga-Boguila, Paoua, Bossangoa ».
- Sous-titre : « Décembre 2026, mois 2 sur 10 ».
- Un seul `button-primary` pour l'action la plus utile au rôle connecté : « Saisir le rapport de décembre » pour une ONG, « 3 rapports à valider » pour la coordination.

### Boutons

**`button-primary`** : Forêt plein. Fond `{colors.primary}`, texte `{colors.on-primary}`, `{typography.button}`, 10 × 18 px, 40 px de haut, `{rounded.md}`.

**`button-primary-active`** : état pressé, fond `{colors.primary-active}`.

**`button-secondary`** : fond `{colors.surface-card}`, texte `{colors.ink}`, filet 1 px `{colors.hairline-strong}`.

**`button-tertiary-text`** : texte `{colors.link}`, sans fond (« Voir l'historique », « Tout marquer comme lu »).

**`button-danger`** : texte `{colors.semantic-error}`, filet `{colors.semantic-error}`. **Réservé au super-admin** (« Supprimer définitivement »), toujours suivi d'un `dialog` de confirmation qui fait retaper le mot « SUPPRIMER ».

### Données

**`data-panel`** : fond `{colors.surface-card}`, `{rounded.lg}`, filet 1 px `{colors.hairline-strong}`, `overflow: clip`. En-tête de panneau de 56 px avec titre en `{typography.display-sm}` et actions à droite.

**`data-table-head`** / **`data-table-row`** : vrai `<table>`. En-tête sur `{colors.canvas-soft}` en `{typography.table-head}`, lignes de 44 px séparées par `{colors.hairline}`, ligne active `{colors.surface-row-active}`. En-tête et première colonne figés au défilement.

**`number-cell`** : cellule de saisie, `{typography.table}` aligné à droite, `{rounded.xs}`, `inputmode="numeric"`. Au focus : contour 2 px `{colors.ink}`. Le **Total** est calculé, en lecture seule, en graisse 600.

**`stat-tile`** : tuile du tableau de bord, chiffre en `{typography.figure}`, libellé en `{typography.body-sm}` `{colors.body}`, une `jauge-jalon` en pied. **`stat-tile-dark`** : la seule tuile inversée (« Rapports de décembre : 3 sur 5 »).

**`jauge-jalon`** (signature) :
- piste `{colors.jauge-fond}` de 10 px (16 px dans les tuiles), `{rounded.xs}` ;
- cumul des mois précédents en `{colors.jauge-cumul}`, apport du mois en `{colors.jauge-mois}` ;
- jalon de cible : trait vertical de 2 px en `{colors.jauge-jalon}` qui dépasse la piste de 4 px en haut et en bas ;
- au-delà de la cible, la barre continue après le jalon ;
- toujours accompagnée de son texte : « 4 210 sur 7 525 · 56 % ».

**`status-marker`** : goutte de 12 px et texte en `{typography.badge}`.

**`report-matrix-cell`** : case de 40 px de la matrice volets × mois, `{rounded.sm}`, marqueur de statut centré, mois en `{typography.caption}`. Un clic ouvre le rapport.

**`week-cell`** : case de semaine du plan d'action (24 px, zone cliquable de 32 px), `{rounded.xs}`.
- `week-cell-prevu` : fond `{colors.wash-pousse-mid}` ;
- `week-cell-realise` : fond `{colors.jauge-mois}` avec une coche blanche.
- Elle se coche au clic ou avec la barre d'espace. Pas de glisser-déposer obligatoire.

**`sector-tag`** : puce de 8 px dans la couleur du secteur et nom du volet (« WASH, IDC »), filet `{colors.hairline-strong}`, `{rounded.sm}`.

**`badge-pill`** : fond `{colors.surface-strong}`, `{typography.badge}`, `{rounded.pill}` (« 3 nouvelles », « Indicateur standard »).

### Panneaux flottants

**`detail-panel`** : 400 px, `{rounded.xl}` côté gauche, ombre flottante.
- Onglets Commentaires, Historique (versions de la valeur), Journal (audit), Justificatifs.
- S'ouvre avec `Ctrl+Entrée` ; plein écran sur téléphone.

**`notification-drawer`** : 380 px, groupé par jour, filtre par volet, « Tout marquer comme lu ».

**`dialog`** : `<dialog>` natif, `{rounded.xl}`, 24 px de marge intérieure, 480 px de large au plus.

### Retour d'information

**`activity-item`** : ligne du fil d'activité, en `{typography.body-sm}` :
- `avatar` de l'auteur ;
- phrase complète : « **ARS** a modifié *Enfants dépistés* : Filles 120 → 135 » ;
- horodatage relatif en `{colors.muted}`.

**`offline-banner`** : « Hors ligne : 3 valeurs en attente d'envoi ». Il disparaît après l'envoi, avec l'annonce « 3 valeurs envoyées ».

**`empty-state`** : fond `{colors.canvas-soft}`, `{rounded.lg}`, une phrase qui invite à agir et un seul bouton.

### Champs et onglets

**`text-input`** : 44 px, `{rounded.md}`, filet `{colors.hairline-strong}`, libellé visible au-dessus, aide en dessous. Au focus, la bordure passe à 2 px `{colors.ink}`.

**`tabs`** : onglets texte de 40 px. L'onglet actif a un trait bas de 2 px `{colors.ink}` et une graisse de 600.

## Écrans

### Tableau de bord du consortium

```
 ┌─ consortium-band (voile Pousse) ─────────────────────────────────────────────┐
 │ Consortium FH, Nanga-Boguila, Paoua, Bossangoa         [Saisir le rapport de │
 │ Décembre 2026, mois 2 sur 10                            décembre]            │
 └──────────────────────────────────────────────────────────────────────────────┘
 ┌ stat-tile-dark ─┐ ┌ stat-tile ──────┐ ┌ stat-tile ──────┐ ┌ stat-tile ──────┐
 │ 3 sur 5         │ │ 23 %            │ │ 62 %            │ │ 4 j             │
 │ rapports soumis │ │ budget exécuté  │ │ indicateurs à   │ │ avant échéance  │
 │ ▮▮▮▯▯           │ │ ▬▬▬▬▬░░░░│░░    │ │ jour            │ │ (5 janvier)     │
 └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
 ┌ data-panel : Avancement par volet ───────────────────────────────────────────┐
 │ ● WASH, IDC     Personnes ayant accès à l'eau  ▬▬▬▬▬▬▬▓▓░░░░░│░░ 1 240/3 000 │
 │ ● NUT, ARS      Enfants dépistés               ▬▬▬▬▬▓░░░░░░░│░░ 2 105/7 525 │
 └──────────────────────────────────────────────────────────────────────────────┘
 ┌ data-panel : Rapports mensuels ────────────────┐ ┌ data-panel : Activité ─────┐
 │            nov  déc  janv  …  août             │ │ IDC a soumis décembre      │
 │ WASH, IDC   ●    ◐    ○        ○               │ │ ARS a modifié…             │
 └────────────────────────────────────────────────┘ └────────────────────────────┘
```

### Saisie du mois

```
 WASH, IDC › Rapport de décembre 2026       ◇ Brouillon · enregistré il y a 12 s
 Indicateurs | Activités et tâches | Budget | Résultats | Justificatifs
 ┌ data-panel ───────────────────────────────────────────────────────────────────┐
 │ Indicateur                         │ Femmes │ Filles │ Hommes │ Garçons │ Total │
 │ Personnes ayant accès à l'eau      │                                           │
 │ WSH · 1.1          Planifié        │    300 │  1 350 │    600 │     750 │ 3 000 │
 │                    Ce mois         │ [  45] │ [ 210] │ [  80] │ [   95] │   430 │
 │                    Cumul           │    112 │    505 │    210 │     243 │ 1 070 │
 │ ▬▬▬▬▬▬▬▓▓░░░░░░░░░│░░  1 070 sur 3 000 · 36 %                                   │
 └───────────────────────────────────────────────────────────────────────────────┘
                                  [Enregistrer le brouillon]  [Soumettre à APSUD]
```

### Téléphone (390 px)
- La `side-nav` devient une barre basse à 4 entrées (Tableau de bord, Saisie, Activité, Plus).
- La `context-bar` se compacte (volet et mois).
- La grille de saisie devient **une fiche par indicateur** : champs empilés deux par deux, total en dessous, « Indicateur suivant ».
- Le calendrier S1-S5 devient une liste par mois.

## Icônes et pictogrammes

- **Icônes d'interface (maison)** :
  - grille de 24, zone utile de 20, trait de 1,75, terminaisons et jonctions arrondies ;
  - angles à 45° ou 90°, arcs uniquement, 5 tracés au plus, `currentColor` ;
  - affichées en 18 à 20 px dans les tableaux, 20 px dans la navigation ;
  - aucune bibliothèque (Lucide, Heroicons, Material, Font Awesome) et aucun emoji.
- **Logos des organisations (2026-11-22, consigne du développeur)** : chaque ONG est représentée par son **vrai logo** (composant `LogoOrganisation` : pastille blanche à filet fin, tailles 24, 36 et 64 px), partout où elle apparaît : navigation, en-tête de volet, tableaux, connexion. Les pictogrammes de secteur tracés décrits ci-dessous sont abandonnés et retirés du code.
- **Pictogrammes de secteur (abandonnés)** : grille de 32, trait de 2, un seul aplat en goutte-feuille dans la couleur du secteur. Chacun dessine un **objet réel du terrain** :

| Secteur | Objet dessiné |
|---|---|
| WASH | Pompe India Mark II |
| Nutrition | Bracelet MUAC gradué |
| Santé | Formation sanitaire (toit à deux pentes et croix) |
| Protection de l'enfance | Main adulte ouverte sous une silhouette d'enfant |
| Sécurité alimentaire | Sac de vivres noué et épi de mil |

- Planche de contrôle `/dev/icones` : chaque icône à 16, 20, 24, 32 et 48 px, sur clair et sur sombre.

## Mouvement

| Mouvement | Durée | Courbe |
|---|---|---|
| Valeur modifiée par un autre utilisateur (fond `{colors.live}` qui s'estompe) | 1 500 ms | `cubic-bezier(0.01, 0, 0.1, 1)` |
| Ouverture du `detail-panel` ou du tiroir | 200 ms | `cubic-bezier(0.01, 0, 0.1, 1)` |
| Dépliage d'une ligne du cadre logique | 200 ms | `cubic-bezier(0.95, 0, 0.05, 1)` |
| La part « ce mois » de la jauge s'allonge après l'enregistrement | 400 ms | `cubic-bezier(0.01, 0, 0.1, 1)` |
| Survol d'un bouton ou d'une ligne | 150 ms | linéaire |

Pas d'animation d'entrée des blocs, pas de toupie : des **squelettes** à la forme du contenu. Avec `prefers-reduced-motion: reduce`, les glissements deviennent de simples fondus et les états restent lisibles par la couleur et le texte.

## À faire / À éviter

### À faire
- Réserver `{colors.primary}` (Forêt plein) au **bouton principal**, un seul par zone d'action.
- Utiliser `{colors.link}` (Vert APSUD) pour les liens et l'avancement uniquement.
- Mettre chaque bouton à `{rounded.md}` (8 px) et chaque panneau à `{rounded.lg}` (12 px).
- Afficher toute comparaison réalisé / cible avec une `jauge-jalon` et son texte.
- Afficher tout statut avec la goutte, la couleur **et** le texte.
- Utiliser les chiffres tabulaires et le format français dans tout ce qui se compare.
- Garder la grille de saisie dans un vrai `<table>` accessible.

### À éviter
- Ajouter une autre couleur d'action saturée : le Forêt est le seul bouton plein.
- Mettre du Vert APSUD sur un bouton plein, ou du vert du logo en petit texte.
- Mettre un bouton en pilule : les pilules sont réservées aux badges.
- Répéter le voile Pousse ailleurs que derrière le bandeau du consortium.
- Signaler un statut par la couleur seule.
- Afficher un bouton « Supprimer » à un autre rôle que le super-admin : on **archive**.
- Utiliser des ombres au repos, des dégradés décoratifs ou des icônes d'une bibliothèque.

## Comportement responsive

### Points de rupture

| Nom | Largeur | Changements clés |
|---|---|---|
| Téléphone | < 640 px | Barre basse ; grille de saisie en fiches ; tuiles une par ligne ; `detail-panel` plein écran ; titre du bandeau 40 → 28 px |
| Tablette | 640 à 1 024 px | `side-nav` repliée (64 px) ; tuiles 2 par ligne ; tableaux avec défilement horizontal et première colonne figée |
| Ordinateur | 1 024 à 1 440 px | Cadre complet ; tuiles 4 par ligne ; `detail-panel` superposé |
| Grand écran | > 1 440 px | Espace de travail plafonné à 1 280 px ; `detail-panel` côte à côte, sans masquer |

Largeurs vérifiées par capture : 1920, 1440, 1280, 1024, 768, 430, 390, 360 px (INSTRUCTIONS.md §0.3).

### Cibles tactiles
- Boutons de 40 px, portés à 44 px sur tactile (`@media (pointer: coarse)`).
- Cellules de saisie de 44 px sur tactile.
- Cases de semaine avec une zone cliquable de 32 px au moins.

### Stratégie de repli
- Navigation latérale → repliée → barre basse.
- Tableau de saisie → fiches par indicateur.
- Calendrier S1-S5 → liste par mois.
- Tuiles : 4 → 2 → 1.

## Accessibilité et performance

- **WCAG 2.2 AA** :
  - `<th scope>` et `<caption>` sur les tableaux ;
  - focus visible (2 px `{colors.ink}` avec un écart blanc de 2 px) ;
  - `role="status"` pour « Enregistré » et « 3 nouvelles mises à jour », `role="log"` pour le fil d'activité, `role="alert"` réservé aux erreurs bloquantes ;
  - copier-coller autorisé dans les champs de connexion ;
  - aucune information déjà connue n'est redemandée.
- **Budgets d'une page de saisie** :
  - JavaScript initial ≤ 120 Ko compressé ;
  - CSS ≤ 25 Ko ;
  - police ≤ 70 Ko ;
  - affichage en moins de 3 s en 3G rapide ;
  - aucune image décorative.

## Ton et vocabulaire

On écrit en français simple, à l'actif. Un même geste garde le même nom du bouton au message.

| On dit | On ne dit pas |
|---|---|
| Volet | Module, espace |
| Rapport de décembre | Soumission #12 |
| Ce mois / Cumul / Cible | Valeur courante / agrégat |
| Enregistrer le brouillon | Sauvegarder |
| Soumettre à APSUD → « Soumis à APSUD le 3 déc. » | Envoyer |
| Valider → « Validé par APSUD » | Approuver |
| Renvoyer pour correction → « À corriger » | Rejeter |
| Archiver → « Archivé » | Supprimer (super-admin : « Supprimer définitivement ») |
| Justificatif | Pièce jointe |

- **Erreurs** : elles disent quoi et comment corriger, sans s'excuser. Exemple : « Le total des Filles (1 400) dépasse la cible (1 350). Vérifiez la saisie ou ajoutez un commentaire. »
- **États vides** : une phrase qui invite à agir. Exemple : « Aucune tâche pour cette activité. Ajoutez la première tâche pour l'afficher dans le calendrier. »

## Guide d'itération

1. Un composant à la fois, d'abord à 1440 px, puis en responsive.
2. Boutons à `{rounded.md}`, panneaux à `{rounded.lg}`, flottants à `{rounded.xl}`.
3. Les variantes sont des entrées séparées dans les tokens (`button-primary`, `button-primary-active`…).
4. Toujours des références `{token}`, jamais de couleur en dur.
5. Mona Sans 600 pour les titres, 400 pour le texte, chasse étroite dans les tableaux.
6. Le Forêt reste le seul bouton plein ; le Vert APSUD reste réservé aux liens et à l'avancement.
7. Chaque écran terminé : captures aux 8 largeurs, parcours au clavier seul, contrôle des contrastes.

## Lacunes connues

- Le support des chiffres tabulaires (`tnum`) par Mona Sans est à confirmer en phase 3. À défaut, alignement à droite et chasse étroite.
- Les pictogrammes de secteur restent à dessiner (phase 3).
- Thème sombre : hors périmètre de la version 1.
- Graphiques temporels (évolution mois par mois) : à concevoir en phase 4, à partir de la jauge et d'un simple histogramme en barres.
- Les contrastes des couleurs de secteur sur `{colors.canvas-soft}` sont à revérifier à l'outil.
