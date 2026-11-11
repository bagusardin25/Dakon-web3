// Where every cell of the board sits on screen.
//
// Everything is laid out once in a canonical frame: horizontal, South along the bottom. Sowing
// runs clockwise, as in the congklak tradition: along South's row from right to left, into
// South's store on the left, along North's row from left to right, into North's store on the
// right. The frame is then turned so the viewer's own side sits nearest to them, and turned a
// quarter more on narrow screens, where the board stands upright so the holes stay large enough
// to touch.
import { NORTH, SOUTH } from '../../engine/rules'
import type { Side, Size } from '../../engine/rules'

export const PITCH = 100
export const HOLE_R = 38
const STORE_ZONE = 140
const H = 300
const ROW_TOP = 95
const ROW_BOTTOM = 205
const MID = H / 2
export const STORE_RX = 50
export const STORE_RY = 112

export type Orientation = 'wide' | 'tall'
export type Point = { x: number; y: number }

/** An affine map x' = a·x + c·y + e, y' = b·x + d·y + f, the order SVG's matrix() uses. */
export type Affine = { a: number; b: number; c: number; d: number; e: number; f: number }

export type Geometry = {
  size: Size
  /** Canonical (horizontal, South at the bottom) frame. */
  canonical: { width: number; height: number }
  /** The frame as drawn. */
  width: number
  height: number
  orientation: Orientation
  bottom: Side
  /** Canonical to screen. */
  transform: Affine
  /** Cell centre on screen. */
  center: (cell: number) => Point
  /** Where the seed count is written, on screen. */
  label: (cell: number) => Point
  /** A canonical offset (a vector, not a point) turned into screen space. */
  vector: (dx: number, dy: number) => Point
  cells: number[]
}

function canonicalCenter(size: Size, width: number, cell: number): Point {
  if (cell === 7) return { x: STORE_ZONE / 2 + 10, y: MID }
  if (cell === 15) return { x: width - STORE_ZONE / 2 - 10, y: MID }
  if (cell < 8) return { x: STORE_ZONE + (size - 1 - cell) * PITCH + PITCH / 2, y: ROW_BOTTOM }
  return { x: STORE_ZONE + (cell - 8) * PITCH + PITCH / 2, y: ROW_TOP }
}

function canonicalLabel(size: Size, width: number, cell: number): Point {
  const c = canonicalCenter(size, width, cell)
  if (cell === 7 || cell === 15) return { x: c.x, y: c.y + STORE_RY - 30 }
  return { x: c.x, y: cell < 8 ? c.y + 61 : c.y - 61 }
}

const apply = (m: Affine, p: Point): Point => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f })

function compose(outer: Affine, inner: Affine): Affine {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  }
}

export function geometry(size: Size, orientation: Orientation, bottom: Side): Geometry {
  const cw = size * PITCH + 2 * STORE_ZONE
  const ch = H
  const identity: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  // North nearest the viewer: a half turn.
  const flip: Affine = bottom === NORTH ? { a: -1, b: 0, c: 0, d: -1, e: cw, f: ch } : identity
  // Upright: a quarter turn anticlockwise, so the viewer's row runs down the right-hand side
  // and their store sits at the bottom, under the thumb.
  const turn: Affine = orientation === 'tall' ? { a: 0, b: -1, c: 1, d: 0, e: 0, f: cw } : identity
  const transform = compose(turn, flip)
  const linear: Affine = { ...transform, e: 0, f: 0 }

  const cells: number[] = []
  for (let i = 0; i < size; i++) cells.push(i)
  cells.push(7)
  for (let i = 0; i < size; i++) cells.push(8 + i)
  cells.push(15)

  return {
    size,
    canonical: { width: cw, height: ch },
    width: orientation === 'tall' ? ch : cw,
    height: orientation === 'tall' ? cw : ch,
    orientation,
    bottom,
    transform,
    center: (cell) => apply(transform, canonicalCenter(size, cw, cell)),
    label: (cell) => apply(transform, canonicalLabel(size, cw, cell)),
    vector: (dx, dy) => apply(linear, { x: dx, y: dy }),
    cells,
  }
}

export const matrix = (m: Affine): string => `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`

/** Canonical-frame positions used to draw the body of the board. */
export function canonicalLayout(size: Size) {
  const width = size * PITCH + 2 * STORE_ZONE
  const holes: { cell: number; x: number; y: number }[] = []
  for (let i = 0; i < size; i++) holes.push({ cell: i, ...canonicalCenter(size, width, i) })
  for (let i = 0; i < size; i++) holes.push({ cell: 8 + i, ...canonicalCenter(size, width, 8 + i) })
  return {
    width,
    height: H,
    mid: MID,
    holes,
    stores: [
      { cell: 7, ...canonicalCenter(size, width, 7) },
      { cell: 15, ...canonicalCenter(size, width, 15) },
    ],
  }
}

// ───────────────────────────── Seed placement ─────────────────────────────

const GOLDEN = 2.399963229728653

/** Offsets (canonical frame) for up to `max` seeds in a round hole, a loose spiral pile. */
export function holeSeedOffsets(cell: number, count: number, max = 13): { dx: number; dy: number; rot: number }[] {
  const n = Math.min(count, max)
  const out: { dx: number; dy: number; rot: number }[] = []
  const spin = cell * 1.7
  for (let k = 0; k < n; k++) {
    const r = n === 1 ? 0 : 7 + 19 * Math.sqrt(k / Math.max(1, max - 1))
    const angle = spin + k * GOLDEN
    out.push({ dx: r * Math.cos(angle), dy: r * Math.sin(angle), rot: (k * 47 + cell * 31) % 180 })
  }
  return out
}

/** Offsets for up to `max` seeds in a store, spread along its length. */
export function storeSeedOffsets(cell: number, count: number, max = 44): { dx: number; dy: number; rot: number }[] {
  const n = Math.min(count, max)
  const out: { dx: number; dy: number; rot: number }[] = []
  const spin = cell * 0.9
  for (let k = 0; k < n; k++) {
    const t = Math.sqrt((k + 0.5) / max)
    const angle = spin + k * GOLDEN
    out.push({ dx: 33 * t * Math.cos(angle), dy: -14 + 70 * t * Math.sin(angle), rot: (k * 53 + cell * 17) % 180 })
  }
  return out
}

export { NORTH, SOUTH }
