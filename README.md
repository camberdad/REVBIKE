# REVBIKE

A browser-based 2.5D technical dirtbike Trials game with an optional Stunt campaign made with **Vite, TypeScript, Three.js, and Rapier2D**. Physics runs strictly in X/Y at a fixed 120 Hz; Three.js adds depth, lighting, shadows, and a damped orthographic chase camera.

## Play and embed

**Play:** https://camberdad.github.io/REVBIKE/

**Embed demo:** https://camberdad.github.io/REVBIKE/embed-demo.html

Paste this into your website's HTML or Custom HTML block:

```html
<iframe
  src="https://camberdad.github.io/REVBIKE/?embed=1"
  title="REVBIKE dirtbike Trials game"
  width="100%"
  height="720"
  style="display:block;aspect-ratio:16/9;height:auto;max-width:1600px;border:0"
  allow="fullscreen; autoplay; gamepad"
  allowfullscreen
  loading="lazy"
></iframe>
```

The `?embed=1` option fills the iframe with the game and its HUD. Click **RIDE TRIALS** inside the game to give it keyboard focus. Use a 16:9 iframe for the same viewport fit as Castle Rangers (1280×720 at the reference viewport); rendering scales to the available size and device pixel ratio. Portrait screens use the full available height. Touch controls appear automatically on touch devices.

GitHub Pages deploys automatically from `main` through `.github/workflows/deploy.yml`, after tests and a production build pass. The repository's Pages source is **GitHub Actions**. Assets use relative paths so the bike model, JavaScript, CSS, and favicon work under `/REVBIKE/` and other subdirectories. The built `dist/` can also be hosted on your own web server.

## Run

Requires Node.js 20.19+ or 22.12+ and pnpm.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. `pnpm build` type-checks and produces a standalone static game in `dist/`. `pnpm preview` serves that build. No backend, accounts, API keys, or paid assets are required.

## Controls

| Action | Keyboard |
| --- | --- |
| Feather rear-wheel throttle (full gas lifts the front) | W / Up |
| Precision throttle | Shift + W / Up |
| High-grip brake / hold position | S / Down |
| Move rider rearward on ground; pitch back in air | A / Left |
| Move rider forward/crouch on ground; pitch forward in air | D / Right |
| Bunny hop: hold A, then snap to D with gas | A → D + W |
| Bunny hop, grounded only (shortcut) | Space / touch HOP |
| Instant checkpoint retry; adds one fault | R (C alias) |
| Full track restart; clears faults and clock | T / Backspace / toolbar restart |
| Pause / resume | P / Escape |
| Start / retry after crash | Enter / Space |

Touch devices show holdable throttle, brake, and lean buttons plus a HOP button. Sound is optional; the toolbar enables a procedural Web Audio engine and explosion sounds. Fullscreen is available in the toolbar. **Settings** and **How to ride** are home-menu buttons that open a centered panel with separate tabs and a Back button, including in iframe and fullscreen modes. The toolbar settings button also opens this panel during a ride. The course fills a viewport-fitted 16:9 frame with HUD overlays; the document does not scroll.

Gameplay settings persist in browser storage: Auto/display-refresh rendering or 30/60/120/144 FPS caps; low/medium/high visual quality; blood Off/Low/Medium/High; and screen shake on/off. Blood is off by default and uses stylized red particles on rider crashes. Rendering caps do not change the fixed physics timestep or the timer. Opening the guide/settings panel during a run pauses the ride; **Back**, **Resume ride**, or Escape resumes it. On the home screen, Back returns to the home menu. Close an open menu to use ride hotkeys. A checkpoint retry preserves elapsed time; a full restart clears it.

## Course and rules

The default **Trials Dirtbike** mode has **30 unlocked technical tracks across five environments**, with four skill sections and three checkpoints per track. Step-up walls, crate staircases and ledges, logs and rock gardens, narrow balance planks, teeter-totters, sagging rickety bridges, 55–65° rocky climbs, sheer drops and stepped zero-speed gaps replace long launch ramps. Holding full throttle alone cannot finish any course. Level Select groups six courses per environment and saves fault-first personal bests. Direct links use `?mode=trials&level=1` through `level=30`.

**Faults rank ahead of time.** Zero faults earns Gold; zero faults at or under the track's par earns Platinum. Up to three faults earns Silver, up to eight Bronze. Crashes count once; pressing R after a crash does not add a second fault. Manual R retries add one fault. R restores the latest checkpoint's bike, rider posture and obstacle state, keeping the elapsed clock running. T / Backspace starts a clean track with zero faults and a new clock.

Engine and brake torque react into the chassis: full gas lifts the front and loops the bike out on steep ground unless the rider leans forward (D); braking dives the nose. Hold A to load the rear, then snap to D with gas for a weight-shift bunny hop; Space is a shortcut hop. Holding either does not repeat; there is no double jump. A hard nose-first landing is a fault, so land rear wheel first. Trials uses high low-end torque, strong non-reversing brakes, a lower speed ceiling, larger tires and a longer rear swingarm. Ground lean moves a physical rider mass with horizontal/vertical joints; it does not apply a chassis pitch motor. Air pitch remains responsive and bounded for landing alignment. See [research, tuning and verification](docs/trials-design.md).

The **Garage & Rider** menu saves bike paint, jersey, helmet and rider number. Complete one different Trials track to unlock **Rock Crawler**, and five to unlock **Section R**. Bikes have distinct body additions and engine/grip settings. All tracks remain unlocked for testing.

The original **25-course Stunt campaign** remains at `?mode=stunt`, with its separate arcade physics, saved times, stars and clean-flip −0.5s bonuses. Its five environment tabs, hazards, loops and moving mechanisms remain available. [Stunt courses and mechanisms](docs/campaign.md). The original single course remains at `?course=classic`.

## Implementation

- `src/physics.ts`: a chassis, two suspension carriers, and two independent circular wheels. Prismatic joints with spring motors provide limited, damped suspension travel. Revolute axle joints allow the wheels to spin. Bike parts do not collide with one another. Terrain uses continuous polylines; CCD protects fast-moving bodies.
- `src/render.ts`: procedural scenery, extruded track meshes, hazard meshes, rider and ragdoll rendering, shadows, particles, and the camera. The rider and bike dynamics remain locked to Z = 0; mesh thickness adds visual depth.
- `src/trials.json` / `src/trials.ts`: 30 technical track recipes, solid obstacles, fault medals and records.
- `src/garage.ts`: validated rider appearance and earned bike unlocks.
- `src/campaign.json`: 25 archived Stunt course recipes and medal targets.
- `src/campaign.ts`: smooth geometry, mechanism placement, checkpoints, props and environment palettes.
- `src/machines.ts`: seesaws, flex decks, lifts, rollers, belts, spring/boost pads, breakable bridges and magnetic rails.
- `src/scenery.ts`: procedural scenery and set-piece props for all five environments.
- `src/level1.json`: retained original Redrock Ridge course.
- `src/track.ts`: monotone cubic Hermite ramp sampling and loop generation. `?course=test` loads the flat-ground/single-ramp test course.
- `src/main.ts`: fixed-step game loop, controls, checkpoint progress, timer, bonuses, full-round restarts, pause/results dialogs, accessibility, responsive HUD, level grid, environment tabs, medal results and saved progress.
- `src/settings.ts`: validated preferences, blood amount definitions, and rendering-only frame limiting.
- `src/audio.ts`: browser-generated sound; no downloaded audio assets.

The loop has a crossing at its base. Its incoming and outgoing collision lanes are gated by traversal phase, allowing a strictly 2D bike to pass beneath the exit lane and then follow the full loop. Both lanes are visible throughout.

Mode-specific handling settings are grouped in `TRIALS_TUNING` / `TRIALS_DIMENSIONS` and the archived `TUNING` / `BIKE_DIMENSIONS` in `src/physics.ts`: gravity, ground/air torque, a soft spin limit, axle positions and travel, force-based spring stiffness, compression/rebound damping, and friction. Trials tires have a 1.24 m rolling diameter, a 2.32 m wheelbase and 0.58 m suspension travel. The archived Stunt chassis settles around 1.14 m with 0.66 m travel. Sliding forks, a moving swingarm, and a compressible coil follow the real axle bodies.

For live suspension compression, axle droop, tire clearance, and angular velocity, press **F3**, use **Gameplay settings → Show rig debug**, or add `?debug=1` to the URL. `?debug=log` adds console reports twice per second. See [the reference inspection, tuning values, measurements, and verification steps](docs/suspension-tuning.md).

## Supplied bike model

The game uses the user-supplied `cgbike1.obj` geometry and material colors recovered from `cgbike1.fbx`. The original authoring floor, minute lettering, and stray hardware were removed. Geometry was simplified and batched, converted into the gameplay coordinate system, and separated into chassis/front wheel/rear wheel groups. Static donor running gear was replaced by articulated runtime suspension. The resulting `public/models/revbike.glb` is approximately **2.03 MB / 105,603 triangles**, reduced from 1,373,840 source triangles. Orange plastics, raised fenders, a race plate, and off-road tread complete the dirt conversion.

The original 104 MB OBJ and 33 MB FBX stay in the user's Downloads folder and are not required to run or build the game. `public/models/provenance.json` records the conversion. To regenerate from the original files:

```sh
node scripts/inspect-fbx.mjs "C:/path/to/cgbike1.fbx"
node scripts/prepare-bike.mjs "C:/path/to/cgbike1.obj"
```

The complete procedural bike remains available automatically if the GLB request fails. The game uses no Unity code or runtime.

## Verification

```sh
pnpm test
pnpm build
```

The 102 regressions cover Trials spawns/geometry, engine-reaction loop-outs, A → D and Space hop gating, real rider mass transfer, snappy brakes that hold on 45°, nose-first landing faults, bridge sag and teeter tipping, sub-3 mm flat-ground chassis ripple, read-only draw interpolation, fault ranking and garage validation. A scripted rider that only presses W/S/A/D clears an authored example of every section type, every staircase, and the 55°/60°/65° faces; holding W alone fails all 30 courses. `scripts/sweep-trials.ts` prints a pass/fail grid for every section. The archived Stunt suite still drives all 25 full courses, collects their checkpoints and traverses their loops. The full 30-track Trials campaign has not been manually cleared end to end.

Browser checks cover a quick Space tap, R fault increments, T / Backspace resets, a zero-fault tutorial finish, a bike unlock, saved rider appearance, the six-card phone grid, menu tabs, and model loading. `node node_modules/tsx/dist/cli.mjs scripts/measure-trials.ts` repeats the flat-ground/brake measurements.

## Release versions

A faint version label appears in the lower-right corner of the course, above the status bar. Hover it to see the source commit. Every new GitHub Pages deployment automatically receives `1.3.<GITHUB_RUN_NUMBER>`; the workflow run number increases for every new push or manual deployment. Retrying the same workflow keeps its release number. Local previews show `1.3.0-dev`. The build also publishes `version.json` containing the version and commit for verification. To start a new major/minor release line, change those two components in `package.json`; no manual patch bump is needed.

The camera now uses a 34 m landscape / 30 m portrait vertical span, with damped velocity look-ahead. Fixed-step vehicle poses interpolate at the render rate to reduce visible stepping. The optional Stunt mode retains its arcade motor and suspension tuning. Tire-first impacts do not eject the rider by impact speed or bike angle; direct head/torso terrain contact, hazards and falling off the course cause crashes.
