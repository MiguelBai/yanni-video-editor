# Style bible: the paper cut science reel

Measured frame by frame off the reference reel Yanni chose (a 79 s pharmacology
explainer, talking head plus paper scenes). Numbers are for a 1080x1920 frame.
The runtime in `engine/runtime/` already implements all of this; this page is so
you plan beats the way the reference does.

## The two worlds

**Face.** Full frame, unzoomed, static camera. No overlay except captions and,
once, the name stamp. Roughly half the runtime.

**Paper.** A light crumpled paper sheet fills the frame (two generated textures,
alternated and offset per beat so consecutive beats never look identical). On it,
in the middle band of the frame, one to three things at a time:

- a **header tag**: white text (Inter 500, ~58 px) on black boxes with 9 px
  rounded corners, one box per line, top at y≈360. It names the topic and sits
  above the first objects of the hook. Static, no animation.
- **cutouts**: real objects with the background removed and a soft drop shadow
  (vial, brain). Optionally grayscale engravings.
- **labels**: a bold dark word under a cutout ("Trenbolone"), Montserrat 700, ~74 px.
- **cards**: real study pages as flat white sheets with a drop shadow, no
  rotation, no rounded corners, cropped tight to the part being discussed.
- **stats**: the number he says, in the accent red, Montserrat 800, ~86 px,
  directly under a card ("130* users").

Everything is centered horizontally. The stack is centered vertically between
the header (or the top third) and the captions.

## Captions

Always on, over both worlds. White Inter 600 ~47 px with a thin dark outline and
soft shadow, centered, max ~700 px wide, top anchored at y≈1405 so new lines grow
downward. One page per phrase (up to ~13 words, broken at sentence ends and long
pauses). The whole page is laid out from the start and each word fades in on its
own timestamp, so the first word appears where it will finally sit (often the
left of the line). No highlight color, no bounce, no emoji.

## Motion vocabulary (all ~0.2 s, sharp out eases, motion blurred)

| enter  | what the reference does                                   | use it for                    |
| ------ | --------------------------------------------------------- | ----------------------------- |
| `drop` | object falls in from above with vertical blur, lands, settles 7 percent smaller | the hook object, a new compound |
| `zoom` | new object rushes in from 2.2x scale, blurred, over the old one | swapping object to object      |
| `whip` | whole shot slides out left, next slides in from right, horizontal blur | next study page, next point   |
| `push` | current items glide up, new item rises from below with blur | adding a stat or figure under a card |
| `pop`  | scales from 55 percent with a small overshoot              | stat numbers, big words        |
| `rise` | gentle 50 px float up with fade                            | secondary text                 |
| `cut`  | no motion, it is just there                                | the first card after a face beat |

**Slice** (`"slice": [a, b]`): the reference's signature. A diagonal cut opens
across an object (the brain), the halves drift apart showing paper through the
gap, then snap back. Use it once or twice per video when he says something
destroys, damages, breaks, splits or "rots" something.

**Punch** (`"punch": t`): the object scales up 9 percent at time t. For "and THIS
is the part that matters".

**Name stamp**: two lines in Montserrat 900 ~158 px. Line one whips in from the
right with blur, 0.3 s later line two slams in over its lower half in the accent
color, with an echo of line one peeking below. Holds about 3 s on the first face
beat, then hard cuts away.

## Rhythm of the reference (first 30 s)

| time      | world | what happens                                              |
| --------- | ----- | --------------------------------------------------------- |
| 0.0-1.5   | paper | header + vial drops in, label under it                    |
| 1.5-4.4   | paper | brain zooms in over the vial; slice opens on "rots the brain" |
| 4.4-8.4   | face  | name stamp on "welcome back to..."                        |
| 8.4-11.9  | paper | journal title card; whip to the graphical abstract         |
| 11.9-13.9 | face  | "researchers at Uppsala..."                               |
| 13.9-20.0 | paper | methods card (structures), whip to results, figure pushes in under it |
| 20.0-20.5 | face  | one short line                                            |
| 20.5-29.0 | paper | three result paragraphs, whip between each, bar chart     |
| 29.0-37.5 | face  | the interpretation                                        |

Paper carries the evidence, the face carries the meaning. When he explains what a
result means, cut back to his face.

## No sound effects, no music by default

The reference has neither: only his voice. `sfx` and `music` exist in edit.json
for when Yanni asks for them; keep them off otherwise.
