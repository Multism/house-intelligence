// Reels « grille de séquenceur » (1080×1920, mp4 H.264 + AAC) : une machine, un motif de 16 pas,
// le motif complet puis chaque ligne isolée avec une phrase d'explication.
// Données : social/reels.json (textes en anglais, comme le compte). Gabarit : tools/reel.html (canvas + son
// synthétisé par OfflineAudioContext, adapté du moteur Pulse de app.js : émulation, pas un enregistrement).
// Nécessite Playwright (comme tools/og-images.mjs) et ffmpeg.
//
//   node tools/reels.mjs                       → tous les reels de social/reels.json
//   node tools/reels.mjs tr-909-four-to-the-floor
//   node tools/reels.mjs <slug> --stills       → images clés seulement (aperçu rapide)
//   node tools/reels.mjs <slug> --light        → variante claire (le style retenu est le sombre)
//
// Sortie : social/reels/<slug>.mp4 (non versionné). Règle documentaire : les textes décrivent le fonctionnement
// des machines, jamais quelle machine a servi sur quel disque sans source.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const theme = args.includes("--light") ? "light" : "dark";
const stills = args.includes("--stills");
const slugs = args.filter((a) => !a.startsWith("--"));
const reels = JSON.parse(fs.readFileSync(path.join(ROOT, "social/reels.json"), "utf8"));
const todo = slugs.length ? slugs.map((s) => reels.find((r) => r.slug === s) || (console.error("inconnu :", s), process.exit(1))) : reels;
const OUT = path.join(ROOT, "social/reels"); fs.mkdirSync(OUT, { recursive: true });

const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const run = (cmd, a, opts) => spawn(cmd, a, opts);
const done = (p) => new Promise((r, j) => p.on("close", (c) => (c ? j(new Error("ffmpeg " + c)) : r())));

for (const reel of todo) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto("file://" + path.join(ROOT, "tools/reel.html"), { waitUntil: "networkidle" });
  const dur = await page.evaluate(async ([r, t]) => setup(r, t), [reel, theme]);
  const base = path.join(OUT, reel.slug + (theme === "light" ? "-light" : ""));
  if (stills) {
    const bar = 240 / reel.bpm;
    const times = [0.6, ...reel.lanes.map((_, i) => (2 + i * 2) * bar + bar * 0.53), (2 + reel.lanes.length * 2) * bar + 0.6];
    for (const [i, t] of times.entries()) {
      const d = await page.evaluate((t) => frame(t, 0.92), t);
      fs.writeFileSync(`${base}-${i}.jpg`, Buffer.from(d.split(",")[1], "base64"));
    }
  } else {
    const wav = base + ".wav", raw = base + ".raw.mp4";
    fs.writeFileSync(wav, Buffer.from(await page.evaluate(() => audio()), "base64"));
    const FPS = 30, N = Math.ceil(dur * FPS);
    const ff = run("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", raw], { stdio: ["pipe", "inherit", "inherit"] });
    for (let f = 0; f < N; f++) {
      const d = await page.evaluate((t) => frame(t, 0.9), f / FPS);
      if (!ff.stdin.write(Buffer.from(d.split(",")[1], "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
    }
    ff.stdin.end(); await done(ff);
    // son normalisé (-14 LUFS, crête -1,5 dB), vidéo copiée telle quelle
    await done(run("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-i", wav, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
      "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", base + ".mp4"], { stdio: "inherit" }));
    fs.unlinkSync(wav); fs.unlinkSync(raw);
  }
  await page.close();
  console.log("✓", path.relative(ROOT, base) + (stills ? "-*.jpg" : ".mp4"), dur.toFixed(1) + " s");
}
await browser.close();
