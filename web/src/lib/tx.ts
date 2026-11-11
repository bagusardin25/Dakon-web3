import { useCallback, useState } from 'react'
import type { Address, Hash } from 'viem'
import { chain } from '../config/chains'
import { publicClient } from './client'
import { describeError } from './errors'
import { resyncChainClock } from './chainClock'
import { bumpRevision } from './store'
import { useWallet } from './wallet'

export type TxPhase = 'idle' | 'checking' | 'wallet' | 'mining' | 'done' | 'error'

export type TxState = { phase: TxPhase; error?: string; hash?: Hash }

type Prepared<T> = { request: unknown; result: T }

/**
 * Drives one contract write: dry run, wallet signature, confirmation.
 * Returns null when nothing was sent: no wallet, a rule was broken, or the player cancelled.
 */
export function useTx() {
  const wallet = useWallet()
  const [state, setState] = useState<TxState>({ phase: 'idle' })

  const run = useCallback(
    async <T>(prepare: (account: Address) => Promise<Prepared<T>>): Promise<{ hash: Hash; result: T } | null> => {
      const active = wallet.active
      if (!active) {
        wallet.openDialog()
        return null
      }
      try {
        if (active.chainId !== chain.id) {
          const switched = await wallet.switchChain()
          if (!switched) {
            setState({ phase: 'error', error: `Switch your wallet to ${chain.name} to continue.` })
            return null
          }
        }

        setState({ phase: 'checking' })
        const { request, result } = await prepare(active.account)

        setState({ phase: 'wallet' })
        // `request` comes straight from simulateContract; its exact type depends on the function.
        const hash = await active.client.writeContract(request as never)

        setState({ phase: 'mining', hash })
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('The transaction was rejected on-chain.')

        setState({ phase: 'done', hash })
        bumpRevision()
        resyncChainClock()
        return { hash, result }
      } catch (err) {
        setState({ phase: 'error', error: describeError(err) })
        return null
      }
    },
    [wallet],
  )

  const reset = useCallback(() => setState({ phase: 'idle' }), [])
  const busy = state.phase === 'checking' || state.phase === 'wallet' || state.phase === 'mining'

  return { state, run, reset, busy }
}

export const PHASE_LABEL: Record<TxPhase, string> = {
  idle: '',
  checking: 'Checking the move with the contract…',
  wallet: 'Confirm in your wallet…',
  mining: 'Waiting for BOT Chain to confirm…',
  done: 'Confirmed.',
  error: '',
}
