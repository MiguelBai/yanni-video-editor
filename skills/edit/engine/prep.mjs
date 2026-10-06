#!/usr/bin/env node
// prep.mjs <raw video> <project dir> [--model small.en]
// Makes the project folders, normalizes the phone recording to 1080x1920 30fps
// with loudness at -16 LUFS, and transcribes it with word timestamps.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [raw, proj] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const model = (process.argv.join(" ").match(/--model[ =](\S+)/) || [])[1] || "";
if (!raw || !proj) { console.error("usage: prep.mjs <raw video> <project dir> [--model small.en]"); process.exit(1); }

const P = path.resolve(proj);
for (const d of ["raw", "build", "build/assets", "out"]) fs.mkdirSync(path.join(P, d), { recursive: true });
const rawCopy = path.join(P, "raw", path.basename(raw));
if (path.resolve(raw) !== rawCopy && !fs.existsSync(rawCopy)) fs.copyFileSync(raw, rawCopy);

const norm = path.join(P, "build", "raw.mp4");
console.error("normalizing video (1080x1920, 30fps, -16 LUFS)...");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", rawCopy,
  "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p",
  "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000",
  "-c:v", "libx264", "-preset", "fast", "-crf", "17", "-c:a", "aac", "-b:a", "192k", norm], { stdio: "inherit" });

console.error("transcribing (first run downloads the whisper model)...");
execFileSync("node", [path.join(path.dirname(fileURLToPath(import.meta.url)), "transcribe.mjs"), norm,
  path.join(P, "build", "raw.transcript.json"), ...(model ? ["--model", model] : [])], { stdio: ["ignore", "ignore", "inherit"] });

const words = JSON.parse(fs.readFileSync(path.join(P, "build", "raw.transcript.json"), "utf8"));
// readable dump with timestamps so retakes are easy to spot
const lines = [];
let line = [];
words.forEach((w, i) => {
  line.push(w);
  const gap = words[i + 1] ? words[i + 1].start - w.end : 9;
  if (gap > 0.45 || /[.!?]$/.test(w.text) || line.length >= 14) {
    lines.push(`[${line[0].start.toFixed(2)}-${w.end.toFixed(2)}] ${line.map((x) => x.text).join(" ")}`);
    line = [];
  }
});
fs.writeFileSync(path.join(P, "build", "raw.transcript.txt"), lines.join("\n") + "\n");
console.log(JSON.stringify({ ok: true, project: P, video: norm, words: words.length, transcript: path.join(P, "build", "raw.transcript.txt") }));
