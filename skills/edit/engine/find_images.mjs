#!/usr/bin/env node
// find_images.mjs "<search words>" <out dir> [--n 6]
// Searches Wikimedia Commons (free licensed images) and downloads the top hits
// so they can be looked at and the best one picked. Prints one line per file
// with its license and source page, which go in credits.txt for the reel.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const query = args[0];
const out = path.resolve(args[1] || "candidates");
const n = parseInt((args.join(" ").match(/--n[ =](\d+)/) || [])[1] || "6", 10);
if (!query) { console.error('usage: find_images.mjs "<search words>" <out dir> [--n 6]'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

const UA = { "User-Agent": "yanni-video-editor/1.0 (personal reel editing)" };
const api = new URL("https://commons.wikimedia.org/w/api.php");
Object.entries({
  action: "query", format: "json", generator: "search", gsrsearch: `${query} filetype:bitmap`,
  gsrnamespace: "6", gsrlimit: String(n * 3), prop: "imageinfo",
  iiprop: "url|size|mime|extmetadata", iiurlwidth: "1400",
}).forEach(([k, v]) => api.searchParams.set(k, v));

const res = await fetch(api, { headers: UA });
const j = await res.json();
const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
let got = 0;
for (const p of pages) {
  if (got >= n) break;
  const ii = p.imageinfo?.[0];
  if (!ii || !/image\/(jpeg|png|webp)/.test(ii.mime) || ii.width < 500) continue;
  const url = ii.thumburl || ii.url;
  const ext = ii.mime.includes("png") ? "png" : ii.mime.includes("webp") ? "webp" : "jpg";
  const file = path.join(out, `${slug}-${got + 1}.${ext}`);
  const r = await fetch(url, { headers: UA });
  if (!r.ok) continue;
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  const md = ii.extmetadata || {};
  const lic = (md.LicenseShortName?.value || "unknown license").replace(/<[^>]+>/g, "");
  const who = (md.Artist?.value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  console.log(`${file}\t${lic}\t${who}\t${ii.descriptionurl}`);
  got++;
}
if (!got) console.error("no usable images found; try simpler words (e.g. 'syringe' not 'peptide pen injection')");
