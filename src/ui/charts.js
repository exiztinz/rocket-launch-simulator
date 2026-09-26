import { sampleAtTime } from '../simulation/playback.js';

export class TelemetryCharts {
  constructor(config) {
    const cursor = {
      id: 'playhead',
      afterDraw(chart) {
        if (!chart.chartArea) return;
        const x = chart.scales.x.getPixelForValue(chart.$time || 0);
        const { top, bottom, left, right } = chart.chartArea;
        if (x < left || x > right) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.strokeStyle = '#f8ba70';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        ctx.restore();
      }
    };
    this.series = [
      {
        id: config.altitudeCanvasId,
        label: 'Altitude (km)',
        color: '#75dbe8',
        value: (s) => s.altitudeM / 1000
      },
      {
        id: config.velocityCanvasId,
        label: 'Inertial speed (km/s)',
        color: '#91dbb0',
        value: (s) => s.velocityMps / 1000
      },
      {
        id: config.accelCanvasId,
        label: 'Acceleration (m/s²)',
        color: '#f8ba70',
        value: (s) => s.totalAccelerationMps2
      }
    ].map((series) => ({
      ...series,
      chart: new Chart(document.getElementById(series.id), {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Modeled flight',
              data: [],
              borderColor: series.color + '35',
              borderWidth: 1,
              pointRadius: 0,
              fill: false
            },
            {
              label: series.label,
              data: [],
              borderColor: series.color,
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
              backgroundColor: series.color + '0c'
            },
            {
              label: 'Mission events',
              data: [],
              showLine: false,
              pointRadius: 3,
              pointHoverRadius: 6,
              pointBackgroundColor: '#f8ba70',
              pointBorderColor: '#101824'
            }
          ]
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          parsing: false,
          normalized: true,
          interaction: { mode: 'nearest', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              filter: (item) => item.datasetIndex !== 0,
              backgroundColor: '#172230',
              padding: 10,
              callbacks: {
                title: (items) => `T+ ${Number(items[0]?.parsed.x || 0).toFixed(1)} s`,
                label: (item) => item.raw.label || `${series.label}: ${item.parsed.y.toFixed(2)}`
              }
            }
          },
          scales: {
            x: {
              type: 'linear',
              min: 0,
              ticks: {
                color: '#8b9aad',
                maxTicksLimit: 5,
                font: { size: 10 },
                callback: (v) => v + ' s'
              },
              grid: { color: '#25303f88' }
            },
            y: {
              ticks: { color: '#8b9aad', maxTicksLimit: 4, font: { size: 10 } },
              grid: { color: '#25303f88' },
              beginAtZero: true
            }
          }
        },
        plugins: [cursor]
      })
    }));
  }
  setTrajectory(trajectory) {
    this.trajectory = trajectory;
    for (const series of this.series) {
      series.points = trajectory.samples
        .filter((s, i) => i % 5 === 0 || i === trajectory.samples.length - 1)
        .map((s) => ({ x: s.tSec, y: series.value(s) }));
      series.chart.data.datasets[0].data = series.points;
      series.chart.data.datasets[2].data = trajectory.events.map((e) => ({
        x: e.timeSec,
        y: series.value(sampleAtTime(trajectory.samples, e.timeSec)),
        label: e.label
      }));
      series.chart.options.scales.x.max = trajectory.stats.durationSec;
    }
    this.update(0);
  }
  update(time) {
    for (const { chart, points = [] } of this.series) {
      let lo = 0,
        hi = points.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].x <= time) lo = mid + 1;
        else hi = mid;
      }
      chart.data.datasets[1].data = points.slice(0, lo);
      chart.$time = time;
      chart.update('none');
    }
  }
}
