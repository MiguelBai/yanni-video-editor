# edit.json reference

Lives at `<project>/build/edit.json`. Paths are relative to `build/`. Times are
seconds on the CUT timeline (`build/transcript.txt`).

## Top level

| key          | default            | meaning                                                       |
| ------------ | ------------------ | ------------------------------------------------------------- |
| `title`      | "Yanni edit"       | page title only                                               |
| `video`      | `head.mp4`         | the jump cut talking head                                     |
| `transcript` | `transcript.json`  | word timestamps from cut.mjs                                  |
| `replace`    | `{}`               | caption spelling fixes, whole word, case insensitive          |
| `captions`   | `true`             | `false` hides captions and lets paper use the lower frame     |
| `brand`      | brand.json         | override `line1`, `line2`, `accent` for one video             |
| `sfx`        | `false`            | whoosh/pop/swish on transitions                               |
| `sfxVolume`  | `0.3`              |                                                               |
| `music`      | none               | `{ "src": "assets/track.mp3", "volume": 0.08 }`               |
| `beats`      | `[]`               | see below; gaps between beats show his face                   |

## Face beat

```json
{ "type": "face", "start": 3.2, "end": 6.4, "stamp": 0.2, "stampFor": 3.2, "zoom": 1.12 }
```

- `stamp`: seconds into the beat when the name stamp hits. Once per video.
- `stampFor`: how long the stamp holds (default 3.2, cut short by the beat end).
- `zoom`: punch in for the whole beat (1.08 to 1.15). Use on the second half of
  a long face stretch to hide a jump cut.

## Paper beat

```json
{ "type": "paper", "start": 6.4, "end": 10.1, "header": "Optional black tag",
  "paper": "a", "shots": [ ... ] }
```

- `header`: short (2 to 6 words). Over ~22 characters it wraps to two lines and
  the stack moves down to make room.
- `paper`: force texture `a` or `b` (default alternates).
- Paper beats must not overlap each other.

## Shot

```json
{ "at": 1.6, "enter": "whip", "items": [ ... ] }
```

- `at`: seconds into the beat.
- `enter`: `cut | drop | zoom | whip | push | pop | rise` (see style.md). First
  shot defaults to `cut`, later shots to `whip`.
- `push` keeps every item of the previous shot (they glide up) and adds the new
  items under them. Any other enter replaces the whole shot.

## Items

| kind     | fields                                   | notes                                       |
| -------- | ---------------------------------------- | ------------------------------------------- |
| `cutout` | `src`, `label`, `mono`, `w`, `h`          | transparent PNG from cutout.mjs; fits 720x700 by default |
| `card`   | `src`, `mono`, `w`, `h`                   | study page or photo on a white sheet; 760 wide by default |
| `label`  | `text`                                   | dark bold word, usually via a cutout's `label` |
| `stat`   | `text`                                   | accent color number, only what he says      |
| `big`    | `text`                                   | huge black word for a one word beat ("INSULIN") |

Shared item options:

- `enter`: override the shot's enter for this item (a `pop` stat inside a `push`).
- `delay`: seconds after the shot starts (stagger two items).
- `punch`: beat time (seconds into the beat) for a 9 percent scale up.
- `slice`: `[a, b]` beat times; diagonal split opens at a, closes by b. Needs b - a ≥ 0.6.
- `w` / `h`: max on-screen size in px; the stack shrinks everything if it does
  not fit between header and captions.

## Output

`build.mjs` writes `build/index.html` and copies `runtime/` next to it, then prints
`duration`, `paperShare` (aim 0.45 to 0.55) and `captionPages`.
