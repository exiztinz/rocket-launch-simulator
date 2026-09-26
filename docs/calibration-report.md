# Calibration Report

Generated: 2026-09-26T23:45:41.626Z

## Before/After Simulation Deltas

| Mission | Delta Apogee (m) | Delta Max Velocity (m/s) | Delta Max Accel (m/s^2) | Delta MECO Time (s) | Delta Stage Sep Time (s) |
|---|---:|---:|---:|---:|---:|
| falcon-9-starlink | -6469191 | -5757.7 | -174.96 | 0.0 | 0.0 |
| space-shuttle-sts-1 | -42160 | 1432.2 | -28.95 | 0.0 | 0.0 |
| saturn-v-apollo-11 | -7578923 | -4648.8 | -29.31 | -7.0 | -6.0 |

## Historical Milestone Error

| Mission | Confidence | Sim MECO (s) | Hist MECO (s) | MECO Error % | Sim Stage Sep (s) | Hist Stage Sep (s) | Stage Sep Error % | Sim Orbit Alt (m) | Hist Orbit Alt (m) | Orbit Alt Error % | Sim Orbit Vel (m/s) | Hist Orbit Vel (m/s) | Orbit Vel Error % |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| falcon-9-starlink | medium | 162.0 | 162.0 | 0.00 | 165.0 | 165.0 | 0.00 | 440007 | 440000 | 0.00 | 7647.4 | 7600.0 | 0.62 |
| space-shuttle-sts-1 | medium | 514.0 | 514.0 | 0.00 | 124.0 | 124.0 | 0.00 | 119987 | 120000 | -0.01 | 7826.9 | 7800.0 | 0.34 |
| saturn-v-apollo-11 | high | 161.0 | 161.0 | 0.00 | 162.0 | 162.0 | 0.00 | 190000 | 190000 | -0.00 | 7792.4 | 7800.0 | -0.10 |

## Source Notes

### Saturn V - Apollo 11
- Confidence: high
- Stage burn timing and staging sequence are sourced from Apollo 11 launch timelines.
- Stage masses are stack-level approximations constrained to preserve continuity in an educational model.
- Thrust and mass-flow profiles are inferred piecewise approximations of known throttle/tailoff behavior.
- Pitch-rate-limited guidance and final-stage throttle target an approximate insertion state. Throttle reduces propellant consumption; remaining fuel is retained during coast. This combines insertion maneuvers into one ascent abstraction, not an exact historical guidance replay.
- Source: https://www.nasa.gov/mission_pages/apollo/missions/apollo11.html
- Source: https://history.nasa.gov/SP-4029/Apollo_11a_Saturn_V.htm
- Source: https://history.nasa.gov/afj/ap11fj/01launch.html

### Space Shuttle - STS-1
- Confidence: medium
- Major ascent milestones (SRB sep and MECO timing) are sourced from NASA mission chronologies.
- Integrated stack masses are approximated for a two-stage educational abstraction.
- Piecewise profile captures throttle bucket and end-of-burn tailoff behavior heuristically.
- Pitch-rate-limited guidance and final-stage throttle target an approximate insertion state. Throttle reduces propellant consumption; remaining fuel is retained during coast. This combines insertion maneuvers into one ascent abstraction, not an exact historical guidance replay.
- Source: https://www.nasa.gov/mission_pages/shuttle/shuttlemissions/archives/sts-1.html
- Source: https://www.nasa.gov/reference/space-shuttle/
- Source: https://science.ksc.nasa.gov/shuttle/missions/sts-1/mission-sts-1.html

### Falcon 9 - Starlink Class
- Confidence: medium
- Mission timing is based on a representative Starlink-class Falcon 9 ascent profile.
- Second-stage depletion state is inferred to preserve realistic mass ratio and continuity.
- Throttle and flow profiles are inferred from public webcast timing patterns and technical summaries.
- Pitch-rate-limited guidance and final-stage throttle target an approximate insertion state. Throttle reduces propellant consumption; remaining fuel is retained during coast. This combines insertion maneuvers into one ascent abstraction, not an exact historical guidance replay.
- The single-burn model uses a representative 440 km insertion reference. Separate real-world parking-orbit, coast and circularization burns are not modeled.
- Source: https://www.spacex.com/launches/
- Source: https://www.faa.gov/space/licensing
- Source: https://everydayastronaut.com/falcon-9-block-5/
