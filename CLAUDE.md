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
| `metro.js` | Rendu SVG du plan de métro (lignes, stations, correspondances, pastilles `badge`) |
| `i18n.js` | Textes d'interface FR/EN : `I18N.t(clé)` ; contenu : `I18N.f(obj, champ)` lit `champ_en` en anglais |
| `styles.css`, `pages.css` | Styles de l'application / des pages statiques |
| `data/tracks.json` | `eras` (era-1, era-2, era-3a 2005–2012, era-3b 2013–2019, era-3c 2020–), `genres`, `tracks` (85 disques) |
| `data/metro.json` | 9 lignes, 35 stations, 7 correspondances |
| `data/machines.json`, `data/sources.json` | Fiches machines (808, 909, 303, MPC…) et œuvres de référence |
| `data/bundle.js` | Copie embarquée des JSON pour une ouverture en `file://`. **Généré**, ne pas éditer |
| `disques/`, `stations/`, `en/records/`, `en/stations/`, `sitemap.xml` | Pages statiques SEO. **Générées** |
| `og/`, `og-image.png` | Images de partage. **Générées** |
| `_archive/` | Anciennes versions (wiki statique, sauvegardes de données) : ne pas réintroduire sans demande |

Routes : `#metro` (par défaut, `?st=…&ligne=…`), `#booth`, `#<id-disque>` ou `?track=<id>`, `#bibliotheque`.

Lignes du métro : L1 Chicago & Acid · L2 NYC, Garage & Tribal · L3 Deep & gospel · L4 UK Sound System & Bass · L5 Escales européennes · L6 Futurisme & Machines · L7 Ballroom & queer · L8 Afriques · L9 Techno & Europe.

### Fiche disque (`tracks[]`)

Champs obligatoires : `id, title, artist, year, label, city, country, continent, genre, era, bpm, camelot_key, energy, gear, construction, producer_origins, club_sociology, queer_ballroom_axis, archive_ref, why_this_record, tags, youtube`, et la version `*_en` de chaque texte.
Champs facultatifs : `spotify`, `further_reading`, `story`, `timeline`, `credits`, `book_refs` (`source`, `where`, `where_en`), `references` (URL), `verify` (liste des points à vérifier), `verified` (booléen).

## Règles éditoriales

1. **Bilingue** : tout texte ajouté en français a son équivalent `*_en`. Le français reste la langue par défaut.
2. **Vérifier avant d'écrire** : dates, labels, numéros de catalogue et classements sont vérifiés sur le web (Discogs, Wikipedia, Resident Advisor, presse). Un fait non confirmé va dans `verify`, pas dans le texte présenté comme établi.
3. **Signaler les attributions discutées** : « premier disque house », paternité d'un son, etc.
4. **Aucune allégation non jugée** contre une personne (procès, accusations) : on ne les publie pas.
5. **Pas d'indication de pages ni de minutage** dans les références de livres ou de films.
6. **Pas de vidéo YouTube inventée** : chaque identifiant est vérifié (oEmbed). Si on n'en trouve pas de fiable, on n'en met pas.
7. BPM, clés Camelot et `gear` sont des valeurs éditoriales indicatives (voir `_meta.note`).

## Après toute modification de `data/*.json`

```sh
node tools/bundle-data.mjs     # régénère data/bundle.js
node tools/build-pages.mjs     # régénère les pages statiques et le sitemap
node tools/og-images.mjs       # images de partage (nécessite Playwright, installé hors du dépôt)
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
