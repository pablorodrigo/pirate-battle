# Test report

Last full run: October 10, 2026, on commit `a8deeaa`.

## Summary

| Check | Command | macOS | Linux (CI image) |
| --- | --- | --- | --- |
| Type checking | `npm run typecheck` | Passed | Passed |
| Lint | `npm run lint` | Passed, no warnings | Passed, no warnings |
| Unit tests | `npm run test:unit` | 89 passed in 18 files | 89 passed in 18 files |
| Production build | `npm run build` | Passed | Passed |
| End-to-end and visual tests | `npm run test:e2e` | 126 passed, 6 skipped, in 2.0 min | 126 passed, 6 skipped, in 5.1 min |

Six tests are skipped on purpose in every run: the three touch-control tests in the two projects without a touch screen (`desktop-chromium` and `dev-strict-mode`). `mobile-chromium` runs them.

## Environments

| Item | macOS | Linux |
| --- | --- | --- |
| Machine | MacBook Pro, Apple M1 Pro, 16 GB, macOS 14.6.1 | The same machine, through Docker, linux/arm64 |
| Node.js | 25.4.0 | 24.20.0, from the image |
| Browser | Chromium 153, bundled with Playwright 1.63.0 | The same, in `mcr.microsoft.com/playwright:v1.63.0-noble` |
| Workers | 4 | 2 |
| Visual baselines | `*-darwin.png` | `*-linux.png` |

The Linux run uses the image, architecture and commands of the CI workflow (`.github/workflows/ci.yml`), with `CI=true`: dependencies come from a clean `npm ci`, `test.only` fails the run and the servers are always started fresh.

## HTML report and traces

- **[test-report/index.html](test-report/index.html)** is the Playwright HTML report of the Linux run above, with every test of the three projects, its steps and its duration. Download it and open it in a browser.
- Every run writes its own report to `playwright-report/`, and `npm run test:report` opens the latest one.
- A failed test keeps its trace, a screenshot and the error context (`trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`), and the HTML report embeds them. `npx playwright show-trace <trace.zip>` opens a trace on its own.
- The CI workflow uploads the report of every run as the `playwright-report` artifact.

## Projects

| Project | Target | Tests |
| --- | --- | ---: |
| `desktop-chromium` | Optimized e2e build, Desktop Chrome viewport | 45 (42 end-to-end, 3 visual) |
| `mobile-chromium` | Optimized e2e build, Pixel 7 in landscape with touch | 45 (42 end-to-end, 3 visual) |
| `dev-strict-mode` | Dev server, where React Strict Mode mounts every component twice | 42 (end-to-end only) |

Every test starts from a fresh browser context. Matches use fixed seeds and, where timing matters, a manual clock that advances whole simulation steps; tests act through real key presses or, on touch, held fingers sent through the Chrome DevTools Protocol, and check the effects. Any console error or uncaught exception fails a test unless that test expects it.

## Coverage of the challenge's test list

| # | Requirement | Specs |
| --- | --- | --- |
| 1 | Options: navigation, validation and persistence | `options.spec.ts` |
| 2 | Asset loading, failures and retry | `assets.spec.ts` |
| 3 | Match start, movement, rotation, arena bounds and island collisions | `movement.spec.ts`, `smoke.spec.ts` |
| 4 | Front and side cannons, damage, cooldowns and score without duplicates | `combat.spec.ts` |
| 5 | Chaser and Shooter behavior and the spawn interval | `combat.spec.ts` |
| 6 | Ending by time and by death, the simulation stopping and a clean restart | `match-flow.spec.ts` |
| 7 | Pause, loss of focus and resuming without the clock advancing | `pause.spec.ts`, `match-flow.spec.ts`, `touch.spec.ts` |
| 8 | The result and its persistence after a reload | `registration.spec.ts` |
| 9 | Abandoning a match, repeated navigation between screens and touch controls | `match-flow.spec.ts`, `smoke.spec.ts`, `touch.spec.ts` |
| 10 | Ranking and Match History: queries, pages, loading, empty and error states | `leaderboards.spec.ts`, `network-scenarios.spec.ts` |
| 11 | Registering a match, both tabs updating, and recovering a pending registration after a reload | `registration.spec.ts`, `network-scenarios.spec.ts` |
| 12 | Resending after a timeout without duplicates; late responses never replacing newer data | `registration.spec.ts`, `network-scenarios.spec.ts` |
| — | Visual regression of the menu, the arena in a stable state and the result screen | `visual/screens.spec.ts` |

## Unit tests

| Area | Files | Tests |
| --- | --- | ---: |
| Simulation: geometry, random numbers, session, movement, combat, enemies, spawns and navigation | `src/game/core/**` | 48 |
| Configuration and arena layout | `src/game/config/**` | 9 |
| Fixed-step loop and input merging | `src/game/runtime/**`, `src/game/input/**` | 8 |
| Ship atlas parser | `src/game/assets/**` | 3 |
| Mock database, revision guard, settings and the registration outbox | `src/mocks/**`, `src/shared/api/**`, `src/features/**` | 17 |
| Screen navigation | `src/app/**` | 4 |

## Failures found by testing

| Found by | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| The Linux run in the CI image | `registration.spec.ts` › "keeps a pending registration through a reload…" on `mobile-chromium`: Match History stayed empty. | The trace showed `POST /api/matches` answered with 404 by the static server. A scheduled retry of the old page fired while the test navigated away, after MSW had stopped serving that page at `beforeunload`, and the 404 marked the match as rejected. | `30c1417`: the registration coordinator sends nothing more once the page starts unloading. Unit tests reproduce the race deterministically. |
| Profiling | Memory held after leaving a match | PixiJS's batch pool kept the baked terrain canvases; a closure kept the first game screen. See [PROFILING.md](PROFILING.md). | `b37b207`, `a8deeaa` |

## Reproducing

```sh
npm ci
npx playwright install chromium
npm run typecheck && npm run lint && npm run test:unit && npm run build
npm run test:e2e              # the three projects, visual comparisons included
npm run test:visual:linux     # the Linux baselines, in the CI image (needs Docker)
```

The Linux run above used the CI image directly:

```sh
docker run --rm --ipc=host -e CI=true -v "$PWD":/work -v /work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  bash -c "npm ci && npm run typecheck && npm run lint && npm run test:unit && npm run build && npx playwright test"
```
