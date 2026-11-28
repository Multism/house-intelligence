// Générateur de carrousels Instagram (1080×1350, 4:5) à partir des données du site.
// Nécessite Playwright (comme tools/og-images.mjs). Le compte est en anglais : textes en anglais par défaut,
// --fr pour une version française.
//
//   node tools/instagram.mjs post 2                 → le post n° 2 de la file social/posts.json (ou son slug)
//   node tools/instagram.mjs --queue                → tous les posts de la file encore en draft ou approved
//   node tools/instagram.mjs disque on-and-on       → un disque hors file (accroche et légende générées)
//   node tools/instagram.mjs machine tr-909         → une machine
//   node tools/instagram.mjs station warehouse      → une station (style B, ligne de métro)
//   node tools/instagram.mjs ligne L7               → une ligne de métro entière (style B)
//   node tools/instagram.mjs decouverte <id>        → une entrée « En ce moment » (data/decouvertes.json), --variant=1|2|3|all
//   node tools/instagram.mjs --next 4               → les 4 prochains disques ni dans la file ni publiés
//   node tools/instagram.mjs --posted on-and-on     → marque un disque comme publié (social/posted.json)
//   node tools/instagram.mjs media 3                → rend le post n° 3 dans social/media/<slug>/ (versionné, servi en https
//                                                     par Cloudflare Pages) : c'est ce que publie tools/publish-instagram.mjs
//
// social/posts.json est la file éditoriale (accroches, légendes et hashtags écrits à la main, statut).
// Quand un disque y figure, son accroche, sa légende et ses hashtags remplacent le texte généré.
// Types de post (champ kind) : "track" et "feature" (présentation, tempos de The Booth…) en style A, fiche d'archive sombre ;
// "machine" (champ machine, ex. "tr-909") en style A aussi ; "station" (champ station) et "line" (champ line, ex. "L7") en style B, ligne de métro sur papier clair.
//
// Sortie : social/out/<nn>-<slug>/01.jpg … + caption.txt (légende + hashtags, prête à coller).

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const SITE_SHORT = "house-intelligence.pages.dev";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(readFileSync(join(ROOT, "data", f + ".json"), "utf8"));
const { tracks, genres, eras } = read("tracks");
const { machines } = read("machines");
const metro = read("metro");
const DISC = existsSync(join(ROOT, "data", "decouvertes.json")) ? read("decouvertes").entries || [] : [];
const byDisc = Object.fromEntries(DISC.map((e) => [e.id, e]));
const byTrack = Object.fromEntries(tracks.map((t) => [t.id, t]));
const byGenre = Object.fromEntries(genres.map((g) => [g.id, g]));
const byEra = Object.fromEntries(eras.map((e) => [e.id, e]));
const byMachine = Object.fromEntries(machines.map((m) => [m.id, m]));
const stationLines = {};
for (const l of metro.lines) for (const sid of l.stations) (stationLines[sid] ||= []).push(l);

const QUEUE_FILE = join(ROOT, "social", "posts.json");
const queue = existsSync(QUEUE_FILE) ? JSON.parse(readFileSync(QUEUE_FILE, "utf8")).posts : [];
const POSTED = join(ROOT, "social", "posted.json");
const posted = existsSync(POSTED) ? JSON.parse(readFileSync(POSTED, "utf8")) : [];

const args = process.argv.slice(2);
const FR = args.includes("--fr");
const lang = FR ? "fr" : "en";
const f = (obj, field) => (obj == null ? "" : !FR && obj[field + "_en"] != null ? obj[field + "_en"] : obj[field] ?? "");
const W = FR
  ? { record: "Disque", why: "Pourquoi ce disque", built: "Comment il est fait", gearK: "Machines & construction", club: "Le contexte", clubK: "Sociologie du club",
      specs: "Fiche technique", key: "Clé", energy: "Énergie", year: "Année", city: "Ville", more: "La fiche complète, les sources et les transitions compatibles :",
      machine: "Machine", built4: "Prévue pour", built4K: "Ce qu'elle devait faire", hijack: "Le détournement", hijackK: "Ce qu'on en a fait", sig: "Sa signature", sigK: "Dans la house",
      heard: "On l'entend sur", records: (n) => `${n} disque${n > 1 ? "s" : ""}`, booth: "Écoute-la au bon tempo dans The Booth :", trivia: "Le saviez-vous", station: "Station",
      story: "L'histoire", storyK: "Le plan du métro de la house", listen: "À écouter", onMap: "Toute la station sur le plan :", linkBio: "lien en bio", tryIt: "À essayer sur" }
  : { record: "Record", why: "Why this record", built: "How it was made", gearK: "Machines & construction", club: "The club", clubK: "Club sociology",
      specs: "Specs", key: "Key", energy: "Energy", year: "Year", city: "City", more: "Full record card, sources and compatible transitions:",
      machine: "Machine", built4: "Built for", built4K: "What it was meant to do", hijack: "The hijack", hijackK: "What house did with it", sig: "Its signature", sigK: "In house music",
      heard: "Heard on", records: (n) => `${n} record${n > 1 ? "s" : ""}`, booth: "Hear it at the right tempo in The Booth:", trivia: "Did you know", station: "Station",
      story: "The story", storyK: "The house music metro map", listen: "Listen", onMap: "The whole station on the map:", linkBio: "link in bio", tryIt: "Try it on" };

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tag = (s) => "#" + String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
const BASE_TAGS = ["#housemusic", "#househistory", "#vinyl", "#djculture", "#clubculture"];
const firstSentence = (s) => (String(s).match(/^.+?[.!?](\s|$)/) || [s])[0].trim();
const short = (s) => String(s || "").replace(/ \(.*\)$/, "");
const gearName = (id) => byMachine[id]?.name.replace(/^Roland |^Akai |^E-mu |^Yamaha | Rhythm Composer| Bass Line/g, "") || id;
const joinCaption = (lines) => lines.filter((l, i, a) => !(l === "" && (i === 0 || a[i - 1] === ""))).join("\n").trim();

// ---------- gabarits ----------
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@400;500;700&display=block" rel="stylesheet">`;
const CSS = `
*{box-sizing:border-box}html,body{margin:0}
body{width:1080px;height:1350px;background:#0d0c0b;color:#efe9dd;font-family:"Space Grotesk",sans-serif;position:relative;overflow:hidden}
.glow{position:absolute;inset:0;background:radial-gradient(900px 700px at 90% -10%, var(--c), transparent 65%);opacity:.22}
.grain{position:absolute;inset:0;opacity:.08;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='.85' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.bar{position:absolute;left:0;top:0;bottom:0;width:20px;background:var(--c)}
.in{position:absolute;left:96px;right:88px;top:96px;bottom:150px;display:flex;flex-direction:column}
.k{font:600 26px/1.3 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--c)}
h2{font:400 84px/1 "Instrument Serif",serif;margin:28px 0 36px}
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
/* couverture : la fiche d'archive */
.cover{position:absolute;inset:80px 80px 140px 96px;display:flex;flex-direction:column}
.cover .top{display:flex;justify-content:space-between;font:600 24px/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#948c7f}
.cover .top b{color:#efe9dd}.cover .top i{font-style:normal;color:var(--c)}
.ghost{position:absolute;right:40px;top:150px;font:700 330px/1 "JetBrains Mono",monospace;letter-spacing:-.04em;color:transparent;-webkit-text-stroke:2px color-mix(in srgb, var(--c) 40%, transparent)}
.kick{margin-top:auto;display:flex;align-items:center;gap:16px;font:600 26px/1 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--c)}
.kick:before{content:"";width:24px;height:24px;border-radius:50%;background:var(--c)}
.cover h1{font:400 160px/.92 "Instrument Serif",serif;letter-spacing:-.01em;margin:24px 0 0}
.cover .sub{font:500 42px/1.2 "Space Grotesk",sans-serif;color:#b4ab9c;margin-top:20px}.cover .sub span{color:#efe9dd}
.cover .q{font:italic 400 44px/1.22 "Instrument Serif",serif;margin-top:44px;border-left:4px solid var(--c);padding-left:28px}
.badges{display:flex;flex-wrap:wrap;gap:14px;margin-top:52px}
.badge{border:2px solid #3a352f;border-radius:16px;padding:16px 20px 14px;min-width:170px}
.badge small{display:block;font:600 18px/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#948c7f}
.badge strong{display:block;font:700 38px/1.1 "JetBrains Mono",monospace;margin-top:10px;white-space:nowrap}
.cover .meta{margin-top:28px;font:400 22px/1.3 "JetBrains Mono",monospace;color:#948c7f;letter-spacing:.04em}
/* style B : la ligne de métro, papier clair (posts sur les lignes et les scènes) */
body.light{background:#f4efe4;color:#111}
body.light .glow,body.light .grain,body.light .bar{display:none}
body.light .k{color:#111}
body.light .k:before{content:"";display:inline-block;width:22px;height:22px;border-radius:50%;background:var(--c);margin-right:14px;vertical-align:-2px}
body.light h2{font:700 76px/1 "Space Grotesk",sans-serif;letter-spacing:-.03em}
body.light .list li{border-color:#d8d0c2}body.light .list span{color:#6b645a}
body.light .cta b{color:#111;background:var(--c);display:inline-block;padding:6px 12px;border-radius:8px}
body.light .foot{color:#6b645a}body.light .foot b{color:#111}body.light .swipe{color:#111}
.lineB{position:absolute;left:80px;top:80px;display:flex;align-items:center;gap:20px}
.lineB .num{width:72px;height:72px;border-radius:50%;background:var(--c);font:700 36px/72px "Space Grotesk",sans-serif;text-align:center;color:#111}
.lineB .lbl{font:700 28px/1.15 "Space Grotesk",sans-serif;text-transform:uppercase;letter-spacing:.04em}.lineB .lbl span{font-weight:500;color:#6b645a}
.brandB{position:absolute;right:80px;top:92px;font:700 24px/1.25 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;text-align:right}
.brandB span{display:block;font-weight:400;color:#6b645a}
.bodyB{position:absolute;left:80px;right:80px;top:700px;bottom:280px;display:flex;flex-direction:column}
.bodyB h1{font:700 120px/.95 "Space Grotesk",sans-serif;letter-spacing:-.035em;margin:0}
.bodyB .sub{font:500 40px/1.2 "Space Grotesk",sans-serif;margin-top:16px;color:#3b362f}
.bodyB .q{font:italic 400 42px/1.25 "Instrument Serif",serif;margin-top:28px;color:#3b362f}
.ticket{position:absolute;left:0;right:0;bottom:140px;height:120px;background:#111;color:#f4efe4;display:flex;align-items:center;padding:0 80px;gap:40px;font:600 26px/1 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase}
.ticket b{color:var(--c)}
/* « En ce moment » : variante du style sombre, marqueur d'actualité + date (accent fixe --n) */
.nowbar{position:absolute;left:0;right:0;top:0;height:96px;background:var(--n);color:#0d0c0b;display:flex;align-items:center;justify-content:space-between;padding:0 80px 0 96px;font:700 30px/1 "JetBrains Mono",monospace;letter-spacing:.16em;text-transform:uppercase}
.nowbar i{font-style:normal;display:inline-block;width:22px;height:22px;border-radius:50%;background:#0d0c0b;margin-right:18px;vertical-align:-1px}
body.now1 .cover{top:150px}body.now1 .bar{top:96px}
.onair{display:inline-flex;align-items:center;gap:16px;border:3px solid var(--n);color:var(--n);border-radius:99px;padding:14px 26px 12px;font:700 28px/1 "JetBrains Mono",monospace;letter-spacing:.16em;text-transform:uppercase}
.onair:before{content:"";width:22px;height:22px;border-radius:50%;background:var(--n);box-shadow:0 0 0 8px color-mix(in srgb, var(--n) 25%, transparent)}
.datestamp{position:absolute;right:60px;top:120px;font:700 250px/1 "JetBrains Mono",monospace;letter-spacing:-.05em;color:transparent;-webkit-text-stroke:2px color-mix(in srgb, var(--n) 55%, transparent);text-align:right}
.datestamp small{display:block;font-size:110px;letter-spacing:-.02em}
body.now2 .bar{background:var(--n)}
.sticker{position:absolute;right:70px;top:150px;width:300px;height:300px;border-radius:50%;background:var(--n);color:#0d0c0b;transform:rotate(-12deg);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.5)}
.sticker b{font:400 92px/.9 "Instrument Serif",serif;font-style:italic}
.sticker span{font:700 26px/1.3 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;margin-top:12px}
.nowk{color:var(--n)}.nowk:before{background:var(--n)}`;

const slide = (color, n, total, inner, theme = "dark", accent = "") => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${CSS}</style></head>
<body class="${theme}" style="--c:${color}${accent ? ";--n:" + accent : ""}"><div class="glow"></div><div class="grain"></div><div class="bar"></div>${inner}
<div class="foot"><span>${n}/${total}${n < total ? ' <span class="swipe">→</span>' : ""}</span><b>HOUSE<span>/</span>INTELLIGENCE</b></div></body></html>`;
const content = (inner) => `<div class="in">${inner}</div>`;
const textSlide = (kicker, title, text, extra = "") => content(`<div class="k">${esc(kicker)}</div><h2>${esc(title)}</h2><div class="fit"><p>${esc(text)}</p>${extra}</div>`);

// La couverture : fiche d'archive avec le BPM (ou un autre chiffre) en filigrane, l'accroche et les badges.
function cover({ n, kicker, title, sub, year, hook, badges = [], meta = "", ghost = "", topRight = "", kickHtml = "", before = "" }) {
  const size = title.length > 26 ? 104 : title.length > 16 ? 128 : 160;
  return `${before}${ghost ? `<div class="ghost">${esc(ghost)}</div>` : ""}<div class="cover">
<div class="top"><b>House <i>Intelligence</i></b><span>${topRight ? esc(topRight) : n ? "Nº " + String(n).padStart(3, "0") : ""}</span></div>
${kickHtml || `<div class="kick">${esc(kicker)}</div>`}
<h1 style="font-size:${size}px">${esc(title)}</h1>
<div class="sub"><span>${esc(sub)}</span>${year ? ` · ${year}` : ""}</div>
${hook ? `<div class="q">${esc(hook)}</div>` : ""}
${badges.length ? `<div class="badges">${badges.map(([k, v]) => `<div class="badge"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join("")}</div>` : ""}
${meta ? `<div class="meta">${esc(meta)}</div>` : ""}
</div>`;
}

// Couverture style B : un tronçon de ligne de métro (5 stations), la station du post en gros.
const SHORT = { loft: "The Loft", warehouse: "Warehouse", chicago: "Chicago", acid: "Acid", hiphouse: "Hip-House", footwork: "Footwork",
  paradise: "Paradise Garage", garage: "Garage", zanzibar: "Zanzibar", ballroom: "Ballroom", soundfactory: "Sound Factory", tribal: "Tribal",
  deep: "Deep", afro: "Afro House", amapiano: "Amapiano", detroit: "Detroit", electro: "Electro", soundsig: "Sound Signature", lofi: "Lo-Fi",
  soundsystem: "Sound Systems", shoom: "Shoom", bleep: "Bleep", hardcore: "Jungle", ukg: "UK Garage", dubstep: "Dubstep", charthouse: "Charts",
  balearic: "Balearic", italo: "Italo", french: "French Touch", techhouse: "Tech House", qweenbeat: "Qween Beat", renaissance: "Renaissance",
  gqom: "Gqom", trance: "Trance", berlin: "Berlin" };
function coverB({ line, station, title, sub, hook, badges = [] }) {
  const all = line.stations, ci = station ? all.indexOf(station) : 0, N = Math.min(5, all.length);
  const a0 = Math.max(0, Math.min(ci - 2, all.length - N)), sts = all.slice(a0, a0 + N);
  const x0 = 150, x1 = 930, y = 230, xs = sts.map((_, i) => (N > 1 ? x0 + (i * (x1 - x0)) / (N - 1) : 540));
  const svg = `<svg width="1080" height="440" style="position:absolute;left:0;top:200px" viewBox="0 0 1080 440">
<line x1="0" y1="${y}" x2="1080" y2="${y}" stroke="${line.color}" stroke-width="28"/>
${sts.map((s, i) => { const on = s === station, up = i % 2 === 0;
  return `<circle cx="${xs[i]}" cy="${y}" r="${on ? 46 : 22}" fill="#f4efe4" stroke="#111" stroke-width="${on ? 12 : 8}"/>
<text x="${xs[i]}" y="${up ? y - (on ? 76 : 50) : y + (on ? 104 : 76)}" text-anchor="middle" font-family="Space Grotesk" font-weight="${on ? 700 : 500}" font-size="${on ? 36 : 26}" fill="${on ? "#111" : "#6b645a"}">${esc(SHORT[s] || short(metro.stations[s]?.name || s))}</text>`; }).join("")}</svg>`;
  return `${svg}<div class="lineB"><div class="num">${line.num}</div><div class="lbl">${FR ? "Ligne" : "Line"} ${line.num}<br><span>${esc(f(line, "name"))}</span></div></div>
<div class="brandB">House Intelligence<span>${esc(SITE_SHORT)}</span></div>
<div class="bodyB"><h1 style="font-size:${title.length > 20 ? 92 : 120}px">${esc(title)}</h1><div class="sub">${esc(sub)}</div>${hook ? `<div class="q">${esc(hook)}</div>` : ""}</div>
<div class="ticket">${badges.slice(0, 3).map(([k, v]) => `<span>${esc(k)} <b>${esc(v)}</b></span>`).join("")}</div>`;
}
const mainLine = (sid) => (stationLines[sid] || []).find((l) => l.stations.length > 2) || stationLines[sid]?.[0];

// ---------- contenus ----------
const queued = (id) => queue.find((p) => p.kind === "track" && p.track === id);

function recordPost(t, q = queued(t.id)) {
  const g = byGenre[t.genre], e = byEra[t.era], c = q?.color || g?.color || "#d4ff3a";
  const gear = (t.gear || []).filter((id) => byMachine[id]).map(gearName);
  const url = `${SITE_SHORT}/${FR ? "disques" : "en/records"}/${t.id}/`;
  const hook = q?.hook || firstSentence(f(t, "why_this_record"));
  const slides = [
    cover({ n: q?.n, kicker: f(g, "name") || t.genre, title: short(t.title), sub: t.artist, year: q?.year || t.year, hook, ghost: String(t.bpm),
      badges: [["BPM", t.bpm], [W.key, t.camelot_key], [W.energy, `${t.energy}/10`], [W.city, short(t.city)]],
      meta: [short(t.label), gear.join(" · ")].filter(Boolean).join("  ·  ") }),
    textSlide(`${f(e, "name")} · ${f(g, "name")}`, W.why, f(t, "why_this_record")),
    textSlide(W.gearK, W.built, f(t, "construction"), gear.length ? `<div class="chips">${gear.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""),
    textSlide(W.clubK, W.club, f(t, "club_sociology")),
    content(`<div class="k">${W.specs}</div><h2>${esc(short(t.title))}</h2>
     <dl class="facts"><div><dt>BPM</dt><dd>${t.bpm}</dd></div><div><dt>${W.key}</dt><dd>${esc(t.camelot_key)}</dd></div>
     <div><dt>${W.energy}</dt><dd>${t.energy}/10</dd></div><div><dt>${W.year}</dt><dd>${q?.year || t.year}</dd></div></dl>
     <div class="cta">${W.more}<b>${esc(url)}</b></div>`),
  ];
  const caption = q?.caption && !FR
    ? joinCaption([q.caption, "", q.hashtags.join(" ")])
    : joinCaption([`${t.title} · ${t.artist} · ${t.city}, ${t.year}`, "", f(t, "why_this_record"), "", f(t, "construction"), "",
        `${t.bpm} BPM · ${t.camelot_key} · ${W.energy} ${t.energy}/10`, "", `🔗 ${url} (${W.linkBio})`, "",
        [...new Set([g ? tag(g.name) : "", tag(t.artist), ...(t.gear || []).filter((id) => byMachine[id]).map(tag), ...BASE_TAGS])].filter((x) => x.length > 2).join(" ")]);
  return { slug: q ? `${String(q.n).padStart(2, "0")}-${q.slug}` : `disque-${t.id}`, color: c, slides, caption };
}

// Post « fonction du site » : couverture + une slide par badge qui renvoie à un disque (ex. les tempos de The Booth) + appel à l'action.
function featurePost(q) {
  const c = q.color || "#d4ff3a";
  const linked = (q.badges || []).map(([label, value]) => ({ label, value, t: tracks.find((t) => short(t.title).toLowerCase() === String(label).toLowerCase()) })).filter((b) => b.t);
  const slides = [
    cover({ n: q.n, kicker: q.kicker || "", title: q.title, sub: q.sub || "", year: q.year, hook: q.hook, badges: q.badges || [], meta: q.foot || "", ghost: q.ghost || "" }),
    ...linked.map(({ value, t }) => {
      const g = byGenre[t.genre];
      return `<div class="ghost">${esc(value)}</div>` + content(`<div class="k">${esc(f(g, "name"))} · ${t.year}</div><h2 style="margin-top:300px">${esc(short(t.title))}</h2>
        <div class="fit"><p style="color:#b4ab9c">${esc(t.artist)}</p><p style="margin-top:28px">${esc(firstSentence(f(t, "why_this_record")))}</p></div>`);
    }),
    content(`<div class="k">${esc(q.kicker || "House Intelligence")}</div><h2>${esc(q.title)}</h2><div class="fit"><p>${esc(q.hook || "")}</p></div>
     <div class="cta">${W.tryIt}<b>${SITE_SHORT}</b></div>`),
  ];
  return { slug: `${String(q.n).padStart(2, "0")}-${q.slug}`, color: c, slides, caption: joinCaption([q.caption || "", "", (q.hashtags || []).join(" ")]) };
}

function machinePost(m, q) {
  const c = q?.color || "#d4ff3a";
  const url = `${SITE_SHORT}/#booth`;
  const used = (m.tracks || []).map((id) => byTrack[id]).filter(Boolean).slice(0, 6);
  const slides = [
    cover({ n: q?.n, kicker: W.machine, title: q?.title || m.name, ghost: q?.ghost || "", sub: f(m, "maker") || "", year: m.year, hook: q?.hook || firstSentence(f(m, "hijack")), badges: [["Type", f(m, "type").split(/[ (]/)[0]], [W.year, m.year]] }),
    textSlide(W.built4K, W.built4, f(m, "intended_use")),
    textSlide(W.hijackK, W.hijack, f(m, "hijack")),
    textSlide(W.sigK, W.sig, [f(m, "signature"), f(m, "house_usage")].filter(Boolean).join(" ")),
    used.length
      ? content(`<div class="k">${W.heard}</div><h2>${W.records(used.length)}</h2><ul class="list">${used.map((t) => `<li>${esc(short(t.title))} — ${esc(t.artist)}<span>${t.year}</span></li>`).join("")}</ul><div class="cta">${W.booth}<b>${esc(url)}</b></div>`)
      : textSlide(W.trivia, W.trivia, f(m, "trivia"), `<div class="cta">${W.booth}<b>${esc(url)}</b></div>`),
  ];
  const caption = q?.caption && !FR ? joinCaption([q.caption, "", (q.hashtags || []).join(" ")]) : joinCaption([`${m.name} (${m.year || ""})`, "", f(m, "hijack"), "", f(m, "trivia"), "", `🔗 ${url} (${W.linkBio})`, "",
    [tag(m.id), tag(m.maker || ""), "#drummachine", "#synth", ...BASE_TAGS].filter((x) => x.length > 2).join(" ")]);
  return { slug: q ? `${String(q.n).padStart(2, "0")}-${q.slug}` : `machine-${m.id}`, color: c, slides, caption };
}

// Posts sur les scènes (stations) et les lignes : style B, ligne de métro sur papier clair.
const stationRecords = (sid) => { const s = metro.stations[sid];
  return [...new Set([...(s.tracks || []), ...tracks.filter((t) => (s.genres || []).includes(t.genre)).map((t) => t.id)])].map((id) => byTrack[id]).filter(Boolean).sort((a, b) => a.year - b.year); };

function stationPost(sid, q) {
  const s = metro.stations[sid], line = mainLine(sid), c = q?.color || line?.color || "#d4ff3a";
  const recs = stationRecords(sid);
  const url = `${SITE_SHORT}/${FR ? "" : "en/"}stations/${sid}/`;
  const name = f(s, "name");
  const hook = q?.hook || firstSentence(f(s, "summary"));
  const slides = [
    line ? coverB({ line, station: sid, title: short(name), sub: s.years, hook, badges: [[W.station, SHORT[sid] || short(name)], [W.year, s.years], [W.listen, W.records(recs.length)]] })
         : cover({ kicker: `${W.station} · ${s.years}`, title: name, sub: "", hook, badges: [[W.year, s.years]] }),
    textSlide(W.storyK, W.story, f(s, "summary")),
    content(`<div class="k">${W.listen}</div><h2>${W.records(recs.length)}</h2><ul class="list">${recs.slice(0, 7).map((t) => `<li>${esc(short(t.title))} — ${esc(t.artist)}<span>${t.year}</span></li>`).join("")}</ul>
     <div class="cta">${W.onMap}<b>${esc(url)}</b></div>`),
  ];
  const caption = q?.caption && !FR ? joinCaption([q.caption, "", (q.hashtags || []).join(" ")])
    : joinCaption([`${name} (${s.years})`, "", f(s, "summary"), "", `🔗 ${url} (${W.linkBio})`, "", [tag(s.name), ...BASE_TAGS].join(" ")]);
  return { slug: q ? `${String(q.n).padStart(2, "0")}-${q.slug}` : `station-${sid}`, color: c, theme: "light", slides, caption };
}

function linePost(lid, q) {
  const line = metro.lines.find((l) => l.id === lid), c = line.color;
  const sts = line.stations.filter((sid) => metro.stations[sid]);
  const recs = [...new Set(sts.flatMap((sid) => stationRecords(sid)))].sort((a, b) => a.year - b.year);
  const years = recs.length ? `${recs[0].year} → ${recs.at(-1).year}` : "";
  const name = f(line, "name");
  const url = `${SITE_SHORT}/${FR ? "" : "en/"}stations/`;
  const hook = q?.hook || "";
  const slides = [
    coverB({ line, station: null, title: name, sub: years, hook, badges: [[FR ? "Ligne" : "Line", line.num], [FR ? "Stations" : "Stations", sts.length], [FR ? "Disques" : "Records", recs.length]] }),
    content(`<div class="k">${FR ? "Les stations" : "The stations"}</div><h2>${esc(name)}</h2><ul class="list">${sts.map((sid) => `<li>${esc(short(f(metro.stations[sid], "name")))}<span>${esc(metro.stations[sid].years)}</span></li>`).join("")}</ul>`),
    content(`<div class="k">${W.listen}</div><h2>${W.records(recs.length)}</h2><ul class="list">${recs.slice(0, 7).map((t) => `<li>${esc(short(t.title))} — ${esc(t.artist)}<span>${t.year}</span></li>`).join("")}</ul>
     <div class="cta">${FR ? "Toutes les stations sur le plan :" : "Every station on the map:"}<b>${esc(url)}</b></div>`),
  ];
  const caption = q?.caption && !FR ? joinCaption([q.caption, "", (q.hashtags || []).join(" ")])
    : joinCaption([`${FR ? "Ligne" : "Line"} ${line.num} · ${name}${years ? ` · ${years}` : ""}`, "", sts.map((sid) => `${short(f(metro.stations[sid], "name"))} (${metro.stations[sid].years})`).join(" → "), "",
        `🔗 ${url} (${W.linkBio})`, "", [tag(name), ...BASE_TAGS].join(" ")]);
  return { slug: q ? `${String(q.n).padStart(2, "0")}-${q.slug}` : `ligne-${lid}`, color: c, theme: "light", slides, caption };
}

// Post « En ce moment » (data/decouvertes.json) : variante du style sombre, avec un marqueur d'actualité et la date,
// pour qu'on distingue dans la grille une écoute du moment d'une fiche d'archive. Accent fixe pour toutes les découvertes.
// Variantes de couverture : 1 bandeau en haut, 2 « on air » + date en filigrane, 3 pastille ronde.
const NOW_ACCENT = "#d4ff3a";
const DISC_KIND = FR
  ? { nouveau: "Nouveauté", redecouverte: "Redécouverte", lecture: "Lecture", film: "Film", mix: "Mix" }
  : { nouveau: "New find", redecouverte: "Rediscovery", lecture: "Reading", film: "Watching", mix: "Mix" };
const MONTHS = FR ? ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
  : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longDate = (d) => { const [y, m, j] = d.split("-").map(Number); return FR ? `${j} ${MONTHS[m - 1]} ${y}` : `${j} ${MONTHS[m - 1]} ${y}`; };

function discoveryPost(e, q = {}) {
  const v = Number(q.variant || 1);
  const who = e.artist || e.author || "";
  const st = e.station && metro.stations[e.station], line = st && mainLine(e.station);
  const rec = e.track && byTrack[e.track];
  const c = line?.color || NOW_ACCENT;
  const kind = DISC_KIND[e.kind] || DISC_KIND.nouveau;
  const nowLabel = FR ? "Coup de cœur" : "Current favourite";
  const date = longDate(e.date), [yy, mm, dd] = e.date.split("-");
  const discUrl = `${SITE_SHORT}/#decouverte`;
  const stUrl = st ? `${SITE_SHORT}/${FR ? "" : "en/"}stations/${e.station}/` : "";
  const note = f(e, "note"), context = f(e, "context");
  // Livre (kind « lecture ») : éditeur au lieu du label, « je lis » au lieu de « j'écoute », pas de piste favorite.
  const book = e.kind === "lecture";
  const publisher = e.publisher || e.label;
  const support = FR ? (book ? "Acheter chez l'éditeur" : "Soutenir l'artiste") : (book ? "Buy from the publisher" : "Support the artist");
  const journal = FR ? (book ? "Ce que je lis et écoute en ce moment" : "Ce que j'écoute en ce moment") : (book ? "What I'm reading and listening to right now" : "What I'm listening to right now");
  const badges = [book ? [FR ? "Éditeur" : "Publisher", publisher] : [FR ? "Label" : "Label", e.label], e.year && [W.year, e.year], e.highlight && [FR ? "★ Piste" : "★ Fav track", e.highlight], st && [W.station, SHORT[e.station] || short(f(st, "name"))]].filter((b) => b && b[1]);
  const lineK = line ? `${FR ? "Ligne" : "Line"} ${line.num} · ${f(line, "name")}` : kind;
  const base = { title: e.title, sub: who, year: e.year, hook: note ? `“${note}”` : "", badges, meta: context ? firstSentence(context) : "" };
  const covers = {
    1: cover({ ...base, before: `<div class="nowbar"><span><i></i>${esc(nowLabel)}</span><span>${esc(date)}</span></div>`, kicker: lineK }),
    2: cover({ ...base, before: `<div class="datestamp">${dd}.${mm}<small>${yy}</small></div>`, topRight: date, kickHtml: `<div style="margin-top:auto"><span class="onair">${esc(nowLabel)}</span></div>` }),
    3: cover({ ...base, before: `<div class="sticker"><b>${FR ? "Coup de<br>cœur" : "Current<br>fave"}</b><span>${esc(`${Number(dd)} ${MONTHS[Number(mm) - 1]}`)}</span></div>`, topRight: date, kicker: lineK }),
  };
  const recs = st ? stationRecords(e.station).slice(-4) : [];
  const slides = [
    covers[v] || covers[1],
    textSlide(nowLabel, who || e.title, context || note, (context && note ? `<div class="q" style="font:italic 400 60px/1.2 'Instrument Serif',serif;margin-top:56px;border-left:4px solid var(--n);padding-left:28px">“${esc(note)}”</div>` : "")
      + (e.highlight ? `<div class="chips"><span class="chip">${FR ? "★ Piste favorite :" : "★ Favourite track:"} ${esc(e.highlight)}</span></div>` : "")),
    content(`<div class="k nowk">${esc(nowLabel)}</div><h2>${e.bandcamp?.url ? support : (FR ? "Pour aller plus loin" : "Dig deeper")}</h2>
      ${e.bandcamp?.url ? `<div class="cta" style="margin-top:0">${book ? (FR ? "En vente sur Bandcamp :" : "Available on Bandcamp:") : (FR ? "Achat et écoute sur Bandcamp :" : "Buy and stream it on Bandcamp:")}<b>${esc(e.bandcamp.url.replace(/^https?:\/\//, ""))}</b></div>` : ""}
      ${recs.length ? `<div class="k" style="margin-top:56px">${FR ? "Sur le plan" : "On the map"} · ${esc(short(f(st, "name")))}</div><ul class="list" style="margin-top:12px">${recs.map((t) => `<li>${esc(short(t.title))} — ${esc(t.artist)}<span>${t.year}</span></li>`).join("")}</ul>` : ""}
      ${rec ? `<div class="cta">${W.more}<b>${esc(`${SITE_SHORT}/${FR ? "disques" : "en/records"}/${rec.id}/`)}</b></div>` : `<div class="cta">${FR ? "Tout le journal « En ce moment » :" : `Everything I'm ${book ? "reading and listening to" : "listening to"} right now:`}<b>${esc(discUrl)}</b></div>`}`),
  ];
  const genreTag = st ? tag(short(f(st, "name")).replace(/ house$/i, "") + "house") : "";
  const caption = joinCaption([
    `${FR ? "Mon coup de cœur du moment" : "My current favourite"} · ${date}`, "",
    [e.title, who, book ? publisher : e.label, e.year].filter(Boolean).join(" · "), "",
    context, "",
    note ? `“${note}”` : "", "",
    e.highlight ? `★ ${FR ? "Piste favorite" : "Favourite track"}: ${e.highlight}` : "", "",
    e.bandcamp?.url ? `${support}: ${e.bandcamp.url.replace(/^https?:\/\//, "")}` : "",
    st ? `${FR ? "Sur le plan" : "On the map"}: ${short(f(st, "name"))} → ${stUrl}` : "", "",
    `🔗 ${journal}: ${discUrl} (${W.linkBio})`, "",
    [...new Set([book ? "#nowreading" : "#nowplaying", "#currentfavourite", who ? tag(who) : "", publisher ? tag(publisher) : "", book ? "#musicbooks" : "", genreTag, e.bandcamp ? "#bandcamp" : "", e.kind === "nouveau" ? "#newmusic" : "", "#housemusic", "#djculture", "#clubculture"])].filter((x) => x.length > 2).join(" "),
  ]);
  return { slug: q.n ? `${String(q.n).padStart(2, "0")}-${q.slug}` : `decouverte-${e.id}${q.variant ? "-v" + v : ""}`, color: c, accent: NOW_ACCENT, theme: `dark now${v}`, slides, caption };
}

// Style selon le type : disques et fonctions du site en style A (sombre), stations et lignes en style B (clair).
const fromQueue = (q) =>
  q.kind === "feature" ? featurePost(q)
  : q.kind === "track" && byTrack[q.track] ? recordPost(byTrack[q.track], q)
  : q.kind === "station" && metro.stations[q.station] ? stationPost(q.station, q)
  : q.kind === "line" && metro.lines.some((l) => l.id === q.line) ? linePost(q.line, q)
  : q.kind === "machine" && byMachine[q.machine] ? machinePost(byMachine[q.machine], q)
  : q.kind === "decouverte" && byDisc[q.decouverte] ? discoveryPost(byDisc[q.decouverte], q)
  : null;

// ---------- rendu ----------
async function render(posts, outDir = "out") {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  for (const p of posts) {
    const dir = join(ROOT, "social", outDir, p.slug + (FR ? "-fr" : ""));
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < p.slides.length; i++) {
      await page.setContent(slide(p.color, i + 1, p.slides.length, p.slides[i], p.theme, p.accent), { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const box of document.querySelectorAll(".fit")) {
          const ps = box.querySelectorAll("p");
          let size = 44;
          while (box.scrollHeight > box.clientHeight && size > 26) { size -= 2; ps.forEach((p) => (p.style.fontSize = size + "px")); }
        }
        const q = document.querySelector(".cover .q"), cv = document.querySelector(".cover");
        let qs = 44;
        while (q && cv.scrollHeight > cv.clientHeight && qs > 30) { qs -= 2; q.style.fontSize = qs + "px"; }
      });
      await page.screenshot({ path: join(dir, String(i + 1).padStart(2, "0") + ".jpg"), type: "jpeg", quality: 90 });
    }
    writeFileSync(join(dir, "caption.txt"), p.caption + "\n");
    console.log(`social/${outDir}/${p.slug}${FR ? "-fr" : ""}/ : ${p.slides.length} slides + caption.txt`);
  }
  await browser.close();
}

// ---------- ligne de commande ----------
const [cmd, arg] = args.filter((a) => a !== "--fr" && !a.startsWith("--variant="));
if (cmd === "--posted") {
  if (!byTrack[arg]) throw new Error(`Disque inconnu : ${arg}`);
  if (!posted.some((p) => p.id === arg)) posted.push({ id: arg, date: new Date().toISOString().slice(0, 10) });
  mkdirSync(dirname(POSTED), { recursive: true });
  writeFileSync(POSTED, JSON.stringify(posted, null, 2) + "\n");
  console.log(`${arg} marqué comme publié (${posted.length} au total).`);
} else if (cmd === "--queue") {
  await render(queue.filter((q) => ["draft", "approved", undefined].includes(q.status)).map(fromQueue).filter(Boolean));
} else if (cmd === "post") {
  const q = queue.find((p) => String(p.n) === arg || p.slug === arg);
  if (!q) throw new Error(`Post introuvable dans social/posts.json : ${arg}`);
  await render([fromQueue(q)]);
} else if (cmd === "media") {
  const q = queue.find((p) => String(p.n) === arg || p.slug === arg);
  if (!q) throw new Error(`Post introuvable dans social/posts.json : ${arg}`);
  if (FR) throw new Error("Le compte publie en anglais : pas de --fr pour media.");
  await render([fromQueue(q)], "media");
} else if (cmd === "--next") {
  const done = new Set([...posted.map((p) => p.id), ...queue.map((q) => q.track).filter(Boolean)]);
  const next = [...tracks].sort((a, b) => a.year - b.year).filter((t) => !done.has(t.id)).slice(0, Number(arg) || 1);
  await render(next.map((t) => recordPost(t)));
} else if (cmd === "disque" && byTrack[arg]) await render([recordPost(byTrack[arg])]);
else if (cmd === "decouverte" && byDisc[arg]) {
  const v = (args.find((a) => a.startsWith("--variant=")) || "").split("=")[1];
  await render((v === "all" ? [1, 2, 3] : [Number(v) || 1]).map((variant) => discoveryPost(byDisc[arg], { variant })));
}
else if (cmd === "machine" && byMachine[arg]) await render([machinePost(byMachine[arg])]);
else if (cmd === "station" && metro.stations[arg]) await render([stationPost(arg)]);
else if (cmd === "ligne" && metro.lines.some((l) => l.id === arg)) await render([linePost(arg)]);
else {
  console.log("Usage : node tools/instagram.mjs post <n|slug> | --queue | disque <id> | machine <id> | station <id> | ligne <L1…L9> | --next <n> | --posted <id> | media <n|slug>  [--fr]");
  process.exit(1);
}
