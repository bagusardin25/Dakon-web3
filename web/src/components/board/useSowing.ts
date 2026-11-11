import { useCallback, useEffect, useRef, useState } from 'react'
import { storeOf } from '../../engine/rules'
import type { Board, MoveResult, Side } from '../../engine/rules'
import { useReducedMotion, useSpeed } from '../../lib/prefs'

/** What the board shows at one instant of a sowing animation. */
export type SowFrame = {
  board: Board
  mover: Side
  /** The cell the hand is over. */
  active?: number
  /** Seeds still in the hand. */
  hand: number
  /** Cells visited so far in this move, in order. */
  path: number[]
  capture?: { cell: number; from: number }
  /** A seed in the air, for the hop animation. `key` changes with every hop. */
  flight?: { from: number; to: number; key: number }
}

export type QueuedMove = { before: Board; side: Side; hole: number; result: MoveResult }

const TIMING = {
  calm: { lift: 300, drop: 175, capture: 560, sweep: 650, settle: 350 },
  quick: { lift: 110, drop: 60, capture: 260, sweep: 320, settle: 150 },
}

/**
 * Plays moves back seed by seed. Moves queue up, so an opponent's double move (an extra turn)
 * plays in order. With reduced motion the seeds do not hop: the final board appears with the
 * sowing path outlined instead. skip() drops everything queued; moves queued after it play.
 */
export function useSowing() {
  const reduced = useReducedMotion()
  const speed = useSpeed()
  const [frame, setFrame] = useState<SowFrame | null>(null)
  const queue = useRef<(QueuedMove & { gen: number })[]>([])
  const running = useRef(false)
  const generation = useRef(0)
  const wake = useRef<(() => void) | null>(null)
  const alive = useRef(true)
  const settings = useRef({ reduced, speed })
  useEffect(() => {
    settings.current = { reduced, speed }
  })

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      wake.current?.()
    }
  }, [])

  const sleep = useCallback(
    (ms: number, gen: number) =>
      new Promise<void>((resolve) => {
        if (gen !== generation.current || !alive.current) return resolve()
        const id = window.setTimeout(() => {
          wake.current = null
          resolve()
        }, ms)
        wake.current = () => {
          window.clearTimeout(id)
          wake.current = null
          resolve()
        }
      }),
    [],
  )

  const animate = useCallback(
    async (move: QueuedMove, gen: number) => {
      const stale = () => gen !== generation.current || !alive.current
      const { reduced: still, speed: pace } = settings.current
      const t = TIMING[pace]
      const { result, side } = move
      const path: number[] = []

      if (still) {
        for (const step of result.steps) if (step.kind === 'drop' || step.kind === 'lift') path.push(step.cell)
        setFrame({ board: result.board, mover: side, hand: 0, path: [...new Set(path)] })
        await sleep(1400, gen)
        return
      }

      const b = move.before.slice()
      let active: number | undefined
      let hand = 0
      let hop = 0
      for (const step of result.steps) {
        if (stale()) return
        if (step.kind === 'lift') {
          b[step.cell] = 0
          hand = step.count
          active = step.cell
          path.push(step.cell)
          setFrame({ board: b.slice(), mover: side, active, hand, path: path.slice() })
          await sleep(t.lift, gen)
        } else if (step.kind === 'drop') {
          const from = active ?? step.cell
          b[step.cell] += 1
          hand -= 1
          active = step.cell
          path.push(step.cell)
          hop += 1
          setFrame({
            board: b.slice(),
            mover: side,
            active,
            hand,
            path: path.slice(),
            flight: { from, to: step.cell, key: hop },
          })
          await sleep(t.drop, gen)
        } else if (step.kind === 'capture') {
          setFrame({ board: b.slice(), mover: side, active, hand: 0, path: path.slice(), capture: step })
          await sleep(t.capture, gen)
          b[step.from] = 0
          b[step.cell] = 0
          b[storeOf(side)] += step.seeds
          setFrame({ board: b.slice(), mover: side, active: storeOf(side), hand: 0, path: path.slice() })
          await sleep(t.drop * 2, gen)
        } else {
          for (let i = 0; i < 7; i++) b[step.side * 8 + i] = 0
          b[storeOf(step.side)] += step.seeds
          setFrame({ board: b.slice(), mover: side, active: storeOf(step.side), hand: 0, path: path.slice() })
          await sleep(t.sweep, gen)
        }
      }
      if (stale()) return
      setFrame({ board: result.board, mover: side, hand: 0, path: path.slice() })
      await sleep(t.settle, gen)
    },
    [sleep],
  )

  const drain = useCallback(async () => {
    if (running.current) return
    running.current = true
    while (queue.current.length > 0 && alive.current) {
      const move = queue.current.shift()!
      if (move.gen !== generation.current) continue
      await animate(move, move.gen)
    }
    running.current = false
    if (alive.current) setFrame(null)
  }, [animate])

  const enqueue = useCallback(
    (moves: QueuedMove[]) => {
      if (moves.length === 0) return
      queue.current.push(...moves.map((m) => ({ ...m, gen: generation.current })))
      void drain()
    },
    [drain],
  )

  /** Jumps past everything queued so far. */
  const skip = useCallback(() => {
    generation.current += 1
    queue.current = []
    wake.current?.()
  }, [])

  return { frame, animating: frame !== null, enqueue, skip }
}
