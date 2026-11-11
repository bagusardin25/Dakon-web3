import { useEffect, useSyncExternalStore } from 'react'
import type { Address } from 'viem'
import { fetchNicknames } from './contract'
import { shortAddress } from './format'

// ───────────────────────────── Revision ─────────────────────────────
// Bumped after every confirmed transaction so the data on screen is read again.

let revision = 0
const revisionListeners = new Set<() => void>()

export function bumpRevision() {
  revision += 1
  revisionListeners.forEach((notify) => notify())
}

export function useRevision(): number {
  return useSyncExternalStore(
    (notify) => {
      revisionListeners.add(notify)
      return () => revisionListeners.delete(notify)
    },
    () => revision,
  )
}

// ───────────────────────────── Nicknames ─────────────────────────────
// One shared cache. Names asked for in the same tick are fetched in one call.

const names = new Map<string, string>() // lower-case address -> nickname ('' when none is set)
const pending = new Set<Address>()
const listeners = new Set<() => void>()
let version = 0
let scheduled = false

function notify() {
  version += 1
  listeners.forEach((fn) => fn())
}

async function flush() {
  scheduled = false
  const wanted = [...pending]
  pending.clear()
  if (wanted.length === 0) return
  try {
    const result = await fetchNicknames(wanted)
    wanted.forEach((address, i) => names.set(address.toLowerCase(), result[i] ?? ''))
    notify()
  } catch {
    // Names are a nicety. Without them the short address shows; a later render asks again.
  }
}

function request(address: Address) {
  if (names.has(address.toLowerCase()) || pending.has(address)) return
  pending.add(address)
  if (!scheduled) {
    scheduled = true
    setTimeout(flush, 0)
  }
}

export function rememberNickname(address: Address, nickname: string) {
  names.set(address.toLowerCase(), nickname)
  notify()
}

/** The nickname for an address, or undefined when none is set or it has not loaded yet. */
export function useNickname(address: Address | undefined): string | undefined {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => version,
  )
  useEffect(() => {
    if (address) request(address)
  })
  if (!address) return undefined
  return names.get(address.toLowerCase()) || undefined
}

export const displayName = (address: Address, nickname: string | undefined): string =>
  nickname || shortAddress(address)

/** A player's nickname or short address, as plain text for labels. */
export function useDisplayName(address: Address | undefined): string {
  const nickname = useNickname(address)
  return address ? displayName(address, nickname) : ''
}
