import { useEffect, useRef } from 'react'
import { Footer, Header, Notices, Tabs } from './components/Chrome'
import { WalletDialog } from './components/WalletDialog'
import { href, useRoute } from './lib/router'
import type { Route } from './lib/router'
import { WalletProvider } from './lib/wallet'
import { Lobby } from './pages/Lobby'
import { MyGames } from './pages/MyGames'
import { Players } from './pages/Players'
import { Practice } from './pages/Practice'
import { Rules } from './pages/Rules'
import { TablePage } from './pages/TablePage'

const TITLES: Record<Route['name'], string> = {
  lobby: 'Dakon · congklak between two wallets, refereed on BOT Chain',
  table: 'Table · Dakon',
  practice: 'Practice · Dakon',
  rules: 'Rules · Dakon',
  players: 'Players · Dakon',
  me: 'My games · Dakon',
  notfound: 'Not found · Dakon',
}

function NotFound() {
  return (
    <div className="wrap page">
      <div className="state">
        <h1 className="page__title">Nothing in this hole</h1>
        <p>The page you asked for is not part of Dakon.</p>
        <a className="btn btn--primary" href={href.lobby}>
          Back to the tables
        </a>
      </div>
    </div>
  )
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'lobby':
      return <Lobby />
    case 'table':
      return <TablePage key={String(route.id)} id={route.id} />
    case 'practice':
      return <Practice />
    case 'rules':
      return <Rules />
    case 'players':
      return <Players />
    case 'me':
      return <MyGames />
    case 'notfound':
      return <NotFound />
  }
}

export default function App() {
  const route = useRoute()
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)
  const routeKey = route.name === 'table' ? `table:${route.id}` : route.name

  // On navigation: back to the top, and focus to the new page for keyboard and screen-reader users.
  useEffect(() => {
    document.title = route.name === 'table' ? `Table #${route.id} · Dakon` : TITLES[route.name]
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, 0)
    main.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey])

  return (
    <WalletProvider>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          main.current?.focus()
        }}
      >
        Skip to content
      </a>
      <Header route={route} />
      <Notices />
      <main id="main" ref={main} tabIndex={-1}>
        <Page route={route} />
      </main>
      <Footer />
      <Tabs route={route} />
      <WalletDialog />
    </WalletProvider>
  )
}
