// Everything the player sees: the starfield, the dock, the tug, pods and mines, the beam, the
// HUD and the screens (title, level clear, game over, pause). Pure canvas drawing from world
// state; the only randomness here is the fixed starfield and cosmetic shake jitter.

import { BEAM, COLORS, DOCK, FIELD, SCORE } from './config.js';
import { makeRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_GAME = 'game';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// The starfield is one fixed sky, three depths, generated once from its own seed.
const STARS = (() => {
  const random = makeRandom(20261114);
  const layers = [];
  const defs = [
    { count: 90, size: 1.1, alpha: 0.5 },
    { count: 55, size: 1.7, alpha: 0.75 },
    { count: 26, size: 2.4, alpha: 1 },
  ];
  for (const def of defs) {
    const stars = [];
    for (let i = 0; i < def.count; i += 1) {
      stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, phase: random() * Math.PI * 2 });
    }
    layers.push({ ...def, stars });
  }
  return layers;
})();

/** Size the canvas to the window keeping the field's aspect, and return the draw scale. */
export function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.width = Math.round(FIELD.width * scale * dpr);
  canvas.height = Math.round(FIELD.height * scale * dpr);
  canvas.style.width = `${Math.round(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.round(FIELD.height * scale)}px`;
  return { scale: scale * dpr, dpr };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSky(ctx, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  grad.addColorStop(0, COLORS.space);
  grad.addColorStop(1, COLORS.spaceDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Two soft nebula washes, fixed in place.
  for (const [x, y, r, color] of [[300, 180, 340, 'rgba(33,158,188,0.10)'], [1020, 640, 380, 'rgba(181,23,158,0.08)']]) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (const layer of STARS) {
    ctx.fillStyle = COLORS.star;
    for (const star of layer.stars) {
      ctx.globalAlpha = layer.alpha * (0.7 + 0.3 * Math.sin(time * 1.4 + star.phase));
      ctx.beginPath();
      ctx.arc(star.x, star.y, layer.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawDock(ctx, world) {
  const top = DOCK.y - DOCK.halfHeight;
  const height = DOCK.halfHeight * 2;
  const active = world.towed !== null;
  ctx.save();
  // Berth glow and frame.
  const glow = ctx.createLinearGradient(DOCK.x, 0, FIELD.width, 0);
  glow.addColorStop(0, 'rgba(6,214,160,0)');
  glow.addColorStop(1, active ? 'rgba(6,214,160,0.28)' : 'rgba(6,214,160,0.14)');
  ctx.fillStyle = glow;
  ctx.fillRect(DOCK.x, top, FIELD.width - DOCK.x, height);
  ctx.strokeStyle = COLORS.dock;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(DOCK.x, top);
  ctx.lineTo(FIELD.width - 6, top);
  ctx.moveTo(DOCK.x, top + height);
  ctx.lineTo(FIELD.width - 6, top + height);
  ctx.stroke();
  // Chevrons marching into the berth.
  ctx.lineWidth = 4;
  for (let i = 0; i < 3; i += 1) {
    const phase = (world.time * 1.6 + i / 3) % 1;
    const x = DOCK.mouthX + 16 + phase * 44;
    ctx.globalAlpha = 0.25 + 0.75 * phase;
    ctx.strokeStyle = COLORS.dock;
    ctx.beginPath();
    ctx.moveTo(x, DOCK.y - 26);
    ctx.lineTo(x + 16, DOCK.y);
    ctx.lineTo(x, DOCK.y + 26);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.dock;
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('D O C K', (DOCK.x + FIELD.width) / 2, top - 12);
  ctx.restore();
}

function drawPod(ctx, pod) {
  ctx.save();
  ctx.translate(pod.x, pod.y);
  ctx.rotate(pod.angle);
  ctx.fillStyle = COLORS.pod;
  roundRect(ctx, -POD_HALF, -POD_HALF, POD_HALF * 2, POD_HALF * 2, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-POD_HALF, 0);
  ctx.lineTo(POD_HALF, 0);
  ctx.moveTo(0, -POD_HALF);
  ctx.lineTo(0, POD_HALF);
  ctx.stroke();
  ctx.restore();
  // The beacon stays upright and blinks, so a pod is findable at a glance.
  const on = Math.sin(pod.pulse * 3) > 0;
  ctx.fillStyle = on ? COLORS.podLight : 'rgba(255,232,214,0.35)';
  ctx.beginPath();
  ctx.arc(pod.x, pod.y, 3.2, 0, Math.PI * 2);
  ctx.fill();
}
const POD_HALF = 12;

function drawMine(ctx, mine) {
  ctx.save();
  ctx.translate(mine.x, mine.y);
  ctx.fillStyle = '#2b1030';
  ctx.strokeStyle = COLORS.mineDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + mine.pulse * 0.15;
    const a2 = a + Math.PI / 8;
    ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
    ctx.lineTo(Math.cos(a2) * 10, Math.sin(a2) * 10);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const core = 3.4 + Math.sin(mine.pulse * 2.2) * 1.3;
  ctx.fillStyle = COLORS.mine;
  ctx.beginPath();
  ctx.arc(0, 0, core, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBeam(ctx, world, beamHeld) {
  const ship = world.ship;
  const cos = Math.cos(ship.angle);
  const sin = Math.sin(ship.angle);
  if (world.towed !== null) {
    const pod = world.towed;
    ctx.save();
    ctx.strokeStyle = COLORS.beam;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -world.time * 60;
    ctx.beginPath();
    ctx.moveTo(ship.x - cos * 6, ship.y - sin * 6);
    ctx.lineTo(pod.x, pod.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(ship.x - cos * 6, ship.y - sin * 6);
    ctx.lineTo(pod.x, pod.y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  // The open cone while the beam is held, so the player can aim the grab before it happens.
  if (!beamHeld) return;
  ctx.save();
  ctx.fillStyle = 'rgba(123,241,168,0.07)';
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y);
  ctx.arc(ship.x, ship.y, BEAM.range, ship.angle - BEAM.halfAngle, ship.angle + BEAM.halfAngle);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawShip(ctx, world) {
  const ship = world.ship;
  if (ship.invulnT > 0 && Math.sin(world.time * 22) > 0.2 && world.phase === 'play') {
    ctx.globalAlpha = 0.35;
  }
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  if (ship.thrusting) {
    const flick = 12 + Math.sin(world.time * 41) * 4 + Math.random() * 3;
    ctx.fillStyle = COLORS.flame;
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.lineTo(-12 - flick, 0);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.fill();
  }
  // Side pods, then the hull, then the cockpit.
  ctx.fillStyle = COLORS.shipTrim;
  roundRect(ctx, -11, -13, 15, 6, 3);
  ctx.fill();
  roundRect(ctx, -11, 7, 15, 6, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.shipBody;
  ctx.beginPath();
  ctx.moveTo(17, 0);
  ctx.lineTo(4, -8);
  ctx.lineTo(-11, -8);
  ctx.lineTo(-13, 0);
  ctx.lineTo(-11, 8);
  ctx.lineTo(4, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.hull;
  ctx.beginPath();
  ctx.arc(3, 0, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawParticles(ctx, world) {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.life / 1.15);
    ctx.fillStyle = f.color;
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function pips(ctx, x, y, filled, total, color, draw) {
  for (let i = 0; i < total; i += 1) {
    ctx.save();
    ctx.translate(x + i * 24, y);
    ctx.globalAlpha = i < filled ? 1 : 0.25;
    ctx.fillStyle = color;
    draw(ctx);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world, best) {
  const pad = 20;
  ctx.save();
  ctx.fillStyle = 'rgba(7,10,26,0.55)';
  ctx.fillRect(0, 0, FIELD.width, 58);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', pad, 22);
  ctx.fillText('BEST', pad + 130, 22);
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(String(world.score), pad, 48);
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(String(Math.max(best, world.score)), pad + 130, 47);

  // Centre: level, quota pips and the clock bar.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 17px ${FONT}`;
  ctx.fillText(`LEVEL ${world.level}`, FIELD.width / 2, 24);
  pips(ctx, FIELD.width / 2 - (world.spec.quota * 24 - 8) / 2, 40, world.delivered, world.spec.quota, COLORS.dock, (c) => {
    c.beginPath();
    c.arc(0, 0, 6, 0, Math.PI * 2);
    c.fill();
  });
  const barW = 300;
  const frac = Math.max(0, world.timeLeft / world.spec.seconds);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, FIELD.width / 2 - barW / 2, 66 - 14, barW, 7, 3.5);
  ctx.fill();
  ctx.fillStyle = world.timeLeft <= 10 ? COLORS.danger : COLORS.hull;
  if (frac > 0) {
    roundRect(ctx, FIELD.width / 2 - barW / 2, 52, barW * frac, 7, 3.5);
    ctx.fill();
  }

  // Right: hull pips and the combo, when it is alive.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('HULL', FIELD.width - pad, 22);
  pips(ctx, FIELD.width - pad - (3 * 24 - 8), 40, world.hull, 3, COLORS.hull, (c) => {
    c.beginPath();
    c.moveTo(8, 0);
    c.lineTo(-6, -6);
    c.lineTo(-6, 6);
    c.closePath();
    c.fill();
  });
  if (world.combo > 1 && world.comboT > 0) {
    ctx.fillStyle = COLORS.beam;
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(`COMBO x${world.combo}`, FIELD.width - pad, 84);
    ctx.fillStyle = 'rgba(123,241,168,0.35)';
    ctx.fillRect(FIELD.width - pad - 110 * (world.comboT / SCORE.comboWindow), 90, 110 * (world.comboT / SCORE.comboWindow), 3);
  }

  // Bottom corners: the clock as a number, and the keys, small.
  ctx.textAlign = 'left';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillStyle = world.timeLeft <= 10 ? COLORS.danger : COLORS.text;
  ctx.fillText(`${Math.ceil(world.timeLeft)}s`, pad, FIELD.height - 18);
  ctx.textAlign = 'right';
  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText('Arrows/WASD fly - SPACE beam - P pause - M sound', FIELD.width - pad, FIELD.height - 18);
  ctx.restore();
}

function panel(ctx, w, h) {
  const x = (FIELD.width - w) / 2;
  const y = (FIELD.height - h) / 2;
  ctx.fillStyle = 'rgba(5,8,20,0.78)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(142,202,230,0.35)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
  return { x, y };
}

function drawTitle(ctx, world, best) {
  const { x, y } = panel(ctx, 640, 430);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hull;
  ctx.font = `800 54px ${FONT}`;
  ctx.fillText('STARLIGHT', FIELD.width / 2, y + 78);
  ctx.fillText('SALVAGE', FIELD.width / 2, y + 136);
  ctx.fillStyle = COLORS.text;
  ctx.font = `500 17px ${FONT}`;
  ctx.fillText('The fleet scattered its cargo. You are the tug bringing it home.', FIELD.width / 2, y + 178);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 15.5px ${FONT}`;
  const lines = [
    'Tow drifting pods into the green DOCK before the clock dies.',
    'Every delivery buys back 4 seconds. Chain them for combo points.',
    'Mines drift too: one breaks your hull, one eats a towed pod.',
    '',
    'Fly: arrow keys or WASD, or point with the mouse (hold left button)',
    'Tractor beam: hold SPACE or the right mouse button',
    'Pause: P - Sound: M',
  ];
  lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, y + 214 + i * 24));
  if (best > 0) {
    ctx.fillStyle = COLORS.hull;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(`Best score: ${best}`, FIELD.width / 2, y + 214 + lines.length * 24 + 8);
  }
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLORS.beam;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText('Press ENTER or click to fly', FIELD.width / 2, y + 396);
  ctx.globalAlpha = 1;
  void x;
}

function drawClear(ctx, world) {
  const { y } = panel(ctx, 460, 170);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.dock;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(`LEVEL ${world.level} CLEAR`, FIELD.width / 2, y + 68);
  ctx.fillStyle = COLORS.text;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText(`Berth quota met. Time bonus banked.`, FIELD.width / 2, y + 102);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`Level ${world.level + 1} is drifting in...`, FIELD.width / 2, y + 130);
}

function drawOver(ctx, world, best) {
  const { y } = panel(ctx, 520, 330);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.danger;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('RUN OVER', FIELD.width / 2, y + 66);
  ctx.fillStyle = COLORS.text;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText(world.overReason, FIELD.width / 2, y + 98);
  ctx.font = `600 18px ${FONT}`;
  const rows = [
    `Score: ${world.score}`,
    `Pods delivered: ${world.totalDelivered}`,
    `Levels reached: ${world.level}`,
    `Best: ${Math.max(best, world.score)}`,
  ];
  rows.forEach((row, i) => ctx.fillText(row, FIELD.width / 2, y + 142 + i * 30));
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLORS.beam;
  ctx.font = `700 19px ${FONT}`;
  ctx.fillText('Press ENTER or click to fly again', FIELD.width / 2, y + 142 + rows.length * 30 + 26);
  ctx.globalAlpha = 1;
}

function drawPaused(ctx) {
  const { y } = panel(ctx, 300, 130);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = `800 32px ${FONT}`;
  ctx.fillText('PAUSED', FIELD.width / 2, y + 62);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText('P to resume', FIELD.width / 2, y + 94);
}

/**
 * Draw one frame. ui: { screen, best, paused, beamHeld } — screen is SCREEN_TITLE or SCREEN_GAME.
 */
export function draw(ctx, world, ui) {
  ctx.save();
  if (world.shakeMag > 0) {
    const m = world.shakeMag;
    ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
  }
  drawSky(ctx, world.time);
  drawDock(ctx, world);
  for (const mine of world.mines) drawMine(ctx, mine);
  for (const pod of world.pods) drawPod(ctx, pod);
  if (ui.screen === SCREEN_GAME && world.phase !== 'over') drawBeam(ctx, world, ui.beamHeld === true);
  drawShip(ctx, world);
  drawParticles(ctx, world);
  ctx.restore();

  if (ui.screen === SCREEN_GAME) drawHud(ctx, world, ui.best);
  if (ui.screen === SCREEN_TITLE) drawTitle(ctx, world, ui.best);
  if (world.phase === 'clear') drawClear(ctx, world);
  if (world.phase === 'over' && ui.screen === SCREEN_GAME) drawOver(ctx, world, ui.best);
  if (ui.paused) drawPaused(ctx);
}
