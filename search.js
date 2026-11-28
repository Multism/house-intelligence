/* HOUSE INTELLIGENCE — recherche rapide (Cmd/Ctrl+K, « / » ou la loupe de l'en-tête).
 * Un seul index pour tout le site : disques du Booth, fiches Deep Digging, artistes (vrais noms, alias, membres),
 * labels, stations du métro, micro-scènes, machines et Bibliothèque. Chaque résultat mène à sa vue.
 * Dépend de window.HI (exposé par app.js). */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  let index = null, results = [], sel = 0;

  function build() {
    const { S, _f, norm } = window.HI;
    const out = [], seen = new Set();
    const add = (kind, label, sub, keys, go) => out.push({ kind, label, sub, hay: norm([label, sub, ...keys].join(" ")), lab: norm(label), go });
    for (const t of S.tracks) add("track", `${t.artist} — ${t.title}`, `${t.label} · ${t.year}`, [t.catalog, t.city], () => { location.hash = "#" + t.id; });
    for (const e of S.dig?.entries || []) add("dig", `${e.artist} — ${e.title}`, `${e.label}${e.catalog ? " · " + e.catalog : ""} · ${e.year}`, [...(e.tracks || [])], () => window.HI.digOpen(e.id));
    for (const e of S.discEntries || []) add("disc", `${e.artist || e.author ? (e.artist || e.author) + " — " : ""}${e.title}`, [e.label || e.publisher, e.year].filter(Boolean).join(" · "), [],
      () => { location.hash = "#decouverte"; setTimeout(() => document.getElementById("d-" + e.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120); });
    const artists = new Map();
    for (const r of [...S.tracks, ...(S.dig?.entries || [])]) { const k = norm(r.artist); if (!artists.has(k)) artists.set(k, { name: r.artist, n: 0 }); artists.get(k).n++; }
    for (const a of S.dig?.artists || []) { const k = norm(a.name); if (!artists.has(k)) artists.set(k, { name: a.name, n: 0 }); artists.get(k).meta = a; }
    for (const { name, n, meta } of artists.values()) {
      if (n < 2 && !meta) continue;   // un artiste à un seul disque est déjà trouvé par son disque
      add("artist", name, [meta?.real_name, ...(meta?.aliases || [])].filter(Boolean).join(", "), meta?.members || [], () => window.HI.digGo(name));
    }
    for (const l of new Set([...S.tracks, ...(S.dig?.entries || [])].map((r) => r.label.trim()))) {
      const k = norm(l); if (seen.has(k)) continue; seen.add(k);
      const meta = S.dig?.labelByName?.[l.toLowerCase()];
      add("label", l, meta ? _f(meta, "city") || "" : "", [], () => window.HI.digGo(l));
    }
    for (const [id, st] of Object.entries(S.stations || {})) {
      const line = (S.lines || []).find((x) => x.stations.includes(id));
      add("station", _f(st, "name"), [line ? `L${line.num} · ${_f(line, "name")}` : "", st.years].filter(Boolean).join(" · "), [st.name, st.name_en], () => { location.hash = `#metro?st=${id}`; });
    }
    for (const sc of S.scenes || []) add("scene", _f(sc, "name"), "", [sc.name, sc.name_en], () => window.HI.digGo("", sc.id));
    for (const m of S.machines || []) add("machine", _f(m, "name"), `${_f(m, "maker")} · ${m.year}`, [m.id], () => window.HI.openMachine(m.id));
    for (const s of S.sources || []) add("source", s.title, _f(s, "author"), [], () => { location.hash = "#bibliotheque"; window.HI.openSource(s.id); });
    return out;
  }

  const ORDER = ["station", "artist", "label", "track", "dig", "disc", "scene", "machine", "source"];
  function search(q) {
    const { norm } = window.HI;
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return index.map((r) => {
      if (!words.every((w) => r.hay.includes(w))) return null;
      const lead = r.lab.startsWith(words[0]) ? 0 : r.lab.split(/[\s—/(-]+/).some((p) => p.startsWith(words[0])) ? 1 : 2;
      return { r, score: lead * 10 + ORDER.indexOf(r.kind) };
    }).filter(Boolean).sort((a, b) => a.score - b.score || a.r.label.localeCompare(b.r.label)).slice(0, 14).map((x) => x.r);
  }

  function render() {
    const { h, _t } = window.HI;
    const q = $("#qs-input").value;
    results = search(q); sel = Math.min(sel, Math.max(0, results.length - 1));
    $("#qs-list").replaceChildren(...(results.length ? results.map((r, i) =>
      h("li", { role: "option", id: "qs-" + i, "aria-selected": i === sel ? "true" : "false", class: "qs-item", onmousemove: () => { if (sel !== i) { sel = i; mark(); } }, onclick: () => pick(i) },
        h("span", { class: "qs-kind k-" + r.kind }, _t("qs.kind." + r.kind)),
        h("span", { class: "qs-label" }, r.label),
        r.sub ? h("span", { class: "qs-sub" }, r.sub) : null))
      : [h("li", { class: "qs-empty" }, q.trim() ? _t("qs.none") : _t("qs.hint"))]));
    mark();
  }
  function mark() {
    for (const el of document.querySelectorAll("#qs-list .qs-item")) el.setAttribute("aria-selected", el.id === "qs-" + sel ? "true" : "false");
    $("#qs-input").setAttribute("aria-activedescendant", results.length ? "qs-" + sel : "");
    $("#qs-" + sel)?.scrollIntoView({ block: "nearest" });
  }
  function pick(i) { const r = results[i]; if (!r) return; $("#qs").close(); r.go(); }

  function open() {
    if (!window.HI?.S?.tracks) return;
    index = build();   // reconstruit à chaque ouverture : suit la langue courante
    const d = $("#qs"); if (!d.open) d.showModal();
    $("#qs-input").select(); sel = 0; render();
  }

  function init() {
    $("#qs-open").addEventListener("click", open);
    $("#qs-input").addEventListener("input", () => { sel = 0; render(); });
    $("#qs-input").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
      else if (e.key === "Enter") { e.preventDefault(); pick(sel); }
      else if (e.key === "Escape") { e.preventDefault(); $("#qs").close(); }
    });
    $("#qs").addEventListener("click", (e) => { if (e.target === $("#qs")) $("#qs").close(); });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#qs").open ? $("#qs").close() : open(); return; }
      if (e.key === "/" && !e.target.closest("input, textarea, select, [contenteditable]") && !document.querySelector("dialog[open]")) { e.preventDefault(); open(); }
    });
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    $("#qs-open kbd").textContent = mac ? "⌘K" : "Ctrl K";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
