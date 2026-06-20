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
    this.hiderKeys = { w: false, a: false, s: false, d: false, up: false, down: false, left: false, right: false };
    this.hiderRotation = 0;
    this.hiderLocked = false;
    this.hiderInitialized = false;   // full map/character setup done once per round
    this.hiderFacing = 0;            // direction the character is turning toward
    this.camYaw = 0;                 // smoothed follow-camera yaw
    this.poseSelectorBuilt = false;

    // Hunter (seeker) state
    this.hunter = null;
    this._effects = [];   // transient paint-shot visuals
    this._paintColors = ['#ff3b6b', '#ffd23f', '#2ec4b6', '#4cc9f0', '#9b5de5', '#ff7b00', '#00f5d4', '#f15bb5'];
    this._paintIndex = 0;

    // Bound handlers
    this._onHiderKeyDown = this._handleHiderKeyDown.bind(this);
    this._onHiderKeyUp = this._handleHiderKeyUp.bind(this);
    this._onHunterShoot = this._handleHunterShoot.bind(this);

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
    if (this.hunter) {
      this.hunter.removeFromScene(this.renderer.scene);
      this.hunter.destroy();
      this.hunter = null;
    }
    this._clearEffects();

    // Disable hider controls
    this._disableHiderMovement();
    document.removeEventListener('mousedown', this._onHunterShoot);
    this.hiderInitialized = false;
    this.poseSelectorBuilt = false;

    // UI
    this.ui.hideAllScreens();
    this.ui.hideHUD();
    this.ui.hidePaintUI();
    this.ui.hidePoseSelector();
    this.ui.hideCrosshair();
    this.ui.showScreen('menu');

    this.audio.stopAmbient();
  }

  // ─── HIDER INTRO ───

  _enterHiderIntro() {
    // Start a fresh hiding round — rebuild map, character & painter
    this.hiderInitialized = false;
    this.poseSelectorBuilt = false;
    if (this.painter) { this.painter.destroy(); this.painter = null; }
    if (this.seeker) { this.seeker.destroy(); this.seeker = null; }
    if (this.hunter) {
      this.hunter.removeFromScene(this.renderer.scene);
      this.hunter.destroy();
      this.hunter = null;
    }
    this._clearEffects();

    this.ui.hideAllScreens();
    this.ui.hidePoseSelector();
    this.ui.hidePaintUI();
    this.ui.showScreen('hiderIntro');
    this.audio.play('whoosh');
  }

  // ─── HIDER POSITION ───

  _enterHiderPosition() {
    this.ui.hideAllScreens();

    // ── First-time setup for this round (skipped when resuming from unlock) ──
    if (!this.hiderInitialized) {
      this.currentMap = this.ui.getSelectedMap();
      const mapInfo = MAP_DATA[this.currentMap];

      // Setup scene
      this.renderer.clearScene();
      this.renderer.setBackground(mapInfo.fogColor);
      this.renderer.setFog(mapInfo.fogColor, mapInfo.fogDensity);

      // Load map (+ build wall colliders)
      this.mapData = loadMap(this.currentMap, this.renderer.scene);
      this.renderer.setBounds(this.mapData.bounds);
      this.renderer.setColliders(this.mapData.colliders);

      // Add character to scene at spawn
      this.character.reset();
      this.character.addToScene(this.renderer.scene);
      this.character.setPosition(
        this.mapData.hiderSpawn.x,
        this.mapData.hiderSpawn.y,
        this.mapData.hiderSpawn.z
      );
      this.hiderFacing = 0;
      this.camYaw = 0;

      // Render loop dispatcher — persists across hider & seeker phases
      this.renderer.onRenderCallback = (delta) => this._onFrame(delta);
      this.renderer.startLoop();

      // Audio
      this.audio.init();
      this.audio.startAmbient(this.currentMap);

      this.hiderInitialized = true;
    }

    // Switch the camera back to third-person follow
    this.renderer.disableControls();
    this._snapFollowCamera();

    // Unlocked & free to move
    this.hiderLocked = false;
    this.character.setWalking(false);

    // Pause painting if we came back from paint mode
    if (this.painter) this.painter.disable();

    // Enable hider keyboard controls
    this._enableHiderMovement();

    // Pose options are available from the very start
    this._ensurePoseSelector();

    // HUD
    this.ui.showHUD();
    this.ui.setPhase('🚶', 'FIND A SPOT');
    this.ui.setControlsHint(['WASD/Arrows: Move', 'Pick a pose anytime', 'L: Lock / Unlock & Paint']);
    this.ui.hidePaintUI();
    this.ui.showPoseSelector();
    this.ui.hideTimer();
    this.ui.hideGuessCounter();
    this.ui.hideCrosshair();

    this.ui.showNotification('Walk around to find a spot. Pick a pose, then press L to lock & paint.', 'info');
  }

  /** Build the pose selector once; it stays live across position & paint phases */
  _ensurePoseSelector() {
    if (this.poseSelectorBuilt) return;
    this.ui.buildPoseSelector(this.character.getPoseList(), (poseId) => {
      this.character.setPose(poseId);
      this.audio.play('pop');
    });
    this.poseSelectorBuilt = true;
  }

  // ─── HIDER PAINT ───

  _enterHiderPaint() {
    this.hiderLocked = true;
    this._disableHiderMovement();
    this.character.setWalking(false);

    // Setup orbit controls centered on character
    const charPos = this.character.getPosition();
    this.renderer.disableControls();
    this.renderer.enableOrbitControls(charPos);

    // Create the painter once, then reuse it so painted texture survives unlock
    if (!this.painter) {
      this.painter = new PaintTool(this.character, this.renderer);
      this.painter.onColorChange = (color) => {
        this.ui.showNotification(`Color sampled: ${color}`, 'success');
      };
      this._setupPaintToolUI();
    }
    this.painter.enable();

    // Make sure pose options exist (also usable while painting)
    this._ensurePoseSelector();

    // Update HUD
    this.ui.setPhase('🎨', 'PAINTING');
    this.ui.setControlsHint(['Left-click: Paint', 'Right-drag: Rotate', 'L: Unlock & move again']);
    this.ui.showPaintUI();
    this.ui.showPoseSelector();

    // Update texture preview
    this.painter.updatePreview();

    this.audio.play('lock');
    this.ui.showNotification('Locked! Paint to blend in — press L to unlock and reposition.', 'success');
  }

  // ─── HANDOFF ───

  _enterHandoff() {
    // Disable painting
    if (this.painter) this.painter.disable();
    this.renderer.disableControls();

    // Hide game UI
    this.ui.hideHUD();
    this.ui.hidePaintUI();
    this.ui.hidePoseSelector();
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

    // Thicken the fog so the seeker can't scan the whole map from one spot —
    // they have to physically walk around to uncover hiding places.
    const mapInfo = MAP_DATA[this.currentMap];
    const seekFog = mapInfo.seekFog || (mapInfo.fogDensity * 3);
    this.renderer.setFog(mapInfo.fogColor, seekFog);
    this.renderer.setBackground(mapInfo.fogColor);

    // Yaw facing roughly toward where the hider is
    const spawn = this.mapData.seekerSpawn;
    const startYaw = Math.atan2(
      this.character.getPosition().x - spawn.x,
      this.character.getPosition().z - spawn.z
    );

    // ── Spawn the hunter: a walking figure carrying a paint gun ──
    this._spawnHunter(spawn, startYaw);

    // Third-person controls (mouse aims, WASD walks, camera over the shoulder)
    this.renderer.enableThirdPersonControls(spawn, startYaw);

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

    // Left-click fires the paint gun (the first click just grabs pointer lock)
    document.addEventListener('mousedown', this._onHunterShoot);

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
    this.ui.setPhase('🔫', 'HUNTING');
    this.ui.setControlsHint(['Click: Lock mouse', 'WASD: Move', 'Mouse: Aim', 'Left-Click: Shoot paint']);
    this.ui.showTimer();
    this.ui.showGuessCounter(maxGuesses);
    this.ui.showCrosshair();

    this.ui.showNotification('Hunt the hidden player! Walk the map and shoot paint to tag them.', 'info');
  }

  /** Build & place the hunter figure with its paint gun */
  _spawnHunter(spawn, yaw) {
    if (this.hunter) { this.hunter.removeFromScene(this.renderer.scene); this.hunter.destroy(); }
    this.hunter = new Character({ sharedCanvas: false });
    this.hunter.setBodyColor('#2b2f3a');      // distinct dark hunter outfit
    this.hunter.setPose('aim');
    this.hunter.setArmSwing(false);           // keep the gun trained forward
    this.hunter.attachGun(this._paintColors[0]);
    // Tag every hunter mesh so shots & guesses never count the hunter itself
    this.hunter.getGroup().traverse(o => { o.userData.isHunter = true; });
    this.hunter.addToScene(this.renderer.scene);
    this.hunter.setPosition(spawn.x, 0, spawn.z);
    this.hunter.setRotation(yaw);
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
    document.removeEventListener('mousedown', this._onHunterShoot);
    if (this.seeker) this.seeker.disable();
    this.renderer.disableControls();
    if (this.hunter) {
      this.hunter.removeFromScene(this.renderer.scene);
      this.hunter.destroy();
      this.hunter = null;
    }
    this._clearEffects();
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
      case 'KeyW': case 'ArrowUp':    this.hiderKeys.w = true; break;
      case 'KeyA': case 'ArrowLeft':  this.hiderKeys.a = true; break;
      case 'KeyS': case 'ArrowDown':  this.hiderKeys.s = true; break;
      case 'KeyD': case 'ArrowRight': this.hiderKeys.d = true; break;
      case 'KeyL':
      case 'KeyE': // legacy lock key still works
        if (!this.hiderLocked) {
          this._transitionTo(STATE.HIDER_PAINT);
        }
        break;
    }
  }

  _handleHiderKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.hiderKeys.w = false; break;
      case 'KeyA': case 'ArrowLeft':  this.hiderKeys.a = false; break;
      case 'KeyS': case 'ArrowDown':  this.hiderKeys.s = false; break;
      case 'KeyD': case 'ArrowRight': this.hiderKeys.d = false; break;
    }
  }

  _updateHiderMovement(delta) {
    const pos = this.character.getPosition();

    if (!this.hiderLocked) {
      const speed = 4.5 * delta;

      // Movement is relative to where the camera is looking
      const camDir = new THREE.Vector3();
      this.renderer.camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();
      const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

      const move = new THREE.Vector3();
      if (this.hiderKeys.w) move.add(camDir);
      if (this.hiderKeys.s) move.sub(camDir);
      if (this.hiderKeys.d) move.add(right);
      if (this.hiderKeys.a) move.sub(right);

      const moving = move.lengthSq() > 0;
      this.character.setWalking(moving, 1);

      if (moving) {
        move.normalize().multiplyScalar(speed);
        let newX = pos.x + move.x;
        let newZ = pos.z + move.z;

        // Keep inside the map bounds
        if (this.mapData && this.mapData.bounds) {
          const b = this.mapData.bounds;
          newX = Math.max(b.minX + 0.5, Math.min(b.maxX - 0.5, newX));
          newZ = Math.max(b.minZ + 0.5, Math.min(b.maxZ - 0.5, newZ));
        }

        // Slide along walls instead of passing through them
        const resolved = this.renderer.resolveMove(pos.x, pos.z, newX, newZ, 0.35);
        this.character.setPosition(resolved.x, pos.y, resolved.z);

        // Turn the body to face the direction of travel
        this.hiderFacing = Math.atan2(move.x, move.z);
      }

      // Smoothly rotate the character toward its facing direction
      this.character.setRotation(
        this._lerpAngle(this.character.getRotation(), this.hiderFacing, Math.min(1, delta * 10))
      );
    }

    // Follow camera every frame (gives the smooth trailing motion)
    this._updateFollowCamera(delta);
  }

  /** Smooth third-person camera that trails behind the character's facing */
  _updateFollowCamera(delta) {
    const pos = this.character.getPosition();
    const dist = 5.2, height = 2.8;

    // Camera yaw eases toward the character's facing so turns feel cinematic
    this.camYaw = this._lerpAngle(this.camYaw, this.hiderFacing, Math.min(1, delta * 3.2));

    const behind = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)).multiplyScalar(dist);
    const desired = new THREE.Vector3(pos.x + behind.x, pos.y + height, pos.z + behind.z);

    this.renderer.camera.position.lerp(desired, Math.min(1, delta * 6));
    const target = new THREE.Vector3(pos.x, pos.y + 0.9, pos.z);
    this.renderer.camera.lookAt(target);
  }

  /** Place the camera directly behind the character with no easing */
  _snapFollowCamera() {
    const pos = this.character.getPosition();
    const dist = 5.2, height = 2.8;
    this.camYaw = this.hiderFacing;
    const behind = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)).multiplyScalar(dist);
    this.renderer.camera.position.set(pos.x + behind.x, pos.y + height, pos.z + behind.z);
    this.renderer.camera.lookAt(pos.x, pos.y + 0.9, pos.z);
  }

  /** Shortest-path angular interpolation */
  _lerpAngle(a, b, t) {
    let diff = (b - a) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  // ═══════════════ PER-FRAME DISPATCH ═══════════════

  _onFrame(delta) {
    if (this.state === STATE.HIDER_POSITION) {
      this._updateHiderMovement(delta);
    }
    if (this.character) this.character.update(delta);

    if (this.state === STATE.SEEKING && this.hunter) {
      this._syncHunter();
      this.hunter.update(delta);
    }

    if (this._effects.length) this._updateEffects(delta);
  }

  /** Match the hunter figure to the renderer's player position & aim yaw */
  _syncHunter() {
    const p = this.renderer.playerPosition;
    this.hunter.setPosition(p.x, 0, p.z);
    this.hunter.setRotation(this.renderer.getHunterYaw());
    this.hunter.setWalking(this.renderer.isHunterMoving(), 1);
  }

  // ═══════════════ PAINT-GUN SHOOTING ═══════════════

  _handleHunterShoot(event) {
    if (this.state !== STATE.SEEKING || !this.seeker || this.seeker.found) return;
    if (event.button !== 0) return;
    // The first click only grabs the pointer lock; shots need the lock held
    if (!document.pointerLockElement) return;

    // Raycast from screen centre, ignoring the hunter's own body & gun
    const targets = [];
    this.renderer.scene.traverse(obj => {
      if (obj.isMesh && !this._isHunterMesh(obj)) targets.push(obj);
    });
    const hits = this.renderer.raycastFromCenter(targets, false);

    // Where the paint lands (a far point if we hit nothing)
    const camDir = new THREE.Vector3();
    this.renderer.camera.getWorldDirection(camDir);
    const landing = hits.length
      ? hits[0].point.clone()
      : this.renderer.camera.position.clone().addScaledVector(camDir, 40);
    const normal = hits.length && hits[0].face
      ? hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld)
      : camDir.clone().negate();

    const color = this._paintColors[this._paintIndex++ % this._paintColors.length];
    if (this.hunter) this.hunter.setGunColor(color);
    this._spawnShotEffects(color, landing, normal);
    this.audio.play('click');

    // Did the paint strike the hider?
    const isHit = hits.length > 0 && this._isCharacterHit(hits[0].object);
    this.seeker.fire(isHit);
  }

  _isHunterMesh(mesh) {
    let cur = mesh;
    while (cur) {
      if (cur.userData && cur.userData.isHunter) return true;
      cur = cur.parent;
    }
    return false;
  }

  _isCharacterHit(mesh) {
    let cur = mesh;
    while (cur) {
      if (cur.userData && cur.userData.isCharacter) return true;
      cur = cur.parent;
    }
    return false;
  }

  /** Muzzle flash + tracer + a paint splat decal at the impact point */
  _spawnShotEffects(color, landing, normal) {
    const scene = this.renderer.scene;
    const now = performance.now();

    // Muzzle flash
    const muzzle = this.hunter ? this.hunter.getMuzzleWorld() : this.renderer.camera.position.clone();
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    flash.position.copy(muzzle);
    scene.add(flash);
    this._effects.push({ mesh: flash, born: now, ttl: 120, scale: true });

    // Tracer streak from muzzle to landing point
    const tracerGeom = new THREE.BufferGeometry().setFromPoints([muzzle, landing]);
    const tracer = new THREE.Line(tracerGeom,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    scene.add(tracer);
    this._effects.push({ mesh: tracer, born: now, ttl: 140 });

    // Paint splat decal on the surface it hit
    const splat = new THREE.Mesh(
      new THREE.CircleGeometry(0.18 + Math.random() * 0.12, 14),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
    );
    splat.position.copy(landing).addScaledVector(normal, 0.02);
    splat.lookAt(landing.clone().add(normal));
    scene.add(splat);
    this._effects.push({ mesh: splat, born: now, ttl: 2600, fade: true });
  }

  _updateEffects(delta) {
    const now = performance.now();
    for (let i = this._effects.length - 1; i >= 0; i--) {
      const fx = this._effects[i];
      const age = now - fx.born;
      const k = age / fx.ttl;
      if (k >= 1) {
        this.renderer.scene.remove(fx.mesh);
        fx.mesh.geometry?.dispose();
        fx.mesh.material?.dispose();
        this._effects.splice(i, 1);
        continue;
      }
      if (fx.scale) fx.mesh.scale.setScalar(1 + k * 2);
      if (fx.mesh.material && fx.mesh.material.opacity !== undefined) {
        const base = fx.fade ? 0.95 : (fx.scale ? 0.95 : 0.85);
        fx.mesh.material.opacity = fx.fade ? base * (1 - Math.max(0, k - 0.6) / 0.4) : base * (1 - k);
      }
    }
  }

  _clearEffects() {
    this._effects.forEach(fx => {
      this.renderer.scene.remove(fx.mesh);
      fx.mesh.geometry?.dispose();
      fx.mesh.material?.dispose();
    });
    this._effects = [];
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
        case 'KeyL': // unlock & go back to moving/repositioning
          this._transitionTo(STATE.HIDER_POSITION);
          break;
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
