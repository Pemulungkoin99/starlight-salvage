// The simulation: ship, pods, mines, dock, particles and the level clock, all stepped at a fixed
// rate with a seeded random source, so any run can be replayed exactly. The world knows nothing
// of the DOM, sound or storage: step() returns a bitmask of events and main.js turns them into
// sound and announcements. Rendering only reads state.

import { BEAM, DOCK, FIELD, MAX_HULL, MINE, POD, SCORE, SHIP, START_HULL, levelSpec } from './config.js';
import { makeRandom, range } from './random.js';

export const EVENT = {
  NONE: 0,
  GRAB: 1,
  RELEASE: 2,
  DELIVER: 4,
  EXPLOSION: 8,
  POD_LOST: 16,
  HURT: 32,
  CLEAR: 64,
  OVER: 128,
  TICK: 256,
  LEVEL_START: 512,
};

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export class World {
  constructor(seed) {
    this.random = makeRandom(seed);
    this.reset(seed);
  }

  reset(seed) {
    this.seed = seed;
    this.random = makeRandom(seed);
    this.ship = { x: 240, y: FIELD.height / 2, vx: 0, vy: 0, angle: 0, invulnT: 0, thrusting: false };
    this.score = 0;
    this.level = 1;
    this.hull = START_HULL;
    this.totalDelivered = 0;
    this.combo = 0;
    this.comboT = 0;
    this.phase = 'play'; // play | clear | over
    this.phaseT = 0;
    this.overReason = '';
    this.time = 0;
    this.lastWholeSecond = -1;
    this.shakeT = 0;
    this.shakeMag = 0;
    this.attract = false;
    this.particles = [];
    this.floaters = [];
    this.startLevel(1);
  }

  startLevel(level) {
    const spec = levelSpec(level);
    this.spec = spec;
    this.timeLeft = spec.seconds;
    this.delivered = 0;
    this.spawned = 0;
    this.spawnT = 0;
    this.pods = [];
    this.mines = [];
    this.towed = null;
    for (let i = 0; i < spec.pods; i += 1) this.spawnPod(true);
    for (let i = 0; i < spec.mines; i += 1) this.spawnMine(true);
    this.phase = 'play';
    this.phaseT = 0;
  }

  spawnPod(anywhere = false) {
    const r = this.random;
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 12; tries += 1) {
      x = anywhere ? range(r, 420, 1020) : range(r, 50, 140);
      y = range(r, 90, FIELD.height - 90);
      if (dist2(x, y, this.ship.x, this.ship.y) > 150 * 150) break;
    }
    const speed = range(r, POD.driftMin, POD.driftMax) * this.spec.driftScale;
    const dir = range(r, 0, TAU);
    this.pods.push({
      x, y,
      vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed,
      angle: range(r, 0, TAU), spin: range(r, -0.6, 0.6),
      state: 'free', pulse: range(r, 0, TAU),
    });
    this.spawned += 1;
  }

  spawnMine(anywhere = false) {
    const r = this.random;
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 12; tries += 1) {
      x = anywhere ? range(r, 260, 1060) : range(r, 500, 1060);
      y = range(r, 70, FIELD.height - 70);
      if (dist2(x, y, this.ship.x, this.ship.y) > 200 * 200 && !(x > DOCK.mouthX - 60 && Math.abs(y - DOCK.y) < DOCK.halfHeight + 50)) break;
    }
    const speed = range(r, MINE.driftMin, MINE.driftMax) * this.spec.driftScale;
    const dir = range(r, 0, TAU);
    this.mines.push({ x, y, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, pulse: range(r, 0, TAU) });
  }

  burst(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length > 420) return;
      const dir = range(this.random, 0, TAU);
      const v = range(this.random, speed * 0.25, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(dir) * v, vy: Math.sin(dir) * v,
        life: 0, maxLife: range(this.random, life * 0.5, life),
        size: range(this.random, size * 0.5, size), color,
      });
    }
  }

  floater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 0 });
  }

  shake(mag, seconds) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, seconds);
  }

  /**
   * Advance one fixed step. intent: { turn, thrust, brake, beam }.
   * Returns the EVENT bitmask of what happened in this step.
   */
  step(dt, intent) {
    let events = EVENT.NONE;
    this.time += dt;
    const ship = this.ship;

    // Particles and floaters always live, whatever the phase.
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.6 * dt;
      p.vy *= 1 - 1.6 * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
    for (const f of this.floaters) {
      f.life += dt;
      f.y -= 34 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life < 1.15);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) this.shakeMag = 0;
    }

    // Everything drifts, whatever the phase.
    for (const pod of this.pods) {
      if (pod.state === 'towed') continue;
      pod.x += pod.vx * dt;
      pod.y += pod.vy * dt;
      pod.angle += pod.spin * dt;
      pod.pulse += dt * 2;
      this.bounce(pod, POD.radius);
    }
    for (const mine of this.mines) {
      mine.x += mine.vx * dt;
      mine.y += mine.vy * dt;
      mine.pulse += dt * 2.4;
      this.bounce(mine, MINE.radius);
    }

    if (this.phase === 'clear') {
      this.phaseT -= dt;
      this.stepShip(dt, { turn: 0, thrust: false, brake: true, beam: false });
      if (this.phaseT <= 0) {
        this.level += 1;
        this.hull = Math.min(MAX_HULL, this.hull + 1);
        this.startLevel(this.level);
        events |= EVENT.LEVEL_START;
      }
      return events;
    }
    if (this.phase === 'over') {
      this.stepShip(dt, { turn: 0, thrust: false, brake: true, beam: false });
      return events;
    }

    // Phase: play.
    events |= this.stepShip(dt, intent);
    events |= this.stepTow(dt, intent);
    events |= this.stepCollisions(dt);

    // Replacement pods, until the level's supply (quota + spares) is used up.
    const inField = this.pods.length;
    if (this.spawned < this.spec.quota + 2 && this.delivered + inField < this.spec.quota + 1) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnPod(false);
        this.spawnT = 0.9;
      }
    }

    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    if (!this.attract) {
      this.timeLeft -= dt;
      const whole = Math.ceil(this.timeLeft);
      if (whole !== this.lastWholeSecond) {
        this.lastWholeSecond = whole;
        if (whole <= 10 && whole > 0) events |= EVENT.TICK;
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.phase = 'over';
        this.overReason = 'The clock ran out.';
        events |= EVENT.OVER;
      }
    }
    return events;
  }

  bounce(body, radius) {
    if (body.x < radius) { body.x = radius; body.vx = Math.abs(body.vx); }
    if (body.x > FIELD.width - radius) { body.x = FIELD.width - radius; body.vx = -Math.abs(body.vx); }
    if (body.y < radius) { body.y = radius; body.vy = Math.abs(body.vy); }
    if (body.y > FIELD.height - radius) { body.y = FIELD.height - radius; body.vy = -Math.abs(body.vy); }
  }

  stepShip(dt, intent) {
    let events = EVENT.NONE;
    const ship = this.ship;
    ship.angle += intent.turn * SHIP.turnRate * dt;
    ship.thrusting = intent.thrust;
    if (intent.thrust) {
      ship.vx += Math.cos(ship.angle) * SHIP.thrust * dt;
      ship.vy += Math.sin(ship.angle) * SHIP.thrust * dt;
      if (this.random() < 0.75) {
        const back = ship.angle + Math.PI;
        this.particles.push({
          x: ship.x + Math.cos(back) * SHIP.radius,
          y: ship.y + Math.sin(back) * SHIP.radius,
          vx: Math.cos(back) * 90 + range(this.random, -16, 16) - ship.vx * 0.25,
          vy: Math.sin(back) * 90 + range(this.random, -16, 16) - ship.vy * 0.25,
          life: 0, maxLife: range(this.random, 0.25, 0.5),
          size: range(this.random, 2, 4.5), color: '#ffb703',
        });
      }
    }
    const damp = Math.exp(-SHIP.damping * (intent.brake ? SHIP.brake : 1) * dt);
    ship.vx *= damp;
    ship.vy *= damp;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > SHIP.maxSpeed) {
      ship.vx = (ship.vx / speed) * SHIP.maxSpeed;
      ship.vy = (ship.vy / speed) * SHIP.maxSpeed;
    }
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    this.bounce(ship, SHIP.radius);
    if (ship.invulnT > 0) ship.invulnT -= dt;
    return events;
  }

  stepTow(dt, intent) {
    let events = EVENT.NONE;
    const ship = this.ship;
    if (this.towed !== null && !intent.beam) {
      this.towed.state = 'free';
      this.towed = null;
      events |= EVENT.RELEASE;
    }
    if (this.towed === null && intent.beam) {
      let best = null;
      let bestD = Infinity;
      for (const pod of this.pods) {
        if (pod.state !== 'free') continue;
        const d2 = dist2(pod.x, pod.y, ship.x, ship.y);
        if (d2 > BEAM.range * BEAM.range) continue;
        const bearing = Math.atan2(pod.y - ship.y, pod.x - ship.x);
        if (Math.abs(angleDiff(bearing, ship.angle)) > BEAM.halfAngle) continue;
        if (d2 < bestD) { bestD = d2; best = pod; }
      }
      if (best !== null) {
        best.state = 'towed';
        this.towed = best;
        this.burst(best.x, best.y, '#7bf1a8', 8, 90, 0.4, 3);
        events |= EVENT.GRAB;
      }
    }
    if (this.towed !== null) {
      const pod = this.towed;
      const anchorX = ship.x - Math.cos(ship.angle) * BEAM.tetherDistance;
      const anchorY = ship.y - Math.sin(ship.angle) * BEAM.tetherDistance;
      pod.vx += ((anchorX - pod.x) * BEAM.spring - pod.vx * BEAM.springDamping) * dt;
      pod.vy += ((anchorY - pod.y) * BEAM.spring - pod.vy * BEAM.springDamping) * dt;
      const podSpeed = Math.hypot(pod.vx, pod.vy);
      if (podSpeed > 420) {
        pod.vx = (pod.vx / podSpeed) * 420;
        pod.vy = (pod.vy / podSpeed) * 420;
      }
      pod.x += pod.vx * dt;
      pod.y += pod.vy * dt;
      pod.angle += pod.spin * dt;
      pod.pulse += dt * 2;
      this.bounce(pod, POD.radius);
      // Delivery: the pod's centre crosses into the berth.
      if (pod.x > DOCK.x && Math.abs(pod.y - DOCK.y) < DOCK.halfHeight) {
        this.deliver(pod);
        events |= EVENT.DELIVER;
        if (this.phase === 'clear') events |= EVENT.CLEAR;
      }
    }
    return events;
  }

  deliver(pod) {
    this.pods = this.pods.filter((p) => p !== pod);
    if (this.towed === pod) this.towed = null;
    this.combo = this.comboT > 0 ? Math.min(this.combo + 1, SCORE.comboCap) : 1;
    this.comboT = SCORE.comboWindow;
    const points = SCORE.delivery * this.combo;
    this.score += points;
    this.delivered += 1;
    this.totalDelivered += 1;
    if (!this.attract) this.timeLeft += SCORE.secondBonus;
    this.burst(pod.x, pod.y, '#06d6a0', 22, 170, 0.7, 4);
    this.burst(pod.x, pod.y, '#ffe8d6', 10, 110, 0.5, 3);
    this.floater(pod.x - 20, pod.y - 24, `+${points}`, '#7bf1a8');
    if (this.delivered >= this.spec.quota && this.phase === 'play') {
      this.score += Math.ceil(this.timeLeft) * SCORE.levelClearPerSecond;
      this.phase = 'clear';
      this.phaseT = 2.4;
    }
  }

  stepCollisions(dt) {
    let events = EVENT.NONE;
    const ship = this.ship;
    for (const mine of [...this.mines]) {
      // A mine that reaches the towed pod destroys the cargo, not the ship.
      if (this.towed !== null && dist2(mine.x, mine.y, this.towed.x, this.towed.y) < (MINE.radius + POD.radius) ** 2) {
        this.burst(this.towed.x, this.towed.y, '#f4a261', 18, 160, 0.6, 4);
        this.burst(mine.x, mine.y, '#ef476f', 14, 150, 0.6, 4);
        this.floater(this.towed.x - 26, this.towed.y - 24, 'CARGO LOST', '#ff5d73');
        this.pods = this.pods.filter((p) => p !== this.towed);
        this.towed = null;
        this.combo = 0;
        this.comboT = 0;
        this.mines = this.mines.filter((m) => m !== mine);
        this.shake(5, 0.3);
        events |= EVENT.POD_LOST | EVENT.EXPLOSION;
        continue;
      }
      if (this.attract || ship.invulnT > 0) continue;
      if (dist2(mine.x, mine.y, ship.x, ship.y) < (MINE.radius + SHIP.radius) ** 2) {
        this.burst(ship.x, ship.y, '#ef476f', 26, 210, 0.8, 5);
        this.burst(ship.x, ship.y, '#ffd166', 14, 150, 0.6, 4);
        this.mines = this.mines.filter((m) => m !== mine);
        this.hull -= 1;
        ship.invulnT = SHIP.invulnerableSeconds;
        const away = Math.atan2(ship.y - mine.y, ship.x - mine.x);
        ship.vx = Math.cos(away) * 240;
        ship.vy = Math.sin(away) * 240;
        this.shake(9, 0.45);
        events |= EVENT.EXPLOSION | EVENT.HURT;
        if (this.hull <= 0) {
          this.phase = 'over';
          this.overReason = 'The tug broke apart.';
          events |= EVENT.OVER;
        }
      }
    }
    return events;
  }
}
