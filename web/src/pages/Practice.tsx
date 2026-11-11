import { PracticeGame } from '../components/PracticeGame'
import { href } from '../lib/router'

export function Practice() {
  return (
    <div className="wrap page practice">
      <header className="page__head page__head--center">
        <p className="eyebrow">Practice · no wallet, no gas</p>
        <h1 className="page__title">You against the computer</h1>
        <p className="muted">
          The computer looks one move ahead and takes whatever fills its store fastest. Nothing here is recorded on
          chain. When you are ready, <a href={href.lobby}>find a real opponent</a>.
        </p>
      </header>
      <PracticeGame reserve={340} />
    </div>
  )
}
