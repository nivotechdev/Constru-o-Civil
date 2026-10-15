// L05: de onde o navegador pode chamar as funções (CORS). APP_ORIGIN é obrigatório — sem ele as funções não
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
