interface ImportMetaEnv {
  /** 'local' | 'testnet' | 'mainnet'. Defaults to local in dev and mainnet in production. */
  readonly VITE_CHAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
