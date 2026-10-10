# Pirate Battle

A top-down 2D naval shooter for the browser, built with React, TypeScript and PixiJS.

- **Live demo:** <https://pirate-battle-nu.vercel.app/>
- **Delivery estimate:** Sunday, October 11, 2026, by 11:00 (UTC−03:00), covering the full scope of the challenge. Recorded on October 10, 2026, before gameplay development started.

Sail between islands, sink enemy ships with your cannons and score as many points as you can before time runs out. Chasers hunt you down and explode on contact; Shooters keep their distance and fire. Every match is played on a new map of islands, coasts and reefs, drawn from its seed, and your ship hoists new colors. Finished matches go to a ranking and to your match history, served by a mock API that also runs in the published build.

## Tech stack

| Concern | Technology |
| --- | --- |
| Menus, forms, dialogs and HUD | React 19 |
| Language | TypeScript 6 in strict mode |
| Game rendering | PixiJS 8 |
| Remote state for ranking and match history | TanStack Query 5 |
| HTTP client | Axios |
| API mocking | MSW 2 |
| End-to-end and visual tests | Playwright |
| Unit tests | Vitest |
| Build tool and dev server | Vite 8 |
| Linting | oxlint |

## Requirements

- Node.js 24 LTS, the reference version in `.nvmrc`. `package.json` accepts Node.js 22.12 or later.
- npm, as bundled with Node.js.
- Docker, only to compare or regenerate the Linux visual baselines.

## Getting started

```sh
npm ci
npm run dev
```

Then open <http://localhost:5173>. No environment variable is required.

The end-to-end tests also need the Playwright build of Chromium:

```sh
npx playwright install chromium
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sail forward | `W` or `↑` | ⬆ button (left cluster) |
| Turn left / right | `A` / `D` or `←` / `→` | ↶ / ↷ buttons (left cluster) |
| Fire from the bow | `Space` | Single-shot button (right cluster) |
| Fire the left / right side cannons | `Q` / `E` | Triple-shot buttons (right cluster) |
| Pause and resume | `P` or `Escape` | Pause button, then Resume |

Moving, turning and firing can be combined, with keys or with several fingers. Holding a fire control keeps firing as soon as each cannon's cooldown ends. Keys are only captured while a match is running.

**How to play** in the main menu explains the controls of the device in use: the keys on a computer, or the on-screen buttons, drawn as in a match, on a touch screen.

Sound effects are on by default. Options turns them off, and so does the switch in the pause menu, which applies at once.

The match pauses on its own when the window loses focus or the tab is hidden. Resuming always needs an explicit action, and keys or fingers held through a pause must be pressed again.

**Phones and tablets** play in both orientations; turning the device changes the layout, never the match:

- **Landscape:** the HUD and the touch controls share the columns beside the arena, which gets the full height.
- **Portrait:** the arena spans the full width, with the HUD above it and the controls below it.

The whole arena and HUD always stay on screen, and nothing covers the arena. Dragging a finger never selects text, and while a match is on screen the page never scrolls or zooms.

## Gameplay configuration

Every rule parameter lives in a typed configuration in `src/game/config/defaultConfig.ts`: match duration, spawn interval and distribution, health, speeds and turn rates, damage, projectile speed and lifetime, cooldowns, the Shooter's range and how maps are drawn (island counts and sizes, the narrowest channel, the open water around the start and the share of the arena islands may cover). Systems never hard-code them; [ARCHITECTURE.md](ARCHITECTURE.md#balancing) lists the initial values. Changing the balance requires bumping `RULES_VERSION`, which a unit test enforces.

Options exposes two of them, validated and kept after a reload:

| Setting | Range | Default |
| --- | --- | --- |
| Game session time | 60–180 s, whole seconds | 120 s |
| Enemy spawn time | 1–10 s, steps of 0.5 s | 2.5 s |

Each match runs on a snapshot of the settings taken when it starts, so changes apply to the next match. The ranking only compares matches played with the same settings. Options also keeps the sound setting, which is not part of the rules.

## Network scenarios

The ranking and history API is mocked with MSW, in development, in the tests and in the published build. The **Network scenarios** panel at the bottom of the main menu selects how the mock server behaves; opening the game with `?scenario=<name>` does the same on load (for example <https://pirate-battle-nu.vercel.app/?scenario=unavailable>). The selected scenario is kept after a reload.

| Name | Behavior |
| --- | --- |
| `success` | Every request succeeds after a short delay. Data is kept. |
| `empty` | Starts with no matches at all (replaces the demo data). |
| `paginated` | Loads enough matches for several pages of the ranking and of your own history (replaces the demo data). |
| `slow` | Every response takes about half the request timeout. |
| `variable-latency` | Each response waits a seeded, reproducible delay between 5% and 90% of the timeout. |
| `out-of-order` | Every other read is slow and answers with the data from when it was sent, after newer reads. |
| `ranking-error` / `history-error` | Only ranking reads, or only history reads, fail with HTTP 500. |
| `http-4xx` | Every request is rejected with HTTP 400, which is never retried. |
| `http-5xx` | Every request fails with HTTP 503, which is retried. |
| `network-error` | Every request fails at the network level. |
| `timeout` | Nothing answers before the request timeout; matches are not saved. |
| `commit-then-timeout` | Registering saves the match, but the answer is lost after the timeout. |
| `unavailable` | The server is down until another scenario is selected. |

**Reset demo data** restores the sample captains and the `success` scenario, and removes the matches and pending registrations of this browser.

### Reproducing failures

- **Pending registration recovered after a reload:** select `unavailable`, play a match to the end (a 60 s session is quickest), reload on the result screen: the result reopens and its registration is still pending. Select `success`: it is sent at once and appears in both tabs.
- **Resend after a timeout without duplicates:** select `commit-then-timeout` and finish a match. The first attempt times out although the server saved the match; switch to `success` and the resend returns the existing record, so Match History shows it once.
- **Timeout before saving:** same steps with `timeout`; the match is saved only by the resend.
- **Late answers never replace newer data:** select `out-of-order` and finish a match; both lists show it and keep showing it after the slow, older answers arrive.
- **Retry policy:** select `http-4xx` (one request, then an error) or `http-5xx` (three requests, 1 s and 2 s apart, then an error).
- **Failed lists do not block the game:** select `ranking-error`; the Ranking tab reports the error with Try again, while Match History, Options and Play keep working.
- **Asset loading failure:** open the game in a fresh private window, switch the developer tools' network to Offline once the menu is shown, and press Play: an accessible error with Retry and Main Menu replaces the loading screen while combat stays stopped. Go back online and press Retry. (The mock API keeps answering offline, because it runs in the page.)

## Local persistence

| Key in `localStorage` | Content |
| --- | --- |
| `pirate-battle:settings` | Validated Options. |
| `pirate-battle:player` | The local captain's id and name. |
| `pirate-battle:journal` | The last result, whether to reopen it, and the outbox of registrations not confirmed yet. |
| `pirate-battle:mock-database` | The mock server's confirmed matches and data revision. |
| `pirate-battle:network-scenario` | The selected network scenario. |
| `pirate-battle:sound` | Whether sound effects are on. |

Every entry is versioned and validated on read; corrupt or outdated data is ignored. If storage is blocked or full, the game keeps working and the result screen says that the match will not survive a reload. Clearing the site data starts over.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server, with the mock API. |
| `npm run build` | Type-check and build the production bundle into `dist/`. |
| `npm run build:e2e` | Build the end-to-end bundle, with the test bridge, into `dist-e2e/`. |
| `npm run preview` | Serve the production bundle locally. |
| `npm run lint` | Lint with oxlint, including module boundary rules. Warnings fail. |
| `npm run typecheck` | Type-check every TypeScript project. |
| `npm run test:unit` | Run the Vitest unit tests. |
| `npm run test:e2e` | Run the whole Playwright suite, visual comparisons included. It builds and serves the app itself. |
| `npm run test:visual` | Compare only the visual baselines of this platform. |
| `npm run test:visual:update` | Regenerate the visual baselines of this platform, for review. |
| `npm run test:visual:linux` | Compare the Linux baselines inside the official Playwright Docker image. |
| `npm run test:visual:linux:update` | Regenerate the Linux baselines inside that image, for review. |
| `npm run test:report` | Open the HTML report of the last Playwright run. |
| `npm run profile` | Profile a three-minute match and five play-and-leave cycles in Google Chrome, writing the results to `docs/profiling/`. |

## Environment variables

Every variable is optional and public: Vite inlines `VITE_*` values into the client bundle. `.env.example` lists them, and none holds a secret.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Serve the API from MSW. The published demo relies on it. |
| `VITE_API_BASE_URL` | `/api` | Base URL of the API. |
| `VITE_API_TIMEOUT_MS` | `8000` | Milliseconds before an API request is abandoned. The e2e build uses 2000. |
| `VITE_ENABLE_TEST_BRIDGE` | unset | Set to `true` by `.env.e2e` only, to expose the end-to-end test bridge. |

## Tests

**Unit tests** (Vitest) cover the rules in isolation: geometry, the fixed-step loop, input merging, movement, combat, enemies, navigation, spawns, map generation, configuration, the mock database, the revision guard, the registration outbox, the match sounds and screen navigation.

**End-to-end tests** (Playwright) run in three Chromium projects:

| Project | Target |
| --- | --- |
| `desktop-chromium` | Optimized e2e build served by `vite preview`, desktop viewport. |
| `mobile-chromium` | Optimized e2e build, Pixel 7 in landscape with touch. The touch layout tests also resize it to iPhone and Pixel screens in both orientations. |
| `dev-strict-mode` | Dev server in e2e mode, where React Strict Mode mounts every component twice. |

The e2e build adds a test bridge (`window.__PIRATE_BATTLE__`). Before a match starts, a test can set the seed, which also draws the map, or pin the classic map, switch to a manual clock that only advances when the test asks, and place ships. During play the bridge only reads state and advances whole simulation steps: tests press the real keys, or hold several fingers through the Chrome DevTools Protocol, and check the effects. The public build does not contain the bridge. Each test starts from a fresh browser context, and any console error or uncaught exception fails it.

**Visual regression** compares the main menu, the arena in a known state on the classic map and on a map drawn from a fixed seed, and the result screen, on desktop and mobile. Baselines are versioned per platform in `tests/visual/screens.spec.ts-snapshots/`: `*-darwin.png` for macOS and `*-linux.png`, generated in the official Playwright image (`mcr.microsoft.com/playwright:v1.63.0-noble`, arm64). Regenerated baselines must be reviewed before they are committed.

**Reports:** every Playwright run writes an HTML report to `playwright-report/` (`npm run test:report`), with traces and screenshots for failed tests. [docs/TEST_REPORT.md](docs/TEST_REPORT.md) summarizes the last full run, and [docs/test-report/index.html](docs/test-report/index.html) is its HTML report.

**Continuous integration** (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, the build and the whole Playwright suite inside the same Playwright image on an arm64 runner, and uploads the HTML report.

## Performance

[docs/PROFILING.md](docs/PROFILING.md) records the frame rate, the 95th percentile of frame times and the entity counts of a three-minute match in the optimized build, and memory after five play-and-leave cycles, with the hardware, browser and settings used.

`npm run profile` repeats those measurements. It needs Google Chrome installed, because Chrome's headless mode renders on the real GPU; a bot plays through keyboard events while the script samples frames, entities and memory.

## Assets and licenses

`assets/` holds the asset pack provided with the challenge, unchanged. [docs/ASSET_LICENSES.md](docs/ASSET_LICENSES.md) lists what the game uses from it and how.

## Project structure

```text
assets/              Asset pack provided with the challenge, unchanged
docs/                Profiling, test report and asset notes
public/              Files served as-is, such as the MSW worker script
src/
  app/               Bootstrap, query client, navigation and the App shell
  features/
    gameplay/        Game screen, HUD, pause dialog and touch controls
    leaderboards/    Ranking and Match History tabs
    menu/            Main menu, controls guide and network scenarios panel
    options/         Options form and settings persistence
    player/          Local captain identity
    registration/    Match journal and the registration outbox
    results/         Result screen
  game/              Game code, free of React
    assets/          Texture loading and the ship atlas parser
    audio/           Sound effects of a match and the shared sound bank
    config/          Typed rule configuration and the classic arena layout
    core/            Rules, entities, map generation, navigation and math, free of PixiJS and the DOM
    input/           Keyboard and touch input normalized into game actions
    rendering/       PixiJS renderer, views, terrain and effects
    runtime/         Fixed-step loop and the match runtime
  mocks/             MSW handlers, mock database, fixtures and network scenarios
  shared/
    api/             Axios client, endpoints, errors and the revision guard
    contracts/       Typed API contracts with runtime parsers
    storage/         Versioned localStorage access
    ui/              UI atlas adapter, buttons and panels
  testing/           End-to-end test bridge, loaded only by the e2e build
tests/
  e2e/               Playwright specs
  profile/           Profiling runs, outside the regular suite
  visual/            Visual regression specs and their baselines
  support/           Shared Playwright fixtures and match helpers
```

[ARCHITECTURE.md](ARCHITECTURE.md) explains the main design decisions.
