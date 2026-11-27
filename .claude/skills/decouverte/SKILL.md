---
name: decouverte
description: Ajoute une entrée à la rubrique « En ce moment » du site (data/decouvertes.json) à partir de ce que l'utilisateur colle (code d'intégration Bandcamp, lien, ses mots, présentation de l'artiste, date de sortie), puis publie. À utiliser quand l'utilisateur propose un disque, un livre, un film ou un mix qu'il écoute ou lit en ce moment, avec ou sans /decouverte.
argument-hint: "[code Bandcamp, lien, tes mots, présentation…]"
---

# /decouverte — ajouter une entrée à « En ce moment »

L'utilisateur colle en vrac ce qu'il a : $ARGUMENTS (et/ou les messages qui suivent).
Ton travail : en faire une entrée propre dans `data/decouvertes.json`, la vérifier, la publier. Réponds en français, brièvement.

## 1. Lire ce qui a été collé

| Indice dans le texte collé | Champ |
|---|---|
| `<iframe … src="https://bandcamp.com/EmbeddedPlayer/album=123…` (ou `track=123…`) + `<a href="https://x.bandcamp.com/album/…">Titre de Artiste</a>` | `bandcamp: { url, type: "album" \| "track", id: 123 }`, `title`, `artist` |
| Un simple lien `https://x.bandcamp.com/…` sans iframe | `bandcamp: { url }` seul (pas de lecteur : demander le code **Share / Embed** si l'utilisateur veut le lecteur) |
| Lien YouTube | `youtube: ["<id>"]` (vérifier l'id via oEmbed : `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json`) |
| « paru le 27 mars 2026 » / « released March 27, 2026 » | `year` (et la date dans `context` si utile) |
| Biographie de l'artiste, texte du label | `context` (FR) + `context_en` : **une ou deux phrases**, origine et projet, rien de promotionnel |
| « piste favorite », « highlight », un titre mis en avant | `highlight` (titre exact du morceau) |
| Les mots personnels de l'utilisateur | `note` + `note_en` |
| Un titre déjà dans `data/tracks.json` (redécouverte du catalogue) | `track: "<id>"` au lieu de title/artist/youtube |
| Un livre / film de `data/sources.json` | `source: "<id>"` |

`kind` : `nouveau` (sortie récente), `redecouverte`, `lecture`, `film`, `mix`. Si ce n'est pas clair, `nouveau` pour une sortie de l'année, sinon demander.
`date` : la date du jour (AAAA-MM-JJ). `id` : slug court `artiste-titre`.

## 2. Règles (non négociables)

- **Le cas courant : l'utilisateur colle la page Bandcamp telle quelle** (titre, artiste, « paru le … », texte du label, crédits, biographie, parfois le code Share / Embed). On en tire tout ce qu'on peut, on prépare l'entrée, puis on la montre et on demande en une ligne : « Tes mots, une piste favorite ? Sinon je publie comme ça. » La note, la piste favorite et la station sont des compléments **facultatifs** : sans réponse ou sur un « vas-y », on publie sans note.
- **La note est celle de l'utilisateur.** On corrige l'orthographe, on traduit (FR ↔ EN), on ne rajoute aucune idée. Jamais de note inventée : sans mots de sa part, le champ `note` reste absent (le `context` tiré du label suffit).
- Le texte du label sert au `context`, résumé en une ou deux phrases neutres (origine des artistes, numéro de sortie, date, couleur du disque), sans superlatifs promotionnels.
- Le texte de l'utilisateur garde son ton : « banger », « Point. »… on ne lisse pas.
- Ne jamais aspirer les pages Bandcamp avec curl ou un script : elles ont une protection anti-robot. On travaille avec ce que l'utilisateur colle ; pour un fait manquant, recherche web classique, sinon on laisse le champ vide.
- Pas de `verify` par défaut : l'utilisateur a choisi une entrée sans année plutôt qu'un avertissement affiché. N'en mettre que pour un doute réel sur un fait affiché, et le lui dire.
- `station` : choisir la station du plan du métro (`data/metro.json`) que le disque prolonge vraiment, et dire pourquoi en une phrase. En cas de doute, proposer et demander.
- Rien de personnel sur l'utilisateur dans les fichiers (dépôt public).

## 3. Écrire et vérifier

1. `git pull --no-rebase origin main` (d'autres sessions poussent aussi).
2. Ajouter / mettre à jour l'entrée dans `data/decouvertes.json` (JSON indenté de 2 espaces, `ensure_ascii=False`). Pour modifier une entrée existante, repartir de son `id`.
3. `node tools/bundle-data.mjs`
4. Contrôle rapide : JSON valide, `station` / `track` / `source` existent bien, `youtube` vérifié.
5. Montrer à l'utilisateur l'entrée telle qu'elle s'affichera (titre, contexte, note FR et EN, piste favorite, station).

## 4. Publier

Dès que l'utilisateur a répondu (ses mots, ou « vas-y » / « publie »), publier :

```sh
git add data/decouvertes.json data/bundle.js
git commit -m "En ce moment : <Artiste> — <Titre>"   # + ligne Co-Authored-By habituelle
git pull --no-rebase origin main && git push origin main
D=$(mktemp -d) && git archive HEAD | tar -x -C "$D" && rm -f "$D/.gitignore" && \
npx wrangler pages deploy "$D" --project-name house-intelligence --branch main \
  --commit-hash "$(git rev-parse HEAD)" --commit-message "$(git log -1 --format=%s)"
```

Puis vérifier que `https://house-intelligence.pages.dev/data/decouvertes.json` contient l'entrée, et donner le lien `https://house-intelligence.pages.dev/#decouverte`.

Depuis claude.ai/code (pas de wrangler) : pousser sur une branche et ouvrir une pull request ; le déploiement se fera depuis l'ordinateur.
