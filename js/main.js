// ═══════════════════════════════════════════════
// 🦎 CHAMELEON GAME — Main Game Controller
// State machine orchestrating all game phases
// ═══════════════════════════════════════════════

import * as THREE from 'three';
import { GameRenderer } from './renderer.js';
import { Character } from './character.js';
import { loadMap, MAP_DATA } from './maps.js';
import { PaintTool } from './painter.js';
import { SeekerMode } from './seeker.js';
import { GameTimer } from './timer.js';
import { AudioManager } from './audio.js';
import { GameUI } from './ui.js';

// ─── Game States ───
const STATE = {
  LOADING: 'loading',
  MENU: 'menu',
  HIDER_INTRO: 'hider_intro',
  HIDER_POSITION: 'hider_position',  // WASD to move character
  HIDER_PAINT: 'hider_paint',        // Paint & pose
  HANDOFF: 'handoff',
  SEEKER_COUNTDOWN: 'seeker_countdown',
  SEEKING: 'seeking',
  RESULT: 'result',
};

class ChameleonGame {
  constructor() {
    this.state = STATE.LOADING;

    // Core modules
    this.renderer = null;
    this.character = null;
    this.painter = null;
    this.seeker = null;
    this.timer = new GameTimer();
    this.audio = new AudioManager();
    this.ui = new GameUI();

    // Game data
    this.currentMap = null;
    this.mapObjects = [];
    this.mapData = null;
    this.seekStartTime = 0;
    this.totalGuessesUsed = 0;

    // Hider movement state
    this.hiderKeys = { w: false, a: false, s: false, d: false };
    this.hiderRotation = 0;
    this.hiderLocked = false;

    // Bound handlers
    this._onHiderKeyDown = this._handleHiderKeyDown.bind(this);
    this._onHiderKeyUp = this._handleHiderKeyUp.bind(this);
    this._onSeekerClick = this._handleSeekerClick.bind(this);

    this._init();
  }

  async _init() {
    try {
      // Initialize renderer
      const container = document.getElementById('game-container');
      this.renderer = new GameRenderer(container);

      // Initialize character
      this.character = new Character();

      // Setup UI callbacks
      this._setupUICallbacks();

      // Short delay for loading effect
      await this._sleep(800);

      // Show menu
      this._transitionTo(STATE.MENU);

    } catch (err) {
      console.error('Failed to initialize game:', err);
      this.ui.showNotification('Failed to initialize: ' + err.message, 'error');
    }
  }

  // ═══════════════ STATE MACHINE ═══════════════

  _transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    console.log(`[Game] ${oldState} → ${newState}`);

    switch (newState) {
      case STATE.MENU:        this._enterMenu(); break;
      case STATE.HIDER_INTRO: this._enterHiderIntro(); break;
      case STATE.HIDER_POSITION: this._enterHiderPosition(); break;
      case STATE.HIDER_PAINT: this._enterHiderPaint(); break;
      case STATE.HANDOFF:     this._enterHandoff(); break;
      case STATE.SEEKER_COUNTDOWN: this._enterSeekerCountdown(); break;
      case STATE.SEEKING:     this._enterSeeking(); break;
      case STATE.RESULT:      break; // Handled by showResult
    }
  }

  // ─── MENU ───

  _enterMenu() {
    // Reset everything
    this.renderer.stopLoop();
    this.renderer.clearScene();
    this.renderer.disableControls();
    this.timer.stop();

    // Reset character
    if (this.character) this.character.reset();
    if (this.painter) { this.painter.destroy(); this.painter = null; }
    if (this.seeker) { this.seeker.destroy(); this.seeker = null; }

    // Disable hider controls
    this._disableHiderMovement();

    // UI
    this.ui.hideAllScreens();
    this.ui.hideHUD();
    this.ui.hidePaintUI();
    this.ui.hideCrosshair();
    this.ui.showScreen('menu');

    this.audio.stopAmbient();
  }

  // ─── HIDER INTRO ───

  _enterHiderIntro() {
    this.ui.hideAllScreens();
    this.ui.showScreen('hiderIntro');
    this.audio.play('whoosh');
  }

  // ─── HIDER POSITION ───

  _enterHiderPosition() {
    this.ui.hideAllScreens();

    // Load the selected map
    this.currentMap = this.ui.getSelectedMap();
    const mapInfo = MAP_DATA[this.currentMap];

    // Setup scene
    this.renderer.clearScene();
    this.renderer.setBackground(mapInfo.fogColor);
    this.renderer.setFog(mapInfo.fogColor, mapInfo.fogDensity);

    // Load map
    this.mapData = loadMap(this.currentMap, this.renderer.scene);
    this.renderer.setBounds(this.mapData.bounds);

    // Add character to scene
    this.character.reset();
    this.character.addToScene(this.renderer.scene);
    this.character.setPosition(
      this.mapData.hiderSpawn.x,
      this.mapData.hiderSpawn.y,
      this.mapData.hiderSpawn.z
    );

    // Camera follows character from behind
    this.hiderLocked = false;
    this.hiderRotation = 0;
    this._updateHiderCamera();

    // Start render loop
    this.renderer.onRenderCallback = (delta) => {
      if (this.state === STATE.HIDER_POSITION) {
        this._updateHiderMovement(delta);
      }
    };
    this.renderer.startLoop();

    // Enable hider keyboard controls
    this._enableHiderMovement();

    // HUD
    this.ui.showHUD();
    this.ui.setPhase('🚶', 'FIND A SPOT');
    this.ui.setControlsHint(['WASD: Move', 'Mouse: Look (right-click drag)', 'E: Lock Position & Paint']);
    this.ui.hidePaintUI();
    this.ui.hideTimer();
    this.ui.hideGuessCounter();
    this.ui.hideCrosshair();

    // Audio
    this.audio.init();
    this.audio.startAmbient(this.currentMap);

    this.ui.showNotification('Find a good hiding spot! Press E to start painting.', 'info');
  }

  // ─── HIDER PAINT ───

  _enterHiderPaint() {
    this.hiderLocked = true;
    this._disableHiderMovement();

    // Setup orbit controls centered on character
    const charPos = this.character.getPosition();
    this.renderer.disableControls();
    this.renderer.enableOrbitControls(charPos);

    // Create painter
    this.painter = new PaintTool(this.character, this.renderer);
    this.painter.enable();
    this.painter.onColorChange = (color) => {
      this.ui.showNotification(`Color sampled: ${color}`, 'success');
    };

    // Setup paint tool UI interactions
    this._setupPaintToolUI();

    // Build pose selector
    this.ui.buildPoseSelector(this.character.getPoseList(), (poseId) => {
      this.character.setPose(poseId);
      this.audio.play('pop');
    });

    // Update HUD
    this.ui.setPhase('🎨', 'PAINTING');
    this.ui.setControlsHint(['Left-click: Paint on character', 'Right-drag: Rotate view', 'Scroll: Zoom']);
    this.ui.showPaintUI();

    // Update texture preview
    this.painter.updatePreview();

    this.audio.play('lock');
    this.ui.showNotification('Position locked! Now paint yourself to blend in.', 'success');
  }

  // ─── HANDOFF ───

  _enterHandoff() {
    // Disable painting
    if (this.painter) this.painter.disable();
    this.renderer.disableControls();

    // Hide game UI
    this.ui.hideHUD();
    this.ui.hidePaintUI();
    this.ui.hideCrosshair();

    // Show handoff screen
    this.ui.hideAllScreens();
    this.ui.showScreen('handoff');

    this.audio.play('whoosh');
    this.audio.stopAmbient();
  }

  // ─── SEEKER COUNTDOWN ───

  async _enterSeekerCountdown() {
    this.ui.hideAllScreens();

    // Audio
    this.audio.init();
    this.audio.startAmbient(this.currentMap);

    // Play countdown sounds
    const countdownInterval = setInterval(() => this.audio.play('countdown'), 1000);

    // Show animated countdown
    await this.ui.showCountdown();

    clearInterval(countdownInterval);
    this.audio.play('countdownGo');

    // Transition to seeking
    this._transitionTo(STATE.SEEKING);
  }

  // ─── SEEKING ───

  _enterSeeking() {
    this.ui.hideAllScreens();

    // Setup FPS controls starting from seeker spawn
    this.renderer.enableFPSControls(
      this.mapData.seekerSpawn,
      Math.atan2(
        this.character.getPosition().x - this.mapData.seekerSpawn.x,
        this.character.getPosition().z - this.mapData.seekerSpawn.z
      )
    );

    // Create seeker
    const maxGuesses = this.ui.getMaxGuesses();
    this.seeker = new SeekerMode(this.renderer, this.character);
    this.seeker.enable(maxGuesses);

    this.seeker.onFound = () => {
      this._onSeekerFound();
    };

    this.seeker.onMiss = (event, guessesLeft) => {
      this.audio.play('miss');
      this.ui.updateGuesses(this.seeker.guessesUsed);
      if (guessesLeft <= 2 && guessesLeft > 0) {
        this.ui.showNotification(`${guessesLeft} guess${guessesLeft !== 1 ? 'es' : ''} remaining!`, 'error');
      }
    };

    this.seeker.onOutOfGuesses = () => {
      this._onHiderWins('out_of_guesses');
    };

    // Click handler for FPS mode (pointer lock captures clicks)
    document.addEventListener('mousedown', this._onSeekerClick);

    // Start timer
    const timerDuration = this.ui.getTimerDuration();
    this.seekStartTime = performance.now();
    this.totalGuessesUsed = 0;

    this.timer.onTick = (remaining, total) => {
      this.ui.updateTimer(remaining, total);
      // Tick sound in last 10 seconds
      if (remaining <= 10 && remaining > 0 && Math.ceil(remaining) !== Math.ceil(remaining + 0.1)) {
        this.audio.play('tick');
      }
      if (remaining <= 5 && remaining > 0) {
        this.audio.play('heartbeat');
      }
    };

    this.timer.onComplete = () => {
      this._onHiderWins('time_up');
    };

    this.timer.start(timerDuration);

    // HUD
    this.ui.showHUD();
    this.ui.setPhase('🔍', 'SEEKING');
    this.ui.setControlsHint(['Click: Lock mouse', 'WASD: Move', 'Click: Guess location']);
    this.ui.showTimer();
    this.ui.showGuessCounter(maxGuesses);
    this.ui.showCrosshair();

    this.ui.showNotification('Find the hidden chameleon! Click to guess.', 'info');
  }

  // ═══════════════ GAME END CONDITIONS ═══════════════

  _onSeekerFound() {
    this.timer.stop();
    const timeTaken = (performance.now() - this.seekStartTime) / 1000;
    this.totalGuessesUsed = this.seeker.guessesUsed;

    this.audio.play('hit');
    setTimeout(() => this.audio.play('victory'), 300);

    // Cleanup
    this._cleanupSeeking();

    // Show result
    setTimeout(() => {
      this.ui.showResult({
        seekerWins: true,
        timeTaken,
        guessesUsed: this.totalGuessesUsed,
        mapName: this.currentMap,
      });
    }, 1200);
  }

  _onHiderWins(reason) {
    this.timer.stop();
    const timerDuration = this.ui.getTimerDuration();
    this.totalGuessesUsed = this.seeker ? this.seeker.guessesUsed : 0;

    this.audio.play('defeat');

    // Cleanup
    this._cleanupSeeking();

    // Show result
    setTimeout(() => {
      this.ui.showResult({
        seekerWins: false,
        timeTaken: timerDuration,
        guessesUsed: this.totalGuessesUsed,
        mapName: this.currentMap,
      });
      if (reason === 'time_up') {
        this.ui.showNotification("Time's up! The chameleon survived!", 'info');
      } else {
        this.ui.showNotification("Out of guesses! The chameleon wins!", 'info');
      }
    }, 800);
  }

  _cleanupSeeking() {
    document.removeEventListener('mousedown', this._onSeekerClick);
    if (this.seeker) this.seeker.disable();
    this.renderer.disableControls();
    this.ui.hideHUD();
    this.ui.hideCrosshair();
    this.audio.stopAmbient();
  }

  // ═══════════════ HIDER MOVEMENT ═══════════════

  _enableHiderMovement() {
    document.addEventListener('keydown', this._onHiderKeyDown);
    document.addEventListener('keyup', this._onHiderKeyUp);
  }

  _disableHiderMovement() {
    document.removeEventListener('keydown', this._onHiderKeyDown);
    document.removeEventListener('keyup', this._onHiderKeyUp);
    this.hiderKeys = { w: false, a: false, s: false, d: false };
  }

  _handleHiderKeyDown(e) {
    if (this.state !== STATE.HIDER_POSITION) return;

    switch (e.code) {
      case 'KeyW': this.hiderKeys.w = true; break;
      case 'KeyA': this.hiderKeys.a = true; break;
      case 'KeyS': this.hiderKeys.s = true; break;
      case 'KeyD': this.hiderKeys.d = true; break;
      case 'KeyE':
        if (!this.hiderLocked) {
          this._transitionTo(STATE.HIDER_PAINT);
        }
        break;
    }
  }

  _handleHiderKeyUp(e) {
    switch (e.code) {
      case 'KeyW': this.hiderKeys.w = false; break;
      case 'KeyA': this.hiderKeys.a = false; break;
      case 'KeyS': this.hiderKeys.s = false; break;
      case 'KeyD': this.hiderKeys.d = false; break;
    }
  }

  _updateHiderMovement(delta) {
    if (this.hiderLocked) return;

    const speed = 5 * delta;
    const pos = this.character.getPosition();
    let moved = false;

    // Calculate movement direction based on camera
    const camDir = new THREE.Vector3();
    this.renderer.camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();
    const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0));

    if (this.hiderKeys.w) { pos.add(camDir.multiplyScalar(speed)); moved = true; camDir.normalize(); }
    if (this.hiderKeys.s) { pos.sub(camDir.clone().normalize().multiplyScalar(speed)); moved = true; }
    if (this.hiderKeys.a) { pos.sub(right.clone().normalize().multiplyScalar(speed)); moved = true; }
    if (this.hiderKeys.d) { pos.add(right.clone().normalize().multiplyScalar(speed)); moved = true; }

    // Enforce bounds
    if (this.mapData && this.mapData.bounds) {
      const b = this.mapData.bounds;
      pos.x = Math.max(b.minX + 0.5, Math.min(b.maxX - 0.5, pos.x));
      pos.z = Math.max(b.minZ + 0.5, Math.min(b.maxZ - 0.5, pos.z));
    }

    if (moved) {
      this.character.setPosition(pos.x, pos.y, pos.z);
      this._updateHiderCamera();
    }
  }

  _updateHiderCamera() {
    const pos = this.character.getPosition();
    // Third person camera behind and above character
    const camOffset = new THREE.Vector3(0, 3, 5);
    const camTarget = pos.clone();
    camTarget.y += 1;

    this.renderer.camera.position.copy(pos.clone().add(camOffset));
    this.renderer.camera.lookAt(camTarget);

    // Enable orbit for looking around
    this.renderer.orbitState.target.copy(camTarget);
  }

  // ═══════════════ SEEKER CLICK ═══════════════

  _handleSeekerClick(event) {
    if (this.state !== STATE.SEEKING) return;
    if (event.button !== 0) return;

    if (this.seeker && document.pointerLockElement) {
      this.seeker.processClick(event);
    }
  }

  // ═══════════════ UI CALLBACKS ═══════════════

  _setupUICallbacks() {
    // Start button
    this.ui.startBtn?.addEventListener('click', () => {
      if (this.ui.getSelectedMap()) {
        this.audio.init();
        this.audio.play('click');
        this._transitionTo(STATE.HIDER_INTRO);
      }
    });

    // Hider ready
    this.ui.hiderReadyBtn?.addEventListener('click', () => {
      this.audio.play('click');
      this._transitionTo(STATE.HIDER_POSITION);
    });

    // Done hiding
    this.ui.doneHidingBtn?.addEventListener('click', () => {
      this.audio.play('lock');
      this._transitionTo(STATE.HANDOFF);
    });

    // Seeker ready
    this.ui.seekerReadyBtn?.addEventListener('click', () => {
      this.audio.play('click');
      this._transitionTo(STATE.SEEKER_COUNTDOWN);
    });

    // Reveal hiding spot
    this.ui.revealBtn?.addEventListener('click', () => {
      this.audio.play('click');
      this._revealHidingSpot();
    });

    // Play again
    this.ui.playAgainBtn?.addEventListener('click', () => {
      this.audio.play('click');
      // Go back to hider intro with same map
      this._transitionTo(STATE.HIDER_INTRO);
    });

    // Menu button
    this.ui.menuBtn?.addEventListener('click', () => {
      this.audio.play('click');
      this._transitionTo(STATE.MENU);
    });

    // Sound toggle
    this.ui.soundToggle?.addEventListener('click', () => {
      const muted = this.audio.toggleMute();
      this.ui.soundToggle.textContent = muted ? 'OFF' : 'ON';
      this.ui.soundToggle.classList.toggle('active', !muted);
      this.ui.soundToggle.dataset.active = !muted;
    });

    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.painter) {
          this.painter.setTool(btn.dataset.tool);
          this.audio.play('click');
        }
      });
    });

    // Keyboard shortcuts for tools
    document.addEventListener('keydown', (e) => {
      if (this.state !== STATE.HIDER_PAINT) return;
      switch (e.code) {
        case 'KeyB': this._selectTool('brush'); break;
        case 'KeyI': this._selectTool('eyedropper'); break;
        case 'KeyG': this._selectTool('fill'); break;
        case 'KeyX': this._selectTool('eraser'); break;
        case 'KeyZ':
          if (e.ctrlKey) {
            e.preventDefault();
            this.painter?.undo();
            this.audio.play('pop');
          }
          break;
        case 'KeyY':
          if (e.ctrlKey) {
            e.preventDefault();
            this.painter?.redo();
            this.audio.play('pop');
          }
          break;
      }
    });
  }

  _setupPaintToolUI() {
    // Color input
    this.ui.colorInput?.addEventListener('input', () => {
      if (this.painter) {
        this.painter.setColor(this.ui.colorInput.value);
      }
    });

    // Quick colors
    document.querySelectorAll('.quick-color').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        if (this.painter) {
          this.painter.setColor(color);
          this.audio.play('click');
        }
        if (this.ui.colorInput) this.ui.colorInput.value = color;
        if (this.ui.colorPreview) this.ui.colorPreview.style.background = color;
      });
    });

    // Brush size
    this.ui.brushSizeSlider?.addEventListener('input', () => {
      const size = parseInt(this.ui.brushSizeSlider.value);
      if (this.painter) this.painter.setBrushSize(size);
      if (this.ui.brushSizeVal) this.ui.brushSizeVal.textContent = size;
    });

    // Opacity
    this.ui.opacitySlider?.addEventListener('input', () => {
      const opacity = parseInt(this.ui.opacitySlider.value);
      if (this.painter) this.painter.setOpacity(opacity / 100);
      if (this.ui.opacityVal) this.ui.opacityVal.textContent = opacity + '%';
    });

    // Undo/Redo/Clear
    this.ui.undoBtn?.addEventListener('click', () => {
      this.painter?.undo();
      this.audio.play('pop');
    });
    this.ui.redoBtn?.addEventListener('click', () => {
      this.painter?.redo();
      this.audio.play('pop');
    });
    this.ui.clearBtn?.addEventListener('click', () => {
      this.painter?.clear();
      this.audio.play('pop');
    });
  }

  _selectTool(toolName) {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tool-btn[data-tool="${toolName}"]`);
    if (btn) btn.classList.add('active');
    if (this.painter) this.painter.setTool(toolName);
    this.audio.play('click');
  }

  _revealHidingSpot() {
    // Move camera to show where character was hiding
    this.ui.hideScreen('result');
    this.ui.showHUD();
    this.ui.setPhase('👁', 'REVEAL');
    this.ui.setControlsHint(['Click anywhere to return to results']);

    const charPos = this.character.getPosition();
    this.renderer.enableOrbitControls(charPos);

    // Make character blink/pulse
    const originalColor = this.character.bodyMesh.material.emissive?.clone();
    let blinkInterval = setInterval(() => {
      const emissive = this.character.bodyMesh.material.emissive;
      if (emissive.r > 0) {
        emissive.setHex(0x000000);
      } else {
        emissive.setHex(0x00ff44);
      }
      this.character.bodyMesh.material.emissiveIntensity = 0.5;
    }, 500);

    // Click to return to results
    const returnHandler = () => {
      clearInterval(blinkInterval);
      this.character.bodyMesh.material.emissive.setHex(0x000000);
      this.character.bodyMesh.material.emissiveIntensity = 0;
      this.renderer.disableControls();
      this.ui.hideHUD();
      this.ui.showScreen('result');
      document.removeEventListener('click', returnHandler);
    };

    // Delay so this click doesn't trigger return
    setTimeout(() => {
      document.addEventListener('click', returnHandler);
    }, 500);
  }

  // ═══════════════ HELPERS ═══════════════

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─── Start the game! ───
const game = new ChameleonGame();
