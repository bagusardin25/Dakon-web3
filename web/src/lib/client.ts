import { createPublicClient, http } from 'viem'
import { chain, rpcUrl } from '../config/chains'

/** Read-only connection to the chain. Works without a wallet, so anyone can watch a game. */
export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl, { retryCount: 2, timeout: 15_000 }),
})
