// ═══════════════════════════════════════════════
// 🔍 SEEKER — Click detection for finding character
// ═══════════════════════════════════════════════

export class SeekerMode {
  constructor(renderer, character) {
    this.renderer = renderer;
    this.character = character;

    this.isActive = false;
    this.maxGuesses = 5;
    this.guessesUsed = 0;
    this.found = false;

    // Callbacks
    this.onFound = null;
    this.onMiss = null;
    this.onOutOfGuesses = null;
  }

  /** Enable seeker mode */
  enable(maxGuesses = 5) {
    this.isActive = true;
    this.maxGuesses = maxGuesses;
    this.guessesUsed = 0;
    this.found = false;
  }

  /** Disable seeker mode */
  disable() {
    this.isActive = false;
  }

  get guessesLeft() {
    if (this.maxGuesses === 0) return Infinity; // Unlimited
    return Math.max(0, this.maxGuesses - this.guessesUsed);
  }

  /** Called from main.js on double-click while pointer is locked */
  processClick(event) {
    if (!this.isActive || this.found) return;
    this._processRaycast(event, document.pointerLockElement != null);
  }

  /**
   * Register a paint-gun shot. The caller does the raycast (so it can exclude
   * the hunter's own body) and tells us whether the hider was struck.
   */
  fire(isHit) {
    if (!this.isActive || this.found) return;
    if (isHit) this._registerHit(null);
    else this._registerMiss(null);
  }

  _processRaycast(event, fromCenter) {
    // Get all scene objects for raycasting
    const allObjects = [];
    this.renderer.scene.traverse(obj => {
      if (obj.isMesh) allObjects.push(obj);
    });

    let intersects;
    if (fromCenter) {
      intersects = this.renderer.raycastFromCenter(allObjects, false);
    } else {
      intersects = this.renderer.raycast(event, allObjects, false);
    }

    if (intersects.length === 0) {
      this._registerMiss(event);
      return;
    }

    // Check if the FIRST hit is the character
    const firstHit = intersects[0];
    const isCharacterHit = this._isCharacterMesh(firstHit.object);

    if (isCharacterHit) {
      this._registerHit(event);
    } else {
      this._registerMiss(event);
    }
  }

  _isCharacterMesh(mesh) {
    // Check the mesh and its parents for the character flag
    let current = mesh;
    while (current) {
      if (current.userData && current.userData.isCharacter) return true;
      current = current.parent;
    }
    return false;
  }

  _registerHit(event) {
    this.found = true;
    this.guessesUsed++;
    this._showClickFeedback(event, true);
    if (this.onFound) this.onFound(event);
  }

  _registerMiss(event) {
    this.guessesUsed++;
    this._showClickFeedback(event, false);

    if (this.onMiss) {
      this.onMiss(event, this.guessesLeft);
    }

    if (this.maxGuesses > 0 && this.guessesLeft <= 0) {
      if (this.onOutOfGuesses) this.onOutOfGuesses();
    }
  }

  _showClickFeedback(event, isHit) {
    const feedback = document.getElementById('click-feedback');
    if (!feedback) return;

    let x, y;
    if (document.pointerLockElement) {
      x = window.innerWidth / 2;
      y = window.innerHeight / 2;
    } else {
      x = event.clientX;
      y = event.clientY;
    }

    feedback.style.left = x + 'px';
    feedback.style.top = y + 'px';
    feedback.className = 'click-feedback ' + (isHit ? 'hit' : 'miss');

    // Remove after animation
    setTimeout(() => {
      feedback.className = 'click-feedback hidden';
    }, isHit ? 800 : 600);
  }

  destroy() {
    this.disable();
  }
}
