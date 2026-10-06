#!/usr/bin/env node
// cutout.mjs <image> <out.png>
// Removes the background (local AI model via HyperFrames) and trims the empty
// transparent border so the object sits tight in the layout.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const [inp, out] = process.argv.slice(2);
if (!inp || !out) { console.error("usage: cutout.mjs <image> <out.png>"); process.exit(1); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ycut-"));
const src = path.join(tmp, "in.png");
// flatten whatever came in (jpg/webp/png) to a plain png first
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", inp, "-frames:v", "1", src]);
const raw = path.join(tmp, "cut.png");
execFileSync("npx", ["-y", "hyperframes@latest", "remove-background", src, "-o", raw], { stdio: ["ignore", "ignore", "inherit"] });

// bounding box of the visible pixels via the alpha channel
const det = spawnSync("ffmpeg", ["-i", raw, "-vf", "alphaextract,cropdetect=limit=0.2:round=2:reset=0", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const m = [...det.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].pop();
if (m) {
  const [w, h, x, y] = m.slice(1).map(Number);
  const pad = 6;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf",
    `crop=${w}:${h}:${x}:${y},pad=${w + pad * 2}:${h + pad * 2}:${pad}:${pad}:color=black@0`, "-frames:v", "1", out]);
} else {
  fs.copyFileSync(raw, out);
}
fs.rmSync(tmp, { recursive: true, force: true });
const dims = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", out]).toString().trim();
console.log(JSON.stringify({ ok: true, out: path.resolve(out), size: dims }));
