// Cliente único do Supabase para o app. A URL e a chave "anon" (pública por
// natureza — toda a segurança de verdade vem das políticas de RLS no banco)
// seguem o mesmo padrão já usado no front antigo (config/supabaseConfig.js).
//
// `detectSessionInUrl` fica false aqui (diferente do front antigo): esta SPA
// usa `location.hash` para roteamento (#/rota), e o parser de link mágico do
// Supabase também mexe na URL — as duas coisas colidem. Os fluxos que dependem
// de um link por e-mail (confirmar cadastro, redefinir senha) tratam o token
// explicitamente nas telas correspondentes em vez de depender dessa flag.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ppnxdajiihsjaojxokzh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwbnhkYWppaWhzamFvanhva3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MzE0OTEsImV4cCI6MjEwNDMwNzQ5MX0.11GhZnFvGZHyEwjB9JK06CTg9UpknuRqqlofQf8HF7s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});
