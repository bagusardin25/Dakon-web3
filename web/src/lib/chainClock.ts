import { useEffect, useSyncExternalStore } from 'react'
import { publicClient } from './client'
import { useNow } from './prefs'

// Move deadlines are set in chain time. When the chain's clock runs ahead of this computer's
// (a skewed local clock, or a local test chain that was fast-forwarded), counting down on the
// local clock would offer a timeout claim too late. The newest block's timestamp tells us how
// far ahead the chain is. A chain that is merely idle has an old newest block, so only a lead
// is ever applied, never a lag.

let lead = 0
let lastSync = 0
const listeners = new Set<() => void>()

async function sync() {
  const now = Date.now()
  if (now - lastSync < 10_000) return
  lastSync = now
  try {
    const block = await publicClient.getBlock({ blockTag: 'latest' })
    const next = Math.max(0, Number(block.timestamp) - Math.floor(now / 1000))
    if (next !== lead) {
      lead = next
      listeners.forEach((fn) => fn())
    }
  } catch {
    // Keep the last known lead; the countdown is a guide and the contract has the final word.
  }
}

/** The current chain time in seconds, ticking once a second while `active`. */
export function useChainNow(active = true): number {
  const local = useNow(active)
  const offset = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => lead,
  )
  useEffect(() => {
    if (!active) return
    void sync()
    const id = window.setInterval(() => void sync(), 30_000)
    return () => window.clearInterval(id)
  }, [active])
  return local + offset
}

/** Forget the measured lead and measure again, e.g. after a confirmed transaction. */
export function resyncChainClock() {
  lastSync = 0
  void sync()
}
