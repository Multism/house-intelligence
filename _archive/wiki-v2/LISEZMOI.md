# Version « wiki » archivée (v2, 25/11/2026)

Générateur de 127 pages statiques indexables (genres, morceaux, machines, bibliothèque, lecteur).
Mise de côté à la demande : retour à l'application d'une seule page.

Pour la restaurer : copier build.mjs, site.css, site.js à la racine, wiki.json dans data/,
remettre `read("data/wiki.json")` dans build.mjs, déplacer index.html vers booth/index.html, puis `node build.mjs`.
