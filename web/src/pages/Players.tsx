import { Name, Note } from '../components/bits'
import { fetchPlayers, isDeployed } from '../lib/contract'
import type { Player } from '../lib/contract'
import { describeError } from '../lib/errors'
import { sameAddress } from '../lib/format'
import { href } from '../lib/router'
import { useAsync } from '../lib/useAsync'
import { useWallet } from '../lib/wallet'

const played = (p: Player) => p.wins + p.losses + p.draws

/** Most wins first; then the better win rate; then the fuller best store. */
function rank(players: Player[]): Player[] {
  return players
    .filter((p) => played(p) > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      const ra = a.wins / played(a)
      const rb = b.wins / played(b)
      if (rb !== ra) return rb - ra
      return b.bestStore - a.bestStore
    })
}

export function Players() {
  const { active } = useWallet()
  const data = useAsync(isDeployed() ? 'players' : null, fetchPlayers)
  const ranked = data.data ? rank(data.data) : []

  return (
    <div className="wrap page">
      <header className="page__head">
        <p className="eyebrow">Leaderboard</p>
        <h1 className="page__title">Players</h1>
        <p className="muted">
          Every finished game counts, whether it ended on the board, by resignation or on time. Best store counts only
          games played to the last seed. Read straight from the contract.
        </p>
      </header>

      {!isDeployed() ? (
        <Note>The leaderboard fills in once Dakon is deployed on this network.</Note>
      ) : !data.data && data.loading ? (
        <div className="rows-skel" aria-busy="true" aria-label="Loading players">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : !data.data ? (
        <Note
          tone="error"
          actions={
            <button type="button" className="btn btn--line btn--small" onClick={data.reload}>
              Try again
            </button>
          }
        >
          {describeError(data.error)}
        </Note>
      ) : ranked.length === 0 ? (
        <div className="state">
          <h2>No finished games yet</h2>
          <p>The first result puts its two players on this board.</p>
          <a className="btn btn--primary" href={href.lobby}>
            Find a table
          </a>
        </div>
      ) : (
        <table className="board-table">
          <caption className="sr-only">Players ranked by wins</caption>
          <thead>
            <tr>
              <th scope="col" className="board-table__rank">
                #
              </th>
              <th scope="col">Player</th>
              <th scope="col" className="num">
                <abbr title="Won, lost, drawn">W–L–D</abbr>
              </th>
              <th scope="col" className="num board-table__rate">
                Won
              </th>
              <th scope="col" className="num">
                Best store
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => (
              <tr key={p.wallet} className={sameAddress(p.wallet, active?.account) ? 'is-you' : undefined}>
                <td className="board-table__rank num">{i + 1}</td>
                <td className="board-table__name">
                  <Name address={p.wallet} />
                </td>
                <td className="num">
                  {p.wins}–{p.losses}–{p.draws}
                </td>
                <td className="num board-table__rate">{Math.round((p.wins / played(p)) * 100)}%</td>
                <td className="num">{p.bestStore || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
