# Profiling

Combat performance and memory, measured with `npm run profile` on October 10, 2026, on commit `ac2d718`, where every match plays on a map drawn from its seed. The raw results, with one sample per second of every match, are in [profiling/](profiling/).

## Summary

- Every measured match averaged **60 FPS**, with a **95th percentile frame interval of 16.7 ms**, one frame at 60 Hz, at both resolutions. No frame interval exceeded 16.8 ms.
- The busiest match reached **21 simultaneous entities**. The page's main thread was busy at most **7.4%** of the time, about 1.2 ms of each 16.7 ms frame.
- Five play-and-leave cycles leave no growing DOM nodes, event listeners, canvases or WebGL contexts. The JavaScript heap grows only through code compiled by the JIT, and levels off: twelve cycles end within 0.05 MB of where the ninth one did.
- Drawn maps cost nothing per frame: each obstacle is baked once into a texture of its own when the match starts, and every one is destroyed when the match ends.
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
| Match configuration | 180 s per match (the longest Options allow), seed 2026, which also draws the map (four sand islands, two of them coasts against a border), the default rules (`RULES_VERSION` 2), sound effects on; spawn interval per run below |

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
| Three minutes, a spawn every 5 s | 1512 × 982 @2× | Lasted the match, 32 points | 179.4 s | 60 | 59.2 | 16.7 / 16.7 / 16.8 / 16.8 | 0 of 10,763 | 12 | 4 | 8 | 3.8 | 5.6% |
| Three minutes, a spawn every 5 s | 1920 × 1080 @1× | Lasted the match, 34 points | 179.3 s | 60 | 59.5 | 16.7 / 16.7 / 16.8 / 16.8 | 0 of 10,761 | 9 | 3 | 6 | 2.8 | 6.0% |
| Default spawns (2.5 s) | 1512 × 982 @2× | Sank after 172 s, 64 points | 172.3 s | 60 | 59.0 | 16.7 / 16.7 / 16.8 / 16.8 | 0 of 10,341 | 11 | 6 | 7 | 4.9 | 5.9% |
| Default spawns (2.5 s) | 1920 × 1080 @1× | Sank after 165 s, 59 points | 165.3 s | 60 | 59.4 | 16.7 / 16.7 / 16.8 / 16.8 | 0 of 9,918 | 13 | 6 | 9 | 5.1 | 6.4% |
| Fastest spawns (1 s) | 1512 × 982 @2× | Sank after 46 s, 29 points | 46.4 s | 60 | 59.4 | 16.7 / 16.7 / 16.8 / 16.8 | 0 of 2,781 | 21 | 18 | 8 | 13.7 | 7.4% |
| Fastest spawns (1 s) | 1920 × 1080 @1× | Sank after 52 s, 34 points | 52.3 s | 60 | 59.4 | 16.7 / 16.7 / 16.8 / 16.8 | 0 of 3,140 | 21 | 17 | 7 | 14.0 | 7.1% |

Matches run in real time, so the bot's play varies from run to run. With one spawn every 5 s it reliably lasts the whole match, which gives the three-minute measurement. The default (2.5 s) and fastest (1 s) spawn intervals load the same 180 s match more, until the bot's ship sinks. Peak enemies and peak cannonballs can happen at different moments, so the peak total is not their sum.

A first pass at 1512 × 982 ran while the laptop was busy with other applications and with the end-to-end suites that had just finished, at a load average between 14 and 22. It showed a few frames of up to 750 ms, scattered through each match and unrelated to the number of entities, while its median and 95th percentile stayed at 16.7 ms. The same build at 1920 × 1080, measured right after as the load fell, had none, and the 1512 × 982 runs in the table were repeated once the machine was calmer: they had none either.

## Memory across five play-and-leave cycles

At 1512 × 982 @2×:

| Back on the main menu | JS heap (MB) | DOM nodes | Event listeners | Canvases in the page | Live canvases | Live WebGL contexts |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| before any match | 5.03 | 291 | 178 | 0 | none | none |
| after cycle 1 | 7.44 | 302 | 178 | 0 | 6, all 0 × 0 | 1 (PixiJS test context) |
| after cycle 2 | 7.67 | 302 | 178 | 0 | 6, all 0 × 0 | 1 (PixiJS test context) |
| after cycle 3 | 7.81 | 302 | 178 | 0 | 6, all 0 × 0 | 1 (PixiJS test context) |
| after cycle 4 | 8.03 | 302 | 178 | 0 | 6, all 0 × 0 | 1 (PixiJS test context) |
| after cycle 5 | 8.15 | 302 | 178 | 0 | 6, all 0 × 0 | 1 (PixiJS test context) |

The run at 1920 × 1080 recorded the same counts, with a heap of 8.13 MB after the fifth cycle. Every cycle left the match from the pause menu.

What the numbers show:

1. **No accumulating resources.** DOM nodes, event listeners, live canvases and WebGL contexts are identical after every cycle, and the page holds no canvas once the player is back on the menu.
2. **Heap growth is compiled code.** The JavaScript heap grew 0.71 MB from the first to the fifth cycle. Comparing the heap snapshots, 0.62 MB of that growth is `(code)`: functions of the game compiled and optimized by the JIT as they run. No application or PixiJS object type is among the largest increases. A twelve-cycle run shows the curve flattening: the heap read 7.44, 7.66, 7.84, 8.02, 8.13, 8.16, 8.19, 8.27, 8.60, 8.63, 8.66 and 8.65 MB after cycles 1 to 12, and compiled code accounts for 1.04 MB of the 1.21 MB grown from the first to the twelfth cycle.
3. **What stays after the first match, by design.** The textures shared by every match (ships, effects and tiles) stay in the asset cache, and the decoded sound effects in the sound bank, so later matches start without loading them again. PixiJS keeps one small WebGL context of its own for capability checks. The remaining canvases are empty (0 × 0) and hold no pixels: those of the last match's baked scenery, one per obstacle plus the water, which PixiJS's pool of draw batches still references, and one of PixiJS.

Of the 11 DOM nodes the first match adds for good, four are the `modulepreload` links that Vite adds to the page when the game code loads, and six are the empty canvases above.

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
- Every run plays the map of seed 2026, four sand islands. Other maps differ in their obstacles but draw the same way: one baked texture per obstacle, a handful of sprites in all.

## Reproducing

```sh
npm ci
npm run profile                      # both resolutions, about 18 minutes
PROFILE_CYCLES=12 npm run profile -- --project=retina-1512x982 -g memory
```

The profile needs Google Chrome installed, because Playwright's bundled headless Chromium renders WebGL in software. Results are written to `docs/profiling/`, one JSON file per run.
