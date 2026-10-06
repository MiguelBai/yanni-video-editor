#!/usr/bin/env node
// build.mjs <project>/build/edit.json
// Turns a beat plan into a HyperFrames composition (index.html) next to it.
// Layout is resolved here, in pixels, so the page never measures anything at
// render time. See ../SKILL.md for the edit.json format.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const editPath = path.resolve(process.argv[2] || "edit.json");
const dir = path.dirname(editPath);
const E = JSON.parse(fs.readFileSync(editPath, "utf8"));

const brandFile = path.join(process.env.HOME, ".yanni-editor", "brand.json");
const brand = Object.assign(
  { line1: "100X", line2: "YANNI", accent: "#d6192b" },
  fs.existsSync(brandFile) ? JSON.parse(fs.readFileSync(brandFile, "utf8")) : {},
  E.brand || {}
);

const W = 1080, H = 1920, CX = 540;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r2 = (n) => Math.round(n * 1000) / 1000;
const warn = [];

function probe(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
    "stream=width,height:format=duration", "-of", "json", file]).toString();
  const j = JSON.parse(out);
  return { w: j.streams?.[0]?.width, h: j.streams?.[0]?.height, dur: parseFloat(j.format?.duration) };
}

// ---------- media ----------
const videoRel = E.video || "head.mp4";
const vid = probe(path.join(dir, videoRel));
const DUR = r2(E.duration || vid.dur);

// ---------- transcript -> caption pages ----------
function loadWords() {
  if (E.captions === false) return [];
  const tp = path.join(dir, E.transcript || "transcript.json");
  if (!fs.existsSync(tp)) { warn.push("no transcript.json, captions skipped"); return []; }
  let words = JSON.parse(fs.readFileSync(tp, "utf8"));
  if (!Array.isArray(words)) words = words.words || [];
  const rep = Object.entries(E.replace || {}).map(([k, v]) => [k.toLowerCase(), v]);
  return words.map((w) => {
    let t = String(w.text).trim();
    const m = t.match(/^([^\w]*)(.*?)([^\w]*)$/u);
    const core = (m ? m[2] : t).toLowerCase();
    for (const [k, v] of rep) if (core === k) t = (m ? m[1] : "") + v + (m ? m[3] : "");
    return { text: t, start: +w.start, end: +w.end };
  }).filter((w) => w.text && w.start < DUR);
}

function paginate(words) {
  const pages = [];
  let cur = [];
  const chars = (ws) => ws.reduce((n, w) => n + w.text.length + 1, 0);
  const flush = () => { if (cur.length) pages.push(cur); cur = []; };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length && prev && w.start - prev.end > 0.6) flush();
    cur.push(w);
    const next = words[i + 1];
    const endsSentence = /[.!?]["')\]]*$/.test(w.text);
    const endsClause = /[,;:]$/.test(w.text);
    if (endsSentence && cur.length >= 2) flush();
    else if (endsClause && cur.length >= 7) flush();
    else if (cur.length >= 13 || chars(cur) >= 72) flush();
    else if (next && next.start - w.end > 0.6) flush();
  });
  flush();
  return pages;
}

const words = loadWords();
const pageWords = paginate(words);

// ---------- layout ----------
const CAP_TOP = 1405;
function stageFor(header) {
  const top = header ? (header.length > 22 ? 640 : 560) : 300;
  const bot = E.captions === false ? 1700 : CAP_TOP - 40;
  return { top, bot, avail: bot - top };
}

function natural(item) {
  const k = item.kind;
  if (k === "label") return { w: 1000, h: 86, text: true };
  if (k === "stat") return { w: 1000, h: 100, text: true };
  if (k === "big") return { w: 1000, h: 136, text: true };
  const src = path.join(dir, item.src);
  if (!fs.existsSync(src)) throw new Error(`missing asset: ${item.src}`);
  const d = probe(src);
  const maxW = item.w || (k === "cutout" ? 720 : 760);
  const maxH = item.h || (k === "cutout" ? 700 : 900);
  const s = Math.min(maxW / d.w, maxH / d.h);
  return { w: d.w * s, h: d.h * s };
}

function layout(items, header) {
  const st = stageFor(header);
  const GAP = 34;
  const sizes = items.map(natural);
  const fixed = sizes.filter((s) => s.text).reduce((n, s) => n + s.h, 0);
  const scal = sizes.filter((s) => !s.text).reduce((n, s) => n + s.h, 0);
  const gaps = GAP * Math.max(0, items.length - 1);
  const room = st.avail - fixed - gaps;
  const f = scal > room && scal > 0 ? room / scal : 1;
  sizes.forEach((s) => { if (!s.text) { s.w *= f; s.h *= f; } });
  const total = sizes.reduce((n, s) => n + s.h, 0) + gaps;
  let y = st.top + (st.avail - total) / 2;
  return sizes.map((s) => {
    const r = { left: CX - s.w / 2, top: y, w: s.w, h: s.h };
    y += s.h + GAP;
    return r;
  });
}

// ---------- beats ----------
const ENTERS = ["cut", "drop", "zoom", "whip", "push", "pop", "rise"];
const SMEAR = { drop: "v", push: "v", whip: "h", zoom: "z" };
const beats = (E.beats || []).slice().sort((a, b) => a.start - b.start);
const spec = { dur: DUR, cams: [{ t: 0, zoom: 1 }], shots: [], stamps: [], pages: [] };
const html = [];
const sfx = [];
let paperN = 0;

function itemHtml(id, item, r, smear) {
  const st = `left:${r2(r.left)}px;top:${r2(r.top)}px;width:${r2(r.w)}px;height:${r2(r.h)}px`;
  const k = item.kind;
  if (k === "label" || k === "stat" || k === "big") {
    const t = `<div class="txt" style="width:${r2(r.w)}px;height:${r2(r.h)}px">${esc(item.text)}</div>`;
    return `<div class="it ${k}" id="${id}" style="${st}"><div class="in" style="width:100%;height:100%;position:relative">` +
      `<div class="sharp">${t}</div>${smear ? `<div class="smear ${smear}">${t}</div>` : ""}</div></div>`;
  }
  const src = esc(item.src);
  const body = k === "card" ? `<div class="face"><img src="${src}" alt=""></div>` : `<img src="${src}" alt="">`;
  const slice = item.slice
    ? `<div class="sl a" style="clip-path:polygon(0 0,100% 0,100% 30%,0 62%)">${body}</div>` +
      `<div class="sl b" style="clip-path:polygon(0 62%,100% 30%,100% 100%,0 100%)">${body}</div>`
    : "";
  const cls = (k === "card" ? "card" : "cutout") + (item.mono ? " mono" : "");
  return `<div class="it ${cls}" id="${id}" style="${st}">` +
    `<div class="in" style="width:100%;height:100%;position:relative">` +
    `<div class="sharp">${body}</div>${smear ? `<div class="smear ${smear}">${body}</div>` : ""}${slice}</div></div>`;
}

beats.forEach((b, bi) => {
  const start = r2(b.start), end = r2(Math.min(b.end, DUR));
  if (end <= start) throw new Error(`beat ${bi} has end <= start`);
  if (b.type === "face") {
    if (b.zoom && b.zoom !== 1) { spec.cams.push({ t: start, zoom: b.zoom }); spec.cams.push({ t: end, zoom: 1 }); }
    if (b.stamp != null) {
      const id = `st${bi}`;
      const t0 = r2(start + (+b.stamp || 0));
      const sd = r2(Math.min(end - t0, b.stampFor || 3.2));
      const l1 = esc(brand.line1), l2 = esc(brand.line2);
      html.push(`<section id="${id}" class="clip stamp" data-layout-allow-overlap data-start="${t0}" data-duration="${sd}" data-track-index="3">` +
        `<div class="st st1e" data-layout-allow-overlap id="${id}-e" style="top:944px"><span class="sharp" data-layout-allow-overlap>${l1}</span></div>` +
        `<div class="st st1" data-layout-allow-overlap id="${id}-1" style="top:792px"><span class="sharp" data-layout-allow-overlap>${l1}</span><span class="smear" data-layout-allow-overlap>${l1}</span></div>` +
        `<div class="st st2" data-layout-allow-overlap id="${id}-2" style="top:868px">${l2}</div></section>`);
      spec.stamps.push({ id, t: t0 });
      if (E.sfx) sfx.push({ t: t0, f: "swish" });
    }
    return;
  }
  if (b.type !== "paper") throw new Error(`beat ${bi}: type must be paper or face`);

  const pv = paperN++;
  const paperImg = b.paper ? `runtime/img/paper-${b.paper}.jpg` : `runtime/img/paper-${pv % 2 ? "b" : "a"}.jpg`;
  const ox = -110 + ((pv * 53) % 100) - 50, oy = -190 + ((pv * 97) % 160) - 80;
  const parts = [`<div class="paperbg" style="left:${ox}px;top:${oy}px;background-image:url(${paperImg})"></div>`];
  if (b.header) parts.push(`<div class="hdr"><span>${esc(b.header)}</span></div>`);

  const shots = b.shots || [];
  let prev = null; // { items: [{item, rect}] }
  shots.forEach((s, si) => {
    const enter = s.enter || (si === 0 ? "cut" : "whip");
    if (!ENTERS.includes(enter)) throw new Error(`beat ${bi} shot ${si}: unknown enter "${enter}"`);
    const t0 = r2(start + (s.at || 0));
    const next = shots[si + 1];
    const nextT = next ? r2(start + (next.at || 0)) : end;
    const nextEnter = next ? next.enter || "whip" : null;

    // expand labels attached to cutouts/cards
    const fresh = [];
    (s.items || []).forEach((it) => {
      fresh.push(it);
      if (it.label) fresh.push({ kind: "label", text: it.label, enter: it.enter, delay: it.delay });
    });
    const carried = enter === "push" && prev ? prev.items.map((p) => p.item) : [];
    const all = [...carried, ...fresh];
    const rects = layout(all, b.header);

    const sid = `b${bi}s${si}`;
    const out = [];
    const specItems = [];
    all.forEach((item, k) => {
      const id = `${sid}i${k}`;
      const r = rects[k];
      const isCarried = k < carried.length;
      const ie = isCarried ? null : item.enter || enter;
      out.push(itemHtml(id, item, r, isCarried ? null : SMEAR[ie] || null));
      const si2 = { id };
      if (isCarried) {
        const o = prev.items[k].rect;
        si2.carry = { x: r2(o.left + o.w / 2 - (r.left + r.w / 2)), y: r2(o.top + o.h / 2 - (r.top + r.h / 2)), s: r2(o.w / r.w) };
      } else {
        si2.enter = ie;
        if (item.delay) si2.delay = +item.delay;
      }
      if (item.punch != null) si2.punch = r2(start + +item.punch);
      if (item.slice) {
        si2.slice = [r2(start + item.slice[0]), r2(start + item.slice[1])];
        const dx = r.w, dy = -0.32 * r.h, L = Math.hypot(dx, dy);
        const d = [dx / L, dy / L];
        si2.sliceD = d.map(r2);
        si2.sliceN = [r2(d[1]), r2(-d[0])];
      }
      specItems.push(si2);
      if (E.sfx && !isCarried && ie !== "cut") sfx.push({ t: t0 + (item.delay || 0), f: ie === "pop" || ie === "rise" ? "pop" : "whoosh" });
    });

    const exitAt = nextT;
    const t1 = r2(nextEnter === "whip" ? nextT + 0.18 : nextEnter === "zoom" ? nextT + 0.13 : nextEnter === "push" ? nextT : nextT);
    spec.shots.push({ id: sid, t0, t1: next ? t1 : end, exit: next ? nextEnter : null, exitAt: r2(exitAt), items: specItems });
    parts.push(`<div class="shot" id="${sid}">${out.join("")}</div>`);
    prev = { items: all.map((item, k) => ({ item, rect: rects[k] })) };
  });

  html.push(`<section id="b${bi}" class="clip paper" data-start="${start}" data-duration="${r2(end - start)}" data-track-index="2">${parts.join("")}</section>`);
});

// overlapping paper beats are a plan error, not something to paper over
const papers = beats.filter((b) => b.type === "paper");
for (let i = 1; i < papers.length; i++) {
  if (papers[i].start < papers[i - 1].end - 1e-6) throw new Error(`paper beats overlap at ${papers[i].start}s`);
}

// ---------- captions ----------
const capHtml = [];
pageWords.forEach((ws, pi) => {
  const id = `pg${pi}`;
  const t0 = r2(ws[0].start);
  const nextStart = pageWords[pi + 1] ? pageWords[pi + 1][0].start : DUR;
  const t1 = r2(Math.min(nextStart, ws[ws.length - 1].end + 0.7, DUR));
  const spans = ws.map((w, wi) => `<span class="w" id="${id}w${wi}">${esc(w.text)}</span>`).join(" ");
  capHtml.push(`<div class="pg" id="${id}">${spans}</div>`);
  spec.pages.push({ id, t0, t1, words: ws.map((w, wi) => ({ id: `${id}w${wi}`, t: r2(Math.max(t0, w.start - 0.03)) })) });
});

// ---------- audio ----------
const audio = [`<audio id="voice" src="${esc(videoRel)}" data-start="0" data-duration="${DUR}" data-track-index="10" data-volume="1"></audio>`];
if (E.music && E.music.src) {
  audio.push(`<audio id="bgm" src="${esc(E.music.src)}" data-start="0" data-duration="${DUR}" data-track-index="11" data-volume="${E.music.volume ?? 0.08}"></audio>`);
}
sfx.forEach((s, i) => {
  audio.push(`<audio id="fx${i}" src="runtime/sfx/${s.f}.wav" data-start="${r2(Math.max(0, s.t - 0.06))}" data-duration="0.6" data-track-index="${30 + i}" data-volume="${E.sfxVolume ?? 0.3}"></audio>`);
});

// ---------- page ----------
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<title>${esc(E.title || "Yanni edit")}</title>
<link rel="stylesheet" href="runtime/yanni.css" />
<style>:root{--accent:${esc(brand.accent)};} .shot,.pg{visibility:hidden;opacity:0;}</style>
<script src="runtime/gsap.min.js"></script>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${DUR}" data-fps="30">
<svg width="0" height="0" style="position:absolute"><defs>
<filter id="mbv" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="0 34" /></filter>
<filter id="mbh" x="-60%" y="-10%" width="220%" height="120%"><feGaussianBlur stdDeviation="40 0" /></filter>
</defs></svg>
<div id="cam"><video id="headv" src="${esc(videoRel)}" data-start="0" data-duration="${DUR}" data-track-index="0" muted playsinline></video></div>
${html.join("\n")}
<section id="caps" class="clip caps" data-start="0" data-duration="${DUR}" data-track-index="5">
${capHtml.join("\n")}
</section>
${audio.join("\n")}
</div>
<script>
window.YANNI = ${JSON.stringify(spec)};
${fs.readFileSync(path.join(HERE, "runtime", "yanni.js"), "utf8")}
</script>
</body>
</html>
`;

// copy runtime next to the page so the project is self contained
fs.cpSync(path.join(HERE, "runtime"), path.join(dir, "runtime"), { recursive: true });
fs.writeFileSync(path.join(dir, "index.html"), page);
const paperSec = papers.reduce((n, b) => n + (Math.min(b.end, DUR) - b.start), 0);
console.log(JSON.stringify({
  ok: true, index: path.join(dir, "index.html"), duration: DUR, beats: beats.length,
  paperShare: r2(paperSec / DUR), captionPages: pageWords.length, sfx: sfx.length, warnings: warn,
}, null, 1));
