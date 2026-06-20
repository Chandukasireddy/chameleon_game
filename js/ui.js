// ═══════════════════════════════════════════════
// 🖥️ UI MANAGER — All screen/HUD management
// ═══════════════════════════════════════════════

import { MAP_DATA } from './maps.js';

export class GameUI {
  constructor() {
    // Screens
    this.screens = {
      loading:  document.getElementById('loading-screen'),
      menu:     document.getElementById('menu-screen'),
      hiderIntro: document.getElementById('hider-intro-screen'),
      handoff:  document.getElementById('handoff-screen'),
      countdown: document.getElementById('seeker-countdown'),
      result:   document.getElementById('result-screen'),
    };

    // HUD elements
    this.hud = document.getElementById('game-hud');
    this.phaseIndicator = document.getElementById('phase-indicator');
    this.phaseIcon = this.phaseIndicator?.querySelector('.phase-icon');
    this.phaseText = this.phaseIndicator?.querySelector('.phase-text');
    this.timerDisplay = document.getElementById('timer-display');
    this.timerText = document.getElementById('timer-text');
    this.timerRingProgress = document.getElementById('timer-ring-progress');
    this.guessCounter = document.getElementById('guess-counter');
    this.guessDots = document.getElementById('guess-dots');
    this.controlsHint = document.getElementById('controls-hint');
    this.crosshair = document.getElementById('crosshair');

    // Toolbar
    this.paintToolbar = document.getElementById('paint-toolbar');
    this.poseSelector = document.getElementById('pose-selector');
    this.poseOptions = document.getElementById('pose-options');

    // Result elements
    this.resultIcon = document.getElementById('result-icon');
    this.resultTitle = document.getElementById('result-title');
    this.resultSubtitle = document.getElementById('result-subtitle');
    this.statTime = document.getElementById('stat-time');
    this.statGuesses = document.getElementById('stat-guesses');
    this.statMap = document.getElementById('stat-map');

    // Buttons
    this.startBtn = document.getElementById('start-btn');
    this.hiderReadyBtn = document.getElementById('hider-ready-btn');
    this.seekerReadyBtn = document.getElementById('seeker-ready-btn');
    this.doneHidingBtn = document.getElementById('done-hiding-btn');
    this.playAgainBtn = document.getElementById('play-again-btn');
    this.menuBtn = document.getElementById('menu-btn');
    this.revealBtn = document.getElementById('reveal-btn');
    this.soundToggle = document.getElementById('sound-toggle');

    // Settings
    this.timerSelect = document.getElementById('timer-select');
    this.guessesSelect = document.getElementById('guesses-select');

    // Paint tool controls
    this.colorInput = document.getElementById('color-input');
    this.colorPreview = document.getElementById('color-preview');
    this.brushSizeSlider = document.getElementById('brush-size');
    this.brushSizeVal = document.getElementById('brush-size-val');
    this.opacitySlider = document.getElementById('brush-opacity');
    this.opacityVal = document.getElementById('opacity-val');
    this.undoBtn = document.getElementById('undo-btn');
    this.redoBtn = document.getElementById('redo-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.quickColors = document.getElementById('quick-colors');
    this.texturePreview = document.getElementById('texture-preview');

    // Timer ring circumference
    this.timerCircumference = 2 * Math.PI * 54; // radius=54 from SVG
    if (this.timerRingProgress) {
      this.timerRingProgress.style.strokeDasharray = this.timerCircumference;
    }

    // Map selection state
    this.selectedMap = null;

    // Initialize
    this._buildMapGrid();
    this._setupColorPreview();
  }

  // ═══════════════ SCREEN MANAGEMENT ═══════════════

  showScreen(name) {
    // Hide all screens first
    Object.values(this.screens).forEach(s => {
      if (s) s.classList.remove('active');
    });
    // Show requested
    if (this.screens[name]) {
      this.screens[name].classList.add('active');
    }
  }

  hideScreen(name) {
    if (this.screens[name]) {
      this.screens[name].classList.remove('active');
    }
  }

  hideAllScreens() {
    Object.values(this.screens).forEach(s => {
      if (s) s.classList.remove('active');
    });
  }

  // ═══════════════ HUD ═══════════════

  showHUD() {
    if (this.hud) this.hud.classList.remove('hidden');
  }

  hideHUD() {
    if (this.hud) this.hud.classList.add('hidden');
  }

  setPhase(icon, text) {
    if (this.phaseIcon) this.phaseIcon.textContent = icon;
    if (this.phaseText) this.phaseText.textContent = text;
  }

  setControlsHint(hints) {
    if (!this.controlsHint) return;
    this.controlsHint.innerHTML = hints.map(h => `<span>${h}</span>`).join('');
  }

  // ═══════════════ TIMER ═══════════════

  showTimer() {
    if (this.timerDisplay) this.timerDisplay.classList.remove('hidden');
  }

  hideTimer() {
    if (this.timerDisplay) this.timerDisplay.classList.add('hidden');
  }

  updateTimer(remaining, total) {
    const secs = Math.ceil(remaining);
    if (this.timerText) {
      this.timerText.textContent = secs;
      this.timerText.className = 'timer-text';
      if (secs <= 5) this.timerText.classList.add('danger');
      else if (secs <= 10) this.timerText.classList.add('warning');
    }

    if (this.timerRingProgress) {
      const progress = remaining / total;
      const offset = this.timerCircumference * (1 - progress);
      this.timerRingProgress.style.strokeDashoffset = offset;
      this.timerRingProgress.className = 'timer-ring-progress';
      if (secs <= 5) this.timerRingProgress.classList.add('danger');
      else if (secs <= 10) this.timerRingProgress.classList.add('warning');
    }
  }

  // ═══════════════ GUESS COUNTER ═══════════════

  showGuessCounter(total) {
    if (!this.guessCounter || !this.guessDots) return;
    this.guessCounter.classList.remove('hidden');
    this.guessDots.innerHTML = '';
    if (total === 0) {
      // Unlimited — show ∞
      this.guessDots.innerHTML = '<span style="font-size:18px;color:var(--accent-primary)">∞</span>';
      return;
    }
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('div');
      dot.className = 'guess-dot';
      dot.dataset.index = i;
      this.guessDots.appendChild(dot);
    }
  }

  hideGuessCounter() {
    if (this.guessCounter) this.guessCounter.classList.add('hidden');
  }

  updateGuesses(used) {
    if (!this.guessDots) return;
    const dots = this.guessDots.querySelectorAll('.guess-dot');
    dots.forEach((dot, i) => {
      if (i < used) dot.classList.add('used');
      else dot.classList.remove('used');
    });
  }

  // ═══════════════ PAINT TOOLBAR ═══════════════

  showPaintUI() {
    if (this.paintToolbar) this.paintToolbar.classList.remove('hidden');
    if (this.poseSelector) this.poseSelector.classList.remove('hidden');
  }

  hidePaintUI() {
    if (this.paintToolbar) this.paintToolbar.classList.add('hidden');
    if (this.poseSelector) this.poseSelector.classList.add('hidden');
  }

  // ═══════════════ CROSSHAIR ═══════════════

  showCrosshair() {
    if (this.crosshair) this.crosshair.classList.remove('hidden');
  }

  hideCrosshair() {
    if (this.crosshair) this.crosshair.classList.add('hidden');
  }

  // ═══════════════ POSE SELECTOR ═══════════════

  buildPoseSelector(poses, onSelect) {
    if (!this.poseOptions) return;
    this.poseOptions.innerHTML = '';
    poses.forEach(pose => {
      const btn = document.createElement('button');
      btn.className = 'pose-btn' + (pose.id === 'standing' ? ' active' : '');
      btn.dataset.pose = pose.id;
      btn.innerHTML = `
        <span class="pose-icon">${pose.icon}</span>
        <span class="pose-name">${pose.name}</span>
      `;
      btn.addEventListener('click', () => {
        this.poseOptions.querySelectorAll('.pose-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onSelect) onSelect(pose.id);
      });
      this.poseOptions.appendChild(btn);
    });
  }

  // ═══════════════ MAP GRID ═══════════════

  _buildMapGrid() {
    const grid = document.getElementById('map-grid');
    if (!grid) return;
    grid.innerHTML = '';

    Object.entries(MAP_DATA).forEach(([key, map]) => {
      const card = document.createElement('div');
      card.className = 'map-card';
      card.dataset.map = key;
      card.innerHTML = `
        <div class="map-card-bg" style="background:${map.bgColor}">${map.icon}</div>
        <div class="map-card-info">
          <div class="map-card-name">${map.name}</div>
          <div class="map-card-desc">${map.description}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        grid.querySelectorAll('.map-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMap = key;
        if (this.startBtn) this.startBtn.disabled = false;
      });
      grid.appendChild(card);
    });
  }

  _setupColorPreview() {
    if (this.colorPreview && this.colorInput) {
      this.colorPreview.style.background = this.colorInput.value;
      this.colorInput.addEventListener('input', () => {
        this.colorPreview.style.background = this.colorInput.value;
      });
    }
  }

  // ═══════════════ RESULT SCREEN ═══════════════

  showResult({ seekerWins, timeTaken, guessesUsed, mapName }) {
    if (seekerWins) {
      if (this.resultIcon) this.resultIcon.textContent = '🎉';
      if (this.resultTitle) {
        this.resultTitle.textContent = 'SEEKER WINS!';
        this.resultTitle.className = 'result-title';
      }
      if (this.resultSubtitle) {
        this.resultSubtitle.textContent = `Found the chameleon in ${Math.round(timeTaken)}s with ${guessesUsed} guess${guessesUsed !== 1 ? 'es' : ''}!`;
      }
    } else {
      if (this.resultIcon) this.resultIcon.textContent = '🦎';
      if (this.resultTitle) {
        this.resultTitle.textContent = 'HIDER WINS!';
        this.resultTitle.className = 'result-title hider-wins';
      }
      if (this.resultSubtitle) {
        this.resultSubtitle.textContent = 'The chameleon was never found! Perfect camouflage!';
      }
    }

    if (this.statTime) this.statTime.textContent = Math.round(timeTaken) + 's';
    if (this.statGuesses) this.statGuesses.textContent = guessesUsed;
    if (this.statMap) this.statMap.textContent = MAP_DATA[mapName]?.name || mapName;

    this.showScreen('result');
  }

  // ═══════════════ COUNTDOWN ═══════════════

  async showCountdown() {
    const screen = this.screens.countdown;
    const numEl = document.getElementById('countdown-number');
    if (!screen || !numEl) return;

    screen.classList.add('active');

    for (let i = 3; i >= 1; i--) {
      numEl.textContent = i;
      numEl.style.animation = 'none';
      numEl.offsetHeight; // Trigger reflow
      numEl.style.animation = 'countPop 1s ease';
      await this._sleep(1000);
    }

    numEl.textContent = 'GO!';
    numEl.style.animation = 'none';
    numEl.offsetHeight;
    numEl.style.animation = 'countPop 0.8s ease';
    await this._sleep(800);

    screen.classList.remove('active');
  }

  // ═══════════════ NOTIFICATIONS ═══════════════

  showNotification(text, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = text;
    container.appendChild(notif);

    setTimeout(() => {
      notif.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  }

  // ═══════════════ SETTINGS GETTERS ═══════════════

  getTimerDuration() {
    return parseInt(this.timerSelect?.value || '60');
  }

  getMaxGuesses() {
    return parseInt(this.guessesSelect?.value || '5');
  }

  getSelectedMap() {
    return this.selectedMap;
  }

  // ═══════════════ HELPERS ═══════════════

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
