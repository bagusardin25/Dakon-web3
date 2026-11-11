export const SITE = {
  name: 'Dakon',
  tagline: 'Congklak between two wallets, refereed on BOT Chain',
  /** The project's X profile. Leave empty until the account exists; the footer hides the link. */
  xUrl: '',
  botchainUrl: 'https://botchain.ai',
  botchainScanUrl: 'https://scan.botchain.ai',
} as const

export type BoardSize = 5 | 7

export const SIZES: readonly { value: BoardSize; name: string; detail: string }[] = [
  { value: 5, name: 'Ringkas', detail: '5 holes a side, 50 seeds. About 20 moves.' },
  { value: 7, name: 'Klasik', detail: '7 holes a side, 98 seeds. About 35 moves.' },
]

export const PACES: readonly { value: number; name: string; limit: string; seconds: number }[] = [
  { value: 0, name: 'Kilat', limit: '3 minutes a move', seconds: 180 },
  { value: 1, name: 'Biasa', limit: '1 hour a move', seconds: 3600 },
  { value: 2, name: 'Santai', limit: '24 hours a move', seconds: 86400 },
]

export const sizeName = (size: number): string => SIZES.find((s) => s.value === size)?.name ?? `${size} holes`
export const paceName = (pace: number): string => PACES[pace]?.name ?? '—'

export const NICKNAME_MAX_BYTES = 20
