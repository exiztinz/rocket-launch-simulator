// Original, procedural mission soundscape. No downloads or audio autoplay.
const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
const CHORDS = [
  [50, 53, 57, 64],
  [46, 53, 57, 60],
  [48, 55, 60, 64],
  [43, 50, 55, 62]
];

export class LaunchAudio {
  constructor() {
    this.effectsEnabled = true;
    this.musicEnabled = true;
    this.volume = 0.55;
    this.session = null;
    this.previous = null;
  }

  async unlock() {
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.context = new AudioContext();
        const ctx = this.context;
        this.master = ctx.createGain();
        this.master.gain.value = this.volume;
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -16;
        limiter.knee.value = 12;
        limiter.ratio.value = 6;
        this.master.connect(limiter).connect(ctx.destination);
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      await this.context.resume();
      return this.context.state === 'running';
    } catch {
      // Audio is optional; unsupported devices can still run the flight.
      return false;
    }
  }

  setOptions({ effects = this.effectsEnabled, music = this.musicEnabled, volume = this.volume }) {
    this.effectsEnabled = effects;
    this.musicEnabled = music;
    this.volume = Math.max(0, Math.min(1, volume));
    if (!this.context) return;
    this.ramp(this.master.gain, this.volume);
    if (this.session) {
      this.ramp(this.session.effects.gain, effects ? 1 : 0);
      this.ramp(this.session.music.gain, music ? 0.65 : 0);
    }
  }

  ramp(param, value, decay = 0.08) {
    param.setTargetAtTime(value, this.context.currentTime, decay);
  }

  track(source, nodes = []) {
    const sources = this.session.sources;
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
    };
    return source;
  }

  start() {
    const ctx = this.context;
    const gate = ctx.createGain();
    gate.gain.value = 0;
    gate.connect(this.master);
    const effects = ctx.createGain();
    const music = ctx.createGain();
    effects.gain.value = this.effectsEnabled ? 1 : 0;
    music.gain.value = this.musicEnabled ? 0.65 : 0;
    effects.connect(gate);
    music.connect(gate);
    const delay = ctx.createDelay(1);
    const feedback = ctx.createGain();
    delay.delayTime.value = 0.375;
    feedback.gain.value = 0.28;
    delay.connect(feedback).connect(delay);
    delay.connect(music);
    this.session = {
      gate,
      effects,
      music,
      delay,
      feedback,
      sources: new Set(),
      nextBeat: ctx.currentTime + 0.03,
      beat: 0
    };
    this.ramp(gate.gain, 1);

    const rumble = ctx.createGain();
    rumble.gain.value = 0;
    rumble.connect(effects);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    filter.Q.value = 0.7;
    const noise = this.track(ctx.createBufferSource(), [filter]);
    noise.buffer = this.noise;
    noise.loop = true;
    noise.connect(filter).connect(rumble);
    noise.start();
    const bass = this.track(ctx.createOscillator());
    const bassGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.value = 34;
    bassGain.gain.value = 0.14;
    bass.connect(bassGain).connect(rumble);
    bass.start();
    Object.assign(this.session, { rumble, filter, bass, bassGain });
  }

  stop({ reset = false } = {}) {
    if (this.session) {
      const session = this.session;
      const now = this.context.currentTime;
      session.gate.gain.cancelScheduledValues(now);
      session.gate.gain.setTargetAtTime(0, now, 0.025);
      for (const source of session.sources) source.stop(now + 0.15);
      // Also disconnect the feedback loop; it must not survive a replay.
      setTimeout(() => {
        for (const key of ['gate', 'effects', 'music', 'delay', 'feedback', 'rumble', 'bassGain'])
          session[key].disconnect();
      }, 200);
      this.session = null;
    }
    if (reset) this.previous = null;
  }

  tone(
    hz,
    when,
    duration,
    level,
    bus,
    { type = 'sine', attack = 0.015, pan = 0, endHz = hz } = {}
  ) {
    const ctx = this.context;
    const gain = ctx.createGain();
    const stereo = ctx.createStereoPanner();
    stereo.pan.value = pan;
    const oscillator = this.track(ctx.createOscillator(), [gain, stereo]);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(hz, when);
    oscillator.frequency.exponentialRampToValueAtTime(endHz, when + duration);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain).connect(stereo).connect(bus);
    if (bus === this.session.music) stereo.connect(this.session.delay);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.05);
  }

  burst(duration, level, cutoff) {
    const ctx = this.context;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    const noise = this.track(ctx.createBufferSource(), [filter, gain]);
    noise.buffer = this.noise;
    noise.connect(filter).connect(gain).connect(this.session.effects);
    noise.start();
    noise.stop(ctx.currentTime + duration);
  }

  score() {
    const s = this.session;
    // The score keeps its musical tempo at every simulation playback speed.
    while (s.nextBeat < this.context.currentTime + 0.15) {
      const chord = CHORDS[Math.floor(s.beat / 16) % CHORDS.length];
      if (s.beat % 16 === 0) {
        chord.forEach((note, i) => {
          this.tone(frequency(note), s.nextBeat, 6.8, 0.065, s.music, {
            attack: 1.1,
            pan: (i - 1.5) * 0.35
          });
        });
      }
      const note = chord[[0, 2, 1, 3, 2, 1, 3, 2][s.beat % 8]] + 12;
      this.tone(frequency(note), s.nextBeat, 1.4, 0.035, s.music, {
        type: 'triangle',
        pan: s.beat % 2 ? 0.35 : -0.35
      });
      s.beat++;
      s.nextBeat += 0.375;
    }
  }

  update({ playing, countdown, sample }) {
    const current = {
      countdown: Math.ceil(countdown),
      stage: sample.stageIndex,
      engine: countdown <= 0 && sample.engineOn,
      time: sample.tSec
    };
    if (!playing) {
      this.stop();
      this.previous = current;
      return;
    }
    if (this.context?.state !== 'running') return;
    if (!this.session) this.start();
    const s = this.session;
    const now = this.context.currentTime;
    if (current.countdown > 0 && current.countdown !== this.previous?.countdown)
      this.tone(880, now, 0.2, 0.16, s.effects);
    if (this.previous?.countdown > 0 && current.countdown === 0) {
      this.burst(2.8, 1.3, 1800);
      this.tone(80, now, 2, 0.28, s.effects, { endHz: 28 });
    } else if (this.previous && current.stage !== this.previous.stage) {
      this.burst(0.65, 0.7, 2600);
      this.tone(110, now, 0.6, 0.2, s.effects, { endHz: 40 });
    } else if (this.previous?.engine && !current.engine) {
      [523.25, 783.99].forEach((hz, i) => this.tone(hz, now + i * 0.18, 1.1, 0.07, s.effects));
    }
    const power = current.engine ? Math.sqrt(sample.thrustRatio) : 0;
    const stageLevel = [1, 0.65, 0.42][Math.min(2, current.stage)];
    this.ramp(s.rumble.gain, power * stageLevel * 0.9, 0.22);
    this.ramp(s.filter.frequency, 280 + (power * 950) / (1 + sample.altitudeM / 35000), 0.25);
    this.ramp(s.bass.frequency, 30 + power * 16, 0.25);
    this.score();
    this.previous = current;
  }
}
