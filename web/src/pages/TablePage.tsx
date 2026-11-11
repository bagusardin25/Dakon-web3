import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Clock,
  FastForward,
  Flag,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Timer,
  X,
} from 'lucide-react'
import type { Address } from 'viem'
import { Board } from '../components/board/Board'
import { useSowing } from '../components/board/useSowing'
import type { QueuedMove } from '../components/board/useSowing'
import { CopyButton, Name, Note, Spinner } from '../components/bits'
import { OpenTableDialog } from '../components/OpenTableDialog'
import type { TablePreset } from '../components/OpenTableDialog'
import { SpeedSwitch } from '../components/PracticeGame'
import { Seat } from '../components/Seat'
import { PACES, paceName, sizeName } from '../config/site'
import { narrate, OUTCOME_TAG } from '../engine/narrate'
import { legalHoles, NORTH, replay, SOUTH } from '../engine/rules'
import type { Board as Cells, ReplayFrame, Side } from '../engine/rules'
import {
  fetchRecentTables,
  fetchTable,
  NotDeployedError,
  prepare,
  REASON,
  RESULT,
  STATUS,
  TableMissingError,
} from '../lib/contract'
import type { Table } from '../lib/contract'
import { describeError } from '../lib/errors'
import { clock, sameAddress, timeAgo } from '../lib/format'
import { useChainNow } from '../lib/chainClock'
import { absoluteUrl, href, navigate } from '../lib/router'
import { PHASE_LABEL, useTx } from '../lib/tx'
import { useDisplayName } from '../lib/store'
import { useAsync, useInterval } from '../lib/useAsync'
import { useWallet } from '../lib/wallet'

const POLL_MS = 2500

export function TablePage({ id }: { id: bigint }) {
  const data = useAsync(`table:${id}`, () => fetchTable(id))
  const live = data.data && (data.data.table.status === STATUS.WAITING || data.data.table.status === STATUS.PLAYING)
  useInterval(data.reload, live ? POLL_MS : null)

  if (!data.data) {
    if (data.error instanceof TableMissingError) {
      return (
        <div className="wrap page">
          <div className="state">
            <h1 className="page__title">No table #{String(id)}</h1>
            <p>Nobody has opened a table with that number yet.</p>
            <a className="btn btn--primary" href={href.lobby}>
              See the open tables
            </a>
          </div>
        </div>
      )
    }
    if (data.error) {
      return (
        <div className="wrap page">
          <div className="state">
            <h1 className="page__title">Could not load table #{String(id)}</h1>
            <p>{describeError(data.error)}</p>
            {!(data.error instanceof NotDeployedError) && (
              <button type="button" className="btn btn--primary" onClick={data.reload}>
                Try again
              </button>
            )}
          </div>
        </div>
      )
    }
    return (
      <div className="wrap page">
        <div className="table-skel" aria-busy="true" aria-label="Loading the table">
          <div className="skeleton" style={{ height: 64 }} />
          <div className="skeleton table-skel__board" />
          <div className="skeleton" style={{ height: 64 }} />
        </div>
      </div>
    )
  }

  return (
    <TableView
      table={data.data.table}
      moves={data.data.moves}
      stale={!!data.error}
      onRetry={data.reload}
    />
  )
}

function TableView({
  table,
  moves,
  stale,
  onRetry,
}: {
  table: Table
  moves: number[]
  stale: boolean
  onRetry: () => void
}) {
  const { active } = useWallet()
  const me = active?.account
  const north = table.north
  const iAmSouth = sameAddress(me, table.south)
  const iAmNorth = sameAddress(me, north)
  const mySide: Side | undefined = iAmSouth ? SOUTH : iAmNorth ? NORTH : undefined
  const bottom: Side = mySide ?? SOUTH
  const top: Side = bottom === SOUTH ? NORTH : SOUTH

  const southName = useDisplayName(table.south)
  const northName = useDisplayName(north)
  const nameOf = (side: Side) => (side === SOUTH ? southName : northName || 'North')
  const owners: [string, string] = [
    mySide === SOUTH ? 'Your' : `${southName}’s`,
    mySide === NORTH ? 'Your' : north ? `${northName}’s` : 'North’s',
  ]

  // The move log, rebuilt with the TypeScript engine; the chain's board is the authority.
  const history = useMemo(() => {
    try {
      return replay(table.size, moves)
    } catch {
      return undefined
    }
  }, [table.size, moves])
  const frames: ReplayFrame[] = useMemo(() => history?.frames ?? [], [history])
  const mismatch = !!history && history.final.board.join() !== table.board.join()

  // ── animation of new moves as they reach the chain ──
  const sowing = useSowing()
  const seen = useRef<number | null>(null)
  const [news, setNews] = useState('')
  useEffect(() => {
    if (seen.current === null) {
      seen.current = frames.length
      return
    }
    if (frames.length > seen.current) {
      const fresh = frames.slice(seen.current)
      sowing.enqueue(fresh.map((f): QueuedMove => ({ before: f.before, side: f.side, hole: f.hole, result: f.result })))
      const lastFrame = fresh[fresh.length - 1]
      setNews(fresh.map((f) => narrate(nameOf(f.side), f.hole, f.result)).join(' '))
      seen.current = frames.length
      void lastFrame
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames])

  // ── replay of a finished game ──
  const finished = table.status === STATUS.FINISHED
  const [cursor, setCursor] = useState<number | null>(null)
  const [autoplay, setAutoplay] = useState(false)
  const inReplay = finished && cursor !== null && cursor < frames.length
  const replayBoard: Cells | undefined =
    cursor === null ? undefined : cursor >= frames.length ? table.board : frames[cursor].before

  function stepTo(next: number, animate: boolean) {
    const target = Math.max(0, Math.min(frames.length, next))
    sowing.skip()
    if (animate && cursor !== null && target === cursor + 1) {
      const f = frames[cursor]
      sowing.enqueue([{ before: f.before, side: f.side, hole: f.hole, result: f.result }])
      setNews(narrate(nameOf(f.side), f.hole, f.result))
    }
    setCursor(target)
  }

  useEffect(() => {
    if (!autoplay || sowing.animating || cursor === null) return
    if (cursor >= frames.length) {
      setAutoplay(false)
      return
    }
    const id = window.setTimeout(() => stepTo(cursor + 1, true), 450)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, sowing.animating, cursor, frames.length])

  // ── moves ──
  const tx = useTx()
  const [pendingHole, setPendingHole] = useState<number | null>(null)
  const playing = table.status === STATUS.PLAYING
  const myTurn = playing && mySide !== undefined && table.turn === mySide
  const canPlay = myTurn && !sowing.animating && !tx.busy && !stale
  const playable = canPlay ? legalHoles(table.board, table.size, mySide!) : tx.busy && pendingHole !== null ? [pendingHole] : []

  async function onPlay(hole: number) {
    if (!canPlay) return
    setPendingHole(hole)
    await tx.run((account) => prepare.play(account, table.id, hole))
    setPendingHole(null)
  }

  const now = useChainNow(playing)
  // Never show more than the pace allows, whatever the clocks say.
  const secondsLeft = Math.min(table.deadline - now, PACES[table.pace]?.seconds ?? Infinity)
  const late = playing && table.deadline > 0 && secondsLeft < 0
  const mover: Side = table.turn

  const displayBoard = sowing.frame?.board ?? replayBoard ?? table.board
  const lastIndex = cursor !== null ? cursor - 1 : frames.length - 1
  const lastMove = lastIndex >= 0 && frames[lastIndex] ? { side: frames[lastIndex].side, hole: frames[lastIndex].hole } : null

  const seatNote = (side: Side): { note?: string; tone?: 'turn' | 'late' } => {
    if (table.status === STATUS.WAITING) return side === NORTH ? { note: 'seat open' } : { note: 'opened the table' }
    if (!playing) {
      if (finished && !inReplay) {
        if (table.result === RESULT.DRAW) return { note: 'drew' }
        const won = (table.result === RESULT.SOUTH) === (side === SOUTH)
        return won ? { note: 'won', tone: 'turn' } : { note: table.reason === REASON.RESIGN ? 'resigned' : table.reason === REASON.TIMEOUT ? 'ran out of time' : 'lost' }
      }
      return {}
    }
    if (side !== mover) return { note: 'waiting' }
    if (late) return { note: 'time is up', tone: 'late' }
    return { note: `to move · ${clock(secondsLeft)} left`, tone: 'turn' }
  }

  const seat = (side: Side) => {
    const address = side === SOUTH ? table.south : north
    const n = seatNote(side)
    return (
      <Seat
        side={side}
        name={address ? <Name address={address} /> : <span className="faint">Waiting for a challenger</span>}
        store={displayBoard[side === SOUTH ? 7 : 15]}
        turn={playing && side === mover}
        note={n.note}
        noteTone={n.tone}
      />
    )
  }

  const [rematchOpen, setRematchOpen] = useState(false)
  const opponent: Address | undefined = mySide === SOUTH ? north : mySide === NORTH ? table.south : undefined
  const rematchPreset: TablePreset = { size: table.size, pace: table.pace, invite: opponent }

  return (
    <div className="wrap page table-page">
      <header className="table-head">
        <div>
          <p className="eyebrow">Table #{String(table.id)}</p>
          <h1 className="table-head__title">
            {north ? (
              <>
                <Name address={table.south} /> <span className="faint">vs</span> <Name address={north} />
              </>
            ) : (
              <>
                <Name address={table.south} />{' '}
                <span className="faint">
                  {table.status === STATUS.CANCELLED ? 'cancelled this table' : 'is waiting'}
                </span>
              </>
            )}
          </h1>
        </div>
        <div className="tags">
          <span className="tag">{sizeName(table.size)}</span>
          <span className="tag">
            <Clock aria-hidden="true" /> {paceName(table.pace)} · {PACES[table.pace]?.limit}
          </span>
          {table.invited && (
            <span className="tag tag--brass">
              <Lock aria-hidden="true" /> Reserved
            </span>
          )}
          <StatusTag table={table} />
        </div>
      </header>

      {stale && (
        <Note
          tone="error"
          actions={
            <button type="button" className="btn btn--line btn--small" onClick={onRetry}>
              Try again
            </button>
          }
        >
          Could not reach the chain just now. The board below is the last one we read.
        </Note>
      )}
      {mismatch && (
        <Note tone="error">
          This browser’s copy of the rules disagrees with the contract about this board. The contract’s board is shown.
        </Note>
      )}

      <div className="table-grid">
        <section className="arena" aria-label="Board">
          {seat(top)}
          <Board
            size={table.size}
            board={replayBoard ?? table.board}
            frame={sowing.frame}
            bottom={bottom}
            owners={owners}
            mover={mySide}
            playable={playable}
            onPlay={onPlay}
            lastMove={lastMove}
            reserve={340}
            label={`Board of table ${table.id}`}
          />
          {seat(bottom)}

          <p className="sr-only" aria-live="polite">
            {news} {myTurn && !sowing.animating ? 'Your move.' : ''}
          </p>

          <TurnLine
            table={table}
            mySide={mySide}
            animating={sowing.animating}
            txLabel={tx.busy ? PHASE_LABEL[tx.state.phase] : undefined}
            txError={tx.state.phase === 'error' ? tx.state.error : undefined}
            late={late}
            moverName={nameOf(mover)}
          />

          <div className="arena__tools">
            <SpeedSwitch />
            <button type="button" className="btn btn--quiet btn--small" onClick={sowing.skip} disabled={!sowing.animating}>
              <FastForward aria-hidden="true" /> Skip
            </button>
          </div>

          {finished && (
            <ReplayBar
              cursor={cursor ?? frames.length}
              total={frames.length}
              autoplay={autoplay}
              onStep={(n, animate) => {
                setAutoplay(false)
                stepTo(n, animate)
              }}
              onToggle={() => {
                if (cursor === null || cursor >= frames.length) {
                  sowing.skip()
                  setCursor(0)
                }
                setAutoplay((a) => !a)
              }}
            />
          )}
        </section>

        <aside className="table-side">
          <Actions
            table={table}
            mySide={mySide}
            late={late}
            onRematch={() => setRematchOpen(true)}
            opponent={opponent}
          />
          <MoveList
            frames={frames}
            nameOf={nameOf}
            current={cursor !== null ? cursor - 1 : frames.length - 1}
            onPick={finished ? (i) => stepTo(i + 1, false) : undefined}
          />
        </aside>
      </div>

      <OpenTableDialog open={rematchOpen} onClose={() => setRematchOpen(false)} preset={rematchPreset} />
    </div>
  )
}

function StatusTag({ table }: { table: Table }) {
  if (table.status === STATUS.WAITING) return <span className="tag tag--brass">Waiting</span>
  if (table.status === STATUS.PLAYING) return <span className="tag tag--live">In play</span>
  if (table.status === STATUS.CANCELLED) return <span className="tag">Cancelled</span>
  return <span className="tag">Finished {timeAgo(table.endedAt)}</span>
}

function TurnLine({
  table,
  mySide,
  animating,
  txLabel,
  txError,
  late,
  moverName,
}: {
  table: Table
  mySide: Side | undefined
  animating: boolean
  txLabel?: string
  txError?: string
  late: boolean
  moverName: string
}) {
  if (txLabel) {
    return (
      <p className="tx-line" role="status">
        <Spinner small /> {txLabel}
      </p>
    )
  }
  if (txError) {
    return (
      <p className="tx-line tx-line--error" role="alert">
        {txError}
      </p>
    )
  }
  if (table.status !== STATUS.PLAYING) return null
  if (animating) return <p className="tx-line">Sowing…</p>
  if (mySide === undefined) {
    return <p className="tx-line">{late ? `${moverName} has run out of time.` : `${moverName} to move.`}</p>
  }
  if (table.turn === mySide) {
    return (
      <p className="tx-line tx-line--turn">
        {late ? 'Your time is up, but you can still move until your opponent claims.' : 'Your move: pick one of the lit holes.'}
      </p>
    )
  }
  return <p className="tx-line">{late ? `${moverName} has run out of time.` : `Waiting for ${moverName}. This page updates by itself.`}</p>
}

function Actions({
  table,
  mySide,
  late,
  onRematch,
  opponent,
}: {
  table: Table
  mySide: Side | undefined
  late: boolean
  onRematch: () => void
  opponent: Address | undefined
}) {
  const { active, openDialog } = useWallet()
  const tx = useTx()
  const [confirmResign, setConfirmResign] = useState(false)
  const invite = absoluteUrl(href.table(table.id))
  const iAmOpener = sameAddress(active?.account, table.south)
  const reservedForMe = !!table.invited && sameAddress(active?.account, table.invited)
  const reservedForOther = !!table.invited && !reservedForMe

  const error = tx.state.phase === 'error' && <Note tone="error">{tx.state.error}</Note>
  const busy = tx.busy && (
    <p className="tx-line" role="status">
      <Spinner small /> {PHASE_LABEL[tx.state.phase]}
    </p>
  )

  if (table.status === STATUS.WAITING) {
    if (iAmOpener) {
      return (
        <div className="panel">
          <h2 className="panel__title">Waiting for a challenger</h2>
          <p className="muted">
            {table.invited ? (
              <>
                The North seat is reserved for <Name address={table.invited} you={false} />. Send them this link.
              </>
            ) : (
              'Your table is listed in the lobby. Send this link to the person you want to play.'
            )}
          </p>
          <code className="wallet-address">{invite}</code>
          <div className="note__actions">
            <CopyButton text={invite} label="Copy invitation" />
            <button
              type="button"
              className="btn btn--danger btn--small"
              disabled={tx.busy}
              onClick={() => void tx.run((account) => prepare.cancelTable(account, table.id))}
            >
              <X aria-hidden="true" /> Cancel table
            </button>
          </div>
          {busy}
          {error}
        </div>
      )
    }
    if (table.invited && !active) {
      return (
        <div className="panel">
          <h2 className="panel__title">This seat is reserved</h2>
          <p className="muted">
            Only <Name address={table.invited} you={false} /> can sit here. If that is your wallet, connect it.
          </p>
          <button type="button" className="btn btn--primary btn--wide" onClick={openDialog}>
            Connect wallet
          </button>
        </div>
      )
    }
    return (
      <div className="panel">
        <h2 className="panel__title">
          {reservedForMe ? 'This seat is reserved for you' : reservedForOther ? 'Reserved for another player' : 'The North seat is open'}
        </h2>
        {reservedForOther ? (
          <p className="muted">
            Only <Name address={table.invited!} you={false} /> can sit here. You can still watch once the game starts.
          </p>
        ) : (
          <>
            <p className="muted">
              Sit down and the game starts at once. You play North and you move first. Each move is one transaction.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--wide"
              disabled={tx.busy}
              onClick={() => (active ? void tx.run((account) => prepare.sit(account, table.id)) : openDialog())}
            >
              {active ? 'Sit down' : 'Connect a wallet to sit'}
            </button>
          </>
        )}
        {busy}
        {error}
      </div>
    )
  }

  if (table.status === STATUS.PLAYING) {
    if (mySide === undefined) {
      return (
        <div className="panel">
          <h2 className="panel__title">Watching</h2>
          <p className="muted">The board follows the chain and plays each move as it lands.</p>
        </div>
      )
    }
    const opponentLate = late && table.turn !== mySide
    return (
      <div className="panel">
        <h2 className="panel__title">Your game</h2>
        {opponentLate && (
          <Note
            actions={
              <button
                type="button"
                className="btn btn--primary btn--small"
                disabled={tx.busy}
                onClick={() => void tx.run((account) => prepare.claimTimeout(account, table.id))}
              >
                <Timer aria-hidden="true" /> Claim the win
              </button>
            }
          >
            Your opponent’s time is up. You may claim the game, or wait for their move.
          </Note>
        )}
        {confirmResign ? (
          <div className="confirm">
            <p>Resign this game? Your opponent is recorded as the winner.</p>
            <div className="note__actions">
              <button
                type="button"
                className="btn btn--danger btn--small"
                disabled={tx.busy}
                onClick={async () => {
                  await tx.run((account) => prepare.resign(account, table.id))
                  setConfirmResign(false)
                }}
              >
                Yes, resign
              </button>
              <button type="button" className="btn btn--quiet btn--small" onClick={() => setConfirmResign(false)}>
                Keep playing
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--line btn--small" onClick={() => setConfirmResign(true)}>
            <Flag aria-hidden="true" /> Resign
          </button>
        )}
        <p className="faint small">Invitation link for spectators:</p>
        <CopyButton text={invite} label="Copy link" />
        {busy}
        {error}
      </div>
    )
  }

  if (table.status === STATUS.CANCELLED) {
    return (
      <div className="panel">
        <h2 className="panel__title">Cancelled</h2>
        <p className="muted">The opener took this table down before anyone sat.</p>
        <a className="btn btn--line btn--small" href={href.lobby}>
          Find another table
        </a>
      </div>
    )
  }

  return <Finished table={table} mySide={mySide} onRematch={onRematch} opponent={opponent} />
}

function Finished({
  table,
  mySide,
  onRematch,
  opponent,
}: {
  table: Table
  mySide: Side | undefined
  onRematch: () => void
  opponent: Address | undefined
}) {
  const s = table.board[7]
  const n = table.board[15]
  const winner = table.result === RESULT.SOUTH ? table.south : table.result === RESULT.NORTH ? table.north : undefined
  const youWon = mySide !== undefined && table.result === (mySide === SOUTH ? RESULT.SOUTH : RESULT.NORTH)
  const how = table.reason === REASON.RESIGN ? 'by resignation' : table.reason === REASON.TIMEOUT ? 'on time' : `${Math.max(s, n)} to ${Math.min(s, n)}`

  // A return game the opponent has already offered.
  const watching = mySide !== undefined && !!opponent
  const offers = useAsync(watching ? `offers:${table.id}` : null, () => fetchRecentTables(100))
  useInterval(offers.reload, watching ? 6000 : null)
  const offer = offers.data?.find(
    (t) =>
      t.status === STATUS.WAITING &&
      t.id > table.id &&
      sameAddress(t.south, opponent) &&
      (!t.invited || sameAddress(t.invited, mySide === SOUTH ? table.south : table.north)),
  )

  return (
    <div className="panel panel--result">
      <p className="eyebrow">Result</p>
      <h2 className="panel__title">
        {table.result === RESULT.DRAW ? (
          `Drawn, ${s} each`
        ) : mySide !== undefined ? (
          youWon ? `You won ${how}` : `You lost ${how}`
        ) : (
          <>
            <Name address={winner!} /> won {how}
          </>
        )}
      </h2>
      <p className="muted">
        Final stores: South {s}, North {n}.{' '}
        {table.moveCount > 0
          ? 'Step through the replay under the board, or pick a move from the list.'
          : 'The game ended before the first move.'}
      </p>
      {offer && (
        <Note
          tone="ok"
          actions={
            <button type="button" className="btn btn--primary btn--small" onClick={() => navigate(href.table(offer.id))}>
              Go to table #{String(offer.id)}
            </button>
          }
        >
          Your opponent has opened a return game.
        </Note>
      )}
      {mySide !== undefined && opponent && (
        <button type="button" className="btn btn--line btn--small" onClick={onRematch}>
          <RotateCcw aria-hidden="true" /> Offer a return game
        </button>
      )}
    </div>
  )
}

function ReplayBar({
  cursor,
  total,
  autoplay,
  onStep,
  onToggle,
}: {
  cursor: number
  total: number
  autoplay: boolean
  onStep: (n: number, animate: boolean) => void
  onToggle: () => void
}) {
  return (
    <div className="replay" role="group" aria-label="Replay">
      <div className="replay__buttons">
        <button type="button" className="icon-btn" onClick={() => onStep(0, false)} disabled={cursor === 0} aria-label="Back to the start">
          <ChevronFirst aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" onClick={() => onStep(cursor - 1, false)} disabled={cursor === 0} aria-label="One move back">
          <ChevronLeft aria-hidden="true" />
        </button>
        <button type="button" className="btn btn--primary btn--small replay__play" onClick={onToggle}>
          {autoplay ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {autoplay ? 'Pause' : cursor >= total ? 'Replay' : 'Play'}
        </button>
        <button type="button" className="icon-btn" onClick={() => onStep(cursor + 1, true)} disabled={cursor >= total} aria-label="One move forward">
          <ChevronRight aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" onClick={() => onStep(total, false)} disabled={cursor >= total} aria-label="To the final position">
          <ChevronLast aria-hidden="true" />
        </button>
      </div>
      <label className="replay__scrub">
        <span className="sr-only">Move</span>
        <input
          type="range"
          min={0}
          max={total}
          value={cursor}
          onChange={(e) => onStep(Number(e.target.value), false)}
        />
        <span className="num faint small">
          {cursor} / {total}
        </span>
      </label>
    </div>
  )
}

function MoveList({
  frames,
  nameOf,
  current,
  onPick,
}: {
  frames: ReplayFrame[]
  nameOf: (side: Side) => string
  current: number
  onPick?: (index: number) => void
}) {
  const list = useRef<HTMLOListElement>(null)
  // Keep the current move in view inside the list, without scrolling the page.
  useEffect(() => {
    const ol = list.current
    const el = ol?.querySelector<HTMLElement>('[data-current="true"]')
    if (!ol || !el) return
    const r = el.getBoundingClientRect()
    const c = ol.getBoundingClientRect()
    if (r.top < c.top) ol.scrollTop -= c.top - r.top
    else if (r.bottom > c.bottom) ol.scrollTop += r.bottom - c.bottom
  }, [current, frames.length])

  return (
    <div className="panel">
      <h2 className="panel__title">
        Moves <span className="faint num">{frames.length}</span>
      </h2>
      {frames.length === 0 ? (
        <p className="muted">No moves yet. North moves first.</p>
      ) : (
        <ol className="moves" ref={list}>
          {frames.map((f, i) => {
            const body = (
              <>
                <span className="moves__n num">{i + 1}</span>
                <span className={`moves__side moves__side--${f.side === SOUTH ? 's' : 'n'}`} aria-hidden="true">
                  {f.side === SOUTH ? 'S' : 'N'}
                </span>
                <span className="moves__text">
                  <span className="sr-only">{nameOf(f.side)}, </span>
                  hole {f.hole + 1} · {f.result.sown} sown
                </span>
                <span className="moves__tag">{OUTCOME_TAG[f.result.outcome]}</span>
              </>
            )
            return (
              <li key={i} data-current={i === current} title={narrate(nameOf(f.side), f.hole, f.result)}>
                {onPick ? (
                  <button type="button" className="moves__row" onClick={() => onPick(i)} aria-current={i === current ? 'step' : undefined}>
                    {body}
                  </button>
                ) : (
                  <span className="moves__row">{body}</span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
