# Yanni Video Editor

A Claude Code plugin that edits your talking head videos into the "paper cut"
science reel style: your face on camera, intercut with crumpled paper scenes
where objects drop in, real study pages whip across, red numbers pop, and word
by word captions run the whole time.

You record. You drag the file in. Claude does the rest and hands you an MP4.

Made for you by Miguel Barbosa (ManyFai).

---

## Install (once, about 15 minutes)

You need a Mac.

**1. Install Claude Code.** Open the Terminal app (Cmd+Space, type "Terminal")
and paste:

```
curl -fsSL https://claude.ai/install.sh | bash
```

Close Terminal, open it again, type `claude` and press Enter. Log in with your
Claude account when it asks.

**2. Add the editor.** Inside Claude, paste these two lines one at a time:

```
/plugin marketplace add MiguelBai/yanni-video-editor
/plugin install yanni-editor@yanni-video-editor
```

(If Miguel sent you a zip instead: unzip it into your home folder, then use
`/plugin marketplace add ~/yanni-video-editor` for the first line.)

Restart Claude (type `/exit`, then `claude` again).

**3. Run setup.** Type:

```
/yanni-editor:setup
```

Claude installs the video tools (FFmpeg, the speech to text model, the HyperFrames
renderer) and asks you three quick questions: your name stamp, your accent color,
and where to save videos. If it asks you to paste a Homebrew command with your Mac
password, do it; that is the only step it cannot do for you.

---

## Edit a video

1. Make a folder for your work and open Claude there:
   ```
   mkdir -p ~/Movies/Yanni\ Edits && cd ~/Movies/Yanni\ Edits && claude
   ```
2. Type `edit my video` and drag the video file from Finder into the window.
   Press Enter.
3. If you are citing a study, paste the link too. Claude only ever shows real
   studies on screen, so a link makes your edit better and faster.
4. Wait. Claude cuts the silences, writes captions, plans the scenes, finds the
   images, builds the edit and renders a draft into your videos folder.
5. Watch it and say what to change, in plain words:
   "the study at 0:12 is too small", "more of my face in the middle",
   "the caption says retatrude, it should be retatrutide".
6. When you like it, say `render the final`.

### Tips for recording

- Film vertical, face centered, eyes in the top third.
- If you mess up a line, just pause and say it again. Claude keeps your last take.
- Say numbers and study names clearly; that is what turns into the paper scenes.

### Change the look later

- Name stamp, accent color, the words the speech model should know (peptide names):
  edit `~/.yanni-editor/brand.json`, or just ask Claude to change them.
- Want to drag things around yourself? Ask Claude to "open the preview". It opens
  HyperFrames Studio in your browser with the whole timeline.

---

## What is inside

```
skills/setup/   installs the tools, saves your brand
skills/edit/    the editor: SKILL.md (the procedure), references/ (the style rules)
  engine/       prep.mjs, cut.mjs, transcribe.mjs, find_images.mjs, cutout.mjs,
                webshot.mjs, build.mjs
  engine/runtime/  the look: paper textures, fonts (Inter, Montserrat, OFL),
                   captions, motion, GSAP
```

Everything runs on your Mac. Speech to text and background removal are local;
nothing is uploaded anywhere except the image searches (Wikimedia Commons) and
study pages Claude screenshots.

Fonts: Inter and Montserrat, SIL Open Font License (see `engine/runtime/fonts`).
Images found by the editor come from Wikimedia Commons; each edit keeps a
`credits.txt` with the license of every image used.
