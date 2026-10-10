import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { defaultArena } from '../../src/game/config/defaultArena.ts'

const MATCH_SECONDS = 180
const SEED = 2026
/**
 * The bot lasts the whole match when an enemy spawns every 5 s. The default
 * and the fastest spawn rates load the match more, until the bot sinks.
 */
const MATCH_RUNS = [
  { name: 'three-minute', title: 'three-minute match, one spawn every 5 s', spawnSeconds: 5, lastsWholeMatch: true },
  {
    name: 'default-spawn-rate',
    title: 'default spawn rate (2.5 s), until the bot sinks',
    spawnSeconds: 2.5,
    lastsWholeMatch: false,
  },
  {
    name: 'fastest-spawn-rate',
    title: 'fastest spawn rate (1 s), until the bot sinks',
    spawnSeconds: 1,
    lastsWholeMatch: false,
  },
] as const
const CYCLE_SPAWN_SECONDS = 2.5
/** Five, as the challenge asks; PROFILE_CYCLES runs more to see where heap growth levels off. */
const CYCLES = Number(process.env.PROFILE_CYCLES ?? 5)
const CYCLE_PLAY_MS = 30_000
const OUTPUT_DIR = 'docs/profiling'

declare global {
  interface Window {
    __PROFILE_FRAMES__?: number[]
  }
}

type Sample = {
  readonly second: number
  readonly fps: number
  readonly enemies: number
  readonly projectiles: number
  readonly score: number
  readonly health: number
  readonly jsHeapMb: number
}

/**
 * Settings, captain and seed for every page load, plus a bot that plays
 * through real keyboard events like a player would. It only fires along a
 * clear line. While every enemy is beyond Shooter range it stops and picks
 * off the nearest one in sight with the bow cannon, or sails toward one when
 * none is in sight. Closer enemies make it sail in circles around the
 * nearest at broadside distance, across the path of cannonballs about to
 * hit it and away from Chasers that come too close, clear of islands and
 * borders.
 */
async function prepare(page: Page, spawnSeconds: number, recordFrames: boolean): Promise<void> {
  await page.addInitScript(
    ({ duration, spawn, seed, frames, arena }) => {
      window.localStorage.setItem(
        'pirate-battle:settings',
        JSON.stringify({ version: 1, data: { matchDurationSeconds: duration, spawnIntervalSeconds: spawn } }),
      )
      window.localStorage.setItem(
        'pirate-battle:player',
        JSON.stringify({ version: 1, data: { id: 'player-profile', name: 'Captain Profile' } }),
      )
      window.__PIRATE_BATTLE_SCENARIO__ = { seed }

      if (frames) {
        const times: number[] = []
        window.__PROFILE_FRAMES__ = times
        const record = (time: number) => {
          times.push(time)
          requestAnimationFrame(record)
        }
        requestAnimationFrame(record)
      }

      const held = new Set<string>()
      const hold = (code: string, down: boolean) => {
        if (down === held.has(code)) {
          return
        }
        if (down) {
          held.add(code)
        } else {
          held.delete(code)
        }
        window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }))
      }
      const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
      const { width, height, islands } = arena
      /** Whether a segment crosses an island grown by `pad` (Liang-Barsky clipping). */
      const crossesIsland = (x1: number, y1: number, x2: number, y2: number, pad: number) =>
        islands.some((island) => {
          let enter = 0
          let exit = 1
          const edges: readonly (readonly [number, number])[] = [
            [x1 - x2, x1 - (island.x - pad)],
            [x2 - x1, island.x + island.width + pad - x1],
            [y1 - y2, y1 - (island.y - pad)],
            [y2 - y1, island.y + island.height + pad - y1],
          ]
          for (const [p, q] of edges) {
            if (p === 0) {
              if (q < 0) {
                return false
              }
            } else if (p < 0) {
              if (q / p > exit) {
                return false
              }
              enter = Math.max(enter, q / p)
            } else {
              if (q / p < enter) {
                return false
              }
              exit = Math.min(exit, q / p)
            }
          }
          return true
        })
      const openWater = (x: number, y: number) =>
        x > 40 &&
        x < width - 40 &&
        y > 40 &&
        y < height - 40 &&
        !islands.some(
          (island) =>
            x > island.x - 30 &&
            x < island.x + island.width + 30 &&
            y > island.y - 30 &&
            y < island.y + island.height + 30,
        )
      /** The heading closest to `desired` whose next 90 units are open water. */
      const steer = (x: number, y: number, desired: number) => {
        for (const delta of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3, Math.PI]) {
          const angle = wrap(desired + delta)
          const dx = Math.cos(angle)
          const dy = Math.sin(angle)
          if (openWater(x + dx * 45, y + dy * 45) && openWater(x + dx * 90, y + dy * 90)) {
            return angle
          }
        }
        return desired
      }

      type Contact = { readonly distance: number; readonly bearing: number }
      window.setInterval(() => {
        const state = window.__PIRATE_BATTLE__?.state() ?? null
        if (!state || state.status !== 'running') {
          for (const code of [...held]) {
            hold(code, false)
          }
          return
        }
        const { player, enemies } = state
        let nearest: Contact | null = null
        let nearestInSight: Contact | null = null
        let nearestChaser: Contact | null = null
        let left = false
        let right = false
        let ahead = false
        for (const enemy of enemies) {
          const contact = {
            distance: Math.hypot(enemy.x - player.x, enemy.y - player.y),
            bearing: Math.atan2(enemy.y - player.y, enemy.x - player.x),
          }
          const inSight = !crossesIsland(player.x, player.y, enemy.x, enemy.y, 4)
          const relative = wrap(contact.bearing - player.angle)
          left ||= inSight && contact.distance < 560 && Math.abs(relative + Math.PI / 2) < 0.3
          right ||= inSight && contact.distance < 560 && Math.abs(relative - Math.PI / 2) < 0.3
          ahead ||= inSight && contact.distance < 800 && Math.abs(relative) < 0.12
          if (!nearest || contact.distance < nearest.distance) {
            nearest = contact
          }
          if (inSight && (!nearestInSight || contact.distance < nearestInSight.distance)) {
            nearestInSight = contact
          }
          if (enemy.kind === 'chaser' && (!nearestChaser || contact.distance < nearestChaser.distance)) {
            nearestChaser = contact
          }
        }
        // The cannonball that passes closest soonest, assuming the ship keeps its course.
        const velocityX = Math.cos(player.angle) * 180
        const velocityY = Math.sin(player.angle) * 180
        let threat: { time: number; missX: number; missY: number; course: number } | null = null
        for (const ball of state.projectiles) {
          if (ball.faction !== 'enemy') {
            continue
          }
          const relativeX = ball.x - player.x
          const relativeY = ball.y - player.y
          const closingX = ball.stepX * 60 - velocityX
          const closingY = ball.stepY * 60 - velocityY
          const closingSq = closingX * closingX + closingY * closingY
          const time =
            closingSq > 0 ? Math.min(1, Math.max(0, -(relativeX * closingX + relativeY * closingY) / closingSq)) : 0
          const missX = relativeX + closingX * time
          const missY = relativeY + closingY * time
          if (Math.hypot(missX, missY) < 40 && (!threat || time < threat.time)) {
            threat = { time, missX, missY, course: Math.atan2(ball.stepY, ball.stepX) }
          }
        }
        const closest = (a: number, b: number) =>
          Math.abs(wrap(a - player.angle)) <= Math.abs(wrap(b - player.angle)) ? a : b
        let desired = Math.atan2(height / 2 - player.y, width / 2 - player.x)
        let sail = true
        if (threat) {
          // Cross the ball's path on the side away from where it would pass.
          const sideA = wrap(threat.course + Math.PI / 2)
          const sideB = wrap(threat.course - Math.PI / 2)
          const awayA = -(Math.cos(sideA) * threat.missX + Math.sin(sideA) * threat.missY)
          const awayB = -(Math.cos(sideB) * threat.missX + Math.sin(sideB) * threat.missY)
          desired = Math.abs(awayA - awayB) < 4 ? closest(sideA, sideB) : awayA > awayB ? sideA : sideB
        } else if (nearestChaser && nearestChaser.distance < 150) {
          desired = wrap(nearestChaser.bearing + Math.PI)
        } else if (nearest && nearest.distance > 320) {
          desired = (nearestInSight ?? nearest).bearing
          sail = nearestInSight === null
        } else if (nearest) {
          // Abeam at about 250-330 units; closer or farther bends the circle out or in.
          const offset = nearest.distance > 330 ? 1.1 : nearest.distance < 250 ? 2 : Math.PI / 2
          desired = closest(wrap(nearest.bearing + offset), wrap(nearest.bearing - offset))
        }
        const heading = sail ? steer(player.x, player.y, desired) : desired
        const turn = wrap(heading - player.angle)
        hold('KeyA', turn < -0.1)
        hold('KeyD', turn > 0.1)
        hold('KeyW', sail)
        hold('Space', ahead)
        hold('KeyQ', left)
        hold('KeyE', right)
      }, 33)
    },
    {
      duration: MATCH_SECONDS,
      spawn: spawnSeconds,
      seed: SEED,
      frames: recordFrames,
      arena: { width: defaultArena.width, height: defaultArena.height, islands: defaultArena.islands },
    },
  )
}

function matchStatus(page: Page): Promise<string> {
  return page.evaluate(() => window.__PIRATE_BATTLE__?.state()?.status ?? 'none')
}

async function metrics(cdp: CDPSession): Promise<Record<string, number>> {
  const { metrics: list } = await cdp.send('Performance.getMetrics')
  return Object.fromEntries(list.map(({ name, value }) => [name, value]))
}

/** Describes, with `describe`, every object alive in the page whose prototype is `constructorName.prototype`. */
async function liveObjects(cdp: CDPSession, constructorName: string, describe: string): Promise<string[]> {
  const { result: prototype } = await cdp.send('Runtime.evaluate', { expression: `${constructorName}.prototype` })
  if (!prototype.objectId) {
    return []
  }
  const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: prototype.objectId })
  try {
    if (!objects.objectId) {
      return []
    }
    const { result } = await cdp.send('Runtime.callFunctionOn', {
      objectId: objects.objectId,
      functionDeclaration: `function () { return this.map(${describe}) }`,
      returnByValue: true,
    })
    return Array.isArray(result.value) ? result.value.map(String) : []
  } finally {
    if (objects.objectId) {
      await cdp.send('Runtime.releaseObject', { objectId: objects.objectId })
    }
    await cdp.send('Runtime.releaseObject', { objectId: prototype.objectId })
  }
}

type HeapTotals = Map<string, { count: number; bytes: number }>

/** Takes a heap snapshot, which collects garbage first, and totals its objects by constructor or kind. */
async function heapTotals(cdp: CDPSession): Promise<HeapTotals> {
  const chunks: string[] = []
  const collect = ({ chunk }: { chunk: string }) => {
    chunks.push(chunk)
  }
  cdp.on('HeapProfiler.addHeapSnapshotChunk', collect)
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  cdp.off('HeapProfiler.addHeapSnapshotChunk', collect)
  const snapshot = JSON.parse(chunks.join('')) as {
    snapshot: { meta: { node_fields: string[]; node_types: unknown[] } }
    nodes: number[]
    strings: string[]
  }
  const fields = snapshot.snapshot.meta.node_fields
  const types = snapshot.snapshot.meta.node_types[0] as string[]
  const typeAt = fields.indexOf('type')
  const nameAt = fields.indexOf('name')
  const sizeAt = fields.indexOf('self_size')
  const totals: HeapTotals = new Map()
  for (let index = 0; index < snapshot.nodes.length; index += fields.length) {
    const type = types[snapshot.nodes[index + typeAt] ?? 0] ?? 'unknown'
    const name = snapshot.strings[snapshot.nodes[index + nameAt] ?? 0] ?? ''
    const key =
      type === 'object' || type === 'native' ? name : type === 'closure' ? `${name || 'anonymous'}()` : `(${type})`
    const entry = totals.get(key) ?? { count: 0, bytes: 0 }
    entry.count += 1
    entry.bytes += snapshot.nodes[index + sizeAt] ?? 0
    totals.set(key, entry)
  }
  return totals
}

/** The constructors and kinds whose retained size grew the most between two snapshots. */
function heapGrowth(before: HeapTotals, after: HeapTotals, limit: number) {
  return [...new Set([...before.keys(), ...after.keys()])]
    .map((name) => {
      const from = before.get(name) ?? { count: 0, bytes: 0 }
      const to = after.get(name) ?? { count: 0, bytes: 0 }
      return { name, objects: to.count - from.count, kilobytes: round((to.bytes - from.bytes) / 1024, 1) }
    })
    .sort((a, b) => b.kilobytes - a.kilobytes)
    .slice(0, limit)
}

function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))] ?? 0
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits))
}

async function environment(page: Page): Promise<Record<string, unknown>> {
  // Probed on the blank page before the game loads, so the extra context never counts.
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
  })
  const viewport = page.viewportSize()
  return {
    browser: `Google Chrome ${page.context().browser()?.version() ?? 'unknown'}, headless mode`,
    gpu,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    logicalCores: os.cpus().length,
    memoryGb: round(os.totalmem() / 2 ** 30, 0),
    os: `${os.type()} ${os.release()}`,
    viewport,
    devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
  }
}

async function save(name: string, data: unknown): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(`${OUTPUT_DIR}/${name}.json`, `${JSON.stringify(data, null, 2)}\n`)
}

for (const run of MATCH_RUNS) {
  test(run.title, async ({ page }, testInfo) => {
    const env = await environment(page)
    await prepare(page, run.spawnSeconds, true)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Performance.enable')
    await page.goto('/')
    await page.getByRole('button', { name: 'Play' }).click()
    await expect.poll(() => matchStatus(page), { timeout: 30_000 }).toBe('running')

    const startMetrics = await metrics(cdp)
    const start = await page.evaluate(() => performance.now())
    const samples: Sample[] = []
    let previous = { now: start, frames: await page.evaluate(() => window.__PROFILE_FRAMES__?.length ?? 0) }
    let end = start
    let paused = false
    let endMetrics = startMetrics
    for (;;) {
      await page.waitForTimeout(1000)
      const sample = await page.evaluate(() => {
        const state = window.__PIRATE_BATTLE__?.state() ?? null
        const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
        return {
          now: performance.now(),
          frames: window.__PROFILE_FRAMES__?.length ?? 0,
          status: state?.status ?? 'none',
          enemies: state?.enemies.length ?? 0,
          projectiles: state?.projectiles.length ?? 0,
          score: state?.score ?? 0,
          health: state?.player.health ?? 0,
          jsHeap: memory?.usedJSHeapSize ?? 0,
        }
      })
      paused ||= sample.status === 'paused'
      if (sample.status !== 'running') {
        break
      }
      end = sample.now
      endMetrics = await metrics(cdp)
      samples.push({
        second: samples.length + 1,
        fps: round(((sample.frames - previous.frames) * 1000) / (sample.now - previous.now), 1),
        enemies: sample.enemies,
        projectiles: sample.projectiles,
        score: sample.score,
        health: sample.health,
        jsHeapMb: round(sample.jsHeap / 1e6, 1),
      })
      previous = sample
    }
    const outcome = await page.getByTestId('result-reason').textContent()

    const frames = await page.evaluate(
      ({ from, to }) => (window.__PROFILE_FRAMES__ ?? []).filter((time) => time >= from && time <= to),
      { from: start, to: end },
    )
    const intervals = frames.slice(1).map((time, index) => time - (frames[index] ?? time))
    const sorted = [...intervals].sort((a, b) => a - b)
    const seconds = (end - start) / 1000
    const entities = samples.map((sample) => 1 + sample.enemies + sample.projectiles)
    const busy = (name: string) => round(((endMetrics[name] ?? 0) - (startMetrics[name] ?? 0)) / seconds, 4)

    const summary = {
      environment: env,
      match: {
        durationSettingSeconds: MATCH_SECONDS,
        spawnIntervalSeconds: run.spawnSeconds,
        seed: SEED,
        outcome,
        measuredSeconds: round(seconds, 1),
        pausedDuringRun: paused,
        finalScore: samples.at(-1)?.score ?? 0,
        finalHealth: samples.at(-1)?.health ?? 0,
      },
      frames: {
        count: frames.length,
        averageFps: round((frames.length - 1) / seconds, 1),
        lowestOneSecondFps: Math.min(...samples.map((sample) => sample.fps)),
        intervalMs: {
          p50: round(percentile(sorted, 0.5)),
          p95: round(percentile(sorted, 0.95)),
          p99: round(percentile(sorted, 0.99)),
          max: round(sorted.at(-1) ?? 0),
        },
        intervalsOver20ms: intervals.filter((interval) => interval > 20).length,
        intervalsOver34ms: intervals.filter((interval) => interval > 34).length,
      },
      entities: {
        peakEnemies: Math.max(...samples.map((sample) => sample.enemies)),
        peakProjectiles: Math.max(...samples.map((sample) => sample.projectiles)),
        peakTotal: Math.max(...entities),
        averageTotal: round(entities.reduce((sum, count) => sum + count, 0) / entities.length, 1),
      },
      mainThreadShare: {
        tasks: busy('TaskDuration'),
        scripts: busy('ScriptDuration'),
        layoutAndStyle: round(busy('LayoutDuration') + busy('RecalcStyleDuration'), 4),
      },
      samples,
    }
    await save(`${testInfo.project.name}-${run.name}`, summary)
    console.log(JSON.stringify({ ...summary, samples: undefined }, null, 2))
    expect(paused).toBe(false)
    if (run.lastsWholeMatch) {
      expect(outcome).toBe('Time ran out')
    }
  })
}

test(`memory across ${CYCLES} play-and-leave cycles`, async ({ page }, testInfo) => {
  const env = await environment(page)
  await prepare(page, CYCLE_SPAWN_SECONDS, false)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('HeapProfiler.enable')

  const snapshot = async (label: string) => {
    // Let exit animations, requests and timers settle, then collect garbage.
    await page.waitForTimeout(2000)
    await cdp.send('HeapProfiler.collectGarbage')
    const values = await metrics(cdp)
    return {
      label,
      jsHeapUsedMb: round((values.JSHeapUsedSize ?? 0) / 1e6),
      domNodes: values.Nodes ?? 0,
      jsEventListeners: values.JSEventListeners ?? 0,
      documents: values.Documents ?? 0,
      canvasesInDocument: await page.locator('canvas').count(),
      liveCanvases: await liveObjects(
        cdp,
        'HTMLCanvasElement',
        "(canvas) => canvas.width + 'x' + canvas.height + (canvas.isConnected ? ', in the document' : '')",
      ),
      liveWebGlContexts: [
        ...(await liveObjects(
          cdp,
          'WebGL2RenderingContext',
          "(gl) => 'WebGL 2, ' + (gl.isContextLost() ? 'lost' : 'active')",
        )),
        ...(await liveObjects(
          cdp,
          'WebGLRenderingContext',
          "(gl) => 'WebGL 1, ' + (gl.isContextLost() ? 'lost' : 'active')",
        )),
      ],
    }
  }

  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: 'Mock API' })).toHaveText('Mock API: online')
  const snapshots = [await snapshot('Main menu, before any match')]
  const cycles: { cycle: number; jsHeapUsedMbWhilePlaying: number; canvasesWhilePlaying: number; leftFrom: string }[] =
    []
  let afterFirstCycle: HeapTotals | null = null
  for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
    await page.getByRole('button', { name: 'Play' }).click()
    await expect.poll(() => matchStatus(page), { timeout: 30_000 }).toBe('running')
    await page.waitForTimeout(CYCLE_PLAY_MS)
    const values = await metrics(cdp)
    const canvasesWhilePlaying = await page.locator('canvas').count()
    // Leave mid-match from the pause menu, as a player would; a lost match ends on the result screen.
    const running = (await matchStatus(page)) === 'running'
    if (running) {
      await page.keyboard.press('Escape')
      await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Main Menu' }).click()
    } else {
      await page.getByRole('button', { name: 'Main Menu' }).click()
    }
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
    cycles.push({
      cycle,
      jsHeapUsedMbWhilePlaying: round((values.JSHeapUsedSize ?? 0) / 1e6),
      canvasesWhilePlaying,
      leftFrom: running ? 'pause menu' : 'result screen',
    })
    snapshots.push(await snapshot(`Main menu, after cycle ${cycle}`))
    if (cycle === 1) {
      afterFirstCycle = await heapTotals(cdp)
    }
  }
  const afterLastCycle = await heapTotals(cdp)

  const first = snapshots[1]
  const last = snapshots.at(-1)
  const summary = {
    environment: env,
    cycle: { count: CYCLES, playSeconds: CYCLE_PLAY_MS / 1000, spawnIntervalSeconds: CYCLE_SPAWN_SECONDS, seed: SEED },
    growthFromCycle1ToLast:
      first && last
        ? {
            jsHeapUsedMb: round(last.jsHeapUsedMb - first.jsHeapUsedMb),
            domNodes: last.domNodes - first.domNodes,
            jsEventListeners: last.jsEventListeners - first.jsEventListeners,
            liveCanvases: last.liveCanvases.length - first.liveCanvases.length,
            liveWebGlContexts: last.liveWebGlContexts.length - first.liveWebGlContexts.length,
          }
        : null,
    largestHeapGrowthFromCycle1ToLast: afterFirstCycle ? heapGrowth(afterFirstCycle, afterLastCycle, 15) : [],
    snapshots,
    cycles,
  }
  await save(`${testInfo.project.name}-memory${CYCLES === 5 ? '' : `-${CYCLES}-cycles`}`, summary)
  console.log(JSON.stringify(summary, null, 2))
})
