/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_TABLE_OF_CONTENT_AUTO_COLLAPSE?: string | boolean;
  // Back-compat
  readonly PUBLIC_TOC_AUTO_COLLAPSE?: string | boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}