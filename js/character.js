// ═══════════════════════════════════════════════
// 🧍 CHARACTER — Paintable Human Figure with Poses
// ═══════════════════════════════════════════════

import * as THREE from 'three';

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
    this.bodyGroup = null;   // inner group scaled by poses
    this.allMeshes = [];

    this.currentPose = 'standing';

    this.poses = {
      standing:  { icon: '🧍', name: 'Stand',   scaleX: 1,   scaleY: 1,    scaleZ: 1,   rotX: 0,          posY: 0.75 },
      crouching: { icon: '🧎', name: 'Crouch',  scaleX: 1.1, scaleY: 0.62, scaleZ: 1.1, rotX: 0,          posY: 0.48 },
      lying:     { icon: '🛌', name: 'Lie Down', scaleX: 1,   scaleY: 1,    scaleZ: 1,   rotX: Math.PI/2,  posY: 0.35 },
      ball:      { icon: '⚽', name: 'Ball',     scaleX: 0.8, scaleY: 0.65, scaleZ: 0.8, rotX: 0,          posY: 0.48 },
      flat:      { icon: '📏', name: 'Flat',     scaleX: 1.8, scaleY: 0.26, scaleZ: 1.8, rotX: 0,          posY: 0.21 },
      tall:      { icon: '🗿', name: 'Tall',     scaleX: 0.7, scaleY: 1.6,  scaleZ: 0.7, rotX: 0,          posY: 1.22 },
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
      roughness: 0.75,
      metalness: 0.02,
    });

    // Inner group — scaled/rotated by poses
    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);

    const mkMesh = (geom) => {
      const m = new THREE.Mesh(geom, material);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.isCharacter = true;
      this.bodyGroup.add(m);
      return m;
    };

    // ── Head ──
    const head = mkMesh(new THREE.SphereGeometry(0.2, 14, 12));
    head.position.set(0, 0.67, 0);

    // ── Torso ──
    const torso = mkMesh(new THREE.CapsuleGeometry(0.19, 0.38, 6, 14));
    torso.position.set(0, 0.18, 0);
    this.bodyMesh = torso;

    // ── Left arm ──
    const lArm = mkMesh(new THREE.CapsuleGeometry(0.07, 0.36, 4, 10));
    lArm.position.set(-0.31, 0.14, 0);
    lArm.rotation.z = Math.PI / 10;

    // ── Right arm ──
    const rArm = mkMesh(new THREE.CapsuleGeometry(0.07, 0.36, 4, 10));
    rArm.position.set(0.31, 0.14, 0);
    rArm.rotation.z = -Math.PI / 10;

    // ── Left leg ──
    const lLeg = mkMesh(new THREE.CapsuleGeometry(0.095, 0.42, 4, 10));
    lLeg.position.set(-0.1, -0.4, 0);

    // ── Right leg ──
    const rLeg = mkMesh(new THREE.CapsuleGeometry(0.095, 0.42, 4, 10));
    rLeg.position.set(0.1, -0.4, 0);

    this.allMeshes = [head, torso, lArm, rArm, lLeg, rLeg];

    this.group.position.set(0, 0.75, 0);
  }

  addToScene(scene) { scene.add(this.group); }
  removeFromScene(scene) { scene.remove(this.group); }

  setPosition(x, y, z) { this.group.position.set(x, y, z); }
  getPosition() { return this.group.position.clone(); }

  setRotation(yRad) { this.group.rotation.y = yRad; }

  setPose(poseName) {
    const pose = this.poses[poseName];
    if (!pose) return;
    this.currentPose = poseName;
    this.bodyGroup.scale.set(pose.scaleX, pose.scaleY, pose.scaleZ);
    this.bodyGroup.rotation.x = pose.rotX;
    this.group.position.y = pose.posY;
  }

  getPoseList() {
    return Object.entries(this.poses).map(([key, pose]) => ({
      id: key, icon: pose.icon, name: pose.name,
    }));
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

    this.setPose('standing');
    this.group.rotation.y = 0;
    this.group.position.set(0, 0.75, 0);
  }

  destroy() {
    this.allMeshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    if (this.texture) this.texture.dispose();
  }
}
