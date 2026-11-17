// A tiny deterministic random source (mulberry32). The world is seeded, so a staged screenshot
// or a replayed run is the same game every time; nothing in the simulation calls Math.random.

export function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** A whole number in [min, max]. */
export function whole(random, min, max) {
  return Math.floor(range(random, min, max + 1));
}
