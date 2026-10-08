// The Supabase client — isolated here and not used by any screen yet. It is ready to be initialized
// from the environment (.env.local, see .env.example) and stays off when the variables are missing:
// then the app keeps running on the in-memory mock data, exactly as today.
//
// The library is loaded with a dynamic import on first use, so it isn't downloaded while the app is in
// mock mode. Creating the client doesn't touch the network either; requests only start when a query
// runs. How to connect the app step by step: docs/SUPABASE.md.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseDatabase } from '../types/supabase';

export type BicosSupabase = SupabaseClient<SupabaseDatabase>;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** The project's URL and public anon key from the environment, or `null` when either is missing. */
export function supabaseConfig(env: ImportMetaEnv = import.meta.env): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

/** False in mock mode (no project configured). */
export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

let client: Promise<BicosSupabase | null> | undefined;

/**
 * The app's shared client, created on the first call; `null` in mock mode. Callers must handle the
 * `null` case — that is what keeps the app working without a project.
 */
export function getSupabase(): Promise<BicosSupabase | null> {
  if (!client) {
    const config = supabaseConfig();
    client = config
      ? import('@supabase/supabase-js').then(({ createClient }) =>
          createClient<SupabaseDatabase>(config.url, config.anonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
          })
        )
      : Promise.resolve(null);
  }
  return client;
}
