import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Note } from '../components/bits'
import { OpenTableDialog } from '../components/OpenTableDialog'
import { PracticeGame } from '../components/PracticeGame'
import { TableRows } from '../components/TableRows'
import { fetchRecentTables, fetchStats, isDeployed, STATUS } from '../lib/contract'
import { describeError } from '../lib/errors'
import { href } from '../lib/router'
import { useAsync, useInterval } from '../lib/useAsync'

export function Lobby() {
  const [nudge, setNudge] = useState(false)
  const [openTable, setOpenTable] = useState(false)
  const deployed = isDeployed()

  return (
    <div className="page">
      <section className="hero wrap" aria-labelledby="hero-title">
        <div className="hero__intro">
          <p className="eyebrow">Congklak, refereed on BOT Chain</p>
          <h1 id="hero-title" className="hero__title">
            Sow, relay, capture.
          </h1>
          <p className="hero__lede">
            Dakon is congklak, the seed-sowing game of the archipelago, played between two wallets. A smart contract
            runs every rule, so no illegal move gets through, and every finished game can be replayed seed by seed.
          </p>
          <p className="hero__try">
            Try it now against the computer. You sit nearest the screen and move first. Nothing here is recorded on
            chain.
          </p>
        </div>

        <PracticeGame onYourMove={(n) => n >= 2 && setNudge(true)} reserve={340} showSizePicker={false} />

        {nudge && (
          <div className="nudge" role="status">
            <div>
              <p className="nudge__title">Ready for a real opponent?</p>
              <p className="muted">
                Open a table and send the link, or sit at one that is waiting. <a href={href.rules}>Read the rules</a>{' '}
                if a move surprised you.
              </p>
            </div>
            <div className="nudge__actions">
              <button type="button" className="btn btn--primary" onClick={() => setOpenTable(true)} disabled={!deployed}>
                <Plus aria-hidden="true" /> Open a table
              </button>
              <button
                type="button"
                className="btn btn--line"
                onClick={() => {
                  const heading = document.getElementById('waiting')
                  heading?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  heading?.focus({ preventScroll: true })
                }}
              >
                See who is waiting
              </button>
            </div>
          </div>
        )}
      </section>

      {deployed ? (
        <TablesOverview onOpen={() => setOpenTable(true)} />
      ) : (
        <div className="wrap section">
          <Note>
            Tables open once the Dakon contract is live on this network. Until then, practice is the whole game.
          </Note>
        </div>
      )}

      <OpenTableDialog open={openTable} onClose={() => setOpenTable(false)} />
    </div>
  )
}

function TablesOverview({ onOpen }: { onOpen: () => void }) {
  const tables = useAsync('lobby:tables', () => fetchRecentTables(200))
  const stats = useAsync('lobby:stats', fetchStats)
  useInterval(() => {
    tables.reload()
    stats.reload()
  }, 6000)

  const all = tables.data ?? []
  const waiting = all.filter((t) => t.status === STATUS.WAITING)
  const playing = all.filter((t) => t.status === STATUS.PLAYING)
  const finished = all.filter((t) => t.status === STATUS.FINISHED).sort((a, b) => b.endedAt - a.endedAt).slice(0, 8)

  const body = (list: typeof all, empty: string, label: string) => {
    if (!tables.data && tables.loading) {
      return (
        <div className="rows-skel" aria-busy="true" aria-label="Loading">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )
    }
    if (!tables.data && tables.error) {
      return (
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
      )
    }
    if (list.length === 0) return <p className="empty">{empty}</p>
    return <TableRows tables={list} label={label} />
  }

  return (
    <div className="wrap lobby">
      {stats.data && (
        <dl className="stats" aria-label="Dakon so far">
          <div>
            <dt>Tables</dt>
            <dd className="num">{stats.data.tables}</dd>
          </div>
          <div>
            <dt>Games finished</dt>
            <dd className="num">{stats.data.finished}</dd>
          </div>
          <div>
            <dt>Moves played</dt>
            <dd className="num">{stats.data.moves}</dd>
          </div>
          <div>
            <dt>Players</dt>
            <dd className="num">{stats.data.players}</dd>
          </div>
        </dl>
      )}

      <div className="lobby__grid">
        <section className="section" aria-labelledby="waiting">
          <div className="section__head">
            <h2 id="waiting" tabIndex={-1}>
              Waiting for a challenger
            </h2>
            <button type="button" className="btn btn--primary btn--small" onClick={onOpen}>
              <Plus aria-hidden="true" /> Open a table
            </button>
          </div>
          {body(waiting, 'Nobody is waiting right now. Open a table and send the link to a friend.', 'Tables waiting')}
        </section>

        <section className="section" aria-labelledby="inplay">
          <div className="section__head">
            <h2 id="inplay">In play</h2>
          </div>
          {body(playing, 'No games in play at the moment.', 'Games in play')}
        </section>
      </div>

      <section className="section" aria-labelledby="finished">
        <div className="section__head">
          <h2 id="finished">Recently finished</h2>
          <a className="btn btn--quiet btn--small" href={href.players}>
            Leaderboard
          </a>
        </div>
        {body(finished, 'No finished games yet. The first one will show up here, ready to replay.', 'Finished games')}
      </section>
    </div>
  )
}
