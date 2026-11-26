/* HOUSE INTELLIGENCE — Plan du Métro généalogique (SVG interactif)
 * Dépend de window.HI (exposé par app.js) et de data/metro.json. */
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const $ = (s, el = document) => el.querySelector(s);
  const M = { data: null, built: false, sel: null, focusLine: null, isolated: null, bubbleIdx: null };
  const T = (k, v) => window.I18N.t(k, v), F = (o, k) => window.I18N.f(o, k);

  const svgEl = (tag, attrs = {}, kids = []) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
    for (const k of kids) el.append(k);
    return el;
  };
  const linesOf = (sid) => M.data.lines.filter((l) => l.stations.includes(sid));
  function tracksOf(st) {
    const { S } = window.HI;
    const ids = new Set(st.tracks || []);
    for (const g of st.genres || []) for (const t of S.tracks) if (t.genre === g) ids.add(t.id);
    return [...ids].map((id) => S.byId[id]).filter(Boolean).sort((a, b) => a.year - b.year);
  }

  // ---------- construction du SVG ----------
  function build() {
    const svg = $("#metro-svg"); svg.replaceChildren();
    const { lines, stations, transfers } = M.data;
    // trame de fond
    const grid = svgEl("g", { class: "m-grid", "aria-hidden": "true" });
    for (let x = 40; x <= 1240; x += 40) grid.append(svgEl("line", { x1: x, y1: 0, x2: x, y2: 860 }));
    for (let y = 0; y <= 860; y += 40) grid.append(svgEl("line", { x1: 40, y1: y, x2: 1240, y2: y }));
    svg.append(grid);

    // correspondances (sous les lignes)
    const tg = svgEl("g", { class: "m-transfers" });
    transfers.forEach((tr, i) => {
      const a = stations[tr.a], b = stations[tr.b];
      const ls = [...new Set([...linesOf(tr.a), ...linesOf(tr.b)].map((l) => l.id))].join(" ");
      const g = svgEl("g", { class: "m-transfer", "data-lines": ls, "data-tr": i, tabindex: 0, role: "button", "aria-label": T("metro.transferAria", { t: F(tr, "title") }) }, [
        svgEl("line", { class: "hit", x1: a.x, y1: a.y, x2: b.x, y2: b.y }),
        svgEl("line", { class: "tube", x1: a.x, y1: a.y, x2: b.x, y2: b.y }),
        svgEl("line", { class: "dash", x1: a.x, y1: a.y, x2: b.x, y2: b.y }),
      ]);
      g.append(svgEl("title", {}, [document.createTextNode(F(tr, "title"))]));
      tg.append(g);
    });
    svg.append(tg);

    // lignes
    const lg = svgEl("g", { class: "m-lines" });
    for (const l of lines) {
      const d = l.path.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
      lg.append(svgEl("path", { class: "m-line", d, stroke: l.color, "data-lines": l.id }));
      // pastille de numéro au terminus de départ
      const [x0, y0] = l.path[0], [x1, y1] = l.path[1];
      const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      const [bx, by] = l.badge || [x0 - ux * 34, y0 - uy * 34];   // position manuelle possible (data/metro.json)
      lg.append(svgEl("g", { class: "m-badge", "data-lines": l.id }, [
        svgEl("circle", { cx: bx, cy: by, r: 13, fill: l.color }),
        Object.assign(svgEl("text", { x: bx, y: by + 0.5, style: l.color === "#e6007e" ? "fill:#fff" : null }), { textContent: l.num }),
      ]));
    }
    svg.append(lg);

    // stations
    const sg = svgEl("g", { class: "m-stations" });
    for (const [sid, st] of Object.entries(stations)) {
      const ls = linesOf(sid);
      const inter = st.interchange || ls.length > 1 || transfers.some((t) => t.a === sid || t.b === sid);
      const n = tracksOf(st).length;
      const g = svgEl("g", { class: "m-st" + (inter ? " inter" : "") + (n ? "" : " empty"), "data-st": sid, "data-lines": ls.map((l) => l.id).join(" "),
        tabindex: 0, role: "button", "aria-label": T("metro.stationAria", { s: F(st, "name"), n,
          lines: T(ls.length > 1 ? "metro.linesN" : "metro.line", { n: ls.map((l) => l.num).join(" & ") }) }) });
      if (inter) {
        g.append(svgEl("circle", { class: "ring", cx: st.x, cy: st.y, r: 13 }), svgEl("circle", { class: "core", cx: st.x, cy: st.y, r: 7 }));
      } else {
        g.append(svgEl("circle", { class: "dot", cx: st.x, cy: st.y, r: 8, stroke: ls[0]?.color || "#fff" }));
      }
      g.append(label(st));
      sg.append(g);
    }
    svg.append(sg);

    // interactions (posées une seule fois : le SVG est reconstruit au changement de langue)
    if (!M.built) {
      svg.addEventListener("click", onClick);
      svg.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.closest(".m-st, .m-transfer")) { e.preventDefault(); onClick(e); } });
    }
    M.built = true;
  }

  function label(st) {
    const name = F(st, "name");
    const words = name.length > 16 ? splitName(name) : [name];
    const pos = st.label || "below";
    let x = st.x, y = st.y, anchor = "middle";
    const dy = 17 * (words.length - 1);
    if (pos === "above") y -= 30 + dy;
    else if (pos === "below") y += 30;
    else if (pos === "left") { x -= 20; anchor = "end"; y += 4 - dy / 2; }
    else if (pos === "right") { x += 20; anchor = "start"; y += 4 - dy / 2; }
    else if (pos === "below-left") { x -= 14; y += 30; anchor = "end"; }
    else if (pos === "below-right") { x += 14; y += 30; anchor = "start"; }
    else if (pos === "above-right") { x += 14; y -= 30 + dy; anchor = "start"; }
    const t = svgEl("text", { class: "m-label", x, y, "text-anchor": anchor });
    words.forEach((w, i) => t.append(Object.assign(svgEl("tspan", { x, dy: i ? 17 : 0 }), { textContent: w })));
    const yrs = svgEl("tspan", { x, dy: 15, class: "m-years", "aria-hidden": "true" }); yrs.textContent = F(st, "years"); t.append(yrs);
    return t;
  }
  function splitName(name) {
    const m = name.match(/^(.*?)\s(\(.*\))$/);
    if (m) return [m[1], m[2]];
    const i = name.indexOf(" & ");
    if (i > 0) return [name.slice(0, i + 2), name.slice(i + 3)];
    const mid = name.lastIndexOf(" ", Math.ceil(name.length / 2));
    return mid > 0 ? [name.slice(0, mid), name.slice(mid + 1)] : [name];
  }

  // ---------- légende ----------
  function legend() {
    const ul = $("#metro-legend"); ul.replaceChildren();
    const { h } = window.HI;
    for (const l of M.data.lines) {
      const b = h("button", { class: "m-leg", style: `--lc:${l.color}`, "aria-pressed": M.isolated === l.id ? "true" : "false",
        onmouseenter: () => focusLine(l.id), onmouseleave: () => focusLine(null), onfocus: () => focusLine(l.id), onblur: () => focusLine(null),
        onclick: () => { M.isolated = M.isolated === l.id ? null : l.id; legend(); focusLine(null); updateHash(); } },
        h("span", { class: "num" }, String(l.num)), F(l, "name"));
      ul.append(h("li", {}, b));
    }
  }
  function focusLine(id) {
    M.focusLine = id;
    const active = id || M.isolated;
    for (const el of $("#metro-svg").querySelectorAll("[data-lines]")) {
      el.classList.toggle("dim", !!active && !el.dataset.lines.split(" ").includes(active));
    }
  }

  // ---------- sélection ----------
  function onClick(e) {
    const st = e.target.closest(".m-st"), tr = e.target.closest(".m-transfer");
    if (st) select(st.dataset.st);
    else if (tr) bubble(+tr.dataset.tr);
  }
  function select(sid, { scroll = true } = {}) {
    const st = M.data.stations[sid]; if (!st) return;
    M.sel = sid; hideBubble();
    for (const g of $("#metro-svg").querySelectorAll(".m-st")) g.classList.toggle("sel", g.dataset.st === sid);
    panel(sid);
    updateHash();
    if (scroll && window.matchMedia("(max-width: 1000px)").matches) $("#metro-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function panel(sid) {
    const { h, S, playBtn, openMachine, openSource, Player, showView, load } = window.HI;
    const st = M.data.stations[sid], ls = linesOf(sid), tracks = tracksOf(st), ids = tracks.map((t) => t.id);
    const conns = [
      ...M.data.transfers.filter((t) => t.a === sid || t.b === sid).map((t) => ({ to: t.a === sid ? t.b : t.a, tr: M.data.transfers.indexOf(t) })),
      ...(st.links || []).map((to) => ({ to })),
    ];
    const lineNeighbours = ls.flatMap((l) => { const i = l.stations.indexOf(sid); return [l.stations[i - 1], l.stations[i + 1]].filter(Boolean).map((to) => ({ to, line: l })); });
    const p = $("#metro-panel");
    p.replaceChildren(...[
      h("p", { class: "m-lines-chips" }, ...ls.map((l) => h("span", { class: "m-chip", style: `--lc:${l.color}` }, h("b", {}, String(l.num)), F(l, "name")))),
      h("h2", { class: "m-title" }, F(st, "name")), h("p", { class: "m-yrs" }, F(st, "years")),
      h("p", { class: "m-sum" }, F(st, "summary")),
      st.machines?.length ? [h("h3", {}, T("h.machines")), h("div", { class: "links" }, ...st.machines.filter((m) => S.machineById[m]).map((m) =>
        h("button", { class: "gear", onclick: () => openMachine(m) }, F(S.machineById[m], "name").replace(/^(Roland|Yamaha|Akai|E-mu)\s+/, ""))))] : null,
      h("h3", {}, T("metro.records", { n: tracks.length })),
      tracks.length ? [
        h("button", { class: "btn sm listen", onclick: () => Player.play(ids.find((id) => S.byId[id].youtube?.length), { queue: ids }) }, T("metro.listenStation")),
        h("ol", { class: "m-tracks" }, ...tracks.map((t) => h("li", { style: `--c:${S.genreById[t.genre].color}` },
          playBtn(t.id, ids),
          h("span", { class: "tt" }, t.title, h("small", {}, `${t.artist} · ${t.year} · ${t.bpm} BPM`)),
          h("button", { class: "btn sm ghost", onclick: () => { location.hash = "#" + t.id; load(t.id, "métro"); } }, T("metro.toBooth")))))]
        : h("p", { class: "m-empty" }, F(st, "empty_note") || T("metro.emptyDefault")),
      conns.length || lineNeighbours.length ? h("h3", {}, T("metro.conns")) : null,
      h("div", { class: "links" },
        ...conns.map((c) => h("button", { class: "chip", onclick: () => (c.tr != null ? bubble(c.tr) : select(c.to)) }, `⇄ ${F(M.data.stations[c.to], "name")}`)),
        ...lineNeighbours.map((c) => h("button", { class: "chip", style: `--c:${c.line.color}`, onclick: () => select(c.to) }, h("span", { class: "dot" }), F(M.data.stations[c.to], "name")))),
      st.sources?.length ? [h("h3", {}, T("metro.read")), h("div", { class: "links" }, ...st.sources.filter((id) => S.sourceById[id]).map((id) =>
        h("button", { class: "chip", onclick: () => openSource(id) }, S.sourceById[id].title.split(":")[0])))] : null,
    ].flat().filter(Boolean));
  }
  function intro() {
    const { h } = window.HI;
    const n = Object.keys(M.data.stations).length;
    $("#metro-panel").replaceChildren(...[
      h("h2", { class: "m-title" }, T("metro.pick")),
      h("p", { class: "m-sum" }, T("metro.pickBody", { n, l: M.data.lines.length })),
      Object.values(M.data.stations).some((s) => !tracksOf(s).length) ? h("p", { class: "m-empty" }, T("metro.pickNote")) : null].filter(Boolean));
  }

  // ---------- bulle de correspondance ----------
  function bubble(i) {
    const tr = M.data.transfers[i], a = M.data.stations[tr.a], b = M.data.stations[tr.b];
    M.bubbleIdx = i;
    const { h } = window.HI;
    const box = $("#metro-bubble"), svg = $("#metro-svg");
    box.replaceChildren(
      h("button", { class: "close", "aria-label": T("mod.close"), onclick: hideBubble }, "✕"),
      h("h3", {}, F(tr, "title")), h("p", {}, F(tr, "text")),
      h("div", { class: "links" }, h("button", { class: "chip", onclick: () => select(tr.a) }, `→ ${F(a, "name")}`), h("button", { class: "chip", onclick: () => select(tr.b) }, `→ ${F(b, "name")}`)));
    box.hidden = false;
    // position : milieu de la correspondance, converti en pixels
    const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect(), host = box.parentElement.getBoundingClientRect();
    const k = r.width / vb.width;
    const mx = ((a.x + b.x) / 2 - vb.x) * k + (r.left - host.left) + box.parentElement.scrollLeft;
    const my = ((a.y + b.y) / 2 - vb.y) * k + (r.top - host.top);
    const w = box.offsetWidth, hostW = box.parentElement.scrollWidth;
    box.style.left = `${Math.max(8, Math.min(mx - w / 2, hostW - w - 8))}px`;
    box.style.top = `${my + 18}px`;
    // si la fenêtre d'écoute recouvre la bulle, on décale la bulle à côté d'elle
    const fw = document.getElementById("fw")?.getBoundingClientRect(), br = box.getBoundingClientRect();
    if (fw && br.left < fw.right && br.right > fw.left && br.top < fw.bottom && br.bottom > fw.top) {
      const shift = fw.left < window.innerWidth / 2 ? fw.right - br.left + 12 : fw.left - br.right - 12;
      box.style.left = `${Math.max(8, Math.min(parseFloat(box.style.left) + shift, hostW - w - 8))}px`;
    }
    for (const g of svg.querySelectorAll(".m-transfer")) g.classList.toggle("sel", +g.dataset.tr === i);
    box.querySelector(".close").focus({ preventScroll: true });
  }
  function hideBubble() {
    M.bubbleIdx = null;
    $("#metro-bubble").hidden = true;
    for (const g of $("#metro-svg").querySelectorAll(".m-transfer")) g.classList.remove("sel");
  }

  // ---------- partage & export ----------
  function updateHash() {
    const q = new URLSearchParams();
    if (M.sel) q.set("st", M.sel);
    if (M.isolated) q.set("ligne", M.isolated);
    const hash = "#metro" + (q.toString() ? "?" + q : "");
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }
  function readHash() {
    const m = /^#metro\??(.*)$/.exec(location.hash); if (!m) return;
    const q = new URLSearchParams(m[1]);
    M.isolated = M.data.lines.some((l) => l.id === q.get("ligne")) ? q.get("ligne") : null;
    legend(); focusLine(null);
    if (q.get("st") && M.data.stations[q.get("st")]) select(q.get("st"), { scroll: false }); else if (!M.sel) intro();
  }
  async function share() {
    updateHash();
    const url = location.href;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) await navigator.share({ title: "House Intelligence", url });
      else { await navigator.clipboard.writeText(url); window.HI.toast(T("metro.copied")); }
    } catch { window.HI.toast(url); }
  }
  function exportSvg() {
    const svg = $("#metro-svg").cloneNode(true);
    svg.setAttribute("xmlns", NS);
    svg.querySelectorAll(".hit").forEach((n) => n.remove());
    const style = document.createElementNS(NS, "style");
    style.textContent = `svg{background:#0d0c0b;font-family:'Space Grotesk',Arial,sans-serif}.m-grid line{stroke:#1a1816}.m-line{fill:none;stroke-width:10;stroke-linecap:round;stroke-linejoin:round}
      .m-transfer .tube{stroke:#efe9dd;stroke-width:9;stroke-linecap:round}.m-transfer .dash{stroke:#0d0c0b;stroke-width:4;stroke-dasharray:2 7;stroke-linecap:round}
      .m-st .dot{fill:#0d0c0b;stroke-width:4}.m-st .ring{fill:#fff;stroke:#0d0c0b;stroke-width:3}.m-st .core{fill:#fff;stroke:#0d0c0b;stroke-width:2.5}
      .m-label{fill:#efe9dd;font-size:13px;font-weight:600}.m-years{fill:#8f8678;font-size:10px;font-weight:400}.m-badge text{fill:#111;font-size:13px;font-weight:700;text-anchor:middle;dominant-baseline:central}
      .m-st.empty .m-label{fill:#8f8678}.dim{opacity:.12}`;
    svg.prepend(style);
    const title = document.createElementNS(NS, "text");
    Object.assign(title, { textContent: T("metro.svgFooter") });
    title.setAttribute("x", 60); title.setAttribute("y", 850); title.setAttribute("fill", "#8f8678"); title.setAttribute("font-size", "12");
    svg.append(title);
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "house-intelligence-plan-metro.svg";
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    window.HI.toast(T("metro.exported"));
  }

  // ---------- cycle de vie ----------
  async function ensure() {
    if (!M.data) {
      try { if (location.protocol === "file:" && window.HI_DATA) throw new Error("file://"); const r = await fetch("data/metro.json"); if (!r.ok) throw new Error(r.status); M.data = await r.json(); }
      catch (err) {
        if (window.HI_DATA?.metro) M.data = window.HI_DATA.metro; else { $("#metro-panel").textContent = T("metro.loadError"); console.warn("[metro]", err); return; } }
    }
    if (!window.HI?.S?.tracks?.length) return setTimeout(ensure, 100);   // données d'app.js pas encore prêtes
    if (!M.built) {
      build(); legend();
      $("#metro-share").addEventListener("click", share);
      $("#metro-export").addEventListener("click", exportSvg);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#metro-bubble").hidden) hideBubble(); });
    }
    readHash();
  }
  window.addEventListener("hi:view", (e) => { if (e.detail === "metro") ensure(); });
  // changement de langue : on reconstruit le plan et on rouvre ce qui était ouvert (station, bulle, ligne isolée)
  window.addEventListener("hi:lang", () => {
    if (!M.built) return;
    const bubbleIdx = M.bubbleIdx;
    build(); legend(); focusLine(null);
    if (M.sel) {
      for (const g of $("#metro-svg").querySelectorAll(".m-st")) g.classList.toggle("sel", g.dataset.st === M.sel);
      panel(M.sel);
    } else intro();
    if (bubbleIdx != null && !document.querySelector('[data-view="metro"]').hidden) bubble(bubbleIdx);
  });
  window.HIMetro = M;
})();
