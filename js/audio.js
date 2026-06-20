// ═══════════════════════════════════════════════
// 🔊 AUDIO MANAGER — Procedural Sound Effects
// Uses Web Audio API for all sounds (no external files)
// ═══════════════════════════════════════════════

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.volume = 0.5;
    this.ambientNode = null;
    this.ambientGain = null;
    this.initialized = false;
  }

  /** Must be called on a user gesture (click/keypress) */
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  /** Play a named sound effect */
  play(name) {
    if (!this.initialized || this.muted) return;
    const sounds = {
      brush:     () => this._playNoise(0.03, 0.05, 2000, 4000),
      click:     () => this._playTone(800, 0.05, 0.03, 'sine'),
      hit:       () => this._playSuccessChord(),
      miss:      () => this._playTone(200, 0.15, 0.1, 'sawtooth'),
      victory:   () => this._playVictoryJingle(),
      defeat:    () => this._playDefeatJingle(),
      tick:      () => this._playTone(1000, 0.02, 0.02, 'sine'),
      heartbeat: () => this._playHeartbeat(),
      lock:      () => this._playLock(),
      whoosh:    () => this._playWhoosh(),
      pop:       () => this._playTone(600, 0.06, 0.04, 'sine'),
      countdown: () => this._playTone(440, 0.1, 0.15, 'sine'),
      countdownGo: () => this._playTone(880, 0.15, 0.25, 'sine'),
    };
    const fn = sounds[name];
    if (fn) fn();
  }

  // ─── Internal Sound Generators ───

  _playTone(freq, attack, duration, type = 'sine') {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + attack + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + attack + duration + 0.01);
  }

  _playNoise(attack, duration, lowFreq, highFreq) {
    const bufferSize = this.ctx.sampleRate * (attack + duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (lowFreq + highFreq) / 2;
    filter.Q.value = 0.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + attack + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(this.ctx.currentTime);
    source.stop(this.ctx.currentTime + attack + duration + 0.01);
  }

  _playSuccessChord() {
    const t = this.ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, t + i * 0.08 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.4);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.5);
    });
  }

  _playVictoryJingle() {
    const notes = [523, 587, 659, 784, 880, 1047];
    const t = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  _playDefeatJingle() {
    const notes = [440, 415, 392, 349];
    const t = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const start = t + i * 0.2;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  _playHeartbeat() {
    const t = this.ctx.currentTime;
    [0, 0.15].forEach(offset => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 60;
      gain.gain.setValueAtTime(0, t + offset);
      gain.gain.linearRampToValueAtTime(0.4, t + offset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.2);
    });
  }

  _playLock() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(400, t + 0.1);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  _playWhoosh() {
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(2000, this.ctx.currentTime + 0.15);
    filter.frequency.linearRampToValueAtTime(500, this.ctx.currentTime + 0.3);
    filter.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(this.ctx.currentTime);
  }

  /** Start ambient background sound for a map */
  startAmbient(mapName) {
    this.stopAmbient();
    if (!this.initialized || this.muted) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0;
    this.ambientGain.connect(this.masterGain);

    // Create a gentle ambient drone based on map
    const configs = {
      backrooms:  { freq: 60,  type: 'sine',     filterFreq: 200,  vol: 0.08 },
      garden:     { freq: 120, type: 'sine',     filterFreq: 400,  vol: 0.05 },
      office:     { freq: 100, type: 'sine',     filterFreq: 150,  vol: 0.04 },
      gallery:    { freq: 80,  type: 'sine',     filterFreq: 300,  vol: 0.03 },
      sewer:      { freq: 50,  type: 'triangle', filterFreq: 180,  vol: 0.07 },
    };
    const cfg = configs[mapName] || configs.backrooms;

    const osc = this.ctx.createOscillator();
    osc.type = cfg.type;
    osc.frequency.value = cfg.freq;

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = cfg.freq * 1.5;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cfg.filterFreq;

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(this.ambientGain);

    osc.start();
    osc2.start();

    // Fade in
    this.ambientGain.gain.setTargetAtTime(cfg.vol, this.ctx.currentTime, 1);

    this.ambientNode = { osc, osc2 };
  }

  stopAmbient() {
    if (this.ambientNode) {
      try {
        if (this.ambientGain) {
          this.ambientGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
        }
        setTimeout(() => {
          try {
            this.ambientNode.osc.stop();
            this.ambientNode.osc2.stop();
          } catch(e) {}
          this.ambientNode = null;
        }, 500);
      } catch(e) {
        this.ambientNode = null;
      }
    }
  }

  destroy() {
    this.stopAmbient();
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
