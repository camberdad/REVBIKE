# Reference-based suspension and flip tuning

## Footage inspection

Reference: the user's local `FootageforREVBIKE.mp4`, 1776 × 1002, 30 FPS, about 22.53 seconds. FFmpeg extracted **225 JPEG frames at 10 FPS** into the ignored temporary analysis folder `artifacts/temp-footage-10fps/`:

```powershell
ffmpeg -hide_banner -loglevel error -i "C:\Users\cambe\Videos\FootageforREVBIKE.mp4" -vf "fps=10" -q:v 2 "artifacts\temp-footage-10fps\frame_%04d.jpg"
```

The inspection used chronological contact sheets and close-ups of landings around 5.7–6.1s and 14.3–15.0s. The source video and extracted frames are not shipped with the game.

- Rolling stance, especially 0.6–1.6s and 14.7–15.4s: the chassis sits clearly above the axles, with space between the tires and bodywork.
- Airborne sequences around 2.2–3.7s and 4.4–5.6s: the wheels extend away from the frame and the fork/swingarm remain visibly connected.
- Landing around 5.7–5.9s: axle-to-frame distances shorten under impact, then recover toward the riding stance around 5.9–6.1s.
- The slope-to-flat transition around 14.3–14.7s shows independent wheel response and quick settling.
- Flips follow a gravity-driven arc with continuous rotation. The footage guided proportions and response; the numerical values below are REVBIKE simulation parameters.

## Rig and physics changes

The old suspension motors used Rapier's default acceleration-based model on 0.12 kg carriers. Measured on flat ground, both springs were resting at their compression stops. Increasing stiffness alone did not produce useful sag. The motors now explicitly use **`MotorModel.ForceBased`**. The guide and axle revolute joints remain intact.

| Parameter | Current value |
| --- | --- |
| Wheel radius | 0.44 m |
| Wheelbase | 1.88 m |
| Full-droop axle Y in chassis space | −1.00 m |
| Unloaded spring axle Y | −0.88 m |
| Full-bump axle Y | −0.34 m |
| Available travel per wheel | **0.66 m**, increased from 0.44 m |
| Spring stiffness | 235 N/m, force-based |
| Compression / rebound damping | 20 / 11 |
| Ground back / forward / air lean torque | 96 / 72 / 48 |
| Opposite-input air braking torque | 56 |
| Lean input response time | 45 ms (25 ms on release) |
| Ground / air angular damping | 1.25 / 0.55; neutral damping 2.8 plus pitch drag 8 |
| Soft air spin limit | 7.5 rad/s, approximately 430°/s |
| Gravity | −22 m/s², unchanged |
| Physics timestep | 1/120 s, unchanged |

The prismatic limits are relative to the frame's −0.22 m suspension anchor. Compression damping applies while a wheel moves toward the frame; lighter rebound damping lets it extend after takeoff. Suspension velocity is calculated in the rotating chassis frame, subtracting rigid-body rotation.

The donor model's fixed fork, swingarm, chain, and rear shocks were removed during conversion. The renderer now connects sliding fork pistons/sleeves, a moving rear swingarm, and a compressible helical shock directly to the physical axle positions. Tires and tread fit the collision radius with a small corner allowance. The full-bump stop preserves front-fender clearance. The overhead saw was raised from Y=3.6 to Y=4.3 to preserve clearance for the taller riding stance.

Rotation uses smooth torque impulses with separate air damping, a soft spin limit, and stronger counter-input braking. Gravity and the trajectory timing remain unchanged. Input never directly sets angular velocity.

## Measurements and regression checks

With neutral controls after settling on flat ground, frame origin height is approximately **1.14 m**, versus approximately **0.58 m** before. Rear/front axle drop is approximately 0.70 / 0.70 m. Standing compression measured from full droop is approximately 0.30 / 0.30 m, leaving useful compression and extension travel.

In the browser's first jump, unloaded axle drop measured approximately **0.883 / 0.885 m**, while rear/front compression fell to approximately **0.117 / 0.115 m**. This is about 0.21 m of visible extension from the loaded stance.

A vertical-drop fixture starting the frame at Y=5 m reached approximately 0.672 m of peak compression, including about 0.012 m of transient solver overshoot beyond the nominal stop. Minimum front clearance remained above 0.01 m including the tread corner allowance, and the bike settled upright near 1.11 m. Peak frame angular velocity in this drop was approximately 0.38 rad/s.

Reproduce the stance/drop measurements:

```sh
pnpm exec tsx scripts/measure-rig.ts
pnpm exec tsx scripts/measure-rig.ts --sweep
pnpm test
```

The automated suite checks static sag, airborne extension, landing compression, positive tire clearance, rebound settling, coordinate-invariant telemetry through 90° chassis rotation, unchanged center-of-mass gravity, continuous spin acceleration, bounded spin, opposite-input reversal, both clean flip directions, and full-course/loop completion.

## Live diagnostics

- Press **F3**, or open **Gameplay settings → Show rig debug**.
- Open `?debug=1` for an overlay enabled on load. Combine with `?course=test&debug=1` for the flat-ground/single-ramp course.
- Open `?debug=log` for the overlay plus console reports twice per second while the simulation is running.
- Read `window.revbike.diagnostics` in the developer console. It includes `angularVelocity` in rad/s, `suspension` measurements for each wheel, `tuning`, and `dimensions`.
- Press **P** or open a bottom tab to freeze the physical readout. Resume to continue. **R** starts a new round at the beginning.

Compression is measured from the full-droop limit. The overlay displays raw distances, the 0.66 m nominal travel, axle drop, conservative tire/fender clearance, and angular velocity in both rad/s and degrees/s. Orange compression bars indicate proximity to the bump stops. Diagnostics are off by default.

## Arcade handling update

Wheel restitution is now 0.12, with lighter compression and rebound damping for a visible landing bounce. The 0.66 m travel and wheel friction are retained. A 4 m spawn-height drop produced about 3.35 m/s upward chassis rebound, a 6 m drop about 4.30 m/s, and a 9 m drop about 5.63 m/s; all settled without a ragdoll. These are chassis spawn heights above the flat test course, not wheel drop distances.

With A held, the front tire clears the ground by over 0.30 m within 0.50 s from a standstill, or about 0.28 s with throttle. Half a second of air lean produces about 6.15 rad/s; a second after release it falls to about 0.31 rad/s. Neutral braking applies torque to the chassis rather than setting the angle, clamping angular velocity, or braking the spinning tires. Gravity remains unchanged.

There was no pre-existing force/angle ejection rule to raise. Tire-first landings remain free of those crash thresholds. The helmet sensor is inset to radius 0.23 m, and a small capsule inside the torso handles direct body strikes. Neither sensor supports the bike physically. Direct head/torso terrain collisions, hazards, and falling out of bounds still crash. The full level, its loop, all checkpoint recoveries, and clean front/backflip scoring pass alongside the new handling regressions.

## Campaign revision

Backward pitch is now 90 ground torque, 41 air torque, a 7.2 rad/s air limit, a 60 ms input ramp and a 3.5 rad/s grounded soft limit. Forward torque and its original response, suspension and gravity are retained. See [campaign details and verification](campaign.md).
