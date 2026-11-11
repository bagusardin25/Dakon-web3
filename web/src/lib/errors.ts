import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem'
import { chain } from '../config/chains'
import { NotDeployedError, TableMissingError } from './contract'

/** What each contract rejection means, in words a player can act on. */
const REVERTS: Record<string, string> = {
  InvalidSize: 'Choose Ringkas or Klasik.',
  InvalidPace: 'Choose Kilat, Biasa or Santai.',
  CannotInviteYourself: 'You cannot invite your own wallet. Leave the field empty or paste the other player’s address.',
  TableNotFound: 'There is no table with that number.',
  TableNotWaiting: 'Someone has already sat at this table, or it was cancelled.',
  NotTheOpener: 'Only the wallet that opened this table can cancel it.',
  OpenerCannotSit: 'You opened this table. Send the invitation link to someone else.',
  NotInvited: 'This seat is reserved for another wallet.',
  GameNotInPlay: 'This game is not in play any more.',
  NotAPlayer: 'Only the two players at this table can do that.',
  NotYourTurn: 'It is not your move yet.',
  InvalidHole: 'That hole is not on your side of the board.',
  EmptyHole: 'That hole is empty. Pick a hole with seeds in it.',
  YourOwnMove: 'It is your move, so the clock is yours. You can only claim when your opponent runs out of time.',
  TimeNotUp: 'Your opponent still has time left.',
  NicknameTooLong: 'A nickname can be at most 20 bytes.',
}

const CANCELLED = 'You cancelled the request in your wallet. Nothing was sent.'
const FALLBACK = 'Something went wrong. Please try again.'

export function describeError(err: unknown): string {
  if (err instanceof NotDeployedError || err instanceof TableMissingError) return err.message

  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return CANCELLED

    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName
      if (name && REVERTS[name]) return REVERTS[name]
    }

    const text = `${err.shortMessage} ${err.message}`.toLowerCase()
    if (text.includes('insufficient funds')) return 'This wallet does not hold enough BOT to pay for gas.'
    if (text.includes('does not match the target chain') || text.includes('chain mismatch')) {
      return `Your wallet is on another network. Switch it to ${chain.name} and try again.`
    }
    if (text.includes('http request failed') || text.includes('failed to fetch') || text.includes('timed out')) {
      return `Could not reach ${chain.name}. Check your connection and try again.`
    }
    return err.shortMessage || FALLBACK
  }

  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 4001) {
    return CANCELLED
  }
  if (err instanceof Error && err.message) return err.message
  return FALLBACK
}
