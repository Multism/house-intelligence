// Génère une page HTML statique par disque et par station (FR + EN), les index, et le sitemap.
// Aucune dépendance : node tools/build-pages.mjs
// À relancer après toute modification de data/*.json (après node tools/bundle-data.mjs).
//
// Sortie (fichiers générés, à committer et déployer avec le reste du site) :
//   disques/<id>/index.html          en/records/<id>/index.html
//   stations/<id>/index.html         en/stations/<id>/index.html
//   disques/index.html  stations/index.html  en/records/index.html  en/stations/index.html
//   sitemap.xml
// Les images de partage (og/<type>/<id>.jpg) sont produites à part par tools/og-images.mjs ;
// une page sans image dédiée retombe sur /og-image.png.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Le jour où le domaine définitif est attaché : changer cette ligne (et robots.txt, index.html).
const SITE = "https://house-intelligence.pages.dev";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(readFileSync(join(ROOT, "data", f + ".json"), "utf8"));
const { tracks, genres, eras } = read("tracks");
const { machines } = read("machines");
const { sources } = read("sources");
const metro = read("metro");
const stations = metro.stations; // objet { id: station }
const lines = metro.lines;

const byTrack = Object.fromEntries(tracks.map((t) => [t.id, t]));
const byGenre = Object.fromEntries(genres.map((g) => [g.id, g]));
const byEra = Object.fromEntries(eras.map((e) => [e.id, e]));
const byMachine = Object.fromEntries(machines.map((m) => [m.id, m]));
const bySource = Object.fromEntries(sources.map((s) => [s.id, s]));

// ---------- textes d'interface ----------
const L = {
  fr: {
    htmlLang: "fr", ogLocale: "fr_FR", ogAlt: "en_GB",
    records: "Disques", stations: "Stations", home: "Plan du métro",
    recordsPath: "disques", stationsPath: "stations", prefix: "",
    why: "Pourquoi ce disque", construction: "Construction", origins: "Origines et approche producteur",
    club: "Sociologie du club", queer: "Axe ballroom & scènes queer",
    gear: "Machines", source: "Référence", inStations: "Sur le plan du métro", sameStation: "Dans la même station",
    year: "Année", label: "Label", city: "Ville", bpm: "BPM", key: "Clé Camelot", energy: "Énergie", genre: "Genre", era: "Ère",
    openBooth: "Ouvrir dans The Booth", listen: "Écouter sur YouTube", openMap: "Voir sur le plan du métro",
    lines: "Lignes", stationRecords: "Les disques de la station", connected: "Stations reliées", transfer: "Correspondance",
    allRecords: (n) => `Les ${n} disques`, allStations: (n) => `Les ${n} stations`,
    recordsIntro: (n) => `${n} disques qui racontent la house, de la disco du Loft à l'amapiano. Chaque fiche détaille la construction du morceau, ses machines, son contexte social et ses sources.`,
    stationsIntro: (n, l) => `${n} stations et ${l} lignes : le plan généalogique de la house, des clubs fondateurs aux scènes d'aujourd'hui.`,
    otherLang: "English", otherLangCode: "en",
    foot: "House Intelligence — généalogie, machines et sociologie de la house. BPM et clés : valeurs éditoriales indicatives.",
    stationTitle: (s) => `${s.name} (${s.years}) — station du plan de la house`,
    recordTitle: (t) => `${t.title} — ${t.artist} (${t.year})`,
    recordsTitle: "Les disques de la house, fiche par fiche",
    stationsTitle: "Les stations du plan généalogique de la house",
  },
  en: {
    htmlLang: "en", ogLocale: "en_GB", ogAlt: "fr_FR",
    records: "Records", stations: "Stations", home: "Metro map",
    recordsPath: "records", stationsPath: "stations", prefix: "/en",
    why: "Why this record", construction: "How it was made", origins: "Origins and production approach",
    club: "Club sociology", queer: "Ballroom & queer scenes",
    gear: "Machines", source: "Reference", inStations: "On the metro map", sameStation: "In the same station",
    year: "Year", label: "Label", city: "City", bpm: "BPM", key: "Camelot key", energy: "Energy", genre: "Genre", era: "Era",
    openBooth: "Open in The Booth", listen: "Listen on YouTube", openMap: "See it on the metro map",
    lines: "Lines", stationRecords: "Records in this station", connected: "Connected stations", transfer: "Transfer",
    allRecords: (n) => `All ${n} records`, allStations: (n) => `All ${n} stations`,
    recordsIntro: (n) => `${n} records that tell the story of house, from disco at the Loft to amapiano. Each entry covers how the track was made, its machines, its social context and its sources.`,
    stationsIntro: (n, l) => `${n} stations and ${l} lines: the family tree of house, from the founding clubs to today's scenes.`,
    otherLang: "Français", otherLangCode: "fr",
    foot: "House Intelligence — the genealogy, machines and sociology of house music. BPM and keys are indicative editorial values.",
    stationTitle: (s) => `${s.name_en || s.name} (${s.years}) — a station on the house music map`,
    recordTitle: (t) => `${t.title} — ${t.artist} (${t.year})`,
    recordsTitle: "House music records, one by one",
    stationsTitle: "The stations of the house music family tree",
  },
};

// ---------- utilitaires ----------
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f = (obj, field, lang) => (obj == null ? "" : lang === "en" && obj[field + "_en"] != null ? obj[field + "_en"] : obj[field] ?? "");
const clip = (s, n = 158) => {
  s = String(s).replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
};
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

const recordPath = (lang, id) => `${L[lang].prefix}/${L[lang].recordsPath}/${id}/`;
const stationPath = (lang, id) => `${L[lang].prefix}/${L[lang].stationsPath}/${id}/`;
const recordsIndex = (lang) => `${L[lang].prefix}/${L[lang].recordsPath}/`;
const stationsIndex = (lang) => `${L[lang].prefix}/${L[lang].stationsPath}/`;
const appUrl = (lang, hash) => (lang === "en" ? "/?lang=en" : "/") + hash;
const ogImage = (type, id) => (existsSync(join(ROOT, "og", type, id + ".jpg")) ? `${SITE}/og/${type}/${id}.jpg` : `${SITE}/og-image.png`);

// ---------- relations disques ↔ stations ----------
const stationTracks = {};
for (const [sid, s] of Object.entries(stations)) {
  const ids = new Set(s.tracks || []);
  for (const t of tracks) if ((s.genres || []).includes(t.genre)) ids.add(t.id);
  stationTracks[sid] = [...ids].filter((id) => byTrack[id]).sort((a, b) => byTrack[a].year - byTrack[b].year);
}
const trackStations = {};
for (const [sid, ids] of Object.entries(stationTracks)) for (const id of ids) (trackStations[id] ||= []).push(sid);
const stationLines = {};
for (const l of lines) for (const sid of l.stations) (stationLines[sid] ||= []).push(l);
const stationNeighbours = {};
for (const sid of Object.keys(stations)) {
  const n = new Set(stations[sid].links || []);
  for (const l of stationLines[sid] || []) {
    const i = l.stations.indexOf(sid);
    if (l.stations[i - 1]) n.add(l.stations[i - 1]);
    if (l.stations[i + 1]) n.add(l.stations[i + 1]);
  }
  for (const tr of metro.transfers || []) { if (tr.a === sid) n.add(tr.b); if (tr.b === sid) n.add(tr.a); }
  n.delete(sid);
  stationNeighbours[sid] = [...n].filter((id) => stations[id]);
}

// ---------- gabarit ----------
function page({ lang, path, altPath, title, description, image, imageAlt, ogType = "article", ld = [], crumbs, body }) {
  const t = L[lang];
  const url = SITE + path;
  const frPath = lang === "fr" ? path : altPath;
  const enPath = lang === "en" ? path : altPath;
  const crumbsHtml = crumbs.map((c, i) => (i < crumbs.length - 1 ? `<a href="${c.href}">${esc(c.name)}</a>` : `<span aria-current="page">${esc(c.name)}</span>`)).join(` <span class="sep">/</span> `);
  const breadcrumbLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: SITE + c.href })),
  };
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} · House Intelligence</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="fr" href="${SITE}${frPath}">
<link rel="alternate" hreflang="en" href="${SITE}${enPath}">
<link rel="alternate" hreflang="x-default" href="${SITE}${frPath}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="House Intelligence">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:locale:alternate" content="${t.ogAlt}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${image}">
<meta name="theme-color" content="#0d0c0b">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/pages.css">
${[breadcrumbLd, ...ld].map(jsonLd).join("\n")}
</head>
<body>
<header class="top">
  <a class="logo" href="${appUrl(lang, "#metro")}">HOUSE<span>/</span>INTELLIGENCE</a>
  <nav class="nav">
    <a href="${appUrl(lang, "#metro")}">${t.home}</a>
    <a href="${recordsIndex(lang)}">${t.records}</a>
    <a href="${stationsIndex(lang)}">${t.stations}</a>
    <a href="${altPath}" hreflang="${t.otherLangCode}" lang="${t.otherLangCode}" class="lang">${t.otherLang}</a>
  </nav>
</header>
<main class="wrap">
<nav class="crumbs" aria-label="breadcrumb">${crumbsHtml}</nav>
${body}
</main>
<footer class="foot"><p>${esc(t.foot)}</p></footer>
</body>
</html>
`;
}

const chip = (href, label, color) => `<a class="chip" href="${href}"${color ? ` style="--c:${color}"` : ""}>${esc(label)}</a>`;
const section = (h, text) => (text ? `<section><h2>${esc(h)}</h2><p>${esc(text)}</p></section>` : "");
const recordItem = (lang, t) => `<li><a href="${recordPath(lang, t.id)}"><span class="ti">${esc(t.title)}</span> <span class="ar">${esc(t.artist)}</span> <span class="yr">${t.year}</span></a></li>`;
const stationName = (lang, s) => f(s, "name", lang);

// ---------- page disque ----------
function recordPage(t, lang) {
  const T = L[lang];
  const g = byGenre[t.genre], era = byEra[t.era];
  const why = f(t, "why_this_record", lang);
  const desc = clip(why || f(t, "construction", lang));
  const sts = trackStations[t.id] || [];
  const same = [...new Set(sts.flatMap((s) => stationTracks[s]))].filter((id) => id !== t.id).slice(0, 8).map((id) => byTrack[id]);
  const gear = (t.gear || []).map((id) => (byMachine[id] ? byMachine[id].name : id));
  const src = t.archive_ref?.source && bySource[t.archive_ref.source];
  const facts = [
    [T.year, t.year], [T.label, t.label], [T.city, [t.city, t.country].filter(Boolean).join(", ")],
    [T.genre, g ? f(g, "name", lang) : t.genre], [T.bpm, t.bpm], [T.key, t.camelot_key], [T.energy, t.energy != null ? `${t.energy}/10` : ""],
  ].filter(([, v]) => v !== "" && v != null);
  const yt = t.youtube?.[0];

  const body = `<article class="record">
<p class="kicker" style="--c:${g?.color || "#d4ff3a"}">${esc(era ? f(era, "name", lang) : "")}${g ? " · " + esc(f(g, "name", lang)) : ""}</p>
<h1>${esc(t.title)}</h1>
<p class="artist">${esc(t.artist)}</p>
<dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
<p class="cta"><a class="btn" href="${appUrl(lang, "#" + t.id)}">${T.openBooth}</a>${yt ? ` <a class="btn ghost" href="https://www.youtube.com/watch?v=${esc(yt)}" rel="noopener">${T.listen}</a>` : ""}</p>
${section(T.why, why)}
${section(T.construction, f(t, "construction", lang))}
${gear.length ? `<p class="chips">${gear.map((n) => `<span class="chip static">${esc(n)}</span>`).join("")}</p>` : ""}
${section(T.origins, f(t, "producer_origins", lang))}
${section(T.club, f(t, "club_sociology", lang))}
${section(T.queer, f(t, "queer_ballroom_axis", lang))}
${src ? `<section><h2>${T.source}</h2><p><cite>${esc(src.title)}</cite>${src.author ? " — " + esc(f(src, "author", lang)) : ""}${src.year ? ` (${src.year})` : ""}. ${esc(f(t.archive_ref, "note", lang))}</p></section>` : ""}
${sts.length ? `<section><h2>${T.inStations}</h2><p class="chips">${sts.map((sid) => chip(stationPath(lang, sid), stationName(lang, stations[sid]), stationLines[sid]?.[0]?.color)).join("")}</p></section>` : ""}
${same.length ? `<section><h2>${T.sameStation}</h2><ul class="list">${same.map((x) => recordItem(lang, x)).join("")}</ul></section>` : ""}
</article>`;

  const ld = {
    "@context": "https://schema.org", "@type": "MusicRecording",
    name: t.title, url: SITE + recordPath(lang, t.id),
    byArtist: { "@type": "MusicGroup", name: t.artist },
    datePublished: String(t.year), genre: g ? f(g, "name", lang) : undefined,
    recordLabel: t.label ? { "@type": "Organization", name: t.label } : undefined,
    description: desc, inLanguage: lang, image: ogImage("disques", t.id),
    isPartOf: { "@type": "WebSite", name: "House Intelligence", url: SITE + "/" },
  };
  return page({
    lang, path: recordPath(lang, t.id), altPath: recordPath(lang === "fr" ? "en" : "fr", t.id),
    title: T.recordTitle(t), description: desc, image: ogImage("disques", t.id),
    imageAlt: `${t.title} — ${t.artist} (${t.year})`, ld: [ld], ogType: "music.song",
    crumbs: [{ name: "House Intelligence", href: appUrl(lang, "") }, { name: T.records, href: recordsIndex(lang) }, { name: t.title, href: recordPath(lang, t.id) }],
    body,
  });
}

// ---------- page station ----------
function stationPage(sid, lang) {
  const T = L[lang];
  const s = stations[sid];
  const name = stationName(lang, s);
  const summary = f(s, "summary", lang);
  const desc = clip(summary);
  const ls = stationLines[sid] || [];
  const recs = stationTracks[sid].map((id) => byTrack[id]);
  const neigh = stationNeighbours[sid];
  const transfers = (metro.transfers || []).filter((tr) => tr.a === sid || tr.b === sid);
  const body = `<article class="station">
<p class="kicker" style="--c:${ls[0]?.color || "#d4ff3a"}">${esc(s.years)}</p>
<h1>${esc(name)}</h1>
${ls.length ? `<p class="chips">${ls.map((l) => `<span class="chip line" style="--c:${l.color}">L${l.num} · ${esc(f(l, "name", lang))}</span>`).join("")}</p>` : ""}
<p class="lead">${esc(summary)}</p>
<p class="cta"><a class="btn" href="${appUrl(lang, "#metro?st=" + sid)}">${T.openMap}</a></p>
${recs.length ? `<section><h2>${T.stationRecords} (${recs.length})</h2><ul class="list">${recs.map((x) => recordItem(lang, x)).join("")}</ul></section>` : ""}
${transfers.map((tr) => `<section><h2>${T.transfer} · ${esc(f(tr, "title", lang))}</h2><p>${esc(f(tr, "text", lang))}</p></section>`).join("")}
${neigh.length ? `<section><h2>${T.connected}</h2><p class="chips">${neigh.map((n) => chip(stationPath(lang, n), stationName(lang, stations[n]), stationLines[n]?.[0]?.color)).join("")}</p></section>` : ""}
</article>`;
  const ld = {
    "@context": "https://schema.org", "@type": "CollectionPage",
    name: T.stationTitle(s), url: SITE + stationPath(lang, sid), description: desc, inLanguage: lang,
    image: ogImage("stations", sid),
    hasPart: recs.map((x) => ({ "@type": "MusicRecording", name: x.title, url: SITE + recordPath(lang, x.id), byArtist: { "@type": "MusicGroup", name: x.artist } })),
    isPartOf: { "@type": "WebSite", name: "House Intelligence", url: SITE + "/" },
  };
  return page({
    lang, path: stationPath(lang, sid), altPath: stationPath(lang === "fr" ? "en" : "fr", sid),
    title: T.stationTitle(s), description: desc, image: ogImage("stations", sid), imageAlt: `${name} (${s.years})`, ld: [ld],
    crumbs: [{ name: "House Intelligence", href: appUrl(lang, "") }, { name: T.stations, href: stationsIndex(lang) }, { name, href: stationPath(lang, sid) }],
    body,
  });
}

// ---------- index ----------
function recordsIndexPage(lang) {
  const T = L[lang];
  const groups = eras.map((e) => ({ e, items: tracks.filter((t) => t.era === e.id).sort((a, b) => a.year - b.year) })).filter((g) => g.items.length);
  const body = `<h1>${T.allRecords(tracks.length)}</h1>
<p class="lead">${esc(T.recordsIntro(tracks.length))}</p>
${groups.map(({ e, items }) => `<section><h2>${esc(f(e, "name", lang))} <small>${esc(f(e, "range", lang))}</small></h2><ul class="list">${items.map((x) => recordItem(lang, x)).join("")}</ul></section>`).join("\n")}`;
  return page({
    lang, path: recordsIndex(lang), altPath: recordsIndex(lang === "fr" ? "en" : "fr"),
    title: T.recordsTitle, description: clip(T.recordsIntro(tracks.length)), image: `${SITE}/og-image.png`, imageAlt: "House Intelligence", ogType: "website",
    crumbs: [{ name: "House Intelligence", href: appUrl(lang, "") }, { name: T.records, href: recordsIndex(lang) }],
    body,
  });
}
function stationsIndexPage(lang) {
  const T = L[lang];
  const n = Object.keys(stations).length;
  const body = `<h1>${T.allStations(n)}</h1>
<p class="lead">${esc(T.stationsIntro(n, lines.length))}</p>
${lines.map((l) => `<section><h2><span class="dot" style="--c:${l.color}"></span>L${l.num} · ${esc(f(l, "name", lang))}</h2><ul class="list">${l.stations.filter((sid) => stations[sid]).map((sid) => `<li><a href="${stationPath(lang, sid)}"><span class="ti">${esc(stationName(lang, stations[sid]))}</span> <span class="yr">${esc(stations[sid].years)}</span></a></li>`).join("")}</ul></section>`).join("\n")}`;
  return page({
    lang, path: stationsIndex(lang), altPath: stationsIndex(lang === "fr" ? "en" : "fr"),
    title: T.stationsTitle, description: clip(T.stationsIntro(n, lines.length)), image: `${SITE}/og-image.png`, imageAlt: "House Intelligence", ogType: "website",
    crumbs: [{ name: "House Intelligence", href: appUrl(lang, "") }, { name: T.stations, href: stationsIndex(lang) }],
    body,
  });
}

// ---------- écriture ----------
const out = (rel, html) => { const p = join(ROOT, rel, "index.html"); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, html); };
for (const dir of ["disques", "stations", "en"]) rmSync(join(ROOT, dir), { recursive: true, force: true });

const urls = [{ fr: "/", en: "/?lang=en", priority: "1.0", onlyFr: true }];
for (const lang of ["fr", "en"]) {
  out(recordsIndex(lang), recordsIndexPage(lang));
  out(stationsIndex(lang), stationsIndexPage(lang));
  for (const t of tracks) out(recordPath(lang, t.id), recordPage(t, lang));
  for (const sid of Object.keys(stations)) out(stationPath(lang, sid), stationPage(sid, lang));
}
urls.push({ fr: recordsIndex("fr"), en: recordsIndex("en"), priority: "0.8" }, { fr: stationsIndex("fr"), en: stationsIndex("en"), priority: "0.8" });
for (const sid of Object.keys(stations)) urls.push({ fr: stationPath("fr", sid), en: stationPath("en", sid), priority: "0.7" });
for (const t of tracks) urls.push({ fr: recordPath("fr", t.id), en: recordPath("en", t.id), priority: "0.6" });

const today = new Date().toISOString().slice(0, 10);
const alt = (u) => `    <xhtml:link rel="alternate" hreflang="fr" href="${SITE}${u.fr}"/>\n    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${u.en}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${u.fr}"/>`;
const entry = (loc, u) => `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${u.priority}</priority>\n${u.onlyFr ? "" : alt(u) + "\n"}  </url>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- généré par tools/build-pages.mjs — ne pas éditer -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.flatMap((u) => (u.onlyFr ? [entry(u.fr, u)] : [entry(u.fr, u), entry(u.en, u)])).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap);
const n = (tracks.length + Object.keys(stations).length) * 2 + 4;
console.log(`${n} pages écrites (${tracks.length} disques, ${Object.keys(stations).length} stations, FR + EN, 4 index) ; sitemap.xml : ${urls.length * 2 - 1} URL.`);
