# HOUSE INTELLIGENCE — fiche projet pour Claude Code

Site éditorial et ludique, bilingue FR/EN, sur l'histoire, les machines et la sociologie de la house music, dans l'esprit de dub.ninja.
En ligne : https://house-intelligence.pages.dev · Dépôt public : https://github.com/Multism/house-intelligence (branche `main`).

> Ce fichier est public (dépôt GitHub et site déployé) : n'y mettre aucune donnée personnelle ni secret.

## Vision

- Raconter la house comme une histoire **noire, queer et populaire**, de Chicago, New York et Detroit jusqu'à Durban, Johannesburg et Berlin, à travers des disques, des clubs, des machines et des livres.
- Ton éditorial : précis, sourcé, sans hagiographie. On distingue ce qui est établi de ce qui est discuté.
- Expérience immersive sur une seule page : on explore à la souris ou au clavier, on écoute, on enchaîne les disques comme un DJ.

## Structure du site (application d'une seule page, JavaScript sans framework)

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille, méta SEO, JSON-LD, plan de métro (viewBox `40 0 1200 860`) |
| `app.js` | Routage par hash, Booth, Bibliothèque, lecteur YouTube flottant (`#fw`), Pulse (synthé Web Audio) |
| `search.js` | Recherche rapide (Cmd/Ctrl+K, « / », loupe) : disques, fiches digging, artistes et alias, labels, stations, scènes, machines, Bibliothèque |
| `metro.js` | Rendu SVG du plan de métro (lignes, stations, correspondances, pastilles `badge`) |
| `i18n.js` | Textes d'interface FR/EN : `I18N.t(clé)` ; contenu : `I18N.f(obj, champ)` lit `champ_en` en anglais |
| `styles.css`, `pages.css` | Styles de l'application / des pages statiques |
| `data/tracks.json` | `eras` (era-1, era-2, era-3a 2005–2012, era-3b 2013–2019, era-3c 2020–), `genres`, `scenes` (micro-scènes), `tracks` (142 disques) |
| `data/metro.json` | 9 lignes, 35 stations, 7 correspondances |
| `data/digging.json` | Espace « Deep Digging » (`#digging`) : fiches légères (artiste, titre, label, catalogue, dates, sources), métadonnées de labels et d'artistes (vrais noms, alias), collaborations et collectifs (`type`, `members`). Les disques du Booth s'y rangent aussi sous leur label |
| `data/decouvertes.json` | Rubrique « En ce moment » (`#decouverte`) : journal daté des écoutes et lectures du moment |
| `data/machines.json`, `data/sources.json` | Fiches machines (808, 909, 303, MPC…) et œuvres de référence |
| `data/bundle.js` | Copie embarquée des JSON pour une ouverture en `file://`. **Généré**, ne pas éditer |
| `disques/`, `stations/`, `en/records/`, `en/stations/`, `sitemap.xml` | Pages statiques SEO. **Générées** |
| `og/`, `og-image.png` | Images de partage. **Générées** |
| `_archive/` | Anciennes versions (wiki statique, sauvegardes de données) : ne pas réintroduire sans demande |

Routes : `#metro` (par défaut, `?st=…&ligne=…`), `#booth`, `#decouverte`, `#digging`, `#<id-disque>` ou `?track=<id>`, `#bibliotheque`.

Lignes du métro : L1 Chicago & Acid · L2 NYC, Garage & Tribal · L3 Deep & gospel · L4 UK Sound System & Bass · L5 Escales européennes · L6 Futurisme & Machines · L7 Ballroom & queer · L8 Afriques · L9 Techno & Europe.

### Fiche disque (`tracks[]`)

Champs obligatoires : `id, title, artist, year, label, city, country, continent, genre, era, bpm, camelot_key, energy, gear, construction, producer_origins, club_sociology, queer_ballroom_axis, archive_ref, why_this_record, tags, youtube`, et la version `*_en` de chaque texte.
Champs facultatifs : `catalog` (numéro de catalogue), `release_date` (date déclarée par le label ou l'artiste) et `physical_release_date` (pressage), au format `AAAA-MM-JJ` ou `AAAA-MM` ; `year` reste le champ des filtres, et un écart entre sources va dans `verify`. `scene` (id d'une micro-scène de `scenes`, filtre « Scènes » du Booth et liste dans le panneau des stations), `spotify`, `further_reading`, `story`, `timeline`, `credits`, `book_refs` (`source`, `where`, `where_en`), `references` (URL), `verify` (liste des points à vérifier), `verified` (booléen), `audit` (`{ "date": "AAAA-MM-JJ" }`, posé seulement quand toute la fiche a été vérifiée selon le protocole : la fiche s'affiche alors « auditée », sinon « en cours de vérification »), `bpm_source` et `key_source` (+ `_en` : mesure sur la version exacte, avec la méthode, ou déclaration documentée ; sans elles, BPM et clé s'affichent comme estimés).

## Règles éditoriales

1. **Bilingue** : tout texte ajouté en français a son équivalent `*_en`. Le français reste la langue par défaut.
2. **Vérifier avant d'écrire** : dates, labels, numéros de catalogue et classements sont vérifiés sur le web (Discogs, Wikipedia, Resident Advisor, presse). Un fait non confirmé va dans `verify`, pas dans le texte présenté comme établi.
3. **Signaler les attributions discutées** : « premier disque house », paternité d'un son, etc.
4. **Aucune allégation non jugée** contre une personne (procès, accusations) : on ne les publie pas.
5. **Pas d'indication de pages ni de minutage** dans les références de livres ou de films.
6. **Pas de vidéo YouTube inventée** : chaque identifiant est vérifié (oEmbed). Si on n'en trouve pas de fiable, on n'en met pas.
7. BPM, clés Camelot et `gear` sont des valeurs éditoriales indicatives (voir `_meta.note`). Données de jeu et données historiques ne se confondent pas : BPM mesuré sur la version exacte ou déclaration documentée ; tonalité par analyse audio avec la méthode ; énergie assumée comme appréciation éditoriale ; machines appuyées sur un témoignage, un entretien technique ou une documentation de studio ; samples sur crédits ou sources concordantes ; la construction musicale est une analyse d'écoute présentée comme telle.
8. **Audit des fiches anciennes** : par lots thématiques, une PR par lot (Chicago, Paradise Garage et disco ; acid house et rave britannique ; ballroom et cultures queer ; Detroit et deep house ; UK garage, jungle et bass music ; French Touch et progressive ; afro house, gqom et amapiano ; productions contemporaines). Aucune fiche supprimée ; les affirmations sensibles non étayées et les références non consultées sortent de l'affichage.

## Protocole documentaire (chaque dossier, chaque lot)

| Critère | Vérification |
|---|---|
| Discographie | Existence du disque, titre, version, label et catalogue |
| Chronologie | Sortie originale, pressage physique et rééditions |
| Généalogie | Influences documentées et correspondances stylistiques |
| Représentation | Contributions historiquement sous-représentées : femmes, artistes trans et non binaires, productrices, DJs, fondatrices de labels, organisatrices de soirées |
| Identité | Informations et pronoms uniquement attestés par les sources ; ne jamais présumer de l'identité de genre |
| Underground | Diversité des références au-delà des artistes les plus connus |
| Sources | Fiabilité et traçabilité des informations |

La représentation se contrôle comme les dates et les labels, sans quota : on élargit le périmètre de recherche avant de sélectionner, y compris dans les scènes historiques (années 1980 à 2000). Le but est de corriger les biais du récit, pas d'écrire une histoire parallèle : ces artistes entrent dans les mêmes stations, chronologies et réseaux de labels que leurs contemporains, sans section à part.

Statut des sources :

| Statut | Définition | Publication | Dans les données |
|---|---|---|---|
| Vérifiée directement | Source consultée, passage pertinent identifié | Oui | `references` |
| Vérifiée indirectement | Information rapportée par une autre source consultée | Avec mention explicite de la source secondaire | `references` (la source consultée) + mention dans le texte ou `verify` |
| Identifiée, non consultée | Référence repérée, contenu non lu ou inaccessible | Non | `references_pending` (jamais affiché) |
| Contradictoire | Sources consultées divergentes | Oui, avec mention de l'incertitude | `references` + l'écart dans `verify` |

Une page d'accueil institutionnelle n'est pas une preuve : pour une archive (Peabody, bibliothèque, fonds), garder le titre du document, son URL précise et sa cote si elle existe. Une source prestigieuse non consultée ne vaut pas plus qu'une source inconnue.

Correspondances du métro (`transfers[].kind` dans `data/metro.json`) : `filiation` (un courant contribue directement à l'émergence d'un autre), `circulation` (artistes, labels ou communautés relient deux scènes) ou `parente` (parenté esthétique, sans influence directe démontrée). La filiation concerne l'évolution d'un langage musical ; la circulation concerne la transmission des musiques, des pratiques, des expériences et des cultures entre scènes, et elle peut être directe, déterminante et parfaitement documentée. Une influence n'est pas nécessairement une filiation. Une correspondance sans lien attesté est une `parente`. Seule une filiation dont le sens est établi porte `from` (flèche). Champs facultatifs : `references`, `tracks`, `verify`. Le type s'affiche sur le plan (trait) et dans la bulle.

## Rubrique « En ce moment » (`data/decouvertes.json`)

Raccourci : la commande `/decouverte` (`.claude/skills/decouverte/SKILL.md`) déroule toute la procédure ci-dessous jusqu'à la mise en ligne.

La personne qui tient le site indique ce qu'elle écoute ou lit, avec quelques mots. Claude ajoute alors une entrée :

- `id` ; `date` (AAAA-MM-JJ, jour de l'ajout) ; `kind` : `nouveau`, `redecouverte`, `lecture`, `film` ou `mix` ;
- `title` et `artist` (ou `author`), `year`, `label` (ou `publisher` pour un livre) ;
- `context` et `context_en` : une ligne de présentation de l'artiste (origine, projet), sous le titre ; source : sa propre biographie ou une source vérifiée ;
- `highlight` : titre de la piste favorite (affiché « ★ Piste favorite : … ») ;
- `note` et `note_en` : **la note est la sienne, pas celle de Claude**. On la met en forme sans en inventer le contenu, on la traduit, et on la fait relire si elle a été reformulée ;
- `bandcamp` : `{ "url", "type": "album" | "track", "id" }`. C'est l'option à privilégier pour les petits artistes : le lien « Soutenir l'artiste » mène à leur page d'achat. L'`id` se lit dans le code du bouton officiel **Share / Embed** de la page (`album=123…` ou `track=123…`) ; sans code d'intégration, mettre seulement `url`. Pas de robot pour récupérer les pages Bandcamp : elles ont une protection anti-robot à respecter. Le lecteur ne se charge qu'au clic ;
- `youtube` : identifiants vérifiés, ou `track` (id d'une fiche existante, pour une redécouverte du catalogue) ;
- `station` : id du métro si le disque prolonge une ligne ; `source` : id de la Bibliothèque ; `link` : URL ;
- `verify` : points non confirmés.

Chaque nouvelle entrée part aussi sur Instagram, **sans validation**, comme post « coup de cœur » (voir `social/README.md`) : `note_en` est donc indispensable, et `"instagram": false` tient une entrée à l'écart.

Les entrées sont triées par date, la plus récente en tête. Le lien « En ce moment » du menu reste masqué tant que la liste est vide.

## Après toute modification de `data/*.json`

```sh
node tools/bundle-data.mjs     # régénère data/bundle.js
node tools/og-images.mjs       # images de partage (nécessite Playwright, installé hors du dépôt)
node tools/build-pages.mjs     # pages statiques et sitemap : APRÈS og-images, car une page ne pointe vers son image que si elle existe
```

Mettre à jour les compteurs affichés (disques, stations, lignes) dans `index.html` (méta et JSON-LD) et dans `i18n.js` s'ils changent.

## Vérification

Servir le dossier en local (`python3 -m http.server 8765`), puis contrôler dans un navigateur headless : aucune erreur console, rendu du métro (étiquettes qui ne se chevauchent pas), Booth, Bibliothèque, bascule FR/EN.

## Instagram (`social/`)

Les carrousels sont générés à partir des données du site par `tools/instagram.mjs`. La file d'attente est `social/posts.json`, avec des textes en anglais.
L'action GitHub `.github/workflows/instagram.yml` publie le lundi, le mercredi et le vendredi, uniquement les posts au statut `approved` : **rien ne part sans validation humaine**.
Les jetons sont dans les secrets GitHub, jamais dans le dépôt. Mode d'emploi : `social/README.md`.

## Git et déploiement

- Du travail arrive aussi par des pull requests venues d'autres sessions Claude (claude.ai/code). Toujours faire `git pull` avant de commencer.

- Identité de commit : `Multism <Multism@users.noreply.github.com>`, jamais d'e-mail personnel.
- Ne jamais committer de secrets ni de documents de travail : `.gitignore` exclut `.env*`, `.claude/settings.local.json`, `*.rtf`, `*.docx`, `*.pdf`.
- Pousser sur `main` **ne redéploie pas** le site : le projet Cloudflare Pages est en envoi direct. Après le push, déployer uniquement les fichiers suivis par git :

```sh
D=$(mktemp -d) && git archive HEAD | tar -x -C "$D" && rm -f "$D/.gitignore" && \
npx wrangler pages deploy "$D" --project-name house-intelligence --branch main \
  --commit-hash "$(git rev-parse HEAD)" --commit-message "$(git log -1 --format=%s)"
```

Puis vérifier sur https://house-intelligence.pages.dev.
