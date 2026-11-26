// HOUSE/INTELLIGENCE — générateur de pages statiques (wiki indexable)
// Usage : node build.mjs   → génère index.html, genres/, morceaux/, machines/, bibliotheque/, lecteur/, sitemap.xml, robots.txt
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE_URL = "https://house-intelligence.pages.dev";
const SITE = "House Intelligence";
const read = (f) => JSON.parse(readFileSync(join(ROOT, f), "utf8"));
const T = read("data/tracks.json"), M = read("data/machines.json"), SRC = read("data/sources.json"), W = read("_archive/wiki-v2/wiki.json");
const tracks = T.tracks, genres = T.genres, eras = T.eras, machines = M.machines, sources = SRC.sources;
const byId = Object.fromEntries(tracks.map((t) => [t.id, t]));
const G = Object.fromEntries(genres.map((g) => [g.id, g]));
const E = Object.fromEntries(eras.map((e) => [e.id, e]));
const MA = Object.fromEntries(machines.map((m) => [m.id, m]));
const SO = Object.fromEntries(sources.map((s) => [s.id, s]));

// ---------- helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clip = (s, n = 155) => { s = String(s).replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)) + "…"; };
const U = {
  home: "/", genres: "/genres/", genre: (id) => `/genres/${id}/`, track: (id) => `/morceaux/${id}/`, tracks: "/morceaux/",
  machine: (id) => `/machines/${id}/`, machines: "/machines/", lib: "/bibliotheque/", source: (id) => `/bibliotheque/${id}/`,
  player: "/lecteur/", booth: "/booth/", label: (l) => `/morceaux/#label-${slug(l)}`,
};
const linked = (sid) => tracks.filter((t) => t.archive_ref?.source === sid || (t.further_reading || []).includes(sid));
const shortMachine = (m) => m.name.replace(/^(Roland|Yamaha|Akai|E-mu)\s+/, "").replace(/ (Rhythm Composer|Bass Line|MIDI Production Center|Music Workstation)$/, "").replace(" (amapiano)", "");
const gearHtml = (g) => MA[g] ? `<a class="tag" href="${U.machine(g)}">${esc(shortMachine(MA[g]))}</a>` : `<span class="tag plain">${esc(g)}</span>`;
const KEY_NAMES = { "1A": "La♭ mineur", "2A": "Mi♭ mineur", "3A": "Si♭ mineur", "4A": "Fa mineur", "5A": "Do mineur", "6A": "Sol mineur", "7A": "Ré mineur", "8A": "La mineur", "9A": "Mi mineur", "10A": "Si mineur", "11A": "Fa♯ mineur", "12A": "Do♯ mineur", "1B": "Si majeur", "2B": "Fa♯ majeur", "3B": "Ré♭ majeur", "4B": "La♭ majeur", "5B": "Mi♭ majeur", "6B": "Si♭ majeur", "7B": "Fa majeur", "8B": "Do majeur", "9B": "Sol majeur", "10B": "Ré majeur", "11B": "La majeur", "12B": "Mi majeur" };

// même algorithme que le Booth
function camelot(ka, kb) {
  const p = (k) => { const m = /^(\d{1,2})([AB])$/.exec(k); return { n: +m[1], l: m[2] }; };
  const a = p(ka), b = p(kb); let d = (b.n - a.n + 12) % 12; if (d > 6) d -= 12;
  if (a.l === b.l) {
    if (d === 0) return [1, "même clé"]; if (Math.abs(d) === 1) return [0.92, d > 0 ? "+1, quinte ascendante" : "−1, quarte"];
    if (d === 2) return [0.62, "+2, boost d'énergie"]; if (d === -5) return [0.55, "+7, montée d'un demi-ton"];
  } else { if (d === 0) return [0.86, "relatif majeur/mineur"]; if (Math.abs(d) === 1) return [0.55, "diagonale"]; }
  return [Math.max(0, 0.3 - Math.abs(d) * 0.05), `saut de ${Math.abs(d)} cases`];
}
function transitions(t, n = 3) {
  return tracks.filter((x) => x.id !== t.id).map((x) => {
    const [ks, kl] = camelot(t.camelot_key, x.camelot_key);
    const pct = Math.abs((x.bpm - t.bpm) / t.bpm) * 100;
    return { x, ks, kl, score: 0.55 * ks + 0.45 * Math.max(0, 1 - pct / 10), delta: x.bpm - t.bpm, pitch: ((t.bpm - x.bpm) / x.bpm) * 100 };
  }).sort((a, b) => b.score - a.score).slice(0, n);
}

// ---------- layout ----------
const NAV = [["Accueil", U.home], ["Genres", U.genres], ["Morceaux", U.tracks], ["Machines", U.machines], ["Bibliothèque", U.lib], ["Lecteur", U.player]];
function page({ path, title, description, h1, kicker = "", body, jsonld, color, crumbs = [], bodyClass = "" }) {
  const full = path === "/" ? `${SITE} · Le wiki de la house, de Chicago à aujourd'hui` : `${title} · ${SITE}`;
  const canon = SITE_URL + path;
  const nav = NAV.map(([l, h]) => `<a href="${h}"${(h === "/" ? path === "/" : path.startsWith(h)) ? ' aria-current="page"' : ""}>${l}</a>`).join("");
  const bc = crumbs.length ? `<nav class="crumbs" aria-label="Fil d'Ariane"><ol><li><a href="/">Accueil</a></li>${crumbs.map(([l, h]) => h ? `<li><a href="${h}">${esc(l)}</a></li>` : `<li aria-current="page">${esc(l)}</li>`).join("")}</ol></nav>` : "";
  const ld = [{ "@context": "https://schema.org", "@type": "WebSite", name: SITE, url: SITE_URL + "/", inLanguage: "fr" }];
  if (crumbs.length) ld.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [["Accueil", "/"], ...crumbs].map(([n, h], i) => ({ "@type": "ListItem", position: i + 1, name: n, ...(h || i === crumbs.length ? { item: SITE_URL + (h || path) } : {}) })) });
  if (jsonld) ld.push(jsonld);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(clip(description))}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(clip(description, 200))}"><meta property="og:url" content="${canon}"><meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%2215%22 fill=%22%23111%22/%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%226%22 fill=%22%23d4ff3a%22/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css">
<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, "\\u003c")}</script>
</head>
<body class="${bodyClass}"${color ? ` style="--g:${color}"` : ""}>
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="site-head">
  <a class="logo" href="/">HOUSE<span>/</span>INTELLIGENCE</a>
  <nav class="mainnav" aria-label="Navigation principale">${nav}<a class="booth-link" href="${U.booth}">Booth DJ</a></nav>
</header>
<main id="contenu" tabindex="-1">
${bc}
<header class="page-head">
${kicker ? `<p class="kicker">${kicker}</p>` : ""}<h1>${h1 ?? esc(title)}</h1>
</header>
${body}
</main>
<footer class="site-foot">
  <p><strong>House Intelligence</strong> · wiki éditorial de la musique house, 1970 → aujourd'hui.</p>
  <p>BPM et clés Camelot sont des valeurs éditoriales indicatives. Les écoutes passent par YouTube (vidéos chargées uniquement à votre demande) ; les droits appartiennent à leurs ayants droit.</p>
  <nav aria-label="Pied de page">${NAV.map(([l, h]) => `<a href="${h}">${l}</a>`).join(" · ")} · <a href="${U.booth}">Booth DJ</a></nav>
</footer>
<script src="/site.js" defer></script>
</body>
</html>
`;
}
const out = [];
function emit(path, html) {
  const file = join(ROOT, path === "/" ? "index.html" : path.replace(/^\//, "") + "index.html");
  mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, html); out.push(path);
}

// ---------- fragments ----------
const trackCard = (t, extra = "") => `<li class="tcard" style="--c:${G[t.genre].color}">
  <a href="${U.track(t.id)}"><span class="tt">${esc(t.title)}</span><span class="ta">${esc(t.artist)}</span></a>
  <span class="tm">${t.year} · ${esc(t.city)} · ${esc(t.label)}${extra}</span></li>`;
const listen = (t) => t.youtube?.length ? `<div class="listen" data-yt='${esc(JSON.stringify(t.youtube))}' data-title="${esc(t.artist + " — " + t.title)}">
  <button type="button" class="btn listen-btn">▶ Écouter sur la page <small>(vidéo YouTube, chargée au clic)</small></button></div>` : "";
const sourceLink = (s, note) => `<a class="src-card" href="${U.source(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.author)}${s.year ? " · " + s.year : ""}</span>${note ? `<em>${esc(note)}</em>` : ""}</a>`;
const genreChip = (g) => `<a class="gchip" href="${U.genre(g.id)}" style="--c:${g.color}"><span class="dot"></span>${esc(g.name)}</a>`;
const ext = (t) => {
  const q = encodeURIComponent(`${t.artist.replace(/ ·.*| feat\..*/g, "")} ${t.title.replace(/\s*\(.*\)/, "")}`);
  return `<ul class="ext-links">
  <li><a href="https://www.discogs.com/search/?q=${q}&type=all" rel="noopener" target="_blank">Discogs ↗</a></li>
  ${t.youtube?.[0] ? `<li><a href="https://www.youtube.com/watch?v=${t.youtube[0]}" rel="noopener" target="_blank">YouTube ↗</a></li>` : ""}
  ${t.spotify?.id ? `<li><a href="https://open.spotify.com/track/${t.spotify.id}" rel="noopener" target="_blank">Spotify ↗</a></li>` : ""}
  <li><a href="https://fr.wikipedia.org/w/index.php?search=${q}" rel="noopener" target="_blank">Wikipédia ↗</a></li></ul>`;
};

const span = (gid) => { const ys = tracks.filter((t) => t.genre === gid).map((t) => t.year); return ys.length ? (Math.min(...ys) === Math.max(...ys) ? `${ys[0]}` : `${Math.min(...ys)}–${Math.max(...ys)}`) : ""; };
// ---------- HOME ----------
{
  const featured = genres.filter((g) => W.genres[g.id]?.featured);
  const core = genres.filter((g) => g.family !== "cousin"), cousins = genres.filter((g) => g.family === "cousin");
  const gcard = (g) => `<li><a class="gcard" href="${U.genre(g.id)}" style="--c:${g.color}"><span class="gname">${esc(g.name)}</span><span class="gera">${span(g.id)} · ${tracks.filter((t) => t.genre === g.id).length} disques</span><span class="glede">${esc(clip(W.genres[g.id]?.lede || g.style, 150))}</span></a></li>`;
  const tl = W.timeline.map((j) => `<li style="--c:${G[j.genre].color}"><span class="ty">${j.year}</span><div><h3>${j.track ? `<a href="${U.track(j.track)}">${esc(j.title)}</a>` : esc(j.title)}</h3><p>${esc(j.text)}</p><a class="tg" href="${U.genre(j.genre)}">${esc(G[j.genre].name)}</a></div></li>`).join("");
  const body = `
<section class="hero">
  <p class="lede">${esc(W.home.lede)}</p>
  ${W.home.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}
  <p class="cta"><a class="btn primary" href="#chronologie">Lire la chronologie ↓</a> <a class="btn" href="${U.genres}">Explorer les genres</a> <a class="btn" href="${U.player}">▶ Écouter le lecteur</a></p>
</section>
<section aria-labelledby="entrees"><h2 id="entrees">Par où commencer</h2>
  <ul class="gcards big">${featured.map(gcard).join("")}</ul></section>
<section aria-labelledby="chronologie" id="chronologie-sec"><h2 id="chronologie">Chronologie · 1970 → aujourd'hui</h2>
  <ol class="timeline">${tl}</ol></section>
<section aria-labelledby="eres"><h2 id="eres">Trois ères</h2>
  <div class="eras">${eras.map((e) => `<article><h3>${esc(e.name)} <small>${esc(e.range)}</small></h3><p>${esc(e.desc)}</p><p class="mini">${genres.filter((g) => g.era === e.id).map(genreChip).join(" ")}</p></article>`).join("")}</div></section>
<section aria-labelledby="tous"><h2 id="tous">Les ${core.length} sous-genres et ${cousins.length} lignées voisines</h2>
  <ul class="gcards">${core.map(gcard).join("")}</ul>
  <h3 class="sub">Lignées voisines</h3><ul class="gcards">${cousins.map(gcard).join("")}</ul></section>
<section class="more" aria-labelledby="aller"><h2 id="aller">Aller plus loin</h2>
  <div class="tiles">
    <a href="${U.player}"><b>Le Lecteur</b><span>Les ${tracks.length} disques, classés par style, en écoute intégrale.</span></a>
    <a href="${U.lib}"><b>La Bibliothèque</b><span>${sources.length} livres, films et magazines, reliés aux disques qu'ils éclairent.</span></a>
    <a href="${U.machines}"><b>Les Machines</b><span>808, 909, 303, log drum : l'histoire des instruments détournés.</span></a>
    <a href="${U.booth}"><b>Le Booth DJ</b><span>Pour les DJs : transitions Camelot, BPM, boîte à rythmes au tempo exact.</span></a>
  </div></section>`;
  emit("/", page({ path: "/", title: "La house, de Chicago à aujourd'hui", h1: "La house, de Chicago à aujourd'hui", kicker: "Le wiki de la house · 1970 → aujourd'hui",
    description: W.home.lede, body }));
}

// ---------- GENRES ----------
{
  const body = `<p class="intro">Quatorze sous-genres de la house, et trois lignées voisines que les livres de référence relient à son histoire.</p>
  ${eras.map((e) => `<section><h2>${esc(e.name)} <small>${esc(e.range)}</small></h2><p class="era-desc">${esc(e.desc)}</p>
  <ul class="gcards">${genres.filter((g) => g.era === e.id).map((g) => `<li><a class="gcard" href="${U.genre(g.id)}" style="--c:${g.color}"><span class="gname">${esc(g.name)}${g.family === "cousin" ? ' <small>lignée voisine</small>' : ""}</span><span class="gera">${tracks.filter((t) => t.genre === g.id).length} disques</span><span class="glede">${esc(clip(W.genres[g.id]?.lede || g.style, 150))}</span></a></li>`).join("")}</ul></section>`).join("")}`;
  emit(U.genres, page({ path: U.genres, title: "Les genres de la house", description: "Chicago, acid, Detroit, garage, deep, French Touch, UK garage, afro house, amapiano : les sous-genres de la house et leurs lignées voisines.", body, crumbs: [["Genres", null]] }));
}
for (const g of genres) {
  const w = W.genres[g.id] || {};
  const gt = tracks.filter((t) => t.genre === g.id).sort((a, b) => a.year - b.year);
  const labels = [...new Set(gt.map((t) => t.label))], cities = [...new Set(gt.map((t) => t.city))];
  const gear = [...new Set(gt.flatMap((t) => t.gear).filter((x) => MA[x]))];
  const srcIds = [...new Set(gt.flatMap((t) => [t.archive_ref.source, ...(t.further_reading || [])]))].filter((id) => SO[id]);
  srcIds.sort((a, b) => linked(b).filter((t) => t.genre === g.id).length - linked(a).filter((t) => t.genre === g.id).length);
  const idx = genres.indexOf(g), prev = genres[idx - 1], next = genres[idx + 1];
  const years = gt.length ? `${gt[0].year}–${gt.at(-1).year}` : "";
  const body = `
<p class="lede">${esc(w.lede || g.style)}</p>
<div class="genre-layout">
<div class="prose">
  ${(w.story || []).map((p) => `<p>${esc(p)}</p>`).join("")}
  <h2>Le son</h2><p>${esc(g.style)}</p>
  <h2>Disques clés</h2>
  <ol class="tlist">${gt.map((t) => trackCard(t)).join("")}</ol>
  ${listenAll(gt)}
</div>
<aside class="facts" aria-label="Repères">
  <dl>
    <dt>Ère</dt><dd>${esc(E[g.era].name)} (${esc(E[g.era].range)})</dd>
    ${years ? `<dt>Disques du wiki</dt><dd>${years}</dd>` : ""}
    <dt>Villes</dt><dd>${cities.map(esc).join(", ")}</dd>
    <dt>Labels</dt><dd>${labels.map(esc).join(", ")}</dd>
    ${w.places ? `<dt>Lieux</dt><dd>${w.places.map(esc).join(", ")}</dd>` : ""}
    ${w.figures ? `<dt>Figures</dt><dd>${w.figures.map(esc).join(", ")}</dd>` : ""}
    ${gear.length ? `<dt>Machines</dt><dd class="tags">${gear.map(gearHtml).join(" ")}</dd>` : ""}
  </dl>
  ${srcIds.length ? `<h2>Pour lire</h2><div class="srcs">${srcIds.slice(0, 6).map((id) => sourceLink(SO[id])).join("")}</div>` : ""}
</aside>
</div>
<nav class="pager" aria-label="Genres voisins">${prev ? `<a href="${U.genre(prev.id)}">← ${esc(prev.name)}</a>` : "<span></span>"}${next ? `<a href="${U.genre(next.id)}">${esc(next.name)} →</a>` : ""}</nav>`;
  emit(U.genre(g.id), page({ path: U.genre(g.id), title: `${g.name} : histoire, disques et machines`, h1: esc(g.name), kicker: `${g.family === "cousin" ? "Lignée voisine" : "Sous-genre"} · ${esc(E[g.era].range)}`,
    description: w.lede || g.style, body, color: g.color, crumbs: [["Genres", U.genres], [g.name, null]],
    jsonld: { "@context": "https://schema.org", "@type": "Article", headline: `${g.name} : histoire, disques et machines`, inLanguage: "fr", about: { "@type": "MusicGenre", name: g.name } } }));
}
function listenAll(list) {
  const ids = list.filter((t) => t.youtube?.length).map((t) => t.id);
  return ids.length ? `<p><a class="btn" href="${U.player}#q=${ids.join(",")}">▶ Écouter ces ${ids.length} disques dans le lecteur</a></p>` : "";
}

// ---------- MORCEAUX ----------
{
  const byLabel = {};
  for (const t of tracks) (byLabel[t.label] ||= []).push(t);
  const body = `<p class="intro">Les ${tracks.length} disques du wiki, du plus ancien au plus récent. Chaque fiche raconte la construction du morceau, ses producteurs, son club, son axe queer et ses sources.</p>
  <ol class="tlist cols">${tracks.slice().sort((a, b) => a.year - b.year).map((t) => trackCard(t, ` · <a href="${U.genre(t.genre)}">${esc(G[t.genre].name)}</a>`)).join("")}</ol>
  <h2 id="labels">Par label</h2>
  <div class="labels">${Object.keys(byLabel).sort((a, b) => a.localeCompare(b)).map((l) => `<section id="label-${slug(l)}"><h3>${esc(l)}</h3><ul>${byLabel[l].map((t) => `<li><a href="${U.track(t.id)}">${esc(t.artist)} — ${esc(t.title)}</a> <small>${t.year}</small></li>`).join("")}</ul></section>`).join("")}</div>`;
  emit(U.tracks, page({ path: U.tracks, title: "Tous les morceaux", description: `Les ${tracks.length} disques du wiki House Intelligence, de MFSB (1973) à Tyla (2023), classés par année et par label.`, body, crumbs: [["Morceaux", null]] }));
}
for (const t of tracks) {
  const g = G[t.genre], src = SO[t.archive_ref.source];
  const sameG = tracks.filter((x) => x.genre === t.genre && x.id !== t.id);
  const sameL = tracks.filter((x) => x.label === t.label && x.id !== t.id);
  const tr = transitions(t);
  const body = `
<p class="lede">${esc(t.why_this_record)}</p>
<ul class="meta-line">
  <li><a href="${U.genre(g.id)}" class="gchip" style="--c:${g.color}"><span class="dot"></span>${esc(g.name)}</a></li>
  <li>${t.year}</li><li>${esc(t.city)}, ${esc(t.country)}</li><li><a href="${U.label(t.label)}">${esc(t.label)}</a></li>
</ul>
${listen(t)}
<div class="genre-layout">
<div class="prose">
  <h2>Construction</h2><p>${esc(t.construction)}</p>
  <p class="tags">${t.gear.map(gearHtml).join(" ")}</p>
  <h2>Origines et approche du producteur</h2><p>${esc(t.producer_origins)}</p>
  <h2>Sociologie du club</h2><p>${esc(t.club_sociology)}</p>
  <h2>Axe ballroom et scènes queer</h2><p>${esc(t.queer_ballroom_axis)}</p>
  <h2>Sources</h2>
  <div class="srcs">${src ? sourceLink(src, t.archive_ref.note) : ""}${(t.further_reading || []).filter((id) => SO[id]).map((id) => sourceLink(SO[id])).join("")}</div>
  <details class="dj">
    <summary><span>Analyse DJ</span> <small>BPM, clé Camelot, transitions compatibles</small></summary>
    <dl class="dj-grid"><div><dt>BPM</dt><dd>${t.bpm}</dd></div><div><dt>Clé Camelot</dt><dd>${t.camelot_key} <small>${KEY_NAMES[t.camelot_key]}</small></dd></div><div><dt>Énergie</dt><dd>${t.energy}/10</dd></div></dl>
    <p class="small">Le système Camelot numérote les tonalités de 1 à 12 (A = mineur, B = majeur) : deux disques voisins sur la roue se mixent sans fausse note. Valeurs indicatives.</p>
    <h3>Transitions les plus compatibles</h3>
    <ol class="trans">${tr.map((r) => `<li><a href="${U.track(r.x.id)}">${esc(r.x.artist)} — ${esc(r.x.title)}</a><span><b class="score" style="--s:${Math.round(r.score * 100)}">${Math.round(r.score * 100)}</b> ${t.camelot_key} → ${r.x.camelot_key} (${esc(r.kl)}) · ${r.delta >= 0 ? "+" : ""}${r.delta} BPM</span></li>`).join("")}</ol>
    <p><a class="btn" href="${U.booth}#${t.id}">Ouvrir dans le Booth DJ →</a></p>
  </details>
</div>
<aside class="facts" aria-label="Fiche technique">
  <dl>
    <dt>Artiste</dt><dd>${esc(t.artist)}</dd><dt>Titre</dt><dd>${esc(t.title)}</dd>
    <dt>Année</dt><dd>${t.year}</dd><dt>Label</dt><dd><a href="${U.label(t.label)}">${esc(t.label)}</a></dd>
    <dt>Ville</dt><dd>${esc(t.city)} (${esc(t.country)})</dd><dt>Genre</dt><dd><a href="${U.genre(g.id)}">${esc(g.name)}</a></dd>
    <dt>Ère</dt><dd>${esc(E[t.era].name)}</dd>
  </dl>
  <h2>Écouter ailleurs</h2>${ext(t)}
  ${sameG.length ? `<h2>Même genre</h2><ul class="mini-list">${sameG.map((x) => `<li><a href="${U.track(x.id)}">${esc(x.artist)} — ${esc(x.title)}</a> <small>${x.year}</small></li>`).join("")}</ul>` : ""}
  ${sameL.length ? `<h2>Même label</h2><ul class="mini-list">${sameL.map((x) => `<li><a href="${U.track(x.id)}">${esc(x.artist)} — ${esc(x.title)}</a></li>`).join("")}</ul>` : ""}
</aside>
</div>`;
  emit(U.track(t.id), page({ path: U.track(t.id), title: `${t.artist} — ${t.title} (${t.year})`, h1: `${esc(t.title)} <span class="h1-artist">${esc(t.artist)}</span>`,
    kicker: `${esc(g.name)} · ${t.year} · ${esc(t.city)}`, description: `${t.artist}, « ${t.title} » (${t.label}, ${t.year}). ${t.why_this_record}`, body, color: g.color,
    crumbs: [["Genres", U.genres], [g.name, U.genre(g.id)], [t.title, null]],
    jsonld: { "@context": "https://schema.org", "@type": "MusicRecording", name: t.title, byArtist: { "@type": "MusicGroup", name: t.artist }, genre: g.name, datePublished: String(t.year), recordLabel: t.label, url: SITE_URL + U.track(t.id) } }));
}

// ---------- MACHINES ----------
{
  const body = `<p class="intro">Presque toutes les machines de la house ont été conçues pour autre chose. Leur détournement fait le son du genre.</p>
  <ul class="gcards">${machines.map((m) => `<li><a class="gcard" href="${U.machine(m.id)}"><span class="gname">${esc(m.name)}</span><span class="gera">${esc(m.maker)} · ${m.year}</span><span class="glede">${esc(clip(m.hijack, 150))}</span></a></li>`).join("")}</ul>`;
  emit(U.machines, page({ path: U.machines, title: "Les machines de la house", description: "TR-808, TR-909, TB-303, DX100, MPC60, SP-1200, Korg M1, log drum : comment la house a détourné ses instruments.", body, crumbs: [["Machines", null]] }));
}
for (const m of machines) {
  const mt = tracks.filter((t) => t.gear.includes(m.id) || m.tracks.includes(t.id));
  const body = `<p class="lede">${esc(m.hijack)}</p>
<div class="genre-layout"><div class="prose">
  <h2>Usage prévu</h2><p>${esc(m.intended_use)}</p>
  <h2>Signature sonore</h2><p>${esc(m.signature)}</p>
  <h2>Dans la house</h2><p>${esc(m.house_usage)}</p>
  <h2>Anecdote</h2><p>${esc(m.trivia)}</p>
  <h2>Disques du wiki</h2><ol class="tlist">${mt.map((t) => trackCard(t)).join("")}</ol>
  ${listenAll(mt)}
</div><aside class="facts"><dl><dt>Fabricant</dt><dd>${esc(m.maker)}</dd><dt>Année</dt><dd>${m.year}</dd><dt>Type</dt><dd>${esc(m.type)}</dd></dl>
  <p><a class="btn" href="${U.booth}">Entendre un pulse dans le Booth →</a></p></aside></div>`;
  emit(U.machine(m.id), page({ path: U.machine(m.id), title: `${m.name} : histoire d'un détournement`, h1: esc(m.name), kicker: `${esc(m.maker)} · ${m.year} · ${esc(m.type)}`,
    description: m.hijack, body, crumbs: [["Machines", U.machines], [shortMachine(m), null]] }));
}

// ---------- BIBLIOTHÈQUE ----------
const srcType = (s) => /film/i.test(s.type) ? "film" : /magazine/i.test(s.type) ? "magazine" : "livre";
{
  const sorted = sources.slice().sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
  const body = `<p class="intro">Les ${sources.length} références du projet : livres, films et magazines, chacune reliée aux disques qu'elle éclaire.</p>
  <div class="lib-tools" data-lib><div class="chips" role="group" aria-label="Filtrer par type">
    ${[["all", "Tout", sources.length], ["livre", "Livres"], ["film", "Films"], ["magazine", "Magazines"]].map(([k, l, n]) => `<button type="button" class="chip" data-type="${k}" aria-pressed="${k === "all"}">${l} <span class="n">${n ?? sources.filter((s) => srcType(s) === k).length}</span></button>`).join("")}
  </div><label class="search"><span class="sr-only">Chercher dans la bibliothèque</span><input type="search" placeholder="Chercher un titre, un auteur, un thème…" data-lib-search></label></div>
  <ul class="lib-grid">${sorted.map((s) => { const n = linked(s.id).length; return `<li data-type="${srcType(s)}" data-text="${esc([s.title, s.author, ...(s.themes || [])].join(" ").toLowerCase())}"><a class="lib-card" href="${U.source(s.id)}">
    <span class="lt">${esc(s.type.split("(")[0].trim())}${s.year ? " · " + s.year : ""}</span><b>${esc(s.title)}</b><span class="la">${esc(s.author)}</span>
    <span class="lc">${esc(clip(s.contribution, 170))}</span><span class="lf">${n} disque${n > 1 ? "s" : ""} lié${n > 1 ? "s" : ""}</span></a></li>`; }).join("")}</ul>`;
  emit(U.lib, page({ path: U.lib, title: "La Bibliothèque de la house", description: "Livres, films et magazines de référence sur la house, la disco, la techno et la rave : Last Night a DJ Saved My Life, Energy Flash, Paris Is Burning…", body, crumbs: [["Bibliothèque", null]] }));
}
for (const s of sources) {
  const lt = linked(s.id).sort((a, b) => a.year - b.year);
  const body = `<p class="lede">${esc(s.contribution)}</p>
<div class="genre-layout"><div class="prose">
  <h2>Disques éclairés par cette référence</h2>
  ${lt.length ? `<ol class="tlist">${lt.map((t) => trackCard(t, t.archive_ref.source === s.id ? ` · <em>${esc(t.archive_ref.note)}</em>` : "")).join("")}</ol>${listenAll(lt)}` : "<p>Aucun disque n'est encore rattaché à cette référence.</p>"}
</div><aside class="facts"><dl><dt>Auteur</dt><dd>${esc(s.author)}</dd>${s.year ? `<dt>Année</dt><dd>${s.year}</dd>` : ""}<dt>Type</dt><dd>${esc(s.type)}</dd>
  <dt>Thèmes</dt><dd class="tags">${(s.themes || []).map((x) => `<span class="tag plain">${esc(x)}</span>`).join(" ")}</dd>
  ${s.genres?.length ? `<dt>Genres</dt><dd>${s.genres.filter((g) => G[g]).map((g) => `<a href="${U.genre(g)}">${esc(G[g].name)}</a>`).join(", ")}</dd>` : ""}</dl></aside></div>`;
  const type = srcType(s);
  emit(U.source(s.id), page({ path: U.source(s.id), title: `${s.title.split(":")[0]} (${s.author.split(/[,;(]/)[0].trim()})`, h1: esc(s.title), kicker: `${esc(s.type.split("(")[0].trim())}${s.year ? " · " + s.year : ""}`,
    description: s.contribution, body, crumbs: [["Bibliothèque", U.lib], [s.title.split(":")[0], null]],
    jsonld: { "@context": "https://schema.org", "@type": type === "film" ? "Movie" : type === "magazine" ? "Periodical" : "Book", name: s.title, author: s.author, ...(s.year ? { datePublished: String(s.year) } : {}), inLanguage: "fr" } }));
}

// ---------- LECTEUR ----------
{
  const groups = genres.map((g) => ({ g, list: tracks.filter((t) => t.genre === g.id).sort((a, b) => a.year - b.year) })).filter((x) => x.list.length);
  const body = `<p class="intro">Les ${tracks.length} disques classés par style, en écoute intégrale. Les vidéos viennent de YouTube (chaînes officielles quand elles existent, sinon téléversements de passionnés) et ne se chargent qu'au moment où vous lancez la lecture.</p>
<div class="player" data-player>
  <div class="player-main">
    <div class="yt-frame"><div id="yt-player"></div><p class="yt-empty">Choisissez un disque ▶</p></div>
    <p class="player-now" aria-live="polite"></p>
    <div class="player-controls" role="group" aria-label="Commandes">
      <button type="button" class="btn" data-act="prev" aria-label="Disque précédent">⏮</button>
      <button type="button" class="btn primary" data-act="toggle" aria-label="Lecture ou pause">▶</button>
      <button type="button" class="btn" data-act="next" aria-label="Disque suivant">⏭</button>
      <button type="button" class="btn" data-act="shuffle" aria-pressed="false">Aléatoire</button>
    </div>
  </div>
  <div class="player-list">
    <label class="search"><span class="sr-only">Chercher</span><input type="search" placeholder="Chercher un artiste, un titre, un label…" data-pl-search></label>
    ${groups.map(({ g, list }) => `<section class="pl-group" style="--c:${g.color}"><h2><span class="dot"></span><a href="${U.genre(g.id)}">${esc(g.name)}</a> <small>${list.length}</small>
      <button type="button" class="btn sm" data-play-group="${g.id}">▶ Tout le style</button></h2><p class="style">${esc(g.style)}</p>
      <ol>${list.map((t) => `<li class="pl-row" data-id="${t.id}" data-yt='${esc(JSON.stringify(t.youtube || []))}' data-genre="${g.id}" data-text="${esc((t.title + " " + t.artist + " " + t.label + " " + t.city).toLowerCase())}">
        <button type="button" class="pb" aria-label="Écouter ${esc(t.title)}"${t.youtube?.length ? "" : " disabled"}>▶</button>
        <span class="tt"><a href="${U.track(t.id)}">${esc(t.title)}</a><small>${esc(t.artist)} · ${esc(t.label)}</small></span><span class="rt">${t.year}</span></li>`).join("")}</ol></section>`).join("")}
  </div>
</div>`;
  emit(U.player, page({ path: U.player, title: "Le Lecteur : écouter l'histoire de la house", description: `Écoutez les ${tracks.length} disques du wiki, de la disco à l'amapiano, classés par style.`, body, crumbs: [["Lecteur", null]], bodyClass: "has-player" }));
}

// ---------- sitemap / robots ----------
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...out, U.booth].map((p) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
writeFileSync(join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`${out.length} pages générées + sitemap.xml + robots.txt`);
