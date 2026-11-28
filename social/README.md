# Instagram : file d'attente et publication automatique

Compte : @house.intelligence.archive (professionnel, relié à la Page Facebook « House Intelligence »). Textes en anglais.

## Le circuit

1. **Rédaction** : chaque post est une entrée de `posts.json` (accroche, légende, hashtags), au statut `draft`.
2. **Rendu** : `node tools/instagram.mjs media <n>` produit `social/media/<nn>-<slug>/01.jpg…` et `caption.txt`.
   Ces fichiers sont versionnés : une fois sur `main`, ils sont servis en https par raw.githubusercontent.com (le dépôt est public), ce dont l'API Instagram a besoin. Si le dépôt devient privé, il faudra un autre hébergement (variable MEDIA_BASE_URL).
3. **Validation humaine** : on passe le post en `"status": "approved"` (facultatif : `"not_before": "2026-12-01"`).
   Rien n'est publié sans ce statut.
4. **Publication** : `.github/workflows/instagram.yml` tourne lundi, mercredi et vendredi vers 18 h (Paris),
   publie le premier post `approved` (ordre de `n`), puis le marque `published` avec son lien Instagram.
   Chaque post de la file porte la date de son créneau (`not_before`) : il ne part pas avant, même s'il est validé tôt.
   Un second passage à 20 h (Paris) rattrape un post dont la publication de 18 h aurait échoué ; les autres jours il ne fait rien.
   Le mode `check` affiche aussi la date d'expiration du jeton et le nombre de posts validés en attente.

Types de post : `track` (disque), `feature` (fonction du site), `machine` (fiche machine) en style sombre ;
`station` et `line` en style clair « ligne de métro ».

Lancement à la main : GitHub → Actions → Instagram → Run workflow, avec `check` (tester le jeton),
`dry-run` (voir ce qui partirait) ou `publish`.

## Coups de cœur (rubrique « En ce moment »)

Chaque nouvelle entrée de `data/decouvertes.json` devient un post « Current favourite » : style sombre avec un bandeau jaune
et la date, légende à la première personne qui reprend la note telle quelle. **Ces posts partent sans validation**, hors calendrier.

- Déclencheur : `.github/workflows/coups-de-coeur.yml`, à chaque push sur `main` qui modifie `data/decouvertes.json`,
  plus deux passages quotidiens vers 13 h 43 et 18 h 37 (Paris) pour un coup de cœur resté en attente. Un coup de cœur bloqué depuis plus de 2 jours fait échouer le passage, et GitHub envoie un e-mail d'échec.
- `tools/coups-de-coeur.mjs` ajoute le post à `posts.json` (`"channel": "coup-de-coeur"`), le workflow rend les images
  (`node tools/instagram.mjs media <n>`), les pousse, puis `node tools/publish-instagram.mjs --coup-de-coeur` publie.
- Garde-fous : un coup de cœur par jour au plus (les suivants sortent les jours d'après) ; rien ne part sans titre,
  artiste ou auteur et note anglaise (`note_en`), ni si une image est absente ou presque vide, ni si la légende manque ;
  seules les entrées de moins de 14 jours sont prises ; une entrée déjà publiée n'est jamais republiée, même modifiée.
- Tenir une entrée à l'écart : `"instagram": false` dans l'entrée. Tout suspendre : Actions → Coups de cœur → Disable workflow.
- Aperçu local des trois variantes de couverture : `node tools/instagram.mjs decouverte <id> --variant=all`.

## Secrets (GitHub → Settings → Secrets and variables → Actions)

- `IG_USER_ID` : identifiant du compte Instagram professionnel.
- `IG_ACCESS_TOKEN` : jeton d'utilisateur système de l'app Meta « HOUSE INTEL PUBLISHER » (cas d'usage Instagram API, connexion unifiée). N'expire pas.

Jamais dans le dépôt.

## Limites

- L'API ne permet pas d'ajouter une musique Instagram : pour un post avec musique, publier à la main.
- 1 à 10 images JPEG par post, légende de 2 200 caractères et 30 hashtags au plus, 100 publications par 24 h.

## Reels « séquenceur » (machines)

Vidéos verticales de 23 s environ, avec le son : une machine (TR-909, TR-808, TB-303…), un motif de 16 pas,
le motif complet puis chaque ligne isolée avec une phrase d'explication. Style sombre « fiche d'archive » (choisi le 28/11/2026).

- Données : `social/reels.json` (textes en anglais, `status`, `verify`). Gabarit : `tools/reel.html`.
- Rendu : `node tools/reels.mjs [slug] [--stills]` → `social/reels/<slug>.mp4` (non versionné). Nécessite Playwright et ffmpeg.
- Le son est une émulation (moteur Pulse du site), l'écran le dit. Les textes décrivent le fonctionnement des machines ;
  aucune attribution machine → disque sans source. Les points de `verify` sont levés avant toute publication.
- Pas encore de publication automatique : ce format vient en plus de la file, après validation.
