// ═══════════════════════════════════════════════
// 🧍 CHARACTER — Paintable Blob with Poses
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
    this.bodyMesh = null;
    this.allMeshes = []; // All meshes that are part of the character (for raycasting)

    // Current pose
    this.currentPose = 'standing';

    // Poses
    this.poses = {
      standing:  { icon: '🧍', name: 'Stand',   scaleX: 1,   scaleY: 1,    scaleZ: 1,   rotX: 0,         posY: 0.75 },
      crouching: { icon: '🧎', name: 'Crouch',  scaleX: 1.1, scaleY: 0.6,  scaleZ: 1.1, rotX: 0,         posY: 0.45 },
      lying:     { icon: '🛌', name: 'Lie Down', scaleX: 1,   scaleY: 1,    scaleZ: 1,   rotX: Math.PI/2,  posY: 0.35 },
      ball:      { icon: '⚽', name: 'Ball',     scaleX: 0.8, scaleY: 0.65, scaleZ: 0.8, rotX: 0,         posY: 0.45 },
      flat:      { icon: '📏', name: 'Flat',     scaleX: 1.8, scaleY: 0.25, scaleZ: 1.8, rotX: 0,         posY: 0.2 },
      tall:      { icon: '🗿', name: 'Tall',     scaleX: 0.7, scaleY: 1.6,  scaleZ: 0.7, rotX: 0,         posY: 1.2 },
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
    // Initialize canvas to white
    this.textureCtx.fillStyle = '#ffffff';
    this.textureCtx.fillRect(0, 0, 512, 512);

    // Create texture from canvas
    this.texture = new THREE.CanvasTexture(this.textureCanvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.needsUpdate = true;

    // Material
    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.7,
      metalness: 0.05,
    });

    // Body — Capsule geometry
    const bodyGeom = new THREE.CapsuleGeometry(0.35, 0.8, 16, 24);
    this.bodyMesh = new THREE.Mesh(bodyGeom, material);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.bodyMesh.userData.isCharacter = true;
    this.group.add(this.bodyMesh);

    // Eyes (small spheres — non-paintable, always white/black)
    const eyeGeom = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const pupilGeom = new THREE.SphereGeometry(0.03, 8, 8);

    // Left eye
    const leftEye = new THREE.Mesh(eyeGeom, eyeWhiteMat);
    leftEye.position.set(-0.12, 0.55, 0.3);
    leftEye.userData.isCharacter = true;
    this.group.add(leftEye);

    const leftPupil = new THREE.Mesh(pupilGeom, pupilMat);
    leftPupil.position.set(-0.12, 0.55, 0.35);
    leftPupil.userData.isCharacter = true;
    this.group.add(leftPupil);

    // Right eye
    const rightEye = new THREE.Mesh(eyeGeom, eyeWhiteMat);
    rightEye.position.set(0.12, 0.55, 0.3);
    rightEye.userData.isCharacter = true;
    this.group.add(rightEye);

    const rightPupil = new THREE.Mesh(pupilGeom, pupilMat);
    rightPupil.position.set(0.12, 0.55, 0.35);
    rightPupil.userData.isCharacter = true;
    this.group.add(rightPupil);

    // Collect all meshes
    this.allMeshes = [this.bodyMesh, leftEye, leftPupil, rightEye, rightPupil];

    // Default position
    this.group.position.set(0, 0.75, 0);
  }

  /** Add character to a Three.js scene */
  addToScene(scene) {
    scene.add(this.group);
  }

  /** Remove from scene */
  removeFromScene(scene) {
    scene.remove(this.group);
  }

  /** Set world position */
  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }

  /** Get world position */
  getPosition() {
    return this.group.position.clone();
  }

  /** Set Y rotation */
  setRotation(yRad) {
    this.group.rotation.y = yRad;
  }

  /** Apply a named pose */
  setPose(poseName) {
    const pose = this.poses[poseName];
    if (!pose) return;

    this.currentPose = poseName;

    // Animate to the new pose
    const targetScale = new THREE.Vector3(pose.scaleX, pose.scaleY, pose.scaleZ);
    const targetRotX = pose.rotX;
    const targetPosY = pose.posY;

    // Simple direct application (could be animated with TWEEN later)
    this.bodyMesh.scale.copy(targetScale);
    this.bodyMesh.rotation.x = targetRotX;
    this.group.position.y = targetPosY;
  }

  /** Get list of available poses */
  getPoseList() {
    return Object.entries(this.poses).map(([key, pose]) => ({
      id: key,
      icon: pose.icon,
      name: pose.name,
    }));
  }

  /** Update the Three.js texture from the canvas */
  updateTexture() {
    if (this.texture) {
      this.texture.needsUpdate = true;
    }
  }

  /** Show/hide the character */
  show() { this.group.visible = true; }
  hide() { this.group.visible = false; }

  /** Get all meshes for raycasting */
  getMeshes() {
    return this.allMeshes;
  }

  /** Get the character group for raycasting */
  getGroup() {
    return this.group;
  }

  /** Reset to initial state */
  reset() {
    // Clear canvas to white
    this.textureCtx.fillStyle = '#ffffff';
    this.textureCtx.fillRect(0, 0, 512, 512);
    this.updateTexture();

    // Reset pose
    this.setPose('standing');
    this.group.rotation.y = 0;
    this.group.position.set(0, 0.75, 0);
  }

  /** Cleanup */
  destroy() {
    this.allMeshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    if (this.texture) this.texture.dispose();
  }
}
