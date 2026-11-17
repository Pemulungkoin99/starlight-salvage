// The screenshot scenes behind ?shot=start|play|clear|end. Each one plays the real rules forward
// from a fresh world, steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame. The play and clear scenes use a
// careful pilot (chase the nearest pod, tow it home, bend around mines); the end scene uses a
// reckless one that beelines for the mines, as a panicked player does.

import { BEAM, DOCK, STEP } from './config.js';
import { SCREEN_GAME, SCREEN_TITLE } from './render.js';

const IDLE = { turn: 0, thrust: false, brake: false, beam: false };

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Steer toward a point, bending away from any mine close ahead. */
function steer(world, tx, ty, beam) {
  const ship = world.ship;
  let want = Math.atan2(ty - ship.y, tx - ship.x);
  for (const mine of world.mines) {
    const d = Math.hypot(mine.x - ship.x, mine.y - ship.y);
    if (d > 130) continue;
    const toMine = Math.atan2(mine.y - ship.y, mine.x - ship.x);
    if (Math.abs(angleDiff(toMine, want)) < 0.8) {
      want += angleDiff(toMine, want) > 0 ? -1.0 : 1.0;
    }
  }
  const diff = angleDiff(want, ship.angle);
  const speed = Math.hypot(ship.vx, ship.vy);
  return {
    turn: Math.max(-1, Math.min(1, diff * 3.2)),
    thrust: Math.abs(diff) < 0.55,
    brake: speed > 265,
    beam,
  };
}

function carefulPilot(world) {
  const ship = world.ship;
  if (world.towed !== null) {
    return steer(world, DOCK.mouthX - 40, DOCK.y, true);
  }
  let pod = null;
  let best = Infinity;
  for (const p of world.pods) {
    if (p.state !== 'free') continue;
    const d = (p.x - ship.x) ** 2 + (p.y - ship.y) ** 2;
    if (d < best) { best = d; pod = p; }
  }
  if (pod === null) return IDLE;
  const d = Math.sqrt(best);
  const bearing = Math.atan2(pod.y - ship.y, pod.x - ship.x);
  const inCone = Math.abs(angleDiff(bearing, ship.angle)) < BEAM.halfAngle * 0.8;
  return steer(world, pod.x, pod.y, d < BEAM.range * 0.94 && inCone);
}

function recklessPilot(world) {
  const ship = world.ship;
  let mine = null;
  let best = Infinity;
  for (const m of world.mines) {
    const d = (m.x - ship.x) ** 2 + (m.y - ship.y) ** 2;
    if (d < best) { best = d; mine = m; }
  }
  if (mine === null) return { turn: 0, thrust: true, brake: false, beam: false };
  const diff = angleDiff(Math.atan2(mine.y - ship.y, mine.x - ship.x), ship.angle);
  return { turn: Math.max(-1, Math.min(1, diff * 3.2)), thrust: true, brake: false, beam: false };
}

function run(world, seconds, pilot) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, pilot(world));
}

/**
 * Set `world` to the named scene (start, play, clear or end; any other name is start) and
 * return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset(world.seed ?? 1);
  if (name === 'play') {
    world.attract = false;
    const limit = Math.floor(40 / STEP);
    for (let i = 0; i < limit; i += 1) {
      world.step(STEP, carefulPilot(world));
      if (world.towed !== null && world.totalDelivered >= 1 && world.time > 9) break;
    }
    return { screen: SCREEN_GAME, best: 0 };
  }
  if (name === 'clear') {
    world.attract = false;
    const limit = Math.floor(120 / STEP);
    let cleared = false;
    for (let i = 0; i < limit; i += 1) {
      world.step(STEP, carefulPilot(world));
      if (world.phase === 'clear') { cleared = true; break; }
    }
    if (cleared) run(world, 0.5, () => IDLE);
    return { screen: SCREEN_GAME, best: 0 };
  }
  if (name === 'end') {
    world.attract = false;
    // A real run first: the careful pilot banks a couple of deliveries, so the game-over
    // panel carries a score worth reading. Then the reckless pilot takes over and ends it,
    // by mine or by clock, whichever the rules reach first.
    const careLimit = Math.floor(40 / STEP);
    for (let i = 0; i < careLimit; i += 1) {
      world.step(STEP, carefulPilot(world));
      if (world.totalDelivered >= 2 || world.phase !== 'play') break;
    }
    const limit = Math.floor(150 / STEP);
    for (let i = 0; i < limit && world.phase !== 'over'; i += 1) {
      world.step(STEP, recklessPilot(world));
    }
    if (world.phase !== 'over') {
      // Still flying: let the clock finish the run, as it finishes real ones.
      const drain = Math.floor(12 / STEP);
      for (let i = 0; i < drain && world.phase !== 'over'; i += 1) {
        if (world.phase === 'play') world.timeLeft = Math.min(world.timeLeft, 0.05);
        world.step(STEP, IDLE);
      }
    }
    run(world, 0.6, () => IDLE);
    return { screen: SCREEN_GAME, best: 0 };
  }
  world.attract = true;
  run(world, 4, () => IDLE);
  return { screen: SCREEN_TITLE, best: 0 };
}
