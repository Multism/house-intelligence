// Coups de cœur Instagram : transforme chaque nouvelle entrée de data/decouvertes.json (rubrique « En ce moment »)
// en post de la file social/posts.json, publié sans validation par .github/workflows/coups-de-coeur.yml.
//
//   node tools/coups-de-coeur.mjs           → ajoute ou met à jour les posts, écrit la liste des posts à rendre
//   node tools/coups-de-coeur.mjs --dry-run → montre ce qui serait ajouté, n'écrit rien
//
// Règles et garde-fous :
// - un post par entrée (champ decouverte = id de l'entrée) ; une entrée déjà publiée n'est jamais republiée,
//   même si on la modifie ensuite ; une entrée modifiée avant publication est rendue à nouveau ;
// - seules les entrées datées de moins de MAX_AGE_DAYS jours sont prises (pas de rattrapage de tout le journal) ;
// - une entrée sans titre, sans artiste ou auteur, ou sans note anglaise (note_en) n'est pas publiée ;
// - "instagram": false dans une entrée la tient à l'écart d'Instagram ;
// - les posts portent "channel": "coup-de-coeur" : le calendrier (lundi, mercredi, vendredi) ne les publie pas,
//   tools/publish-instagram.mjs --coup-de-coeur les publie, un par jour au plus.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE_FILE = join(ROOT, "social", "posts.json");
const MAX_AGE_DAYS = 14;
const VARIANT = Number(process.env.COUP_VARIANT || 1); // 1 bandeau, 2 on air, 3 pastille (voir tools/instagram.mjs)
const DRY = process.argv.includes("--dry-run");

const summary = (line) => {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n");
};

const { entries = [] } = JSON.parse(readFileSync(join(ROOT, "data", "decouvertes.json"), "utf8"));
const queueJson = JSON.parse(readFileSync(QUEUE_FILE, "utf8"));
const posts = queueJson.posts;
const today = new Date().toISOString().slice(0, 10);
const oldest = new Date(Date.now() - MAX_AGE_DAYS * 86400e3).toISOString().slice(0, 10);
const hash = (e) => createHash("sha1").update(JSON.stringify(e)).digest("hex").slice(0, 12);

const toRender = [];
for (const e of [...entries].sort((a, b) => (a.date || "").localeCompare(b.date || ""))) {
  const existing = posts.find((p) => p.kind === "decouverte" && p.decouverte === e.id);
  if (existing?.status === "published") continue;
  const problems = [];
  if (!e.id || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || "")) problems.push("id ou date manquants");
  if (!e.title) problems.push("titre manquant");
  if (!e.artist && !e.author) problems.push("artiste ou auteur manquant");
  if (!String(e.note_en || "").trim()) problems.push("note anglaise (note_en) manquante");
  if (e.instagram === false) problems.push("exclue d'Instagram (instagram: false)");
  if (e.date < oldest) problems.push(`datée du ${e.date}, plus de ${MAX_AGE_DAYS} jours`);
  if (e.date > today) problems.push(`datée du ${e.date}, dans le futur`);
  if (problems.length) {
    if (existing && existing.status !== "held") { existing.status = "held"; existing.held_reason = problems.join(" ; "); }
    if (e.date >= oldest) summary(`⏸️ « ${e.id} » n'est pas publiée : ${problems.join(" ; ")}.`);
    continue;
  }
  const h = hash(e);
  if (existing) {
    if (existing.source_hash === h && existing.status === "approved") continue;
    Object.assign(existing, { status: "approved", source_hash: h, variant: existing.variant || VARIANT });
    delete existing.held_reason;
    toRender.push(existing);
    summary(`✏️ Coup de cœur « ${e.id} » modifié avant publication : visuel et légende refaits (post n° ${existing.n}).`);
  } else {
    const n = Math.max(0, ...posts.map((p) => p.n)) + 1;
    const post = { n, slug: `coup-de-coeur-${e.id}`, kind: "decouverte", decouverte: e.id, channel: "coup-de-coeur", variant: VARIANT,
      status: "approved", not_before: e.date, source_hash: h,
      note: "Généré automatiquement depuis data/decouvertes.json ; publié sans validation (accord de Vovotte du 27/11/2026)." };
    posts.push(post);
    toRender.push(post);
    summary(`➕ Nouveau coup de cœur : « ${e.title} » (${e.artist || e.author}) → post n° ${n}.`);
  }
}

if (!toRender.length) summary("Aucun nouveau coup de cœur à préparer.");
if (!DRY && toRender.length) writeFileSync(QUEUE_FILE, JSON.stringify(queueJson, null, 2) + "\n");
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `render=${DRY ? "" : toRender.map((p) => p.n).join(" ")}\n`);
