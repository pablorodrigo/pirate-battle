import uiAtlas from '../../../assets/spritesheet/ui_sheet.json'
import sceneBackground from '../../../assets/ui_scene_background.png'

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

type AtlasFrame = {
  readonly sourceSize: { readonly w: number; readonly h: number }
  readonly borders?: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
  readonly ui?: {
    readonly image?: string
    readonly layout?: {
      readonly content_rect?: Rect
      readonly label_rect?: Rect
      readonly fill_rect?: Rect
      readonly icon_render_size?: { readonly w: number; readonly h: number }
    }
  }
}

const frames = (uiAtlas as { frames: Record<string, AtlasFrame> }).frames

/** Every UI image of the pack, 1× and 2×, emitted by Vite and keyed by its path. */
const imageUrls = import.meta.glob<string>('../../../assets/png/*/ui/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

function frame(name: string): AtlasFrame {
  const found = frames[name]
  if (!found) {
    throw new Error(`The UI atlas has no "${name}" sprite.`)
  }
  return found
}

/**
 * `ui.image` paths are relative to the atlas JSON. The 2× file mirrors the
 * 1× path under png/retina, and both are listed so the browser picks one;
 * sizes everywhere else stay in the atlas's logical (1×) units.
 */
function imageSet(name: string): string {
  const relative = frame(name).ui?.image
  if (!relative) {
    throw new Error(`The UI atlas has no image path for "${name}".`)
  }
  const path = `../../../assets/${relative.replace(/^\.\.\//, '')}`
  const oneX = imageUrls[path]
  const twoX = imageUrls[path.replace('/png/default/', '/png/retina/')]
  if (!oneX || !twoX) {
    throw new Error(`Missing UI image files for "${name}".`)
  }
  return `image-set(url("${oneX}") 1x, url("${twoX}") 2x)`
}

/** Sources for an <img>: the 1× file, a 1×/2× srcset and the logical size. */
export function uiImage(name: string): { src: string; srcSet: string; width: number; height: number } {
  const relative = frame(name).ui?.image ?? ''
  const path = `../../../assets/${relative.replace(/^\.\.\//, '')}`
  const oneX = imageUrls[path]
  const twoX = imageUrls[path.replace('/png/default/', '/png/retina/')]
  if (!oneX || !twoX) {
    throw new Error(`Missing UI image files for "${name}".`)
  }
  const { w, h } = frame(name).sourceSize
  return { src: oneX, srcSet: `${oneX} 1x, ${twoX} 2x`, width: w, height: h }
}

/** Insets of an inner rectangle, as CSS lengths in logical pixels. */
function insets(rect: Rect, size: { w: number; h: number }, scale = 1): string {
  const top = rect.y * scale
  const right = (size.w - rect.x - rect.w) * scale
  const bottom = (size.h - rect.y - rect.h) * scale
  const left = rect.x * scale
  return `${top}px ${right}px ${bottom}px ${left}px`
}

/** Nine-slice cut as percentages of the image, so the 1× and 2× files slice the same way. */
function sliceOf(name: string): { slice: string; width: string } {
  const { sourceSize, borders } = frame(name)
  if (!borders) {
    throw new Error(`"${name}" has no nine-slice borders.`)
  }
  const percent = (value: number, total: number) => `${((value / total) * 100).toFixed(4)}%`
  return {
    slice: `${percent(borders.top, sourceSize.h)} ${percent(borders.right, sourceSize.w)} ${percent(borders.bottom, sourceSize.h)} ${percent(borders.left, sourceSize.w)} fill`,
    width: `${borders.top}px ${borders.right}px ${borders.bottom}px ${borders.left}px`,
  }
}

/** Menu buttons are drawn at three quarters of their logical size; compact ones at half. */
const BUTTON_SCALE = { large: 0.75, small: 0.5 } as const

/**
 * Publishes the UI atlas as CSS custom properties on the document: images
 * (1× and 2×), the panel's nine-slice and content padding, button label
 * areas and the health bar's fill area. Styles read these variables, so
 * every size and inset comes from the atlas metadata.
 */
export function installUiSkin(root: HTMLElement = document.documentElement): void {
  const panel = frame('panel_menu')
  const panelSlice = sliceOf('panel_menu')
  const button = frame('button_primary_normal')
  const label = button.ui?.layout?.label_rect
  const health = frame('health_frame')
  const fill = health.ui?.layout?.fill_rect
  const content = panel.ui?.layout?.content_rect
  const round = frame('button_round_normal')
  const iconSize = round.ui?.layout?.icon_render_size
  if (!label || !fill || !content || !iconSize) {
    throw new Error('The UI atlas is missing layout metadata.')
  }

  const properties: Record<string, string> = {
    '--ui-scene-background': `url("${sceneBackground}")`,
    '--ui-panel': imageSet('panel_menu'),
    '--ui-panel-slice': panelSlice.slice,
    '--ui-panel-border': panelSlice.width,
    '--ui-panel-padding': insets(content, panel.sourceSize),
    '--ui-panel-padding-inline': `${Math.max(content.x, panel.sourceSize.w - content.x - content.w)}px`,
    '--ui-title': imageSet('title_pirate_battle'),
    '--ui-title-aspect': `${frame('title_pirate_battle').sourceSize.w} / ${frame('title_pirate_battle').sourceSize.h}`,
    '--ui-button-primary': imageSet('button_primary_normal'),
    '--ui-button-primary-hover': imageSet('button_primary_hover'),
    '--ui-button-primary-pressed': imageSet('button_primary_pressed'),
    '--ui-button-primary-disabled': imageSet('button_primary_disabled'),
    '--ui-button-secondary': imageSet('button_secondary_normal'),
    '--ui-button-secondary-pressed': imageSet('button_secondary_pressed'),
    '--ui-button-large-width': `${button.sourceSize.w * BUTTON_SCALE.large}px`,
    '--ui-button-large-height': `${button.sourceSize.h * BUTTON_SCALE.large}px`,
    '--ui-button-large-padding': insets(label, button.sourceSize, BUTTON_SCALE.large),
    '--ui-button-small-width': `${button.sourceSize.w * BUTTON_SCALE.small}px`,
    '--ui-button-small-height': `${button.sourceSize.h * BUTTON_SCALE.small}px`,
    '--ui-button-small-padding': insets(label, button.sourceSize, BUTTON_SCALE.small),
    '--ui-round-button': imageSet('button_round_normal'),
    '--ui-round-button-hover': imageSet('button_round_hover'),
    '--ui-round-button-pressed': imageSet('button_round_pressed'),
    '--ui-round-icon-size': `${(iconSize.w / round.sourceSize.w) * 100}%`,
    '--ui-icon-pause': imageSet('icon_pause'),
    '--ui-icon-score': imageSet('icon_score'),
    '--ui-icon-time': imageSet('icon_time'),
    '--ui-icon-heart': imageSet('icon_heart'),
    '--ui-counter-panel': imageSet('counter_panel'),
    '--ui-counter-aspect': `${frame('counter_panel').sourceSize.w} / ${frame('counter_panel').sourceSize.h}`,
    '--ui-health-frame': imageSet('health_frame'),
    '--ui-health-aspect': `${health.sourceSize.w} / ${health.sourceSize.h}`,
    '--ui-health-fill-green': imageSet('health_fill_green'),
    '--ui-health-fill-amber': imageSet('health_fill_amber'),
    '--ui-health-fill-red': imageSet('health_fill_red'),
    // The fill is drawn over the frame and clipped along x from the left of its fill area.
    '--ui-health-fill-left': `${(fill.x / health.sourceSize.w) * 100}%`,
    '--ui-health-fill-width': `${(fill.w / health.sourceSize.w) * 100}%`,
  }
  for (const [name, value] of Object.entries(properties)) {
    root.style.setProperty(name, value)
  }
}
