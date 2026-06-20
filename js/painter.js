// ═══════════════════════════════════════════════
// 🎨 PAINTER — Paint Tool for Character Texture
// Direct 3D painting + Eyedropper from environment
// ═══════════════════════════════════════════════

export class PaintTool {
  constructor(character, renderer) {
    this.character = character;
    this.renderer = renderer;

    // Paint canvas & context
    this.canvas = character.textureCanvas;
    this.ctx = character.textureCtx;

    // Tool state
    this.currentTool = 'brush';   // brush, eyedropper, fill, eraser
    this.currentColor = '#ffffff';
    this.brushSize = 12;
    this.opacity = 1.0;
    this.isActive = false;

    // Undo/Redo
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = 30;

    // Painting state
    this.isPainting = false;
    this.lastPaintUV = null;

    // Callbacks
    this.onColorChange = null;

    // Bound handlers
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);

    // Save initial state
    this._saveUndo();
  }

  /** Enable painting mode */
  enable() {
    this.isActive = true;
    const canvas = this.renderer.renderer.domElement;
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('mouseleave', this._onMouseUp);
  }

  /** Disable painting mode */
  disable() {
    this.isActive = false;
    this.isPainting = false;
    const canvas = this.renderer.renderer.domElement;
    canvas.removeEventListener('mousedown', this._onMouseDown);
    canvas.removeEventListener('mousemove', this._onMouseMove);
    canvas.removeEventListener('mouseup', this._onMouseUp);
    canvas.removeEventListener('mouseleave', this._onMouseUp);
  }

  setTool(toolName) {
    this.currentTool = toolName;
  }

  setColor(hexColor) {
    this.currentColor = hexColor;
    // Update the color preview
    const preview = document.getElementById('color-preview');
    if (preview) preview.style.background = hexColor;
    const input = document.getElementById('color-input');
    if (input) input.value = hexColor;
  }

  setBrushSize(size) {
    this.brushSize = Math.max(2, Math.min(60, size));
  }

  setOpacity(opacity) {
    this.opacity = Math.max(0.1, Math.min(1.0, opacity));
  }

  // ─── Undo / Redo ───

  _saveUndo() {
    const imageData = this.ctx.getImageData(0, 0, 512, 512);
    this.undoStack.push(imageData);
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo on new action
  }

  undo() {
    if (this.undoStack.length <= 1) return; // Keep at least initial state
    const current = this.undoStack.pop();
    this.redoStack.push(current);
    const prev = this.undoStack[this.undoStack.length - 1];
    this.ctx.putImageData(prev, 0, 0);
    this.character.updateTexture();
    this._updatePreview();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this.ctx.putImageData(next, 0, 0);
    this.character.updateTexture();
    this._updatePreview();
  }

  clear() {
    this._saveUndo();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, 512, 512);
    this.character.updateTexture();
    this._updatePreview();
  }

  // ─── Paint Operations ───

  _paintAtUV(u, v) {
    const x = u * 512;
    const y = (1 - v) * 512;

    this.ctx.save();
    this.ctx.globalAlpha = this.opacity;

    if (this.currentTool === 'brush') {
      this.ctx.fillStyle = this.currentColor;
      this.ctx.beginPath();
      this.ctx.arc(x, y, this.brushSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Smooth stroke between last and current point
      if (this.lastPaintUV) {
        const lx = this.lastPaintUV.u * 512;
        const ly = (1 - this.lastPaintUV.v) * 512;
        this.ctx.lineWidth = this.brushSize * 2;
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(lx, ly);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
      }
    } else if (this.currentTool === 'eraser') {
      // Erase to white
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(x, y, this.brushSize, 0, Math.PI * 2);
      this.ctx.fill();

      if (this.lastPaintUV) {
        const lx = this.lastPaintUV.u * 512;
        const ly = (1 - this.lastPaintUV.v) * 512;
        this.ctx.lineWidth = this.brushSize * 2;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(lx, ly);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
      }
    } else if (this.currentTool === 'fill') {
      // Simple fill — fill whole canvas with current color
      this.ctx.fillStyle = this.currentColor;
      this.ctx.fillRect(0, 0, 512, 512);
    }

    this.ctx.restore();
    this.character.updateTexture();
    this.lastPaintUV = { u, v };
  }

  _eyedropFromScene(event) {
    // Raycast against all non-character objects
    const allObjects = [];
    this.renderer.scene.traverse(obj => {
      if (obj.isMesh && !obj.userData.isCharacter) {
        allObjects.push(obj);
      }
    });

    const intersects = this.renderer.raycast(event, allObjects, false);
    if (intersects.length > 0) {
      const color = this.renderer.getColorAtIntersection(intersects[0]);
      this.setColor(this._normalizeColor(color));
      if (this.onColorChange) this.onColorChange(this.currentColor);
    }
  }

  _normalizeColor(color) {
    // Convert various formats to hex
    if (color.startsWith('#')) return color;
    if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]).toString(16).padStart(2, '0');
        const g = parseInt(match[1]).toString(16).padStart(2, '0');
        const b = parseInt(match[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return color;
  }

  // ─── Event Handlers ───

  _handleMouseDown(event) {
    if (!this.isActive) return;
    if (event.button === 2) return; // Right click = camera orbit
    if (event.button !== 0) return;

    if (this.currentTool === 'eyedropper') {
      this._eyedropFromScene(event);
      return;
    }

    // Raycast against character
    const intersects = this.renderer.raycast(event, this.character.getMeshes(), false);

    if (intersects.length > 0 && intersects[0].uv) {
      this._saveUndo();
      this.isPainting = true;
      this.lastPaintUV = null;
      this._paintAtUV(intersects[0].uv.x, intersects[0].uv.y);
    } else if (intersects.length > 0 && !intersects[0].uv) {
      // Hit character but no UV (eyes etc) — use approximate UV
      this._saveUndo();
      this.isPainting = true;
      this.lastPaintUV = null;
      // Map world position to approximate UV
      const localPos = this.character.getGroup().worldToLocal(intersects[0].point.clone());
      const u = (Math.atan2(localPos.x, localPos.z) / Math.PI + 1) / 2;
      const v = (localPos.y + 0.75) / 1.5;
      this._paintAtUV(u, Math.max(0, Math.min(1, v)));
    } else {
      // Clicked empty space — if eyedropper, sample from environment
      if (this.currentTool === 'eyedropper') {
        this._eyedropFromScene(event);
      }
    }
  }

  _handleMouseMove(event) {
    if (!this.isActive || !this.isPainting) return;
    if (this.currentTool === 'eyedropper') return;

    const intersects = this.renderer.raycast(event, this.character.getMeshes(), false);
    if (intersects.length > 0 && intersects[0].uv) {
      this._paintAtUV(intersects[0].uv.x, intersects[0].uv.y);
    } else if (intersects.length > 0) {
      const localPos = this.character.getGroup().worldToLocal(intersects[0].point.clone());
      const u = (Math.atan2(localPos.x, localPos.z) / Math.PI + 1) / 2;
      const v = (localPos.y + 0.75) / 1.5;
      this._paintAtUV(u, Math.max(0, Math.min(1, v)));
    }
  }

  _handleMouseUp() {
    if (this.isPainting) {
      this.isPainting = false;
      this.lastPaintUV = null;
      this._updatePreview();
    }
  }

  /** Update the texture preview canvas */
  _updatePreview() {
    const preview = document.getElementById('texture-preview');
    if (!preview) return;
    const pctx = preview.getContext('2d');
    pctx.clearRect(0, 0, preview.width, preview.height);
    pctx.drawImage(this.canvas, 0, 0, preview.width, preview.height);
  }

  /** Force update preview */
  updatePreview() {
    this._updatePreview();
  }

  destroy() {
    this.disable();
    this.undoStack = [];
    this.redoStack = [];
  }
}
