# REVBIKE campaign

All 25 levels are unlocked for testing. Five environment tabs show best times and stars saved separately for each course. Direct links use `?level=N`, with optional `embed=1` or `debug=1`. Gold, Silver and Bronze targets are strict under-time thresholds.

| Level | Course | Environment | Gold / Silver / Bronze |
| --- | --- | --- | --- |
| 1 | First Ride | Countryside | 38s / 47s / 58s |
| 2 | Barn Yard Hop | Countryside | 40s / 49s / 60s |
| 3 | The Teeter-Totter | Countryside | 43s / 52s / 63s |
| 4 | Rolling Whoops | Countryside | 42s / 51s / 62s |
| 5 | Countryside Finale | Countryside | 48s / 57s / 68s |
| 6 | Container Yard | Construction | 42s / 51s / 62s |
| 7 | Wrecking Ball | Construction | 45s / 54s / 65s |
| 8 | Hydraulic Lifts | Construction | 46s / 55s / 66s |
| 9 | Pipe Rollers & TNT | Construction | 46s / 55s / 66s |
| 10 | Skyscraper Leap | Construction | 49s / 58s / 69s |
| 11 | Minecart Rails | Canyon Mines | 43s / 52s / 63s |
| 12 | Rockslide Run | Canyon Mines | 44s / 53s / 64s |
| 13 | The First Loop | Canyon Mines | 44s / 53s / 64s |
| 14 | Collapsing Bridges | Canyon Mines | 46s / 55s / 66s |
| 15 | Canyon Mega-Stunt | Canyon Mines | 49s / 58s / 69s |
| 16 | Conveyor Gauntlet | Neon Factory | 44s / 53s / 64s |
| 17 | Crusher Alley | Neon Factory | 46s / 55s / 66s |
| 18 | Bounce Pads | Neon Factory | 46s / 55s / 66s |
| 19 | Double Loop-de-Loop | Neon Factory | 49s / 58s / 69s |
| 20 | Reactor Core Escape | Neon Factory | 50s / 59s / 70s |
| 21 | Lava Lake Skim | Volcanic Wasteland | 45s / 54s / 65s |
| 22 | Ring of Fire | Volcanic Wasteland | 48s / 57s / 68s |
| 23 | Inverted Ceiling Track | Volcanic Wasteland | 49s / 58s / 69s |
| 24 | Volcano Eruption | Volcanic Wasteland | 53s / 62s / 73s |
| 25 | The Ultimate Stunt Finale | Volcanic Wasteland | 55s / 64s / 75s |

## Handling and geometry

Backward ground torque is 90 instead of 96. Backward air torque is 41 instead of 48, the air speed limit is 7.2 instead of 8.5 rad/s, and the input ramp is 60 instead of 45 ms. Grounded backward rotation has a soft 3.5 rad/s limit. D/Right retains its 72 ground torque, 48 air torque, 8.5 rad/s limit and original 45 ms input ramp. Neutral pitch braking, suspension travel, 235 N/m stiffness, 20/11 damping and gravity remain intact.

The JSON course recipes expand into three or four stunt sections, two checkpoints and a finish gate. Contiguous static curves are merged before collider sampling. Monotone Hermite samples are at most 0.18 m apart in X, loops use 320 arc segments, and moving decks have rounded edges. Visual track ribbons and physical polylines use the same samples.

The large canyon/finale kickers use visible ramp-aligned speed strips to provide double-flip airtime with the lower backward limit. They apply force along the ramp without teleportation or gravity changes. The finale's loop feeds immediately into its mega-ramp. Level 19 has two consecutive loops linked by a saw gap and speed strip.

## Physical mechanisms

Seesaws and flexible steel decks are dynamic bodies attached to central revolute joints, with travel limits and restoring torque. Hydraulic elevators wait for both wheels to board, rise, hold at the upper exit and return. Kinematic pipes transfer their backward rotation through friction. Conveyors add directed tire traction. Spring pads launch the whole bike assembly. Boosts are sensors so their graphics cannot introduce overlapping collider edges. Wood/glass decks collapse 0.4 seconds after wheel contact.

Wrecking balls and axes swing through kinematic collision poses; crushers follow independent rhythmic phases. Contact TNT starts a fuse and then explodes with a finite blast radius, allowing a moving rider to escape. Rockslide triggers release dynamic rolling boulders. Course tests keep all hazard colliders active.

Inverted magnetic rails apply normal attraction, gravity compensation, and tangent-following pitch torque while the physical wheel/chassis assembly is attached. The returning lane is gated until the rider reaches the ceiling; the rail releases after the exit. Gravity outside the attachment is unchanged.

## Checkpoints and validation

R resets the complete selected round. C restores the last checkpoint's rider momentum, deck poses, broken bridge state, loop gates, magnetic progression, hazard poses, fuse timers and exploded TNT. The timer continues while the flip bonus rolls back to its checkpoint value.

All 25 route regressions use actual control inputs from a PD balance controller that follows curves and times crushers. It never moves the bike or skips geometry. Tests require the finish, both checkpoints, every authored loop and both inverted rails. Separate tests exercise dense smooth samples, moving mechanisms, full-round reset, checkpoint restoration, short A taps, bounded directional spin, suspension bounce, and clean single/double backflips off the actual canyon mega-ramp.

Automated clean routes generally take the mid-30s to mid-40s seconds, with the fastest conveyor routes near 32 seconds. Timing depends on player input, brakes, flips and retries. The browser First Ride playthrough earned Gold in 36.31 seconds and persisted its best time and three stars across level navigation.
