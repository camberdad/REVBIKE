# Technical Trials / 1.4 release

## Reference and design intent

The [FIM TrialGP introduction](https://fim-moto.tv/trialgp) emphasizes balance, control and precision. The [official Trials HD listing](https://www.xbox.com/en-us/games/store/trials-hd/c0pk4504xscn) describes physics-based motorcycle obstacle riding, bike unlocks and rider customization. The [ESRB description](https://www.esrb.org/ratings/27023/trials-hd/) describes finishing obstacle courses with few faults. [RedLynx's development interview](https://www.destructoid.com/interview-redlynx-talks-bringing-trials-hd-to-xbla/) provides context for its simple controls and demanding physics.

REVBIKE's Trials mode interprets those design principles with its own Rapier simulation and procedural tracks. The numerical values below are REVBIKE tuning choices, not recovered Trials HD specifications. The original 25-course arcade campaign remains an optional Stunt mode with separate records and handling.

## Controls and scoring

- W / Up: quick throttle pulses; Shift reduces demand to 38% and wheel-speed ceiling to 40%.
- S / Down: strong wheel brakes, without automatic reverse in Trials.
- A / D: physically move rider mass rearward or forward/down while grounded; bounded pitch control while airborne. Forward posture extends farther on steep slopes.
- Space: a grounded bunny hop, also available as touch HOP. The impulse adds 7.6 m/s upward (about a 1.6 m jump); gas adds 1.6 m/s forward. It has a 0.55-second cooldown, requires a new press and cannot add an air jump. Quick taps queue until the next fixed physics step. Space starts from the menu and retries after a crash.
- R: immediate checkpoint retry. A manual retry adds a fault; retrying an already counted crash does not double count it. Elapsed time continues.
- T / Backspace: full restart, clearing time, faults, checkpoints and obstacle state.

Faults are primary; time breaks ties between equal-fault finishes. Zero faults earns Gold, or Platinum at/below par; up to three faults earns Silver and up to eight Bronze. Trials has no flip-time bonus. Records use `revbike-trials-N`, separate from the Stunt campaign.

## Rig and contact changes

| Property | Trials | Archived Stunt |
| --- | --- | --- |
| Tire radius | 0.62 m | 0.44 m |
| Wheelbase | 2.32 m | 1.88 m |
| Rear axle from chassis center | −1.28 m | −0.94 m |
| Suspension travel | 0.58 m | 0.66 m |
| Spring stiffness | 380 | 235 |
| Compression / rebound damping | 46 / 36 | 20 / 11 |
| Tire friction | 4.2 | 1.9 |
| Tire restitution | 0.01 | 0.12 |
| Rear torque | 88 | 26 |
| Wheel-speed ceiling | 18 rad/s | 76 rad/s |
| Backward / forward air torque | 42 / 44 | 41 / 48 |
| Backward / forward air spin soft limit | 4.0 / 4.2 rad/s | 7.2 / 8.5 rad/s |

The longer visible rear swingarm follows the actual rear axle. Donor wheel meshes and the procedural fallback both use the larger radius. Fenders, sliding forks and the spring follow the real suspension positions, and a lower frame center of mass supports steep climbs.

A 3-unit physical rider mass moves on horizontal and vertical prismatic motors. Ground input changes its target position; no grounded chassis lean torque is applied. Rider limbs articulate with the measured body movement, while hands/feet remain attached to bars/pegs. Head and torso crash sensors follow the rider posture. Checkpoint snapshots preserve motor targets and body poses. Direct terrain contact causes a crash; tire impact speed alone does not eject the rider.

Terrain uses continuous, densely sampled monotone curves with merged adjoining surfaces. Boxes have rounded colliders; logs have circular colliders. Small contact skins help steady contact. Rendering interpolates the previous/current fixed-step chassis and wheel poses, including wrapped angles, without modifying physics. The orthographic span is 34 m landscape / 30 m portrait, with damped velocity look-ahead.

## Courses and progression

`src/trials.json` authors 30 named course recipes: six per Countryside, Construction, Canyon Mines, Neon Factory and Volcanic Wasteland. Each compact 100 m course has three sections and two checkpoints at flat joins. Recipes combine curb control, log trials, stepped crates, tall ledges, balance decks, central-pivot seesaws, 55–65° climbs, controlled drops and short precision platform gaps. There are no high-speed loops, turbo strips or mega-launches in Trials.

All tracks are unlocked. Finishing one unique Trials track unlocks Rock Crawler; five unlocks Section R. Garage color/number preferences persist, with validated storage and unlock requirements. Rock Crawler adds a guard and grip, while Section R has a different body panel and engine response.

## Measurements and verification

Repeat with `node node_modules/tsx/dist/cli.mjs scripts/measure-trials.ts`. In the deterministic flat-ground benchmark, a uniform horizontal correction maintains approximately 5 m/s so both rigs can be compared despite different engine braking. Over the sampled five seconds, Trials chassis height varies **0.97 mm**; archived Stunt varies **0.80 mm**. These are small physical ripples in both profiles. The visible smoothing change also comes from render interpolation; this benchmark does not measure perceived frame pacing or prove lower ripple than Stunt. Trials RMS vertical velocity is approximately 0.021 m/s.

Braking a settled 5 m/s Trials roll for 0.30 seconds leaves approximately **0.050 m/s** forward speed, with no crash. Holding the brake afterward does not drive into reverse. Space produces a short hop and re-arms after landing; holding it or tapping in the air adds no extra jump.

The original 80 automated regressions include every Trials spawn and curve, real weight transfer, posture restoration, brakes, throttle pulses, hop gating, ride ripple, interpolation, fault ranking and garage validation. Input-driven tests clear the tutorial and its checkpoints, the staircase/tall ledges, and the actual 60° and 65° faces. They also preserve full-route checks for all 25 archived Stunt courses. The remaining Trials sections have geometry/spawn checks; **all 30 Trials courses have not been manually cleared end to end**. Difficulty and par times remain candidates for human playtesting.

Browser QA completed Balance School with zero faults in 9.65 seconds, showed Platinum, unlocked Rock Crawler, persisted custom jersey/number/equipped bike, and fit all six course cards in a 390×650 viewport without document overflow. Quick Space taps, R fault increments, full restart, and the guide/settings/garage flow are checked through the actual UI.

Use F3 or `?debug=1` for wheel compression, axle drop, tire gap, angular velocity, rider shift and throttle; `?debug=log` additionally logs telemetry. Development diagnostics also expose mode, faults and accepted hop count.

## Torque reaction, weight-snap hops and technical sections

### Drivetrain and grip (`TRIALS_ENGINE` in `src/physics.ts`)

- Trials uses lighter gravity (−18 instead of −22), a 25 rad/s wheel ceiling and a 15.5 m/s speed cap (about 54 km/h, up from 40), so the bike feels lighter and carries speed. A pair of 0.1 s W taps moves it about 3 m in a second; it coasts for several seconds.
- Engine torque is internal: whatever twists the rear wheel twists the chassis the other way. How much depends on where the player puts the rider: 0.6 centred or forward, rising to 1.05 with A held (weight over the rear axle adds anti-squat lift). It follows the A/D input, not the body's sag, so a wheelie does not feed itself. Full gas from rest bucks the front about 22° on flat ground, about 10° with D held, and loops out with A held. On a 55° slope, neutral full gas loops out while gas + D climbs.
- A moves the rider up to 0.9 m back (was 0.62).
- Torque peaks at 1.3× at zero wheel speed and fades to zero at the wheel-speed ceiling, so short W taps give controlled bursts. Throttle response is 30 ms.
- Brakes (150 torque, locking) also react into the chassis (0.55), so hard braking dives the nose. A 5 m/s roll stops in about 0.35 s; locked brakes plus forward weight hold the bike still on a 45° incline.
- Tyre friction 5.2, terrain 3.6, obstacles 4.0, bridge planks 2.4, decks 2.6.
- Engine braking with the throttle closed also reacts into the chassis.

### Weight-snap bunny hop

Hold A on the ground for at least 0.08 s (full preload at 0.32 s), then press D with W held (or throttle above 30%) within 0.32 s. The bike pops up 4.1 to 5.8 m/s, with the rear end getting 1.45× the impulse and the front 0.75×, so the rear kicks up onto a ledge. It shares the 0.55 s cooldown and grounded rule with Space. Without gas, or without the A preload, nothing happens.

### Landings

If the front wheel touches down alone after more than 0.2 s in the air, and the bike is more than 0.5 rad nose-down relative to the surface with more than 6.5 m/s impact speed along the normal, that is a fault (`NOSE-FIRST LANDING`). Rear-first and slope-matched landings are absorbed. The HUD toast shows the crash cause and the fault counter flashes.

### Section catalogue (`src/trials.ts`, 30 m each, four per course)

| Section | Geometry |
| --- | --- |
| curbs | 0.28 / 0.45 / 0.6 m blocks |
| logs | 0.7 / 0.9 / 1.1 m round logs |
| steps | 0.5 / 1.0 / 1.5 m crate or concrete staircase (height scale capped at 1.06) |
| ledge | 0.9 and 1.1 m vertical ledges (capped at 1.06) |
| wall | 5 m-long step-up wall, 1.45 to 1.62 m tall |
| beam | 9.2 m flexing plank 1.3 m above a pit |
| seesaw | 9 m teeter-totter resting tipped 0.17 rad toward the rider |
| bridge | 8 hinged 1.39 m planks hanging with slack between two posts over an 11 m pit |
| climb55/60/65 | short base transition, then a face whose steepest point is the named angle; small rock bumps on the 55° faces; 45° descent |
| drop | ramp to a 5 m ledge, then a 1.9 m sheer vertical drop |
| precision | three 4.4 m pillars, 0.6 / 0.95 / 1.3 m tall, separated by 1.1 m gaps over a pit |
| rocks | five small rock blocks |

### How the sections were validated

Each section type was checked with focused experiments before being tuned:

- The 1.45 to 1.75 m wall clears from a standstill about 3 m out: an A + gas wheelie held near 40°, then A → D + gas once the front tyre is over the lip.
- The 1.9 m drop lands cleanly from a held 20° manual; rolling off at 4 m/s or faster endos.
- The stepped 1.1 m gaps cannot be rolled across at 1.5 to 2.5 m/s with a 0.35 m rise, but a held manual at about 3 m/s carries both.

`tests/trials-bot.ts` combines these techniques into a scripted rider that uses only W/S/A/D. The tests use it to clear an authored example of every section type. The full sweep (`scripts/sweep-trials.ts`) currently clears 96 of the 120 sections (80%); most failures are the scripted rider's limits on logs, wall exits and some gap pillars. **A human has still not ridden every course end to end**, and par times remain estimates.
