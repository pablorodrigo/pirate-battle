# Test report

Last full run: October 10, 2026, on commit `0efafdc`.

## Summary

| Check | Command | macOS | Linux (CI image) |
| --- | --- | --- | --- |
| Type checking | `npm run typecheck` | Passed | Passed |
| Lint | `npm run lint` | Passed, no warnings | Passed, no warnings |
| Unit tests | `npm run test:unit` | 99 passed in 20 files | 99 passed in 20 files |
| Production build | `npm run build` | Passed | Passed |
| End-to-end and visual tests | `npm run test:e2e` | 163 passed, 20 skipped, in 4.2 min | 163 passed, 20 skipped, in 9.7 min |

Twenty tests are skipped on purpose in every run. They are the ten touch tests (three touch-control tests and seven touch-layout tests) in the two projects without a touch screen, `desktop-chromium` and `dev-strict-mode`. `mobile-chromium` runs them.

## Environments

| Item | macOS | Linux |
| --- | --- | --- |
| Machine | MacBook Pro, Apple M1 Pro, 16 GB, macOS 14.6.1 | The same machine, through Docker, linux/arm64 |
| Node.js | 25.4.0 | 24.20.0, from the image |
| Browser | Chromium 153, bundled with Playwright 1.63.0 | The same, in `mcr.microsoft.com/playwright:v1.63.0-noble` |
| Workers | 4 | 2 |
| Visual baselines | `*-darwin.png` | `*-linux.png` |

The Linux run uses the image, architecture and commands of the CI workflow (`.github/workflows/ci.yml`), with `CI=true`. Dependencies come from a clean `npm ci`, `test.only` fails the run and the servers are always started fresh. Each test gets 60 s and each assertion 10 s, because WebGL runs in software without a GPU (30 s and 5 s locally). Waiting for a match to load allows 30 s everywhere.

## HTML report and traces

- **[test-report/index.html](test-report/index.html)** is the Playwright HTML report of the Linux run above, with every test of the three projects, its steps and its duration. Download it and open it in a browser.
- Every run writes its own report to `playwright-report/`, and `npm run test:report` opens the latest one.
- A failed test keeps its trace, a screenshot and the error context (`trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`), and the HTML report embeds them. `npx playwright show-trace <trace.zip>` opens a trace on its own.
- The CI workflow uploads the report of every run as the `playwright-report` artifact.

## Projects

| Project | Target | Tests |
| --- | --- | ---: |
| `desktop-chromium` | Optimized e2e build, Desktop Chrome viewport | 62 (59 end-to-end, 3 visual) |
| `mobile-chromium` | Optimized e2e build, Pixel 7 in landscape with touch. The touch layout tests also resize it to iPhone and Pixel screens in both orientations. | 62 (59 end-to-end, 3 visual) |
| `dev-strict-mode` | Dev server, where React Strict Mode mounts every component twice | 59 (end-to-end only) |

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
| 7 | Pause, loss of focus, a hidden tab and resuming without the clock advancing | `pause.spec.ts`, `match-flow.spec.ts`, `touch.spec.ts` |
| 8 | The result and its persistence after a reload | `registration.spec.ts` |
| 9 | Abandoning a match, repeated navigation between screens and touch controls | `match-flow.spec.ts`, `smoke.spec.ts`, `touch.spec.ts`, `touch-layout.spec.ts` |
| 10 | Ranking and Match History: queries, pages, loading, empty and error states, each in both tabs | `leaderboards.spec.ts`, `network-scenarios.spec.ts` |
| 11 | Registering a match, both tabs updating, and recovering a pending registration after a reload | `registration.spec.ts`, `network-scenarios.spec.ts` |
| 12 | Resending after a timeout without duplicates; late responses never replacing newer data | `registration.spec.ts`, `network-scenarios.spec.ts` |
| — | Visual regression of the menu, the arena in a stable state and the result screen | `visual/screens.spec.ts` |
| — | Sound effects: the setting, and files that load only once a match starts and only while sound is on | `audio.spec.ts`, `options.spec.ts` |
| — | Touch layout in both orientations, nothing over the arena; no text selection or page zoom | `touch-layout.spec.ts`, `touch.spec.ts`, `smoke.spec.ts` |
| — | How to play explains the controls of the device in use; the menu title is centred | `smoke.spec.ts`, `visual/screens.spec.ts` |

## Unit tests

| Area | Files | Tests |
| --- | --- | ---: |
| Simulation: geometry, random numbers, session, movement, combat, enemies, spawns and navigation | `src/game/core/**` | 48 |
| Configuration and arena layout | `src/game/config/**` | 9 |
| Fixed-step loop and input merging | `src/game/runtime/**`, `src/game/input/**` | 8 |
| Match sounds: which sound each event and change of the match plays | `src/game/audio/**` | 8 |
| Ship atlas parser | `src/game/assets/**` | 3 |
| Mock database and its fixtures, revision guard, settings and the registration outbox | `src/mocks/**`, `src/shared/api/**`, `src/features/**` | 19 |
| Screen navigation | `src/app/**` | 4 |

## Failures found by testing

| Found by | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| The Linux run in the CI image | `registration.spec.ts` › "keeps a pending registration through a reload…" on `mobile-chromium`: Match History stayed empty. | The trace showed `POST /api/matches` answered with 404 by the static server. A scheduled retry of the old page fired while the test navigated away, after MSW had stopped serving that page at `beforeunload`, and the 404 marked the match as rejected. | `30c1417`: the registration coordinator sends nothing more once the page starts unloading. Unit tests reproduce the race deterministically. |
| Profiling | Memory held after leaving a match | PixiJS's batch pool kept the baked terrain canvases; a closure kept the first game screen. See [PROFILING.md](PROFILING.md). | `b37b207`, `a8deeaa` |
| A manual test of the published build on an iPhone | In landscape the arena filled about a third of the screen. In portrait it was squeezed to a sliver once the match resumed. Dragging a finger selected text. | A HUD row and two wide control columns took the space, portrait had no layout of its own, and only the controls disabled selection. | `7c93ab9`, `7acd130`, `389de04`; `touch-layout.spec.ts` now checks seven phone screens. |
| The Linux run in the CI image | Two `mobile-chromium` tests timed out: `pause.spec.ts` › "pauses from the keyboard…" and `options.spec.ts` › "turns sound effects off…". The traces show every step completing, each one taking seconds. | The larger landscape arena means more pixels drawn and composited in software, at the Pixel 7's density, because CI has no GPU. The mobile project's shared tests ran 81% longer than before; desktop was unchanged. A measurement of the game screen found no layout or script work repeated every frame. | In CI only, `playwright.config.ts` allows 60 s per test and 10 s per assertion. The checks are unchanged. |
| A second manual test on an iPhone | The menu title sat off-centre on every screen, and How to play listed keyboard keys on a phone. | The title's heading took the image's natural width (384 px) while the image was drawn at 320 px against its left edge, and the guide ignored the device. | `42e6e18`, with E2E checks for both. |
| Updating the menu baseline | The new mobile baseline showed keyboard keys while the page showed the touch guide. | Chromium's full-page capture briefly drops touch emulation, and the menu re-rendered for a keyboard. | `42e6e18`: the menu is captured with a viewport grown to the page's height. |
| A local run | All 20 `dev-strict-mode` tests that start a match failed with "No match is running". | Locally, Playwright reuses a server already on its ports, and a developer's `npm run dev`, which has no test bridge, had taken port 5174, the port Vite picks when 5173 is busy. | `7947944`: the test servers use ports 4180 and 5180. |
| Checking the challenge statement again | Match History had no end-to-end checks for pages, loading or errors, and no demo data gave it more than one page. The hidden-tab pause had no test. | The paginated scenario seeded other captains only, and the tests covered those states on the Ranking tab. | `bf64b25` and `0efafdc`: the paginated scenario gives the local captain three pages of history, with new tests for history pages, loading and errors and for the hidden-tab pause. |
| Two local runs | `leaderboards.spec.ts` › "shows a loading state on a slow network" failed on `dev-strict-mode`: the ranking had already loaded when the check began. | The test waited for the page's load event, which also waits for the menu's images. On the dev server that wait can outlast the slow scenario's answer of about one second. | `0efafdc`: the test starts watching as soon as the page commits; it then passed 30 times in a row. |
| A slower run in the CI image (11.3 min) | Two `mobile-chromium` tests never saw their match load: "Loading the fleet…" outlasted the 10 s assertion timeout. | Loading decodes the textures and starts WebGL, the step that varies most between machines and is slowest without a GPU. | `f70dfd8`: every test waits for a match through `expectGameReady`, which allows 30 s for loading. |
| A local run | `touch.spec.ts` › "turns with the on-screen buttons" failed once under parallel load, then passed in 30 repeated runs. | Not confirmed, because that run kept no trace. The touch tests ran simulation steps right after sending a touch through the Chrome DevTools Protocol, without waiting for the press to register. | `892c140`: each step waits until the button shows the press or the release. |

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
