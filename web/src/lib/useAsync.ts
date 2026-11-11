import { useCallback, useEffect, useRef, useState } from 'react'
import { useRevision } from './store'

export type Async<T> = {
  data: T | undefined
  error: unknown
  /** True while a request is in flight, including background refreshes. */
  loading: boolean
  reload: () => void
}

type Slot<T> = { key: string | null; data?: T; error?: unknown; loading: boolean }

/**
 * Runs `load` whenever `key` changes, after any confirmed transaction, or on reload().
 * Data from the previous run stays visible during a refresh; it is dropped when the key changes.
 * Pass a null key to skip loading.
 */
export function useAsync<T>(key: string | null, load: () => Promise<T>): Async<T> {
  const revision = useRevision()
  const [tick, setTick] = useState(0)
  const [slot, setSlot] = useState<Slot<T>>({ key, loading: key !== null })

  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (key === null) {
      setSlot({ key, loading: false })
      return
    }
    let cancelled = false
    setSlot((prev) => (prev.key === key ? { ...prev, loading: true } : { key, loading: true }))
    loadRef.current().then(
      (data) => {
        if (!cancelled) setSlot({ key, data, loading: false })
      },
      (error: unknown) => {
        if (!cancelled) setSlot((prev) => ({ key, data: prev.key === key ? prev.data : undefined, error, loading: false }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, revision, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  const current = slot.key === key
  return {
    data: current ? slot.data : undefined,
    error: current ? slot.error : undefined,
    loading: current ? slot.loading : key !== null,
    reload,
  }
}

/** Calls `fn` on an interval while the tab is visible. */
export function useInterval(fn: () => void, ms: number | null) {
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })
  useEffect(() => {
    if (ms === null) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') fnRef.current()
    }, ms)
    return () => window.clearInterval(id)
  }, [ms])
}
