/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRANSCRIPT_WORKER_URL: string;
  readonly VITE_TRANSCRIPT_AUTH_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
