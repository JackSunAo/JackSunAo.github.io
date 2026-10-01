# 小银 — an interactive American Shorthair

A silver classic tabby living in a small warm room, rendered in real time with
WebGL2. Open `cat/index.html` in a browser, or visit the published page. No
build step and no dependencies: three files, all plain ES2017.

| file | what it holds |
| --- | --- |
| `index.html` | markup, CSS, the HUD and the action dock |
| `cat-data.js` | the baked mesh: `window.CAT_ASSET.meta` (skeleton, eyes, ears, whiskers, mouth landmarks) and `.data`, base64 of the packed vertex and index buffers |
| `cat.js` | everything else — shaders, skinning, animation, behaviour, the room, audio |

The cat is 22,976 vertices and 46,000 triangles over a 39-bone skeleton. Its
attribute layout is documented by `buildCatVAO`, the only code that reads
`CAT_ASSET.data`. Everything else in the room is generated at load from
primitives in `roundBoxGeom`, `cylGeom`, `coneGeom` and `sphereGeom`.

## How it is put together

`cat.js` runs top to bottom in one IIFE, in these sections:

- **math** — vectors, quaternions, column-major mat4, springs, value noise.
- **GL helpers / shaders** — the fur is shell-rendered: the mesh is drawn once
  as skin plus up to 30 instanced shells, and the fragment shader decides strand
  coverage from a 3-D lattice keyed on rest position. There are two coats: a
  dense fine undercoat near the skin and a longer topcoat that carries the tabby
  markings. Markings are procedural, evaluated in a design space that undoes the
  skinning, so the pattern stays put on the body as the cat moves.
- **skeleton** — a plain bone hierarchy; skinning matrices go to the GPU as an
  RGBA32F texture.
- **the room** — `ROOM` has the layout, `PERCHES` the surfaces the cat can stand
  on and `BLOCKS` the footprints it walks around. `R.room` builds one mesh per
  material; `ROOM_FS` switches on `uMat`. Lit by daylight through the window
  (one directional light plus a broad area fill), a tungsten lamp on the desk,
  and a bounce term off the oak floor.
- **animation core** — a pose library in degrees, blended per body part,
  two-bone IK for the legs, and a gait engine mixing walk, trot and gallop.
- **the cat** — `CatSim`, which owns the behaviour scripts, the additive layers
  (breath, tail, ears, gaze, lids, petting) and the autonomous idle brain.
- **toys** — the laser pointer and the wind-up mouse, each with its own
  behaviour script.
- **input** — ray-picks the skinned mesh on the CPU to find which part of the
  cat you touched; `pickSurface` finds where the laser lands.
- **audio** — everything is synthesised; nothing is sampled.

## What makes it read as an animal

These are the parts worth not regressing:

- **Transitions stagger by body part.** Hips first, head last, tail trailing.
  See `STAGE` and `poseBlendStaged`. Driving every joint on one curve is what
  made an earlier version look like a machine.
- **The body has mass.** `layerSettle` runs root height, pitch and roll through
  an underdamped spring, so the cat settles into a pose instead of snapping to it.
- **The tail is simulated, not keyframed.** `layerTailSim` is a spring chain in
  world space: the pose supplies only muscle intent, and gravity, inertia and
  the hips moving underneath produce the delay down the chain and the whip on a
  turn. `layerTail`'s amplitudes are deliberately small; the physics amplifies
  them.
- **Nothing holds still and nothing is symmetric.** `layerLife` adds postural
  sway, weight drifting between the legs and a permanent left/right difference,
  all from slow noise so it never repeats.
- **The voice is a vocal tract, not a sample.** A Liljencrants-Fant glottal pulse
  through a formant cascade, with a pole-zero pair for the nasal cavity that
  opens and closes over each call — that notch is what makes the closed-mouth
  part of a meow sound like an `[m]`. Per-cycle jitter and shimmer, period
  doubling for the rough calls, and a short convolution reverb. Every call is
  synthesised in two or three takes and picked at random.
- **Sounds are placed.** Panned by where they actually are, with the reverb send
  rising with distance. Footfalls come from the paw, not the cat's centre, and
  the surface decides their timbre.
- **Wet things look wet.** The nose and pads are darkened by the film and carry
  the window's reflection; so do the eyes, plus the tear line at the lids.

## The toys

**Laser pointer.** The dot is a light term in both the room and fur shaders, not
a sprite, so it lands on whatever is under it and scatters into the cat's coat.
`pickSurface` tests the floor, the rug, the tops of the bed, desk and chair, all
four walls and the ceiling, with a fallback onto the floor if the ray leaves the
room. The chase is deliberately unwinnable: stalk, pounce, miss, swat, repeat.
Put the dot out of reach and the cat sits and chatters at it; hold it still for
seven seconds and it loses interest.

**Wind-up mouse.** Bolts, stops, swivels, bolts again, bouncing off walls and
furniture, with a spring that runs down over about ninety seconds. The cat
freezes when it bolts, creeps while it is stopped, and can actually catch it —
pinning it for a second or two before letting it go. Its parts overlap in space,
so each carries its own id in the uv rather than being identified by position.

## On a phone

Checked at iPhone SE, 13 and 13 Pro Max widths. Things that matter and are easy
to break:

- The dock is four across in two rows, and drops its icons below 370 points.
  Every button is at least 44 points. Adding another button needs re-checking
  at 320 points wide.
- `IS_MOBILE` caps the fur at 20 shells and the pixel ratio at 1.6, and `adapt()`
  lowers both further if frames run long.
- The canvas is `touch-action: none` and the page cannot scroll; pinch, one-finger
  orbit and stroking the cat all go through pointer events.
- `setPointerCapture` is allowed to fail — on a phone an exception there used to
  take the whole gesture with it.
- A lost WebGL context is reported rather than freezing on the last frame. Phones
  take the context back under memory pressure.
- Audio can only start inside a user gesture, which is what the opening card is
  for. Synthesis is spread over several frames so that first tap does not block.

## Testing

Open the page with `?test=1` and `window.__test` appears; without it the page
exposes nothing. The hooks are at the bottom of `cat.js`:

```js
__test.step1(dt)              // advance the simulation one frame, no rendering
__test.draw()                 // render once — also what rebuilds the view matrix
__test.fixCam(az, el, dist, tx, ty, tz)   // pin the camera
__test.place(x, z, yaw)       // teleport the cat
__test.act(name)              // fetch | call | roll | sleep | jump | sit | laser | mouse
__test.pet(region)            // head | cheek | chin | back | rump | tail | belly | leg
__test.state()                // pose, mode, status, position, level, ball
__test.worldOf()              // world positions of head, nose, eyes — for aiming a camera
__test.dbg(code)              // evaluate in module scope
__test.sheetFrames2(spec)     // run the sim and composite one frame per cell into a contact strip
```

`sheetFrames2` is how the animation is checked: it fires events at given cells
and returns a data URL, far quicker than screenshotting every frame. A spec
looks like:

```js
{ cols: 6, w: 300, h: 280, cells: 18, stepsPerCell: 4, dt: 1/30,
  events: [[1, "window.__test.act('sit')"]] }
```

Two traps worth knowing, both of which have produced wrong conclusions here:

- **`fixCam` does not rebuild the view matrix; `draw()` does.** Picking and
  screen-space tests run against a stale camera otherwise.
- **`step()` overwrites the per-frame uniforms.** To force one for a diagnostic,
  set it *after* the step and before the draw.

Seed `Math.random` from an init script to make a run reproducible.

Audio is verified by pulling the synthesised buffers out through
`__test.dbg('synthAll(48000)')`, writing them as WAVs and measuring them — F0
contours, octave-band levels, footstep timbre per surface, and an A/B of the same
call with nasality forced to 0 and to 1 to confirm the nasal zero lands at
1.0–1.2 kHz.

## Things that would be worth doing next

- There is no anticipation before a big move: a cat gathers slightly backwards
  before it springs forwards, and nothing here does.
- Gaze only tracks the ball during `fetch`. The cat ignores it rolling past the
  rest of the time.
- No toy uses the bed or the desk as cover; the cat will chase onto them but the
  mouse stays on the floor.
- `sheetPoses` and `sheetFrames` are the older contact-sheet helpers, kept only
  because they predate `sheetFrames2`; nothing uses them now.
