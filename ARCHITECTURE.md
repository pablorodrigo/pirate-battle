# Architecture

This document explains how Pirate Battle is organized and why. It grows with the code: every section describes behavior that is already implemented.

## Overview

The application has three parts that change for different reasons:

- **Game** (`src/game`): configuration, rules, input and rendering of the battle. Rules are plain TypeScript in `game/core`; PixiJS in `game/rendering` only draws their state.
- **Interface** (`src/app`, `src/features`): React screens, menus, the HUD and dialogs.
- **Data** (`src/shared/api`, `src/shared/contracts`, `src/mocks`): the HTTP client, the contracts it shares with the mock server, and the MSW handlers that implement that server in the browser.

```text
keyboard ─► InputManager ─► GameRuntime ─► GameSession (rules, fixed steps) ─► World
                               │                                                │
                               ├─► PixiRenderer (reads World, draws every frame)◄┘
                               └─► HUD snapshot ─► React (useSyncExternalStore)
```

## Module boundaries

| Module | May import | Must not import |
| --- | --- | --- |
| `game/core`, `game/config` | Each other | PixiJS, React, Axios, MSW, TanStack Query, any other module |
| Other `game/` modules (`runtime`, `input`, `rendering`) | PixiJS, `game/core`, `game/config`, each other | React, Axios, MSW, TanStack Query, `app`, `features`, `mocks`, `shared/api` |
| `shared/contracts` | Other contracts, `game/config` | React, PixiJS, Axios, MSW, TanStack Query, `app`, `features`, `mocks`, `shared/api`, game rendering and runtime |
| `shared/api` | Axios, `shared/contracts` | React, PixiJS, MSW, TanStack Query, `app`, `features`, `game`, `mocks` |
| `mocks` | MSW, `shared/contracts`, `shared/storage`, `shared/api/apiConfig` | React, PixiJS, Axios, TanStack Query, `app`, `features` |
| `app`, `features` | Any module above | — |

`.oxlintrc.json` enforces the table with `no-restricted-imports` overrides, so `npm run lint` fails when an import crosses a boundary.

## Simulation

**Fixed steps.** `GameSession` advances the match 60 times per simulated second, whatever the frame rate. `FixedStepLoop` converts raw frame times (`ticker.elapsedMS`) into whole steps and keeps the remainder, which the renderer uses to interpolate between the last two poses. Durations, cooldowns, lifetimes and spawn intervals are converted once to whole step counts, so timing never drifts with floating-point time. A configured value that is not a multiple of 1/60 s is rounded to the nearest step.

**Long frames** (a stall or a debugger break) are capped at 250 ms and 15 steps; the excess is dropped, so the match slows down for that moment instead of jumping ahead.

**Step order.** Each step runs these phases in order:

1. Save the previous poses, refresh the navigation target every 0.25 s.
2. Intents: the player's input snapshot, and the strategy of each enemy kind.
3. Movement: turn and sail, separate overlapping enemies, push ships out of islands and back inside the arena, then resolve Chaser contact.
4. Projectiles already in flight: move, resolve the first impact, apply damage.
5. New shots and spawns. New projectiles start moving on the next step. Nothing is fired or spawned at the closing instant of the match.
6. Advance active time, end the match on timeout, remove destroyed entities.

A phase that destroys the player ends the match before any later phase runs, so a death and a timeout in the same step end the match by death. The step in which the match ends counts as played time.

**State machine.** A session is `ready`, `running`, `paused`, `finished` or `abandoned`, and only advances while `running`. Leaving the game screen abandons the match: it produces no result.

**Determinism.** Every random decision comes from one seeded generator (mulberry32) per match, so a seed and the same inputs reproduce the same match.

## Collisions

- **Ships against islands and borders.** Ships are circles and islands are rectangles. After moving, a ship is pushed out of each island along the shortest direction, which makes it slide along the face, and then clamped so its whole hull stays inside the arena. Ships move at most a few units per step, far less than their radius, so they cannot tunnel.
- **Projectiles.** Each step, a projectile tests its whole segment against every island inflated by its radius, and against every living ship of the other faction using their relative motion during the step. The earliest impact wins; on a tie the island wins, then the ship with the lowest id. The projectile stops there, is deactivated at once (so it never damages twice) and is removed at the end of the step. Projectiles also disappear when their lifetime ends or when they leave the arena.
- **Damage and score.** `damageShip` only acts on living ships. The transition from alive to destroyed happens once: the ship stops moving, firing, colliding and taking damage immediately, and is removed at the end of the step. Only a player projectile destroying an enemy scores, so several hits in the same step still score one point, and a Chaser sinking on contact scores nothing.

## Enemies and spawns

- **Chaser:** heads for the player and sinks on contact, dealing its contact damage once.
- **Shooter:** approaches until it is in range with a clear line of fire, then holds position and aims. It releases the position only beyond the range plus a hysteresis margin, so it does not jitter at the edge. It fires only when in range, aimed within tolerance, with a clear line and a ready cannon.
- **Navigation.** An enemy that sees the player sails straight at it. Otherwise it follows `NavigationGrid`: a 40-unit grid over the arena with islands inflated by the largest enemy radius. Instead of one A* search per enemy, the grid keeps a single Dijkstra distance field to the player, refreshed every 0.25 s; each enemy walks downhill from its cell and steers at the farthest downhill cell still in sight. Diagonals never cut corners. The cost of an update does not grow with the number of enemies.
- **Steering.** Turning is proportional to the angle left, so ships never overshoot, and a ship turns in place when its target is far behind it.
- **Spawns.** One enemy per configured interval of active play, so pauses never queue spawns. The first two are a Chaser and a Shooter, so every match meets both; later kinds come from the seeded generator. A spawn point must be open water, clear of other ships, reachable on the navigation grid and at least 360 units from the player (beyond the Shooter range). After 32 random attempts the arena's fallback points are tried, farthest from the player first; if none is safe, that spawn is skipped.

## Input

`InputManager` merges every source into one snapshot per step. An action stays active while any source holds it, so releasing one key never cancels another that holds the same action. `KeyboardInput` uses `KeyboardEvent.code`, so other keyboard layouts keep the same physical keys. It captures game keys only while the match runs, never from form fields, and calls `preventDefault` only for the keys it uses. Auto-repeat never presses an action: after a pause, a key held since before the pause must be released and pressed again.

## Pause

The match pauses from the Pause button, `P` or `Escape`, when the window loses focus, or when the tab is hidden. While paused, frames keep rendering but never reach the fixed-step loop, so the clock, cooldowns, spawns and movement are frozen and no paused time is replayed. Input is cleared on pause and resume. Resuming always needs a player action: the Resume button, `P` or `Escape`.

## React and the game

**Ownership.** React owns the screens and their layout; PixiJS owns the arena canvas. `useGameRuntime` creates the session, the renderer and the runtime in an effect for each visit of the game screen, and releases all of them in the cleanup. React never touches PixiJS objects, and a match never survives leaving the screen. Play Again changes the screen's React key, so the next match always starts from a fresh session.

**HUD synchronization.** `GameRuntime` is also an external store: React reads a `HudSnapshot` (status, score, health, remaining time) through `useSyncExternalStore`. The runtime builds the snapshot every frame but publishes a new object only when a displayed value changes, so React renders about once per second during play, never per frame. Positions and animations stay in the simulation and the renderer.

**Accessibility of the match.** Score, time and health are also semantic markup (`dl`, `meter`). A polite live region only announces pause and the end of the match, never the clock. The pause menu is a native modal `dialog`, which traps focus, makes the page behind it inert and restores focus when it closes.

## Rendering

**Strict Mode and asynchronous initialization.** `PixiRenderer` owns a private `Application`, created with `sharedTicker: false` and `autoStart: false`. `Application.init()` is asynchronous, and in development React Strict Mode unmounts and remounts every component once, so the cleanup can run before `init()` resolves. In that case `destroy()` only marks the renderer as destroyed, and `mount()` completes the teardown as soon as `init()` settles. A discarded instance never attaches its canvas.

**Views.** The renderer keeps one view per entity id, creates views for new entities, interpolates their pose between the last two simulated steps, and destroys the views of removed entities. Ships darken with damage, flash when hit and carry a level health bar.

**Effects.** Muzzle flashes, impacts and explosions react to the events of each step and run on simulation time, so they freeze while the match is paused and look the same for the same match.

**Disposal order.** Views are destroyed first, then the shared `GraphicsContext`s of projectiles and effects, then the application with `{ removeView: true }` and `{ children: true, context: true }`. In PixiJS 8 a `Graphics` frees its own context only when destroyed without options or with `context: true`, and leaves a shared context alone when destroyed without options, so each context is destroyed exactly once.

**Viewport.** The arena has a fixed logical size of 1280 × 720 units. A `ResizeObserver` on the host element resizes the renderer, scales the scene uniformly by `min(width / 1280, height / 720)` and centers it with letterbox margins. The host is absolutely positioned, so the canvas size never feeds back into the observed size. The resolution follows `devicePixelRatio`, capped at 2, with `autoDensity`.

## Mock API

- MSW serves the API in development, in the end-to-end tests and in the published build, so `msw` is a runtime dependency.
- `src/main.tsx` awaits `worker.start()` before the first render, so no query runs before the mocks are ready. If the worker fails to start, the app logs a warning and renders anyway: the game never depends on the API.
- The worker module is loaded with a dynamic import. Builds with `VITE_ENABLE_MOCKS=false` leave the MSW library out of the bundle.
- Every request goes through a single Axios instance (`shared/api/httpClient.ts`). Contract modules validate response bodies at runtime before they reach TanStack Query, because a type annotation does not validate JSON.
- TanStack Query defaults: `staleTime` of 15 s, `gcTime` of 5 min, and two retries with exponential backoff (1 s, then 2 s).

## Testing

- **Unit tests** (Vitest) cover the rules in isolation: geometry, the fixed-step loop, input merging, movement, combat, enemies, navigation, spawns, configuration and navigation between screens.
- **End-to-end tests** (Playwright) run against the e2e build (`vite --mode e2e`), which installs a test bridge on `window.__PIRATE_BATTLE__`. Before a match starts, a scenario can set the seed, switch to a manual clock and place ships. During the match the bridge only reads state and advances whole steps. It never writes health or score, and tests act through real key presses. The public build leaves the bridge out, because the flag that loads it is replaced at build time.
- **Strict Mode** double mounting only happens in development builds, so the `dev-strict-mode` project runs the same suite against the dev server.

## Balancing

All rule parameters live in a typed configuration (`src/game/config`); systems never hard-code them.

| Parameter | Initial value |
| --- | --- |
| Arena | 1280 × 720 units, five tile-aligned islands |
| Match duration | 120 s (Options: 60–180 s) |
| Spawn interval | 2.5 s (Options: 1–10 s, steps of 0.5 s) |
| Player | 100 HP, 180 units/s, π rad/s, radius 22 |
| Front cannon | 20 damage, 600 units/s, 1.4 s lifetime, 0.25 s cooldown |
| Side cannons | 3 shots of 15 damage, 500 units/s, 1.2 s lifetime, 0.9 s cooldown per side |
| Chaser | 30 HP, 100 units/s, 2.4 rad/s, radius 20, 25 contact damage |
| Shooter | 40 HP, 75 units/s, 1.8 rad/s, radius 22, range 280, 10 damage every 1.5 s |
| Spawn distance | at least 360 units from the player |

A match runs on a frozen copy of the configuration built when it starts, so changing Options only affects the next match. The `rulesVersion` identifies the balance; a fingerprint test fails when the configuration changes without a new version, so rankings never mix matches played under different rules.

## Tooling decisions

- **oxlint rather than ESLint.** The Vite template ships with oxlint, and its `overrides` with `no-restricted-imports` cover the boundary rules above.
- **Strict TypeScript.** `strict` is set explicitly, together with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` and `noImplicitReturns`. `erasableSyntaxOnly` rules out enums, namespaces and parameter properties.
- **Pinned dependencies.** Versions are exact, and `.npmrc` sets `min-release-age=7`, so new installs only pick releases that have been public for at least a week.
- **MSW 2 rather than MSW 3.** MSW 3.0.0 came out less than two weeks before the project started and was still receiving frequent patches. MSW 2.15 is stable and well documented.

## Known limitations

- The arena still uses blockout shapes: the provided art is not integrated yet.
- Controls are keyboard only; touch controls are not implemented yet.
