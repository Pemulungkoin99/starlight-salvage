// Sound from nothing but oscillators and noise: no audio files, so the game stays self-contained.
// The context is created lazily on the first user gesture (browsers refuse it earlier), every
// effect is a short envelope, and M mutes the master gain. If WebAudio is missing, every call
// is a no-op and the game plays silently.

let context = null;
let master = null;
let muted = false;

/** Create the context if a user gesture has unlocked it; returns whether sound can play. */
export function unlockAudio() {
  if (context !== null) {
    if (context.state === 'suspended') context.resume();
    return true;
  }
  const Ctor = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : undefined;
  if (Ctor === undefined) return false;
  context = new Ctor();
  master = context.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(context.destination);
  return true;
}

export function toggleMute() {
  muted = !muted;
  if (master !== null && context !== null) master.gain.setValueAtTime(muted ? 0 : 0.5, context.currentTime);
  return muted;
}

export function isMuted() {
  return muted;
}

/** One tone with an attack/decay envelope. */
function tone(freqFrom, freqTo, seconds, type, volume, delay = 0) {
  if (context === null || master === null) return;
  const t0 = context.currentTime + delay;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t0 + seconds);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.05);
}

/** A burst of filtered noise, for explosions and impacts. */
function noise(seconds, volume, cutoff, delay = 0) {
  if (context === null || master === null) return;
  const t0 = context.currentTime + delay;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = context.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  source.connect(filter).connect(gain).connect(master);
  source.start(t0);
}

export const sfx = {
  grab() {
    tone(520, 880, 0.12, 'sine', 0.25);
    tone(1040, 1320, 0.1, 'sine', 0.12, 0.05);
  },
  release() {
    tone(700, 420, 0.1, 'sine', 0.15);
  },
  deliver(combo) {
    const base = 540 + Math.min(combo, 5) * 60;
    tone(base, base, 0.12, 'triangle', 0.3);
    tone(base * 1.25, base * 1.25, 0.12, 'triangle', 0.3, 0.09);
    tone(base * 1.5, base * 1.5, 0.2, 'triangle', 0.3, 0.18);
  },
  explosion() {
    noise(0.5, 0.6, 900);
    tone(160, 40, 0.5, 'sawtooth', 0.35);
  },
  podLost() {
    noise(0.3, 0.35, 1400);
    tone(320, 90, 0.3, 'square', 0.18);
  },
  hurt() {
    tone(220, 60, 0.35, 'sawtooth', 0.3);
  },
  tick() {
    tone(980, 980, 0.05, 'square', 0.12);
  },
  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.28, i * 0.09));
  },
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.97, 0.24, 'triangle', 0.26, i * 0.16));
  },
  start() {
    [262, 392, 523].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.22, i * 0.07));
  },
  click() {
    tone(660, 660, 0.05, 'square', 0.1);
  },
};
