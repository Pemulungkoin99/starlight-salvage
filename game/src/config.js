// Starlight Salvage: the numbers every other file agrees on. The field is a fixed logical size;
// render.js scales it to the window, and the world simulation never hears about real pixels
// beyond these.

export const FIELD = { width: 1280, height: 800 };

/** The simulation's fixed step, in seconds. main.js accumulates real time into whole steps. */
export const STEP = 1 / 60;

export const SHIP = {
  radius: 13,
  turnRate: 3.6, // radians per second
  thrust: 300, // px per second^2
  brake: 2.6, // extra damping multiplier while braking
  damping: 0.32, // passive velocity damping, per second
  maxSpeed: 340,
  invulnerableSeconds: 2,
};

export const BEAM = {
  range: 175, // how far the tractor beam reaches
  halfAngle: 0.55, // radians either side of the nose
  tetherDistance: 48, // where a towed pod rides behind the ship
  spring: 90, // tether spring stiffness (acceleration per pixel of stretch)
  springDamping: 11, // tether damping: enough swing to feel the weight, not enough to slingshot
};

export const POD = { radius: 12, driftMin: 6, driftMax: 22 };
export const MINE = { radius: 12, driftMin: 4, driftMax: 13 };

/** The delivery berth: a zone on the right wall. A pod whose centre enters it is delivered. */
export const DOCK = { x: 1206, y: 400, halfHeight: 118, mouthX: 1150 };

export const START_HULL = 3;
export const MAX_HULL = 3;

/** What a level asks, allows and threatens, from its number (1-based). */
export function levelSpec(level) {
  return {
    quota: 2 + level, // pods to deliver: 3, 4, 5, ...
    seconds: 62 + 8 * level, // 70, 78, 86, ...
    pods: 4 + level, // pods adrift at once
    mines: 2 + 2 * level, // 4, 6, 8, ...
    driftScale: 1 + 0.12 * (level - 1),
  };
}

export const SCORE = {
  delivery: 100,
  comboWindow: 7, // seconds between deliveries for the combo to grow
  comboCap: 5,
  secondBonus: 4, // per second of clock a delivery adds back
  levelClearPerSecond: 5, // score per unused second when a level clears
};

export const COLORS = {
  space: '#0b1026',
  spaceDeep: '#070a1a',
  star: '#cfe4ff',
  hull: '#ffd166',
  hullDark: '#e0a458',
  shipBody: '#8ecae6',
  shipTrim: '#219ebc',
  flame: '#ffb703',
  beam: '#7bf1a8',
  pod: '#f4a261',
  podLight: '#ffe8d6',
  mine: '#ef476f',
  mineDark: '#b5179e',
  dock: '#06d6a0',
  text: '#e8f1ff',
  muted: '#8fa3c8',
  danger: '#ff5d73',
};
