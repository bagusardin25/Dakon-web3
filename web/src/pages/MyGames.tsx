import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import type { Address } from 'viem'
import { Note, Spinner } from '../components/bits'
import { OpenTableDialog } from '../components/OpenTableDialog'
import { TableRows } from '../components/TableRows'
import { NICKNAME_MAX_BYTES } from '../config/site'
import { fetchPlayer, fetchRecentTables, fetchTablesOf, isDeployed, prepare, STATUS } from '../lib/contract'
import type { Table } from '../lib/contract'
import { describeError } from '../lib/errors'
import { byteLength, sameAddress } from '../lib/format'
import { rememberNickname } from '../lib/store'
import { PHASE_LABEL, useTx } from '../lib/tx'
import { useAsync } from '../lib/useAsync'
import { useWallet } from '../lib/wallet'

export function MyGames() {
  const { active, openDialog } = useWallet()
  if (!isDeployed()) {
    return (
      <div className="wrap page">
        <header className="page__head">
          <h1 className="page__title">My games</h1>
        </header>
        <Note>Your games appear here once Dakon is deployed on this network.</Note>
      </div>
    )
  }
  if (!active) {
    return (
      <div className="wrap page">
        <div className="state">
          <h1 className="page__title">My games</h1>
          <p>Connect a wallet to see the games waiting for your move, your open tables and your record.</p>
          <button type="button" className="btn btn--primary" onClick={openDialog}>
            Connect wallet
          </button>
        </div>
      </div>
    )
  }
  return <Mine key={active.account} account={active.account} />
}

function Mine({ account }: { account: Address }) {
  const tables = useAsync(`mine:${account}`, () => fetchTablesOf(account))
  const recent = useAsync(`invites:${account}`, () => fetchRecentTables(200))
  const player = useAsync(`player:${account}`, () => fetchPlayer(account))
  const [openTable, setOpenTable] = useState(false)

  const mine = tables.data ?? []
  const side = (t: Table) => (sameAddress(t.south, account) ? 0 : 1)
  const yourMove = mine.filter((t) => t.status === STATUS.PLAYING && t.turn === side(t))
  const theirMove = mine.filter((t) => t.status === STATUS.PLAYING && t.turn !== side(t))
  const waiting = mine.filter((t) => t.status === STATUS.WAITING)
  const history = mine.filter((t) => t.status === STATUS.FINISHED || t.status === STATUS.CANCELLED)
  const invites = (recent.data ?? []).filter((t) => t.status === STATUS.WAITING && sameAddress(t.invited, account))

  const p = player.data

  return (
    <div className="wrap page me">
      <header className="page__head me__head">
        <div>
          <p className="eyebrow">My games</p>
          <h1 className="page__title">{p?.nickname || 'Your tables'}</h1>
          {p && (
            <p className="muted num">
              {p.wins} won · {p.losses} lost · {p.draws} drawn
              {p.bestStore > 0 && ` · best store ${p.bestStore}`}
            </p>
          )}
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setOpenTable(true)}>
          <Plus aria-hidden="true" /> Open a table
        </button>
      </header>

      {tables.error && !tables.data ? (
        <Note
          tone="error"
          actions={
            <button type="button" className="btn btn--line btn--small" onClick={tables.reload}>
              Try again
            </button>
          }
        >
          {describeError(tables.error)}
        </Note>
      ) : !tables.data ? (
        <div className="rows-skel" aria-busy="true" aria-label="Loading your games">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : (
        <div className="me__lists">
          <Group title="Your move" tables={yourMove} empty="No game is waiting for you." />
          {invites.length > 0 && <Group title="Invitations for you" tables={invites} empty="" />}
          <Group
            title="Waiting for your opponent"
            tables={[...theirMove, ...waiting]}
            empty="Nothing pending. Open a table to start a game."
          />
          <Group title="History" tables={history} empty="Finished games will collect here, ready to replay." />
        </div>
      )}

      <NicknameForm account={account} current={p?.nickname ?? ''} />
      <OpenTableDialog open={openTable} onClose={() => setOpenTable(false)} />
    </div>
  )
}

function Group({ title, tables, empty }: { title: string; tables: Table[]; empty: string }) {
  return (
    <section className="section">
      <div className="section__head">
        <h2>
          {title} <span className="faint num">{tables.length}</span>
        </h2>
      </div>
      {tables.length === 0 ? <p className="empty">{empty}</p> : <TableRows tables={tables} label={title} />}
    </section>
  )
}

function NicknameForm({ account, current }: { account: Address; current: string }) {
  const tx = useTx()
  const [value, setValue] = useState<string | null>(null)
  const text = value ?? current
  const bytes = byteLength(text.trim())
  const tooLong = bytes > NICKNAME_MAX_BYTES

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (tooLong) return
    const name = text.trim()
    const sent = await tx.run((a) => prepare.setNickname(a, name))
    if (sent) {
      rememberNickname(account, name)
      setValue(null)
    }
  }

  return (
    <section className="section nickname" aria-labelledby="nick-title">
      <h2 id="nick-title">Nickname</h2>
      <form className="nickname__form" onSubmit={save} noValidate>
        <div className="field">
          <label htmlFor="nickname">Shown instead of your address</label>
          <input
            id="nickname"
            className="input"
            value={text}
            onChange={(e) => setValue(e.target.value)}
            maxLength={40}
            autoComplete="nickname"
            aria-invalid={tooLong}
            aria-describedby="nick-hint"
          />
          <span id="nick-hint" className={tooLong ? 'field__error' : 'field__hint'}>
            {tooLong
              ? `Too long: ${bytes} of ${NICKNAME_MAX_BYTES} bytes. Some letters take two bytes or more.`
              : `${bytes} of ${NICKNAME_MAX_BYTES} bytes. Leave it empty to show your address. Saving is one transaction.`}
          </span>
        </div>
        <button type="submit" className="btn btn--line" disabled={tx.busy || tooLong || text.trim() === current}>
          {tx.busy && <Spinner small />}
          {tx.busy ? PHASE_LABEL[tx.state.phase] : 'Save nickname'}
        </button>
      </form>
      {tx.state.phase === 'error' && <Note tone="error">{tx.state.error}</Note>}
      {tx.state.phase === 'done' && <Note tone="ok">Saved on chain.</Note>}
    </section>
  )
}
