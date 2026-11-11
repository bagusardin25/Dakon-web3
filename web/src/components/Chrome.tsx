import { Armchair, BookOpen, CircleUser, ExternalLink, ListOrdered, Sprout } from 'lucide-react'
import { chain, CONTRACT_ADDRESS, explorerAddressUrl, NETWORK } from '../config/chains'
import { SITE } from '../config/site'
import { shortAddress } from '../lib/format'
import { href } from '../lib/router'
import type { Route } from '../lib/router'
import { displayName, useNickname } from '../lib/store'
import { useWallet } from '../lib/wallet'
import { KawungMark } from './bits'

const LINKS = [
  { to: href.lobby, name: 'lobby', label: 'Tables', Icon: Armchair },
  { to: href.practice, name: 'practice', label: 'Practice', Icon: Sprout },
  { to: href.rules, name: 'rules', label: 'Rules', Icon: BookOpen },
  { to: href.players, name: 'players', label: 'Players', Icon: ListOrdered },
  { to: href.me, name: 'me', label: 'My games', Icon: CircleUser },
] as const

const current = (route: Route, name: string) =>
  route.name === name || (name === 'lobby' && route.name === 'table') ? 'page' : undefined

function WalletButton() {
  const { active, wrongChain, openDialog } = useWallet()
  const nickname = useNickname(active?.account)
  if (!active) {
    return (
      <button type="button" className="btn btn--primary btn--small" onClick={openDialog}>
        Connect wallet
      </button>
    )
  }
  return (
    <button
      type="button"
      className="wallet-chip"
      onClick={openDialog}
      aria-label={`Wallet ${displayName(active.account, nickname)}${wrongChain ? ', on the wrong network' : ''}. Open wallet menu`}
    >
      <span className={`wallet-chip__dot${wrongChain ? ' wallet-chip__dot--warn' : ''}`} aria-hidden="true" />
      {nickname || shortAddress(active.account)}
    </button>
  )
}

export function Header({ route }: { route: Route }) {
  return (
    <header className="top">
      <div className="wrap top__bar">
        <a className="brand" href={href.lobby}>
          <KawungMark className="brand__mark" />
          Dakon
        </a>
        <nav className="nav" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.name} href={l.to} aria-current={current(route, l.name)}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="top__wallet">
          {NETWORK !== 'mainnet' && <span className="tag tag--brass top__net">{chain.name}</span>}
          <WalletButton />
        </div>
      </div>
    </header>
  )
}

export function Tabs({ route }: { route: Route }) {
  return (
    <nav className="tabs" aria-label="Main">
      {LINKS.map(({ to, name, label, Icon }) => (
        <a key={name} href={to} aria-current={current(route, name)}>
          <Icon aria-hidden="true" />
          {label}
        </a>
      ))}
    </nav>
  )
}

export function Notices() {
  const { wrongChain, switchChain } = useWallet()
  if (!CONTRACT_ADDRESS) {
    return (
      <div className="banner">
        <p className="wrap banner__inner">
          <strong>Dakon is not on {chain.name} yet.</strong>
          <span>Practice against the computer works now; tables open once the contract is deployed.</span>
        </p>
      </div>
    )
  }
  if (wrongChain) {
    return (
      <div className="banner">
        <div className="wrap banner__inner">
          <strong>Your wallet is on another network.</strong>
          <span>Moves are made on {chain.name}.</span>
          <button type="button" className="btn btn--line btn--small" onClick={() => void switchChain()}>
            Switch to {chain.name}
          </button>
        </div>
      </div>
    )
  }
  return null
}

export function Footer() {
  const contractUrl = CONTRACT_ADDRESS ? explorerAddressUrl(CONTRACT_ADDRESS) : undefined
  return (
    <footer className="foot">
      <div className="wrap foot__inner">
        <div className="foot__chain">
          <p className="foot__built">Built on BOT Chain</p>
          <p>
            Every move is a transaction to one smart contract, which plays the sowing rules itself.
            No wagers, no tokens: a game costs only gas.
          </p>
          <div className="foot__links">
            <a href={SITE.botchainUrl} target="_blank" rel="noreferrer">
              botchain.ai <ExternalLink size={14} aria-hidden="true" />
            </a>
            <a href={SITE.botchainScanUrl} target="_blank" rel="noreferrer">
              scan.botchain.ai <ExternalLink size={14} aria-hidden="true" />
            </a>
            {SITE.xUrl && (
              <a href={SITE.xUrl} target="_blank" rel="noreferrer">
                Dakon on X <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
        <div className="foot__meta">
          <span className="eyebrow">Contract · {chain.name}</span>
          {CONTRACT_ADDRESS ? (
            contractUrl ? (
              <a href={contractUrl} target="_blank" rel="noreferrer">
                <code>{CONTRACT_ADDRESS}</code>
              </a>
            ) : (
              <code>{CONTRACT_ADDRESS}</code>
            )
          ) : (
            <span>Not deployed yet</span>
          )}
          <span className="faint">Dakon is the Javanese name for congklak.</span>
        </div>
      </div>
    </footer>
  )
}
