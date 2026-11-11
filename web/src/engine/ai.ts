// The practice opponent. It looks one move ahead: every legal hole is tried, and the move that
// leaves its store furthest ahead of yours wins, with a small bonus for earning another turn.
// Ties are broken at random so practice games do not repeat.
import { applyMove, legalHoles, other, storeOf } from './rules.ts'
import type { Board, Side, Size } from './rules.ts'

export type Choice = { hole: number; score: number }

export function scoreMoves(board: Board, size: Size, side: Side): Choice[] {
  const mine = storeOf(side)
  const theirs = storeOf(other(side))
  const lead = board[mine] - board[theirs]
  return legalHoles(board, size, side).map((hole) => {
    const r = applyMove(board, size, side, hole, false)
    let score = r.board[mine] - r.board[theirs] - lead
    if (r.outcome === 'extra' && !r.ended) score += 1.5
    if (r.ended) score += r.board[mine] > r.board[theirs] ? 100 : r.board[mine] < r.board[theirs] ? -100 : 0
    return { hole, score }
  })
}

export function chooseMove(board: Board, size: Size, side: Side, random: () => number = Math.random): number {
  const choices = scoreMoves(board, size, side)
  if (choices.length === 0) throw new Error('No legal move.')
  const best = Math.max(...choices.map((c) => c.score))
  const top = choices.filter((c) => c.score >= best - 1e-9)
  return top[Math.floor(random() * top.length)].hole
}
