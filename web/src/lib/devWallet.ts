// Development only. Loaded through a dynamic import that production builds drop.
//
// A local Hardhat node signs for its own unlocked accounts, so these wallets hold no keys:
// they ask the node to send from one of its addresses. Two browser windows with two dev
// wallets are enough to play a whole game without an extension.
import { createWalletClient, http } from 'viem'
import type { Address, WalletClient } from 'viem'
import { chain, rpcUrl } from '../config/chains'

export type DevWallet = { id: string; name: string; account: Address; client: WalletClient }

// Account 0 deploys the contract; 7 to 9 are left alone by the seed script
// (apart from one table reserved for account 7).
const SLOTS = [
  { index: 0, name: 'Dev wallet · Deployer' },
  { index: 7, name: 'Dev wallet · Tari' },
  { index: 8, name: 'Dev wallet · Yudi' },
  { index: 9, name: 'Dev wallet · Rina' },
]

export async function loadDevWallets(): Promise<DevWallet[]> {
  const client = createWalletClient({ chain, transport: http(rpcUrl) })
  const accounts = await client.getAddresses()
  return SLOTS.filter((slot) => accounts[slot.index]).map((slot) => ({
    id: `dev:${slot.index}`,
    name: slot.name,
    account: accounts[slot.index],
    client,
  }))
}
