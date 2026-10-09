/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the API is (for example /api behind the gateway). Unset: the app
   *  keeps its data in this browser, as it does today. */
  readonly VITE_API_URL?: string;
  /** The workspace to open when VITE_API_URL is set. */
  readonly VITE_WORKSPACE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
