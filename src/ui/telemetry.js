const number = (value, fraction = 1) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: fraction,
    minimumFractionDigits: fraction
  }).format(value);
export class TelemetryPanel {
  constructor() {
    this.fields = Object.fromEntries(
      [
        'Altitude',
        'Velocity',
        'AccelerationTotal',
        'Acceleration',
        'Fuel',
        'Airspeed',
        'Stage',
        'Time'
      ].map((key) => [key, document.getElementById('telemetry' + key)])
    );
  }
  update(sample) {
    const f = this.fields;
    f.Altitude.textContent =
      sample.altitudeM < 1000
        ? `${number(sample.altitudeM, 0)} m`
        : `${number(sample.altitudeM / 1000)} km`;
    f.Velocity.textContent =
      sample.velocityMps < 1000
        ? `${number(sample.velocityMps, 0)} m/s`
        : `${number(sample.velocityMps / 1000, 2)} km/s`;
    f.AccelerationTotal.textContent = `${number(sample.totalAccelerationMps2)} m/s²`;
    f.Acceleration.textContent = `${number(sample.accelerationMps2)} m/s²`;
    f.Fuel.textContent =
      sample.fuelMassKg >= 1000
        ? `${number(sample.fuelMassKg / 1000)} t`
        : `${number(sample.fuelMassKg, 0)} kg`;
    f.Airspeed.textContent =
      sample.airspeedMps >= 1000
        ? `${number(sample.airspeedMps / 1000, 2)} km/s`
        : `${number(sample.airspeedMps, 0)} m/s`;
    f.Stage.textContent = sample.tSec === 0 ? 'On the pad' : sample.stageName;
    f.Time.textContent = `${number(sample.tSec)} s`;
  }
}
