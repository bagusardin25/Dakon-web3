import { useEffect, useId, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { ownerOf, storeOf } from '../../engine/rules'
import type { Board as Cells, Side, Size } from '../../engine/rules'
import { useWidth } from '../../lib/prefs'
import { canonicalLayout, geometry, HOLE_R, holeSeedOffsets, matrix, PITCH, STORE_RX, STORE_RY, storeSeedOffsets } from './geometry'
import type { Orientation } from './geometry'
import type { SowFrame } from './useSowing'

export type BoardProps = {
  size: Size
  board: Cells
  /** The side drawn nearest the viewer. */
  bottom: Side
  /** Names used in hole labels, indexed by side: e.g. ['Your', 'Sekar’s']. */
  owners: [string, string]
  /** The side whose holes can be pressed now, if any. */
  mover?: Side
  /** Holes (0-based, on `mover`'s side) that can be pressed now. */
  playable?: readonly number[]
  onPlay?: (hole: number) => void
  frame?: SowFrame | null
  /** The hole the last move started from, marked after it has played out. */
  lastMove?: { side: Side; hole: number } | null
  /** Force an orientation; by default narrow containers get the upright board. */
  orientation?: Orientation
  /** Space (px) kept free above and below an upright board so it fits the screen. */
  reserve?: number
  label: string
  className?: string
}

const TALL_BELOW = 600

export function Board(props: BoardProps) {
  const { size, board, bottom, owners, mover, playable, onPlay, frame, lastMove, label } = props
  const wrap = useRef<HTMLDivElement>(null)
  const width = useWidth(wrap)
  const orientation: Orientation = props.orientation ?? (width > 0 && width < TALL_BELOW ? 'tall' : 'wide')
  const geo = useMemo(() => geometry(size, orientation, bottom), [size, orientation, bottom])
  const layout = useMemo(() => canonicalLayout(size), [size])
  const id = useId().replace(/:/g, '')
  const shown = frame?.board ?? board
  const playableSet = new Set(playable ?? [])

  // ── the seed in the air ──
  const flyer = useRef<SVGGElement>(null)
  const flight = frame?.flight
  useEffect(() => {
    const el = flyer.current
    if (!el || !flight) return
    const a = geo.center(flight.from)
    const b = geo.center(flight.to)
    const lift = Math.min(60, 26 + Math.hypot(b.x - a.x, b.y - a.y) * 0.25)
    const anim = el.animate(
      [
        { transform: `translate(${a.x}px, ${a.y}px) scale(1)`, opacity: 1 },
        { transform: `translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2 - lift}px) scale(1.45)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${b.x}px, ${b.y}px) scale(1)`, opacity: 0.2 },
      ],
      { duration: 150, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' },
    )
    return () => anim.cancel()
  }, [flight, geo])

  const style = {
    '--board-ratio': String(geo.width / geo.height),
    '--board-reserve': `${props.reserve ?? 250}px`,
  } as CSSProperties

  const pathSet = new Set(frame?.path ?? [])
  const active = frame?.active
  const lastCell = lastMove && !frame ? lastMove.side * 8 + lastMove.hole : undefined

  const holeLabel = (cell: number) => {
    const side = ownerOf(size, cell)
    const count = shown[cell]
    const seeds = `${count} ${count === 1 ? 'seed' : 'seeds'}`
    if (side === undefined) return ''
    return `${owners[side]} hole ${(cell & 7) + 1}, ${seeds}`
  }

  return (
    <div
      ref={wrap}
      className={`board board--${orientation}${props.className ? ` ${props.className}` : ''}`}
      style={style}
      role="group"
      aria-label={label}
    >
      <div className="board__frame">
        <svg
          className="board__svg"
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={`${id}teak`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#A2683B" />
              <stop offset="0.5" stopColor="#7E4C2A" />
              <stop offset="1" stopColor="#5E361B" />
            </linearGradient>
            <radialGradient id={`${id}cup`} cx="0.5" cy="0.38" r="0.62">
              <stop offset="0" stopColor="#140B05" />
              <stop offset="0.6" stopColor="#25150A" />
              <stop offset="0.88" stopColor="#3B2312" />
              <stop offset="1" stopColor="#53321A" />
            </radialGradient>
            <linearGradient id={`${id}lip`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3A200E" />
              <stop offset="1" stopColor="#C38B57" />
            </linearGradient>
            <radialGradient id={`${id}seed`} cx="0.36" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#FFFBF1" />
              <stop offset="0.45" stopColor="#EFE4CC" />
              <stop offset="1" stopColor="#C4AF86" />
            </radialGradient>
          </defs>

          {/* The carved body, drawn once in the canonical frame and turned into place. */}
          <g transform={matrix(geo.transform)}>
            <rect
              x="6"
              y="6"
              width={layout.width - 12}
              height={layout.height - 12}
              rx={layout.height / 2 - 6}
              fill={`url(#${id}teak)`}
            />
            {[0.2, 0.33, 0.47, 0.6, 0.74, 0.86].map((f, i) => (
              <path
                key={f}
                d={`M 70 ${layout.height * f} C ${layout.width * 0.3} ${layout.height * f - 7 + i * 2}, ${layout.width * 0.62} ${layout.height * f + 8 - i}, ${layout.width - 70} ${layout.height * f - 2}`}
                fill="none"
                stroke="#3E220F"
                strokeOpacity="0.2"
                strokeWidth="1.4"
              />
            ))}
            <rect
              x="18"
              y="18"
              width={layout.width - 36}
              height={layout.height - 36}
              rx={layout.height / 2 - 18}
              fill="none"
              stroke="#3A1F0D"
              strokeOpacity="0.55"
              strokeWidth="2"
            />
            <Kawung x={layout.width / 2} y={layout.mid} scale={1} />
            {layout.stores.map((s) => (
              <g key={s.cell}>
                <ellipse cx={s.x} cy={s.y} rx={STORE_RX + 4} ry={STORE_RY + 4} fill={`url(#${id}lip)`} opacity="0.85" />
                <ellipse cx={s.x} cy={s.y} rx={STORE_RX} ry={STORE_RY} fill={`url(#${id}cup)`} />
              </g>
            ))}
            {layout.holes.map((h) => (
              <g key={h.cell}>
                <circle cx={h.x} cy={h.y} r={HOLE_R + 3.5} fill={`url(#${id}lip)`} opacity="0.85" />
                <circle cx={h.x} cy={h.y} r={HOLE_R} fill={`url(#${id}cup)`} />
              </g>
            ))}
          </g>

          {/* Marks: what can be played, where the hand is, the path it took. */}
          <g className="board__marks">
            {mover !== undefined &&
              [...playableSet].map((hole) => {
                const c = geo.center(mover * 8 + hole)
                return <circle key={`p${hole}`} className="mark mark--playable" cx={c.x} cy={c.y} r={HOLE_R + 7} />
              })}
            {geo.cells.map((cell) =>
              pathSet.has(cell) && cell !== active ? (
                <PathMark key={`t${cell}`} cell={cell} center={geo.center(cell)} />
              ) : null,
            )}
            {lastCell !== undefined && (
              <circle
                className="mark mark--last"
                cx={geo.center(lastCell).x}
                cy={geo.center(lastCell).y}
                r={HOLE_R + 7}
              />
            )}
            {frame?.capture && (
              <>
                <circle className="mark mark--capture" cx={geo.center(frame.capture.cell).x} cy={geo.center(frame.capture.cell).y} r={HOLE_R + 7} />
                <circle className="mark mark--capture" cx={geo.center(frame.capture.from).x} cy={geo.center(frame.capture.from).y} r={HOLE_R + 7} />
              </>
            )}
            {active !== undefined && <ActiveMark cell={active} center={geo.center(active)} />}
          </g>

          {/* Seeds. */}
          <g className="board__seeds">
            {geo.cells.map((cell) => {
              const c = geo.center(cell)
              const isStore = cell === 7 || cell === 15
              const offsets = isStore ? storeSeedOffsets(cell, shown[cell]) : holeSeedOffsets(cell, shown[cell])
              return offsets.map((o, k) => {
                const v = geo.vector(o.dx, o.dy)
                const x = c.x + v.x
                const y = c.y + v.y
                return (
                  <ellipse
                    key={`${cell}-${k}`}
                    cx={x}
                    cy={y}
                    rx="7.6"
                    ry="5.9"
                    transform={`rotate(${o.rot} ${x} ${y})`}
                    fill={`url(#${id}seed)`}
                    stroke="#7E6A48"
                    strokeWidth="0.7"
                  />
                )
              })
            })}
          </g>

          {/* Counts. */}
          <g className="board__counts">
            {geo.cells.map((cell) => {
              const p = geo.label(cell)
              const isStore = cell === 7 || cell === 15
              const n = shown[cell]
              return isStore ? (
                <g key={`n${cell}`}>
                  <rect x={p.x - 27} y={p.y - 17} width="54" height="34" rx="17" className="count-plate" />
                  <text x={p.x} y={p.y + 1} className="count count--store">
                    {n}
                  </text>
                </g>
              ) : (
                <text key={`n${cell}`} x={p.x} y={p.y + 1} className={`count${n === 0 ? ' count--zero' : ''}`}>
                  {n}
                </text>
              )
            })}
          </g>

          {/* The hand: how many seeds are still to be sown. */}
          {active !== undefined && frame && frame.hand > 0 && <Hand geo={geo} cell={active} count={frame.hand} />}

          <g ref={flyer} className="board__flyer" style={{ opacity: 0 }}>
            {flight && <ellipse cx="0" cy="0" rx="8.5" ry="6.6" fill={`url(#${id}seed)`} stroke="#7E6A48" strokeWidth="0.7" />}
          </g>
        </svg>

        {/* The holes as real buttons, laid over the drawing. */}
        <div className="board__holes">
          {geo.cells
            .filter((cell) => cell !== 7 && cell !== 15)
            .map((cell) => {
              const c = geo.center(cell)
              const side = ownerOf(size, cell)
              const hole = cell & 7
              const canPlay = side !== undefined && side === mover && playableSet.has(hole) && !!onPlay
              const pos: CSSProperties = {
                left: `${((c.x - PITCH / 2) / geo.width) * 100}%`,
                top: `${((c.y - PITCH / 2) / geo.height) * 100}%`,
                width: `${(PITCH / geo.width) * 100}%`,
                height: `${(PITCH / geo.height) * 100}%`,
              }
              return (
                <button
                  key={cell}
                  type="button"
                  className="hole-btn"
                  style={pos}
                  disabled={!canPlay}
                  aria-label={holeLabel(cell)}
                  onClick={() => canPlay && onPlay?.(hole)}
                />
              )
            })}
        </div>
      </div>
      <p className="sr-only">
        {`${owners[0]} store ${shown[storeOf(0)]}, ${owners[1]} store ${shown[storeOf(1)]}. `}
        {`${owners[0]} holes: ${shown.slice(0, size).join(', ')}. ${owners[1]} holes: ${shown.slice(8, 8 + size).join(', ')}.`}
      </p>
    </div>
  )
}

function Kawung({ x, y, scale }: { x: number; y: number; scale: number }) {
  const r = 11 * scale
  const o = 12 * scale
  return (
    <g fill="none" stroke="#3A1F0D" strokeOpacity="0.6" strokeWidth="1.6">
      <ellipse cx={x} cy={y - o} rx={r * 0.55} ry={r} />
      <ellipse cx={x} cy={y + o} rx={r * 0.55} ry={r} />
      <ellipse cx={x - o} cy={y} rx={r} ry={r * 0.55} />
      <ellipse cx={x + o} cy={y} rx={r} ry={r * 0.55} />
      <circle cx={x} cy={y} r={2 * scale} fill="#3A1F0D" fillOpacity="0.6" stroke="none" />
    </g>
  )
}

function PathMark({ cell, center }: { cell: number; center: { x: number; y: number } }) {
  const isStore = cell === 7 || cell === 15
  return isStore ? (
    <circle className="mark mark--path" cx={center.x} cy={center.y} r={30} />
  ) : (
    <circle className="mark mark--path" cx={center.x} cy={center.y} r={HOLE_R + 7} />
  )
}

function ActiveMark({ cell, center }: { cell: number; center: { x: number; y: number } }) {
  const isStore = cell === 7 || cell === 15
  return <circle className="mark mark--active" cx={center.x} cy={center.y} r={isStore ? 34 : HOLE_R + 8} />
}

function Hand({ geo, cell, count }: { geo: ReturnType<typeof geometry>; cell: number; count: number }) {
  const c = geo.center(cell)
  const isStore = cell === 7 || cell === 15
  // Towards the middle of the board, between the rows.
  const v = isStore ? geo.vector(0, -STORE_RY + 22) : geo.vector(0, cell < 8 ? -55 : 55)
  const x = c.x + v.x
  const y = c.y + v.y
  return (
    <g className="hand">
      <circle cx={x} cy={y} r="18" />
      <text x={x} y={y + 1}>
        {count}
      </text>
    </g>
  )
}
