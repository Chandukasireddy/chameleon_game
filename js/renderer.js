// ═══════════════════════════════════════════════
// 🎬 RENDERER — Three.js Scene, Camera, Controls
// ═══════════════════════════════════════════════

import * as THREE from 'three';

export class GameRenderer {
  constructor(container) {
    this.container = container;

    // ─── Scene ───
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06060d);
    this.scene.fog = new THREE.FogExp2(0x06060d, 0.015);

    // ─── Camera ───
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.camera.position.set(0, 5, 10);

    // ─── Renderer ───
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // ─── Raycaster ───
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // ─── Camera Controls State ───
    this.controlMode = 'none'; // 'orbit', 'fps', 'none'
    this.orbitState = {
      target: new THREE.Vector3(0, 1, 0),
      angle: 0,
      angleY: 0.5,
      radius: 6,
      isDragging: false,
      lastMouse: { x: 0, y: 0 },
    };
    this.fpsState = {
      yaw: 0,
      pitch: 0,
      moveForward: false,
      moveBackward: false,
      moveLeft: false,
      moveRight: false,
      moveSpeed: 8,
      lookSpeed: 0.002,
      isLocked: false,
    };

    // Movement bounds (set per map)
    this.bounds = null;

    // Solid colliders (axis-aligned boxes) — walls & props
    this.colliders = [];

    // Third-person hunter state
    this.playerPosition = new THREE.Vector3();
    this._hunterMoving = false;

    // ─── Animation ───
    this.animationId = null;
    this.onRenderCallback = null;
    this.clock = new THREE.Clock();

    // ─── Event handlers (bound) ───
    this._onResize = this._handleResize.bind(this);
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onContextMenu = (e) => e.preventDefault();

    window.addEventListener('resize', this._onResize);
  }

  // ═══════════════ CAMERA MODES ═══════════════

  enableOrbitControls(target = new THREE.Vector3(0, 1, 0)) {
    this.disableControls();
    this.controlMode = 'orbit';
    this.orbitState.target.copy(target);
    this.orbitState.angle = 0;
    this.orbitState.angleY = 0.5;
    this.orbitState.radius = 6;

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('wheel', this._onWheel);
    canvas.addEventListener('contextmenu', this._onContextMenu);

    this._updateOrbitCamera();
  }

  enableFPSControls(startPos = new THREE.Vector3(0, 1.7, 0), startYaw = 0) {
    this.disableControls();
    this.controlMode = 'fps';
    this.camera.position.copy(startPos);
    this.fpsState.yaw = startYaw;
    this.fpsState.pitch = 0;

    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (!this.fpsState.isLocked) {
        canvas.requestPointerLock();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.fpsState.isLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);

    this._updateFPSCamera();
  }

  /**
   * Third-person hunter controls: mouse aims (pointer lock), WASD walks the
   * body around with wall-sliding collision, camera trails over the shoulder.
   */
  enableThirdPersonControls(startPos = new THREE.Vector3(0, 0, 0), startYaw = 0) {
    this.disableControls();
    this.controlMode = 'hunter';
    this.playerPosition.set(startPos.x, 0, startPos.z);
    this.fpsState.yaw = startYaw;
    this.fpsState.pitch = -0.12;
    this._hunterMoving = false;

    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', this._onRequestLock = () => {
      if (!this.fpsState.isLocked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', this._onLockChange = () => {
      this.fpsState.isLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);

    this._updateThirdPersonCamera();
  }

  isHunterMoving() { return this._hunterMoving; }
  getHunterYaw() { return this.fpsState.yaw; }

  disableControls() {
    this.controlMode = 'none';
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this._onMouseDown);
    canvas.removeEventListener('mousemove', this._onMouseMove);
    canvas.removeEventListener('mouseup', this._onMouseUp);
    canvas.removeEventListener('wheel', this._onWheel);
    canvas.removeEventListener('contextmenu', this._onContextMenu);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    if (this._onRequestLock) { canvas.removeEventListener('click', this._onRequestLock); this._onRequestLock = null; }
    if (this._onLockChange) { document.removeEventListener('pointerlockchange', this._onLockChange); this._onLockChange = null; }

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.fpsState.isLocked = false;
    this.fpsState.moveForward = false;
    this.fpsState.moveBackward = false;
    this.fpsState.moveLeft = false;
    this.fpsState.moveRight = false;
  }

  // ═══════════════ RAYCASTING ═══════════════

  /** Raycast from a mouse/click event against given objects */
  raycast(event, objects, recursive = true) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(objects, recursive);
    return intersects;
  }

  /** Raycast from screen center (for FPS mode) */
  raycastFromCenter(objects, recursive = true) {
    this.mouse.set(0, 0);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(objects, recursive);
  }

  /** Get the color of a mesh at an intersection point via its material */
  getColorAtIntersection(intersection) {
    const obj = intersection.object;
    if (!obj.material) return '#808080';

    // If it has a map texture and UV coords, sample the texture
    if (obj.material.map && intersection.uv) {
      return this._sampleTexture(obj.material.map, intersection.uv);
    }

    // Otherwise return the material color
    if (obj.material.color) {
      return '#' + obj.material.color.getHexString();
    }
    return '#808080';
  }

  _sampleTexture(texture, uv) {
    const image = texture.image;
    if (!image) return '#808080';

    // Draw image to temp canvas and sample pixel
    const canvas = document.createElement('canvas');
    canvas.width = image.width || 64;
    canvas.height = image.height || 64;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const x = Math.floor(uv.x * canvas.width) % canvas.width;
    const y = Math.floor((1 - uv.y) * canvas.height) % canvas.height;
    const pixel = ctx.getImageData(Math.abs(x), Math.abs(y), 1, 1).data;
    return `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
  }

  // ═══════════════ RENDERING ═══════════════

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  startLoop() {
    this.clock.start();
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      const delta = this.clock.getDelta();

      // Update movement for the active control mode
      if (this.controlMode === 'fps') {
        this._updateFPSMovement(delta);
      } else if (this.controlMode === 'hunter') {
        this._updateThirdPersonMovement(delta);
      }

      if (this.onRenderCallback) {
        this.onRenderCallback(delta);
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  stopLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /** Remove all objects from scene (except lights) */
  clearScene() {
    const toRemove = [];
    this.scene.traverse(child => {
      if (child !== this.scene) {
        toRemove.push(child);
      }
    });
    // Only remove top-level children
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      this.scene.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  setBounds(bounds) {
    this.bounds = bounds;
  }

  setColliders(colliders) {
    this.colliders = colliders || [];
  }

  /** True if a circle (cx,cz,r) overlaps any solid collider box */
  collidesAt(cx, cz, r) {
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (cx > c.minX - r && cx < c.maxX + r && cz > c.minZ - r && cz < c.maxZ + r) {
        return true;
      }
    }
    return false;
  }

  /**
   * Resolve a desired move with wall sliding: each axis is tried
   * independently so the body slides along surfaces instead of stopping
   * dead or passing through them.
   */
  resolveMove(oldX, oldZ, newX, newZ, r) {
    let x = oldX, z = oldZ;
    if (!this.collidesAt(newX, z, r)) x = newX;
    if (!this.collidesAt(x, newZ, r)) z = newZ;
    return { x, z };
  }

  setFog(color, density) {
    this.scene.fog = new THREE.FogExp2(color, density);
  }

  setBackground(color) {
    this.scene.background = new THREE.Color(color);
  }

  // ═══════════════ INTERNAL: Camera Updates ═══════════════

  _updateOrbitCamera() {
    const s = this.orbitState;
    const x = s.target.x + s.radius * Math.cos(s.angleY) * Math.sin(s.angle);
    const y = s.target.y + s.radius * Math.sin(s.angleY);
    const z = s.target.z + s.radius * Math.cos(s.angleY) * Math.cos(s.angle);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(s.target);
  }

  _updateFPSCamera() {
    const s = this.fpsState;
    const euler = new THREE.Euler(s.pitch, s.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  _updateFPSMovement(delta) {
    const s = this.fpsState;
    const speed = s.moveSpeed * delta;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (s.moveForward) move.add(dir);
    if (s.moveBackward) move.sub(dir);
    if (s.moveRight) move.add(right);
    if (s.moveLeft) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      let newX = this.camera.position.x + move.x;
      let newZ = this.camera.position.z + move.z;

      // Enforce bounds
      if (this.bounds) {
        newX = Math.max(this.bounds.minX + 0.5, Math.min(this.bounds.maxX - 0.5, newX));
        newZ = Math.max(this.bounds.minZ + 0.5, Math.min(this.bounds.maxZ - 0.5, newZ));
      }

      // Slide along walls instead of clipping through them
      const r = 0.4;
      const resolved = this.resolveMove(this.camera.position.x, this.camera.position.z, newX, newZ, r);

      this.camera.position.x = resolved.x;
      this.camera.position.z = resolved.z;
      this.camera.position.y = 1.7; // Fixed eye height
    }
  }

  // ═══════════════ INTERNAL: Event Handlers ═══════════════

  _handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _handleMouseDown(e) {
    if (this.controlMode === 'orbit' && e.button === 2) {
      this.orbitState.isDragging = true;
      this.orbitState.lastMouse = { x: e.clientX, y: e.clientY };
    }
  }

  _handleMouseMove(e) {
    if (this.controlMode === 'orbit' && this.orbitState.isDragging) {
      const dx = e.clientX - this.orbitState.lastMouse.x;
      const dy = e.clientY - this.orbitState.lastMouse.y;
      this.orbitState.angle -= dx * 0.005;
      this.orbitState.angleY = Math.max(0.1, Math.min(1.4, this.orbitState.angleY + dy * 0.005));
      this.orbitState.lastMouse = { x: e.clientX, y: e.clientY };
      this._updateOrbitCamera();
    }

    if (this.controlMode === 'fps' && this.fpsState.isLocked) {
      this.fpsState.yaw -= e.movementX * this.fpsState.lookSpeed;
      this.fpsState.pitch -= e.movementY * this.fpsState.lookSpeed;
      this.fpsState.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.fpsState.pitch));
      this._updateFPSCamera();
    }

    if (this.controlMode === 'hunter' && this.fpsState.isLocked) {
      this.fpsState.yaw -= e.movementX * this.fpsState.lookSpeed;
      this.fpsState.pitch -= e.movementY * this.fpsState.lookSpeed;
      this.fpsState.pitch = Math.max(-0.9, Math.min(0.55, this.fpsState.pitch));
      this._updateThirdPersonCamera();
    }
  }

  _handleMouseUp(e) {
    if (e.button === 2) {
      this.orbitState.isDragging = false;
    }
  }

  _handleWheel(e) {
    if (this.controlMode === 'orbit') {
      this.orbitState.radius = Math.max(2, Math.min(20, this.orbitState.radius + e.deltaY * 0.01));
      this._updateOrbitCamera();
    }
  }

  _handleKeyDown(e) {
    if (this.controlMode === 'fps' || this.controlMode === 'hunter') {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    this.fpsState.moveForward  = true; break;
        case 'KeyS': case 'ArrowDown':  this.fpsState.moveBackward = true; break;
        case 'KeyA': case 'ArrowLeft':  this.fpsState.moveLeft     = true; break;
        case 'KeyD': case 'ArrowRight': this.fpsState.moveRight    = true; break;
      }
    }
  }

  _handleKeyUp(e) {
    if (this.controlMode === 'fps' || this.controlMode === 'hunter') {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    this.fpsState.moveForward  = false; break;
        case 'KeyS': case 'ArrowDown':  this.fpsState.moveBackward = false; break;
        case 'KeyA': case 'ArrowLeft':  this.fpsState.moveLeft     = false; break;
        case 'KeyD': case 'ArrowRight': this.fpsState.moveRight    = false; break;
      }
    }
  }

  // ═══════════════ THIRD-PERSON (HUNTER) CAMERA & MOVEMENT ═══════════════

  _updateThirdPersonMovement(delta) {
    const s = this.fpsState;
    const speed = s.moveSpeed * 0.8 * delta;

    // Horizontal forward/right derived from yaw only (so aiming up/down
    // doesn't slow you down)
    const forward = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw));
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (s.moveForward) move.add(forward);
    if (s.moveBackward) move.sub(forward);
    if (s.moveRight) move.add(right);
    if (s.moveLeft) move.sub(right);

    this._hunterMoving = move.lengthSq() > 0;

    if (this._hunterMoving) {
      move.normalize().multiplyScalar(speed);
      let newX = this.playerPosition.x + move.x;
      let newZ = this.playerPosition.z + move.z;

      if (this.bounds) {
        newX = Math.max(this.bounds.minX + 0.5, Math.min(this.bounds.maxX - 0.5, newX));
        newZ = Math.max(this.bounds.minZ + 0.5, Math.min(this.bounds.maxZ - 0.5, newZ));
      }

      const resolved = this.resolveMove(this.playerPosition.x, this.playerPosition.z, newX, newZ, 0.4);
      this.playerPosition.x = resolved.x;
      this.playerPosition.z = resolved.z;
    }

    this._updateThirdPersonCamera();
  }

  _updateThirdPersonCamera() {
    const s = this.fpsState;
    const dist = 4.2;
    const pivot = new THREE.Vector3(this.playerPosition.x, 1.5, this.playerPosition.z);

    this.camera.quaternion.setFromEuler(new THREE.Euler(s.pitch, s.yaw, 0, 'YXZ'));
    const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    // Place the camera behind the pivot, looking forward through it
    this.camera.position.copy(pivot).addScaledVector(lookDir, -dist);
    if (this.camera.position.y < 0.4) this.camera.position.y = 0.4;
  }

  // ═══════════════ CLEANUP ═══════════════

  destroy() {
    this.stopLoop();
    this.disableControls();
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.clearScene();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
