#!/usr/bin/env node
// cut.mjs <project dir> [--remove "12.4-15.0,40.1-44.9"] [--gap 0.3] [--db -35]
// Jump cut. Pauses come from the AUDIO (ffmpeg silencedetect), not from word
// timestamps: whisper.cpp smears words across silences, so its gaps lie.
// --remove drops bad takes (RAW seconds). Writes build/head.mp4 plus
// build/transcript.json remapped onto the cut timeline.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const P = path.resolve(args.find((a) => !a.startsWith("--") && !/^-?\d/.test(a)) || ".");
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const GAP = parseFloat(opt("gap", "0.3"));
const DB = opt("db", "-35");
const PRE = 0.08, POST = 0.14;
const removes = (opt("remove", "") || "").split(",").filter(Boolean).map((r) => r.split("-").map(Number));

const B = path.join(P, "build");
const src = path.join(B, "raw.mp4");
const words = JSON.parse(fs.readFileSync(path.join(B, "raw.transcript.json"), "utf8"));
const rawDur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).toString());

// 1. silences from the audio
const sd = spawnSync("ffmpeg", ["-i", src, "-vn", "-af", `silencedetect=n=${DB}dB:d=${GAP}`, "-f", "null", "-"], { encoding: "utf8" }).stderr;
const sil = [];
let open = null;
for (const m of sd.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
  if (m[1] === "start") open = Math.max(0, +m[2]);
  else if (open != null) { sil.push([open, +m[2]]); open = null; }
}
if (open != null) sil.push([open, rawDur]);

// 2. speech = complement of silence, padded so consonants are not clipped
let keep = [];
let t = 0;
for (const [a, b] of sil) { if (a > t) keep.push([t, a]); t = b; }
if (t < rawDur) keep.push([t, rawDur]);
keep = keep.map(([a, b]) => [Math.max(0, a - PRE), Math.min(rawDur, b + POST)]);

// 3. subtract bad takes
for (const [ra, rb] of removes) {
  keep = keep.flatMap(([a, b]) => (rb <= a || ra >= b) ? [[a, b]] : [[a, Math.min(b, ra)], [Math.max(a, rb), b]].filter(([x, y]) => y - x > 0.06));
}
// 4. merge overlaps and tiny gaps
keep.sort((x, y) => x[0] - y[0]);
const segs = [];
for (const k of keep) {
  const last = segs[segs.length - 1];
  if (last && k[0] - last[1] < 0.05) last[1] = Math.max(last[1], k[1]);
  else if (k[1] - k[0] > 0.12) segs.push([...k]);
}
if (!segs.length) throw new Error("nothing left after the cut; check --db and --remove");

// 5. map raw time -> cut time
let acc = 0;
const map = segs.map(([a, b]) => { const m = { a, b, at: acc }; acc += b - a; return m; });
const DUR = acc;
function toCut(x) {
  for (const m of map) {
    if (x < m.a) return m.at;          // inside a removed gap: snap to next kept span
    if (x <= m.b) return m.at + (x - m.a);
  }
  return DUR;
}
const inRemoved = (w) => removes.some(([a, b]) => (w.start + w.end) / 2 >= a && (w.start + w.end) / 2 <= b);
let out = words.filter((w) => !inRemoved(w)).map((w) => ({ text: w.text, start: toCut(w.start), end: toCut(w.end) }));
// words whisper smeared across a silence collapse onto one instant; spread each
// collapsed run evenly up to the next word that has real timing
for (let i = 0; i < out.length; i++) {
  let j = i;
  while (j + 1 < out.length && out[j + 1].start - out[i].start < 0.04) j++;
  if (j > i) {
    const s = out[i].start;
    const e = Math.max(s + 0.12 * (j - i + 1), j + 1 < out.length ? out[j + 1].start : Math.min(DUR, s + 0.25 * (j - i + 1)));
    const step = (e - s) / (j - i + 1);
    for (let k = i; k <= j; k++) { out[k].start = s + step * (k - i); out[k].end = s + step * (k - i + 1); }
    i = j;
  }
}
// keep word starts monotonic with a readable minimum spacing
for (let i = 1; i < out.length; i++) {
  if (out[i].start < out[i - 1].start + 0.14) out[i].start = Math.min(DUR, out[i - 1].start + 0.14);
  if (out[i].end < out[i].start + 0.05) out[i].end = out[i].start + 0.05;
}
out = out.map((w, i) => ({ text: w.text, start: +w.start.toFixed(3), end: +Math.max(w.end, w.start + 0.05).toFixed(3), id: `w${i}` }));

// 6. render the cut
const fc = [];
map.forEach((m, i) => {
  const d = m.b - m.a, f = Math.min(0.012, d / 4);
  fc.push(`[0:v]trim=${m.a.toFixed(3)}:${m.b.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
  fc.push(`[0:a]atrim=${m.a.toFixed(3)}:${m.b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${f},afade=t=out:st=${(d - f).toFixed(3)}:d=${f}[a${i}]`);
});
fc.push(map.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${map.length}:v=1:a=1[v][a]`);
console.error(`cutting ${map.length} segments, ${rawDur.toFixed(1)}s -> ${DUR.toFixed(1)}s ...`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-filter_complex", fc.join(";"), "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-preset", "fast", "-crf", "17", "-r", "30", "-c:a", "aac", "-b:a", "192k", path.join(B, "head.mp4")], { stdio: "inherit" });

fs.writeFileSync(path.join(B, "transcript.json"), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(B, "cut.json"), JSON.stringify(map.map((m) => ({ rawStart: +m.a.toFixed(3), rawEnd: +m.b.toFixed(3), at: +m.at.toFixed(3) })), null, 1));

const lines = [];
let line = [];
out.forEach((w, i) => {
  line.push(w);
  if (/[.!?]["']?$/.test(w.text) || line.length >= 12 || !out[i + 1]) {
    lines.push(`[${line[0].start.toFixed(2)}-${w.end.toFixed(2)}] ${line.map((x) => x.text).join(" ")}`);
    line = [];
  }
});
fs.writeFileSync(path.join(B, "transcript.txt"), lines.join("\n") + "\n");
console.log(JSON.stringify({ ok: true, head: path.join(B, "head.mp4"), duration: +DUR.toFixed(2), segments: map.length, cutFrom: +rawDur.toFixed(2) }));
