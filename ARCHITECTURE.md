# Architecture

This document explains how Pirate Battle is organized and why. It grows with the code: every section describes behavior that is already implemented.

## Overview

The application has three parts that change for different reasons:

- **Game** (`src/game`): configuration, rules, input, assets, rendering and sound of the battle. Rules are plain TypeScript in `game/core`; PixiJS in `game/rendering` only draws their state, and `game/audio` only plays it.
- **Interface** (`src/app`, `src/features`): React screens, menus, the HUD, dialogs and touch controls.
- **Data** (`src/shared/api`, `src/shared/contracts`, `src/mocks`, `src/features/registration`): the HTTP client, the contracts it shares with the mock server, the MSW handlers that implement that server in the browser, and the outbox that registers finished matches.

```text
keyboard / touch ─► InputManager ─► GameRuntime ─► GameSession (rules, fixed steps) ─► World
                                       │                                                │
                                       ├─► PixiRenderer (reads World every frame) ◄─────┘
                                       ├─► HUD snapshot ─► React (useSyncExternalStore)
                                       └─► match result ─► journal + outbox ─► coordinator
                                                                                  │
React lists ─► TanStack Query ─► Axios ─► MSW handlers ─► mock database ◄── mutation (Axios)
```

## Module boundaries

| Module | May import | Must not import |
| --- | --- | --- |
| `game/core`, `game/config` | Each other | PixiJS, React, Axios, MSW, TanStack Query, any other module |
| Other `game/` modules (`assets`, `audio`, `input`, `rendering`, `runtime`) | PixiJS, `game/core`, `game/config`, each other | React, Axios, MSW, TanStack Query, `app`, `features`, `mocks`, `shared/api` |
| `shared/contracts` | Other contracts, `game/config` | React, PixiJS, Axios, MSW, TanStack Query, `app`, `features`, `mocks`, `shared/api`, game rendering and runtime |
| `shared/api` | Axios, `shared/contracts` | React, PixiJS, MSW, TanStack Query, `app`, `features`, `game`, `mocks` |
| `mocks` | MSW, `shared/contracts`, `shared/storage`, `shared/api` configuration, `game/config` (the rules version of the fixtures) | React, PixiJS, Axios, TanStack Query, `app`, `features` |
| `app`, `features` | Any module above | — |

`.oxlintrc.json` enforces the table with `no-restricted-imports` overrides, so `npm run lint` fails when an import crosses a boundary. `src/testing` (the end-to-end bridge) is only loaded by the e2e build.

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

**State machine.** A session is `ready`, `running`, `paused`, `finished` or `abandoned`, and only advances while `running`. Leaving the game screen, or reloading the page, abandons the match: it produces no result and is never registered.

**Determinism.** Every random decision comes from the match seed (mulberry32), so a seed and the same inputs reproduce the same match. The map, the spawns and the scenery's decorations draw from separate streams derived from it, so drawing more for one never shifts the others.

## Collisions

- **Ships against islands and borders.** Ships are circles and islands are rectangles. After moving, a ship is pushed out of each island along the shortest direction, which makes it slide along the face, and then clamped so its whole hull stays inside the arena. Ships move at most a few units per step, far less than their radius, so they cannot tunnel.
- **Projectiles.** Each step, a projectile tests its whole segment against every island inflated by its radius, and against every living ship of the other faction using their relative motion during the step. The earliest impact wins; on a tie the island wins, then the ship with the lowest id. The projectile stops there, is deactivated at once (so it never damages twice) and is removed at the end of the step. Projectiles also disappear when their lifetime ends or when they leave the arena.
- **Damage and score.** `damageShip` only acts on living ships. The transition from alive to destroyed happens once: the ship stops moving, firing, colliding and taking damage immediately, and is removed at the end of the step. Only a player projectile destroying an enemy scores, so several hits in the same step still score one point, and a Chaser sinking on contact scores nothing.

## Map generation

Every match draws its map from its seed with `generateMap` (`src/game/core/map`). The arena keeps its size, its player start and its proportions, so the screen layouts, the HUD and the controls never change with the map.

- **Obstacles.** Maps are laid out on the 64-unit tile of the art, so every obstacle is drawn without scaling. A map has four or five islands, one or two of them coasts against a border, and up to two reefs. Sand islands take 2–4 × 2–3 tiles; the grass island is the art's fixed 4 × 4 block, tried in three maps out of four and kept in about three in five, where it fits; a reef is one rock, whose collider is the rock's opaque part (54 × 46 units).
- **Rules of a layout.** Obstacles are placed from the largest, at random positions, and a layout is kept only when all of these hold:
  - every channel between two obstacles, and between an obstacle and a border it does not touch, is at least 128 units wide, which leaves 80 units of free water beside the largest enemy's clearance, two navigation cells;
  - nothing lies within 128 units of the player start (the classic map has an island 112 units away);
  - the obstacles cover 8–20% of the arena (the classic map covers 13%);
  - the navigation grid, grown by the largest enemy radius, reaches every free cell from the start, so there is no closed water to hide in;
  - at least four fallback spawn points remain: open water reachable from the start and at least 360 units from it, spread out by always taking the candidate farthest from those already chosen.

  An obstacle gets 60 positions to fit and a layout 40 attempts; after that the classic five islands are used. Over 2,000 seeds none fell back, and a map takes about 0.3 ms to draw.
- **Colliders.** Islands and reefs are rectangles, the same shape as the classic islands, so collisions, projectiles, navigation and spawns run unchanged on every map.
- **Classic map.** The five fixed islands remain as the fallback and as the map of the end-to-end tests that place ships at known spots, which pin it through their scenario.
- **Tests.** Unit tests check every rule above over 300 seeds, and the fallback. End-to-end tests check that the page plays the very map the generator draws for a seed, that a seed always brings its map back, and that an island of a drawn map stops the player; a visual baseline covers a drawn map.
- **Ranking.** The map is part of the rules, so this change moved `RULES_VERSION` to 2: matches on drawn maps are never ranked with those of the fixed map. The fixtures follow the current version, and the mock database's storage version moved with it, so a stored database is seeded again.

## Enemies and spawns

- **Chaser:** heads for the player and sinks on contact, dealing its contact damage once.
- **Shooter:** approaches until it is in range with a clear line of fire, then holds position and aims. It releases the position only beyond the range plus a hysteresis margin, so it does not jitter at the edge. It fires only when in range, aimed within tolerance, with a clear line and a ready cannon.
- **Navigation.** An enemy that sees the player sails straight at it. Otherwise it follows `NavigationGrid`: a 40-unit grid over the arena with islands inflated by the largest enemy radius. Instead of one A* search per enemy, the grid keeps a single Dijkstra distance field to the player, refreshed every 0.25 s; each enemy walks downhill from its cell and steers at the farthest downhill cell still in sight. Diagonals never cut corners. The cost of an update does not grow with the number of enemies.
- **Steering.** Turning is proportional to the angle left, so ships never overshoot, and a ship turns in place when its target is far behind it.
- **Spawns.** One enemy per configured interval of active play, so pauses never queue spawns. The first two are a Chaser and a Shooter, so every match meets both; later kinds come from the seeded generator. A spawn point must be open water, clear of other ships, reachable on the navigation grid and at least 360 units from the player (beyond the Shooter range), and a new Shooter waits one cooldown before its first shot. After 32 random attempts the arena's fallback points are tried, farthest from the player first; if none is safe, that spawn is skipped.

## Input

`InputManager` merges every source into one snapshot per step. An action stays active while any source holds it, so releasing one key or finger never cancels another that holds the same action.

- **Keyboard.** `KeyboardInput` uses `KeyboardEvent.code`, so other keyboard layouts keep the same physical keys. It captures game keys only while the match runs, never from form fields, and calls `preventDefault` only for the keys it uses. Auto-repeat never presses an action: after a pause, a key held since before the pause must be released and pressed again.
- **Touch.** On touch screens, two clusters of round buttons sit beside the arena in landscape and below it in portrait, never over it (see [Screen layout and orientation](#screen-layout-and-orientation)). Each button uses Pointer Events with pointer capture: the action stays held while the finger that pressed it is down, and `pointerup`, `pointercancel` or a lost capture release only that finger's action. The buttons are at least 44 px and stay out of the tab order, because keyboard players have keys. The main menu's How to play uses the same touch detection to show these buttons, with their atlas art, instead of the keys.

## Pause

The match pauses from the Pause button, `P` or `Escape`, when the window loses focus and when the tab is hidden. While paused, frames keep rendering but never reach the fixed-step loop, so the clock, cooldowns, spawns and movement are frozen and no paused time is replayed. Input is cleared on pause and resume. Resuming always needs a player action: the Resume button, `P` or `Escape`.

## Screen layout and orientation

**Both orientations on touch screens.** The game also runs with the phone upright. A large share of mobile players prefer to hold the phone in portrait, according to many game sites and player forums, so the game does not force landscape. Turning the device changes the layout only: the arena keeps its size in world units, and no rule, timer or input depends on the orientation, so a rotation never pauses the match.

**Nothing covers the arena.** The arena is always drawn whole, scaled to fit and centred, and the HUD and the controls only use the space the arena leaves, so neither is ever cut or drawn over the other. `useScreenLayout` picks one of three layouts from the pointer type (or touch support) and the orientation media query. The game screen exposes it as `data-layout`, and each touch layout is a CSS grid:

| Layout | Arrangement |
| --- | --- |
| `keyboard` | The HUD in a row above the arena. |
| `landscape` (touch) | The HUD and the controls share the two side columns: health on the left; pause, score and time on the right; the controls below them as compact triangles of 48 px buttons. The arena gets the full height of the middle column. |
| `portrait` (touch) | The arena spans the full width, edge to edge, between the HUD above it and the controls below it, which spread out with buttons from 44 to 64 px wide (14% of the screen width). |

In the landscape layout the HUD header draws no box (`display: contents`), so the grid places each of its parts in a side column while the markup stays one semantic block. In portrait, the HUD and the controls keep their size, and on a very short screen the arena's box shrinks instead; the renderer fits the arena inside whatever box it gets.

**Touch gestures.** The page behaves like a game, not a document:

- It selects no text and opens no long-press callout. Form fields stay selectable.
- A double tap never zooms the page.
- Menus keep pinch zoom.
- The game screen sets `touch-action: none`, so no gesture on it scrolls or zooms the page.
- iOS Safari ignores `user-scalable=no` and zooms through its own gesture events, so `useNoPageZoom` cancels `gesturestart` and `gesturechange` while the game screen is mounted, and removes the listeners when it unmounts.

## React and the game

**Ownership.** React owns the screens and their layout; PixiJS owns the arena canvas. `useGameRuntime` loads the shared textures, then creates the session, the renderer and the runtime for each visit of the game screen, and releases all of them in the effect cleanup. React never touches PixiJS objects. Play Again changes the screen's React key, so the next match always starts from a fresh session.

**HUD synchronization.** `GameRuntime` is also an external store: React reads a `HudSnapshot` (status, score, health, remaining time) through `useSyncExternalStore`. The runtime builds the snapshot every frame but publishes a new object only when a displayed value changes, so React renders about once per second during play, never per frame. Positions and animations stay in the simulation and the renderer.

**Accessibility of the match.** Score, time and health are semantic markup (`dl`, `meter`) behind the HUD art. A polite live region only announces pause and the end of the match, never the clock. The pause menu is a native modal `dialog`, which traps focus, makes the page behind it inert and restores focus when it closes. Screens move focus to their heading when they open.

## Assets and loading

- **Loading.** `loadGameTextures` loads the ship atlas and the tile sheet once, reports progress to the loading screen, and shares the textures across matches through PixiJS's asset cache; a match only starts once they and the renderer are ready. A failed load is forgotten, so Retry fetches again, and the loading screen shows an accessible error with Retry and Main Menu.
- **Ship atlas.** The ship sheet comes as Sparrow/Starling XML, which PixiJS cannot load, so `parseSparrowAtlas` maps its frames onto textures. Sprite `ship_n` is intact, `n + 6` and `n + 12` show increasing damage and `n + 18` is the wreck; the player is blue, Chasers red and Shooters black.
- **Densities.** Only the tile sheet and the UI images have true 2× versions. The tile sheet is loaded at resolution 2 on high-density screens, which keeps its frames in logical units.
- **Main-thread image loading.** Image loads inside PixiJS's worker never settle when a request fails, which would leave the loading screen spinning forever, so images load on the main thread, where failures reject. A 20 s timeout turns a stalled connection into the same recoverable error, and progress reported after a failure no longer replaces the error.
- **Ownership.** Shared textures belong to the asset cache and are never destroyed by a match. A renderer only destroys what it creates. The shared textures are built in a function of their own, because a closure keeps its whole scope alive: built next to the loader's progress callback, they kept the first game screen in memory.

## Rendering

**Strict Mode and asynchronous initialization.** `PixiRenderer` owns a private `Application`, created with `sharedTicker: false` and `autoStart: false`. `Application.init()` is asynchronous, and in development React Strict Mode unmounts and remounts every component once, so the cleanup can run before `init()` resolves. In that case `destroy()` only marks the renderer as destroyed, and `mount()` completes the teardown as soon as `init()` settles. A discarded instance never attaches its canvas.

**Terrain.** Water and every obstacle are baked once per match into canvas textures of their own, drawing the tiles at whole-unit positions, so neighbouring atlas texels never bleed into seams when the scene scales. The water is a tiling sprite that drifts on simulation time and is clipped to the arena, which keeps the arena bounds visible. Each obstacle is baked with its ring of shallow water, made of the pack's translucent shallow-water tiles and cut at the arena border. Sand islands use the sand nine-slice, whose coast sides carry on to the border without an edge, plus palms, rocks and sprouts; the grass island carries either a small fort (corner towers, a gate and walls whose cannons point outwards) or plants; a reef is a rock in a small patch of shallows. Decorations come from the match seed, so a seed always shows the same picture. Only the water texture repeats: the others clamp at their edges, because a repeating texture blended the far border of a coast into its near edge. Colliders always come from the map, never from the art, and the art stays inside its obstacle.

**Views.** The renderer keeps one view per entity id, creates views for new entities, interpolates their pose between the last two simulated steps, and destroys the views of removed entities. A ship's sprite follows its health (intact above two thirds, damaged above one third, then critical with flames), flashes red when hit and carries a level health bar. Cannonballs have short trails.

**Effects.** Muzzle flashes, impacts, splashes, explosions and sinking wrecks react to the events of each step and run on simulation time, so they freeze while the match is paused and look the same for the same match.

**Disposal order.** Views are destroyed first, then the shared geometry of trails and splashes, then the terrain's baked textures, then the application with `{ removeView: true }` and `{ children: true, context: true }`. Baked canvases are emptied as their textures are destroyed, because PixiJS's global pool of draw batches may still reference those textures until a later match reuses the batches. In PixiJS 8 a `Graphics` frees its own context only when destroyed without options or with `context: true`, and leaves a shared context alone when destroyed without options, so each context is destroyed exactly once.

**Viewport.** The arena has a fixed logical size of 1280 × 720 units. A `ResizeObserver` on the host element resizes the renderer, scales the scene uniformly by `min(width / 1280, height / 720)` and centers it with letterbox margins. The host is absolutely positioned, so the canvas size never feeds back into the observed size. The resolution follows `devicePixelRatio`, capped at 2, with `autoDensity`.

## Audio

`SoundBank` plays the provided WAV files through one Web Audio context shared by every match, like the textures. Browsers only allow audio to start inside a user gesture, so the Play buttons unlock it, and so does resuming a match. Sound is never required: files load in the background once a match has started, and only while sound is on, so they never compete with the textures a match waits for. A sound that is not ready yet, or failed to load, is skipped; the first match may therefore start in silence.

`MatchSounds` turns one match into sound and never changes it. Combat comes from the events of each frame: cannons, broadsides, hits on wood or splashes, explosions, rams, the player's ship sinking and the points scored. Each sound plays at most once per frame, however many events ask for it, and enemy fire is quieter than the player's. The start, pauses, the last five seconds and the drop below a third of health come from the HUD snapshot. The ocean ambience loops while the match runs and stops when it pauses, ends or leaves the screen.

The setting is stored on its own, outside the match settings, and applies at once: Options saves it with the other settings, and the pause menu has the same switch. While sound is off, no sound file is downloaded.

## UI skin

`installUiSkin` reads `ui_sheet.json` and publishes it as CSS custom properties before the first render. Each image is an `image-set` of its 1× and 2× files, resolved from its `ui.image` path, which is relative to the atlas. Sizes, borders and insets stay in the atlas's logical (1×) units, so the retina files never double a control's size:

- the menu panel is a nine-slice whose cut is expressed as percentages of the image (identical for both densities), with border widths in logical pixels and content padding from `content_rect`;
- menu buttons take their label area from `label_rect`;
- round buttons draw their icon at `icon_render_size`;
- the health bar draws the frame, then the fill clipped along x from the left of `fill_rect`, as `clip_axis` and `draw_order` specify.

## Ranking and match history

**Contracts.** `shared/contracts/matches.ts` defines completed matches, ranking entries, pages and registration responses, each with a runtime parser: a type annotation does not validate JSON, and a response that does not match its contract is an error, never data. A completed match holds its id, the player's id and name, the completion date (UTC), the score, the active duration, the end reason, the ruleset id and the configuration it ran on.

| Operation | Endpoint | Behavior |
| --- | --- | --- |
| Ranking | `GET /api/ranking?rulesetId=…&page=1&pageSize=10` | Confirmed matches of one ruleset, ranked, with their global position. |
| History | `GET /api/players/:playerId/matches?page=1&pageSize=10` | The player's confirmed matches, newest first. |
| Register | `POST /api/matches` with `Idempotency-Key: <matchId>` | `201` for a new match, `200` with the existing record for an identical resend, `409` for a different payload under the same id. |

**Comparable rankings.** The ruleset id combines the rules version with the two Options settings (`r1-d120-s2.5`), because the version fixes every other parameter and the arena. Only matches with the same id are ranked together. Ties are broken by survival time (longer first), then by the earlier match, then by the match id, so every position is deterministic. The ranking is derived from the confirmed matches, so a match can never be ranked twice or without its history entry.

**Queries.** Every parameter that changes a response is part of its key (`['ranking', rulesetId, page, pageSize]`, `['history', playerId, page, pageSize]`). Lists keep the previous page on screen while the next loads, and refetch every time their tab is shown (`refetchOnMount: 'always'`). Defaults: `staleTime` 15 s, `gcTime` 5 min; only transient failures (network, timeout, 408, 429, 5xx) retry, at most twice, 1 s and then 2 s apart. Loading, empty, error and background refresh states are explicit, and a failed refresh keeps the saved data on screen. The request's `AbortSignal` reaches Axios, so cancelled queries cancel their requests.

**Late answers.** Cancelling requests reduces races but does not close them: a list shown again can share a read that started before a registration instead of starting a new one. Every page and registration therefore carries the database revision, which grows with each new match. `RevisionGuard` remembers the newest revision the client has seen, discards any older answer and repeats the read (at most three times), so a late response never replaces newer data.

## Registration and the outbox

1. A match starts with a new id. When it ends, the client builds the completed match and writes it to the journal as the last result **and** as a pending registration, in a single write, before any request.
2. `RegistrationCoordinator`, created once for the whole app, sends the outbox one request at a time, never two for the same match, through a TanStack Query mutation keyed by the match id. Mutation retries are disabled; the coordinator owns the policy.
3. On success it removes that entry, raises the revision guard and invalidates both lists: active lists refetch at once (cancelling older requests), the others on their next display.
4. Transient failures back off (1 s, 2 s, 4 s… up to 30 s) and retry on their own, and also immediately when the browser goes online or the network scenario changes. A rejected registration waits for **Try again**. An entry in backoff never blocks the others.

The result screen shows the registration status of its own match (saving, saved, waiting to retry, or rejected), and the player can start another match while a registration is pending. After a reload, the coordinator resumes the outbox and the result screen reopens until the player leaves it. Because every resend carries the original payload and idempotency key, a timeout after the server saved the match returns the existing record instead of creating a second one.

## Local persistence

| Store | Owner | Lifetime |
| --- | --- | --- |
| `pirate-battle:settings` | Options store | Until changed; restored after reloads. |
| `pirate-battle:player` | Player identity | Created on first use. |
| `pirate-battle:journal` | Match journal | Last result, its reopen flag and the outbox, until confirmed or reset. |
| `pirate-battle:mock-database` | Mock server | Confirmed matches and the revision, until a demo reset. |
| `pirate-battle:network-scenario` | Mock server | The selected scenario. |
| `pirate-battle:sound` | Sound setting | Until changed. |

Every entry is stored as `{ version, data }` and validated on read; an older version or corrupt data is ignored instead of trusted. Writes report failures (blocked or full storage), and the result screen warns when a match could not be stored. The journal assumes a single tab writing at a time.

## Mock API

- MSW serves the API in development, in the end-to-end tests and in the published build, so `msw` is a runtime dependency. Handlers, contracts and fixtures are the same in all three.
- `src/main.tsx` awaits `worker.start()` before the first render, so no query runs before the mocks are ready. If the worker fails to start, the app logs a warning and renders anyway: the game never depends on the API.
- The worker module is loaded with a dynamic import. Builds with `VITE_ENABLE_MOCKS=false` leave the MSW library out of the bundle.
- MSW runs the handlers in the page, so the mock database is a synchronous read-modify-write over `localStorage`: two writes can never interleave, and registration is a single atomic step. The database is seeded with fixture matches of other captains. The `paginated` preset also gives the local captain 23 matches, three pages of history, in the quick ruleset, so the default ranking keeps its five pages.
- **Scenarios** shape each request: delays (fixed, or seeded per request so they are reproducible), out-of-order reads that answer with the data from when they arrived, HTTP 4xx/5xx and network failures, timeouts, a registration saved before its answer is lost, and an outage. Delays scale with the request timeout, which the e2e build shortens to 2 s, so failure scenarios stay fast in tests.
- **Reset** cancels requests in flight, restores the fixtures and the success scenario, clears the journal and the revision guard, and bumps a generation counter. A registration that started before the reset checks the counter before writing, so it can never land in the restored data.

## Testing

- **Unit tests** (Vitest) cover the rules in isolation: geometry, the fixed-step loop, input merging, movement, combat, enemies, navigation, spawns, map generation (every rule of a layout over 300 seeds, and the fallback), configuration, the atlas parser, the mock database, the revision guard, the registration outbox, the match sounds and screen navigation.
- **End-to-end tests** (Playwright) run against the e2e build (`vite --mode e2e`), which installs a test bridge on `window.__PIRATE_BATTLE__`. Before a match starts, a scenario can set the seed, which also draws the map, pin the classic map, switch to a manual clock and place ships. During the match the bridge only reads state and advances whole steps. It never writes health or score, and tests act through real key presses, or held fingers through the Chrome DevTools Protocol, since Playwright's touchscreen only taps. The public build leaves the bridge out, because the flag that loads it is replaced at build time.
- **Requests from the page go through MSW's service worker**, which fetches unhandled requests itself, so tests intercept asset requests with `context.route` (which sees service worker traffic) rather than `page.route`.
- **Strict Mode** double mounting only happens in development builds, so the `dev-strict-mode` project runs the same suite against the dev server.
- **Touch layout.** The mobile project resizes itself to seven phone screens, four in landscape and three in portrait. On each one it checks that the arena, every HUD part and every control are fully on screen and clear of one another, that controls are at least 44 px, and that the arena reaches its expected scale (in portrait, both screen edges).
- **Visual regression** compares the main menu, the arena in a known state on the classic map and on a map drawn from a fixed seed, and the result screen, on desktop and mobile. The main menu is captured whole by growing the viewport to the page's height. Chromium's full-page capture briefly drops touch emulation, which would redraw the menu for a keyboard. Rendering differs between operating systems, so baselines are versioned per platform; the Linux ones come from the official Playwright image, which the CI workflow also uses, on the same arm64 architecture.
- **Profiling** has its own Playwright configuration (`playwright.profile.config.ts`), outside the regular suite. It drives Google Chrome, whose headless mode renders on the real GPU, while a bot plays through keyboard events; [docs/PROFILING.md](docs/PROFILING.md) describes the method and the results.

## Balancing

All rule parameters live in a typed configuration (`src/game/config`); systems never hard-code them.

| Parameter | Initial value |
| --- | --- |
| Arena | 1280 × 720 units, a new map every match (see [Map generation](#map-generation)) |
| Map | 4–5 islands (1–2 coasts), 0–2 reefs, channels of 128 units, 128 units open around the start, 8–20% covered |
| Match duration | 120 s (Options: 60–180 s) |
| Spawn interval | 2.5 s (Options: 1–10 s, steps of 0.5 s) |
| Player | 100 HP, 180 units/s, π rad/s, radius 22 |
| Front cannon | 20 damage, 600 units/s, 1.4 s lifetime, 0.25 s cooldown |
| Side cannons | 3 shots of 15 damage, 500 units/s, 1.2 s lifetime, 0.9 s cooldown per side |
| Chaser | 30 HP, 100 units/s, 2.4 rad/s, radius 20, 25 contact damage |
| Shooter | 40 HP, 75 units/s, 1.8 rad/s, radius 22, range 280, 10 damage every 1.5 s |
| Spawn distance | at least 360 units from the player |

Two front shots sink a Chaser and two sink a Shooter; a full broadside (45 damage) sinks either at once, which rewards positioning over holding the bow cannon. A Chaser's contact costs a quarter of the player's health, so four rams end a match. A match runs on a frozen copy of the configuration built when it starts, so changing Options only affects the next match. The `rulesVersion` identifies the balance, now version 2, which added drawn maps; a fingerprint test fails when the configuration changes without a new version, so rankings never mix matches played under different rules. Drawn maps differ in difficulty within the bounds of their rules: the channels, the open start, the covered share and the reachable water keep matches comparable, not identical.

## Tooling decisions

- **oxlint rather than ESLint.** The Vite template ships with oxlint, and its `overrides` with `no-restricted-imports` cover the boundary rules above.
- **Strict TypeScript.** `strict` is set explicitly, together with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` and `noImplicitReturns`. `erasableSyntaxOnly` rules out enums, namespaces and parameter properties.
- **Pinned dependencies.** Versions are exact, and `.npmrc` sets `min-release-age=7`, so new installs only pick releases that have been public for at least a week.
- **MSW 2 rather than MSW 3.** MSW 3.0.0 came out less than two weeks before the project started and was still receiving frequent patches. MSW 2.15 is stable and well documented.
- **Ids from `crypto.getRandomValues`.** `crypto.randomUUID` only exists in secure contexts, which would break a phone opening the dev server over plain HTTP on the local network.

## Known limitations

- Only one tab should play at a time: two tabs share the journal and the mock database without coordination.
- Service workers, and therefore the mock API, need a secure context: a phone on the local network must open the dev server through HTTPS (for example a Vercel preview) to reach the API. The game itself still runs.
- The interface itself is silent: the pack's interface sounds and its sailing loop are not used.
- Number fields display decimals in the browser's own locale (for example `2,5`).
- In containers without a GPU, WebGL runs in software, which is slower but renders identically for the visual baselines.
