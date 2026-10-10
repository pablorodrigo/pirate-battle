export type AtlasFrame = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const SUB_TEXTURE = /<SubTexture\b([^>]*?)\/?>/g
const ATTRIBUTE = /(\w+)="([^"]*)"/g

/**
 * Reads the frames of a Sparrow/Starling texture atlas (the XML format of
 * the provided ship sheet), keyed by sprite name without its extension.
 * PixiJS has no XML atlas loader, so the frames are mapped onto textures here.
 */
export function parseSparrowAtlas(xml: string): ReadonlyMap<string, AtlasFrame> {
  const frames = new Map<string, AtlasFrame>()
  for (const [, attributes = ''] of xml.matchAll(SUB_TEXTURE)) {
    const values = new Map<string, string>()
    for (const [, key = '', value = ''] of attributes.matchAll(ATTRIBUTE)) {
      values.set(key, value)
    }
    const name = values.get('name')?.replace(/\.png$/, '')
    const frame = {
      x: Number(values.get('x')),
      y: Number(values.get('y')),
      width: Number(values.get('width')),
      height: Number(values.get('height')),
    }
    if (name && Object.values(frame).every(Number.isFinite)) {
      frames.set(name, frame)
    }
  }
  return frames
}
