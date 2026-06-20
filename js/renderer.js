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
    this.renderer.toneMappingExposure = 1.0;
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

      // Update FPS movement
      if (this.controlMode === 'fps') {
        this._updateFPSMovement(delta);
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
      const newPos = this.camera.position.clone().add(move);

      // Enforce bounds
      if (this.bounds) {
        newPos.x = Math.max(this.bounds.minX + 0.5, Math.min(this.bounds.maxX - 0.5, newPos.x));
        newPos.z = Math.max(this.bounds.minZ + 0.5, Math.min(this.bounds.maxZ - 0.5, newPos.z));
      }
      newPos.y = 1.7; // Fixed eye height

      this.camera.position.copy(newPos);
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
    if (this.controlMode === 'fps') {
      switch (e.code) {
        case 'KeyW': this.fpsState.moveForward = true; break;
        case 'KeyS': this.fpsState.moveBackward = true; break;
        case 'KeyA': this.fpsState.moveLeft = true; break;
        case 'KeyD': this.fpsState.moveRight = true; break;
      }
    }
  }

  _handleKeyUp(e) {
    if (this.controlMode === 'fps') {
      switch (e.code) {
        case 'KeyW': this.fpsState.moveForward = false; break;
        case 'KeyS': this.fpsState.moveBackward = false; break;
        case 'KeyA': this.fpsState.moveLeft = false; break;
        case 'KeyD': this.fpsState.moveRight = false; break;
      }
    }
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
