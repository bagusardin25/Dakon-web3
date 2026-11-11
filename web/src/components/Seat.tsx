import type { ReactNode } from 'react'

/** One player's place at the board: who, which side, their store, and the clock. */
export function Seat({
  side,
  name,
  store,
  turn,
  note,
  noteTone,
}: {
  side: 0 | 1
  name: ReactNode
  store: number
  turn: boolean
  note?: ReactNode
  noteTone?: 'turn' | 'late'
}) {
  return (
    <div className={`seat${turn ? ' seat--turn' : ''}`}>
      <span className="seat__side" aria-hidden="true">
        {side === 0 ? 'S' : 'N'}
      </span>
      <span className="seat__who">
        <span className="seat__name">{name}</span>
        <span className={`seat__note${noteTone ? ` seat__note--${noteTone}` : ''}`}>
          {side === 0 ? 'South' : 'North'}
          {note && <> · {note}</>}
        </span>
      </span>
      <span className="seat__score">
        <span className="seat__store num">{store}</span>
        <span className="seat__store-label">store</span>
      </span>
    </div>
  )
}
