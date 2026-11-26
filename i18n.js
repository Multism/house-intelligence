/* HOUSE INTELLIGENCE — internationalisation FR / EN
 * t(key, vars)  : libellé d'interface
 * f(obj, field) : champ de contenu localisé (obj[field + "_en"] en anglais, sinon obj[field])
 * Les éléments HTML portent data-i18n="clé" (contenu) et data-i18n-attr="attribut=clé;attribut=clé". */
(() => {
  "use strict";
  const STR = {
    fr: {
      "skip": "Aller au contenu",
      "logo.aria": "House Intelligence, retour au plan du métro",
      "tagline": "Booth éditorial · histoire, machines &amp; sociologie de la house · 1970 → aujourd'hui",
      "nav.aria": "Vues", "nav.metro": "Plan du Métro <small>(Généalogie)</small>", "nav.booth": "The Booth", "nav.library": "Bibliothèque",
      "lang.aria": "Langue",
      "filters.aria": "Filtres", "filters.eras": "Ères", "filters.genres": "Genres", "filters.machines": "Machines",
      "filters.eras.aria": "Époques", "filters.genres.aria": "Sous-genres",
      "filters.all": "Tout", "filters.allMachines": "Toutes", "filters.cousins": "Lignées voisines",
      "filters.cousins.title": "Musiques voisines de la house, citées par les lectures du projet",
      "crate.title": "Le Bac", "crate.empty": "Aucun disque ne correspond à ce filtre.",
      "deck.kicker": "Sur la platine", "deck.listen": "▶ Écouter le disque", "deck.spotify": "Ouvrir dans Spotify ↗",
      "badge.energy": "Énergie", "badge.label": "Label", "badge.city": "Ville", "badge.year": "Année",
      "tr.title": "Transition recommandée", "tr.how": "Comment ça marche ?",
      "tr.how.body": "<p><b>Camelot</b> : les 24 tonalités sont rangées sur une roue de 1 à 12 (A = mineur, B = majeur). Deux disques voisins sur la roue se superposent sans fausse note.</p><p><b>Pitch</b> : le curseur de vitesse d'une platine, généralement ±8 %. Au-delà, on ne peut plus caler les deux disques.</p><p><b>Compatibilité</b> : un score sur 100 qui combine l'harmonie (48 %), la proximité de tempo (37 %) et l'intention choisie dans « Steer the Room ».</p>",
      "tr.wheel": "Roue Camelot", "tr.tempo": "Delta de tempo", "tr.mix": "Enchaîner →", "tr.none": "Aucun disque disponible.",
      "tr.legend": "zone ombrée = pitch ±8 % autour de A",
      "m.tempo": "Δ Tempo", "m.pitch": "Pitch B", "m.key": "Clé", "m.compat": "Compatibilité", "m.move": "Mouvement {m}",
      "m.inFader": "dans la course du fader", "m.outFader": "hors course", "m.harmony": "harmonie {h} · tempo {t}",
      "bpm.direct": "Calage direct", "bpm.inRange": "Dans la plage du pitch ±8 %", "bpm.out": "Hors pitch : transition en cassure ou en break",
      "cam.unknown": "Clé inconnue", "cam.same": "Même clé : mix parfait", "cam.up1": "+1 : quinte ascendante, ça ouvre", "cam.down1": "−1 : quarte, ça se pose",
      "cam.up2": "+2 : boost d'énergie (un ton au-dessus)", "cam.up7": "+7 : montée d'un demi-ton, effet « key change »", "cam.down2": "−2 : descente d'un ton, à mixer court",
      "cam.relMaj": "Relatif majeur : la couleur s'éclaire", "cam.relMin": "Relatif mineur : la couleur s'assombrit", "cam.diag": "Diagonale : changement de mode et de quinte",
      "cam.jump": "Saut de {n} cases : clash harmonique, mixer en coupe sèche",
      "n.stay": "On reste à <em>{city}</em>", "n.travel": "De <em>{a}</em> ({ya}) à <em>{b}</em> ({yb})",
      "n.forward": ", un bond de {n} ans vers l'avant", "n.back": ", un retour de {n} ans en arrière",
      "n.sameBpm": "Même tempo ({bpm} BPM) : les kicks se superposent sans toucher au pitch.",
      "n.pitch": "Pitch de {p} % sur la platine B pour caler {a} BPM, puis on relâche progressivement vers {b}.",
      "n.cut": "{d} BPM d'écart : impossible au pitch. On coupe sur un break ou on laisse le premier disque s'éteindre a cappella.",
      "n.keyLong": "{k} : les nappes peuvent se chevaucher longtemps.", "n.keyPerc": "{k} : on chevauche sur les percussions, pas sur les accords.",
      "n.grammar": "Changement de grammaire ({a} → {b}) : {g}.",
      "g.twostep": "le 2-step déhanche le kick", "g.amapiano": "le log drum remplace le kick comme moteur", "g.tribal": "les toms prennent le pouvoir",
      "g.jack": "le jack raidit le groove", "g.acid": "la 303 prend la parole", "g.deep": "le groove s'adoucit", "g.afro": "la polyrythmie s'installe",
      "g.filter": "le filtre respire", "g.lofi": "le son se voile", "g.hiphouse": "le MC entre", "g.garage": "la soul garage monte",
      "g.disco": "les cordes et la basse en octaves reviennent", "g.breakbeat": "le kick se brise en breakbeat", "g.trance": "les arpèges prennent le relais",
      "g.four": "le four-on-the-floor se tend", "g.default": "le groove change",
      "steer.title": "Steer the Room", "steer.none": "Choisissez une intention pour orienter le disque suivant", "steer.active": "Intention : {n}",
      "steer.up.name": "Faire monter", "steer.up.desc": "Plus d'énergie, la piste décolle", "steer.up.say": "On fait monter la pièce",
      "steer.deep.name": "Plonger deep", "steer.deep.desc": "Moins d'énergie, plus d'introspection", "steer.deep.say": "On redescend vers les profondeurs",
      "steer.roots.name": "Vers les racines", "steer.roots.desc": "Remonter le temps, vers Chicago et le Garage", "steer.roots.say": "On rembobine vers les fondations",
      "steer.future.name": "Vers le futur", "steer.future.desc": "Avancer vers les héritages récents", "steer.future.say": "On projette la pièce vers l'avant",
      "steer.queer.name": "Axe ballroom", "steer.queer.desc": "Suivre la lignée queer, drag et ballroom", "steer.queer.say": "On suit le fil queer et ballroom",
      "steer.diaspora.name": "Voyage diasporique", "steer.diaspora.desc": "Changer de ville, de continent", "steer.diaspora.say": "On voyage dans la diaspora",
      "pulse.title": "Pulse · boîte à rythmes", "pulse.start": "Lancer le pulse", "pulse.stop": "Couper le pulse", "pulse.engine": "Moteur sonore",
      "pulse.vol": "Vol", "pulse.feel": "Ressentir le tempo", "pulse.grid": "{g} · grille « {groove} »", "pulse.swing": " · swing {s} %",
      "pulse.noAudio": "Web Audio non supporté par ce navigateur",
      "tab.story": "Histoire &amp; chronologie", "h.story": "Histoire", "h.timeline": "Chronologie", "h.credits": "Crédits", "h.books": "Dans les livres",
      "h.web": "Sources web", "book.pages": "p. {p}", "book.noPages": "pages à relever", "story.verify": "Points encore à vérifier",
      "arch.title": "Archéologie culturelle", "tab.machines": "Machines &amp; construction", "tab.origins": "Origines", "tab.queer": "Ballroom &amp; queer", "tab.socio": "Sociologie &amp; source",
      "h.machines": "Machines", "h.construction": "Construction", "h.queer": "Axe ballroom & scènes queer", "h.socio": "Sociologie du club",
      "h.ref": "Référence bibliographique", "h.further": "Lectures complémentaires", "ref.missing": "Référence à compléter.",
      "mem.title": "The Memory", "mem.clear": "Effacer la session", "mem.empty": "La session commence ici.", "mem.via": "via {v}",
      "mem.cleared": "Session effacée", "mem.exportEmpty": "Session vide : rien à exporter", "mem.exported": "Tracklist exportée (.{f})",
      "md.title": "House Intelligence · Tracklist de session", "md.date": "Exportée le {d}",
      "md.head": "| # | Heure | Artiste | Titre | Genre | BPM | Clé | Transition |",
      "via.écoute": "écoute", "via.métro": "métro", "via.lecteur": "lecteur", "via.bac": "bac", "via.transition": "transition", "via.fiche": "fiche",
      "via.feel": "tempo", "via.init": "ouverture", "via.hash": "lien",
      "mod.close": "Fermer", "mod.intended": "Usage prévu", "mod.hijack": "Détournement", "mod.signature": "Signature sonore", "mod.inHouse": "Dans la house",
      "mod.trivia": "Anecdote", "mod.inCrate": "Dans le bac", "mod.hearEngine": "▶ Entendre le moteur {e}", "mod.filterMachine": "Filtrer le bac par cette machine",
      "mod.contribution": "Apport au projet", "mod.themes": "Thèmes", "mod.genres": "Genres éclairés", "mod.cited": "Disques cités",
      "mod.listenAll": "▶ Écouter les {n} disques de cette lecture", "mod.verify": "⚠ Métadonnées à vérifier ou compléter.",
      "metro.title": "Plan du Métro <small>Généalogie de la house</small>",
      "metro.intro": "Neuf lignes, de la disco du Loft à l'amapiano. Cliquez sur une station pour son histoire et ses disques, sur une correspondance (trait en pointillé) pour le pont entre deux scènes.",
      "metro.lines": "Lignes", "metro.share": "Partager la vue", "metro.export": "Exporter (SVG)", "metro.svg": "Plan du métro généalogique de la house",
      "metro.pick": "Choisissez une station",
      "metro.pickBody": "{n} stations sur {l} lignes, de la disco du Loft à l'amapiano. Les doubles cercles blancs sont des correspondances ; les traits en pointillé relient deux scènes et racontent leur pont historique.",
      "metro.pickNote": "Les stations grisées n'ont pas encore de disque dans le bac : le plan dessine la généalogie complète, le bac la suit progressivement.",
      "metro.records": "Disques · {n}", "metro.listenStation": "▶ Écouter toute la station", "metro.toBooth": "Voir dans The Booth",
      "metro.conns": "Correspondances", "metro.read": "Pour lire", "metro.emptyDefault": "Aucun disque du bac pour cette station.",
      "metro.stationAria": "Station {s}, {lines}, {n} disque(s)", "metro.line": "ligne {n}", "metro.linesN": "lignes {n}",
      "metro.transferAria": "Correspondance : {t}", "metro.copied": "Lien de la vue copié", "metro.exported": "Plan exporté (.svg)",
      "metro.loadError": "Impossible de charger le plan du métro.", "metro.svgFooter": "HOUSE/INTELLIGENCE · Plan du Métro généalogique",
      "lib.title": "La Bibliothèque", "lib.intro": "Toutes les références du projet (livres, films, magazines) et les disques qu'elles éclairent.",
      "lib.search": "Chercher un titre, un auteur, un thème…", "lib.searchAria": "Chercher dans la bibliothèque",
      "lib.all": "Tout", "lib.books": "Livres", "lib.films": "Films", "lib.mags": "Magazines",
      "lib.linked1": "{n} disque lié", "lib.linkedN": "{n} disques liés", "lib.none": "aucun disque lié", "lib.verify": "à vérifier", "lib.empty": "Aucune référence ne correspond.",
      "fw.aria": "Fenêtre d'écoute", "fw.label": "Fenêtre d'écoute", "fw.side": "Déplacer la fenêtre de l'autre côté", "fw.sideTitle": "Changer de côté",
      "fw.reduce": "Réduire la fenêtre", "fw.expand": "Déplier la fenêtre", "fw.big": "Agrandir la fenêtre", "fw.normal": "Taille normale",
      "fw.empty": "Cliquez ▶ sur un disque", "fw.none": "Aucun disque en cours", "fw.noneHint": "Le Bac, le Booth ou une station du métro",
      "fw.prev": "Disque précédent", "fw.toggle": "Lecture ou pause", "fw.next": "Disque suivant", "fw.mode": "Enchaînement",
      "fw.mode.list": "Suite de la liste", "fw.mode.algo": "Transition Camelot", "fw.mode.shuffle": "Aléatoire",
      "fw.open": "Voir dans The Booth", "fw.queue": " · file : {i}/{n}", "fw.alt": "Source alternative (vidéo principale bloquée)",
      "play.listen": "Écouter {t}", "play.pause": "Mettre en pause {t}",
      "toast.noVideo": "Pas de vidéo disponible pour ce disque", "toast.ytFail": "Impossible de charger le lecteur YouTube (connexion ?)",
      "toast.altSource": "Vidéo bloquée : source alternative", "toast.skip": "Vidéo indisponible : disque suivant",
      "foot": "House Intelligence · v1 — BPM et clés : valeurs éditoriales indicatives.", "foot.sources": "Les sources du projet", "fw.close": "Fermer la fenêtre",
      "err.load": "Impossible de charger les données ({e}).",
      "err.file": " La page a été ouverte directement depuis le disque : ouvrez plutôt <code>http://localhost:8765/</code> après avoir lancé <code>python3 -m http.server 8765</code> dans le dossier du site.",
      "err.net": " Vérifiez la connexion puis rechargez la page.",
    },
    en: {
      "skip": "Skip to content",
      "logo.aria": "House Intelligence, back to the subway map",
      "tagline": "Editorial booth · history, machines &amp; sociology of house music · 1970 → today",
      "nav.aria": "Views", "nav.metro": "Subway Map <small>(Genealogy)</small>", "nav.booth": "The Booth", "nav.library": "Library",
      "lang.aria": "Language",
      "filters.aria": "Filters", "filters.eras": "Eras", "filters.genres": "Genres", "filters.machines": "Machines",
      "filters.eras.aria": "Eras", "filters.genres.aria": "Subgenres",
      "filters.all": "All", "filters.allMachines": "All", "filters.cousins": "Neighbouring lineages",
      "filters.cousins.title": "Musics adjacent to house, cited by the project's reading list",
      "crate.title": "The Crate", "crate.empty": "No record matches this filter.",
      "deck.kicker": "On deck", "deck.listen": "▶ Play the record", "deck.spotify": "Open in Spotify ↗",
      "badge.energy": "Energy", "badge.label": "Label", "badge.city": "City", "badge.year": "Year",
      "tr.title": "Recommended transition", "tr.how": "How does it work?",
      "tr.how.body": "<p><b>Camelot</b>: the 24 keys sit on a wheel numbered 1 to 12 (A = minor, B = major). Two records that are neighbours on the wheel layer without clashing.</p><p><b>Pitch</b>: the turntable's speed fader, usually ±8%. Beyond that you can no longer beatmatch the two records.</p><p><b>Compatibility</b>: a score out of 100 combining harmony (48%), tempo proximity (37%) and the intention chosen in \"Steer the Room\".</p>",
      "tr.wheel": "Camelot wheel", "tr.tempo": "Tempo delta", "tr.mix": "Mix it in →", "tr.none": "No record available.",
      "tr.legend": "shaded zone = ±8% pitch range around A",
      "m.tempo": "Δ Tempo", "m.pitch": "Pitch B", "m.key": "Key", "m.compat": "Compatibility", "m.move": "Move {m}",
      "m.inFader": "within fader range", "m.outFader": "out of range", "m.harmony": "harmony {h} · tempo {t}",
      "bpm.direct": "Beatmatches as is", "bpm.inRange": "Within ±8% pitch range", "bpm.out": "Out of pitch range: cut or mix on a break",
      "cam.unknown": "Unknown key", "cam.same": "Same key: perfect mix", "cam.up1": "+1: up a fifth, it opens up", "cam.down1": "−1: down a fifth, it settles",
      "cam.up2": "+2: energy boost (a whole tone up)", "cam.up7": "+7: up a semitone, \"key change\" lift", "cam.down2": "−2: down a whole tone, keep the blend short",
      "cam.relMaj": "Relative major: the colour brightens", "cam.relMin": "Relative minor: the colour darkens", "cam.diag": "Diagonal: change of mode and fifth",
      "cam.jump": "{n}-step jump: harmonic clash, hard cut only",
      "n.stay": "We stay in <em>{city}</em>", "n.travel": "From <em>{a}</em> ({ya}) to <em>{b}</em> ({yb})",
      "n.forward": ", a leap of {n} years forward", "n.back": ", a trip {n} years back",
      "n.sameBpm": "Same tempo ({bpm} BPM): the kicks lock without touching the pitch.",
      "n.pitch": "Pitch deck B by {p}% to match {a} BPM, then ride it gradually back to {b}.",
      "n.cut": "{d} BPM apart: impossible on the pitch fader. Cut on a break or let the first record fade out a cappella.",
      "n.keyLong": "{k}: the pads can overlap for a long blend.", "n.keyPerc": "{k}: blend on the percussion, not on the chords.",
      "n.grammar": "Change of grammar ({a} → {b}): {g}.",
      "g.twostep": "two-step makes the kick swing", "g.amapiano": "the log drum takes over from the kick as the engine", "g.tribal": "the toms take control",
      "g.jack": "jack stiffens the groove", "g.acid": "the 303 starts talking", "g.deep": "the groove softens", "g.afro": "polyrhythm settles in",
      "g.filter": "the filter breathes", "g.lofi": "the sound goes hazy", "g.hiphouse": "the MC steps in", "g.garage": "the garage soul rises",
      "g.disco": "strings and octave bass come back", "g.breakbeat": "the kick breaks into breakbeat", "g.trance": "the arpeggios take over",
      "g.four": "the four-on-the-floor tightens", "g.default": "the groove shifts",
      "steer.title": "Steer the Room", "steer.none": "Pick an intention to steer the next record", "steer.active": "Intention: {n}",
      "steer.up.name": "Lift it", "steer.up.desc": "More energy, the floor takes off", "steer.up.say": "We lift the room",
      "steer.deep.name": "Go deep", "steer.deep.desc": "Less energy, more introspection", "steer.deep.say": "We drop back into the deep",
      "steer.roots.name": "Back to the roots", "steer.roots.desc": "Rewind time, towards Chicago and the Garage", "steer.roots.say": "We rewind to the foundations",
      "steer.future.name": "Into the future", "steer.future.desc": "Move towards recent legacies", "steer.future.say": "We push the room forward",
      "steer.queer.name": "Ballroom axis", "steer.queer.desc": "Follow the queer, drag and ballroom lineage", "steer.queer.say": "We follow the queer and ballroom thread",
      "steer.diaspora.name": "Diaspora journey", "steer.diaspora.desc": "Change city, change continent", "steer.diaspora.say": "We travel the diaspora",
      "pulse.title": "Pulse · drum machine", "pulse.start": "Start the pulse", "pulse.stop": "Stop the pulse", "pulse.engine": "Sound engine",
      "pulse.vol": "Vol", "pulse.feel": "Feel the tempo", "pulse.grid": "{g} · \"{groove}\" grid", "pulse.swing": " · {s}% swing",
      "pulse.noAudio": "Web Audio is not supported by this browser",
      "tab.story": "Story &amp; timeline", "h.story": "Story", "h.timeline": "Timeline", "h.credits": "Credits", "h.books": "In the books",
      "h.web": "Web sources", "book.pages": "p. {p}", "book.noPages": "pages to be added", "story.verify": "Still to be checked",
      "arch.title": "Cultural archaeology", "tab.machines": "Machines &amp; construction", "tab.origins": "Origins", "tab.queer": "Ballroom &amp; queer", "tab.socio": "Sociology &amp; source",
      "h.machines": "Machines", "h.construction": "Construction", "h.queer": "Ballroom axis & queer scenes", "h.socio": "Club sociology",
      "h.ref": "Bibliographic reference", "h.further": "Further reading", "ref.missing": "Reference to be added.",
      "mem.title": "The Memory", "mem.clear": "Clear the session", "mem.empty": "The session starts here.", "mem.via": "via {v}",
      "mem.cleared": "Session cleared", "mem.exportEmpty": "Empty session: nothing to export", "mem.exported": "Tracklist exported (.{f})",
      "md.title": "House Intelligence · Session tracklist", "md.date": "Exported on {d}",
      "md.head": "| # | Time | Artist | Title | Genre | BPM | Key | Transition |",
      "via.écoute": "playback", "via.métro": "subway", "via.lecteur": "player", "via.bac": "crate", "via.transition": "transition", "via.fiche": "record card",
      "via.feel": "tempo", "via.init": "opening", "via.hash": "link",
      "mod.close": "Close", "mod.intended": "Intended use", "mod.hijack": "How it was hijacked", "mod.signature": "Sound signature", "mod.inHouse": "In house music",
      "mod.trivia": "Trivia", "mod.inCrate": "In the crate", "mod.hearEngine": "▶ Hear the {e} engine", "mod.filterMachine": "Filter the crate by this machine",
      "mod.contribution": "What it brings to the project", "mod.themes": "Themes", "mod.genres": "Genres it sheds light on", "mod.cited": "Records cited",
      "mod.listenAll": "▶ Play the {n} records linked to this reading", "mod.verify": "⚠ Metadata to be checked or completed.",
      "metro.title": "Subway Map <small>A genealogy of house</small>",
      "metro.intro": "Nine lines, from the Loft's disco to amapiano. Click a station for its story and records, or a transfer (dotted line) for the bridge between two scenes.",
      "metro.lines": "Lines", "metro.share": "Share this view", "metro.export": "Export (SVG)", "metro.svg": "Genealogical subway map of house music",
      "metro.pick": "Pick a station",
      "metro.pickBody": "{n} stations on {l} lines, from the Loft's disco to amapiano. Double white circles are interchanges; dotted lines connect two scenes and tell the story of their bridge.",
      "metro.pickNote": "Greyed-out stations have no record in the crate yet: the map draws the full genealogy, the crate is catching up.",
      "metro.records": "Records · {n}", "metro.listenStation": "▶ Play the whole station", "metro.toBooth": "Open in The Booth",
      "metro.conns": "Connections", "metro.read": "Further reading", "metro.emptyDefault": "No record in the crate for this station.",
      "metro.stationAria": "{s} station, {lines}, {n} record(s)", "metro.line": "line {n}", "metro.linesN": "lines {n}",
      "metro.transferAria": "Transfer: {t}", "metro.copied": "Link to this view copied", "metro.exported": "Map exported (.svg)",
      "metro.loadError": "Could not load the subway map.", "metro.svgFooter": "HOUSE/INTELLIGENCE · Genealogical Subway Map",
      "lib.title": "The Library", "lib.intro": "Every reference in the project (books, films, magazines) and the records they shed light on.",
      "lib.search": "Search a title, an author, a theme…", "lib.searchAria": "Search the library",
      "lib.all": "All", "lib.books": "Books", "lib.films": "Films", "lib.mags": "Magazines",
      "lib.linked1": "{n} linked record", "lib.linkedN": "{n} linked records", "lib.none": "no linked record", "lib.verify": "to be checked", "lib.empty": "No reference matches.",
      "fw.aria": "Listening window", "fw.label": "Listening window", "fw.side": "Move the window to the other side", "fw.sideTitle": "Switch side",
      "fw.reduce": "Collapse the window", "fw.expand": "Expand the window", "fw.big": "Enlarge the window", "fw.normal": "Normal size",
      "fw.empty": "Click ▶ on a record", "fw.none": "Nothing playing", "fw.noneHint": "The Crate, the Booth or a subway station",
      "fw.prev": "Previous record", "fw.toggle": "Play or pause", "fw.next": "Next record", "fw.mode": "Playback order",
      "fw.mode.list": "List order", "fw.mode.algo": "Camelot transition", "fw.mode.shuffle": "Shuffle",
      "fw.open": "Open in The Booth", "fw.queue": " · queue: {i}/{n}", "fw.alt": "Alternative source (main video blocked)",
      "play.listen": "Play {t}", "play.pause": "Pause {t}",
      "toast.noVideo": "No video available for this record", "toast.ytFail": "Could not load the YouTube player (connection?)",
      "toast.altSource": "Video blocked: alternative source", "toast.skip": "Video unavailable: next record",
      "foot": "House Intelligence · v1 — BPM and keys are indicative editorial values.", "foot.sources": "The project's sources", "fw.close": "Close the window",
      "err.load": "Could not load the data ({e}).",
      "err.file": " The page was opened straight from disk: open <code>http://localhost:8765/</code> instead, after running <code>python3 -m http.server 8765</code> in the site folder.",
      "err.net": " Check your connection and reload the page.",
    },
  };
  const KEYS = {
    fr: { "1A": "La♭ mineur", "2A": "Mi♭ mineur", "3A": "Si♭ mineur", "4A": "Fa mineur", "5A": "Do mineur", "6A": "Sol mineur", "7A": "Ré mineur", "8A": "La mineur", "9A": "Mi mineur", "10A": "Si mineur", "11A": "Fa♯ mineur", "12A": "Do♯ mineur",
      "1B": "Si majeur", "2B": "Fa♯ majeur", "3B": "Ré♭ majeur", "4B": "La♭ majeur", "5B": "Mi♭ majeur", "6B": "Si♭ majeur", "7B": "Fa majeur", "8B": "Do majeur", "9B": "Sol majeur", "10B": "Ré majeur", "11B": "La majeur", "12B": "Mi majeur" },
    en: { "1A": "A♭ minor", "2A": "E♭ minor", "3A": "B♭ minor", "4A": "F minor", "5A": "C minor", "6A": "G minor", "7A": "D minor", "8A": "A minor", "9A": "E minor", "10A": "B minor", "11A": "F♯ minor", "12A": "C♯ minor",
      "1B": "B major", "2B": "F♯ major", "3B": "D♭ major", "4B": "A♭ major", "5B": "E♭ major", "6B": "B♭ major", "7B": "F major", "8B": "C major", "9B": "G major", "10B": "D major", "11B": "A major", "12B": "E major" },
  };

  let lang = "fr";
  try { const s = localStorage.getItem("hi.lang"); if (s === "en" || s === "fr") lang = s; } catch { /* stockage indisponible */ }
  // ?lang=en (liens depuis les pages statiques /en/…) : prioritaire sur la préférence enregistrée.
  try { const q = new URLSearchParams(location.search).get("lang"); if (q === "en" || q === "fr") { lang = q; localStorage.setItem("hi.lang", q); } } catch { /* ignore */ }

  const t = (key, vars = {}) => {
    let s = STR[lang][key] ?? STR.fr[key] ?? key;
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
    return s;
  };
  const f = (obj, field) => (obj == null ? "" : lang === "en" && obj[field + "_en"] != null ? obj[field + "_en"] : obj[field]);
  const key = (k) => KEYS[lang][k] || "";

  function apply(root = document) {
    document.documentElement.lang = lang;
    for (const el of root.querySelectorAll("[data-i18n]")) el.innerHTML = t(el.dataset.i18n);
    for (const el of root.querySelectorAll("[data-i18n-attr]")) {
      for (const pair of el.dataset.i18nAttr.split(";")) {
        const [attr, k] = pair.split("="); if (attr && k) el.setAttribute(attr.trim(), t(k.trim()).replace(/<[^>]+>/g, ""));
      }
    }
    for (const b of root.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", b.dataset.lang === lang);
  }
  function set(l) {
    if (l !== "fr" && l !== "en" || l === lang) return;
    lang = l;
    try { localStorage.setItem("hi.lang", l); } catch { /* ignore */ }
    apply();
    window.dispatchEvent(new CustomEvent("hi:lang", { detail: l }));
  }

  window.I18N = { t, f, key, apply, set, get lang() { return lang; }, get locale() { return lang === "en" ? "en-GB" : "fr-FR"; } };
  document.documentElement.lang = lang;
  document.addEventListener("DOMContentLoaded", () => apply());
})();
