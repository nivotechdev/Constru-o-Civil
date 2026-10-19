// L03 — Roda UMA Edge Function do projeto no Deno desta máquina, na porta PORT (o Supabase local sem Edge
// Runtime). Só para o E2E local: em staging/produção as funções rodam no Supabase.
//   deno run -A e2e/local/serve-fn.ts <nome-da-função>
const name = Deno.args[0];
const port = Number(Deno.env.get('PORT') ?? '8000');
const serve = Deno.serve.bind(Deno);
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (handler: Deno.ServeHandler) =>
  serve({ port, onListen: () => console.log(`${name} :${port}`) }, handler);
await import(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url).href);
