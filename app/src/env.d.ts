/// <reference path="../.astro/types.d.ts" />
/// <reference types="vite/client" />

declare module '*.png?url' {
  const src: string;
  export default src;
}

// (Global window typings for Plotly/D3 are intentionally omitted; components handle typing inline.)