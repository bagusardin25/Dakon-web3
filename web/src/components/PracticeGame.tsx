import { useEffect, useRef, useState } from 'react'
import { FastForward, RotateCcw } from 'lucide-react'
import { chooseMove } from '../engine/ai'
import { narrate } from '../engine/narrate'
import { legalHoles, newGame, NORTH, playMove, SOUTH, winnerOf } from '../engine/rules'
import type { GameState, Side, Size } from '../engine/rules'
import { setSpeed, useSpeed } from '../lib/prefs'
import { Board } from './board/Board'
import { useSowing } from './board/useSowing'
import { Seat } from './Seat'

const YOU: Side = NORTH
const COMPUTER: Side = SOUTH

export function SpeedSwitch() {
  const speed = useSpeed()
  return (
    <span className="seg" role="group" aria-label="Sowing speed">
      <button type="button" aria-pressed={speed === 'calm'} onClick={() => setSpeed('calm')}>
        Calm
      </button>
      <button type="button" aria-pressed={speed === 'quick'} onClick={() => setSpeed('quick')}>
        Quick
      </button>
    </span>
  )
}

export function PracticeGame({
  initialSize = 5,
  onYourMove,
  reserve,
  showSizePicker = true,
}: {
  initialSize?: Size
  /** Called with the number of moves you have made, after each of them. */
  onYourMove?: (count: number) => void
  reserve?: number
  showSizePicker?: boolean
}) {
  const [size, setSize] = useState<Size>(initialSize)
  const [game, setGame] = useState<GameState>(() => newGame(initialSize))
  const [last, setLast] = useState<{ side: Side; hole: number } | null>(null)
  const [news, setNews] = useState('Your move. You sit North, nearest to you, and move first.')
  const yourMoves = useRef(0)
  const sowing = useSowing()
  const { frame, animating } = sowing

  function play(side: Side, hole: number) {
    const step = playMove(game, hole)
    sowing.enqueue([{ before: game.board, side, hole, result: step.result }])
    setGame(step.game)
    setLast({ side, hole })
    const who = side === YOU ? 'You' : 'The computer'
    let line = narrate(who, hole, step.result)
    if (!step.game.ended) line += step.game.turn === YOU ? ' Your move.' : ' The computer is thinking.'
    setNews(line)
    if (side === YOU) {
      yourMoves.current += 1
      onYourMove?.(yourMoves.current)
    }
  }

  // The computer moves once the board has settled.
  useEffect(() => {
    if (animating || game.ended || game.turn !== COMPUTER) return
    const id = window.setTimeout(() => play(COMPUTER, chooseMove(game.board, game.size, COMPUTER)), 550)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animating, game])

  function restart(nextSize: Size = size) {
    sowing.skip()
    setSize(nextSize)
    setGame(newGame(nextSize))
    setLast(null)
    setNews('New game. Your move.')
  }

  const yourTurn = !animating && !game.ended && game.turn === YOU
  const playable = yourTurn ? legalHoles(game.board, size, YOU) : []
  const shown = frame?.board ?? game.board
  const finished = game.ended && !animating
  const winner = winnerOf(game.board)
  const yourStore = game.board[15]
  const theirStore = game.board[7]

  return (
    <div className="arena">
      <Seat
        side={COMPUTER}
        name="Computer"
        store={shown[7]}
        turn={!game.ended && game.turn === COMPUTER}
        note={!game.ended && game.turn === COMPUTER ? 'thinking' : 'looks one move ahead'}
        noteTone={!game.ended && game.turn === COMPUTER ? 'turn' : undefined}
      />
      <Board
        size={size}
        board={game.board}
        frame={frame}
        bottom={YOU}
        owners={['Computer’s', 'Your']}
        mover={YOU}
        playable={playable}
        onPlay={(hole) => yourTurn && play(YOU, hole)}
        lastMove={last}
        reserve={reserve}
        label="Practice board"
      />
      <Seat
        side={YOU}
        name="You"
        store={shown[15]}
        turn={!game.ended && game.turn === YOU}
        note={yourTurn ? 'your move, pick a lit hole' : undefined}
        noteTone={yourTurn ? 'turn' : undefined}
      />

      <p className="sr-only" aria-live="polite">
        {animating ? '' : news}
      </p>

      {finished ? (
        <div className="result" role="status">
          <p className="result__title">
            {winner === 3
              ? `A draw, ${yourStore} each.`
              : winner === 2
                ? `You won, ${yourStore} to ${theirStore}.`
                : `The computer won, ${theirStore} to ${yourStore}.`}
          </p>
          <div className="result__actions">
            <button type="button" className="btn btn--primary" onClick={() => restart()}>
              <RotateCcw aria-hidden="true" /> Play again
            </button>
          </div>
        </div>
      ) : (
        <div className="sow-bar">
          <span className="sow-bar__news" aria-hidden="true">
            {animating ? 'Sowing…' : news}
          </span>
        </div>
      )}

      <div className="arena__tools">
        {showSizePicker && (
          <span className="seg" role="group" aria-label="Board size">
            <button type="button" aria-pressed={size === 5} onClick={() => size !== 5 && restart(5)}>
              Ringkas · 5
            </button>
            <button type="button" aria-pressed={size === 7} onClick={() => size !== 7 && restart(7)}>
              Klasik · 7
            </button>
          </span>
        )}
        <SpeedSwitch />
        <button type="button" className="btn btn--quiet btn--small" onClick={sowing.skip} disabled={!animating}>
          <FastForward aria-hidden="true" /> Skip
        </button>
        <button type="button" className="btn btn--quiet btn--small" onClick={() => restart()}>
          <RotateCcw aria-hidden="true" /> New game
        </button>
      </div>
    </div>
  )
}
