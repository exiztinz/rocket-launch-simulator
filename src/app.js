import { loadLaunchPresets } from './data/launchData.js';
import { buildTrajectory } from './simulation/trajectory.js';
import { sampleAtTime } from './simulation/playback.js';
import { LaunchScene } from './scene/threeScene.js';
import { TelemetryCharts } from './ui/charts.js';
import { TelemetryPanel } from './ui/telemetry.js';

const $ = (id) => document.getElementById(id);
const state = {
  presets: [],
  trajectory: null,
  time: 0,
  playing: false,
  started: false,
  countdown: 0,
  speed: 1,
  pathIndex: 0,
  lastFrame: 0,
  lastUI: 0
};
let scene, charts, telemetry;
const clock = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function error(message) {
  $('appError').hidden = false;
  $('appError').textContent = message;
}
function updateControls() {
  $('pauseButton').disabled = !state.started;
  $('pauseButton').textContent = state.playing ? 'Pause' : 'Resume';
  $('pauseButton').setAttribute('aria-label', state.playing ? 'Pause playback' : 'Resume playback');
  $('launchButton').disabled = !state.trajectory || state.playing;
  $('launchButton').textContent = state.started ? '\u2197 Replay mission' : '\u2197 Launch mission';
  $('fastForwardButton').textContent = state.speed + '\u00d7';
}
function status(sample) {
  if (state.countdown > 0) return `T-${Math.ceil(state.countdown)}`;
  if (!state.started) return 'READY';
  if (sample.impacted) return 'IMPACT';
  if (state.time >= state.trajectory.stats.durationSec) return 'COMPLETE';
  return state.playing ? (sample.engineOn ? 'POWERED' : 'COAST') : 'PAUSED';
}
function renderTime({ rebuild = false, forceUI = false, snapCamera = false } = {}) {
  if (!state.trajectory) return;
  const { samples, events } = state.trajectory;
  if (rebuild) {
    scene.resetPath();
    state.pathIndex = 0;
  }
  // Trail geometry is appended once per stored half-second, not for interpolated frames.
  while (state.pathIndex < samples.length && samples[state.pathIndex].tSec <= state.time) {
    scene.appendSample(samples[state.pathIndex]);
    state.pathIndex += 5;
  }
  const sample = sampleAtTime(samples, state.time);
  scene.updateFromSample(sample, { snapCamera });
  if (forceUI) {
    telemetry.update(sample);
    charts.update(state.time);
    $('missionClock').textContent = 'T+ ' + clock(state.time);
    $('timeline').value = state.time;
    $('timeline').setAttribute(
      'aria-valuetext',
      `${state.time.toFixed(1)} seconds, ${sample.stageName}`
    );
    $('countdownLabel').textContent = status(sample);
    $('eventLabel').textContent =
      events.findLast((e) => e.timeSec <= state.time)?.label || 'Ready for launch';
  }
}
function reset() {
  state.time = 0;
  state.playing = false;
  state.started = false;
  state.countdown = 0;
  state.speed = 1;
  state.lastFrame = 0;
  renderTime({ rebuild: true, forceUI: true, snapCamera: true });
  updateControls();
}
function selectPreset(id) {
  state.playing = false;
  const preset = state.presets.find((p) => p.id === id);
  if (!preset) return;
  $('missionName').textContent = preset.name;
  $('missionMeta').textContent = `${preset.provider} / ${preset.vehicle} · ${preset.destination}`;
  $('missionOrbit').textContent = preset.destination;
  $('missionLocation').textContent = preset.location.site;
  $('missionDate').textContent = new Date(preset.launchDate + 'T12:00:00Z').toLocaleDateString(
    'en-US',
    { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
  );
  $('missionSource').replaceChildren(
    ...preset.sourceUrls.map((url, i) => {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.textContent = 'Source ' + (i + 1);
      return a;
    })
  );
  if (preset.validation.hasErrors) {
    state.trajectory = null;
    $('launchButton').disabled = true;
    $('timeline').disabled = true;
    error('This mission has invalid input data and cannot launch.');
    return;
  }
  $('appError').hidden = true;
  state.trajectory = buildTrajectory(preset);
  scene.setPreset(preset);
  charts.setTrajectory(state.trajectory);
  $('timeline').max = state.trajectory.stats.durationSec;
  $('timeline').disabled = false;
  $('durationLabel').textContent = clock(state.trajectory.stats.durationSec) + ' TOTAL';
  reset();
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = state.lastFrame ? Math.min(0.1, (now - state.lastFrame) / 1000) : 0;
  state.lastFrame = now;
  if (state.playing && state.trajectory) {
    if (state.countdown > 0) {
      state.countdown = Math.max(0, state.countdown - dt);
      $('countdownLabel').textContent =
        state.countdown > 0 ? `T-${Math.ceil(state.countdown)}` : 'LIFTOFF';
    } else {
      state.time = Math.min(state.trajectory.stats.durationSec, state.time + dt * state.speed);
      const done = state.time >= state.trajectory.stats.durationSec;
      if (done) {
        state.playing = false;
        updateControls();
      }
      const uiDue = now - state.lastUI >= 100 || done;
      renderTime({ forceUI: uiDue });
      if (uiDue) state.lastUI = now;
    }
  }
  scene.render(dt);
}
async function init() {
  scene = new LaunchScene($('sim3dCanvas'));
  charts = new TelemetryCharts({
    altitudeCanvasId: 'altitudeChart',
    velocityCanvasId: 'velocityChart',
    accelCanvasId: 'accelChart'
  });
  telemetry = new TelemetryPanel();
  state.presets = await loadLaunchPresets();
  if (!state.presets.length) throw new Error('No mission presets were found.');
  $('presetSelect').replaceChildren(...state.presets.map((p) => new Option(p.name, p.id)));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('reducedMotionToggle').checked = reduced;
  scene.setReducedMotion(reduced);
  selectPreset(state.presets[0].id);
  $('presetSelect').addEventListener('change', (e) => selectPreset(e.target.value));
  $('launchButton').addEventListener('click', () => {
    reset();
    state.started = true;
    state.playing = true;
    state.countdown = 3;
    updateControls();
  });
  $('resetButton').addEventListener('click', reset);
  $('pauseButton').addEventListener('click', () => {
    if (state.time >= state.trajectory.stats.durationSec) state.time = 0;
    state.playing = !state.playing;
    state.lastFrame = 0;
    renderTime({ forceUI: true, rebuild: state.time === 0 });
    updateControls();
  });
  $('fastForwardButton').addEventListener('click', () => {
    const rates = [1, 4, 8, 32];
    state.speed = rates[(rates.indexOf(state.speed) + 1) % rates.length];
    updateControls();
  });
  $('timeline').addEventListener('input', (e) => {
    const target = Number(e.target.value);
    const backwards = target < state.time;
    state.time = target;
    state.countdown = 0;
    state.started = true;
    state.playing = false;
    renderTime({ rebuild: backwards, forceUI: true, snapCamera: true });
    updateControls();
  });
  $('cameraSelect').addEventListener('change', (e) => {
    scene.setCameraMode(e.target.value);
    $('viewHint').textContent = {
      follow: 'Camera follows the vehicle',
      ground: 'Fixed observer · the vehicle may pass below the horizon',
      orbit: 'Earth overview · cyan line shows the ground-relative flight path',
      free: 'Drag to orbit · scroll or pinch to zoom · right-drag to pan'
    }[e.target.value];
  });
  $('qualitySelect').addEventListener('change', (e) => scene.setQuality(e.target.value));
  $('reducedMotionToggle').addEventListener('change', (e) =>
    scene.setReducedMotion(e.target.checked)
  );
  $('fullscreenButton').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector('.viewport-card').requestFullscreen();
    } catch {
      error(
        'Fullscreen is unavailable in this browser. The flight view still supports all camera modes.'
      );
    }
  });
  $('sim3dCanvas').addEventListener('sceneerror', (e) => {
    state.playing = false;
    updateControls();
    error(e.detail);
  });
  $('sim3dCanvas').addEventListener('scenerestored', () => {
    $('appError').hidden = true;
    renderTime({ forceUI: true });
  });
  document.addEventListener('visibilitychange', () => {
    state.lastFrame = 0;
    if (document.hidden && state.playing) {
      state.playing = false;
      updateControls();
      renderTime({ forceUI: true });
    }
  });
  window.launchAtlasReady = true;
  requestAnimationFrame(animate);
}
init().catch((e) => {
  window.launchAtlasFailed = true;
  console.error(e);
  $('launchButton').disabled = true;
  error('Could not load the flight explorer: ' + e.message);
});
