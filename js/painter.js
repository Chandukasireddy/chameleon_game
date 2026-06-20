// ═══════════════════════════════════════════════
// 🎨 PAINTER — Natural soft-brush painting on character texture
// ═══════════════════════════════════════════════

export class PaintTool {
  constructor(character, renderer) {
    this.character = character;
    this.renderer = renderer;

    this.canvas = character.textureCanvas;
    this.ctx = character.textureCtx;

    this.currentTool = 'brush';
    this.currentColor = '#ffffff';
    this.brushSize = 18;
    this.opacity = 1.0;
    this.isActive = false;

    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = 30;

    this.isPainting = false;
    this.lastPaintUV = null;

    this.onColorChange = null;

    this._onMouseDown   = this._handleMouseDown.bind(this);
    this._onMouseMove   = this._handleMouseMove.bind(this);
    this._onMouseUp     = this._handleMouseUp.bind(this);
    this._onCursorMove  = this._handleCursorMove.bind(this);
    this._onCanvasLeave = this._handleCanvasLeave.bind(this);
    this._onCanvasEnter = this._handleCanvasEnter.bind(this);

    this._saveUndo();
  }

  enable() {
    this.isActive = true;
    const canvas = this.renderer.renderer.domElement;
    canvas.style.cursor = 'none';
    canvas.addEventListener('mousedown',  this._onMouseDown);
    canvas.addEventListener('mousemove',  this._onMouseMove);
    canvas.addEventListener('mousemove',  this._onCursorMove);
    canvas.addEventListener('mouseup',    this._onMouseUp);
    canvas.addEventListener('mouseleave', this._onMouseUp);
    canvas.addEventListener('mouseleave', this._onCanvasLeave);
    canvas.addEventListener('mouseenter', this._onCanvasEnter);

    const cursor = document.getElementById('paint-cursor');
    if (cursor) cursor.classList.remove('hidden');
    this._updateCursorSize();
  }

  disable() {
    this.isActive = false;
    this.isPainting = false;
    const canvas = this.renderer.renderer.domElement;
    canvas.style.cursor = '';
    canvas.removeEventListener('mousedown',  this._onMouseDown);
    canvas.removeEventListener('mousemove',  this._onMouseMove);
    canvas.removeEventListener('mousemove',  this._onCursorMove);
    canvas.removeEventListener('mouseup',    this._onMouseUp);
    canvas.removeEventListener('mouseleave', this._onMouseUp);
    canvas.removeEventListener('mouseleave', this._onCanvasLeave);
    canvas.removeEventListener('mouseenter', this._onCanvasEnter);

    const cursor = document.getElementById('paint-cursor');
    if (cursor) cursor.classList.add('hidden');
  }

  setTool(toolName) { this.currentTool = toolName; }

  setColor(hexColor) {
    this.currentColor = hexColor;
    const preview = document.getElementById('color-preview');
    if (preview) preview.style.background = hexColor;
    const input = document.getElementById('color-input');
    if (input) input.value = hexColor;
  }

  setBrushSize(size) {
    this.brushSize = Math.max(2, Math.min(60, size));
    this._updateCursorSize();
  }

  setOpacity(opacity) {
    this.opacity = Math.max(0.1, Math.min(1.0, opacity));
  }

  // ─── Undo / Redo ───

  _saveUndo() {
    const imageData = this.ctx.getImageData(0, 0, 512, 512);
    this.undoStack.push(imageData);
    if (this.undoStack.length > this.maxUndoSteps) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length <= 1) return;
    const current = this.undoStack.pop();
    this.redoStack.push(current);
    this.ctx.putImageData(this.undoStack[this.undoStack.length - 1], 0, 0);
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
    this.ctx.fillStyle = '#d4b8a0';
    this.ctx.fillRect(0, 0, 512, 512);
    this.character.updateTexture();
    this._updatePreview();
  }

  // ─── Soft brush helpers ───

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
  }

  _drawSoftDot(x, y, color, size, opacity) {
    const grad = this.ctx.createRadialGradient(x, y, 0, x, y, size);
    grad.addColorStop(0,   this._hexToRgba(color, opacity));
    grad.addColorStop(0.45, this._hexToRgba(color, opacity * 0.72));
    grad.addColorStop(1,   this._hexToRgba(color, 0));
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size, 0, Math.PI * 2);
    this.ctx.fill();
  }

  _drawSoftEraseDot(x, y, size) {
    const grad = this.ctx.createRadialGradient(x, y, 0, x, y, size);
    grad.addColorStop(0,    'rgba(212,184,160,1)');
    grad.addColorStop(0.45, 'rgba(212,184,160,0.72)');
    grad.addColorStop(1,    'rgba(212,184,160,0)');
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // ─── Paint along a path with interpolated dots ───

  _paintAtUV(u, v) {
    const x = u * 512;
    const y = (1 - v) * 512;

    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      const drawDot = this.currentTool === 'brush'
        ? (px, py) => this._drawSoftDot(px, py, this.currentColor, this.brushSize, this.opacity)
        : (px, py) => this._drawSoftEraseDot(px, py, this.brushSize);

      if (this.lastPaintUV) {
        const lx = this.lastPaintUV.u * 512;
        const ly = (1 - this.lastPaintUV.v) * 512;
        const dist = Math.sqrt((x - lx) ** 2 + (y - ly) ** 2);
        const spacing = Math.max(1, this.brushSize * 0.18);
        const steps = Math.ceil(dist / spacing);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          drawDot(lx + (x - lx) * t, ly + (y - ly) * t);
        }
      }
      drawDot(x, y);

    } else if (this.currentTool === 'fill') {
      this.ctx.save();
      this.ctx.globalAlpha = this.opacity;
      this.ctx.fillStyle = this.currentColor;
      this.ctx.fillRect(0, 0, 512, 512);
      this.ctx.restore();
    }

    this.character.updateTexture();
    this.lastPaintUV = { u, v };
  }

  _eyedropFromScene(event) {
    const allObjects = [];
    this.renderer.scene.traverse(obj => {
      if (obj.isMesh && !obj.userData.isCharacter) allObjects.push(obj);
    });
    const intersects = this.renderer.raycast(event, allObjects, false);
    if (intersects.length > 0) {
      const color = this.renderer.getColorAtIntersection(intersects[0]);
      this.setColor(this._normalizeColor(color));
      if (this.onColorChange) this.onColorChange(this.currentColor);
    }
  }

  _normalizeColor(color) {
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
    if (event.button === 2) return;
    if (event.button !== 0) return;

    if (this.currentTool === 'eyedropper') {
      this._eyedropFromScene(event);
      return;
    }

    const intersects = this.renderer.raycast(event, this.character.getMeshes(), false);

    if (intersects.length > 0 && intersects[0].uv) {
      this._saveUndo();
      this.isPainting = true;
      this.lastPaintUV = null;
      this._paintAtUV(intersects[0].uv.x, intersects[0].uv.y);
    } else if (intersects.length > 0) {
      this._saveUndo();
      this.isPainting = true;
      this.lastPaintUV = null;
      const localPos = this.character.getGroup().worldToLocal(intersects[0].point.clone());
      const u = (Math.atan2(localPos.x, localPos.z) / Math.PI + 1) / 2;
      const v = (localPos.y + 0.75) / 1.5;
      this._paintAtUV(u, Math.max(0, Math.min(1, v)));
    } else if (this.currentTool === 'eyedropper') {
      this._eyedropFromScene(event);
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

  // ─── Cursor ───

  _handleCursorMove(event) {
    const cursor = document.getElementById('paint-cursor');
    if (!cursor) return;
    cursor.style.left = event.clientX + 'px';
    cursor.style.top  = event.clientY + 'px';
  }

  _handleCanvasLeave() {
    const cursor = document.getElementById('paint-cursor');
    if (cursor) cursor.style.opacity = '0';
  }

  _handleCanvasEnter() {
    const cursor = document.getElementById('paint-cursor');
    if (cursor) cursor.style.opacity = '1';
  }

  _updateCursorSize() {
    const cursor = document.getElementById('paint-cursor');
    if (!cursor) return;
    const px = Math.max(10, Math.min(100, this.brushSize * 2.6));
    cursor.style.width  = px + 'px';
    cursor.style.height = px + 'px';
  }

  // ─── Preview ───

  _updatePreview() {
    const preview = document.getElementById('texture-preview');
    if (!preview) return;
    const pctx = preview.getContext('2d');
    pctx.clearRect(0, 0, preview.width, preview.height);
    pctx.drawImage(this.canvas, 0, 0, preview.width, preview.height);
  }

  updatePreview() { this._updatePreview(); }

  destroy() {
    this.disable();
    this.undoStack = [];
    this.redoStack = [];
  }
}
