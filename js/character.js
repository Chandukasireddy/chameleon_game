// ═══════════════════════════════════════════════
// 🧍 CHARACTER — Articulated Paintable Human Figure
// Smooth 3D-printed look · jointed limbs · walking · rich pose library
// ═══════════════════════════════════════════════

import * as THREE from 'three';

// Standing foot offset (lowest local point of the model when standing)
const STAND_Y = 0.66;

// Default relaxed arm splay
const ARM_REST = 0.16;

export class Character {
  constructor() {
    this.group = new THREE.Group();
    this.group.userData.isCharacter = true;

    // Texture canvas (512x512 for painting)
    this.textureCanvas = document.getElementById('paint-canvas') || this._createCanvas();
    this.textureCtx = this.textureCanvas.getContext('2d', { willReadFrequently: true });
    this.texture = null;

    // Body parts
    this.bodyMesh = null;    // torso — used for emissive effects
    this.bodyGroup = null;   // inner group transformed by poses
    this.allMeshes = [];

    // Limb pivots (joints) — rotated for poses & walking
    this.lArmPivot = null;
    this.rArmPivot = null;
    this.lLegPivot = null;
    this.rLegPivot = null;

    this.currentPose = 'standing';

    // Walking animation state
    this._walking = false;
    this._walkPhase = 0;
    this._walkSpeed = 1;

    // ── Pose library — shapes inspired by the figurine reference ──
    // Each joint rotation is relative to the rest pose.
    this.poses = {
      standing: { icon: '🧍', name: 'Stand',  posY: STAND_Y,
        lArm: { z:  ARM_REST }, rArm: { z: -ARM_REST } },

      tpose:    { icon: '🛫', name: 'Airplane', posY: STAND_Y,
        lArm: { z:  Math.PI / 2 }, rArm: { z: -Math.PI / 2 } },

      cheer:    { icon: '🙌', name: 'Cheer', posY: STAND_Y,
        lArm: { z:  2.5 }, rArm: { z: -2.5 } },

      handsup:  { icon: '🆙', name: 'Hands Up', posY: STAND_Y,
        lArm: { z:  3.0 }, rArm: { z: -3.0 } },

      handshead:{ icon: '🤦', name: 'Hands Head', posY: STAND_Y,
        lArm: { z:  2.4, x: -0.5 }, rArm: { z: -2.4, x: -0.5 } },

      star:     { icon: '⭐', name: 'Star', posY: STAND_Y,
        lArm: { z:  Math.PI / 2.3 }, rArm: { z: -Math.PI / 2.3 },
        lLeg: { z:  0.42 }, rLeg: { z: -0.42 } },

      crouch:   { icon: '🧎', name: 'Crouch', posY: 0.46, scaleY: 0.82,
        lArm: { x: -0.7, z: ARM_REST }, rArm: { x: -0.7, z: -ARM_REST },
        lLeg: { x:  0.9 }, rLeg: { x:  0.9 } },

      sit:      { icon: '🪑', name: 'Sit', posY: 0.42,
        lArm: { x: -1.2, z: ARM_REST }, rArm: { x: -1.2, z: -ARM_REST },
        lLeg: { x: -1.4 }, rLeg: { x: -1.4 } },

      kneel:    { icon: '🙏', name: 'Kneel', posY: 0.5,
        lArm: { x: -0.4 }, rArm: { x: -0.4 },
        lLeg: { x:  1.55 }, rLeg: { x:  1.55 } },

      lying:    { icon: '🛌', name: 'Lie Down', posY: 0.22, bodyRotX: Math.PI / 2,
        lArm: { z:  ARM_REST }, rArm: { z: -ARM_REST } },

      ball:     { icon: '🟠', name: 'Ball', posY: 0.4, scale: 0.78, bodyRotX: 0.5,
        lArm: { x: 2.0 }, rArm: { x: 2.0 },
        lLeg: { x: 2.3 }, rLeg: { x: 2.3 } },

      flat:     { icon: '📏', name: 'Flat', posY: 0.18, scaleY: 0.3, scale: 1.7 },
    };

    this._build();
  }

  _createCanvas() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    c.style.display = 'none';
    document.body.appendChild(c);
    return c;
  }

  _build() {
    this.textureCtx.fillStyle = '#d4b8a0';
    this.textureCtx.fillRect(0, 0, 512, 512);

    this.texture = new THREE.CanvasTexture(this.textureCanvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.needsUpdate = true;

    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.7,
      metalness: 0.02,
    });
    this.material = material;

    // Inner group — transformed by poses (origin at the hips, y = 0)
    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);

    const mkMesh = (geom, parent) => {
      const m = new THREE.Mesh(geom, material);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.isCharacter = true;
      (parent || this.bodyGroup).add(m);
      this.allMeshes.push(m);
      return m;
    };

    const mkPivot = (x, y, z) => {
      const p = new THREE.Group();
      p.position.set(x, y, z);
      this.bodyGroup.add(p);
      return p;
    };

    // ── Torso ── (slightly tapered capsule)
    const torso = mkMesh(new THREE.CapsuleGeometry(0.2, 0.4, 8, 16));
    torso.position.set(0, 0.32, 0);
    this.bodyMesh = torso;

    // ── Head ──
    const head = mkMesh(new THREE.SphereGeometry(0.21, 18, 16));
    head.position.set(0, 0.95, 0);

    // ── Arms (pivot at the shoulder, capsule hangs down) ──
    this.lArmPivot = mkPivot(-0.28, 0.58, 0);
    const lArm = mkMesh(new THREE.CapsuleGeometry(0.075, 0.4, 5, 12), this.lArmPivot);
    lArm.position.set(0, -0.27, 0);

    this.rArmPivot = mkPivot(0.28, 0.58, 0);
    const rArm = mkMesh(new THREE.CapsuleGeometry(0.075, 0.4, 5, 12), this.rArmPivot);
    rArm.position.set(0, -0.27, 0);

    // ── Legs (pivot at the hip, capsule hangs down) ──
    this.lLegPivot = mkPivot(-0.11, 0, 0);
    const lLeg = mkMesh(new THREE.CapsuleGeometry(0.1, 0.46, 5, 12), this.lLegPivot);
    lLeg.position.set(0, -0.33, 0);

    this.rLegPivot = mkPivot(0.11, 0, 0);
    const rLeg = mkMesh(new THREE.CapsuleGeometry(0.1, 0.46, 5, 12), this.rLegPivot);
    rLeg.position.set(0, -0.33, 0);

    this.group.position.set(0, STAND_Y, 0);
    this.setPose('standing');
  }

  addToScene(scene) { scene.add(this.group); }
  removeFromScene(scene) { scene.remove(this.group); }

  /** Place the character on the ground (y is driven by the active pose) */
  setPosition(x, y, z) {
    this.group.position.set(x, this._base ? this._base.posY : this.group.position.y, z);
  }
  getPosition() { return this.group.position.clone(); }

  setRotation(yRad) { this.group.rotation.y = yRad; }
  getRotation() { return this.group.rotation.y; }

  // ═══════════════ POSES ═══════════════

  setPose(poseName) {
    const pose = this.poses[poseName];
    if (!pose) return;
    this.currentPose = poseName;

    const sx = pose.scale ?? 1;
    const sy = (pose.scale ?? 1) * (pose.scaleY ?? 1);
    this.bodyGroup.scale.set(sx, sy, sx);
    this.bodyGroup.rotation.x = pose.bodyRotX ?? 0;
    this.group.position.y = pose.posY;

    // Cache base joint rotations so the walk cycle can layer on top.
    this._base = {
      posY: pose.posY,
      lArmX: pose.lArm?.x ?? 0, lArmZ: pose.lArm?.z ?? 0,
      rArmX: pose.rArm?.x ?? 0, rArmZ: pose.rArm?.z ?? 0,
      lLegX: pose.lLeg?.x ?? 0, lLegZ: pose.lLeg?.z ?? 0,
      rLegX: pose.rLeg?.x ?? 0, rLegZ: pose.rLeg?.z ?? 0,
    };
    this._applyBase();
  }

  _applyBase() {
    const b = this._base;
    this.lArmPivot.rotation.set(b.lArmX, 0, b.lArmZ);
    this.rArmPivot.rotation.set(b.rArmX, 0, b.rArmZ);
    this.lLegPivot.rotation.set(b.lLegX, 0, b.lLegZ);
    this.rLegPivot.rotation.set(b.rLegX, 0, b.rLegZ);
  }

  /** Poses that read naturally with a walk cycle */
  _isWalkablePose() {
    return ['standing', 'tpose', 'cheer', 'handsup', 'handshead', 'star', 'crouch'].includes(this.currentPose);
  }

  getPoseList() {
    return Object.entries(this.poses).map(([key, pose]) => ({
      id: key, icon: pose.icon, name: pose.name,
    }));
  }

  // ═══════════════ ANIMATION ═══════════════

  setWalking(isWalking, speed = 1) {
    this._walking = isWalking;
    this._walkSpeed = speed;
  }

  /** Called every frame from the render loop */
  update(delta) {
    const b = this._base;
    if (!b) return;

    if (this._walking && this._isWalkablePose()) {
      this._walkPhase += delta * (6 + this._walkSpeed * 4);
      const swing = Math.sin(this._walkPhase) * 0.55;
      const bob = Math.abs(Math.sin(this._walkPhase)) * 0.05;

      this.lLegPivot.rotation.x = b.lLegX + swing;
      this.rLegPivot.rotation.x = b.rLegX - swing;
      this.lArmPivot.rotation.x = b.lArmX - swing * 0.7;
      this.rArmPivot.rotation.x = b.rArmX + swing * 0.7;
      this.group.position.y = b.posY + bob;
    } else {
      // Ease the limbs back to the resting pose
      const k = Math.min(1, delta * 12);
      this.lLegPivot.rotation.x += (b.lLegX - this.lLegPivot.rotation.x) * k;
      this.rLegPivot.rotation.x += (b.rLegX - this.rLegPivot.rotation.x) * k;
      this.lArmPivot.rotation.x += (b.lArmX - this.lArmPivot.rotation.x) * k;
      this.rArmPivot.rotation.x += (b.rArmX - this.rArmPivot.rotation.x) * k;
      this.group.position.y += (b.posY - this.group.position.y) * k;
    }
  }

  updateTexture() {
    if (this.texture) this.texture.needsUpdate = true;
  }

  show() { this.group.visible = true; }
  hide() { this.group.visible = false; }

  getMeshes() { return this.allMeshes; }
  getGroup()  { return this.group; }

  reset() {
    this.textureCtx.fillStyle = '#d4b8a0';
    this.textureCtx.fillRect(0, 0, 512, 512);
    this.updateTexture();

    this._walking = false;
    this._walkPhase = 0;
    this.group.rotation.set(0, 0, 0);
    this.setPose('standing');
    this.group.position.set(0, STAND_Y, 0);
  }

  destroy() {
    this.allMeshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
    });
    if (this.material) this.material.dispose();
    if (this.texture) this.texture.dispose();
  }
}
