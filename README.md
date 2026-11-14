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
  height="650"
  style="display:block;max-width:1400px;border:0;border-radius:12px"
  allow="fullscreen; autoplay; gamepad"
  allowfullscreen
  loading="lazy"
></iframe>
```

The `?embed=1` option fills the iframe with the game and its HUD. Click **LET'S RIDE** inside the game to give it keyboard focus. You can adjust the iframe height to fit your page. Touch controls appear automatically on touch devices.

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
| Pause / resume | P / Escape |
| Start / retry | Enter / Space |

Touch devices show holdable throttle, brake, and lean buttons. Sound is optional; the toolbar enables a procedural Web Audio engine and explosion sounds. Fullscreen is available in the toolbar. **How to ride** and **Gameplay settings** are tabs at the bottom of the game, including in iframe and fullscreen modes.

Gameplay settings persist in browser storage: Auto/display-refresh rendering or 30/60/120/144 FPS caps; low/medium/high visual quality; blood Off/Low/Medium/High; and screen shake on/off. Blood is off by default and uses stylized red particles on rider crashes. Rendering caps do not change the fixed physics timestep or the timer. Opening a bottom tab during a run pauses the ride; **Resume ride**, P, or Escape resumes it.

## Course and rules

Level 1, **Redrock Ridge**, includes spline ramps, gaps, a vertical loop, TNT barrels, spinning saws, spike pits, four checkpoints, and a finish gate. Run time determines three stars under 32s, two under 45s, or one under 65s. Each complete airborne 360° rotation earns **−0.5s**, after a clean wheel landing. A short landing confirmation prevents awarding a crash as a clean flip. Partial rotations and riding around the loop do not earn a flip bonus.

Head contact with track geometry crashes immediately. TNT, saws, spikes, and falling out of the course also crash. Crashes detach a six-body jointed ragdoll and emit particles. **R always starts a fresh round at the original starting line**, clearing the timer, flip bonuses, checkpoint progress, exploded hazards, velocities, and ragdoll. Checkpoints mark progress through the current round. Best completed times and gameplay preferences persist across restarts.

## Implementation

- `src/physics.ts`: a chassis, two suspension carriers, and two independent circular wheels. Prismatic joints with spring motors provide limited, damped suspension travel. Revolute axle joints allow the wheels to spin. Bike parts do not collide with one another. Terrain uses continuous polylines; CCD protects fast-moving bodies.
- `src/render.ts`: procedural scenery, extruded track meshes, hazard meshes, rider and ragdoll rendering, shadows, particles, and the camera. The rider and bike dynamics remain locked to Z = 0; mesh thickness adds visual depth.
- `src/level1.json`: all track control points, hazards, checkpoint locations, loop geometry, spawn, finish, and star thresholds.
- `src/track.ts`: monotone cubic Hermite ramp sampling and loop generation. `?course=test` loads the flat-ground/single-ramp test course.
- `src/main.ts`: fixed-step game loop, controls, checkpoint progress, timer, bonuses, full-round restarts, pause/results dialogs, accessibility, responsive HUD, and bottom tabs.
- `src/settings.ts`: validated preferences, blood amount definitions, and rendering-only frame limiting.
- `src/audio.ts`: browser-generated sound; no downloaded audio assets.

The loop has a crossing at its base. Its incoming and outgoing collision lanes are gated by traversal phase, allowing a strictly 2D bike to pass beneath the exit lane and then follow the full loop. Both lanes are visible throughout.

Handling settings are grouped in `TUNING` and `BIKE_DIMENSIONS` in `src/physics.ts`: gravity, ground/air torque, a soft spin limit, axle positions and travel, force-based spring stiffness, compression/rebound damping, and friction. The raised chassis settles around 1.11 m with 0.66 m of suspension travel. Sliding forks, a moving swingarm, and a compressible coil follow the real axle bodies.

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

The regression tests exercise flat-ground settling, ramp traversal, both lean directions, head-strike ragdolls, TNT explosions, full-course completion through the loop, full-round restart, and both clean frontflip/backflip scoring. Rendering tests verify each frame cap, saved-preference validation, and blood amount scaling. A PD balancing controller drives the actual control inputs in course tests; it does not move or teleport the bike. Browser checks cover model loading, throttle, the live timer, R resetting a progressed round, crash blood output, preference persistence, pause/resume, both bottom tabs, and mobile/iframe layouts.
