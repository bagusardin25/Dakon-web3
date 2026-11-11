const encoder = new TextEncoder()

/** The contract limits nicknames by UTF-8 bytes, not characters. */
export const byteLength = (text: string): number => encoder.encode(text).length

export const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`

export const sameAddress = (a?: string, b?: string): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`

const DAY = 86_400

export function timeAgo(timestamp: number, nowMs = Date.now()): string {
  const seconds = Math.max(0, Math.floor(nowMs / 1000) - timestamp)
  if (seconds < 45) return 'just now'
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`
  if (seconds < DAY) return `${Math.round(seconds / 3600)} h ago`
  if (seconds < DAY * 14) return `${plural(Math.round(seconds / DAY), 'day')} ago`
  return new Date(timestamp * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Time left on the clock, compact: "2:41", "48 min", "23 h". */
export function clock(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft))
  if (s < 600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < DAY * 2) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
  return plural(Math.floor(s / DAY), 'day')
}
