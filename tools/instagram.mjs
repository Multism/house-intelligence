// Générateur de carrousels Instagram (1080×1350, 4:5) à partir des données du site.
// Nécessite Playwright (comme tools/og-images.mjs).
//
//   node tools/instagram.mjs disque on-and-on       → un carrousel pour ce disque
//   node tools/instagram.mjs machine tr-909         → une machine
//   node tools/instagram.mjs station warehouse      → une station
//   node tools/instagram.mjs --next 4               → les 4 prochains disques pas encore publiés (ordre chronologique)
//   node tools/instagram.mjs --posted on-and-on     → marque un disque comme publié (social/posted.json)
//
// Sortie : social/<type>/<id>/01.jpg … 05.jpg + caption.txt (légende prête à coller, avec hashtags).
// Le dossier social/<type>/ n'est pas versionné ; social/posted.json l'est (journal de publication).

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const SITE = "https://house-intelligence.pages.dev";
const SITE_SHORT = SITE.replace(/^https:\/\//, "");
const HANDLE = "@house.intelligence.archive";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(readFileSync(join(ROOT, "data", f + ".json"), "utf8"));
const { tracks, genres, eras } = read("tracks");
const { machines } = read("machines");
const metro = read("metro");
const byTrack = Object.fromEntries(tracks.map((t) => [t.id, t]));
const byGenre = Object.fromEntries(genres.map((g) => [g.id, g]));
const byEra = Object.fromEntries(eras.map((e) => [e.id, e]));
const byMachine = Object.fromEntries(machines.map((m) => [m.id, m]));
const stationLines = {};
for (const l of metro.lines) for (const sid of l.stations) (stationLines[sid] ||= []).push(l);

const POSTED = join(ROOT, "social", "posted.json");
const posted = existsSync(POSTED) ? JSON.parse(readFileSync(POSTED, "utf8")) : [];
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tag = (s) => "#" + String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
const BASE_TAGS = ["#housemusic", "#househistory", "#vinyl", "#dj", "#clubculture", "#musichistory"];

// ---------- gabarit de slide ----------
// Chaque slide : fond sombre, barre de couleur, pagination n/N, signature. Le texte long est réduit
// automatiquement (taille de police) jusqu'à tenir dans la zone.
const CSS = `
*{box-sizing:border-box}html,body{margin:0}
body{width:1080px;height:1350px;background:#0d0c0b;color:#efe9dd;font-family:"Space Grotesk",sans-serif;position:relative;overflow:hidden}
.glow{position:absolute;inset:0;background:radial-gradient(900px 700px at 90% -10%, var(--c) , transparent 65%);opacity:.22}
.bar{position:absolute;left:0;top:0;bottom:0;width:20px;background:var(--c)}
.in{position:absolute;left:96px;right:88px;top:96px;bottom:150px;display:flex;flex-direction:column}
.k{font:600 26px/1.3 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--c)}
h1{font:400 150px/.95 "Instrument Serif",serif;margin:40px 0 28px}
h2{font:400 84px/1 "Instrument Serif",serif;margin:28px 0 36px}
.a{font:500 50px/1.2 "Space Grotesk",sans-serif;color:#b4ab9c}
.fit{flex:1;min-height:0;overflow:hidden}
.fit p{margin:0;font:400 44px/1.38 "Space Grotesk",sans-serif}
.chips{display:flex;flex-wrap:wrap;gap:14px;margin-top:36px}
.chip{font:500 30px/1 "Space Grotesk",sans-serif;border:2px solid var(--c);border-radius:99px;padding:14px 24px}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:#2e2a26;border:2px solid #2e2a26;border-radius:22px;overflow:hidden;margin-top:12px}
.facts div{background:#161412;padding:26px 30px}
.facts dt{font:600 22px/1.2 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#948c7f}
.facts dd{margin:8px 0 0;font:500 44px/1.15 "Space Grotesk",sans-serif}
.cta{margin-top:auto;font:500 40px/1.3 "Space Grotesk",sans-serif}
.cta b{display:block;color:var(--c);font:600 30px/1.4 "JetBrains Mono",monospace;margin-top:12px;word-break:break-all}
.list{list-style:none;padding:0;margin:0}.list li{font:400 38px/1.3 "Space Grotesk",sans-serif;padding:16px 0;border-bottom:2px solid #2e2a26}
.list span{color:#948c7f;font:400 28px "JetBrains Mono",monospace;margin-left:14px}
.foot{position:absolute;left:96px;right:88px;bottom:64px;display:flex;justify-content:space-between;align-items:baseline;font:400 26px/1 "JetBrains Mono",monospace;color:#948c7f}
.foot b{font:700 30px/1 "JetBrains Mono",monospace;color:#efe9dd;letter-spacing:.04em}.foot b span{color:#ff6b35}
.swipe{color:var(--c)}`;

const slide = (color, n, total, inner) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@400;500;700&display=block" rel="stylesheet">
<style>${CSS}</style></head><body style="--c:${color}"><div class="glow"></div><div class="bar"></div>
<div class="in">${inner}</div>
<div class="foot"><span>${n}/${total}${n < total ? ' <span class="swipe">→</span>' : ""}</span><b>HOUSE<span>/</span>INTELLIGENCE</b></div></body></html>`;

const textSlide = (kicker, title, text, extra = "") => `<div class="k">${esc(kicker)}</div><h2>${esc(title)}</h2><div class="fit"><p>${esc(text)}</p>${extra}</div>`;

// ---------- contenus ----------
function recordPost(t) {
  const g = byGenre[t.genre], e = byEra[t.era], c = g?.color || "#d4ff3a";
  const gear = (t.gear || []).map((id) => byMachine[id]?.name || id).slice(0, 6);
  const kicker = `${e?.name || ""} · ${g?.name || ""}`;
  const url = `${SITE_SHORT}/disques/${t.id}/`;
  const slides = [
    `<div class="k">Disque · ${t.year}</div><h1 style="font-size:${t.title.length > 30 ? 104 : t.title.length > 18 ? 128 : 150}px">${esc(t.title)}</h1><div class="a">${esc(t.artist)}</div>
     <div class="cta" style="color:#b4ab9c">${esc(t.label || "")} · ${esc(t.city || "")}<br>${esc(kicker)}</div>`,
    textSlide(kicker, "Pourquoi ce disque", t.why_this_record),
    textSlide("Machines & construction", "Comment il est fait", t.construction, gear.length ? `<div class="chips">${gear.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""),
    textSlide("Sociologie du club", "Le contexte", t.club_sociology),
    `<div class="k">Fiche technique</div><h2>${esc(t.title)}</h2>
     <dl class="facts"><div><dt>BPM</dt><dd>${t.bpm}</dd></div><div><dt>Clé Camelot</dt><dd>${esc(t.camelot_key)}</dd></div>
     <div><dt>Énergie</dt><dd>${t.energy}/10</dd></div><div><dt>Année</dt><dd>${t.year}</dd></div></dl>
     <div class="cta">La fiche complète, les sources et les transitions compatibles :<b>${esc(url)}</b></div>`,
  ];
  const caption = [
    `${t.title} — ${t.artist} (${t.year})`,
    "",
    t.why_this_record,
    "",
    `${t.bpm} BPM · ${t.camelot_key} · ${t.label || ""} · ${t.city || ""}`,
    gear.length ? `Machines : ${gear.join(", ")}` : "",
    "",
    `Fiche complète, sources et transitions : lien en bio (${url})`,
    "",
    [...new Set([...(g ? [tag(g.name)] : []), tag(t.city || ""), ...BASE_TAGS, ...(t.gear || []).filter((id) => byMachine[id]).map((id) => tag(id))])].filter((x) => x.length > 2).join(" "),
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  return { type: "disques", id: t.id, color: c, slides, caption };
}

function machinePost(m) {
  const c = "#d4ff3a";
  const url = `${SITE_SHORT}/#booth`;
  const used = (m.tracks || []).map((id) => byTrack[id]).filter(Boolean).slice(0, 6);
  const slides = [
    `<div class="k">Machine · ${m.year || ""}</div><h1 style="font-size:${m.name.length > 22 ? 112 : 140}px">${esc(m.name)}</h1><div class="a">${esc(m.maker || "")} · ${esc(m.type || "")}</div>`,
    textSlide("Ce qu'elle devait faire", "Prévue pour", m.intended_use),
    textSlide("Ce qu'on en a fait", "Le détournement", m.hijack),
    textSlide("Dans la house", "Sa signature", [m.signature, m.house_usage].filter(Boolean).join(" ")),
    used.length
      ? `<div class="k">On l'entend sur</div><h2>${used.length} disques</h2><ul class="list">${used.map((t) => `<li>${esc(t.title)} — ${esc(t.artist)}<span>${t.year}</span></li>`).join("")}</ul><div class="cta">Écoute-la au bon tempo dans The Booth :<b>${esc(url)}</b></div>`
      : textSlide("Le détail", "Le saviez-vous", m.trivia || "", `<div class="cta">Écoute-la au bon tempo dans The Booth :<b>${esc(url)}</b></div>`),
  ];
  const caption = [`${m.name} (${m.year || ""})`, "", m.hijack, "", m.trivia || "", "", `À écouter dans The Booth : lien en bio (${url})`, "",
    [tag(m.id), tag(m.maker || ""), "#drummachine", "#synth", ...BASE_TAGS].filter((x) => x.length > 2).join(" ")].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  return { type: "machines", id: m.id, color: c, slides, caption };
}

function stationPost(sid) {
  const s = metro.stations[sid], ls = stationLines[sid] || [], c = ls[0]?.color || "#d4ff3a";
  const recs = [...new Set([...(s.tracks || []), ...tracks.filter((t) => (s.genres || []).includes(t.genre)).map((t) => t.id)])].map((id) => byTrack[id]).filter(Boolean).sort((a, b) => a.year - b.year);
  const url = `${SITE_SHORT}/stations/${sid}/`;
  const slides = [
    `<div class="k">Station · ${esc(s.years)}</div><h1 style="font-size:${s.name.length > 22 ? 112 : 140}px">${esc(s.name)}</h1><div class="a">${ls.map((l) => `L${l.num} ${esc(l.name)}`).join(" · ")}</div>`,
    textSlide("Le plan du métro de la house", "L'histoire", s.summary),
    `<div class="k">À écouter</div><h2>${recs.length} disque${recs.length > 1 ? "s" : ""}</h2><ul class="list">${recs.slice(0, 7).map((t) => `<li>${esc(t.title)} — ${esc(t.artist)}<span>${t.year}</span></li>`).join("")}</ul>
     <div class="cta">Toute la station sur le plan :<b>${esc(url)}</b></div>`,
  ];
  const caption = [`${s.name} (${s.years})`, "", s.summary, "", recs.length ? `À écouter : ${recs.slice(0, 5).map((t) => `${t.title} (${t.artist}, ${t.year})`).join(" · ")}` : "", "",
    `La station sur le plan du métro de la house : lien en bio (${url})`, "", [tag(s.name), ...BASE_TAGS].join(" ")].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  return { type: "stations", id: sid, color: c, slides, caption };
}

// ---------- rendu ----------
async function render(posts) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  for (const p of posts) {
    const dir = join(ROOT, "social", p.type, p.id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < p.slides.length; i++) {
      await page.setContent(slide(p.color, i + 1, p.slides.length, p.slides[i]), { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const box of document.querySelectorAll(".fit")) {
          const ps = box.querySelectorAll("p");
          let size = 44;
          while (box.scrollHeight > box.clientHeight && size > 26) { size -= 2; ps.forEach((p) => (p.style.fontSize = size + "px")); }
        }
      });
      await page.screenshot({ path: join(dir, String(i + 1).padStart(2, "0") + ".jpg"), type: "jpeg", quality: 90 });
    }
    writeFileSync(join(dir, "caption.txt"), p.caption + "\n");
    console.log(`social/${p.type}/${p.id}/ : ${p.slides.length} slides + caption.txt`);
  }
  await browser.close();
}

// ---------- ligne de commande ----------
const [cmd, arg] = process.argv.slice(2);
if (cmd === "--posted") {
  if (!byTrack[arg]) throw new Error(`Disque inconnu : ${arg}`);
  if (!posted.some((p) => p.id === arg)) posted.push({ id: arg, date: new Date().toISOString().slice(0, 10) });
  mkdirSync(dirname(POSTED), { recursive: true });
  writeFileSync(POSTED, JSON.stringify(posted, null, 2) + "\n");
  console.log(`${arg} marqué comme publié (${posted.length} au total).`);
} else if (cmd === "--next") {
  const done = new Set(posted.map((p) => p.id));
  const next = [...tracks].sort((a, b) => a.year - b.year).filter((t) => !done.has(t.id)).slice(0, Number(arg) || 1);
  await render(next.map(recordPost));
} else if (cmd === "disque" && byTrack[arg]) await render([recordPost(byTrack[arg])]);
else if (cmd === "machine" && byMachine[arg]) await render([machinePost(byMachine[arg])]);
else if (cmd === "station" && metro.stations[arg]) await render([stationPost(arg)]);
else {
  console.log("Usage : node tools/instagram.mjs disque <id> | machine <id> | station <id> | --next <n> | --posted <id>");
  process.exit(1);
}
