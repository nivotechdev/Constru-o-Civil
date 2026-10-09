// Which backend the app runs on, decided once at build time:
//   - demo: no Supabase project configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing) — the
//     in-memory demo data, the demo accounts and the simulations (as in the preview and the tests);
//   - real: those variables are set — accounts, data and files live in Supabase (services/remote/).
// The screens are the same in both; only the services' bodies and a few demo-only hints differ.
import { isSupabaseConfigured } from './supabase';

/** True on the in-memory demo data; false when the app is connected to Supabase. */
export const IS_DEMO = !isSupabaseConfigured();
