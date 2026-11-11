// One sentence per move, for the move list and for screen readers.
import type { MoveResult } from './rules.ts'

export function narrate(name: string, hole: number, r: MoveResult): string {
  const first = r.steps.find((s) => s.kind === 'lift')
  const lifted = first && first.kind === 'lift' ? first.count : 0
  const parts = [`${name} sowed ${lifted} from hole ${hole + 1}`]
  if (r.relays > 0) parts.push(`relayed ${r.relays === 1 ? 'once' : `${r.relays} times`}`)
  const capture = r.steps.find((s) => s.kind === 'capture')
  let sentence = parts.join(', ')
  switch (r.outcome) {
    case 'extra':
      sentence += r.ended ? ' and finished in the store.' : ' and finished in the store: another move.'
      break
    case 'capture':
      sentence += ` and captured ${capture && capture.kind === 'capture' ? capture.seeds : 0}.`
      break
    case 'rest':
      sentence += '. The last seed rests in an empty hole.'
      break
    case 'dead':
      sentence += '. The last seed fell in an empty hole across the board.'
      break
    case 'limit':
      sentence += '. The sowing limit stopped the move.'
      break
  }
  if (r.ended) sentence += ' The game is over.'
  return sentence
}

/** A short tag for the move list. */
export const OUTCOME_TAG: Record<MoveResult['outcome'], string> = {
  extra: 'Again',
  capture: 'Capture',
  rest: 'Rest',
  dead: 'Turn over',
  limit: 'Limit',
}
