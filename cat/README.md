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

**Feather wand.** Drag anywhere and the feather follows — on a spring, behind
where you are dragging, so it swings and overshoots and settles. That lag is the
whole reason a cat goes for one. Height decides the answer: on the floor the cat
flattens and swipes, at chest height it sits up and boxes, over its head it
gathers and jumps. Aiming maps the pointer onto a vertical plane through the cat
facing the camera, so sideways moves it around and up lifts it.

**Wind-up mouse.** Bolts, stops, swivels, bolts again, bouncing off walls and
furniture, with a spring that runs down over about ninety seconds. The cat
freezes when it bolts, creeps while it is stopped, and can actually catch it —
pinning it for a second or two before letting it go. Its parts overlap in space,
so each carries its own id in the uv rather than being identified by position.

## The room's own life

- **The light follows the clock on the device.** `SKY` works out the sun's
  height, angle and colour once at load: high and slightly cool in the morning,
  swinging round and turning orange through the afternoon, gone after dark, when
  the desk lamp carries the room on its own. The window, the ambient, the fill,
  the floor bounce, the exposure and the lamp's own brightness all come from it.
  `?hour=19` overrides it, which is how it was checked — including that the cat
  stays legible at night (luminance 0.168 against a 0.176 background) and that
  it does not go looking for a patch of sun that is not there.
- **Night is lit by the lamp, not by a dimmer.** The hard part of a night room
  is resisting the urge to raise the ambient until you can see: that turns the
  room into a daylit one with the sun switched off, every surface some shade of
  brown. So after dark the wash drops (`fill` 0.17), the sky half of the ambient
  goes cool because the only thing left outside the window is sky, the floor
  gives back less because one lamp is all that is reaching it (`bounce`), and
  the exposure opens up instead — which is also what an eye does walking into a
  dark room. Measured over the same frame, that took the warm/cool spread from
  0.147 to 0.215 and the contrast from 0.103 to 0.128, and left every frame
  before dusk bit-identical.
- **Sunlight comes through the window, not the wall.** `sunGate` projects a point
  back along the light onto the window plane and asks whether it lands in the
  opening, which puts the window's shape and its glazing bars on the floor. The
  rest of the room is carried by the area fill and the desk lamp.
- **The cat finds the sun.** `sunSpot()` works out where that patch lands using
  the same geometry the shader does — the two are checked against each other —
  and the cat crosses the room to lie in it, both on command and on its own.
- **The room is never silent.** A seamless room-tone loop under everything, and a
  bird outside the window every ten to thirty seconds, panned and reverberated
  from the window's position rather than played in the room.

## On a phone

Checked at iPhone SE, 13 and 13 Pro Max widths. Things that matter and are easy
to break:

- The dock is five across in two rows, and drops its icons below 440 points.
  Perch labels are one character on the button, because "跳上书桌" overflowed.
  Every button is at least 44 points. Adding a tenth needs re-checking at 320,
  390 and 428 points wide — 390 is the one that has broken twice.
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
__test.act(name)              // fetch | call | roll | sleep | jump | sit | laser | mouse | wand
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
  mouse and the wand stay on the floor.
- `sheetPoses` and `sheetFrames` are the older contact-sheet helpers, kept only
  because they predate `sheetFrames2`; nothing uses them now.
