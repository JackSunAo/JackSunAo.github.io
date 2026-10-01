# 小银 — an interactive American Shorthair

A silver classic tabby rendered in real time with WebGL2. Open `cat/index.html`
in a browser, or visit the published page. No build step and no dependencies:
three files, all plain ES2017.

| file | what it holds |
| --- | --- |
| `index.html` | markup, CSS, the HUD and the action dock |
| `cat-data.js` | the baked mesh: `window.CAT_ASSET.meta` (skeleton, eyes, ears, whiskers, mouth landmarks) and `.data`, base64 of the packed vertex and index buffers |
| `cat.js` | everything else — shaders, skinning, animation, behaviour, audio |

The mesh is 22,976 vertices and 46,000 triangles over a 39-bone skeleton. Its
attribute layout is documented by `buildCatVAO` in `cat.js`, which is the only
code that reads `CAT_ASSET.data`.

## How it is put together

`cat.js` runs top to bottom in one IIFE, in these sections:

- **math** — vectors, quaternions, column-major mat4, springs.
- **GL helpers / shaders** — the fur is shell-rendered: the mesh is drawn once
  as skin plus up to 30 instanced shells, and the fragment shader decides strand
  coverage from a 3-D lattice keyed on rest position. Tabby markings are
  procedural, evaluated in a design-space that undoes the skinning, so the
  pattern stays put on the body as the cat moves.
- **skeleton** — a plain bone hierarchy; skinning matrices go to the GPU as an
  RGBA32F texture.
- **scene & renderer** — room, sofa, rug, ball, a shadow map, and a separate
  pass each for eyes (refracted iris, so it looks wet) and whiskers
  (screen-space quads a fraction of a pixel wide).
- **animation core** — a pose library in degrees, blended per body part,
  two-bone IK for the legs, and a gait engine that mixes walk, trot and gallop
  by speed.
- **the cat** — `CatSim`, which owns the behaviour scripts, the additive layers
  (breath, tail, ears, gaze, lids, petting) and the autonomous idle brain.
- **input** — ray-picks the skinned mesh on the CPU to find which part of the
  cat you touched.
- **audio** — the voice is synthesised from scratch; nothing is sampled.

## What makes it read as an animal

These are the parts worth not regressing:

- **Transitions stagger by body part.** The hips commit first, the shoulders
  follow, the head arrives last, the tail trails behind. See `STAGE` and
  `poseBlendStaged`. Driving every joint on one curve is what made an earlier
  version look like a machine.
- **The body has mass.** `layerSettle` runs root height, pitch and roll through
  an underdamped spring, so the cat settles into a pose instead of snapping to it.
- **The tail is simulated, not keyframed.** `layerTailSim` is a spring chain in
  world space: the pose supplies only what the muscles intend, and gravity,
  inertia and the hips moving underneath produce the delay down the chain and
  the whip on a turn. `layerTail`'s amplitudes are deliberately small because
  the physics amplifies them.
- **Nothing holds still and nothing is symmetric.** `layerLife` adds postural
  sway, weight drifting between the legs and a permanent small left/right
  difference, all from slow noise so it never repeats.
- **The voice is a vocal tract, not a sample.** A Liljencrants-Fant glottal
  pulse through a formant cascade, with a pole-zero pair for the nasal cavity
  that opens and closes over each call — that notch is what makes the
  closed-mouth part of a meow sound like an `[m]`. Per-cycle jitter and shimmer,
  period doubling for the rough calls, and a short convolution reverb so it sits
  in the room. Every call is synthesised in two or three takes and picked at
  random.

## Testing

Open the page with `?test=1` and `window.__test` appears; without it the page
exposes nothing. The hooks are at the bottom of `cat.js`:

```js
__test.step1(dt)              // advance the simulation one frame, no rendering
__test.draw()                 // render once
__test.fixCam(az, el, dist, tx, ty, tz)   // pin the camera
__test.place(x, z, yaw)       // teleport the cat
__test.act(name)              // fetch | call | roll | sleep | jump | sit
__test.pet(region)            // head | cheek | chin | back | rump | tail | belly | leg
__test.state()                // pose, mode, status, position, ball
__test.worldOf()              // world positions of head, nose, eyes — for aiming a camera
__test.dbg(code)              // evaluate in module scope
__test.sheetFrames2(spec)     // run the sim and composite one frame per cell into a contact strip
```

`sheetFrames2` is how the animation was checked: it fires events at given cells
and returns a data URL, which is far quicker than screenshotting every frame.
A spec looks like:

```js
{ cols: 6, w: 300, h: 280, cells: 18, stepsPerCell: 4, dt: 1/30,
  events: [[1, "window.__test.act('sit')"]] }
```

Seed `Math.random` from an init script to make a run reproducible.

The audio was verified by pulling the synthesised buffers out through
`__test.dbg('synthAll(48000)')`, writing them as WAVs and measuring them —
F0 contours, octave-band levels, and an A/B of the same call with nasality
forced to 0 and to 1 to confirm the nasal zero lands where it should.

## Things that would be worth doing next

- The fur is one coat. A real shorthair has a denser undercoat under the guard
  hairs, which would show most on the silhouette and in backlight.
- The cat never looks at the ball while it is rolling past; `lookFn` only
  tracks during `fetch`.
- `sheetPoses` and `sheetFrames` are the older contact-sheet helpers, kept only
  because they predate `sheetFrames2`; nothing uses them now.
