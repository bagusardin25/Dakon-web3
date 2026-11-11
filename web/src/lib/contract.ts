import { getAddress, hexToBytes, zeroAddress } from 'viem'
import type { Address, Hex } from 'viem'
import { dakonAbi } from '../config/abi'
import { CONTRACT_ADDRESS, chain } from '../config/chains'
import type { Board, Side, Size } from '../engine/rules'
import { publicClient } from './client'

export const STATUS = { WAITING: 0, PLAYING: 1, FINISHED: 2, CANCELLED: 3 } as const
export const RESULT = { NONE: 0, SOUTH: 1, NORTH: 2, DRAW: 3 } as const
export const REASON = { NONE: 0, BOARD: 1, RESIGN: 2, TIMEOUT: 3 } as const

export type Table = {
  id: bigint
  south: Address
  north: Address | undefined
  invited: Address | undefined
  size: Size
  pace: number
  status: number
  turn: Side
  result: number
  reason: number
  createdAt: number
  lastMoveAt: number
  endedAt: number
  /** While a game is in play: when the player to move runs out of time (unix seconds). */
  deadline: number
  moveCount: number
  board: Board
}

export type Player = {
  wallet: Address
  nickname: string
  wins: number
  losses: number
  draws: number
  bestStore: number
  tables: number
}

export type Stats = { tables: number; playing: number; finished: number; moves: number; players: number }

export class NotDeployedError extends Error {
  constructor() {
    super(`Dakon has not been deployed on ${chain.name} yet.`)
    this.name = 'NotDeployedError'
  }
}

export class TableMissingError extends Error {
  constructor() {
    super('There is no table with that number.')
    this.name = 'TableMissingError'
  }
}

export const isDeployed = (): boolean => CONTRACT_ADDRESS !== undefined

function contract() {
  if (!CONTRACT_ADDRESS) throw new NotDeployedError()
  return { address: CONTRACT_ADDRESS, abi: dakonAbi } as const
}

const PAGE = 100n
const orUndefined = (a: Address): Address | undefined => (a === zeroAddress ? undefined : getAddress(a))

type RawTable = {
  id: bigint
  south: Address
  north: Address
  invited: Address
  size: number
  pace: number
  status: number
  turn: number
  result: number
  reason: number
  createdAt: number
  lastMoveAt: number
  endedAt: number
  deadline: number
  moveCount: number
  board: readonly number[]
}

function toTable(raw: RawTable): Table {
  return {
    id: raw.id,
    south: getAddress(raw.south),
    north: orUndefined(raw.north),
    invited: orUndefined(raw.invited),
    size: (raw.size === 7 ? 7 : 5) as Size,
    pace: raw.pace,
    status: raw.status,
    turn: (raw.turn === 1 ? 1 : 0) as Side,
    result: raw.result,
    reason: raw.reason,
    createdAt: raw.createdAt,
    lastMoveAt: raw.lastMoveAt,
    endedAt: raw.endedAt,
    deadline: raw.deadline,
    moveCount: raw.moveCount,
    board: [...raw.board],
  }
}

type RawPlayer = {
  wallet: Address
  nickname: string
  wins: number
  losses: number
  draws: number
  bestStore: number
  tables: number
}

const toPlayer = (raw: RawPlayer): Player => ({ ...raw, wallet: getAddress(raw.wallet) })

// ───────────────────────────── Reads ─────────────────────────────
// The public mainnet RPC has eth_getLogs switched off, so everything comes from view functions.

export async function fetchStats(): Promise<Stats> {
  const [tables, playing, finished, moves, players] = await publicClient.readContract({
    ...contract(),
    functionName: 'stats',
  })
  return {
    tables: Number(tables),
    playing: Number(playing),
    finished: Number(finished),
    moves: Number(moves),
    players: Number(players),
  }
}

/** Newest first, up to `max` tables. */
export async function fetchRecentTables(max = 200): Promise<Table[]> {
  const out: Table[] = []
  let cursor = 0n
  do {
    const [page, next] = await publicClient.readContract({
      ...contract(),
      functionName: 'getTables',
      args: [cursor, PAGE],
    })
    out.push(...page.map(toTable))
    cursor = next
  } while (cursor !== 0n && out.length < max)
  return out
}

export async function fetchTable(id: bigint): Promise<{ table: Table; moves: number[] }> {
  const c = contract()
  const count = await publicClient.readContract({ ...c, functionName: 'tableCount' })
  if (id < 1n || id > count) throw new TableMissingError()
  const [raw, log] = await Promise.all([
    publicClient.readContract({ ...c, functionName: 'getTable', args: [id] }),
    publicClient.readContract({ ...c, functionName: 'getMoves', args: [id] }),
  ])
  return { table: toTable(raw), moves: Array.from(hexToBytes(log as Hex)) }
}

/** Every table a wallet opened or sat at, newest first. */
export async function fetchTablesOf(wallet: Address): Promise<Table[]> {
  const c = contract()
  const ids = await publicClient.readContract({ ...c, functionName: 'tablesOf', args: [wallet] })
  const newestFirst = [...ids].reverse()
  const out: Table[] = []
  for (let i = 0; i < newestFirst.length; i += Number(PAGE)) {
    const chunk = newestFirst.slice(i, i + Number(PAGE))
    const page = await publicClient.readContract({ ...c, functionName: 'getTablesByIds', args: [chunk] })
    out.push(...page.filter((t) => t.id !== 0n).map(toTable))
  }
  return out
}

export async function fetchPlayers(): Promise<Player[]> {
  const out: Player[] = []
  let cursor = 0n
  do {
    const [page, next] = await publicClient.readContract({
      ...contract(),
      functionName: 'getPlayers',
      args: [cursor, PAGE],
    })
    out.push(...page.map(toPlayer))
    cursor = next
  } while (cursor !== 0n)
  return out
}

export async function fetchPlayer(wallet: Address): Promise<Player> {
  return toPlayer(await publicClient.readContract({ ...contract(), functionName: 'playerOf', args: [wallet] }))
}

export async function fetchNicknames(wallets: readonly Address[]): Promise<readonly string[]> {
  if (wallets.length === 0) return []
  return publicClient.readContract({ ...contract(), functionName: 'getNicknames', args: [wallets] })
}

// ───────────────────────────── Writes ─────────────────────────────
// Each call is dry-run first. A rule the contract would reject shows up here as a readable
// message before the wallet is asked to sign anything.

export const prepare = {
  openTable: (account: Address, size: number, pace: number, invited: Address | undefined) =>
    publicClient.simulateContract({
      ...contract(),
      account,
      functionName: 'openTable',
      args: [size, pace, invited ?? zeroAddress],
    }),
  cancelTable: (account: Address, id: bigint) =>
    publicClient.simulateContract({ ...contract(), account, functionName: 'cancelTable', args: [id] }),
  sit: (account: Address, id: bigint) =>
    publicClient.simulateContract({ ...contract(), account, functionName: 'sit', args: [id] }),
  play: (account: Address, id: bigint, hole: number) =>
    publicClient.simulateContract({ ...contract(), account, functionName: 'play', args: [id, hole] }),
  resign: (account: Address, id: bigint) =>
    publicClient.simulateContract({ ...contract(), account, functionName: 'resign', args: [id] }),
  claimTimeout: (account: Address, id: bigint) =>
    publicClient.simulateContract({ ...contract(), account, functionName: 'claimTimeout', args: [id] }),
  setNickname: (account: Address, nickname: string) =>
    publicClient.simulateContract({ ...contract(), account, functionName: 'setNickname', args: [nickname] }),
}
