// Générateur de carrousels Instagram (1080×1350, 4:5) à partir des données du site.
// Nécessite Playwright (comme tools/og-images.mjs).
//
//   node tools/instagram.mjs disque on-and-on       → un carrousel pour ce disque
//   node tools/instagram.mjs machine tr-909         → une machine
//   node tools/instagram.mjs station warehouse      → une station
//   node tools/instagram.mjs --next 4               → les 4 prochains disques pas encore publiés (ordre chronologique)
//   node tools/instagram.mjs --posted on-and-on     → marque un disque comme publié (social/posted.json)
//   node tools/instagram.mjs --queue [n]            → la file éditoriale social/queue.json (tout, ou le post nº n)
//   ajouter --lang en pour les textes anglais des fiches (la file est en anglais par défaut)
//
// Styles : couverture « fiche d'archive » (sombre, BPM en filigrane) pour les disques et les posts du site,
// « ligne de métro » (papier clair, tronçon du plan) pour les stations.
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

// ---------- langue ----------
const argv = process.argv.slice(2);
let LANG = argv.includes("--lang") ? argv[argv.indexOf("--lang") + 1] : "fr";
const f = (o, k) => (LANG === "en" && o?.[k + "_en"]) || o?.[k];
const LBL = {
  fr: { record: "Disque", why: "Pourquoi ce disque", how: "Comment il est fait", howK: "Machines & construction", ctx: "Le contexte", ctxK: "Sociologie du club",
    sheet: "Fiche technique", key: "Clé Camelot", energy: "Énergie", year: "Année", city: "Ville", full: "La fiche complète, les sources et les transitions compatibles :",
    machine: "Machine", made: "Ce qu'elle devait faire", madeT: "Prévue pour", hij: "Ce qu'on en a fait", hijT: "Le détournement", inH: "Dans la house", sig: "Sa signature",
    heard: "On l'entend sur", records: "disques", detail: "Le détail", know: "Le saviez-vous", listen: "Écoute-la au bon tempo dans The Booth :",
    station: "Station", map: "Le plan du métro de la house", story: "L'histoire", toListen: "À écouter", rec1: "disque", recN: "disques", whole: "Toute la station sur le plan :", line: "Ligne" },
  en: { record: "Record", why: "Why this record", how: "How it's made", howK: "Machines & construction", ctx: "The context", ctxK: "Club sociology",
    sheet: "Tech sheet", key: "Camelot key", energy: "Energy", year: "Year", city: "City", full: "Full record card, sources and compatible transitions:",
    machine: "Machine", made: "What it was built for", madeT: "Designed for", hij: "What people did with it", hijT: "The hijack", inH: "In house music", sig: "Its signature",
    heard: "You can hear it on", records: "records", detail: "The detail", know: "Did you know", listen: "Hear it at the right tempo in The Booth:",
    station: "Station", map: "The house music metro map", story: "The story", toListen: "Listen", rec1: "record", recN: "records", whole: "The whole station on the map:", line: "Line" },
};
const L = (k) => LBL[LANG]?.[k] ?? LBL.fr[k];

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
.swipe{color:var(--c)}
/* couverture « fiche d'archive » */
.ghost{position:absolute;right:64px;top:110px;font:700 340px/1 "JetBrains Mono",monospace;letter-spacing:-.04em;color:transparent;-webkit-text-stroke:2px color-mix(in srgb,var(--c) 38%,transparent)}
.cover{margin-top:auto}
.cover .k{display:flex;align-items:center;gap:18px}.cover .k:before{content:"";width:26px;height:26px;border-radius:50%;background:var(--c)}
.cover h1{margin:26px 0 20px}
.cover .a span{color:#efe9dd}
.hook{font:italic 400 50px/1.2 "Instrument Serif",serif;margin-top:44px;border-left:4px solid var(--c);padding-left:30px}
.badges{display:flex;flex-wrap:wrap;gap:14px;margin-top:52px}
.badge{border:2px solid #3a352f;border-radius:18px;padding:18px 22px 16px;min-width:170px}
.badge small{display:block;font:600 20px/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#948c7f}
.badge strong{display:block;font:700 42px/1.1 "JetBrains Mono",monospace;margin-top:10px;white-space:nowrap}
/* thème clair « ligne de métro » */
body.light{background:#f4efe4;color:#111}
body.light .glow{display:none}
body.light .a,body.light .cta,body.light .list span{color:#4a443b}
body.light .k{color:#111}
body.light .list li{border-color:#d9d1c2}
body.light .foot{color:#6b645a}body.light .foot b{color:#111}
body.light .cta b{color:#111;text-decoration:underline;text-decoration-color:var(--c);text-decoration-thickness:4px}
.metro{position:absolute;left:0;top:250px}
.roundel{display:flex;align-items:center;gap:20px;font:700 28px/1.15 "Space Grotesk",sans-serif;text-transform:uppercase;letter-spacing:.04em}
.roundel i{font-style:normal;width:72px;height:72px;border-radius:50%;background:var(--c);color:#111;font-size:36px;line-height:72px;text-align:center}
.roundel span{display:block;font-weight:500;color:#6b645a}`;

const slide = (color, n, total, inner, theme = "", ghost = "") => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@400;500;700&display=block" rel="stylesheet">
<style>${CSS}</style></head><body class="${theme}" style="--c:${color}"><div class="glow"></div><div class="bar"></div>${ghost ? `<div class="ghost">${esc(ghost)}</div>` : ""}
<div class="in">${inner}</div>
<div class="foot"><span>${n}/${total}${n < total ? ' <span class="swipe">→</span>' : ""}</span><b>HOUSE<span>/</span>INTELLIGENCE</b></div></body></html>`;

const textSlide = (kicker, title, text, extra = "") => `<div class="k">${esc(kicker)}</div><h2>${esc(title)}</h2><div class="fit"><p>${esc(text)}</p>${extra}</div>`;

// ---------- couvertures ----------
const coverA = ({ kicker, title, sub, hook, badges = [] }) => {
  const size = title.length > 30 ? 104 : title.length > 18 ? 128 : 160;
  return `<div class="cover"><div class="k">${esc(kicker)}</div><h1 style="font-size:${size}px">${esc(title)}</h1><div class="a">${sub}</div>
    ${hook ? `<div class="hook">${esc(hook)}</div>` : ""}
    <div class="badges">${badges.map(([k, v]) => `<div class="badge"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join("")}</div></div>`;
};
const SHORT = { loft: "The Loft", paradise: "Paradise Garage", soundsystem: "Sound Systems", charthouse: "Charts", hardcore: "Jungle", techhouse: "Tech House", soundsig: "Sound Signature", qweenbeat: "Qween Beat" };
const shortName = (sid) => SHORT[sid] || metro.stations[sid].name.replace(/ \(.*\)|, .*| \/.*/g, "");
function metroStrip(sid, line) {
  const all = line.stations, ci = all.indexOf(sid), W = 5;
  const a0 = Math.max(0, Math.min(ci - 2, all.length - W)), sts = all.slice(a0, a0 + W);
  const n = sts.length, x0 = 150, x1 = 930, y = 150;
  const xs = sts.map((_, i) => (n === 1 ? 540 : x0 + (i * (x1 - x0)) / (n - 1)));
  return `<svg class="metro" width="1080" height="300" viewBox="0 0 1080 300">
    <line x1="0" y1="${y}" x2="1080" y2="${y}" stroke="${line.color}" stroke-width="30"/>
    ${sts.map((s, i) => { const on = s === sid, up = i % 2 === 0;
      return `<circle cx="${xs[i]}" cy="${y}" r="${on ? 50 : 22}" fill="#f4efe4" stroke="#111" stroke-width="${on ? 13 : 9}"/>
      <text x="${xs[i]}" y="${up ? y - (on ? 80 : 50) : y + (on ? 112 : 82)}" text-anchor="middle" font-family="Space Grotesk" font-weight="${on ? 700 : 500}" font-size="${on ? 38 : 27}" fill="${on ? "#111" : "#6b645a"}">${esc(shortName(s))}</text>`; }).join("")}
  </svg>`;
}

// ---------- contenus ----------
function recordPost(t, q = {}) {
  const g = byGenre[t.genre], e = byEra[t.era], c = g?.color || "#d4ff3a";
  const gear = (t.gear || []).map((id) => byMachine[id]?.name || id).slice(0, 6);
  const kicker = `${f(e, "name") || ""} · ${f(g, "name") || ""}`;
  const city = (f(t, "city") || "").replace(/ \(.*\)/, "");
  const url = `${SITE_SHORT}/disques/${t.id}/`;
  const slides = [
    coverA({ kicker: f(g, "name") || "", title: t.title.replace(/ \(.*\)$/, ""), sub: `<span>${esc(t.artist)}</span> · ${t.year}`,
      hook: q.hook, badges: [["BPM", t.bpm], [LANG === "en" ? "Key" : "Clé", t.camelot_key], [L("energy"), `${t.energy}/10`], [L("city"), city]] }),
    textSlide(kicker, L("why"), f(t, "why_this_record")),
    textSlide(L("howK"), L("how"), f(t, "construction"), gear.length ? `<div class="chips">${gear.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""),
    textSlide(L("ctxK"), L("ctx"), f(t, "club_sociology")),
    `<div class="k">${L("sheet")}</div><h2>${esc(t.title)}</h2>
     <dl class="facts"><div><dt>BPM</dt><dd>${t.bpm}</dd></div><div><dt>${L("key")}</dt><dd>${esc(t.camelot_key)}</dd></div>
     <div><dt>${L("energy")}</dt><dd>${t.energy}/10</dd></div><div><dt>${L("year")}</dt><dd>${t.year}</dd></div></dl>
     <div class="cta">${L("full")}<b>${esc(url)}</b></div>`,
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
  return { type: "disques", id: t.id, color: c, slides, caption: q.caption || caption, ghost: [String(t.bpm)] };
}

function machinePost(m) {
  const c = "#d4ff3a";
  const url = `${SITE_SHORT}/#booth`;
  const used = (m.tracks || []).map((id) => byTrack[id]).filter(Boolean).slice(0, 6);
  const slides = [
    `<div class="k">${L("machine")} · ${m.year || ""}</div><h1 style="font-size:${m.name.length > 22 ? 112 : 140}px">${esc(m.name)}</h1><div class="a">${esc(m.maker || "")} · ${esc(f(m, "type") || "")}</div>`,
    textSlide(L("made"), L("madeT"), f(m, "intended_use")),
    textSlide(L("hij"), L("hijT"), f(m, "hijack")),
    textSlide(L("inH"), L("sig"), [f(m, "signature"), f(m, "house_usage")].filter(Boolean).join(" ")),
    used.length
      ? `<div class="k">${L("heard")}</div><h2>${used.length} ${L("records")}</h2><ul class="list">${used.map((t) => `<li>${esc(t.title)} — ${esc(t.artist)}<span>${t.year}</span></li>`).join("")}</ul><div class="cta">${L("listen")}<b>${esc(url)}</b></div>`
      : textSlide(L("detail"), L("know"), f(m, "trivia") || "", `<div class="cta">${L("listen")}<b>${esc(url)}</b></div>`),
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
    `${ls[0] ? `<div class="roundel"><i>${ls[0].num}</i><div>${L("line")} ${ls[0].num}<span>${esc(f(ls[0], "name"))}</span></div></div>${metroStrip(sid, ls[0])}` : ""}
     <div style="margin-top:auto"><div class="k">${L("station")} · ${esc(s.years)}</div><h1 style="font-size:${s.name.length > 22 ? 112 : 140}px;font-family:'Space Grotesk';font-weight:700;letter-spacing:-.035em">${esc(f(s, "name"))}</h1>
     <div class="a">${ls.map((l) => `L${l.num} ${esc(f(l, "name"))}`).join(" · ")}</div></div>`,
    textSlide(L("map"), L("story"), f(s, "summary")),
    `<div class="k">${L("toListen")}</div><h2>${recs.length} ${recs.length > 1 ? L("recN") : L("rec1")}</h2><ul class="list">${recs.slice(0, 7).map((t) => `<li>${esc(t.title)} — ${esc(t.artist)}<span>${t.year}</span></li>`).join("")}</ul>
     <div class="cta">${L("whole")}<b>${esc(url)}</b></div>`,
  ];
  const caption = [`${s.name} (${s.years})`, "", s.summary, "", recs.length ? `À écouter : ${recs.slice(0, 5).map((t) => `${t.title} (${t.artist}, ${t.year})`).join(" · ")}` : "", "",
    `La station sur le plan du métro de la house : lien en bio (${url})`, "", [tag(s.name), ...BASE_TAGS].join(" ")].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  return { type: "stations", id: sid, color: c, slides, caption, theme: "light" };
}

// Post « site » (présentation, fonction de The Booth…) : une seule image, couverture fiche d'archive.
function featurePost(q) {
  return { type: "site", id: q.slug, color: q.color || "#d4ff3a", ghost: q.ghost ? [q.ghost] : [],
    slides: [coverA({ kicker: q.kicker, title: q.title, sub: esc(q.sub || ""), hook: q.hook, badges: q.badges || [] })], caption: q.caption };
}

// File éditoriale (social/queue.json) : textes validés à la main, prioritaires sur ceux générés.
function queuePost(q) {
  const caption = [q.caption, "", (q.hashtags || []).join(" ")].join("\n").trim();
  if (q.kind === "feature") return { ...featurePost(q), caption };
  if (q.kind === "track") return recordPost(byTrack[q.track], { hook: q.hook, caption });
  if (q.kind === "station") return { ...stationPost(q.station), caption };
  throw new Error(`Type inconnu dans la file : ${q.kind}`);
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
      await page.setContent(slide(p.color, i + 1, p.slides.length, p.slides[i], p.theme, i === 0 ? p.ghost?.[0] : ""), { waitUntil: "networkidle" });
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
const [cmd, arg] = argv.filter((a, i) => a !== "--lang" && argv[i - 1] !== "--lang");
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
} else if (cmd === "--queue") {
  const queue = JSON.parse(readFileSync(join(ROOT, "social", "queue.json"), "utf8"));
  if (!argv.includes("--lang")) LANG = queue._meta?.lang || "en";
  const sel = queue.posts.filter((q) => !arg || String(q.n) === arg);
  await render(sel.map((q) => ({ ...queuePost(q), id: `${String(q.n).padStart(2, "0")}-${q.slug}`, type: "file" })));
} else if (cmd === "disque" && byTrack[arg]) await render([recordPost(byTrack[arg])]);
else if (cmd === "machine" && byMachine[arg]) await render([machinePost(byMachine[arg])]);
else if (cmd === "station" && metro.stations[arg]) await render([stationPost(arg)]);
else {
  console.log("Usage : node tools/instagram.mjs disque <id> | machine <id> | station <id> | --next <n> | --posted <id> | --queue [n]  [--lang en]");
  process.exit(1);
}
