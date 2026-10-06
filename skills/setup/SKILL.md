---
name: setup
description: >-
  One time install for the Yanni video editor. Use when the user says "set up the
  video editor", "install the editor", "setup", runs /yanni-editor:setup, or when the
  edit skill finds a missing tool (ffmpeg, node, whisper, hyperframes) or no
  ~/.yanni-editor/brand.json. Installs everything with Homebrew, downloads the
  speech model, and saves the user's brand (name stamp, accent color, vocabulary).
---

# Setup: Yanni video editor

The user is not technical. Do the work yourself, explain in one short line what
is happening, never paste walls of terminal output at them.

## 1. Install the tools

Run the bundled script from this skill's folder:

```bash
bash "<this skill's base directory>/setup.sh"
```

It is idempotent. Read its output:

- `MISSING Homebrew`: Homebrew needs the user's Mac password, which you cannot
  type. Tell them, in plain words: "Paste this into the box below with a `!` in
  front, press Enter, and type your Mac password when it asks (nothing shows while
  you type, that is normal):"
  `! /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
  When it finishes, run setup.sh again.
- Any other `MISSING` line: fix it (usually `brew install <thing>`) and rerun.
- `SETUP DONE`: continue.

Speech model: small.en (470 MB) is the default and is good. If the user wants
better spelling of hard words, run `bash setup.sh medium.en` and put
`"whisperModel": "medium.en"` in brand.json.

## 2. Ask the brand questions (AskUserQuestion, one pop up, not a questionnaire)

Ask at most these, offering sensible defaults:

1. **Name stamp.** The big two line title that slams onto the screen in the first
   face shot (in the reference it was "ANABOLIC / ARCHIVES"). Default `100X` / `YANNI`.
2. **Accent color.** Used for the second stamp line and for red stat numbers.
   Default the reference red `#D6192B`. Other good options: electric blue
   `#1E5BFF`, lime `#7CD322`.
3. **Where finished videos go.** Default `~/Movies/Yanni Edits`.

## 3. Write `~/.yanni-editor/brand.json`

```json
{
  "line1": "100X",
  "line2": "YANNI",
  "accent": "#D6192B",
  "projectsDir": "~/Movies/Yanni Edits",
  "whisperModel": "small.en",
  "vocab": ["BPC-157", "TB-500", "GHK-Cu", "semaglutide", "tirzepatide", "retatrutide",
            "ipamorelin", "CJC-1295", "MOTS-c", "creatine", "hypertrophy", "macros",
            "protein", "insulin", "testosterone", "cortisol", "IGF-1", "GLP-1"]
}
```

`vocab` is fed to the speech model so peptide and compound names come out
spelled right. Add any brand, supplement or coach names the user mentions.

## 4. Smoke test

Run a 3 second test so the first real edit does not hit a surprise:

```bash
E="<plugin root>/skills/edit/engine"
T="$(mktemp -d)"
ffmpeg -v error -f lavfi -i "testsrc2=s=1080x1920:r=30:d=3" -f lavfi -i "sine=f=300:d=3" -shortest -c:v libx264 -c:a aac "$T/clip.mp4"
node "$E/prep.mjs" "$T/clip.mp4" "$T/proj"
```

It should print `"ok":true`. Then tell the user, in one or two lines: setup is
done, and to edit a video they just say "edit my video" and drag the file in.
