/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build-time switch for the offline helper (spec 014): 'off' unregisters it. */
  readonly VITE_OFFLINE_HELPER?: 'on' | 'off';
}
