/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAX_FILE_COUNT?: string;
  readonly VITE_MAX_TOTAL_SIZE_MB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
