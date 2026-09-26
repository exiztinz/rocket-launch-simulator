# Launch Atlas

A responsive 3D launch explorer with Saturn V, Space Shuttle, and Falcon 9 mission presets. Built with Three.js and Chart.js; no build step is required.

## Run

Requires Node.js 18 or later:

```sh
npm start
```

Open http://127.0.0.1:4173. On Windows PowerShell with script execution restricted, use `npm.cmd start`.
The static server uses Node's standard library. Browser libraries and optional fonts load from pinned CDN URLs / Google Fonts, so the app needs an internet connection.

## Explore a flight

- Choose a mission and launch through the countdown.
- Hear countdown tones, ignition rumble, staging effects, and an original ambient score. Sound effects and music have separate toggles and a shared volume slider below the timeline. Audio starts with Launch; pausing, scrubbing, resetting, switching missions, or hiding the tab silences it. Music keeps its tempo during fast-forward.
- Pause/resume, scrub to any point, or cycle 1x / 4x / 8x / 32x playback.
- Follow the rocket, watch from a fixed ground observer, see the whole Earth, or orbit/pan/zoom freely.
- Expand the flight view, select rendering quality, or enable reduced motion.
- Inspect telemetry and full-width charts. Faint chart curves show the modeled replay; colored curves and the amber cursor show the current time. Event details appear on hover.

The layout uses a wide viewport with separate telemetry, mission information, and charts. Tablet and phone layouts stack without nested scroll panels. The canvas resizes with its container. Touch scrolling stays available until Free orbit is selected.

## Visuals

The missions have distinct simplified vehicle models and stage visibility. Lighting, stars, attitude, and plume animation repeat consistently when replaying or scrubbing. Earth and altitude share one spatial scale; vehicles and the launch marker are enlarged for visibility. The atmospheric limb, clouds, exhaust, and trajectory respect Earth occlusion. Daylight is illustrative, not an ephemeris for the historical launch date.

Low/medium quality use the lightweight Earth texture; high quality loads the 8K map on supported GPUs. Pixel density and star counts also scale with quality. Flight trails use a fixed buffer rather than rebuilding the entire geometry every frame.

## Flight model

The model is an educational approximation, not a flight planning tool or exact historical reconstruction.

The original stage thrust, mass, drag, and burn-duration inputs are retained. Corrections include:

- A single Earth-centered inertial position/velocity integrated in 3D with a 0.1-second RK4 step.
- Inverse-square gravity using Earth's gravitational parameter, plus drag relative to the rotating atmosphere.
- Earth rotation retained while the vehicle is on the pad; pad airspeed is zero, while inertial speed is about 408 m/s at these launch sites.
- Correct eastward longitude, consistent inertial/Earth-fixed coordinates, and a ground track derived from the actual flight state.
- A prescribed initial pitch program followed by approximate altitude/vertical-speed feedback. Pitch changes are limited to 1.2 degrees/second.
- Upper-stage guidance targets each stage's own cutoff, reserving a conservative estimate of the later stages' velocity gain. This prevents S-II from throttling too early and leaving S-IVB to pitch steeply upward to recover altitude. Throttle reduces thrust and propellant consumption together; unused propellant remains aboard during coast. A vis-viva speed floor avoids treating a historical pre-insertion MECO state as a stable orbit.
- Rocket attitude follows the thrust direction during powered flight and smoothly acquires prograde after final cutoff. It never depends on the frame-to-frame displacement of an exaggerated path.
- Coast is integrated under gravity and drag. The old artificial Shuttle deorbit acceleration, velocity damping, and invented landing events have been removed. An actual intersection with the surface is reported as an impact.

The presets still use approximate stack masses, piecewise thrust/mass-flow profiles, an exponential atmosphere, and simplified guidance. Separate OMS/circularization burns, detailed stage dry-mass jettison, Earth oblateness, lift, winds, reentry, and landing are not modeled. Insertion altitude is a guidance target; matching it does not independently validate the historical trajectory. Orbit apogee/perigee can differ appreciably from mission references even when speed agrees.

See [the physics review](docs/physics-review.md), [the calibration report](docs/calibration-report.md), and [the data schema](src/data/schema.md).

Physics references: NASA's [relative-velocity drag explanation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/factors-that-affect-drag/) and [orbital mechanics overview](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-3/). Historical references remain attached to each preset.

## Verification

```sh
npm install
npm test
npm run test:browser
npm run format:check
npm run calibration:report
```

`npm test` checks finite values, fuel monotonicity, frame/velocity consistency, launch direction, staging gaps, bounded attitude slew, S-IVB attitude and parking orbit, interpolation across the dateline, and conservation of vacuum orbital energy/angular momentum over three revolutions.

The browser check starts its own local server. On Windows it uses installed Edge; elsewhere install Chromium with `npx playwright install chromium`. Set `PLAYWRIGHT_CHANNEL` to test another installed Chromium browser. It checks all missions, pause/reset/scrub, actual audio output and mute controls, camera and quality controls, console errors, and layouts at 320, 390, 768, 1024, 1366, and 1920 pixels. Screenshots are saved under the ignored `.artifacts/` directory. This does not claim device-level Safari/Firefox validation.

## Project map

- `src/simulation/flightMath.js`: vector math, RK4 integration, orbit elements.
- `src/simulation/trajectory.js`: stages, forces, guidance, mission samples.
- `src/simulation/playback.js`: binary search and interpolation.
- `src/scene/threeScene.js`: models, Earth, lighting, cameras, and trails.
- `src/audio/launchAudio.js`: procedural Web Audio effects and music; no audio asset downloads.
- `src/ui/`: telemetry formatting and charts.
- `src/app.js`: playback, mission selection, and UI events.
- `scripts/`: static server, physics checks, browser checks, and calibration tools.

MIT License.
