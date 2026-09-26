// Binary lookup keeps scrubbing and playback independent of mission length.
export function sampleAtTime(samples, timeSec) {
  if (!samples.length) return null;
  if (timeSec <= samples[0].tSec) return samples[0];
  if (timeSec >= samples.at(-1).tSec) return samples.at(-1);
  let lo = 0,
    hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].tSec <= timeSec) lo = mid;
    else hi = mid;
  }
  const a = samples[lo],
    b = samples[hi],
    f = (timeSec - a.tSec) / (b.tSec - a.tSec);
  const result = { ...a, tSec: timeSec };
  const discrete = new Set(['stageIndex', 'engineOn', 'landed', 'impacted']);
  for (const key of Object.keys(a)) {
    if (discrete.has(key)) continue;
    if (typeof a[key] === 'number' && Number.isFinite(a[key]) && Number.isFinite(b[key])) {
      const delta = key === 'lonDeg' ? ((b[key] - a[key] + 540) % 360) - 180 : b[key] - a[key];
      result[key] = a[key] + delta * f;
      if (key === 'lonDeg') result[key] = ((result[key] + 540) % 360) - 180;
    } else if (a[key] && typeof a[key] === 'object' && 'x' in a[key]) {
      result[key] = Object.fromEntries(
        ['x', 'y', 'z'].map((axis) => [axis, a[key][axis] + (b[key][axis] - a[key][axis]) * f])
      );
    }
  }
  // An engine cutoff is a discrete event, not a half-sample blend.
  if (a.engineOn !== b.engineOn) result.thrustRatio = a.thrustRatio;
  return result;
}
