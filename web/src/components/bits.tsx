import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Check, Copy, Info } from 'lucide-react'
import type { Address } from 'viem'
import { sameAddress, shortAddress } from '../lib/format'
import { displayName, useNickname } from '../lib/store'
import { useWallet } from '../lib/wallet'

/** The kawung mark: four ovals around a point, like four holes of a congklak board. */
export function KawungMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <ellipse cx="16" cy="8.5" rx="4" ry="6.5" />
        <ellipse cx="16" cy="23.5" rx="4" ry="6.5" />
        <ellipse cx="8.5" cy="16" rx="6.5" ry="4" />
        <ellipse cx="23.5" cy="16" rx="6.5" ry="4" />
      </g>
    </svg>
  )
}

export function Spinner({ small, label }: { small?: boolean; label?: string }) {
  return (
    <span className={`spinner${small ? ' spinner--small' : ''}`} role={label ? 'status' : undefined} aria-label={label} />
  )
}

export function Note({
  tone = 'info',
  children,
  actions,
}: {
  tone?: 'info' | 'error' | 'ok'
  children: ReactNode
  actions?: ReactNode
}) {
  const Icon = tone === 'error' ? AlertTriangle : tone === 'ok' ? Check : Info
  return (
    <div className={`note${tone === 'info' ? '' : ` note--${tone}`}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon aria-hidden="true" />
      <div className="note__body">
        <div>{children}</div>
        {actions && <div className="note__actions">{actions}</div>}
      </div>
    </div>
  )
}

/** A player's nickname, or their short address. */
export function Name({ address, you = true }: { address: Address; you?: boolean }) {
  const nickname = useNickname(address)
  const { active } = useWallet()
  const isYou = you && sameAddress(active?.account, address)
  return (
    <span title={address}>
      {displayName(address, nickname)}
      {isYou && <span className="faint"> (you)</span>}
    </span>
  )
}

export function CopyButton({ text, label = 'Copy link' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <button
      type="button"
      className="btn btn--line btn--small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setCopied(false), 2000)
        } catch {
          window.prompt('Copy this link:', text)
        }
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  )
}

export function ShortAddress({ value }: { value: string }) {
  return <span title={value}>{shortAddress(value)}</span>
}
