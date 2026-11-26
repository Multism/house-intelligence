/* House Intelligence — améliorations progressives des pages du wiki.
 * Le contenu est entièrement dans le HTML ; ce script ajoute l'écoute, les filtres et le lecteur. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- Écoute à la demande (fiches morceau) : rien n'est chargé depuis YouTube avant le clic ----------
  for (const box of $$(".listen")) {
    const ids = JSON.parse(box.dataset.yt || "[]");
    let i = 0;
    box.querySelector(".listen-btn").addEventListener("click", () => {
      const render = () => {
        box.innerHTML = `<div class="yt-frame"><iframe src="https://www.youtube-nocookie.com/embed/${ids[i]}?autoplay=1&rel=0" title="Lecture : ${box.dataset.title.replace(/"/g, "&quot;")}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
          ${ids.length > 1 ? `<button type="button" class="btn sm alt-src">Vidéo indisponible ? Essayer une autre source (${(i + 1) % ids.length + 1}/${ids.length})</button>` : ""}`;
        box.querySelector(".alt-src")?.addEventListener("click", () => { i = (i + 1) % ids.length; render(); });
      };
      render();
    });
  }

  // ---------- Bibliothèque : filtres ----------
  const lib = $("[data-lib]");
  if (lib) {
    let type = "all";
    const items = $$(".lib-grid > li"), input = $("[data-lib-search]");
    const apply = () => {
      const q = input.value.trim().toLowerCase();
      for (const li of items) li.hidden = !((type === "all" || li.dataset.type === type) && (!q || li.dataset.text.includes(q)));
    };
    for (const b of $$("[data-type]", lib)) b.addEventListener("click", () => {
      type = b.dataset.type; for (const x of $$("[data-type]", lib)) x.setAttribute("aria-pressed", x === b); apply();
    });
    input.addEventListener("input", apply);
  }

  // ---------- Lecteur ----------
  const root = $("[data-player]");
  if (!root) return;
  const rows = $$(".pl-row", root);
  const P = { yt: null, ready: false, current: null, cand: 0, queue: null, shuffle: false, playing: false, pending: null };
  const visible = () => rows.filter((r) => !r.hidden && !r.closest(".pl-group").hidden && JSON.parse(r.dataset.yt).length);
  const ids = (r) => JSON.parse(r.dataset.yt);
  const rowOf = (id) => rows.find((r) => r.dataset.id === id);
  function loadApi() {
    if (window.YT?.Player || P.loading) return; P.loading = true;
    window.onYouTubeIframeAPIReady = () => {
      P.yt = new YT.Player("yt-player", {
        host: "https://www.youtube-nocookie.com", playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => { P.ready = true; if (P.pending) { const id = P.pending; P.pending = null; cue(id); } },
          onStateChange: (e) => { P.playing = e.data === 1 || e.data === 3; ui(); if (e.data === 0) step(1); },
          onError: () => { const r = rowOf(P.current); if (r && P.cand + 1 < ids(r).length) { P.cand++; cue(P.current); } else step(1); },
        },
      });
    };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.append(s);
  }
  function cue(id) { P.yt.loadVideoById(ids(rowOf(id))[P.cand]); }
  function play(id) {
    const r = rowOf(id); if (!r || !ids(r).length) return;
    P.current = id; P.cand = 0; $(".yt-empty", root).hidden = true;
    const t = r.querySelector(".tt a").textContent, a = r.querySelector(".tt small").textContent;
    $(".player-now", root).textContent = `${t} · ${a}`;
    ui();
    if (!P.ready) { P.pending = id; loadApi(); } else cue(id);
  }
  function list() { return P.queue ? P.queue.map(rowOf).filter(Boolean) : visible(); }
  function step(d) {
    const l = list(); if (!l.length) return;
    if (P.shuffle && d > 0) { const pool = l.filter((r) => r.dataset.id !== P.current); return play((pool[Math.floor(Math.random() * pool.length)] || l[0]).dataset.id); }
    const i = l.findIndex((r) => r.dataset.id === P.current);
    play(l[(i + d + l.length) % l.length].dataset.id);
  }
  function toggle() {
    if (!P.current) { const f = list()[0]; if (f) play(f.dataset.id); return; }
    if (P.ready) P.playing ? P.yt.pauseVideo() : P.yt.playVideo();
  }
  function ui() {
    $('[data-act="toggle"]', root).textContent = P.playing ? "⏸" : "▶";
    for (const r of rows) {
      const on = r.dataset.id === P.current; r.classList.toggle("playing", on);
      r.querySelector(".pb").textContent = on && P.playing ? "⏸" : "▶";
      r.querySelector(".pb").setAttribute("aria-pressed", on && P.playing);
    }
  }
  for (const r of rows) r.querySelector(".pb").addEventListener("click", () => (P.current === r.dataset.id ? toggle() : (P.queue = null, play(r.dataset.id))));
  for (const b of $$("[data-play-group]", root)) b.addEventListener("click", () => {
    P.queue = rows.filter((r) => r.dataset.genre === b.dataset.playGroup && ids(r).length).map((r) => r.dataset.id);
    if (P.queue.length) play(P.queue[0]);
  });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "toggle") toggle(); else if (a === "next") step(1); else if (a === "prev") step(-1);
    else if (a === "shuffle") { P.shuffle = !P.shuffle; b.setAttribute("aria-pressed", P.shuffle); }
  });
  $("[data-pl-search]", root).addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase(); P.queue = null;
    for (const r of rows) r.hidden = q && !r.dataset.text.includes(q);
    for (const g of $$(".pl-group", root)) g.hidden = !$$(".pl-row", g).some((r) => !r.hidden);
  });
  // file d'attente depuis une autre page : /lecteur/#q=id1,id2
  const m = /q=([\w,-]+)/.exec(location.hash);
  if (m) {
    P.queue = m[1].split(",").filter((id) => rowOf(id));
    if (P.queue.length) {
      $(".player-now", root).textContent = `File d'attente : ${P.queue.length} disques. Appuyez sur ▶ pour commencer.`;
      rowOf(P.queue[0]).scrollIntoView({ block: "center" });
    }
  }
  window.HIPlayer = P;
})();
