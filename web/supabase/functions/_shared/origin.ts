// L05: de onde o navegador pode chamar as funções (CORS). APP_ORIGIN é obrigatório nas funções do navegador
// (R02: as servidor-a-servidor não usam) — sem ele elas não
// sobem (antes caía para "*", qualquer site podia chamar). Aceita uma lista separada por vírgula, com "*"
// só no começo do nome do servidor para as prévias por PR (ex.: https://*.bicos-app.pages.dev).
// Sem Deno aqui: os testes do app (Vitest) importam este arquivo.

export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** A mensagem do erro que impede a função de subir sem APP_ORIGIN, ou null quando está tudo certo. */
export function originsProblem(origins: string[]): string | null {
  if (!origins.length) return 'APP_ORIGIN não configurado (Edge Functions › Secrets): endereço publicado do app.';
  const bad = origins.find(
    (o) => !/^https:\/\/(\*\.)?[a-z0-9.-]+(:\d+)?$/i.test(o) && !/^http:\/\/localhost(:\d+)?$/.test(o)
  );
  return bad ? `APP_ORIGIN inválido: "${bad}" (use https://dominio, sem caminho).` : null;
}

/** A origem a devolver em Access-Control-Allow-Origin: a do pedido, se permitida; senão a primeira da lista. */
export function allowedOrigin(origins: string[], requestOrigin: string | null): string {
  if (requestOrigin) {
    for (const o of origins) {
      if (o === requestOrigin) return requestOrigin;
      const wild = /^https:\/\/\*\.(.+)$/.exec(o);
      if (wild && /^https:\/\/[a-z0-9-]+\./i.test(requestOrigin) && requestOrigin.endsWith('.' + wild[1]))
        return requestOrigin;
    }
  }
  return origins[0];
}

/** Os cabeçalhos CORS de uma resposta a `requestOrigin`. */
export function corsHeaders(origins: string[], requestOrigin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(origins, requestOrigin),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

/** R02: as funções que o navegador chama (exigem APP_ORIGIN). As outras são chamadas pelo banco ou por provedor. */
export const BROWSER_FUNCTIONS = [
  'entrar-com-firebase',
  'verificar-cadastro',
  'codigo-whatsapp',
  'criar-cobranca',
  'entrar-com-documento',
  'excluir-conta',
  'verificar-cnpj'
] as const;
export const SERVER_FUNCTIONS = ['enviar-push', 'limpar-arquivos', 'webhook-pagamento'] as const;
