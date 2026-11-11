import { useState } from 'react'
import type { FormEvent } from 'react'
import { getAddress, isAddress } from 'viem'
import type { Address } from 'viem'
import { PACES, SIZES } from '../config/site'
import type { BoardSize } from '../config/site'
import { prepare } from '../lib/contract'
import { sameAddress } from '../lib/format'
import { href, navigate } from '../lib/router'
import { PHASE_LABEL, useTx } from '../lib/tx'
import { useWallet } from '../lib/wallet'
import { Note, Spinner } from './bits'
import { Dialog } from './Dialog'

export type TablePreset = { size?: BoardSize; pace?: number; invite?: Address }

export function OpenTableDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: TablePreset }) {
  return (
    <Dialog open={open} onClose={onClose} title={preset?.invite ? 'Offer a return game' : 'Open a table'} labelId="open-title">
      {/* Remount the form each time so it starts from the preset. */}
      {open && <OpenTableForm preset={preset} onDone={onClose} />}
    </Dialog>
  )
}

function OpenTableForm({ preset, onDone }: { preset?: TablePreset; onDone: () => void }) {
  const wallet = useWallet()
  const tx = useTx()
  const [size, setSize] = useState<BoardSize>(preset?.size ?? 5)
  const [pace, setPace] = useState<number>(preset?.pace ?? 1)
  const [who, setWho] = useState<'anyone' | 'one'>(preset?.invite ? 'one' : 'anyone')
  const [invite, setInvite] = useState<string>(preset?.invite ?? '')
  const [touched, setTouched] = useState(false)

  const trimmed = invite.trim()
  let inviteError: string | undefined
  if (who === 'one') {
    if (!isAddress(trimmed)) inviteError = 'Paste a full wallet address, starting with 0x.'
    else if (sameAddress(trimmed, wallet.active?.account)) inviteError = 'That is your own wallet.'
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched(true)
    if (inviteError) return
    const invited = who === 'one' ? getAddress(trimmed) : undefined
    const sent = await tx.run((account) => prepare.openTable(account, size, pace, invited))
    if (sent) {
      onDone()
      navigate(href.table(sent.result))
    }
  }

  return (
    <form className="dialog__form" onSubmit={submit} noValidate>
      <fieldset className="choices choices--row">
        <legend>Board</legend>
        {SIZES.map((s) => (
          <label key={s.value} className="choice">
            <input type="radio" name="size" checked={size === s.value} onChange={() => setSize(s.value)} />
            <span className="choice__body">
              <span className="choice__title">{s.name}</span>
              <span className="choice__detail">{s.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="choices choices--row">
        <legend>Time per move</legend>
        {PACES.map((p) => (
          <label key={p.value} className="choice">
            <input type="radio" name="pace" checked={pace === p.value} onChange={() => setPace(p.value)} />
            <span className="choice__body">
              <span className="choice__title">{p.name}</span>
              <span className="choice__detail">{p.limit}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="choices">
        <legend>Who may sit</legend>
        <div className="choices choices--row">
          <label className="choice">
            <input type="radio" name="who" checked={who === 'anyone'} onChange={() => setWho('anyone')} />
            <span className="choice__body">
              <span className="choice__title">Anyone</span>
              <span className="choice__detail">Listed in the lobby</span>
            </span>
          </label>
          <label className="choice">
            <input type="radio" name="who" checked={who === 'one'} onChange={() => setWho('one')} />
            <span className="choice__body">
              <span className="choice__title">One wallet</span>
              <span className="choice__detail">Only they can sit</span>
            </span>
          </label>
        </div>
        {who === 'one' && (
          <div className="field">
            <label htmlFor="invite">Their wallet address</label>
            <input
              id="invite"
              className="input"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={touched && !!inviteError}
              aria-describedby="invite-msg"
            />
            <span id="invite-msg" className={touched && inviteError ? 'field__error' : 'field__hint'}>
              {touched && inviteError ? inviteError : 'The seat stays reserved for this wallet until you cancel.'}
            </span>
          </div>
        )}
      </fieldset>

      <p className="muted small">
        You sit South. Your opponent sits North and moves first, in return for you choosing the board and the
        pace. Opening a table is one transaction; you can cancel it while nobody has sat.
      </p>

      {tx.state.phase === 'error' && <Note tone="error">{tx.state.error}</Note>}

      <div className="dialog__foot">
        <button type="button" className="btn btn--quiet" onClick={onDone}>
          Not now
        </button>
        <button type="submit" className="btn btn--primary" disabled={tx.busy}>
          {tx.busy && <Spinner small />}
          {tx.busy ? PHASE_LABEL[tx.state.phase] : wallet.active ? 'Open the table' : 'Connect a wallet to open'}
        </button>
      </div>
    </form>
  )
}
