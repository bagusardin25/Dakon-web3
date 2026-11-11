import { ExternalLink, LogOut, Wallet, Wrench } from 'lucide-react'
import { chain, explorerAddressUrl, NETWORK } from '../config/chains'
import { href } from '../lib/router'
import { useWallet } from '../lib/wallet'
import { CopyButton, Note, Spinner } from './bits'
import { Dialog } from './Dialog'

export function WalletDialog() {
  const w = useWallet()
  const injected = w.connectors.filter((c) => c.kind === 'injected')
  const dev = w.connectors.filter((c) => c.kind === 'dev')

  if (w.active) {
    const url = explorerAddressUrl(w.active.account)
    return (
      <Dialog open={w.dialogOpen} onClose={w.closeDialog} title="Your wallet" labelId="wallet-title">
        <div className="field">
          <span className="eyebrow">Connected with {w.active.connectorName}</span>
          <code className="wallet-address">{w.active.account}</code>
        </div>
        {w.wrongChain && (
          <Note
            tone="error"
            actions={
              <button type="button" className="btn btn--primary btn--small" onClick={() => void w.switchChain()}>
                Switch to {chain.name}
              </button>
            }
          >
            Your wallet is on another network. Dakon moves are made on <strong>{chain.name}</strong>.
          </Note>
        )}
        {w.error && <Note tone="error">{w.error}</Note>}
        <div className="dialog__foot dialog__foot--start">
          <CopyButton text={w.active.account} label="Copy address" />
          {url && (
            <a className="btn btn--line btn--small" href={url} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" /> View on explorer
            </a>
          )}
          <a className="btn btn--line btn--small" href={href.me} onClick={w.closeDialog}>
            My games and nickname
          </a>
          <button
            type="button"
            className="btn btn--quiet btn--small"
            onClick={() => {
              w.disconnect()
              w.closeDialog()
            }}
          >
            <LogOut aria-hidden="true" /> Disconnect
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open={w.dialogOpen} onClose={w.closeDialog} title="Connect a wallet" labelId="wallet-title">
      <p className="muted">
        A wallet signs your moves. Watching games and practising need no wallet at all.
      </p>
      {injected.length > 0 ? (
        <ul className="wallets" aria-label="Wallets in this browser">
          {injected.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="wallet-opt"
                onClick={() => void w.connect(c)}
                disabled={w.connecting !== undefined}
              >
                {c.icon ? (
                  <img src={c.icon} alt="" />
                ) : (
                  <span className="wallet-opt__glyph">
                    <Wallet aria-hidden="true" />
                  </span>
                )}
                <span>
                  {c.name}
                  <span className="wallet-opt__sub">Browser extension</span>
                </span>
                {w.connecting === c.id && <Spinner small label="Connecting" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Note>
          <strong>No wallet found in this browser.</strong> Install MetaMask or BO Wallet, then reload this page. On a
          phone, open Dakon inside your wallet app’s browser.
        </Note>
      )}

      {import.meta.env.DEV && dev.length > 0 && NETWORK === 'local' && (
        <div className="field">
          <span className="eyebrow">Local chain only</span>
          <ul className="wallets" aria-label="Development wallets">
            {dev.map((c) => (
              <li key={c.id}>
                <button type="button" className="wallet-opt" onClick={() => void w.connect(c)}>
                  <span className="wallet-opt__glyph">
                    <Wrench aria-hidden="true" />
                  </span>
                  <span>
                    {c.name}
                    <span className="wallet-opt__sub">Signed by the local Hardhat node</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {w.error && <Note tone="error">{w.error}</Note>}
    </Dialog>
  )
}
