// SI units; Earth-centered inertial (ECI), with +Z through the north pole.
export const EARTH_RADIUS_M = 6371000;
export const EARTH_MU = 3.986004418e14;
export const EARTH_RATE = 7.2921159e-5;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const scale = (v, k) => v.map((x) => x * k);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const length = (v) => Math.hypot(...v);
export const unit = (v) => scale(v, 1 / (length(v) || 1));
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
export const asObject = ([x, y, z]) => ({ x, y, z });
export const rotateZ = ([x, y, z], a) => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
  z
];
export const atmosphereVelocity = ([x, y]) => [-EARTH_RATE * y, EARTH_RATE * x, 0];
export const gravity = (r) => scale(r, -EARTH_MU / length(r) ** 3);

// Fourth-order integration avoids the energy drift of Euler orbital coasting.
export function integrateRK4(r, v, dt, acceleration) {
  const a1 = acceleration(r, v);
  const v2 = add(v, scale(a1, dt / 2));
  const a2 = acceleration(add(r, scale(v, dt / 2)), v2);
  const v3 = add(v, scale(a2, dt / 2));
  const a3 = acceleration(add(r, scale(v2, dt / 2)), v3);
  const v4 = add(v, scale(a3, dt));
  const a4 = acceleration(add(r, scale(v3, dt)), v4);
  const weighted = (a, b, c, d) => scale(add(add(a, scale(b, 2)), add(scale(c, 2), d)), dt / 6);
  return { r: add(r, weighted(v, v2, v3, v4)), v: add(v, weighted(a1, a2, a3, a4)) };
}

export function orbitalElements(r, v) {
  const radius = length(r);
  const energy = dot(v, v) / 2 - EARTH_MU / radius;
  const h = cross(r, v);
  const eccentricity = length(add(scale(cross(v, h), 1 / EARTH_MU), scale(r, -1 / radius)));
  const p = dot(h, h) / EARTH_MU;
  return {
    specificEnergy: energy,
    perigeeM: p / (1 + eccentricity) - EARTH_RADIUS_M,
    apogeeM: energy < 0 ? p / Math.max(1e-12, 1 - eccentricity) - EARTH_RADIUS_M : Infinity,
    inclinationDeg: (Math.acos(Math.max(-1, Math.min(1, h[2] / (length(h) || 1)))) * 180) / Math.PI
  };
}
