/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_CURRENCY_CODE: string
  readonly VITE_CURRENCY_SYMBOL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
