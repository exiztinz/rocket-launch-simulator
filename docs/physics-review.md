# Physics and rendering review

The prior solver contained valid inverse-square gravity and aerodynamic drag formula shapes, and useful historical thrust/mass inputs. Those inputs remain. The changes address inconsistent reference frames, visualization-only trajectory bending, inaccurate attitude, and invented return dynamics.

## Findings and fixes

| Finding                                                                                                   | Change                                                                                                                     |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| The great-circle longitude update had the opposite sign for eastward launches.                            | Integrate inertial Cartesian position directly; derive latitude/longitude from its Earth-fixed transform.                  |
| Initial rotational velocity was set to zero by the hold-down branch, and drag used inertial speed.        | Preserve pad corotation and subtract atmosphere velocity before computing drag.                                            |
| Renderer altitude scaling and a second downrange integrator changed the path independently of the solver. | Map position, Earth, and altitude using one world scale; only the vehicle/marker have a visibility enlargement.            |
| Orientation depended on differences between physics samples and interpolated samples.                     | Publish a unit attitude vector from guidance; bound pitch rate and use deterministic coast attitude.                       |
| Constant upper-stage burn profiles overshot reference insertion speeds after frame corrections.           | Apply speed guidance to both thrust and propellant flow, retaining unused fuel. No state is overwritten to force an orbit. |
| Unpowered return used arbitrary downward acceleration and per-step horizontal damping.                    | Remove the fabricated return. Propagate coast under actual modeled forces; distinguish impact from landing.                |
| Stage separation events could occur after the next stage was already firing.                              | Respect the separation gap before the next ignition.                                                                       |
| Orbit motion accumulated Euler integration error.                                                         | Use RK4 and test conservation against an independent circular-orbit solution.                                              |
| Trail buffers grew/rebuilt on every update; effects depended on wall clock and random draws.              | Fixed trail allocation, half-second trail samples, deterministic stars/plumes, time-based camera damping.                  |

The rotating-atmosphere drag treatment follows [NASA's description of relative velocity](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/factors-that-affect-drag/). The vacuum integrator is checked using two-body [orbital mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-3/).

## Compared with the code at the start of this change

| Mission  | Original cutoff altitude | Updated cutoff altitude | Original cutoff speed | Updated cutoff speed | Preset reference speed |
| -------- | -----------------------: | ----------------------: | --------------------: | -------------------: | ---------------------: |
| Saturn V |                 146.6 km |                190.0 km |           8,220.9 m/s |          7,874.1 m/s |              7,800 m/s |
| Shuttle  |                 119.2 km |                120.0 km |           7,874.6 m/s |          7,833.0 m/s |              7,800 m/s |
| Falcon 9 |                 433.6 km |                440.0 km |           7,920.5 m/s |          7,660.9 m/s |              7,600 m/s |

Speed errors are about 0.95%, 0.42%, and 0.80% against the preset references. These are approximate input references, not a new validation against flight telemetry. The altitude controller intentionally targets the reference altitude. The generated calibration report uses the repository's older saved baseline, which is distinct from this direct before/after comparison.

At cutoff, approximate osculating perigee/apogee are 190/465 km (Saturn), 106/123 km (Shuttle), and 440/479 km (Falcon). These are not the historical mission orbits. In particular, the Shuttle abstraction omits separate OMS burns and the low orbit experiences atmospheric decay. The model does not claim long-term stable insertion or an exact inclination match. Those remaining limits are documented rather than hidden by drawing a different path.

## Verification

- Physics unit/integration checks pass for all presets.
- An independent 400 km circular orbit retains radius within 0.1 m and relative energy/angular momentum within 1e-8 after three revolutions at a 5-second step.
- All presets pass finite telemetry, fuel monotonicity, acceleration bounds, and renderer-data consistency checks.
- Headless Edge passes all mission/control checks and horizontal-overflow checks at 320, 390, 768, 1024, 1366, and 1920 px. Screenshots were inspected for desktop, mobile, powered flight, and Earth overview.

Thrust/mass profiles are still estimates. Guidance, atmosphere, vehicle shapes, lighting, and staging visuals remain simplified; no six-degree-of-freedom rigid-body, reentry, or landing solver is implied.
