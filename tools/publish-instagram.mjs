// Publication Instagram automatique (API Graph de Meta, Instagram API « connexion unifiée », jeton d'utilisateur système).
// Lancé par .github/workflows/instagram.yml ; utilisable aussi à la main.
//
//   node tools/publish-instagram.mjs --check     → vérifie le jeton et le compte, ne publie rien
//   node tools/publish-instagram.mjs --dry-run   → montre ce qui serait publié, ne publie rien
//   node tools/publish-instagram.mjs             → publie le prochain post « approved » de social/posts.json
//   node tools/publish-instagram.mjs --refresh   → renouvelle le jeton (60 jours) et l'écrit dans social/.token-refreshed
//
// Règles :
// - seul un post au statut "approved" est publié (validation humaine), un seul par lancement, dans l'ordre de n ;
//   un champ facultatif "not_before": "AAAA-MM-JJ" le retient jusqu'à cette date ;
// - les images sont celles de social/media/<nn>-<slug>/01.jpg, 02.jpg… (rendues par `node tools/instagram.mjs media <n>`),
//   servies en https depuis le dépôt public (raw.githubusercontent.com) ; la légende est social/media/<nn>-<slug>/caption.txt ;
// - après publication, le post passe en "published" avec la date, l'identifiant et le lien Instagram.
//
// Secrets (jamais dans le dépôt, uniquement en secrets GitHub ou variables d'environnement) :
//   IG_USER_ID       identifiant du compte Instagram professionnel (nombre de ~17 chiffres)
//   IG_ACCESS_TOKEN  jeton d'utilisateur système (SUAT) de l'app Meta « HOUSE INTEL PUBLISHER » : n'expire pas
// Facultatif : MEDIA_BASE_URL (défaut : la branche main du dépôt public sur raw.githubusercontent.com, en ligne dès la
// fusion, sans attendre un déploiement du site), GRAPH_VERSION (défaut v23.0),
// GRAPH_HOST (défaut graph.facebook.com ; graph.instagram.com pour un jeton « Instagram Login », qui dure 60 jours
// et se prolonge avec --refresh).
//
// Limite de l'API : la musique Instagram ne peut pas être ajoutée à un post publié ainsi.

import { readFileSync, writeFileSync, readdirSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE_FILE = join(ROOT, "social", "posts.json");
const SITE = (process.env.MEDIA_BASE_URL || process.env.SITE_URL || "https://raw.githubusercontent.com/Multism/house-intelligence/main").replace(/\/$/, "");
// Jeton « Instagram Login » (commence par IG…) → graph.instagram.com ; jeton Facebook (EAA…) → graph.facebook.com.
const HOST = process.env.GRAPH_HOST || ((process.env.IG_ACCESS_TOKEN || "").trim().startsWith("IG") ? "graph.instagram.com" : "graph.facebook.com");
const GRAPH = `https://${HOST}/${process.env.GRAPH_VERSION || "v23.0"}`;
const IG = (process.env.IG_USER_ID || "").trim();
const TOKEN = (process.env.IG_ACCESS_TOKEN || "").trim();
const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const REFRESH = args.includes("--refresh");
const DRY = args.includes("--dry-run") || process.env.DRY_RUN === "true";

const summary = (line) => {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n");
};
const fail = (msg) => {
  summary(`❌ ${msg}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function graph(method, path, params = {}) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const url = method === "GET" ? `${GRAPH}/${path}?${body}` : `${GRAPH}/${path}`;
  const res = await fetch(url, method === "GET" ? {} : { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(`API Meta (${path.split("?")[0]}) : ${e.message || res.status}${e.code ? ` [code ${e.code}${e.error_subcode ? "/" + e.error_subcode : ""}]` : ""}`);
  }
  return json;
}

function nextPost(posts) {
  const today = new Date().toISOString().slice(0, 10);
  return posts
    .filter((p) => p.status === "approved" && (!p.not_before || p.not_before <= today))
    .sort((a, b) => a.n - b.n)[0];
}

const folderOf = (post) => `${String(post.n).padStart(2, "0")}-${post.slug}`;

function mediaOf(post) {
  const folder = folderOf(post);
  const dir = join(ROOT, "social", "media", folder);
  if (!existsSync(dir)) fail(`Images absentes : social/media/${folder}/ (lancer « node tools/instagram.mjs media ${post.n} »).`);
  const images = readdirSync(dir).filter((f) => /^\d+\.jpg$/.test(f)).sort();
  if (!images.length || images.length > 10) fail(`social/media/${folder}/ doit contenir de 1 à 10 images JPEG (trouvé ${images.length}).`);
  const capFile = join(dir, "caption.txt");
  const caption = existsSync(capFile) ? readFileSync(capFile, "utf8").trim() : "";
  if (!caption) fail(`Légende absente : social/media/${folder}/caption.txt`);
  if (caption.length > 2200) fail(`Légende trop longue (${caption.length} caractères, 2200 au plus).`);
  if ((caption.match(/#[\p{L}\p{N}_]+/gu) || []).length > 30) fail("Plus de 30 hashtags : Instagram refuserait le post.");
  return { urls: images.map((f) => `${SITE}/social/media/${folder}/${f}`), caption };
}

async function assertOnline(urls) {
  for (const u of urls) {
    const res = await fetch(u, { method: "HEAD" });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("jpeg")) fail(`Image pas encore en ligne : ${u} (HTTP ${res.status}, ${type || "sans type"}). Le post est-il bien fusionné sur main ?`);
  }
}

async function waitReady(id) {
  for (let i = 0; i < 30; i++) {
    const { status_code } = await graph("GET", id, { fields: "status_code" });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`Conteneur ${id} : ${status_code}`);
    await sleep(5000);
  }
  throw new Error(`Conteneur ${id} toujours pas prêt après 2 min 30.`);
}

// ---------------------------------------------------------------------------
if (REFRESH) {
  // Un jeton Instagram dure 60 jours ; on le prolonge à chaque passage. Le nouveau jeton est écrit dans un fichier
  // non versionné que le workflow enregistre comme secret GitHub, puis supprime.
  if (!TOKEN) fail("Secret IG_ACCESS_TOKEN manquant.");
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(TOKEN)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) fail(`Renouvellement du jeton impossible : ${j.error?.message || r.status}. Il faut en générer un nouveau dans l'app Meta.`);
  writeFileSync(join(ROOT, "social", ".token-refreshed"), j.access_token, { mode: 0o600 });
  summary(`🔑 Jeton renouvelé, valable ${Math.round((j.expires_in || 0) / 86400)} jours.`);
  process.exit(0);
}

const queueJson = JSON.parse(readFileSync(QUEUE_FILE, "utf8"));
const post = nextPost(queueJson.posts);

if (!CHECK && !post) {
  summary("Aucun post au statut « approved » à publier aujourd'hui. Rien n'a été publié.");
  process.exit(0);
}

if (!DRY || CHECK) {
  if (!IG || !TOKEN) fail("Secrets IG_USER_ID et IG_ACCESS_TOKEN manquants (Settings → Secrets and variables → Actions).");
  const me = await graph("GET", IG, { fields: "username,media_count" }).catch((e) => fail(e.message));
  summary(`Compte Instagram : @${me.username} (${me.media_count} publications).`);
  const lim = await graph("GET", `${IG}/content_publishing_limit`, { fields: "quota_usage,config" }).catch(() => null);
  if (lim?.data?.[0]) summary(`Quota de publication sur 24 h : ${lim.data[0].quota_usage}/${lim.data[0].config?.quota_total ?? 100}.`);
  if (CHECK) {
    summary(post ? `Prochain post approuvé : n° ${post.n} « ${post.slug} ».` : "Aucun post approuvé dans la file pour l'instant.");
    process.exit(0);
  }
}

const { urls, caption } = mediaOf(post);
await assertOnline(urls);

if (DRY) {
  summary(`🧪 Essai à blanc : le post n° ${post.n} « ${post.slug} » serait publié (${urls.length} image${urls.length > 1 ? "s" : ""}).`);
  urls.forEach((u) => summary(`- ${u}`));
  summary("\n```\n" + caption + "\n```");
  process.exit(0);
}

// Garde-fou contre une double publication (si un lancement précédent a publié sans pouvoir enregistrer le statut).
const recent = await graph("GET", `${IG}/media`, { fields: "caption,permalink,timestamp", limit: "10" });
const head = caption.slice(0, 80);
const already = (recent.data || []).find((m) => (m.caption || "").slice(0, 80) === head);

let permalink, mediaId;
if (already) {
  summary(`Ce post est déjà sur Instagram (${already.permalink}) : pas de nouvelle publication, statut mis à jour.`);
  ({ permalink, id: mediaId } = already);
} else {
  try {
    let creation;
    if (urls.length === 1) {
      creation = (await graph("POST", `${IG}/media`, { image_url: urls[0], caption })).id;
    } else {
      const children = [];
      for (const image_url of urls) children.push((await graph("POST", `${IG}/media`, { image_url, is_carousel_item: "true" })).id);
      for (const c of children) await waitReady(c);
      creation = (await graph("POST", `${IG}/media`, { media_type: "CAROUSEL", children: children.join(","), caption })).id;
    }
    await waitReady(creation);
    mediaId = (await graph("POST", `${IG}/media_publish`, { creation_id: creation })).id;
    permalink = (await graph("GET", mediaId, { fields: "permalink" })).permalink;
  } catch (e) {
    fail(`Publication du post n° ${post.n} « ${post.slug} » échouée. ${e.message}`);
  }
  summary(`✅ Publié : post n° ${post.n} « ${post.slug} » (${urls.length} image${urls.length > 1 ? "s" : ""}) → ${permalink}`);
}

Object.assign(post, { status: "published", published_at: new Date().toISOString(), ig_media_id: mediaId, permalink });
writeFileSync(QUEUE_FILE, JSON.stringify(queueJson, null, 2) + "\n");
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `slug=${post.slug}\n`);
