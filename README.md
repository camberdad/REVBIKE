# REVBIKE

A browser-based 2.5D dirtbike stunt game made with **Vite, TypeScript, Three.js, and Rapier2D**. Physics runs strictly in X/Y at a fixed 120 Hz; Three.js adds depth, lighting, shadows, and a damped orthographic chase camera.

## Play and embed

**Play:** https://camberdad.github.io/REVBIKE/

**Embed demo:** https://camberdad.github.io/REVBIKE/embed-demo.html

Paste this into your website's HTML or Custom HTML block:

```html
<iframe
  src="https://camberdad.github.io/REVBIKE/?embed=1"
  title="REVBIKE dirtbike stunt game"
  width="100%"
  height="720"
  style="display:block;aspect-ratio:16/9;height:auto;max-width:1600px;border:0"
  allow="fullscreen; autoplay; gamepad"
  allowfullscreen
  loading="lazy"
></iframe>
```

The `?embed=1` option fills the iframe with the game and its HUD. Click **LET'S RIDE** inside the game to give it keyboard focus. Use a 16:9 iframe for the same viewport fit as Castle Rangers (1280×720 at the reference viewport); rendering scales to the available size and device pixel ratio. Portrait screens use the full available height. Touch controls appear automatically on touch devices.

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
| Accelerate rear wheel | W / Up |
| Brake, then reverse | S / Down |
| Lean back / backflip | A / Left |
| Lean forward / frontflip | D / Right |
| Restart round from the beginning | R / toolbar restart |
| Retry checkpoint, clock keeps running | C / crash dialog |
| Pause / resume | P / Escape |
| Start / retry | Enter / Space |

Touch devices show holdable throttle, brake, and lean buttons. Sound is optional; the toolbar enables a procedural Web Audio engine and explosion sounds. Fullscreen is available in the toolbar. **Settings** and **How to ride** are home-menu buttons that open a centered panel with separate tabs and a Back button, including in iframe and fullscreen modes. The toolbar settings button also opens this panel during a ride. The course fills a viewport-fitted 16:9 frame with HUD overlays; the document does not scroll.

Gameplay settings persist in browser storage: Auto/display-refresh rendering or 30/60/120/144 FPS caps; low/medium/high visual quality; blood Off/Low/Medium/High; and screen shake on/off. Blood is off by default and uses stylized red particles on rider crashes. Rendering caps do not change the fixed physics timestep or the timer. Opening the guide/settings panel during a run pauses the ride; **Back**, **Resume ride**, or Escape resumes it. On the home screen, Back returns to the home menu. R always starts a fresh round, including while a panel is open.

## Course and rules

The campaign has **25 unlocked courses across five environments**. Level Select has five environment tabs, per-course best times and stars, and Gold/Silver/Bronze targets. Each course has three or four authored stunt sections, two checkpoints and a finish gate. Direct links use `?level=1` through `?level=25`; `?embed=1&level=19` works too. The original course remains at `?course=classic`. [All courses and mechanisms](docs/campaign.md).

A clean completed flip earns **−0.5s** after a safe landing grace window. Steep takeoffs and sloped landings are accounted for, and a safe suspension rebound keeps the bonus. Loop riding and partial bumps do not score flips. Head/torso contact, active hazards and falling out of bounds trigger a six-body ragdoll crash.

**R always resets the whole selected round**: time, flip bonuses, both checkpoints, moving decks, broken bridges, explosives, rocks, loop gates and the rider. **C retries the latest checkpoint with the clock running**, restoring the bike and complete mechanism/hazard state. The flip bonus rolls back to its checkpoint value to prevent retry farming. Best times and settings persist.

## Implementation

- `src/physics.ts`: a chassis, two suspension carriers, and two independent circular wheels. Prismatic joints with spring motors provide limited, damped suspension travel. Revolute axle joints allow the wheels to spin. Bike parts do not collide with one another. Terrain uses continuous polylines; CCD protects fast-moving bodies.
- `src/render.ts`: procedural scenery, extruded track meshes, hazard meshes, rider and ragdoll rendering, shadows, particles, and the camera. The rider and bike dynamics remain locked to Z = 0; mesh thickness adds visual depth.
- `src/campaign.json`: 25 authored course recipes and medal targets.
- `src/campaign.ts`: smooth geometry, mechanism placement, checkpoints, props and environment palettes.
- `src/machines.ts`: seesaws, flex decks, lifts, rollers, belts, spring/boost pads, breakable bridges and magnetic rails.
- `src/scenery.ts`: procedural scenery and set-piece props for all five environments.
- `src/level1.json`: retained original Redrock Ridge course.
- `src/track.ts`: monotone cubic Hermite ramp sampling and loop generation. `?course=test` loads the flat-ground/single-ramp test course.
- `src/main.ts`: fixed-step game loop, controls, checkpoint progress, timer, bonuses, full-round restarts, pause/results dialogs, accessibility, responsive HUD, level grid, environment tabs, medal results and saved progress.
- `src/settings.ts`: validated preferences, blood amount definitions, and rendering-only frame limiting.
- `src/audio.ts`: browser-generated sound; no downloaded audio assets.

The loop has a crossing at its base. Its incoming and outgoing collision lanes are gated by traversal phase, allowing a strictly 2D bike to pass beneath the exit lane and then follow the full loop. Both lanes are visible throughout.

Handling settings are grouped in `TUNING` and `BIKE_DIMENSIONS` in `src/physics.ts`: gravity, ground/air torque, a soft spin limit, axle positions and travel, force-based spring stiffness, compression/rebound damping, and friction. The raised chassis settles around 1.14 m with 0.66 m of suspension travel. Sliding forks, a moving swingarm, and a compressible coil follow the real axle bodies.

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

The regression tests exercise flat-ground settling, ramp traversal, both lean directions, head-strike ragdolls, TNT explosions, full-course completion through the loop, full-round restart, and both clean frontflip/backflip scoring. Rendering tests verify each frame cap, saved-preference validation, and blood amount scaling. A PD balancing controller drives the actual control inputs in course tests; it does not move or teleport the bike. Browser checks cover model loading, throttle, the live timer, R resetting a progressed round, crash blood output, preference persistence, pause/resume, both menu tabs, and desktop/portrait/landscape/iframe layouts.

## Release versions

A faint version label appears in the lower-right corner of the course, above the status bar. Hover it to see the source commit. Every new GitHub Pages deployment automatically receives `1.2.<GITHUB_RUN_NUMBER>`; the workflow run number increases for every new push or manual deployment. Retrying the same workflow keeps its release number. Local previews show `1.2.0-dev`. The build also publishes `version.json` containing the version and commit for verification. To start a new major/minor release line, change those two components in `package.json`; no manual patch bump is needed.

The arcade camera uses a 19.5 m vertical span on landscape screens (previously 13.5 m), with damped velocity look-ahead in X and a small capped vertical lead. Pitch controls use 90 ground wheelie torque, 72 forward ground torque, 41 backward / 48 forward air torque, and separate 7.2 backward / 8.5 forward rad/s soft limits, and neutral-input angular braking. The spring is 235 N/m with 20/11 compression/rebound damping and 0.12 tire restitution. Tire landings have no impact-speed or pitch-angle ejection threshold; inset head/torso terrain contact, hazards, and falling out of the course cause crashes. The arcade regressions verify standing/throttle wheelies, smooth release braking in both directions, bouncing tire landings from 4/6/9 m, and direct torso crashes.

The campaign tests drive all 25 courses to their finish gates using ordinary throttle/brake/lean inputs, collect both checkpoints, and traverse every authored loop and inverted rail. Dedicated tests cover the moving mechanisms, smooth curve normals, single/double canyon backflips and their clean landing bonuses. A browser playthrough completed First Ride in 36.31 seconds, earned Gold/three stars, and verified the saved time in Level Select after navigating to Level 2.
