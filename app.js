/* HOUSE INTELLIGENCE — app.js
 * Vanilla JS. Charge data/*.json, gère filtres, booth, transitions Camelot,
 * pulse Web Audio, onglets d'archéologie et mémoire de session.
 */
(() => {
  "use strict";

  // ---------- STATE ----------
  const S = {
    eras: [], genres: [], scenes: [], tracks: [], machines: [], sources: [],
    byId: {}, genreById: {}, sceneById: {}, eraById: {}, machineById: {}, sourceById: {},
    disc: {}, discEntries: [], stations: {}, lines: [],   // rubrique Découverte
    filter: { era: null, genre: null, machine: null, scene: null },
    current: null,
    steer: null,
    reco: null,          // { best, ranked }
    memory: [],
    tab: "tab-machines",
  };
  const $ = (s, el = document) => el.querySelector(s);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage indisponible */ } },
  };
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 1800);
  }

  // ---------- I18N ----------
  const _t = (k, v) => window.I18N.t(k, v);          // libellé d'interface
  const _f = (o, k) => window.I18N.f(o, k);          // champ de contenu localisé
  const keyName = (k) => window.I18N.key(k);

  // ---------- CAMELOT ----------
  // demi-tons au-dessus de Do pour la tonique de chaque clé Camelot
  const KEY_ROOT = {
    "1A": 8, "2A": 3, "3A": 10, "4A": 5, "5A": 0, "6A": 7, "7A": 2, "8A": 9, "9A": 4, "10A": 11, "11A": 6, "12A": 1,
    "1B": 11, "2B": 6, "3B": 1, "4B": 8, "5B": 3, "6B": 10, "7B": 5, "8B": 0, "9B": 7, "10B": 2, "11B": 9, "12B": 4,
  };
  const parseKey = (k) => { const m = /^(\d{1,2})([AB])$/.exec(k || ""); return m ? { n: +m[1], l: m[2] } : null; };

  function camelotRelation(ka, kb) {
    const mk = (score, code, move, v) => ({ score, code, v, move, get label() { return _t(this.code, this.v); } });
    const a = parseKey(ka), b = parseKey(kb);
    if (!a || !b) return { score: 0, code: "cam.unknown", get label() { return _t(this.code, this.v); }, move: "?" };
    let d = (b.n - a.n + 12) % 12; if (d > 6) d -= 12;     // -5..6
    const sign = d > 0 ? "+" : "";
    if (a.l === b.l) {
      if (d === 0) return mk(1, "cam.same", "=");
      if (Math.abs(d) === 1) return mk(0.92, d > 0 ? "cam.up1" : "cam.down1", sign + d);
      if (d === 2) return mk(0.62, "cam.up2", "+2");
      if (d === -5) return mk(0.55, "cam.up7", "+7");
      if (d === -2) return mk(0.45, "cam.down2", "−2");
    } else {
      if (d === 0) return mk(0.86, a.l === "A" ? "cam.relMaj" : "cam.relMin", a.l + "→" + b.l);
      if (Math.abs(d) === 1) return mk(0.55, "cam.diag", sign + d + " " + a.l + "→" + b.l);
    }
    return mk(Math.max(0, 0.3 - Math.abs(d) * 0.05), "cam.jump", sign + d + (a.l !== b.l ? " " + a.l + "→" + b.l : ""), { n: Math.abs(d) });
  }

  function bpmRelation(a, b) {
    const delta = b - a;
    const pitch = ((a - b) / b) * 100;     // % de pitch à appliquer sur B pour caler A
    const absPct = Math.abs(delta / a) * 100;
    const score = Math.max(0, 1 - absPct / 10);
    const code = absPct < 1.5 ? "bpm.direct" : absPct <= 8 ? "bpm.inRange" : "bpm.out";
    return { delta, pitch, score, code, get label() { return _t(code); } };
  }

  // ---------- STEER ----------
  const STEERS = [
    { id: "up", ic: "↑",
      fn: (c, t) => clamp((t.energy - c.energy) / 3, -1, 1) },
    { id: "deep", ic: "↓",
      fn: (c, t) => clamp((c.energy - t.energy) / 3, -1, 1) + (t.tags.includes("deep") ? .3 : 0) },
    { id: "roots", ic: "⟲",
      fn: (c, t) => clamp((c.year - t.year) / 12, -1, 1) + (t.tags.includes("roots") ? .3 : 0) },
    { id: "future", ic: "⟶",
      fn: (c, t) => clamp((t.year - c.year) / 12, -1, 1) },
    { id: "queer", ic: "✦",
      fn: (c, t) => ["queer", "ballroom", "drag", "diva"].filter((x) => t.tags.includes(x)).length * .6 - .3 },
    { id: "diaspora", ic: "◎",
      fn: (c, t) => (t.continent !== c.continent ? .8 : t.city !== c.city ? .35 : -.4) },
  ];
  for (const st of STEERS) Object.defineProperties(st, {
    name: { get: () => _t(`steer.${st.id}.name`) }, desc: { get: () => _t(`steer.${st.id}.desc`) }, say: { get: () => _t(`steer.${st.id}.say`) } });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------- RECOMMENDATION ----------
  function filteredTracks() {
    const f = S.filter;
    return S.tracks.filter((t) =>
      (!f.era || t.era === f.era) &&
      (!f.genre || t.genre === f.genre) &&
      (!f.machine || t.gear.includes(f.machine)) &&
      (!f.scene || t.scene === f.scene));
  }

  function recommend(cur) {
    const recent = S.memory.slice(-6).map((m) => m.id);
    const inFilter = filteredTracks().filter((t) => t.id !== cur.id);
    const pool = inFilter.length >= 1 ? inFilter : S.tracks.filter((t) => t.id !== cur.id);
    const steer = STEERS.find((s) => s.id === S.steer);
    const ranked = pool.map((t) => {
      const key = camelotRelation(cur.camelot_key, t.camelot_key);
      const bpm = bpmRelation(cur.bpm, t.bpm);
      const steerScore = steer ? steer.fn(cur, t) : 0;
      const recentPen = recent.includes(t.id) ? 0.35 : 0;
      const genreBonus = t.genre === cur.genre ? 0.04 : 0;
      const score = 0.48 * key.score + 0.37 * bpm.score + (steer ? 0.5 * steerScore : 0) + genreBonus - recentPen;
      return { t, key, bpm, steerScore, score };
    }).sort((a, b) => b.score - a.score);
    return { best: ranked[0], ranked };
  }

  function narrative(cur, r) {
    const t = r.t, gA = S.genreById[cur.genre], gB = S.genreById[t.genre];
    const parts = [];
    const dy = t.year - cur.year;
    if (cur.city === t.city) parts.push(_t("n.stay", { city: esc(_f(t, "city")) }));
    else parts.push(_t("n.travel", { a: esc(_f(cur, "city")), ya: cur.year, b: esc(_f(t, "city")), yb: t.year }));
    if (Math.abs(dy) >= 8) parts[0] += dy > 0 ? _t("n.forward", { n: dy }) : _t("n.back", { n: -dy });
    parts[0] += ".";
    const p = r.bpm.pitch;
    if (Math.abs(r.bpm.delta) === 0) parts.push(_t("n.sameBpm", { bpm: t.bpm }));
    else if (Math.abs(p) <= 8) parts.push(_t("n.pitch", { p: `${p > 0 ? "+" : ""}${p.toFixed(1)}`, a: cur.bpm, b: t.bpm }));
    else parts.push(_t("n.cut", { d: Math.abs(r.bpm.delta) }));
    parts.push(r.key.score >= 0.8 ? _t("n.keyLong", { k: r.key.label }) : r.key.score >= 0.5 ? _t("n.keyPerc", { k: r.key.label }) : `${r.key.label}.`);
    if (gA.groove !== gB.groove) {
      parts.push(_t("n.grammar", { a: esc(_f(gA, "name")), b: esc(_f(gB, "name")), g: _t(`g.${gB.groove}`) === `g.${gB.groove}` ? _t("g.default") : _t(`g.${gB.groove}`) }));
    }
    const steer = STEERS.find((s) => s.id === S.steer);
    if (steer) parts.push(`<em>${steer.say}.</em>`);
    return parts.join(" ");
  }

  // ---------- RENDER: FILTERS ----------
  function renderFilters() {
    const f = S.filter;
    const eraBox = $("#era-filters"); eraBox.replaceChildren();
    eraBox.append(h("button", { class: "chip", "aria-pressed": !f.era && !f.genre ? "true" : "false", onclick: () => setFilter({ era: null, genre: null }) }, _t("filters.all")));
    for (const e of S.eras) {
      const n = S.tracks.filter((t) => t.era === e.id).length;
      eraBox.append(h("button", { class: "chip", "aria-pressed": f.era === e.id ? "true" : "false", title: _f(e, "range"), onclick: () => setFilter({ era: f.era === e.id ? null : e.id, genre: null }) },
        _f(e, "name"), h("span", { class: "n" }, _f(e, "range"))));
    }
    const gBox = $("#genre-filters"); gBox.replaceChildren();
    let sep = false;
    for (const g of S.genres) {
      if (g.family === "cousin" && !sep) { sep = true; gBox.append(h("span", { class: "chip-sep", title: _t("filters.cousins.title") }, _t("filters.cousins"))); }
      const n = S.tracks.filter((t) => t.genre === g.id).length;
      gBox.append(h("button", { class: "chip", style: `--c:${g.color}`, "aria-pressed": f.genre === g.id ? "true" : "false", onclick: () => setFilter({ genre: f.genre === g.id ? null : g.id, era: null }) },
        h("span", { class: "dot" }), _f(g, "name"), h("span", { class: "n" }, n)));
    }
    const mBox = $("#machine-filters"); mBox.replaceChildren();
    mBox.append(h("button", { class: "chip", "aria-pressed": !f.machine ? "true" : "false", onclick: () => setFilter({ machine: null }) }, _t("filters.allMachines")));
    for (const m of S.machines) {
      const n = S.tracks.filter((t) => t.gear.includes(m.id)).length;
      mBox.append(h("button", { class: "chip", "aria-pressed": f.machine === m.id ? "true" : "false", title: _f(m, "name"), onclick: () => setFilter({ machine: f.machine === m.id ? null : m.id }) },
        shortMachine(m), h("span", { class: "n" }, n)));
    }
    const sBox = $("#scene-filters");
    if (sBox) {
      sBox.replaceChildren(h("button", { class: "chip", "aria-pressed": !f.scene ? "true" : "false", onclick: () => setFilter({ scene: null }) }, _t("filters.allScenes")));
      for (const sc of S.scenes) {
        const n = S.tracks.filter((t) => t.scene === sc.id).length;
        if (!n) continue;
        sBox.append(h("button", { class: "chip", "aria-pressed": f.scene === sc.id ? "true" : "false", title: `${_f(sc, "place")} · ${_f(sc, "desc")}`, onclick: () => setFilter({ scene: f.scene === sc.id ? null : sc.id }) },
          _f(sc, "name"), h("span", { class: "n" }, n)));
      }
    }
    const era = f.era ? S.eraById[f.era] : f.genre ? S.eraById[S.genreById[f.genre].era] : null;
    $("#era-desc").textContent = era ? `${_f(era, "name")} (${_f(era, "range")}) : ${_f(era, "desc")}` : "";
  }
  const shortMachine = (m) => _f(m, "name").replace(/^(Roland|Yamaha|Akai|E-mu)\s+/, "").replace(/ (Rhythm Composer|Bass Line|MIDI Production Center|Music Workstation)$/, "").replace(" (amapiano)", "");

  function setFilter(patch) {
    Object.assign(S.filter, patch);
    renderFilters(); renderCrate();
    if (S.current) { S.reco = recommend(S.current); renderTransition(); }
  }

  // ---------- RENDER: CRATE ----------
  function renderCrate() {
    const list = $("#crate-list"); list.replaceChildren();
    const items = filteredTracks().sort((a, b) => a.year - b.year);
    $("#crate-count").textContent = `${items.length} / ${S.tracks.length}`;
    if (!items.length) { list.append(h("li", { class: "empty" }, _t("crate.empty"))); return; }
    const nextId = S.reco?.best?.t.id;
    for (const t of items) {
      const g = S.genreById[t.genre];
      list.append(h("li", { class: "crate-item" + (t.id === nextId ? " next-hint" : ""), style: `--c:${g.color}` },
        h("button", { class: "crate-main", "aria-current": S.current?.id === t.id ? "true" : "false", onclick: () => load(t.id, "bac") },
          h("span", { class: "bar" }),
          h("span", {}, h("span", { class: "t" }, t.title), h("span", { class: "a" }, t.artist)),
          h("span", { class: "meta" }, `${t.year}`, h("br"), `${t.bpm} · ${t.camelot_key}`)),
        playBtn(t.id)));
    }
  }

  // ---------- RENDER: BOOTH ----------
  function renderNow() {
    const t = S.current, g = S.genreById[t.genre];
    document.documentElement.style.setProperty("--g", g.color);
    $("#now-genre").textContent = `${_f(g, "name")} · ${_f(S.eraById[t.era], "name")}`;
    $("#now-title").textContent = t.title;
    $("#now-artist").textContent = t.artist;
    $("#vinyl-label").textContent = t.label;
    const energy = h("span", { class: "energy-bar", "aria-hidden": "true" }, ...Array.from({ length: 10 }, (_, i) => h("i", { class: i < t.energy ? "on" : "" })));
    const b = (k, v, extra) => h("li", { class: "badge" }, h("small", {}, k), h("b", {}, v), extra);
    $("#now-badges").replaceChildren(
      b("BPM", t.bpm),
      b("Camelot", t.camelot_key, h("span", { style: "color:var(--ink-3)" }, keyName(t.camelot_key))),
      b(_t("badge.energy"), `${t.energy}/10`, energy),
      b(_t("badge.label"), t.label), b(_t("badge.city"), _f(t, "city")), b(_t("badge.year"), t.year));
    $("#now-why").textContent = _f(t, "why_this_record");
    const sp = $("#now-spotify");
    if (t.spotify?.id) { sp.href = `https://open.spotify.com/track/${t.spotify.id}`; sp.hidden = false; } else sp.hidden = true;
    $("#btn-listen").disabled = !t.youtube?.length;
  }

  function renderTransition() {
    const cur = S.current, r = S.reco.best;
    renderWheel(cur, r?.t);
    if (!r) { $("#tr-next").textContent = _t("tr.none"); return; }
    const t = r.t, gB = S.genreById[t.genre];
    document.documentElement.style.setProperty("--g-next", gB.color);
    $("#tr-next").replaceChildren(
      h("span", { class: "from" }, cur.title),
      h("span", { class: "arr" }, "→"),
      h("span", { class: "to" }, t.title, h("span", { class: "who" }, `${t.artist} · ${_f(gB, "name")} · ${t.year}`)));
    // tempo scale 100–135
    const lo = Math.min(100, Math.floor((Math.min(cur.bpm, t.bpm) - 6) / 5) * 5), hi = Math.max(135, Math.ceil((Math.max(cur.bpm, t.bpm) + 6) / 5) * 5), pos = (v) => `${((clamp(v, lo, hi) - lo) / (hi - lo)) * 100}%`;
    const rMin = cur.bpm * 0.92, rMax = cur.bpm * 1.08;
    $("#tempo-scale").replaceChildren(
      h("div", { class: "range", style: `left:${pos(rMin)};width:calc(${pos(rMax)} - ${pos(rMin)})`, title: "±8 %" }),
      h("div", { class: "mark a", style: `left:${pos(cur.bpm)}` }, h("span", {}, `A ${cur.bpm}`)),
      h("div", { class: "mark b", style: `left:${pos(t.bpm)}` }, h("span", {}, `B ${t.bpm}`)));
    $("#tempo-scale").style.setProperty("--ticks", hi - lo);
    $("#tempo-legend").replaceChildren(h("span", {}, `${lo} BPM`), h("span", {}, _t("tr.legend")), h("span", {}, `${hi}`));
    const d = r.bpm.delta;
    const m = (k, v, sub) => h("div", { class: "metric" }, h("small", {}, k), h("b", {}, v), h("span", { class: "sub" }, sub));
    $("#tr-metrics").replaceChildren(
      m(_t("m.tempo"), `${d > 0 ? "+" : ""}${d} BPM`, r.bpm.label),
      m(_t("m.pitch"), `${r.bpm.pitch > 0 ? "+" : ""}${r.bpm.pitch.toFixed(1)} %`, Math.abs(r.bpm.pitch) <= 8 ? _t("m.inFader") : _t("m.outFader")),
      m(_t("m.key"), `${cur.camelot_key} → ${t.camelot_key}`, _t("m.move", { m: r.key.move })),
      m(_t("m.compat"), h("span", { class: "compat", style: `--s:${Math.round(Math.max(0, r.score) * 100)}` }, `${Math.round(Math.max(0, r.score) * 100)}`), _t("m.harmony", { h: Math.round(r.key.score * 100), t: Math.round(r.bpm.score * 100) })));
    $("#tr-narrative").innerHTML = narrative(cur, r);
    const alts = $("#tr-alts"); alts.replaceChildren();
    for (const a of S.reco.ranked.slice(1, 4)) {
      alts.append(h("button", { class: "btn ghost sm alt", title: `${a.key.label} · Δ ${a.bpm.delta} BPM`, onclick: () => previewAlt(a) },
        `${a.t.title} `, h("span", { class: "sc" }, `${a.t.camelot_key}·${a.t.bpm}`)));
    }
    // marque le prochain dans le bac
    renderCrate();
  }

  function previewAlt(a) {
    // fait de l'alternative la recommandation principale
    const ranked = [a, ...S.reco.ranked.filter((x) => x !== a)];
    S.reco = { best: a, ranked };
    renderTransition();
  }

  function renderWheel(cur, next) {
    const svg = $("#camelot-wheel");
    const NS = "http://www.w3.org/2000/svg";
    const s = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
    svg.replaceChildren();
    const ca = parseKey(cur.camelot_key), cb = next ? parseKey(next.camelot_key) : null;
    const ang = (n) => ((n % 12) * 30 - 90) * Math.PI / 180;   // 12 en haut
    const arc = (r0, r1, n) => {
      const a0 = ang(n) - Math.PI / 12, a1 = ang(n) + Math.PI / 12;
      const p = (r, a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
      return `M${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
    };
    const center = (ring, n) => { const r = ring === "B" ? 85 : 57; return [r * Math.cos(ang(n)), r * Math.sin(ang(n))]; };
    const gA = S.genreById[cur.genre].color, gB = next ? S.genreById[next.genre].color : "#fff";
    for (const L of ["B", "A"]) {
      for (let n = 1; n <= 12; n++) {
        const key = `${n}${L}`;
        const rel = camelotRelation(cur.camelot_key, key).score;
        let fill = rel >= 0.85 ? "#2d2925" : rel >= 0.5 ? "#24211e" : "#1a1816";
        let hl = false;
        if (n === ca.n && L === ca.l) { fill = gA; hl = true; }
        else if (cb && n === cb.n && L === cb.l) { fill = gB; hl = true; }
        const [x, y] = center(L, n);
        const path = s("path", { d: L === "B" ? arc(71, 100, n) : arc(43, 71, n), class: "seg", fill });
        const title = s("title", {}); title.textContent = `${key} · ${keyName(key)}`; path.append(title);
        svg.append(path);
        const tx = s("text", { x: x.toFixed(1), y: y.toFixed(1), class: hl ? "hl" : "" }); tx.textContent = key; svg.append(tx);
      }
    }
    if (cb) {
      const [x1, y1] = center(ca.l, ca.n), [x2, y2] = center(cb.l, cb.n);
      if (x1 !== x2 || y1 !== y2) {
        const mx = (x1 + x2) / 2 * 0.35, my = (y1 + y2) / 2 * 0.35;  // courbe vers le centre
        svg.append(s("path", { d: `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`, class: "arrow" }));
      }
    }
    const t1 = s("text", { x: 0, y: -4, class: "center-txt" }); t1.textContent = cb ? `${cur.camelot_key} → ${next.camelot_key}` : cur.camelot_key;
    const t2 = s("text", { x: 0, y: 12, class: "center-sub" }); t2.textContent = "CAMELOT";
    svg.append(t1, t2);
  }

  // ---------- RENDER: STEER ----------
  function renderSteer() {
    const grid = $("#steer-grid"); grid.replaceChildren();
    for (const st of STEERS) {
      grid.append(h("button", { class: "steer-btn", "aria-pressed": S.steer === st.id ? "true" : "false", onclick: () => {
        S.steer = S.steer === st.id ? null : st.id;
        renderSteer();
        S.reco = recommend(S.current); renderTransition();
        if (S.steer) toast(`${st.name} → ${S.reco.best?.t.title || "—"}`);
      } }, h("span", { class: "ic" }, st.ic), h("b", {}, st.name), h("span", {}, st.desc)));
    }
    const active = STEERS.find((s) => s.id === S.steer);
    $("#steer-state").textContent = active ? _t("steer.active", { n: active.name }) : _t("steer.none");
  }

  // ---------- RENDER: TABS ----------
  function renderStory(t) {
    const has = !!t.story;
    $("#tab-story").hidden = !has;
    if (!has) { $("#tp-story").replaceChildren(); return false; }
    const en = window.I18N.lang === "en";
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
    $("#tp-story").replaceChildren(...[
      h("h4", {}, _t("h.story")), h("p", {}, _f(t, "story")),
      t.timeline?.length ? [h("h4", {}, _t("h.timeline")), h("ol", { class: "story-tl" }, ...t.timeline.map((e) =>
        h("li", {}, h("span", { class: "d" }, e.date), h("span", {}, en ? e.en : e.fr))))] : null,
      t.credits?.length ? [h("h4", {}, _t("h.credits")), h("dl", { class: "credits" }, ...t.credits.flatMap((c) =>
        [h("dt", {}, en ? c.k_en : c.k[0].toUpperCase() + c.k.slice(1)), h("dd", {}, en ? c.v_en : c.v)]))] : null,
      t.book_refs?.length ? [h("h4", {}, _t("h.books")), h("ul", { class: "book-refs" }, ...t.book_refs.filter((r) => S.sourceById[r.source]).map((r) =>
        h("li", {}, h("button", { class: "chip", onclick: () => openSource(r.source) }, S.sourceById[r.source].title.split(":")[0]),
          h("span", {}, ` ${en ? r.where_en : r.where}${r.pages ? " · " : ""}`), r.pages ? h("em", {}, _t("book.pages", { p: r.pages })) : null)))] : null,
      t.references?.length ? [h("h4", {}, _t("h.web")), h("ul", { class: "web-refs" }, ...t.references.map((u) =>
        h("li", {}, h("a", { href: u, target: "_blank", rel: "noopener" }, host(u) + " ↗"))))] : null,
    ].flat().filter(Boolean));
    return true;
  }

  let tabChosen = false;   // l'onglet Histoire s'ouvre par défaut, tant que l'utilisateur n'a pas choisi un onglet
  function renderTabs() {
    const t = S.current;
    const hasStory = renderStory(t);
    if (!hasStory && S.tab === "tab-story") selectTab("tab-machines");
    else if (hasStory && !tabChosen && S.tab !== "tab-story") selectTab("tab-story");
    const gearList = h("div", { class: "gear-list" }, ...t.gear.map((g) => {
      const m = S.machineById[g];
      return m ? h("button", { class: "gear", onclick: () => openMachine(m.id) }, shortMachine(m)) : h("span", { class: "gear" }, (window.I18N.lang === "en" && t.gear_en ? t.gear_en[t.gear.indexOf(g)] : g));
    }));
    $("#tp-machines").replaceChildren(h("h4", {}, _t("h.machines")), gearList, h("h4", {}, _t("h.construction")), h("p", {}, _f(t, "construction")));
    $("#tp-origins").replaceChildren(h("h4", {}, `${_f(t, "city")} · ${_f(t, "country")} · ${t.year}`), h("p", {}, _f(t, "producer_origins")));
    $("#tp-queer").replaceChildren(h("h4", {}, _t("h.queer")), h("p", {}, _f(t, "queer_ballroom_axis")));
    const src = S.sourceById[t.archive_ref?.source];
    $("#tp-socio").replaceChildren(...[
      h("h4", {}, _t("h.socio")), h("p", {}, _f(t, "club_sociology")),
      h("h4", {}, _t("h.ref")),
      src ? h("button", { class: "src-card", onclick: () => openSource(src.id) },
        h("b", {}, src.title), h("span", {}, `${_f(src, "author")} · ${_f(src, "type")}${src.year ? " · " + src.year : ""}`), h("em", {}, _f(t.archive_ref, "note")))
        : h("p", {}, _t("ref.missing")),
      (t.further_reading || []).length ? [h("h4", {}, _t("h.further")), h("div", { class: "links" }, ...t.further_reading.map((id) => S.sourceById[id]).filter(Boolean).map((s) =>
        h("button", { class: "chip", onclick: () => openSource(s.id) }, s.title.split(":")[0])))] : null].flat().filter(Boolean));
  }
  function selectTab(id, focus) {
    if (focus) tabChosen = true;
    S.tab = id;
    for (const b of document.querySelectorAll("#tabs [role=tab]")) {
      const on = b.id === id;
      b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1;
      $("#" + b.getAttribute("aria-controls")).hidden = !on;
      if (on && focus) b.focus();
    }
  }

  // ---------- MODALS ----------
  function openModal(node) {
    $("#modal-body").replaceChildren(node);
    const d = $("#modal"); if (!d.open) d.showModal();
  }
  function trackLink(id) {
    const t = S.byId[id]; if (!t) return null;
    return h("button", { class: "chip", style: `--c:${S.genreById[t.genre].color}`, onclick: () => { $("#modal").close(); load(id, "fiche"); } }, h("span", { class: "dot" }), `${t.artist} — ${t.title}`);
  }
  function openMachine(id) {
    const m = S.machineById[id];
    openModal(h("div", {},
      h("h3", {}, _f(m, "name")),
      h("p", { class: "meta" }, `${_f(m, "maker")} · ${m.year} · ${_f(m, "type")}`),
      h("h4", {}, _t("mod.intended")), h("p", {}, _f(m, "intended_use")),
      h("h4", {}, _t("mod.hijack")), h("p", {}, _f(m, "hijack")),
      h("h4", {}, _t("mod.signature")), h("p", {}, _f(m, "signature")),
      h("h4", {}, _t("mod.inHouse")), h("p", {}, _f(m, "house_usage")),
      h("h4", {}, _t("mod.trivia")), h("p", {}, _f(m, "trivia")),
      h("h4", {}, _t("mod.inCrate")), h("div", { class: "links" }, ...[...new Set([...m.tracks, ...S.tracks.filter((t) => t.gear.includes(m.id)).map((t) => t.id)])].map(trackLink)),
      h("div", { class: "links", style: "margin-top:16px" },
        h("button", { class: "btn sm", onclick: () => { $("#modal").close(); setEngine(m.synth_mode); if (!Pulse.playing) Pulse.toggle(); } }, _t("mod.hearEngine", { e: m.synth_mode })),
        h("button", { class: "btn sm ghost", onclick: () => { $("#modal").close(); setFilter({ machine: m.id }); } }, _t("mod.filterMachine")),
      )));
  }
  function openSource(id) {
    const s = S.sourceById[id];
    const linked = S.tracks.filter((t) => t.archive_ref?.source === id || (t.further_reading || []).includes(id)).map((t) => t.id);
    openModal(h("div", {},
      h("h3", {}, s.title),
      h("p", { class: "meta" }, `${_f(s, "author")} · ${_f(s, "type")}${s.year ? " · " + s.year : ""}`),
      h("h4", {}, _t("mod.contribution")), h("p", {}, _f(s, "contribution")),
      h("h4", {}, _t("mod.themes")), h("div", { class: "links" }, ...(_f(s, "themes") || []).map((x) => h("span", { class: "gear" }, x))),
      h("h4", {}, _t("mod.genres")), h("div", { class: "links" }, ...s.genres.map((g) => S.genreById[g]).filter(Boolean).map((g) =>
        h("button", { class: "chip", style: `--c:${g.color}`, onclick: () => { $("#modal").close(); setFilter({ genre: g.id, era: null }); } }, h("span", { class: "dot" }), _f(g, "name")))),
      linked.length ? [h("h4", {}, _t("mod.cited")), h("div", { class: "links" }, ...linked.map(trackLink)),
        h("div", { class: "links", style: "margin-top:12px" }, h("button", { class: "btn sm listen", onclick: () => { $("#modal").close(); const q = linked.filter((i) => S.byId[i].youtube?.length); if (q.length) Player.play(q[0], { queue: q }); } }, _t("mod.listenAll", { n: linked.length })))] : null,
      s.to_verify ? h("p", { class: "warn" }, _t("mod.verify")) : null));
  }

  // ---------- MEMORY ----------
  const VIA = { get: (v) => { const k = `via.${v}`; const r = _t(k); return r === k ? v : r; } };
  function pushMemory(t, via) {
    S.memory.push({ id: t.id, at: new Date().toISOString(), via });
    if (S.memory.length > 200) S.memory.shift();
    store.set("hi.memory", S.memory);
    renderMemory();
  }
  function renderMemory() {
    const tl = $("#timeline"); tl.replaceChildren();
    if (!S.memory.length) { tl.append(h("li", { class: "empty", style: "--c:transparent" }, _t("mem.empty"))); return; }
    for (const m of [...S.memory].reverse()) {
      const t = S.byId[m.id]; if (!t) continue;
      const time = new Date(m.at).toLocaleTimeString(window.I18N.locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      tl.append(h("li", { style: `--c:${S.genreById[t.genre].color}` },
        h("button", { onclick: () => load(t.id, "fiche", { noMemory: true }) },
          h("span", { class: "tm" }, `${time} · ${_t("mem.via", { v: VIA.get(m.via) })}`),
          h("span", { class: "tt" }, `${t.artist} — ${t.title}`),
          h("span", { class: "tv" }, `${t.bpm} BPM · ${t.camelot_key} · ${_f(S.genreById[t.genre], "name")}`))));
    }
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h("a", { href: url, download: name }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportMemory(fmt) {
    if (!S.memory.length) { toast(_t("mem.exportEmpty")); return; }
    const rows = S.memory.map((m, i) => ({ n: i + 1, ...m, t: S.byId[m.id] })).filter((r) => r.t);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    if (fmt === "json") {
      const out = { app: "House Intelligence", exported_at: new Date().toISOString(), tracklist: rows.map((r) => ({
        position: r.n, played_at: r.at, via: r.via, artist: r.t.artist, title: r.t.title, year: r.t.year, label: r.t.label, city: r.t.city,
        genre: S.genreById[r.t.genre].name, bpm: r.t.bpm, camelot_key: r.t.camelot_key, energy: r.t.energy })) };
      download(`house-intelligence-${stamp}.json`, JSON.stringify(out, null, 2), "application/json");
    } else {
      let md = `# ${_t("md.title")}\n\n_${_t("md.date", { d: new Date().toLocaleString(window.I18N.locale) })}_\n\n${_t("md.head")}\n|---|---|---|---|---|---|---|---|\n`;
      rows.forEach((r, i) => {
        const prev = rows[i - 1]?.t;
        const tr = prev ? `${camelotRelation(prev.camelot_key, r.t.camelot_key).move} · Δ${r.t.bpm - prev.bpm >= 0 ? "+" : ""}${r.t.bpm - prev.bpm}` : "—";
        const time = new Date(r.at).toLocaleTimeString(window.I18N.locale);
        md += `| ${r.n} | ${time} | ${r.t.artist} | ${r.t.title} (${r.t.year}) | ${_f(S.genreById[r.t.genre], "name")} | ${r.t.bpm} | ${r.t.camelot_key} | ${tr} |\n`;
      });
      download(`house-intelligence-${stamp}.md`, md, "text/markdown");
    }
    toast(_t("mem.exported", { f: fmt }));
  }

  // ---------- LOAD ----------
  function load(id, via, opts = {}) {
    const t = S.byId[id]; if (!t) return;
    S.current = t;
    if (!opts.noMemory) pushMemory(t, via);
    S.reco = recommend(t);
    renderNow(); renderTransition(); renderTabs();
    Pulse.setTrack(t);
    store.set("hi.current", id);
    if (view === "booth" && location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    if (!opts.noScroll && via !== "init" && via !== "hash" && window.matchMedia("(max-width: 900px)").matches) $("#now-playing").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- PULSE (Web Audio) ----------
  const PATTERNS = {
    //            0123456789abcdef
    four:     { k: "x...x...x...x...", c: "....x.......x...", h: "xxxxxxxxxxxxxxxx", o: "..x...x...x...x.", p: "................", b: "x.x...x.x.x...x." },
    jack:     { k: "x...x...x...x...", c: "....x.......x..x", h: "x.x.x.x.x.x.x.x.", o: "..x...x...x...x.", p: "..x..x....x..x..", b: "x..x..x.x..x..x." },
    acid:     { k: "x...x...x...x...", c: "....x.......x...", h: "..x...x...x...x.", o: "................", p: "................", b: "xxxxxxxxxxxxxxxx" },
    garage:   { k: "x...x...x...x...", c: "....x.......x...", h: "x.xxx.xxx.xxx.xx", o: "..x...x...x...x.", p: "...x......x.....", b: "x.....x...x....." },
    hiphouse: { k: "x...x..xx...x...", c: "....x.......x...", h: "x.x.x.x.x.x.x.x.", o: "..x.......x.....", p: "...........x....", b: "x......x.x......" },
    deep:     { k: "x...x...x...x...", c: "....x.......x...", h: "..x...x...x...x.", o: "..x...x...x...x.", p: "................", b: "x.....x.....x..." },
    tribal:   { k: "x...x...x...x...", c: "............x...", h: "x.xxx.xxx.xxx.xx", o: "..x...x...x...x.", p: "..x..xx...x.xx.x", b: "x.......x......." },
    filter:   { k: "x...x...x...x...", c: "....x.......x...", h: "xxxxxxxxxxxxxxxx", o: "..x...x...x...x.", p: "................", b: "x.xx..x.x.xx..x." },
    twostep:  { k: "x.........x.....", c: "....x.......x...", h: "..x...x...x...xx", o: "......x.......x.", p: ".......x.....x..", b: "x.....x...x..x.." },
    afro:     { k: "x...x...x...x...", c: "............x...", h: "xxxxxxxxxxxxxxxx", o: "................", p: "x..x..x...x..x..", b: "x.....x...x....." },
    lofi:     { k: "x...x...x...x...", c: "....x.......x...", h: "..x...x...x...x.", o: "..........x.....", p: "................", b: "x.....x.....x..." },
    disco:    { k: "x...x...x...x...", c: "....x.......x...", h: "x.x.x.x.x.x.x.x.", o: "..x...x...x...x.", p: "x.....x.....x...", b: "x.x.x.x.x.x.x.x." },
    breakbeat:{ k: "x.........x.....", c: "....x..x.x..x...", h: "x.x.x.x.x.x.x.x.", o: "..............x.", p: "................", b: "x.......x..x...." },
    trance:   { k: "x...x...x...x...", c: "....x.......x...", h: "xxxxxxxxxxxxxxxx", o: "..x...x...x...x.", p: "................", b: ".xx..xx..xx..xx." },
    amapiano: { k: "x.......x.......", c: "....x.......x...", h: "xxxxxxxxxxxxxxxx", o: "................", p: "...x..x...x.....", b: "...x..x...xx..x." },
  };
  const ACID_NOTES = [0, 0, 12, 0, 3, 0, 15, 12, 0, 7, 0, 10, 12, 0, 3, 5];
  const ACID_ACC =   [1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1];
  const ACID_SLIDE = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const LOG_NOTES = [0, 0, 0, 7, 0, 0, 5, 0, 0, 0, 3, 7, 0, 0, 10, 0];
  const LANES = [["k", "#ff6b35"], ["c", "#efe9dd"], ["h", "#7a7266"], ["o", "#b4ab9c"], ["p", "#5ad2ff"], ["b", "#d4ff3a"]];

  const Pulse = {
    ctx: null, master: null, comp: null, noise: null,
    playing: false, bpm: 120, swing: 0, groove: "four", root: 0, engine: "909",
    step: 0, nextTime: 0, timer: null, queue: [], raf: 0, filterLfo: 0,

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { toast(_t("pulse.noAudio")); return; }
      this.ctx = new AC();
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.ratio.value = 4;
      this.bus = this.ctx.createBiquadFilter(); this.bus.type = "lowpass"; this.bus.frequency.value = 18000; this.bus.Q.value = 0.7;
      this.master = this.ctx.createGain(); this.master.gain.value = +$("#vol").value;
      this.bus.connect(this.comp).connect(this.master).connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // voix 303 persistante (pour le slide)
      this.acidOsc = this.ctx.createOscillator(); this.acidOsc.type = "sawtooth";
      this.acidFilt = this.ctx.createBiquadFilter(); this.acidFilt.type = "lowpass"; this.acidFilt.Q.value = 14; this.acidFilt.frequency.value = 200;
      this.acidAmp = this.ctx.createGain(); this.acidAmp.gain.value = 0;
      this.acidOsc.connect(this.acidFilt).connect(this.acidAmp).connect(this.bus);
      this.acidOsc.start();
    },
    setTrack(t) {
      const g = S.genreById[t.genre];
      this.bpm = t.bpm; this.swing = g.swing; this.groove = g.groove; this.root = KEY_ROOT[t.camelot_key] ?? 0;
      $("#pulse-bpm").textContent = t.bpm;
      $("#pulse-groove").textContent = _t("pulse.grid", { g: _f(g, "name"), groove: g.groove }) + (g.swing ? _t("pulse.swing", { s: Math.round(g.swing * 100) }) : "");
      $("#vinyl").style.setProperty("--spin", `${(60 / t.bpm) * 4 * 0.45}s`);
      renderSteps();
    },
    toggle() {
      this.init(); if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.playing = !this.playing;
      const btn = $("#btn-play");
      btn.setAttribute("aria-pressed", this.playing);
      btn.querySelector(".ico").textContent = this.playing ? "■" : "▶";
      btn.querySelector(".lbl").textContent = this.playing ? _t("pulse.stop") : _t("pulse.start");
      $("#vinyl").classList.toggle("spin", this.playing);
      if (this.playing) {
        Player.pause();
        this.step = 0; this.nextTime = this.ctx.currentTime + 0.06;
        this.timer = setInterval(() => this.schedule(), 25);
        this.raf = requestAnimationFrame(() => this.draw());
      } else {
        clearInterval(this.timer); cancelAnimationFrame(this.raf);
        this.acidAmp.gain.cancelScheduledValues(this.ctx.currentTime); this.acidAmp.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
        this.queue = []; highlightStep(-1);
      }
    },
    schedule() {
      const sixteenth = 60 / this.bpm / 4;
      while (this.nextTime < this.ctx.currentTime + 0.12) {
        const s = this.step;
        const t = this.nextTime + (s % 2 ? this.swing * sixteenth : 0);
        this.playStep(s, t, sixteenth);
        this.queue.push({ s, t });
        this.nextTime += sixteenth;
        this.step = (s + 1) % 16;
      }
    },
    draw() {
      const now = this.ctx.currentTime;
      while (this.queue.length && this.queue[0].t <= now) highlightStep(this.queue.shift().s);
      if (this.playing) this.raf = requestAnimationFrame(() => this.draw());
    },
    playStep(s, t, six) {
      const P = PATTERNS[this.groove] || PATTERNS.four;
      const on = (lane) => P[lane][s] === "x";
      const eng = this.engine;
      if (on("k")) eng === "808" ? this.kick808(t) : this.kick909(t);
      if (on("c")) this.clap(t, eng === "808");
      if (on("h")) this.hat(t, 0.035, s % 4 === 2 ? 0.22 : 0.12);
      if (on("o")) this.hat(t, 0.18, 0.16);
      if (on("p")) this.perc(t, s);
      if (this.groove === "filter") {
        const ph = ((this.filterLfo++ % 128) / 128) * Math.PI * 2;
        this.bus.frequency.setTargetAtTime(600 + (1 - Math.cos(ph)) * 7000, t, 0.05);
      } else this.bus.frequency.setTargetAtTime(18000, t, 0.05);
      // couche basse selon moteur
      if (eng === "303") this.acid(s, t, six);
      else if (eng === "log" || this.groove === "amapiano") { if (on("b")) this.logDrum(t, LOG_NOTES[s]); }
      else if (eng === "808") { if (on("b") && !on("k")) this.sub(t, six * 2); }
      else if (on("b") && !on("k")) this.bass(t, six);
    },
    freq(semi, oct = 1) { return 32.703 * Math.pow(2, (this.root + semi) / 12) * Math.pow(2, oct); }, // Do1 = 32.7 Hz
    env(g, t, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); },
    kick909(t) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      this.env(g, t, 1.0, 0.32); o.connect(g).connect(this.bus); o.start(t); o.stop(t + 0.35);
      const n = c.createBufferSource(), ng = c.createGain(), nf = c.createBiquadFilter();
      n.buffer = this.noise; nf.type = "highpass"; nf.frequency.value = 2500; this.env(ng, t, 0.35, 0.012);
      n.connect(nf).connect(ng).connect(this.bus); n.start(t); n.stop(t + 0.03);
    },
    kick808(t) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      const f0 = this.freq(0, 0), base = f0 < 40 ? f0 * 2 : f0;   // 40–65 Hz
      o.frequency.setValueAtTime(base * 2.2, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.06);
      this.env(g, t, 1.0, 0.9); o.connect(g).connect(this.bus); o.start(t); o.stop(t + 0.95);
    },
    sub(t, dur) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.value = this.freq(0, 1); this.env(g, t, 0.55, dur * 1.6); o.connect(g).connect(this.bus); o.start(t); o.stop(t + dur * 1.7);
    },
    bass(t, six) {
      const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = "square"; o.frequency.value = this.freq(0, 1); f.type = "lowpass"; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + six * 1.5);
      this.env(g, t, 0.28, six * 1.8); o.connect(f).connect(g).connect(this.bus); o.start(t); o.stop(t + six * 2);
    },
    acid(s, t, six) {
      const f = this.freq(ACID_NOTES[s], 2), acc = ACID_ACC[s], slide = ACID_SLIDE[(s + 15) % 16];
      const o = this.acidOsc.frequency, cut = this.acidFilt.frequency, amp = this.acidAmp.gain;
      if (slide) o.setTargetAtTime(f, t, six * 0.35); else o.setValueAtTime(f, t);
      const peak = acc ? 3800 : 1600;
      cut.cancelScheduledValues(t); cut.setValueAtTime(peak, t); cut.exponentialRampToValueAtTime(180, t + six * (acc ? 1.4 : 0.9));
      amp.cancelScheduledValues(t); amp.setValueAtTime(acc ? 0.34 : 0.22, t);
      if (!ACID_SLIDE[s]) amp.setTargetAtTime(0.0, t + six * 0.7, 0.02);
    },
    logDrum(t, semi) {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      const fr = this.freq(semi, 1) * (this.freq(semi, 1) < 45 ? 2 : 1);
      o.type = "sine"; o2.type = "triangle";
      o.frequency.setValueAtTime(fr * 1.9, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.05); o.frequency.exponentialRampToValueAtTime(fr * 0.94, t + 0.35);
      o2.frequency.setValueAtTime(fr * 2, t); o2.frequency.exponentialRampToValueAtTime(fr * 1.02, t + 0.05);
      f.type = "lowpass"; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.2); f.Q.value = 4;
      this.env(g, t, 0.8, 0.38);
      o.connect(f); o2.connect(f); f.connect(g).connect(this.bus);
      o.start(t); o2.start(t); o.stop(t + 0.4); o2.stop(t + 0.4);
    },
    clap(t, dry) {
      const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      n.buffer = this.noise; f.type = "bandpass"; f.frequency.value = dry ? 1500 : 1100; f.Q.value = 1.2;
      g.gain.setValueAtTime(0.0001, t);
      [0, 0.01, 0.02].forEach((d) => { g.gain.setValueAtTime(0.5, t + d); g.gain.exponentialRampToValueAtTime(0.05, t + d + 0.009); });
      g.gain.setValueAtTime(0.4, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + (dry ? 0.12 : 0.22));
      n.connect(f).connect(g).connect(this.bus); n.start(t); n.stop(t + 0.25);
    },
    hat(t, dec, vol) {
      const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      n.buffer = this.noise; n.playbackRate.value = 1.4; f.type = "highpass"; f.frequency.value = 7500;
      this.env(g, t, vol, dec); n.connect(f).connect(g).connect(this.bus); n.start(t); n.stop(t + dec + 0.02);
    },
    perc(t, s) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      const tribal = this.groove === "tribal";
      o.type = tribal ? "sine" : "triangle";
      const base = tribal ? [110, 146, 196][s % 3] : this.groove === "amapiano" || this.groove === "afro" ? 520 + (s % 3) * 140 : 800;
      o.frequency.setValueAtTime(base * 1.5, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.03);
      this.env(g, t, tribal ? 0.45 : 0.18, tribal ? 0.25 : 0.07); o.connect(g).connect(this.bus); o.start(t); o.stop(t + 0.3);
    },
  };

  function renderSteps() {
    const P = PATTERNS[Pulse.groove] || PATTERNS.four;
    const box = $("#steps"); box.replaceChildren();
    const lanes = LANES.map(([k, c]) => [k, c]);
    for (let s = 0; s < 16; s++) {
      const col = h("div", { class: "step" + (s % 4 === 0 ? " beat" : "") });
      for (const [k, c] of lanes) {
        let on = P[k][s] === "x";
        if (k === "b" && Pulse.engine === "303") on = true;
        col.append(h("i", { class: on ? "on" : "", style: `--c:${c}` }));
      }
      box.append(col);
    }
  }
  function highlightStep(s) {
    const cols = $("#steps").children;
    for (let i = 0; i < cols.length; i++) cols[i].classList.toggle("now", i === s);
  }
  function setEngine(e) {
    if (!["909", "808", "303", "log"].includes(e)) return;
    Pulse.engine = e;
    for (const b of document.querySelectorAll("#engine-seg button")) b.setAttribute("aria-checked", b.dataset.engine === e);
    if (Pulse.ctx && e !== "303") { Pulse.acidAmp.gain.cancelScheduledValues(Pulse.ctx.currentTime); Pulse.acidAmp.gain.setTargetAtTime(0, Pulse.ctx.currentTime, 0.02); }
    renderSteps();
  }

  // ---------- EVENTS ----------
  function bind() {
    $("#btn-mix").addEventListener("click", () => { if (S.reco?.best) { const id = S.reco.best.t.id; load(id, "transition"); if (Player.playing) Player.play(id); } });
    $("#btn-listen").addEventListener("click", () => Player.current === S.current.id ? Player.toggle() : Player.play(S.current.id, { queue: null }));
    $("#fw-toggle").addEventListener("click", () => Player.toggle());
    $("#fw-next").addEventListener("click", () => Player.next());
    $("#fw-prev").addEventListener("click", () => Player.prev());
    $("#fw-mode").addEventListener("change", (e) => { Player.mode = e.target.value; });
    $("#fw-size").addEventListener("click", () => { const mini = $("#fw").dataset.size !== "mini"; Player.userMini = mini && !!Player.current; setFwSize(mini ? "mini" : "normal"); });
    $("#fw-side").addEventListener("click", () => {
      const sides = store.get("hi.fwSide", {});
      sides[view] = $("#fw").dataset.side === "left" ? "right" : "left";
      store.set("hi.fwSide", sides); placeFw(); window.dispatchEvent(new Event("resize"));
    });
    window.addEventListener("hi:view", placeFw);
    $("#fw-close").addEventListener("click", () => Player.close());
    $("#fw-big").addEventListener("click", () => setFwSize($("#fw").dataset.size === "big" ? "normal" : "big"));
    $("#fw-open").addEventListener("click", () => { if (!Player.current) return; if (!S.byId[Player.current]) { location.hash = "#decouverte"; return; } location.hash = "#" + Player.current; if (S.current?.id !== Player.current) load(Player.current, "fiche"); showView("booth"); $("#now-playing").scrollIntoView({ behavior: "smooth", block: "center" }); });
    $("#lib-search").addEventListener("input", () => renderLibrary());
    $("#btn-play").addEventListener("click", () => Pulse.toggle());
    $("#engine-seg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setEngine(b.dataset.engine); });
    $("#engine-seg").addEventListener("keydown", (e) => {
      const order = ["909", "808", "303", "log"]; const i = order.indexOf(Pulse.engine);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault(); const n = order[(i + (e.key === "ArrowRight" ? 1 : 3)) % 4]; setEngine(n);
        $(`#engine-seg [data-engine="${n}"]`).focus();
      }
    });
    $("#vol").addEventListener("input", (e) => { if (Pulse.master) Pulse.master.gain.value = +e.target.value; });
    $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[role=tab]"); if (b) { tabChosen = true; selectTab(b.id); } });
    $("#tabs").addEventListener("keydown", (e) => {
      const tabs = [...document.querySelectorAll("#tabs [role=tab]")].filter((t) => !t.hidden); const i = tabs.findIndex((t) => t.id === S.tab);
      if (e.key === "ArrowRight") { e.preventDefault(); selectTab(tabs[(i + 1) % tabs.length].id, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); selectTab(tabs[(i + tabs.length - 1) % tabs.length].id, true); }
    });
    $("#exp-md").addEventListener("click", () => exportMemory("md"));
    $("#exp-json").addEventListener("click", () => exportMemory("json"));
    $("#mem-clear").addEventListener("click", () => { S.memory = []; store.set("hi.memory", []); renderMemory(); toast(_t("mem.cleared")); });
    $("#modal").addEventListener("click", (e) => { if (e.target === $("#modal")) $("#modal").close(); });
    window.addEventListener("hashchange", route);
    document.addEventListener("keydown", (e) => {
      if (e.target.closest("input, textarea, select, [role=tablist], [role=radiogroup]") || $("#modal").open || view !== "booth") return;
      if (e.code === "Space" && !e.target.closest("button")) { e.preventDefault(); Pulse.toggle(); }
      if (e.key === "n" || e.key === "N") $("#btn-mix").click();
    });
    // ressentir le tempo : Amapiano 113 / Chicago 121 / UK Garage 132
    const feel = $("#feel-chips");
    for (const [id, lbl] of [["ke-star", "113 · Amapiano"], ["move-your-body", "121 · Chicago"], ["re-rewind", "132 · UK Garage"], ["inner-city-life", "166 · Jungle"]]) {
      const t = S.byId[id]; if (!t) continue;
      feel.append(h("button", { class: "chip", style: `--c:${S.genreById[t.genre].color}`, onclick: () => { load(id, "feel"); if (!Pulse.playing) Pulse.toggle(); } }, h("span", { class: "dot" }), lbl));
    }
  }


  // ---------- FENÊTRE D'ÉCOUTE PERSISTANTE (YouTube IFrame API, sans compte) ----------
  const Player = {
    yt: null, ready: false, apiLoading: false, current: null, candidate: 0, mode: "list", queue: null, playing: false, pending: null,
    loadApi() {
      if (this.apiLoading) return; this.apiLoading = true;
      window.onYouTubeIframeAPIReady = () => {
        this.yt = new YT.Player("yt-player", {
          host: "https://www.youtube-nocookie.com",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => { this.ready = true; if (this.pending) { const p = this.pending; this.pending = null; this.cue(p.id, p.autoplay); } },
            onStateChange: (e) => this.onState(e.data),
            onError: () => this.onError(),
          },
        });
      };
      const tag = document.createElement("script"); tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => toast(_t("toast.ytFail"));
      document.head.append(tag);
    },
    // opts.queue : liste d'identifiants (station du métro, lecture d'un livre…)
    play(id, opts = {}) {
      const t = item(id); if (!t) return;
      if (!t.youtube?.length) { toast(_t("toast.noVideo")); return; }
      if ("queue" in opts) this.queue = opts.queue;
      this.current = id; this.candidate = 0;
      if (Pulse.playing) Pulse.toggle();                     // exclusion sonore : la musique coupe le pulse
      closeBandcamp();                                       // … et le lecteur Bandcamp d'« En ce moment »
      if (S.byId[id] && S.current?.id !== id) load(id, "écoute", { noScroll: true });
      $("#yt-empty").hidden = true;
      if ($("#fw").hidden) { $("#fw").hidden = false; window.dispatchEvent(new Event("resize")); }
      if ($("#fw").dataset.size === "mini" && !Player.userMini) setFwSize("normal");
      renderFw(); markPlaying();
      if (!this.ready) { this.pending = { id, autoplay: true }; this.loadApi(); return; }
      this.cue(id, true);
    },
    cue(id, autoplay) {
      const vid = item(id).youtube[this.candidate];
      if (autoplay) this.yt.loadVideoById(vid); else this.yt.cueVideoById(vid);
    },
    onState(st) {
      this.playing = st === 1 || st === 3;
      $("#fw-toggle").textContent = this.playing ? "⏸" : "▶";
      $("#fw").classList.toggle("is-playing", this.playing);
      markPlaying();
      if (st === 1 && Pulse.playing) Pulse.toggle();
      if (st === 1) closeBandcamp();
      if (st === 0) this.next();
    },
    onError() {
      const t = item(this.current);
      if (t && this.candidate + 1 < t.youtube.length) { this.candidate++; this.cue(this.current, true); toast(_t("toast.altSource")); renderFw(); }
      else { toast(_t("toast.skip")); this.next(); }
    },
    toggle() {
      if (!this.current) { const first = this.list()[0] || S.current; if (first) this.play(first.id); return; }
      if (!this.ready) return;
      if (this.playing) this.yt.pauseVideo(); else { closeBandcamp(); this.yt.playVideo(); }
    },
    pause() { if (this.ready && this.playing) this.yt.pauseVideo(); },
    // fermer : coupe la vidéo et masque la fenêtre ; elle revient au prochain ▶
    close() {
      if (this.ready) this.yt.stopVideo();
      this.playing = false; $("#fw").hidden = true; markPlaying();
      window.dispatchEvent(new Event("resize"));
    },
    list() {
      const base = this.queue ? this.queue.map(item) : filteredTracks().sort((a, b) => a.year - b.year);
      return base.filter((t) => t?.youtube?.length);
    },
    step(dir) {
      const list = this.list(); if (!list.length) return;
      if (this.mode === "algo" && dir > 0) {
        const cur = S.byId[this.current] || S.current;
        const r = recommend(cur).ranked.find((x) => x.t.youtube?.length);
        if (r) return this.play(r.t.id);
      }
      if (this.mode === "shuffle" && dir > 0) {
        const pool = list.filter((t) => t.id !== this.current);
        return this.play((pool[Math.floor(Math.random() * pool.length)] || list[0]).id);
      }
      const i = list.findIndex((t) => t.id === this.current);
      this.play(list[(i + dir + list.length) % list.length].id);
    },
    next() { this.step(1); }, prev() { this.step(-1); },
  };

  function renderFw() {
    const t = item(Player.current); if (!t) return;
    if (!S.byId[t.id]) {   // découverte hors catalogue : pas de BPM ni de clé
      $("#fw").style.setProperty("--fc", "var(--accent)");
      $("#fw-info").replaceChildren(h("span", { class: "fw-title" }, t.title), h("span", { class: "fw-artist" }, t.artist || ""),
        h("span", { class: "fw-meta" }, [_t("disc.kind." + t.kind), t.year].filter(Boolean).join(" · "),
          Player.queue ? _t("fw.queue", { i: Player.list().findIndex((x) => x.id === t.id) + 1, n: Player.list().length }) : ""));
      $("#fw-open").disabled = false; return;
    }
    const g = S.genreById[t.genre];
    $("#fw").style.setProperty("--fc", g.color);
    $("#fw-info").replaceChildren(
      h("span", { class: "fw-title" }, t.title),
      h("span", { class: "fw-artist" }, t.artist),
      h("span", { class: "fw-meta" }, h("b", {}, `${t.bpm} BPM`), ` · ${t.camelot_key} · ${_f(g, "name")} · ${t.year}`,
        Player.queue ? _t("fw.queue", { i: Player.list().findIndex((x) => x.id === t.id) + 1, n: Player.list().length }) : ""),
      ...(Player.candidate > 0 ? [h("span", { class: "fw-alt" }, _t("fw.alt"))] : []));
    $("#fw-open").disabled = false;
  }
  function markPlaying() {
    for (const b of document.querySelectorAll("[data-play]")) {
      const on = b.dataset.play === Player.current;
      b.classList.toggle("on", on);
      b.textContent = on && Player.playing ? "⏸" : "▶";
      b.setAttribute("aria-label", _t(on && Player.playing ? "play.pause" : "play.listen", { t: item(b.dataset.play)?.title || "" }));
    }
  }
  // bouton ▶ réutilisable (Bac, métro, modales)
  function playBtn(id, queue) {
    const t = item(id);
    return h("button", { class: "play-mini", "data-play": id, disabled: !t?.youtube?.length, "aria-label": _t("play.listen", { t: t?.title || "" }),
      onclick: (e) => { e.stopPropagation(); Player.current === id ? Player.toggle() : Player.play(id, { queue: queue || null }); } },
      Player.current === id && Player.playing ? "⏸" : "▶");
  }
  // côté de la fenêtre : à gauche sur le plan du métro (le coin bas-gauche du plan est vide, le panneau est à droite)
  function placeFw() {
    const chosen = store.get("hi.fwSide", {})[view];
    // à gauche sur le plan (coin vide) et dans le Booth (au-dessus du Bac, la colonne de lecture reste libre à droite)
    $("#fw").dataset.side = chosen || (view === "bibliotheque" || view === "decouverte" ? "right" : "left");
  }
  function setFwSize(size) {
    const fw = $("#fw"); fw.dataset.size = size;
    $("#fw-size").textContent = size === "mini" ? "▢" : "▁";
    $("#fw-size").setAttribute("aria-label", size === "mini" ? _t("fw.expand") : _t("fw.reduce"));
    $("#fw-size").title = $("#fw-size").getAttribute("aria-label");
    $("#fw-big").setAttribute("aria-label", size === "big" ? _t("fw.normal") : _t("fw.big"));
    $("#fw-big").title = $("#fw-big").getAttribute("aria-label");
    store.set("hi.fw", size === "big" ? "normal" : size);
  }

  // ---------- VUES (Booth / Plan du Métro / Bibliothèque) ----------
  const VIEWS = ["booth", "metro", "decouverte", "bibliotheque"];
  let view = "metro";
  function initialView() {
    const hsh = decodeURIComponent(location.hash.slice(1)), base = hsh.split(/[?/]/)[0];
    if (VIEWS.includes(base)) return base;
    if (S.byId[hsh] || S.byId[new URLSearchParams(location.search).get("track")]) return "booth";
    return "metro";
  }
  function showView(v, { focus = false } = {}) {
    if (!VIEWS.includes(v)) v = "metro";
    view = v;
    for (const el of document.querySelectorAll("[data-view]")) el.hidden = el.dataset.view !== v;
    for (const a of document.querySelectorAll("[data-view-link]")) a.toggleAttribute("aria-current", a.dataset.viewLink === v), a.dataset.viewLink === v && a.setAttribute("aria-current", "page");
    if (v === "bibliotheque") renderLibrary();
    if (v === "decouverte") renderDiscovery();
    window.dispatchEvent(new CustomEvent("hi:view", { detail: v }));
    if (focus) { $("#views").focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }
  }
  function route() {
    const hsh = decodeURIComponent(location.hash.slice(1));
    const base = hsh.split(/[?/]/)[0];
    if (VIEWS.includes(base)) return showView(base, { focus: true });
    const qTrack = new URLSearchParams(location.search).get("track");
    const id = S.byId[hsh] ? hsh : !hsh && S.byId[qTrack] ? qTrack : null;
    if (!id) return showView("metro");          // accueil : le plan du métro
    showView("booth");
    if (S.current?.id !== id) load(id, "hash");
  }

  // ---------- BIBLIOTHÈQUE ----------
  const LIB = { type: "all" };
  const srcType = (s) => /film/i.test(s.type) ? "film" : /magazine/i.test(s.type) ? "magazine" : "livre";
  function linkedTracks(id) { return S.tracks.filter((t) => t.archive_ref?.source === id || (t.further_reading || []).includes(id)); }
  function renderLibrary() {
    const types = [["all", _t("lib.all")], ["livre", _t("lib.books")], ["film", _t("lib.films")], ["magazine", _t("lib.mags")]];
    $("#lib-types").replaceChildren(...types.map(([k, l]) => h("button", { class: "chip", "aria-pressed": LIB.type === k ? "true" : "false", onclick: () => { LIB.type = k; renderLibrary(); } },
      l, h("span", { class: "n" }, k === "all" ? S.sources.length : S.sources.filter((s) => srcType(s) === k).length))));
    const q = ($("#lib-search").value || "").trim().toLowerCase();
    const items = S.sources.filter((s) => (LIB.type === "all" || srcType(s) === LIB.type) &&
      (!q || [s.title, _f(s, "author"), _f(s, "type"), ...(_f(s, "themes") || [])].join(" ").toLowerCase().includes(q)))
      .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
    $("#lib-grid").replaceChildren(...(items.length ? items.map((s) => {
      const n = linkedTracks(s.id).length;
      return h("button", { class: "lib-card", onclick: () => openSource(s.id) },
        h("span", { class: "lt" }, `${_f(s, "type").split("(")[0].trim()}${s.year ? " · " + s.year : ""}`),
        h("b", {}, s.title), h("span", { class: "la" }, _f(s, "author")),
        h("span", { class: "lc" }, _f(s, "contribution")),
        h("span", { class: "lf" }, h("span", {}, n ? _t(n > 1 ? "lib.linkedN" : "lib.linked1", { n }) : _t("lib.none")),
          s.to_verify ? h("span", { class: "warn-b" }, _t("lib.verify")) : null));
    }) : [h("p", { class: "empty" }, _t("lib.empty"))]));
  }

  // ---------- DÉCOUVERTE (« En ce moment » : écoutes et lectures du moment) ----------
  // data/decouvertes.json : entrées datées. Un disque peut renvoyer à une fiche du catalogue (track)
  // ou porter ses propres vidéos (youtube) : il devient alors jouable sous l'identifiant « d:<id> ».
  const DISC = { kind: "all" };
  const DISC_KINDS = ["nouveau", "redecouverte", "lecture", "film", "mix"];
  async function loadJson(name) {
    if (location.protocol !== "file:") try { const r = await fetch(`data/${name}.json`); if (r.ok) return await r.json(); } catch { /* repli ci-dessous */ }
    return window.HI_DATA?.[name] || null;
  }
  async function loadDiscovery() {
    const [d, m] = await Promise.all([loadJson("decouvertes"), loadJson("metro")]);
    S.stations = m?.stations || {}; S.lines = m?.lines || [];
    S.discEntries = (d?.entries || []).filter((e) => e.id && e.date && DISC_KINDS.includes(e.kind)).sort((a, b) => b.date.localeCompare(a.date));
    for (const e of S.discEntries) if (!e.track && e.youtube?.length) S.disc["d:" + e.id] = { ...e, id: "d:" + e.id };
    const link = $('[data-view-link="decouverte"]'); if (link) link.hidden = !S.discEntries.length;   // rubrique masquée tant qu'elle est vide
  }
  // Bandcamp : lecteur officiel intégré, ouvert d'emblée (on clique sur sa lecture).
  // Un clic dans un lecteur Bandcamp met la fenêtre YouTube en pause (le focus passe à l'iframe : événement blur).
  // Quand YouTube reprend, le lecteur Bandcamp actif est rechargé, ce qui coupe son son.
  function bcSrc(b) {
    return `https://bandcamp.com/EmbeddedPlayer/v=2/${b.type === "track" ? "track" : "album"}=${encodeURIComponent(b.id)}/size=large/bgcol=161412/linkcol=d4ff3a/tracklist=false/artwork=small/transparent=true/`;
  }
  function closeBandcamp() {
    for (const f of document.querySelectorAll(".bc-slot iframe[data-active]")) { f.removeAttribute("data-active"); f.src = f.src; }
  }
  function bcSlot(b) {
    return h("div", { class: "bc-slot" }, h("iframe", { src: bcSrc(b), title: _t("disc.bcTitle"), loading: "lazy", allow: "autoplay" }));
  }
  window.addEventListener("blur", () => setTimeout(() => {
    const f = document.activeElement;
    if (f?.tagName !== "IFRAME" || !f.closest(".bc-slot")) return;
    for (const o of document.querySelectorAll(".bc-slot iframe[data-active]")) if (o !== f) { o.removeAttribute("data-active"); o.src = o.src; }
    f.setAttribute("data-active", "");
    Player.pause(); if (Pulse.playing) Pulse.toggle();
  }, 0));
  const discPlayId = (e) => (e.track && S.byId[e.track]?.youtube?.length ? e.track : S.disc["d:" + e.id] ? "d:" + e.id : null);
  function discDate(iso) {
    try { return new Date(iso + "T12:00:00").toLocaleDateString(window.I18N.lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", year: "numeric" }); } catch { return iso; }
  }
  function renderDiscovery() {
    const all = S.discEntries || [];
    const present = DISC_KINDS.filter((k) => all.some((e) => e.kind === k));
    $("#disc-kinds").replaceChildren(...[["all", _t("disc.all")], ...present.map((k) => [k, _t("disc.kinds." + k)])].map(([k, l]) =>
      h("button", { class: "chip", "aria-pressed": DISC.kind === k ? "true" : "false", onclick: () => { DISC.kind = k; renderDiscovery(); } },
        l, h("span", { class: "n" }, k === "all" ? all.length : all.filter((e) => e.kind === k).length))));
    const items = all.filter((e) => DISC.kind === "all" || e.kind === DISC.kind);
    const queue = items.map(discPlayId).filter(Boolean);
    $("#disc-all").hidden = queue.length < 2;
    $("#disc-all").textContent = _t("disc.listenAll", { n: queue.length });
    $("#disc-all").onclick = () => Player.play(queue[0], { queue });
    $("#disc-list").replaceChildren(...(items.length ? items.map((e) => {
      const pid = discPlayId(e), cat = e.track && S.byId[e.track];
      const title = e.title || cat?.title, who = e.artist || e.author || cat?.artist;
      const meta = [e.publisher || e.label || cat?.label, e.year || cat?.year].filter(Boolean).join(", ");
      const st = e.station && S.stations[e.station];
      const line = st && S.lines.find((l) => l.stations.includes(e.station));
      const src = e.source && S.sourceById[e.source];
      return h("article", { class: "disc-item", id: "d-" + e.id, style: line ? `--c:${line.color}` : "" },
        h("div", { class: "disc-date" }, h("time", { datetime: e.date }, discDate(e.date))),
        h("div", { class: "disc-body" },
          h("span", { class: "disc-kind" }, _t("disc.kind." + e.kind)),
          h("div", { class: "disc-head" }, pid ? playBtn(pid, queue) : null,
            h("h2", {}, who ? h("span", { class: "who" }, who + " — ") : null, title, meta ? h("small", {}, ` (${meta})`) : null)),
          _f(e, "context") ? h("p", { class: "disc-context" }, _f(e, "context")) : null,
          _f(e, "note") ? h("p", { class: "disc-note" }, _f(e, "note")) : null,
          e.highlight ? h("p", { class: "disc-hl" }, h("span", {}, _t("disc.highlight")), " ", h("b", {}, e.highlight)) : null,
          e.bandcamp?.id ? bcSlot(e.bandcamp) : null,
          h("div", { class: "links" },
            st ? h("a", { class: "chip", href: `#metro?st=${e.station}` }, h("span", { class: "dot" }), `${line ? "L" + line.num + " · " : ""}${_f(st, "name")}`) : null,
            cat ? h("a", { class: "chip", href: "#" + cat.id }, _t("disc.toRecord")) : null,
            src ? h("button", { class: "chip", onclick: () => openSource(src.id) }, _t("disc.toSource", { t: src.title.split(":")[0] })) : null,
            e.bandcamp?.url ? h("a", { class: "chip bc-link", href: e.bandcamp.url, target: "_blank", rel: "noopener" }, _t(e.kind === "lecture" ? "disc.bcPublisher" : "disc.bcSupport")) : null,
            e.link ? h("a", { class: "chip", href: e.link, target: "_blank", rel: "noopener" }, _t("disc.link")) : null),
          e.verify?.length ? h("p", { class: "warn-b disc-verify" }, _t("disc.verify")) : null));
    }) : [h("p", { class: "empty" }, _t("disc.empty"))]));
    markPlaying();
  }

  // ---------- INIT ----------
  async function init() {
    try {
      let tr, ma, so;
      try {
        if (location.protocol === "file:") throw new Error("file://");
        [tr, ma, so] = await Promise.all(["data/tracks.json", "data/machines.json", "data/sources.json"].map(async (u) => {
          const r = await fetch(u); if (!r.ok) throw new Error(`${u} : HTTP ${r.status}`); return r.json();
        }));
      } catch (e) {
        // ouverture directe (file://) : fetch est bloqué, on charge la copie embarquée data/bundle.js à la demande
        if (!window.HI_DATA) await new Promise((ok, ko) => {
          const sc = document.createElement("script"); sc.src = "data/bundle.js"; sc.onload = ok; sc.onerror = () => ko(e); document.head.append(sc);
        });
        ({ tracks: tr, machines: ma, sources: so } = window.HI_DATA);
      }
      S.eras = tr.eras; S.genres = tr.genres; S.scenes = tr.scenes || []; S.tracks = tr.tracks; S.machines = ma.machines; S.sources = so.sources;
    } catch (err) {
      document.querySelector(".layout").innerHTML = `<p class="panel" style="grid-column:1/-1">${_t("err.load", { e: esc(err.message) })}${location.protocol === "file:" ? _t("err.file") : _t("err.net")}</p>`;
      console.warn("[House Intelligence] chargement des données impossible :", err);
      return;
    }
    for (const t of S.tracks) S.byId[t.id] = t;
    for (const g of S.genres) S.genreById[g.id] = g;
    for (const sc of S.scenes) S.sceneById[sc.id] = sc;
    for (const e of S.eras) S.eraById[e.id] = e;
    for (const m of S.machines) S.machineById[m.id] = m;
    for (const s of S.sources) S.sourceById[s.id] = s;
    await loadDiscovery();
    $("#foot-sources").textContent = S.sources.map((s) => s.title).join(" · ");

    S.memory = store.get("hi.memory", []).filter((m) => S.byId[m.id]);
    bind(); renderFilters(); renderSteer(); renderMemory(); renderCrate();
    setFwSize("mini");   // au repos : simple barre, la vidéo se déplie au lancement d'un disque
    if (window.matchMedia("(max-width: 700px)").matches) $("#fw").hidden = true;   // mobile : rien tant qu'aucun disque ne joue
    // réserve la place de la fenêtre d'écoute : les panneaux collants s'arrêtent au-dessus d'elle
    const fwEl = $("#fw");
    let raf = 0;
    const reserve = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const fr = fwEl.getBoundingClientRect();
        const space = Math.ceil(fr.height + 24);
        document.documentElement.style.setProperty("--fw-space", `${space}px`);
        // un panneau collant ne s'arrête au-dessus de la fenêtre que s'il se trouve dans la même colonne qu'elle
        for (const el of document.querySelectorAll(".metro-panel, .crate")) {
          const er = el.getBoundingClientRect();
          const sameColumn = er.left < fr.right && er.right > fr.left;
          if (!el.offsetParent || getComputedStyle(el).position !== "sticky" || !sameColumn) { el.style.maxHeight = ""; continue; }
          const top = Math.max(el.getBoundingClientRect().top, 0);
          el.style.maxHeight = `${Math.max(180, window.innerHeight - top - space)}px`;
        }
      });
    };
    if ("ResizeObserver" in window) new ResizeObserver(reserve).observe(fwEl);
    reserve();
    window.addEventListener("resize", reserve);
    window.addEventListener("scroll", reserve, { passive: true });
    window.addEventListener("hi:view", () => setTimeout(reserve, 50));
    view = initialView();
    const fromHash = decodeURIComponent(location.hash.slice(1));
    const qTrack = new URLSearchParams(location.search).get("track");
    const linked = S.byId[fromHash] ? fromHash : S.byId[qTrack] ? qTrack : null;
    const start = linked || (S.byId[store.get("hi.current")] ? store.get("hi.current") : "move-your-body");
    load(start, linked ? "hash" : "init", { noMemory: S.memory.length > 0 && S.memory.at(-1).id === start });
    route();
    // bascule FR / EN : tout se re-rend sans recharger la page ni couper la musique
    for (const b of document.querySelectorAll("[data-lang]")) b.addEventListener("click", () => window.I18N.set(b.dataset.lang));
    window.addEventListener("hi:lang", rerenderAll);
  }

  function rerenderAll() {
    const keep = S.reco?.best?.t.id;
    renderFilters(); renderCrate(); renderSteer(); renderMemory();
    if (S.current) {
      renderNow(); renderTabs();
      S.reco = recommend(S.current);
      const i = S.reco.ranked.findIndex((x) => x.t.id === keep);
      if (i > 0) S.reco = { best: S.reco.ranked[i], ranked: [S.reco.ranked[i], ...S.reco.ranked.filter((_, j) => j !== i)] };
      renderTransition();
      Pulse.setTrack(S.current);
    }
    $("#btn-play .lbl").textContent = Pulse.playing ? _t("pulse.stop") : _t("pulse.start");
    if (Player.current) renderFw();
    markPlaying(); setFwSize($("#fw").dataset.size);
    if (view === "bibliotheque") renderLibrary();
    if (view === "decouverte") renderDiscovery();
    if ($("#modal").open) $("#modal").close();
    $("#foot-sources").textContent = S.sources.map((s) => s.title).join(" · ");
  }

  function item(id) { return S.byId[id] || S.disc[id]; }
  window.HI = { _t, _f, Player, playBtn, openMachine, openSource, showView, h, toast, store, S, recommend, camelotRelation, bpmRelation, Pulse, load, setFilter }; // debug / tests
  // manifeste PWA : seulement en HTTP(S) (en file://, le navigateur le bloque et affiche une erreur)
  if (location.protocol.startsWith("http")) { const l = document.createElement("link"); l.rel = "manifest"; l.href = "manifest.webmanifest"; document.head.append(l); }
  document.addEventListener("DOMContentLoaded", init);
})();
