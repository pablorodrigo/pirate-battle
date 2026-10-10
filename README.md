# Pirate Battle

A top-down 2D naval shooter for the browser, built with React, TypeScript and PixiJS.

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

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server, with the mock API. |
| `npm run build` | Type-check and build the production bundle into `dist/`. |
| `npm run preview` | Serve the production bundle locally. |
| `npm run lint` | Lint with oxlint, including module boundary rules. Warnings fail. |
| `npm run typecheck` | Type-check every TypeScript project. |
| `npm run test:e2e` | Run the Playwright suite. It builds and serves the app itself. |
| `npm run test:report` | Open the HTML report of the last Playwright run. |

## Environment variables

Every variable is optional and public: Vite inlines `VITE_*` values into the client bundle. `.env.example` lists them.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Serve the API from MSW. The published demo relies on it. |
| `VITE_API_BASE_URL` | `/api` | Base URL of the API. |

## End-to-end tests

The Playwright suite runs in three Chromium projects:

| Project | Target |
| --- | --- |
| `desktop-chromium` | Production build served by `vite preview`, desktop viewport. |
| `mobile-chromium` | Production build, Pixel 7 in landscape with touch. |
| `dev-strict-mode` | Dev server, where React Strict Mode mounts every component twice. |

Any console error or uncaught exception fails the test that produced it. Failed tests keep a trace and a screenshot; `npm run test:report` opens the HTML report.

## Project structure

```text
assets/            Asset pack provided with the challenge, unchanged
public/            Files served as-is, such as the MSW worker script
src/
  app/             Bootstrap, providers and screen switching
  features/        React screens and components
  game/            Game code, free of React
    config/        Typed game configuration, such as the arena layout
    core/          Rules and math, free of PixiJS and the DOM
    rendering/     PixiJS renderer
  mocks/           MSW handlers that implement the API in the browser
  shared/          HTTP client, API contracts and global styles
tests/
  e2e/             Playwright specs
  support/         Shared Playwright fixtures
```

[ARCHITECTURE.md](ARCHITECTURE.md) explains the main design decisions.
