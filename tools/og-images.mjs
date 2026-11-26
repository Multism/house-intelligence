// Génère une image de partage 1200×630 par disque et par station : og/disques/<id>.jpg, og/stations/<id>.jpg
// Nécessite Playwright (npm i -D playwright && npx playwright install chromium), une seule fois.
//   node tools/og-images.mjs            → génère les images manquantes
//   node tools/og-images.mjs --all      → régénère tout
// Puis relancer node tools/build-pages.mjs pour que les pages pointent vers leurs images.

import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
// require() plutôt qu'import : marche aussi avec un Playwright installé globalement (NODE_PATH).
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(readFileSync(join(ROOT, "data", f + ".json"), "utf8"));
const { tracks, genres, eras } = read("tracks");
const metro = read("metro");
const all = process.argv.includes("--all");

const byGenre = Object.fromEntries(genres.map((g) => [g.id, g]));
const byEra = Object.fromEntries(eras.map((e) => [e.id, e]));
const stationLines = {};
for (const l of metro.lines) for (const sid of l.stations) (stationLines[sid] ||= []).push(l);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const shell = (color, inner) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@500;700&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box}html,body{margin:0}
body{width:1200px;height:630px;background:#0d0c0b;color:#efe9dd;font-family:"Space Grotesk",sans-serif;position:relative;overflow:hidden;
background-image:radial-gradient(900px 520px at 85% -120px, ${color}33, transparent 70%)}
.bar{position:absolute;left:0;top:0;bottom:0;width:18px;background:${color}}
.in{position:absolute;left:84px;right:84px;top:70px;bottom:64px;display:flex;flex-direction:column}
.k{font:600 22px/1.2 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:${color}}
h1{font:400 112px/0.95 "Instrument Serif",serif;margin:26px 0 18px;max-width:1000px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.a{font:500 40px/1.2 "Space Grotesk",sans-serif;color:#b4ab9c}
.f{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;font:400 24px/1 "JetBrains Mono",monospace;color:#948c7f}
.f b{font:700 28px/1 "JetBrains Mono",monospace;color:#efe9dd;letter-spacing:.04em}.f b span{color:#ff6b35}
.lines{display:flex;gap:10px;margin-top:8px}.lines i{display:block;width:44px;height:10px;border-radius:5px}
</style></head><body><div class="bar"></div><div class="in">${inner}</div></body></html>`;

function recordHtml(t) {
  const g = byGenre[t.genre], e = byEra[t.era], c = g?.color || "#d4ff3a";
  const size = t.title.length > 28 ? 84 : 112;
  return shell(c, `<div class="k">${esc(e?.name || "")} · ${esc(g?.name || "")}</div>
<h1 style="font-size:${size}px">${esc(t.title)}</h1><div class="a">${esc(t.artist)} · ${t.year}</div>
<div class="f"><span>${t.bpm} BPM · ${esc(t.camelot_key)} · ${esc(t.label || "")}</span><b>HOUSE<span>/</span>INTELLIGENCE</b></div>`);
}
function stationHtml(sid) {
  const s = metro.stations[sid], ls = stationLines[sid] || [], c = ls[0]?.color || "#d4ff3a";
  const size = s.name.length > 24 ? 92 : 112;
  return shell(c, `<div class="k">Station · ${esc(s.years)}</div>
<h1 style="font-size:${size}px">${esc(s.name)}</h1><div class="a">${ls.map((l) => `L${l.num} ${esc(l.name)}`).join(" · ")}</div>
<div class="lines">${ls.map((l) => `<i style="background:${l.color}"></i>`).join("")}</div>
<div class="f"><span>Plan généalogique de la house</span><b>HOUSE<span>/</span>INTELLIGENCE</b></div>`);
}

const jobs = [
  ...tracks.map((t) => ({ file: join(ROOT, "og", "disques", t.id + ".jpg"), html: () => recordHtml(t) })),
  ...Object.keys(metro.stations).map((sid) => ({ file: join(ROOT, "og", "stations", sid + ".jpg"), html: () => stationHtml(sid) })),
].filter((j) => all || !existsSync(j.file));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const j of jobs) {
  mkdirSync(dirname(j.file), { recursive: true });
  await page.setContent(j.html(), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: j.file, type: "jpeg", quality: 86 });
}
await browser.close();
console.log(`${jobs.length} image(s) générée(s) dans og/.`);
