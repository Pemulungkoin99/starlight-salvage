// Keyboard and mouse, read as one intent: { turn, thrust, brake, beam }. The keyboard steers by
// rotation; the mouse steers by pointing (the ship turns toward the pointer), thrusts with the
// left button and works the beam with the right. main.js asks for the intent each step; the
// world never sees a key or a button.

const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  thrust: ['ArrowUp', 'KeyW'],
  brake: ['ArrowDown', 'KeyS'],
  beam: ['Space'],
};

export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.mouse = { x: 0, y: 0, inside: false, left: false, right: false };
    this.pressed = new Set(); // edge-triggered codes, drained by main.js once a frame
    window.addEventListener('keydown', (e) => {
      if (KEYS.left.concat(KEYS.right, KEYS.thrust, KEYS.brake, KEYS.beam).includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.left = false;
      this.mouse.right = false;
    });
    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 1280;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * 800;
      this.mouse.inside = true;
    });
    canvas.addEventListener('pointerdown', (e) => {
      this.pressed.add('Pointer');
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  held(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  /** Take (and clear) the edge-triggered presses since the last call: key codes and 'Pointer'. */
  drainPressed() {
    const out = this.pressed;
    this.pressed = new Set();
    return out;
  }

  /**
   * The step's intent. With a mouse inside the field, turning is "toward the pointer" and the
   * world works the angle out; otherwise turn is -1, 0 or 1 from the keys.
   */
  intent(shipAngle, shipX, shipY) {
    let turn = 0;
    if (this.held(...KEYS.left)) turn -= 1;
    if (this.held(...KEYS.right)) turn += 1;
    let pointTurn = null;
    if (this.mouse.inside && turn === 0) {
      const want = Math.atan2(this.mouse.y - shipY, this.mouse.x - shipX);
      let diff = want - shipAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      pointTurn = Math.max(-1, Math.min(1, diff * 4));
    }
    return {
      turn: pointTurn !== null ? pointTurn : turn,
      thrust: this.held(...KEYS.thrust) || this.mouse.left,
      brake: this.held(...KEYS.brake),
      beam: this.held(...KEYS.beam) || this.mouse.right,
    };
  }
}
