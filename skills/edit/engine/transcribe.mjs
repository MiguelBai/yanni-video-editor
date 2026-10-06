#!/usr/bin/env node
// transcribe.mjs <video|audio> <out.json> [--model small.en]
// Word level transcript via whisper.cpp. We call whisper-cli directly instead of
// `hyperframes transcribe` because that command trims everything before its
// detected "speech onset", and on real takes it threw away a 10 second hook.
// The vocabulary in ~/.yanni-editor/brand.json is passed as the prompt so
// peptide and compound names come out spelled right.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [inp, outPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const model = (process.argv.join(" ").match(/--model[ =](\S+)/) || [])[1]
  || readBrand().whisperModel || "small.en";

function readBrand() {
  const f = path.join(os.homedir(), ".yanni-editor", "brand.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
}

function findWhisper() {
  for (const c of ["/opt/homebrew/bin/whisper-cli", "/usr/local/bin/whisper-cli"]) if (fs.existsSync(c)) return c;
  try { return execFileSync("which", ["whisper-cli"]).toString().trim(); } catch { return null; }
}

const bin = findWhisper();
if (!bin) { console.error("whisper-cli not found. Run the setup skill (brew install whisper-cpp)."); process.exit(2); }

const modelDir = path.join(os.homedir(), ".cache", "hyperframes", "whisper", "models");
const modelFile = path.join(modelDir, `ggml-${model}.bin`);
if (!fs.existsSync(modelFile)) {
  fs.mkdirSync(modelDir, { recursive: true });
  console.error(`downloading whisper model ${model} (one time)...`);
  execFileSync("curl", ["-L", "--fail", "-o", modelFile, `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${model}.bin`], { stdio: "inherit" });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ytx-"));
const wav = path.join(tmp, "a.wav");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", inp, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);

const vocab = (readBrand().vocab || []).join(", ");
const args = ["-m", modelFile, "-f", wav, "-ml", "1", "-sow", "-oj", "-of", path.join(tmp, "out"), "-np"];
if (vocab) args.push("--prompt", `Glossary: ${vocab}.`);
execFileSync(bin, args, { stdio: ["ignore", "ignore", "inherit"] });

const j = JSON.parse(fs.readFileSync(path.join(tmp, "out.json"), "utf8"));
const words = [];
for (const seg of j.transcription || []) {
  const text = String(seg.text || "").trim();
  if (!text || /^\[.*\]$/.test(text) || /^\(.*\)$/.test(text)) continue; // [BLANK_AUDIO], (music)
  const start = seg.offsets.from / 1000, end = seg.offsets.to / 1000;
  // whisper sometimes splits "157" or "'s" off a word; glue pieces with no leading space
  const glued = !/^\s/.test(seg.text) && words.length;
  if (glued) { const w = words[words.length - 1]; w.text += text; w.end = end; continue; }
  words.push({ text, start: +start.toFixed(3), end: +end.toFixed(3) });
}
words.forEach((w, i) => { w.id = `w${i}`; });
fs.writeFileSync(outPath, JSON.stringify(words, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ ok: true, model, words: words.length, first: words.slice(0, 6).map((w) => w.text).join(" ") }));
