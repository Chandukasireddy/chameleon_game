// ═══════════════════════════════════════════════
// ⏱️ GAME TIMER — Countdown with callbacks
// ═══════════════════════════════════════════════

export class GameTimer {
  constructor() {
    this.totalSeconds = 60;
    this.remaining = 0;
    this.running = false;
    this.intervalId = null;
    this.startTime = 0;
    this.elapsed = 0;

    // Callbacks
    this.onTick = null;      // (remaining, total) => void
    this.onComplete = null;  // () => void
    this.onWarning = null;   // () => void — called at 10s remaining
    this.onDanger = null;    // () => void — called at 5s remaining

    this._warnedAt10 = false;
    this._warnedAt5 = false;
  }

  /**
   * Start the countdown
   * @param {number} seconds — total seconds
   */
  start(seconds) {
    this.stop();
    this.totalSeconds = seconds;
    this.remaining = seconds;
    this.running = true;
    this.startTime = performance.now();
    this.elapsed = 0;
    this._warnedAt10 = false;
    this._warnedAt5 = false;

    this._tick();

    this.intervalId = setInterval(() => this._tick(), 100); // update 10x/sec for smooth ring
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resume() {
    if (this.running || this.remaining <= 0) return;
    this.running = true;
    this.startTime = performance.now() - (this.totalSeconds - this.remaining) * 1000;
    this.intervalId = setInterval(() => this._tick(), 100);
  }

  stop() {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getTimeLeft() {
    return Math.max(0, this.remaining);
  }

  getElapsed() {
    return this.totalSeconds - this.remaining;
  }

  getProgress() {
    if (this.totalSeconds === 0) return 0;
    return 1 - (this.remaining / this.totalSeconds);
  }

  _tick() {
    if (!this.running) return;

    const now = performance.now();
    const elapsedMs = now - this.startTime;
    this.remaining = Math.max(0, this.totalSeconds - elapsedMs / 1000);

    // Fire tick callback
    if (this.onTick) {
      this.onTick(this.remaining, this.totalSeconds);
    }

    // Warning thresholds
    if (this.remaining <= 10 && !this._warnedAt10) {
      this._warnedAt10 = true;
      if (this.onWarning) this.onWarning();
    }
    if (this.remaining <= 5 && !this._warnedAt5) {
      this._warnedAt5 = true;
      if (this.onDanger) this.onDanger();
    }

    // Complete
    if (this.remaining <= 0) {
      this.stop();
      if (this.onComplete) this.onComplete();
    }
  }
}
