---
name: edit
description: >-
  Edits Yanni's talking head videos into the "paper cut" science reel style: his
  face on camera mixed with crumpled paper scenes where cut out objects drop in,
  real study pages whip across, red stat numbers pop, and word by word captions
  run the whole time. Use WHENEVER the user drops a video file or says "edit this",
  "edit my video", "make the reel", "cut this", "do the paper style", or
  /yanni-editor:edit. Covers the whole job: silence cut, transcript, beat plan,
  images and study screenshots, HyperFrames build, preview, render, revisions.
---

# Paper cut reel editor

Yanni is a nutrition, peptides and physique creator. He records himself talking.
This skill turns the raw take into a finished 1080x1920 reel in the style of the
reference he picked (a pharmacology explainer): his face on camera, intercut with
crumpled paper "explainer" scenes, captions on top of everything.

The user barely uses Claude. Do the whole job yourself, keep messages short and
plain, and only stop to ask when you truly need something from him (a study link,
a missing video). Never show raw JSON or long logs to him.

Read `references/style.md` once before your first plan. It is the measured style
bible; this file is the procedure.

`E` below means `<this skill's base directory>/engine`.

## 0. Preflight

- `~/.yanni-editor/brand.json` missing, or `ffmpeg`/`whisper-cli`/`node` missing:
  run the **setup** skill first, then come back.
- Find the video. If he dragged a file in, the path is in his message. If not,
  ask once: "Drag the video file into this window and press Enter."
- Project folder: `<projectsDir from brand.json>/<kebab-case-topic>` (for example
  `~/Movies/Yanni Edits/bpc-157-healing`). Pick the slug after the transcript
  tells you the topic; use `untitled-<date>` until then and rename after.

## 1. Prep and transcript

```bash
node "$E/prep.mjs" "<raw video>" "<project>"
```

Normalizes to 1080x1920 30fps at -16 LUFS and writes
`build/raw.transcript.txt` (phrases with timestamps). Read that file.

## 2. Jump cut (and bad takes)

Look for retakes: the same sentence said twice, a false start, "wait let me
redo that". **Keep the LAST take**, remove the earlier ones by raw time range.
Also remove clear junk at the start and end (him reaching for the phone).

```bash
node "$E/cut.mjs" "<project>" --remove "3.10-7.85,40.2-44.0"
# no retakes: node "$E/cut.mjs" "<project>"
```

Pauses are cut from the audio itself (anything quieter than -35 dB for 0.3s or
more). If he sounds rushed, use `--gap 0.45`; if the room is noisy and nothing
gets cut, try `--db -30`. Output: `build/head.mp4` and `build/transcript.txt`
in cut time. **All beat times from here on are cut times.**

Read `build/transcript.txt`. Whisper gets names wrong; write the fixes into
`replace` in edit.json (a word for word map, case insensitive), for example
`{"BPC157": "BPC-157", "tren": "Tren"}`.

## 3. Plan the beats (write it down before touching assets)

Write `build/plan.md`: one row per beat with cut time range, the spoken line,
`FACE` or `PAPER`, and for paper what is on screen. Rules from the reference:

- **Open on PAPER.** The first 2 to 4 seconds are a paper scene with a black
  header tag naming the topic and the main object dropping in. This is the hook.
- **The first FACE beat carries the name stamp** (`"stamp": 0.2`).
- **Alternate.** Never two paper beats back to back without face between them
  unless the spoken thought clearly continues (then make it one paper beat with
  several shots). Paper beats 2 to 5 s, face beats 1.5 to 5 s. Aim for paper on
  45 to 55 percent of the runtime. build.mjs prints `paperShare`.
- **What goes on paper:** the moment he names a compound, food, supplement, body
  part or study; says a number; describes a mechanism. **What stays on face:**
  opinions, warnings, conclusions, jokes, the call to action. The face is the
  trust; the paper is the proof.
- **Inside a paper beat the shot changes every 1.2 to 2.5 s.** `whip` to the next
  study page, `push` to add the stat or figure under the current card, `zoom`
  to swap objects. A paper beat with one static shot for 4 s is dead.
- **Long face stretch** (more than ~4 s with a jump cut inside): split it into
  two face beats and give the second `"zoom": 1.12` (a punch in hides the cut).

## 4. Gather the visuals

Put everything in `build/assets/`. Write `build/assets/credits.txt` with the
source of every image (find_images prints license and page).

**Cut out objects** (vial, syringe, chicken breast, egg, dumbbell, brain, liver):

```bash
node "$E/find_images.mjs" "syringe" "<project>/build/cand" --n 6
# LOOK at the candidates (Read them), pick the clearest object on a plain background
node "$E/cutout.mjs" "<project>/build/cand/syringe-2.jpg" "<project>/build/assets/syringe.png"
```

Then LOOK at the cutout. Background removal fails on glass, clear plastic and
busy backgrounds. If it failed, try another candidate, or use the photo as a
`card` instead of a `cutout`. Anatomy reads best as old engravings: search
"Gray's anatomy <organ>" and use `"mono": true` for the grayscale look the
reference uses. If he has his own product photos, prefer those.

**Study pages** (the backbone of this style):

- Only REAL studies. Ask him for the link if he cites one and you cannot find it
  with certainty. Never invent a study, a journal page, a figure or a number.
  Health claims on a fake screenshot can hurt people and his account.
- Screenshot via Europe PMC (PubMed blocks headless browsers):
  ```bash
  node "$E/webshot.mjs" "https://europepmc.org/article/MED/<PMID>" "<project>/build/cand/study.png"
  ```
  LOOK at it. Then crop the part he is talking about: the title block for "a
  2017 study from Oslo...", the exact results sentence or figure for the claim:
  ```bash
  ffmpeg -v error -y -i study.png -vf "crop=W:H:X:Y" -frames:v 1 "<project>/build/assets/study-title.png"
  ```
  The screenshot is 2x scale, so crops are sharp. Keep cards readable: crop
  tight, a card is at most ~820 px wide on screen.
- Journal pages (ScienceDirect, Wiley) often block too. If the screenshot is a
  captcha or blank, ask him to screenshot the page on his Mac (Cmd+Shift+4) and
  drop the file in.

**Stat numbers** (`stat`): only numbers he says out loud, word for word.

## 5. Write `build/edit.json` and build

Full format and every option: `references/edit-json.md`. Minimal shape:

```json
{
  "title": "bpc-157 healing",
  "video": "head.mp4",
  "transcript": "transcript.json",
  "replace": { "bpc157": "BPC-157" },
  "beats": [
    { "type": "paper", "start": 0, "end": 3.2, "header": "Does BPC-157 Heal Tendons?",
      "shots": [
        { "at": 0, "enter": "drop", "items": [ { "kind": "cutout", "src": "assets/vial.png", "label": "BPC-157" } ] },
        { "at": 1.6, "enter": "zoom", "items": [ { "kind": "cutout", "src": "assets/tendon.png", "mono": true } ] }
      ] },
    { "type": "face", "start": 3.2, "end": 6.4, "stamp": 0.2 },
    { "type": "paper", "start": 6.4, "end": 10.1,
      "shots": [
        { "at": 0, "enter": "cut", "items": [ { "kind": "card", "src": "assets/study-title.png" } ] },
        { "at": 1.8, "enter": "push", "items": [ { "kind": "stat", "text": "40 rats", "enter": "pop" } ] },
        { "at": 2.7, "enter": "whip", "items": [ { "kind": "card", "src": "assets/study-result.png" } ] }
      ] }
  ]
}
```

Anything not covered by a paper beat shows his face. Then:

```bash
node "$E/build.mjs" "<project>/build/edit.json"
cd "<project>/build" && npx -y hyperframes@latest check
```

`check` must say `Check passed`. Warnings about sub-compositions, track density
and duplicate images are expected for this format; errors are not.

## 6. Look before you show him

```bash
cd "<project>/build" && npx -y hyperframes@latest snapshot --at <one time inside every beat>
```

Read `snapshots/contact-sheet-*.jpg`. Check: every paper beat has something on
it, nothing overlaps the captions, cards are readable, cutouts have clean edges,
the stamp is on his first face beat, the captions are spelled right. Fix and
rebuild until it is right. He should never be the one to find a broken frame.

## 7. Preview and render

Render a draft so he can watch it on his phone or Mac:

```bash
cd "<project>/build" && npx -y hyperframes@latest render --quality draft --output "../out/<slug>-draft.mp4"
open "<project>/out"
```

Tell him in two lines: where the file is, and "tell me anything you want
changed, like 'make the study at 0:12 bigger' or 'more face in the middle'."

For changes: edit `build/edit.json`, rebuild, check, snapshot, re-render. For
the final version:

```bash
npx -y hyperframes@latest render --quality high --output "../out/<slug>.mp4"
```

Verify the file exists, plays, and its duration matches `build/head.mp4`
(`ffprobe -v error -show_entries format=duration -of csv=p=0 <file>`). Over
~60 MB, re-encode for upload:
`ffmpeg -i in.mp4 -c:v libx264 -crf 21 -preset slow -c:a copy out.mp4`.

If he wants to tweak things by hand, `npx -y hyperframes@latest preview` in the
build folder opens HyperFrames Studio in the browser with the whole timeline.

## Hard rules

1. **Never fabricate evidence.** No invented studies, numbers, figures, quotes or
   before/after images. If the audio claims something you cannot source, keep
   that line on his face and tell him which line needs a source.
2. **Captions match what he SAID**, not what the script said. Fix spelling only.
3. **One accent color**, from brand.json. Red stat text, red stamp line, nothing
   else colored except the images themselves.
4. **Do not restyle the system per video.** Fonts, paper, caption look and
   motion live in `engine/runtime/`. A video gets its own edit.json, never its
   own CSS. If he asks for a global style change, change the runtime once.
5. **Timing is cut time**, from `build/transcript.txt`, never raw time.
