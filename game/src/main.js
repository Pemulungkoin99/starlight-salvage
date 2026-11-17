// Boot and the frame loop. Two modes: a staged screenshot (?shot=start|play|clear|end&seed=N),
// which steps the world with shots.js's autopilot and draws one frame; and the live game, which
// reads input, steps the world at a fixed rate, plays the sounds its events name, keeps the best
// score, and announces the big moments to the status line for screen readers.

import { STEP } from './config.js';
import { Input } from './input.js';
import { World, EVENT } from './world.js';
import { draw, fitCanvas, SCREEN_GAME, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { sfx, toggleMute, unlockAudio } from './audio.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const BEST_KEY = 'starlight-salvage-best';

let best = 0;
try {
  best = Number(localStorage.getItem(BEST_KEY)) || 0;
} catch {
  best = 0;
}

function saveBest(score) {
  if (score <= best) return;
  best = score;
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Private mode and friends: the best score simply lasts the session.
  }
}

function announce(text) {
  status.textContent = text;
}

const shot = params.get('shot');
if (shot !== null) {
  const seed = Number(params.get('seed')) || 1;
  const world = new World(seed);
  const staged = stageShot(shot, world);
  const view = fitCanvas(canvas);
  requestAnimationFrame(() => {
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    draw(ctx, world, { screen: staged.screen, best: staged.best, paused: false, beamHeld: world.towed !== null });
  });
} else {
  const input = new Input(canvas);
  let world = new World((Date.now() % 100000) | 1);
  world.attract = true;
  let screen = SCREEN_TITLE;
  let paused = false;
  let beamHeld = false;
  let view = fitCanvas(canvas);
  window.addEventListener('resize', () => {
    view = fitCanvas(canvas);
  });

  function startRun() {
    world = new World(((Date.now() % 100000) | 1) + 7);
    world.attract = false;
    screen = SCREEN_GAME;
    paused = false;
    unlockAudio();
    sfx.start();
    announce('Run started. Tow pods to the dock before the clock runs out.');
  }

  function handleEvents(events) {
    if (events & EVENT.GRAB) sfx.grab();
    if (events & EVENT.RELEASE) sfx.release();
    if (events & EVENT.DELIVER) {
      sfx.deliver(world.combo);
      announce(`Pod delivered. Score ${world.score}. ${world.delivered} of ${world.spec.quota} this level.`);
    }
    if (events & EVENT.POD_LOST) sfx.podLost();
    if (events & EVENT.HURT) {
      sfx.hurt();
      announce(`Hull hit. ${world.hull} left.`);
    } else if (events & EVENT.EXPLOSION) {
      sfx.explosion();
    }
    if (events & EVENT.TICK) sfx.tick();
    if (events & EVENT.CLEAR) {
      sfx.levelClear();
      announce(`Level ${world.level} clear. Score ${world.score}.`);
    }
    if (events & EVENT.LEVEL_START) announce(`Level ${world.level}. Deliver ${world.spec.quota} pods.`);
    if (events & EVENT.OVER) {
      sfx.gameOver();
      saveBest(world.score);
      announce(`Game over. ${world.overReason} Final score ${world.score}.`);
    }
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    const pressed = input.drainPressed();
    if ((pressed.has('Enter') || pressed.has('Pointer')) && (screen === SCREEN_TITLE || world.phase === 'over')) {
      startRun();
    }
    if (pressed.has('KeyM')) {
      unlockAudio();
      announce(toggleMute() ? 'Sound off.' : 'Sound on.');
    }
    if (pressed.has('KeyP') && screen === SCREEN_GAME && world.phase === 'play') {
      paused = !paused;
      announce(paused ? 'Paused.' : 'Flying.');
    }
    if (!paused) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        if (screen === SCREEN_TITLE) {
          world.step(STEP, { turn: 0, thrust: false, brake: false, beam: false });
        } else {
          const intent = input.intent(world.ship.angle, world.ship.x, world.ship.y);
          beamHeld = intent.beam;
          handleEvents(world.step(STEP, intent));
        }
      }
    }
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    draw(ctx, world, { screen, best, paused, beamHeld });
  }
  requestAnimationFrame(frame);
}
