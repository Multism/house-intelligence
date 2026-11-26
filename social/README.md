# Instagram : file d'attente et publication automatique

Compte : @house.intelligence.archive (professionnel, relié à la Page Facebook « House Intelligence »). Textes en anglais.

## Le circuit

1. **Rédaction** : chaque post est une entrée de `posts.json` (accroche, légende, hashtags), au statut `draft`.
2. **Rendu** : `node tools/instagram.mjs media <n>` produit `social/media/<nn>-<slug>/01.jpg…` et `caption.txt`.
   Ces fichiers sont versionnés : une fois sur `main`, Cloudflare Pages les sert en https, ce dont l'API Instagram a besoin.
3. **Validation humaine** : on passe le post en `"status": "approved"` (facultatif : `"not_before": "2026-12-01"`).
   Rien n'est publié sans ce statut.
4. **Publication** : `.github/workflows/instagram.yml` tourne lundi, mercredi et vendredi vers 18 h (Paris),
   publie le premier post `approved` (ordre de `n`), puis le marque `published` avec son lien Instagram.

Lancement à la main : GitHub → Actions → Instagram → Run workflow, avec `check` (tester le jeton),
`dry-run` (voir ce qui partirait) ou `publish`.

## Secrets (GitHub → Settings → Secrets and variables → Actions)

- `IG_USER_ID` : identifiant du compte Instagram professionnel.
- `IG_ACCESS_TOKEN` : jeton de la Page Facebook reliée (jeton de Page issu d'un jeton utilisateur longue durée : n'expire pas).

Jamais dans le dépôt.

## Limites

- L'API ne permet pas d'ajouter une musique Instagram : pour un post avec musique, publier à la main.
- 1 à 10 images JPEG par post, légende de 2 200 caractères et 30 hashtags au plus, 100 publications par 24 h.
