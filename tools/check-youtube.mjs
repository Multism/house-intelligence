// Contrôle des vidéos YouTube du site (règle 6 : pas de vidéo inventée, et pas de vidéo morte).
// Interroge l'oEmbed public de YouTube pour chaque identifiant de data/tracks.json, data/digging.json et
// data/decouvertes.json. 200 = vidéo lisible et intégrable ; 401/403 = intégration désactivée ; 400/404 = supprimée ou privée.
// Usage : node tools/check-youtube.mjs [--json rapport.json] [--md rapport.md]
// Code de sortie : 0 si tout va bien, 1 si au moins une vidéo pose problème, 2 si YouTube est injoignable.
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const load = async (f) => JSON.parse(await readFile(new URL(f, root), "utf8"));
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

const [tr, dig, disc] = await Promise.all(["data/tracks.json", "data/digging.json", "data/decouvertes.json"].map(load));
const items = [
  ...tr.tracks.map((t) => ({ where: "tracks", id: t.id, name: `${t.artist} — ${t.title}`, yt: t.youtube || [] })),
  ...(dig.entries || []).map((e) => ({ where: "digging", id: e.id, name: `${e.artist} — ${e.title}`, yt: e.youtube || [] })),
  ...(disc.entries || disc.items || []).map((e) => ({ where: "decouvertes", id: e.id, name: `${e.artist || e.author || ""} — ${e.title}`, yt: e.youtube || [] })),
].filter((x) => x.yt.length);

async function check(vid) {
  const u = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + vid)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(u, { headers: { "user-agent": "house-intelligence-link-check" } });
      if (r.status === 200) { const j = await r.json(); return { status: "ok", title: j.title }; }
      if (r.status === 401 || r.status === 403) return { status: "no-embed" };
      if (r.status === 400 || r.status === 404) return { status: "gone" };
      if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 2000 * (attempt + 1))); continue; }
      return { status: "error", code: r.status };
    } catch (e) { if (attempt === 2) return { status: "error", code: e.message }; }
  }
  return { status: "error", code: "retries" };
}

const ids = [...new Set(items.flatMap((x) => x.yt))];
const res = new Map();
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < ids.length) { const v = ids[next++]; res.set(v, await check(v)); }
}));

const errors = ids.filter((v) => res.get(v).status === "error").length;
if (errors === ids.length) { console.error(`YouTube injoignable (${ids.length} requêtes en échec).`); process.exit(2); }

const report = items.map((x) => {
  const st = x.yt.map((v) => ({ v, ...res.get(v) }));
  const bad = st.filter((s) => s.status !== "ok");
  // Le lecteur passe à la vidéo suivante si la première échoue : une fiche n'est muette que si aucune ne marche.
  return { ...x, bad, silent: st.every((s) => s.status === "gone" || s.status === "no-embed") };
}).filter((x) => x.bad.length);

const label = { "no-embed": "intégration désactivée", gone: "supprimée ou privée", error: "erreur" };
const md = [
  `# Contrôle des vidéos YouTube`,
  ``,
  `${ids.length} vidéos vérifiées sur ${items.length} fiches. ${report.length ? `${report.reduce((n, x) => n + x.bad.length, 0)} posent problème, ${report.filter((x) => x.silent).length} fiche(s) sans aucune vidéo lisible.` : "Toutes sont lisibles."}`,
  ``,
  ...report.map((x) => `- ${x.silent ? "**muette** " : ""}\`${x.where}\` \`${x.id}\` (${x.name}) : ${x.bad.map((b) => `\`${b.v}\` ${label[b.status]}${b.code ? ` (${b.code})` : ""}`).join(", ")}`),
].join("\n");
console.log(md);
if (opt("--md")) await writeFile(opt("--md"), md + "\n");
if (opt("--json")) await writeFile(opt("--json"), JSON.stringify({ date: new Date().toISOString().slice(0, 10), checked: ids.length, report }, null, 2) + "\n");
process.exit(report.some((x) => x.bad.some((b) => b.status !== "error")) ? 1 : 0);
