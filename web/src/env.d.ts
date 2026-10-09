/// <reference types="vite/client" />

// Environment variables the app reads. Vite exposes only the VITE_* ones to the browser, and replaces
// them at build time. Both are optional: without them the app runs on its in-memory mock data.
interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcdefgh.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** The project's public "anon" key — made for the browser; Row Level Security is what protects the data. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
