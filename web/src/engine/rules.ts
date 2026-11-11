// Congklak rules for Dakon, single-round variant (PRD section 5).
//
// This file is the TypeScript twin of contracts/contracts/Dakon.sol. The contract is the
// referee; this engine drives animation, practice mode and replays. A differential test in
// contracts/test plays hundreds of random games through both and requires identical boards
// after every move, so any change here must be made in the contract too.
//
// No imports and no runtime dependencies: the contract test loads this file directly.

/** 0 = South (the table opener), 1 = North (the challenger, who moves first). */
export type Side = 0 | 1
export const SOUTH: Side = 0
export const NORTH: Side = 1

export type Size = 5 | 7
export const SIZES: readonly Size[] = [5, 7]

/**
 * Sixteen cells, the same layout the contract packs into one storage slot:
 *   0..6   South holes (only 0..size-1 are used)
 *   7      South store
 *   8..14  North holes (only 8..8+size-1 are used)
 *   15     North store
 */
export type Board = number[]
export const CELLS = 16

/** Sowing stops after this many seeds in one move, so no move can run out of gas. */
export const MAX_SOWN = 1200

export const other = (side: Side): Side => (side === SOUTH ? NORTH : SOUTH)
export const storeOf = (side: Side): number => side * 8 + 7
export const cellOf = (side: Side, hole: number): number => side * 8 + hole

/** The hole across the board. South hole i faces North hole size-1-i, and vice versa. */
export const opposite = (size: Size, cell: number): number => size + 7 - cell

/** Which side a hole belongs to, or undefined for a store or an unused cell. */
export function ownerOf(size: Size, cell: number): Side | undefined {
  if (cell < size) return SOUTH
  if (cell >= 8 && cell < 8 + size) return NORTH
  return undefined
}

/** The hole number (0-based, within its side) of a hole cell. */
export const holeOf = (cell: number): number => cell & 7

export const isStore = (cell: number): boolean => cell === 7 || cell === 15

/**
 * The next cell in sowing order: South holes, South store, North holes, North store, round again.
 * The mover's opponent's store is skipped by the caller.
 */
export function nextCell(size: Size, cell: number): number {
  if (cell === 15) return 0
  if (cell === size - 1) return 7
  if (cell === 7) return 8
  if (cell === 7 + size) return 15
  return cell + 1
}

export function initialBoard(size: Size): Board {
  const board = new Array<number>(CELLS).fill(0)
  for (let i = 0; i < size; i++) {
    board[i] = size
    board[8 + i] = size
  }
  return board
}

export function seedsOnSide(board: Board, size: Size, side: Side): number {
  let total = 0
  for (let i = 0; i < size; i++) total += board[side * 8 + i]
  return total
}

export function legalHoles(board: Board, size: Size, side: Side): number[] {
  const out: number[] = []
  for (let i = 0; i < size; i++) if (board[side * 8 + i] > 0) out.push(i)
  return out
}

/** How the move ended. */
export type Outcome =
  | 'extra' // last seed in own store: move again
  | 'capture' // last seed in an empty own hole, opposite hole had seeds
  | 'rest' // last seed in an empty own hole, opposite hole empty: the seed stays
  | 'dead' // last seed in an empty hole on the opponent's side
  | 'limit' // the sowing limit was reached; the move ends where it stands

/** One visible event in a move, in order, for animation and narration. */
export type Step =
  | { kind: 'lift'; cell: number; count: number; relay: boolean }
  | { kind: 'drop'; cell: number }
  | { kind: 'capture'; cell: number; from: number; seeds: number }
  | { kind: 'sweep'; side: Side; seeds: number }

export type MoveResult = {
  board: Board
  /** Whose move it is next. When the game ended this is the side that would have moved. */
  next: Side
  ended: boolean
  outcome: Outcome
  /** Seeds dropped, counting every relay. */
  sown: number
  /** Number of relays (pick-ups from a hole after the first). */
  relays: number
  steps: Step[]
}

export class IllegalMove extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IllegalMove'
  }
}

/**
 * Plays one move. Throws IllegalMove for a hole outside the board or an empty hole.
 * The input board is not modified.
 */
export function applyMove(input: Board, size: Size, side: Side, hole: number, withSteps = true): MoveResult {
  if (!Number.isInteger(hole) || hole < 0 || hole >= size) throw new IllegalMove(`Hole ${hole} is not on the board.`)
  const board = input.slice()
  const steps: Step[] = []
  const own = storeOf(side)
  const skip = storeOf(other(side))

  let cell = cellOf(side, hole)
  let hand = board[cell]
  if (hand === 0) throw new IllegalMove(`Hole ${hole} is empty.`)
  board[cell] = 0
  if (withSteps) steps.push({ kind: 'lift', cell, count: hand, relay: false })

  let sown = 0
  let relays = 0
  let outcome: Outcome

  for (;;) {
    while (hand > 0) {
      cell = nextCell(size, cell)
      if (cell === skip) cell = nextCell(size, cell)
      board[cell] += 1
      hand -= 1
      sown += 1
      if (withSteps) steps.push({ kind: 'drop', cell })
    }

    if (cell === own) {
      outcome = 'extra'
      break
    }
    if (board[cell] > 1) {
      if (sown >= MAX_SOWN) {
        outcome = 'limit'
        break
      }
      hand = board[cell]
      board[cell] = 0
      relays += 1
      if (withSteps) steps.push({ kind: 'lift', cell, count: hand, relay: true })
      continue
    }
    // The last seed fell into a hole that was empty.
    if (ownerOf(size, cell) === side) {
      const across = opposite(size, cell)
      const taken = board[across]
      if (taken > 0) {
        board[own] += taken + 1
        board[across] = 0
        board[cell] = 0
        outcome = 'capture'
        if (withSteps) steps.push({ kind: 'capture', cell, from: across, seeds: taken + 1 })
      } else {
        outcome = 'rest'
      }
    } else {
      outcome = 'dead'
    }
    break
  }

  const next: Side = outcome === 'extra' ? side : other(side)
  let ended = false
  if (seedsOnSide(board, size, next) === 0) {
    // The side to move has nothing to play: the game ends and the other side keeps its seeds.
    ended = true
    const rest = other(next)
    let swept = 0
    for (let i = 0; i < size; i++) {
      swept += board[rest * 8 + i]
      board[rest * 8 + i] = 0
    }
    board[storeOf(rest)] += swept
    if (withSteps && swept > 0) steps.push({ kind: 'sweep', side: rest, seeds: swept })
  }

  return { board, next, ended, outcome, sown, relays, steps }
}

/** 1 = South won, 2 = North won, 3 = draw. Same codes as the contract. */
export type Winner = 1 | 2 | 3
export const RESULT_SOUTH: Winner = 1
export const RESULT_NORTH: Winner = 2
export const RESULT_DRAW: Winner = 3

export function winnerOf(board: Board): Winner {
  if (board[7] > board[15]) return RESULT_SOUTH
  if (board[15] > board[7]) return RESULT_NORTH
  return RESULT_DRAW
}

// ───────────────────────────── Games and move logs ─────────────────────────────

/** One byte per move, as the contract stores it: bit 7 set when North moved, low bits the hole. */
export const encodeMove = (side: Side, hole: number): number => (side === NORTH ? 0x80 : 0) | hole
export const decodeMove = (byte: number): { side: Side; hole: number } => ({
  side: byte & 0x80 ? NORTH : SOUTH,
  hole: byte & 0x7f,
})

export type GameState = {
  size: Size
  board: Board
  turn: Side
  ended: boolean
  /** Encoded moves, oldest first. */
  moves: number[]
}

export function newGame(size: Size): GameState {
  return { size, board: initialBoard(size), turn: NORTH, ended: false, moves: [] }
}

export function playMove(game: GameState, hole: number): { game: GameState; result: MoveResult } {
  if (game.ended) throw new IllegalMove('The game is over.')
  const result = applyMove(game.board, game.size, game.turn, hole)
  return {
    result,
    game: {
      size: game.size,
      board: result.board,
      turn: result.next,
      ended: result.ended,
      moves: [...game.moves, encodeMove(game.turn, hole)],
    },
  }
}

export type ReplayFrame = {
  /** Board before this move. */
  before: Board
  side: Side
  hole: number
  result: MoveResult
}

/**
 * Rebuilds a game from its move log. Every move is checked against the side that should
 * be moving, so a log that does not follow the rules throws instead of drawing nonsense.
 */
export function replay(size: Size, moves: readonly number[]): { frames: ReplayFrame[]; final: GameState } {
  let game = newGame(size)
  const frames: ReplayFrame[] = []
  for (const byte of moves) {
    const { side, hole } = decodeMove(byte)
    if (side !== game.turn) throw new IllegalMove('The move log does not follow the turn order.')
    const before = game.board
    const step = playMove(game, hole)
    frames.push({ before, side, hole, result: step.result })
    game = step.game
  }
  return { frames, final: game }
}

// ───────────────────────────── Packing ─────────────────────────────

/** The contract keeps the board as sixteen bytes in one uint256, cell i in bits 8i..8i+7. */
export function packBoard(board: Board): bigint {
  let packed = 0n
  for (let i = CELLS - 1; i >= 0; i--) packed = (packed << 8n) | BigInt(board[i] & 0xff)
  return packed
}

export function unpackBoard(packed: bigint): Board {
  const board = new Array<number>(CELLS)
  for (let i = 0; i < CELLS; i++) board[i] = Number((packed >> BigInt(8 * i)) & 0xffn)
  return board
}
