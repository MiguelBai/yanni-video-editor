#!/usr/bin/env node
// webshot.mjs <url> <out.png> [--w 1100] [--h 2400]
// Full page screenshot of a real web page (a PubMed abstract, a journal page,
// a product page) with headless Chrome. Crop the part the line is about after:
//   ffmpeg -i page.png -vf "crop=W:H:X:Y" -frames:v 1 doc.png
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const [url, out] = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
if (!url || !out) { console.error("usage: webshot.mjs <url> <out.png> [--w 1100] [--h 2400]"); process.exit(1); }

function chrome() {
  const c = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ];
  for (const p of c) if (fs.existsSync(p)) return p;
  // HyperFrames downloads its own headless shell; use it as the fallback
  const base = path.join(os.homedir(), ".cache", "hyperframes", "chrome");
  if (fs.existsSync(base)) {
    const found = execFileSync("find", [base, "-name", "chrome-headless-shell", "-type", "f"]).toString().trim().split("\n")[0];
    if (found) return found;
  }
  return null;
}
const bin = chrome();
if (!bin) { console.error("no Chrome found. Install Google Chrome or run: npx hyperframes browser ensure"); process.exit(2); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "yshot-"));
// Chrome sometimes writes the file and then never exits, so cap it and judge by the file
const outAbs = path.resolve(out);
if (fs.existsSync(outAbs)) fs.rmSync(outAbs);
try {
  execFileSync(bin, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${profile}`,
  `--window-size=${opt("w", "1100")},${opt("h", "2400")}`, "--force-device-scale-factor=2",
  "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "--virtual-time-budget=8000", `--screenshot=${outAbs}`, url], { stdio: "ignore", timeout: 45000, killSignal: "SIGKILL" });
} catch (e) { /* timed out after writing, or failed; checked below */ }
fs.rmSync(profile, { recursive: true, force: true });
const ok = fs.existsSync(outAbs) && fs.statSync(outAbs).size > 0;
console.log(JSON.stringify({ ok, out: outAbs, note: ok ? "LOOK at it: a captcha, cookie wall or blank page is a failed capture" : "no screenshot written" }));
process.exit(ok ? 0 : 3);
