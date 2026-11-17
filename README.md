# Starlight Salvage — a make.fun best-game-01 entry

A top-down salvage game in plain ES modules: no engine, no build step, no network. The fleet
scattered its cargo pods across the belt; you fly the tug, tow pods home with a tractor beam,
and mind the mines.

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). Tow drifting pods into the green dock on the right wall before the
level clock runs out. Each delivery buys back 4 seconds, and quick chains build a combo
multiplier. A mine that touches the tug costs one of three hull points; a mine that touches a
towed pod eats the cargo. Clear the berth quota to advance: every level drifts more pods,
more mines and a longer clock, and clearing restores a hull point.

- Fly: arrow keys or WASD — or point with the mouse and hold the left button
- Tractor beam: hold SPACE or the right mouse button; release to drop the pod
- Brake: down arrow or S. Pause: P. Sound: M. Restart: ENTER

## How it is built

- `game/src/config.js` — the field, the ship, beam, dock and level numbers
- `game/src/random.js` — a seeded mulberry32, so runs replay exactly
- `game/src/world.js` — the fixed-step simulation (physics, towing spring, collisions, levels,
  particles); it returns event flags and knows nothing of the DOM
- `game/src/render.js` — all canvas drawing: sky, dock, tug, pods, mines, HUD and screens
- `game/src/input.js` — keyboard and mouse read as one intent
- `game/src/audio.js` — WebAudio-synthesised effects; no audio files
- `game/src/shots.js` — the autopilots that stage the `?shot=` screenshot scenes
- `game/src/main.js` — boot, the frame loop, sound wiring, the best score
- `main.ts` — hands the entry in: copies `game/` and `screenshots/` to the output directory
  and writes `dossier.json` with the vendored `vendor/makefun-game.ts`
- `serve.ts` — a tiny static server for local play

Sound effects are synthesised in code and all art is drawn in code; every name is the game's
own. MIT licensed (see LICENSE).
