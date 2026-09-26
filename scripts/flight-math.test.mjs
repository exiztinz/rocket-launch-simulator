import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTrajectory } from '../src/simulation/trajectory.js';
import { sampleAtTime } from '../src/simulation/playback.js';
import {
  EARTH_RADIUS_M,
  EARTH_MU,
  EARTH_RATE,
  length,
  dot,
  cross,
  gravity,
  integrateRK4,
  orbitalElements,
  rotateZ
} from '../src/simulation/flightMath.js';

const presets = JSON.parse(
  fs.readFileSync(new URL('../src/data/launchPresets.json', import.meta.url), 'utf8')
);
const array = (v) => [v.x, v.y, v.z];
const close = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

test('Vacuum orbit conserves energy and angular momentum across three revolutions', () => {
  let r = [EARTH_RADIUS_M + 400000, 0, 0];
  let v = [0, Math.sqrt(EARTH_MU / length(r)), 0];
  const original = orbitalElements(r, v);
  const momentum = length(cross(r, v));
  const period = 2 * Math.PI * Math.sqrt(length(r) ** 3 / EARTH_MU);
  for (let t = 0; t < period * 3; t += 5) ({ r, v } = integrateRK4(r, v, 5, gravity));
  close(orbitalElements(r, v).specificEnergy / original.specificEnergy, 1, 1e-8, 'specific energy');
  close(length(cross(r, v)) / momentum, 1, 1e-8, 'angular momentum');
  close(length(r), EARTH_RADIUS_M + 400000, 0.1, 'circular altitude');
});

for (const preset of presets)
  test(`${preset.id}: coherent frames, eastward ascent, finite attitude, staging and coast`, () => {
    const trajectory = buildTrajectory(preset);
    const { samples, stages } = trajectory;
    const first = samples[0];
    close(first.airspeedMps, 0, 1e-10, 'pad airspeed');
    close(
      first.velocityMps,
      EARTH_RATE * EARTH_RADIUS_M * Math.cos((preset.location.lat * Math.PI) / 180),
      1e-8,
      'Earth rotation retained'
    );
    close(first.lonDeg, preset.location.lon, 1e-8, 'launch longitude');
    assert.ok(sampleAtTime(samples, 120).lonDeg > first.lonDeg, 'Launch must travel east');
    let maxAttitudeRate = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i],
        r = array(s.posEci),
        v = array(s.velEci);
      assert.ok([...r, ...v, ...array(s.attitudeEci)].every(Number.isFinite));
      close(length(r) - EARTH_RADIUS_M, s.altitudeM, 1e-6, 'position altitude');
      close(length(v), s.velocityMps, 1e-6, 'inertial speed');
      close(length(array(s.attitudeEci)), 1, 1e-10, 'unit attitude');
      const fixed = rotateZ(r, -EARTH_RATE * s.tSec);
      fixed.forEach((value, axis) =>
        close(value, array(s.posEcef)[axis], 1e-7, 'ECI/ECEF transform')
      );
      if (i > 0) {
        assert.ok(s.fuelMassKg <= samples[i - 1].fuelMassKg + 1e-6, 'propellant cannot increase');
        if (s.engineOn && samples[i - 1].engineOn) {
          const angle = Math.acos(
            Math.max(-1, Math.min(1, dot(array(s.attitudeEci), array(samples[i - 1].attitudeEci))))
          );
          maxAttitudeRate = Math.max(
            maxAttitudeRate,
            ((angle / (s.tSec - samples[i - 1].tSec)) * 180) / Math.PI
          );
        }
      }
      if (i > 0 && i < samples.length - 1 && s.tSec > 2) {
        const before = array(samples[i - 1].posEci),
          after = array(samples[i + 1].posEci);
        const derivative = after.map(
          (value, axis) => (value - before[axis]) / (samples[i + 1].tSec - samples[i - 1].tSec)
        );
        close(
          length(derivative.map((value, axis) => value - v[axis])),
          0,
          2,
          'position/velocity agreement'
        );
      }
      if (s.tSec >= trajectory.stats.burnoutSec) {
        assert.equal(s.engineOn, false);
        assert.equal(s.thrustRatio, 0);
      }
    }
    assert.ok(maxAttitudeRate < 2, `Unphysical attitude discontinuity: ${maxAttitudeRate} deg/s`);
    for (const stage of stages.slice(0, -1)) {
      if (stage.separationSec > stage.endSec) {
        const s = sampleAtTime(samples, (stage.endSec + stage.separationSec) / 2);
        assert.equal(s.engineOn, false);
        assert.equal(s.stageIndex, stage.index);
      }
    }
    assert.equal(
      samples.at(-1).impacted,
      false,
      'Supported preset should survive its modeled coast'
    );
    const cutoff = sampleAtTime(samples, trajectory.stats.burnoutSec);
    const reference = preset.modelHints.historicalMilestones;
    close(cutoff.velocityMps / reference.orbitInsertionVelocityMps, 1, 0.02, 'insertion speed');
    assert.ok(cutoff.fuelMassKg > 0, 'Throttling must retain unused propellant');
    close(samples.at(-1).fuelMassKg, cutoff.fuelMassKg, 1e-6, 'coast cannot consume propellant');
    close(cutoff.massKg - stages.at(-1).endMassKg, cutoff.fuelMassKg, 1e-6, 'fuel stays aboard');
    assert.ok(
      trajectory.events.every((e) => e.timeSec <= trajectory.stats.durationSec),
      'No events beyond replay end'
    );
    assert.ok(
      !trajectory.events.some((e) => /landing|deorbit/i.test(e.label)),
      'Do not invent a return mission'
    );
  });

test('S-IVB settles along the local horizon without pitching up to rescue a falling trajectory', () => {
  const trajectory = buildTrajectory(presets.find((p) => p.id === 'saturn-v-apollo-11'));
  const finalStage = trajectory.stages.at(-1);
  const powered = trajectory.samples.filter((s) => s.stageIndex === finalStage.index && s.engineOn);
  for (const s of powered) {
    const elevation =
      (Math.asin(dot(array(s.attitudeEci), array(s.posEci)) / length(array(s.posEci))) * 180) /
      Math.PI;
    assert.ok(elevation < 32 && elevation > -5, `S-IVB elevation ${elevation} at ${s.tSec}s`);
    if (s.tSec > finalStage.startSec + 60)
      assert.ok(elevation < 16, `S-IVB should settle near horizontal: ${elevation}`);
    close(s.altitudeM, 190000, 1000, 'S-IVB maintains insertion altitude');
  }
  const cutoff = sampleAtTime(trajectory.samples, trajectory.stats.burnoutSec);
  close(cutoff.perigeeM, 183000, 10000, 'viable parking orbit');
});

test('Insufficient upper-stage thrust produces an impact rather than an invented orbit or landing', () => {
  const weak = structuredClone(presets.at(-1));
  weak.stages.at(-1).avgThrustN *= 0.15;
  const trajectory = buildTrajectory(weak);
  const final = trajectory.samples.at(-1);
  assert.equal(final.impacted, true);
  assert.equal(final.landed, false);
  assert.equal(final.engineOn, false);
  assert.equal(final.altitudeM, 0);
  assert.ok(final.velocityMps > 0, 'Report the impact speed, not a fabricated safe landing');
});

test('Playback interpolation wraps the dateline and switches stage state at the actual boundary', () => {
  const samples = [
    {
      tSec: 0,
      lonDeg: 179.9,
      stageIndex: 0,
      engineOn: true,
      thrustRatio: 1,
      posEci: { x: 1, y: 0, z: 0 }
    },
    {
      tSec: 1,
      lonDeg: -179.9,
      stageIndex: 1,
      engineOn: false,
      thrustRatio: 0,
      posEci: { x: 2, y: 1, z: 0 }
    }
  ];
  const s = sampleAtTime(samples, 0.75);
  assert.ok(Math.abs(s.lonDeg) > 179, 'Must not interpolate across the entire planet');
  assert.equal(s.stageIndex, 0);
  assert.equal(s.engineOn, true);
  assert.equal(s.thrustRatio, 1);
  assert.equal(sampleAtTime(samples, 1).stageIndex, 1);
  assert.equal(sampleAtTime(samples, -1), samples[0]);
  assert.equal(sampleAtTime(samples, 100), samples[1]);
});
