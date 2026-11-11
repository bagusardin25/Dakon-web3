import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createWalletClient, custom, getAddress, numberToHex } from 'viem'
import type { Address, WalletClient } from 'viem'
import { chain, NETWORK, rpcUrl } from '../config/chains'
import { describeError } from './errors'

/** The slice of EIP-1193 this app uses. */
type Provider = {
  request(args: { method: string; params?: unknown }): Promise<unknown>
  on?(event: string, listener: (...args: never[]) => void): void
  removeListener?(event: string, listener: (...args: never[]) => void): void
}

type Announcement = { info: { uuid: string; name: string; icon: string; rdns: string }; provider: Provider }

export type Connector = {
  id: string
  name: string
  icon?: string
  kind: 'injected' | 'dev'
  provider?: Provider
  account?: Address
  client?: WalletClient
}

export type ActiveWallet = {
  connectorId: string
  connectorName: string
  account: Address
  chainId: number
  client: WalletClient
  provider?: Provider
}

type WalletContext = {
  connectors: Connector[]
  active: ActiveWallet | undefined
  /** True when a wallet is connected but pointed at another network. */
  wrongChain: boolean
  connecting: string | undefined
  error: string | undefined
  connect(connector: Connector): Promise<void>
  disconnect(): void
  switchChain(): Promise<boolean>
  dialogOpen: boolean
  openDialog(): void
  closeDialog(): void
}

const Ctx = createContext<WalletContext | null>(null)
const STORAGE_KEY = 'dakon.wallet'

const remember = (id: string | null) => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable (private mode). Reconnecting by hand still works.
  }
}

const remembered = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const toChainId = (value: unknown): number => (typeof value === 'string' ? Number.parseInt(value, 16) : Number(value))

const firstAccount = (value: unknown): Address | undefined =>
  Array.isArray(value) && typeof value[0] === 'string' ? getAddress(value[0]) : undefined

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [active, setActive] = useState<ActiveWallet>()
  const [connecting, setConnecting] = useState<string>()
  const [error, setError] = useState<string>()
  const [dialogOpen, setDialogOpen] = useState(false)
  const triedRestore = useRef(false)

  const addConnector = useCallback((next: Connector) => {
    setConnectors((list) => (list.some((c) => c.id === next.id) ? list : [...list, next]))
  }, [])

  // Discover wallets. EIP-6963 lets several extensions announce themselves side by side;
  // window.ethereum covers wallets and in-app browsers that have not adopted it.
  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Announcement>).detail
      if (!detail?.provider || !detail.info) return
      addConnector({
        id: detail.info.rdns || detail.info.uuid,
        name: detail.info.name,
        icon: detail.info.icon,
        kind: 'injected',
        provider: detail.provider,
      })
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))

    const fallback = window.setTimeout(() => {
      const legacy = (window as { ethereum?: Provider }).ethereum
      if (!legacy) return
      setConnectors((list) =>
        list.some((c) => c.kind === 'injected')
          ? list
          : [...list, { id: 'injected', name: 'Browser wallet', kind: 'injected', provider: legacy }],
      )
    }, 400)

    let cancelled = false
    if (import.meta.env.DEV && NETWORK === 'local') {
      import('./devWallet')
        .then(({ loadDevWallets }) => loadDevWallets())
        .then((wallets) => {
          if (cancelled) return
          wallets.forEach((w) => addConnector({ id: w.id, name: w.name, kind: 'dev', account: w.account, client: w.client }))
        })
        .catch(() => {
          // The local node is not running; real wallets still work.
        })
    }

    return () => {
      cancelled = true
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      window.clearTimeout(fallback)
    }
  }, [addConnector])

  const activate = useCallback(async (connector: Connector, prompt: boolean): Promise<boolean> => {
    if (connector.kind === 'dev') {
      if (!connector.account || !connector.client) return false
      setActive({
        connectorId: connector.id,
        connectorName: connector.name,
        account: connector.account,
        chainId: chain.id,
        client: connector.client,
      })
      return true
    }
    const provider = connector.provider
    if (!provider) return false
    const accounts = await provider.request({ method: prompt ? 'eth_requestAccounts' : 'eth_accounts' })
    const account = firstAccount(accounts)
    if (!account) return false
    const chainId = toChainId(await provider.request({ method: 'eth_chainId' }))
    const client = createWalletClient({ chain, transport: custom(provider as Parameters<typeof custom>[0]) })
    setActive({ connectorId: connector.id, connectorName: connector.name, account, chainId, client, provider })
    return true
  }, [])

  const connect = useCallback(
    async (connector: Connector) => {
      setError(undefined)
      setConnecting(connector.id)
      try {
        const ok = await activate(connector, true)
        if (ok) {
          remember(connector.id)
          setDialogOpen(false)
        } else {
          setError('That wallet did not share an account.')
        }
      } catch (err) {
        setError(describeError(err))
      } finally {
        setConnecting(undefined)
      }
    },
    [activate],
  )

  const disconnect = useCallback(() => {
    remember(null)
    setActive(undefined)
    setError(undefined)
  }, [])

  // Quietly restore the last wallet, without opening a wallet prompt.
  useEffect(() => {
    if (triedRestore.current || active) return
    const id = remembered()
    if (!id) return
    const connector = connectors.find((c) => c.id === id)
    if (!connector) return
    triedRestore.current = true
    activate(connector, false).catch(() => remember(null))
  }, [connectors, active, activate])

  // Follow account and network changes made inside the wallet.
  const provider = active?.provider
  useEffect(() => {
    if (!provider?.on) return
    const onAccounts = (accounts: unknown) => {
      const account = firstAccount(accounts)
      if (!account) {
        remember(null)
        setActive(undefined)
      } else {
        setActive((prev) => (prev ? { ...prev, account } : prev))
      }
    }
    const onChain = (chainId: unknown) => {
      setActive((prev) => (prev ? { ...prev, chainId: toChainId(chainId) } : prev))
    }
    provider.on('accountsChanged', onAccounts as (...args: never[]) => void)
    provider.on('chainChanged', onChain as (...args: never[]) => void)
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts as (...args: never[]) => void)
      provider.removeListener?.('chainChanged', onChain as (...args: never[]) => void)
    }
  }, [provider])

  const switchChain = useCallback(async (): Promise<boolean> => {
    if (!active) return false
    if (!active.provider) return true
    setError(undefined)
    const chainId = numberToHex(chain.id)
    try {
      try {
        await active.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
      } catch (err) {
        const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: unknown }).code : undefined
        const unknownChain = code === 4902 || /unrecognized chain|not been added/i.test(String((err as Error)?.message))
        if (!unknownChain) throw err
        const explorer = chain.blockExplorers?.default.url
        await active.provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: [rpcUrl],
              ...(explorer ? { blockExplorerUrls: [explorer] } : {}),
            },
          ],
        })
      }
      const now = toChainId(await active.provider.request({ method: 'eth_chainId' }))
      setActive((prev) => (prev ? { ...prev, chainId: now } : prev))
      return now === chain.id
    } catch (err) {
      setError(describeError(err))
      return false
    }
  }, [active])

  const value = useMemo<WalletContext>(
    () => ({
      connectors,
      active,
      wrongChain: !!active && active.chainId !== chain.id,
      connecting,
      error,
      connect,
      disconnect,
      switchChain,
      dialogOpen,
      openDialog: () => {
        setError(undefined)
        setDialogOpen(true)
      },
      closeDialog: () => setDialogOpen(false),
    }),
    [connectors, active, connecting, error, connect, disconnect, switchChain, dialogOpen],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWallet(): WalletContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>')
  return ctx
}
