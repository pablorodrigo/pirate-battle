# Architecture

This document explains how Pirate Battle is organized and why. It grows with the code: every section describes behavior that is already implemented.

## Overview

The application has three parts that change for different reasons:

- **Game** (`src/game`): configuration, rules and rendering of the battle. Rules are plain TypeScript; PixiJS only draws their state.
- **Interface** (`src/app`, `src/features`): React screens, menus and dialogs.
- **Data** (`src/shared/api`, `src/shared/contracts`, `src/mocks`): the HTTP client, the contracts it shares with the mock server, and the MSW handlers that implement that server in the browser.

## Module boundaries

| Module | May import | Must not import |
| --- | --- | --- |
| `game/core`, `game/config` | Each other | PixiJS, React, Axios, MSW, TanStack Query, any other module |
| Other `game/` modules | PixiJS, `game/core`, `game/config` | React, Axios, MSW, TanStack Query, `app`, `features`, `mocks`, `shared/api` |
| `shared/contracts` | Other contracts, `game/config` | React, PixiJS, Axios, MSW, TanStack Query, `app`, `features`, `mocks`, `shared/api`, game rendering and runtime |
| `shared/api` | Axios, `shared/contracts` | React, PixiJS, MSW, TanStack Query, `app`, `features`, `game`, `mocks` |
| `mocks` | MSW, `shared/contracts`, `shared/api/apiBaseUrl` | React, PixiJS, Axios, TanStack Query, `app`, `features` |
| `app`, `features` | Any module above | — |

`.oxlintrc.json` enforces the table with `no-restricted-imports` overrides, so `npm run lint` fails when an import crosses a boundary.

## React and PixiJS integration

React owns the screens and their layout; PixiJS owns the arena canvas. The two meet in a single component, `GameCanvas`, which creates a `PixiRenderer` in an effect and destroys it in the effect cleanup. React never touches PixiJS objects.

`PixiRenderer` owns a private `Application`, created with `sharedTicker: false` and `autoStart: false`. It starts the application only after the scene is built.

**Strict Mode and asynchronous initialization.** `Application.init()` is asynchronous, and in development React Strict Mode unmounts and remounts every component once. The cleanup can therefore run before `init()` resolves. In that case `destroy()` only marks the renderer as destroyed, and `mount()` completes the teardown as soon as `init()` settles. A discarded instance never attaches its canvas. The `dev-strict-mode` Playwright project checks that repeated Play → Main Menu cycles always leave exactly one canvas.

**Disposal.** The application is destroyed with `{ removeView: true }` and `{ children: true, context: true }`. In PixiJS 8, a `Graphics` frees its `GraphicsContext` only when it is destroyed without options or with `context: true`. Passing `{ children: true }` alone would leave the contexts behind. The world container is attached to the stage in the constructor, so the same call also releases a renderer that is destroyed before `init()` completes.

**Viewport.** The arena has a fixed logical size of 1280 × 720 units. A `ResizeObserver` on the host element resizes the renderer, scales the world container uniformly by `min(width / 1280, height / 720)` and centers it, leaving letterbox margins. The host is absolutely positioned, so the canvas size never feeds back into the observed size. The resolution follows `devicePixelRatio`, capped at 2, with `autoDensity` enabled.

## Mock API

- MSW serves the API in development, in the end-to-end tests and in the published build, so `msw` is a runtime dependency.
- `src/main.tsx` awaits `worker.start()` before the first render, so no query runs before the mocks are ready. If the worker fails to start, the app logs a warning and renders anyway: the game never depends on the API.
- The worker module is loaded with a dynamic import. Builds with `VITE_ENABLE_MOCKS=false` leave the MSW library out of the bundle.
- Every request goes through a single Axios instance (`shared/api/httpClient.ts`). Contract modules validate response bodies at runtime before they reach TanStack Query, because a type annotation does not validate JSON.
- TanStack Query defaults: `staleTime` of 15 s, `gcTime` of 5 min, and two retries with exponential backoff (1 s, then 2 s).

## Tooling decisions

- **oxlint rather than ESLint.** The Vite template ships with oxlint, and its `overrides` with `no-restricted-imports` cover the boundary rules above.
- **Strict TypeScript.** `strict` is set explicitly, together with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` and `noImplicitReturns`. `erasableSyntaxOnly` rules out enums, namespaces and parameter properties.
- **Pinned dependencies.** Versions are exact, and `.npmrc` sets `min-release-age=7`, so new installs only pick releases that have been public for at least a week.
- **MSW 2 rather than MSW 3.** MSW 3.0.0 came out less than two weeks before the project started and was still receiving frequent patches. MSW 2.15 is stable and well documented.
