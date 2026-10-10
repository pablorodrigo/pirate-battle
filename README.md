# Pirate Battle

A top-down 2D naval shooter for the browser, built with React, TypeScript and PixiJS.

- **Live demo:** <https://pirate-battle-nu.vercel.app/>
- **Delivery estimate:** Sunday, October 11, 2026, by 11:00 (UTC−03:00), covering the full scope of the challenge. Recorded on October 10, 2026, before gameplay development started.

## Tech stack

| Concern | Technology |
| --- | --- |
| Menus, forms and dialogs | React 19 |
| Language | TypeScript 6 in strict mode |
| Game rendering | PixiJS 8 |
| Remote state for ranking and match history | TanStack Query 5 |
| HTTP client | Axios |
| API mocking | MSW 2 |
| End-to-end and visual tests | Playwright |
| Build tool and dev server | Vite 8 |
| Linting | oxlint |

## Requirements

- Node.js 24 LTS, the reference version in `.nvmrc`. `package.json` accepts Node.js 22.12 or later.
- npm, as bundled with Node.js.

## Getting started

```sh
npm ci
npm run dev
```

Then open <http://localhost:5173>.

The end-to-end tests also need the Playwright build of Chromium:

```sh
npx playwright install chromium
```

## Controls

| Action | Keyboard |
| --- | --- |
| Sail forward | `W` or `↑` |
| Turn left / right | `A` / `D` or `←` / `→` |
| Fire from the bow | `Space` |
| Fire the left / right side cannons | `Q` / `E` |
| Pause and resume | `P` or `Escape` |

Moving, turning and firing can be combined. Holding a fire key keeps firing as soon as each cannon's cooldown ends. The match also pauses when the window loses focus or the tab is hidden, and resuming always needs an explicit action.

## Gameplay configuration

Every rule parameter (match duration, spawn interval and distribution, health, speeds, turn rates, damage, projectile speed and lifetime, cooldowns, Shooter range) lives in a typed configuration in `src/game/config/defaultConfig.ts`; systems never hard-code them. [ARCHITECTURE.md](ARCHITECTURE.md#balancing) lists the initial values. Changing the balance requires bumping `RULES_VERSION`, which a unit test enforces.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server, with the mock API. |
| `npm run build` | Type-check and build the production bundle into `dist/`. |
| `npm run build:e2e` | Build the end-to-end bundle, with the test bridge, into `dist-e2e/`. |
| `npm run preview` | Serve the production bundle locally. |
| `npm run lint` | Lint with oxlint, including module boundary rules. Warnings fail. |
| `npm run typecheck` | Type-check every TypeScript project. |
| `npm run test:unit` | Run the Vitest unit tests of the game rules. |
| `npm run test:e2e` | Run the Playwright suite. It builds and serves the app itself. |
| `npm run test:report` | Open the HTML report of the last Playwright run. |

## Environment variables

Every variable is optional and public: Vite inlines `VITE_*` values into the client bundle. `.env.example` lists them.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Serve the API from MSW. The published demo relies on it. |
| `VITE_API_BASE_URL` | `/api` | Base URL of the API. |
| `VITE_ENABLE_TEST_BRIDGE` | unset | Set to `true` by `.env.e2e` only, to expose the end-to-end test bridge. |

## End-to-end tests

The Playwright suite runs in three Chromium projects:

| Project | Target |
| --- | --- |
| `desktop-chromium` | Optimized e2e build served by `vite preview`, desktop viewport. |
| `mobile-chromium` | Optimized e2e build, Pixel 7 in landscape with touch. |
| `dev-strict-mode` | Dev server in e2e mode, where React Strict Mode mounts every component twice. |

The e2e build adds a test bridge (`window.__PIRATE_BATTLE__`). Before a match starts, a test can set the seed, switch to a manual clock that only advances when the test asks, and place ships. During play the bridge only reads state and advances whole simulation steps: tests press the real keys and check the effects. The public build does not contain the bridge.

Any console error or uncaught exception fails the test that produced it. Failed tests keep a trace and a screenshot; `npm run test:report` opens the HTML report.

## Project structure

```text
assets/            Asset pack provided with the challenge, unchanged
public/            Files served as-is, such as the MSW worker script
src/
  app/             Bootstrap, providers and screen switching
  features/        React screens and components
  game/            Game code, free of React
    config/        Typed rule configuration and the arena layout
    core/          Rules, entities and math, free of PixiJS and the DOM
    input/         Keyboard input normalized into game actions
    rendering/     PixiJS renderer, views and effects
    runtime/       Fixed-step loop and the match runtime
  mocks/           MSW handlers that implement the API in the browser
  shared/          HTTP client, API contracts and global styles
  testing/         End-to-end test bridge, loaded only by the e2e build
tests/
  e2e/             Playwright specs
  support/         Shared Playwright fixtures and match helpers
```

[ARCHITECTURE.md](ARCHITECTURE.md) explains the main design decisions.
