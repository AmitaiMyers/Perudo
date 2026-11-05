/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Socket.io server URL, e.g. https://perudo-server.onrender.com. Defaults to port 3001 on the page's host. */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
