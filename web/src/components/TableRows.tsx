import { Clock, Lock } from 'lucide-react'
import { paceName, sizeName } from '../config/site'
import { REASON, RESULT, STATUS, prepare } from '../lib/contract'
import type { Table } from '../lib/contract'
import { clock, sameAddress, timeAgo } from '../lib/format'
import { useChainNow } from '../lib/chainClock'
import { href, navigate } from '../lib/router'
import { useTx } from '../lib/tx'
import { useWallet } from '../lib/wallet'
import { Name, Spinner } from './bits'

export function TableRows({ tables, label }: { tables: Table[]; label: string }) {
  return (
    <ul className="rows" aria-label={label}>
      {tables.map((t) => (
        <TableRow key={String(t.id)} table={t} />
      ))}
    </ul>
  )
}

function SitButton({ table }: { table: Table }) {
  const { active } = useWallet()
  const tx = useTx()
  const mine = sameAddress(active?.account, table.south)
  const reservedForOther = !!table.invited && !!active && !sameAddress(active.account, table.invited)
  if (mine) {
    return (
      <a className="btn btn--line btn--small" href={href.table(table.id)}>
        Your table
      </a>
    )
  }
  if (reservedForOther) {
    return (
      <a className="btn btn--quiet btn--small" href={href.table(table.id)}>
        View
      </a>
    )
  }
  return (
    <span className="row__aside">
      {tx.state.phase === 'error' && (
        <span className="field__error" role="alert">
          {tx.state.error}
        </span>
      )}
      <button
        type="button"
        className="btn btn--primary btn--small"
        disabled={tx.busy}
        onClick={async () => {
          const sent = await tx.run((account) => prepare.sit(account, table.id))
          if (sent) navigate(href.table(table.id))
        }}
      >
        {tx.busy && <Spinner small />}
        Sit down
      </button>
    </span>
  )
}

function TableRow({ table: t }: { table: Table }) {
  const now = useChainNow(t.status === STATUS.PLAYING)
  const { active } = useWallet()
  const link = href.table(t.id)
  const tags = (
    <span className="tags">
      <span className="tag">{sizeName(t.size)}</span>
      <span className="tag">
        <Clock aria-hidden="true" />
        {paceName(t.pace)}
      </span>
      {t.invited && (
        <span className="tag tag--brass">
          <Lock aria-hidden="true" />
          {sameAddress(active?.account, t.invited) ? 'Reserved for you' : 'Reserved'}
        </span>
      )}
    </span>
  )

  if (t.status === STATUS.WAITING) {
    return (
      <li className="row">
        <span className="row__id">#{String(t.id)}</span>
        <span className="row__main">
          <a className="row__title" href={link}>
            <Name address={t.south} /> <span className="faint">waits for a challenger</span>
          </a>
          <span className="tags">
            {tags}
            <span className="faint small">opened {timeAgo(t.createdAt)}</span>
          </span>
        </span>
        <SitButton table={t} />
      </li>
    )
  }

  const southStore = t.board[7]
  const northStore = t.board[15]
  const north = t.north!

  if (t.status === STATUS.PLAYING) {
    const mover = t.turn === 0 ? t.south : north
    const yourTurn = sameAddress(active?.account, mover)
    const late = t.deadline > 0 && now > t.deadline
    return (
      <li className="row">
        <span className="row__id">#{String(t.id)}</span>
        <span className="row__main">
          <a className="row__title" href={link}>
            <Name address={t.south} /> <span className="faint">vs</span> <Name address={north} />
          </a>
          <span className="tags">
            {tags}
            {yourTurn ? (
              <span className="tag tag--live">Your move</span>
            ) : (
              <span className="faint small">
                {late ? 'time is up for ' : 'to move: '}
                <Name address={mover} you={false} />
                {!late && t.deadline > 0 && ` · ${clock(t.deadline - now)} left`}
              </span>
            )}
          </span>
        </span>
        <span className="row__aside">
          <span className="row__score" aria-label={`Stores ${southStore} to ${northStore}`}>
            {southStore}–{northStore}
          </span>
          <a className="btn btn--line btn--small" href={link}>
            {yourTurn ? 'Play' : 'Watch'}
          </a>
        </span>
      </li>
    )
  }

  if (t.status === STATUS.CANCELLED) {
    return (
      <li className="row">
        <span className="row__id">#{String(t.id)}</span>
        <span className="row__main">
          <a className="row__title" href={link}>
            <Name address={t.south} /> <span className="faint">cancelled this table</span>
          </a>
          {tags}
        </span>
        <span className="faint small">{timeAgo(t.endedAt)}</span>
      </li>
    )
  }

  const outcome =
    t.result === RESULT.DRAW ? (
      <>Drawn</>
    ) : (
      <>
        <Name address={t.result === RESULT.SOUTH ? t.south : north} you={false} /> won
        {t.reason === REASON.RESIGN ? ' by resignation' : t.reason === REASON.TIMEOUT ? ' on time' : ''}
      </>
    )
  return (
    <li className="row">
      <span className="row__id">#{String(t.id)}</span>
      <span className="row__main">
        <a className="row__title" href={link}>
          <Name address={t.south} /> <span className="faint">vs</span> <Name address={north} />
        </a>
        <span className="tags">
          {tags}
          <span className="faint small">
            {outcome} · {timeAgo(t.endedAt)}
          </span>
        </span>
      </span>
      <span className="row__aside">
        <span className="row__score" aria-label={`Final stores ${southStore} to ${northStore}`}>
          {southStore}–{northStore}
        </span>
        <a className="btn btn--line btn--small" href={link}>
          Replay
        </a>
      </span>
    </li>
  )
}
