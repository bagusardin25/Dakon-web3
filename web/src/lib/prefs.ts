import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RefObject } from 'react'

// ───────────────────────────── Reduced motion ─────────────────────────────

const query = '(prefers-reduced-motion: reduce)'

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

// ───────────────────────────── Sowing speed ─────────────────────────────
// A per-browser preference. Storage may be unavailable; the default then applies.

export type Speed = 'calm' | 'quick'
const KEY = 'dakon.speed'
const speedListeners = new Set<() => void>()

function readSpeed(): Speed {
  try {
    return localStorage.getItem(KEY) === 'quick' ? 'quick' : 'calm'
  } catch {
    return 'calm'
  }
}

let speed: Speed = typeof window === 'undefined' ? 'calm' : readSpeed()

export function setSpeed(next: Speed) {
  speed = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Not remembered, still applied for this visit.
  }
  speedListeners.forEach((fn) => fn())
}

export function useSpeed(): Speed {
  return useSyncExternalStore(
    (notify) => {
      speedListeners.add(notify)
      return () => speedListeners.delete(notify)
    },
    () => speed,
  )
}

// ───────────────────────────── Clock ─────────────────────────────

/** The current time in seconds, ticking once a second while `active`. */
export function useNow(active = true): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

// ───────────────────────────── Container width ─────────────────────────────

export function useWidth<T extends HTMLElement>(ref: RefObject<T | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w !== undefined) setWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}
