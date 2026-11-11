import { useMemo, useSyncExternalStore } from 'react'

export type Route =
  | { name: 'lobby' }
  | { name: 'table'; id: bigint }
  | { name: 'practice' }
  | { name: 'rules' }
  | { name: 'players' }
  | { name: 'me' }
  | { name: 'notfound' }

/** Hash routes, so the app deploys as static files with no server rewrites. */
export const href = {
  lobby: '#/',
  table: (id: bigint | number) => `#/table/${id}`,
  practice: '#/practice',
  rules: '#/rules',
  players: '#/players',
  me: '#/me',
} as const

function parse(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'lobby' }
  const [head, arg] = parts
  if (head === 'table' && parts.length === 2 && arg && /^\d{1,18}$/.test(arg)) return { name: 'table', id: BigInt(arg) }
  if (parts.length !== 1) return { name: 'notfound' }
  if (head === 'practice') return { name: 'practice' }
  if (head === 'rules') return { name: 'rules' }
  if (head === 'players') return { name: 'players' }
  if (head === 'me') return { name: 'me' }
  return { name: 'notfound' }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parse(hash), [hash])
}

export function navigate(to: string) {
  window.location.hash = to
}

/** Absolute link to a route, for invitations. */
export function absoluteUrl(to: string): string {
  return `${window.location.origin}${window.location.pathname}${to}`
}
