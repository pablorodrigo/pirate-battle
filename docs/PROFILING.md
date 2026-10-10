# Profiling

Combat performance and memory, measured with `npm run profile` on October 10, 2026, on commit `8260e8c`. The raw results, with one sample per second of every match, are in [profiling/](profiling/).

## Summary

- Every measured match averaged **60 FPS**, with a **95th percentile frame interval of 16.7 to 16.8 ms**, one frame at 60 Hz, at both resolutions. No frame interval exceeded 20 ms.
- The busiest match reached **38 simultaneous entities**. The page's main thread was busy at most **8.2%** of the time, about 1.4 ms of each 16.7 ms frame.
- Five play-and-leave cycles leave no growing DOM nodes, event listeners, canvases or WebGL contexts. The JavaScript heap grows only through code compiled by the JIT, and levels off: twelve cycles end within 0.1 MB of where the ninth one did.
- Profiling found two resources that outlived a match: the pixels of the baked terrain and the DOM of the first game screen. Both are fixed (`b37b207`, `a8deeaa`).

## Reference environment

| Item | Value |
| --- | --- |
| Hardware | MacBook Pro 14-inch (2021), Apple M1 Pro: 8-core CPU (6 performance and 2 efficiency cores), 14-core GPU, 16 GB of memory |
| Operating system | macOS 14.6.1 |
| Browser | Google Chrome 154.0.8037.99 in headless mode, with WebGL 2 on the real GPU through ANGLE and Metal (`ANGLE Metal Renderer: Apple M1 Pro`) |
| Frame clock | 60 Hz |
| Build | The optimized production bundle (`vite build`) plus the read-only test bridge (`npm run build:e2e`), served by `vite preview` |
| Resolutions | 1512 × 982 CSS pixels at device pixel ratio 2, the default resolution of the laptop's built-in display (3024 × 1964 device pixels); 1920 × 1080 at ratio 1, a common external monitor |
| Match configuration | 180 s per match (the longest Options allow), seed 2026, the default rules (`RULES_VERSION` 1), sound effects on; spawn interval per run below |

Chrome's headless mode renders every frame on the GPU and keeps a steady 60 Hz frame clock. A windowed Chrome on this laptop follows the display instead: up to 120 Hz on its ProMotion screen, and only about 49 frames per second in a quick check during these unattended night runs, which makes results hard to compare.

## Method

- **Playing.** Playwright drives Chrome. A bot plays through the same keyboard events a player produces: it reads the match through the end-to-end bridge, which never changes it, and only fires along a clear line. It circles enemies at broadside distance, dodges cannonballs, runs from Chasers that come too close and picks off distant enemies with the bow cannon.
- **Frame rate.** The page records the time of every `requestAnimationFrame` callback during the match. The average frame rate is frames per second of match time; the percentiles come from the intervals between consecutive frames.
- **Entities.** The player, the enemies and the cannonballs in the simulation, sampled once per second.
- **Main thread.** Chrome's `TaskDuration` metric, through the DevTools protocol: the share of match time the page's main thread spent running tasks (scripts, rendering commands, style, layout and garbage collection).
- **Memory.** Five cycles of starting a match, playing for 30 s (one spawn every 2.5 s) and leaving it from the pause menu. Back on the main menu after each cycle, the script waits 2 s, forces a garbage collection and records the JavaScript heap, DOM nodes and event listeners, then lists every canvas and WebGL context still alive (`Runtime.queryObjects`). It also compares heap snapshots taken after the first and the last cycle, grouped by constructor.

## Frame rate and entities

| Run | Viewport | Result | Measured | Average FPS | Lowest FPS in 1 s | Frame interval p50 / p95 / p99 / max (ms) | Intervals over 20 ms | Peak entities | Peak enemies | Peak cannonballs | Average entities | Main thread busy |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Three minutes, a spawn every 5 s | 1512 × 982 @2× | Lasted the match, 34 points | 179.6 s | 60 | 59.4 | 16.7 / 16.7 / 16.8 / 16.8 | 0 of 10,774 | 8 | 3 | 5 | 3.3 | 5.7% |
| Three minutes, a spawn every 5 s | 1920 × 1080 @1× | Lasted the match, 35 points | 179.6 s | 60 | 59.2 | 16.7 / 16.7 / 16.8 / 16.8 | 0 of 10,774 | 12 | 5 | 6 | 4.3 | 6.6% |
| Default spawns (2.5 s) | 1512 × 982 @2× | Sank after 130 s, 40 points | 130.1 s | 60 | 59.2 | 16.7 / 16.7 / 16.8 / 16.8 | 0 of 7,802 | 16 | 9 | 7 | 6.6 | 7.0% |
| Default spawns (2.5 s) | 1920 × 1080 @1× | Lasted the match, 66 points | 179.5 s | 60 | 59.2 | 16.7 / 16.7 / 16.8 / 16.8 | 0 of 10,768 | 18 | 8 | 10 | 6.1 | 7.0% |
| Fastest spawns (1 s) | 1512 × 982 @2× | Sank after 59 s, 27 points | 58.5 s | 60 | 59.3 | 16.7 / 16.8 / 16.8 / 16.8 | 0 of 3,506 | 38 | 30 | 10 | 17.7 | 8.2% |
| Fastest spawns (1 s) | 1920 × 1080 @1× | Sank after 28 s, 10 points | 28.2 s | 60 | 59.4 | 16.7 / 16.8 / 16.8 / 16.8 | 0 of 1,693 | 21 | 17 | 7 | 12.5 | 6.9% |

Matches run in real time, so the bot's play varies from run to run. With one spawn every 5 s it reliably lasts the whole match, which gives the three-minute measurement. The default (2.5 s) and fastest (1 s) spawn intervals load the same 180 s match more, until the bot's ship sinks: at the default rate it lasted the whole match at 1920 × 1080 and sank after 130 s at 1512 × 982. Peak enemies and peak cannonballs can happen at different moments, so the peak total is not their sum.

## Memory across five play-and-leave cycles

At 1512 × 982 @2×:

| Back on the main menu | JS heap (MB) | DOM nodes | Event listeners | Canvases in the page | Live canvases | Live WebGL contexts |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| before any match | 5.05 | 291 | 177 | 0 | none | none |
| after cycle 1 | 7.41 | 303 | 177 | 0 | 7, all 0 × 0 | 1 (PixiJS test context) |
| after cycle 2 | 7.60 | 303 | 177 | 0 | 7, all 0 × 0 | 1 (PixiJS test context) |
| after cycle 3 | 7.76 | 303 | 177 | 0 | 7, all 0 × 0 | 1 (PixiJS test context) |
| after cycle 4 | 7.95 | 303 | 177 | 0 | 7, all 0 × 0 | 1 (PixiJS test context) |
| after cycle 5 | 8.07 | 303 | 177 | 0 | 7, all 0 × 0 | 1 (PixiJS test context) |

The run at 1920 × 1080 recorded the same counts, with a heap of 8.06 MB after the fifth cycle. Every cycle left the match from the pause menu.

What the numbers show:

1. **No accumulating resources.** DOM nodes, event listeners, live canvases and WebGL contexts are identical after every cycle, and the page holds no canvas once the player is back on the menu.
2. **Heap growth is compiled code.** The JavaScript heap grew 0.66 MB from the first to the fifth cycle. Comparing the heap snapshots, 0.61 MB of that growth is `(code)`: functions of the game compiled and optimized by the JIT as they run. No application or PixiJS object type is among the largest increases. A twelve-cycle run shows the curve flattening: the heap read 7.41, 7.62, 7.77, 7.96, 8.09, 8.10, 8.13, 8.18, 8.52, 8.57, 8.58 and 8.56 MB after cycles 1 to 12, and compiled code accounts for 1.00 MB of the 1.15 MB grown from the first to the twelfth cycle.
3. **What stays after the first match, by design.** The textures shared by every match (ships, effects and tiles) stay in the asset cache, and the decoded sound effects in the sound bank, so later matches start without loading them again. PixiJS keeps one small WebGL context of its own for capability checks. The remaining canvases are empty (0 × 0) and hold no pixels.

Of the 12 DOM nodes the first match adds for good, four are the `modulepreload` links that Vite adds to the page when the game code loads, and seven are the empty canvases above.

### Fixed during profiling

- **Baked terrain pixels.** PixiJS keeps the textures of its last draw batches in a global pool until it reuses the batches. The destroyed island and water textures were still referenced there, so their canvases (about 2 MB of pixels at 2×) stayed alive on the main menu. The terrain now empties each baked canvas when it destroys its texture (`b37b207`).
- **First game screen.** The shared textures' `bakeTiles` closure was created in the same scope as the loader's progress callback, and a closure keeps its whole scope alive. The callback of the first game screen, and through it that screen's 43 detached DOM nodes and 7 event listeners, stayed in memory for the rest of the session: the menu counted 355 DOM nodes and 184 listeners after every cycle, against 303 and 177 now. The shared textures are now built in a scope of their own (`a8deeaa`).

Retainer paths in heap snapshots located both problems: the shortest chain of references from a garbage collection root to each object that should have been freed.

## Limitations

- Headless mode draws every frame on the GPU but does not present it on a screen, so display composition and vertical sync are not part of these numbers. On a 120 Hz display, Chrome calls `requestAnimationFrame` 120 times per second, and the game renders that often while the simulation keeps 60 steps per second.
- GPU time and GPU memory are not measured: the page cannot read them. The renderer destroys the GPU resources it creates, and PixiJS forces a WebGL context loss when it is destroyed.
- The bot plays worse than an attentive player and sinks fewer enemies, so entity counts depend on its play. The fastest spawn rate shows the highest load reached.
- The bot reads the match through the test bridge about 30 times per second, work the public build does not do. If anything, the figures are pessimistic.
- Phones were not profiled. Chrome's device emulation on a desktop GPU would not represent one.

## Reproducing

```sh
npm ci
npm run profile                      # both resolutions, about 18 minutes
PROFILE_CYCLES=12 npm run profile -- --project=retina-1512x982 -g memory
```

The profile needs Google Chrome installed, because Playwright's bundled headless Chromium renders WebGL in software. Results are written to `docs/profiling/`, one JSON file per run.
