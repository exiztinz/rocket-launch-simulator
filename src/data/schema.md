# Launch Preset Schema

Each launch preset follows this normalized shape:

- id: unique preset id
- name: display title
- provider: launch organization
- vehicle: launch vehicle
- mission: mission label
- launchDate: ISO date string
- destination: mission destination summary
- orbitClass: target orbit class
- source: source label array
- sourceUrls: reference URL array
- historicalConfidence: high | medium | low confidence marker
- historicalNotes: array of known vs inferred modeling notes
- location: object with site, lat, lon

stages: array of

- name: stage label
- burnTimeSec: stage burn duration
- avgThrustN: average thrust estimate
- startMassKg: mass at stage ignition
- endMassKg: nominal mass after a full scheduled burn; final-stage guidance can retain propellant above this value
- cd: effective drag coefficient for that phase
- areaM2: effective cross-sectional area
- thrustProfile: optional array of { untilSec, scale } piecewise thrust scaling
- massFlowProfile: optional array of { untilSec, scale } piecewise mass-flow scaling
- events: array of { timeSec, label }

modelHints:

- pitchProgramSec: seconds to begin major pitch-over
- maxPitchDeg: maximum pitch angle from vertical heuristic
- targetApogeeM: target apogee estimate (meters)
- targetPerigeeM: target perigee estimate (meters)
- peakAltitudeM: approximate peak altitude for UI context
- coastDurationSec: post-burn coast duration used by the replay
- historicalMilestones: reference milestone values used in calibration reporting
- targetInclinationDeg: optional inclination used to choose the launch plane
- launchAzimuthDeg: optional heading clockwise from north; otherwise derived from site latitude and target inclination

The timeline honors separation events after cutoff before starting the next stage.
Final-stage guidance limits insertion speed by throttling thrust and propellant flow together.
`returnsToEarth` / `returnProfile` are no longer used: no atmospheric entry or landing model is implemented.

Trajectory samples include SI-unit `posEci`, `velEci`, `posEcef`, `velEcef`, a unit `attitudeEci`,
inertial speed, air-relative speed, mass, remaining propellant, dynamic pressure, and osculating orbit elements.
ECI uses +Z north; ECEF rotates at Earth's sidereal rate. The scene maps ECI (x,y,z) to Three.js (x,z,-y).
`totalAccelerationMps2` is inertial acceleration including gravity; `accelerationMps2` is the
derivative of radial speed and includes the changing local vertical. Neither is an accelerometer reading.
