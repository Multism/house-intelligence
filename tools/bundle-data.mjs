// Regroupe data/*.json dans data/bundle.js pour que le site fonctionne aussi en ouverture directe (file://).
// À relancer après toute modification des fichiers JSON :  node tools/bundle-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
const files = ["tracks", "machines", "sources", "metro", "decouvertes", "digging"];
const data = Object.fromEntries(files.map((f) => [f, JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url), "utf8"))]));
writeFileSync(new URL("../data/bundle.js", import.meta.url), `/* généré par tools/bundle-data.mjs — ne pas éditer */\nwindow.HI_DATA = ${JSON.stringify(data)};\n`);
console.log("data/bundle.js écrit :", files.join(", "));
