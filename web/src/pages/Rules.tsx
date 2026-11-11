import { useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { Board } from '../components/board/Board'
import { useSowing } from '../components/board/useSowing'
import { narrate } from '../engine/narrate'
import { applyMove, SOUTH } from '../engine/rules'
import type { Board as Cells } from '../engine/rules'
import { href } from '../lib/router'

/** [your holes from your first], your store, [their holes from their first], their store */
const cells = (mine: number[], myStore: number, theirs: number[], theirStore: number): Cells => {
  const pad = (holes: number[]) => [...holes, ...Array(7 - holes.length).fill(0)]
  return [...pad(mine), myStore, ...pad(theirs), theirStore]
}

type Scenario = { id: string; title: string; body: string; board: Cells; hole: number }

const SCENARIOS: Scenario[] = [
  {
    id: 'store',
    title: 'Last seed in your store: move again',
    body: 'Lift every seed from one of your holes and drop them one by one, going clockwise, into the holes that follow and into your own store. If the last one lands in your store, you choose another hole straight away.',
    board: cells([3, 2, 4, 2, 1], 0, [2, 3, 1, 4, 2], 0),
    hole: 3,
  },
  {
    id: 'relay',
    title: 'Last seed on seeds: keep sowing',
    body: 'When the last seed lands in a hole that already had seeds, on either side, lift that whole hole and carry on. This is the relay, beranting, and one move can run round the board several times.',
    board: cells([0, 0, 1, 2, 0], 4, [1, 0, 0, 3, 2], 6),
    hole: 2,
  },
  {
    id: 'capture',
    title: 'Last seed in an empty hole on your side: capture',
    body: 'Your last seed falls into one of your own empty holes. That seed and every seed in the hole straight across go into your store. If the hole across is empty, the seed simply stays. Either way, the turn passes.',
    board: cells([1, 0, 0, 0, 3], 2, [2, 0, 0, 4, 0], 3),
    hole: 0,
  },
  {
    id: 'dead',
    title: 'Last seed in an empty hole across the board: turn over',
    body: 'If the last seed falls into an empty hole on your opponent’s side, nothing more happens. It is their move.',
    board: cells([0, 0, 0, 0, 3], 1, [2, 0, 1, 1, 0], 2),
    hole: 4,
  },
  {
    id: 'skip',
    title: 'Your opponent’s store is skipped',
    body: 'Seeds go into your own store as you pass it, never into your opponent’s. Watch the eight seeds below run past the far store without stopping.',
    board: cells([0, 0, 0, 0, 8], 0, [1, 1, 1, 1, 1], 9),
    hole: 4,
  },
  {
    id: 'end',
    title: 'The end: a side with no seeds to play',
    body: 'The game ends when the player who has to move has no seeds on their side. The seeds still on the other side go into that side’s store, and the fuller store wins. Equal stores are a draw.',
    board: cells([0, 0, 0, 0, 1], 20, [0, 2, 0, 1, 0], 17),
    hole: 4,
  },
]

function Example({ s }: { s: Scenario }) {
  const sowing = useSowing()
  const [done, setDone] = useState(false)
  const result = applyMove(s.board, 5, SOUTH, s.hole)
  const board = done ? result.board : s.board

  function run() {
    if (done) {
      sowing.skip()
      setDone(false)
      return
    }
    sowing.enqueue([{ before: s.board, side: SOUTH, hole: s.hole, result }])
    setDone(true)
  }

  return (
    <article className="example" aria-labelledby={`ex-${s.id}`}>
      <div className="example__text">
        <h3 id={`ex-${s.id}`}>{s.title}</h3>
        <p className="muted">{s.body}</p>
        <button type="button" className="btn btn--line btn--small" onClick={run}>
          {done ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}
          {done ? 'Set it up again' : `Sow from hole ${s.hole + 1}`}
        </button>
        <p className="example__result" aria-live="polite">
          {done && !sowing.animating ? narrate('You', s.hole, result) : ''}
        </p>
      </div>
      <Board
        size={5}
        board={board}
        frame={sowing.frame}
        bottom={SOUTH}
        owners={['Your', 'Their']}
        mover={SOUTH}
        playable={done ? [] : [s.hole]}
        onPlay={() => run()}
        reserve={420}
        label={`Example: ${s.title}`}
      />
    </article>
  )
}

export function Rules() {
  return (
    <div className="wrap page rules">
      <header className="page__head">
        <p className="eyebrow">How to play</p>
        <h1 className="page__title">Congklak in six pictures</h1>
        <p className="muted rules__lede">
          Dakon plays one round of congklak. The contract on BOT Chain and the board in your browser follow exactly the
          rules on this page. Every example below is a small board you can sow yourself: press the lit hole.
        </p>
      </header>

      <section className="rules__facts" aria-label="The board">
        <div>
          <h2>The board</h2>
          <p className="muted">
            Two rows of holes and a store at each end. Your row is the one nearest you, your store is on your left,
            and sowing runs clockwise.
          </p>
        </div>
        <dl className="facts">
          <div>
            <dt>Ringkas</dt>
            <dd>5 holes a side, 5 seeds in each, 50 in all</dd>
          </div>
          <div>
            <dt>Klasik</dt>
            <dd>7 holes a side, 7 seeds in each, 98 in all</dd>
          </div>
          <div>
            <dt>Who starts</dt>
            <dd>The challenger, who sits North. The opener chose the board and the pace.</dd>
          </div>
        </dl>
      </section>

      <div className="examples">
        {SCENARIOS.map((s) => (
          <Example key={s.id} s={s} />
        ))}
      </div>

      <section className="rules__facts" aria-label="Time">
        <div>
          <h2>Time and walking away</h2>
          <p className="muted">
            The opener picks a pace, a limit for each move. If the player to move lets it run out, the other player may
            claim the game; until they do, a late move still counts. Either player may resign at any time, and an
            opener may cancel a table nobody has sat at.
          </p>
        </div>
        <dl className="facts">
          <div>
            <dt>Kilat</dt>
            <dd>3 minutes a move</dd>
          </div>
          <div>
            <dt>Biasa</dt>
            <dd>1 hour a move</dd>
          </div>
          <div>
            <dt>Santai</dt>
            <dd>24 hours a move</dd>
          </div>
        </dl>
      </section>

      <section className="rules__facts" aria-label="Variant">
        <div>
          <h2>Which congklak?</h2>
          <p className="muted">
            Rules differ from village to village. Dakon plays a single round, without burnt holes, and the hole a move
            starts from is sown into again when the seeds come round. One more rule keeps every move affordable: a move
            stops after 1,200 seeds, a length no real game has come near.
          </p>
        </div>
        <div className="rules__cta">
          <a className="btn btn--primary" href={href.practice}>
            Practise against the computer
          </a>
          <a className="btn btn--line" href={href.lobby}>
            Find an opponent
          </a>
        </div>
      </section>
    </div>
  )
}
