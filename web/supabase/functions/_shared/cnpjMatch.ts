// AUD-013: o CNPJ ativo na Receita não basta para o selo "Verificada" — qualquer pessoa pode digitar o CNPJ de uma
// empresa conhecida. O selo automático exige que o nome digitado bata com a razão social ou o nome fantasia E que o
// telefone (ou o e-mail) da conta seja o que a Receita tem para o CNPJ. Sem isso a conta fica "pendente" para a
// conferência da equipe. Funções puras, sem Deno nem rede (testáveis no Vitest).

const STOP = new Set(['ltda', 'me', 'mei', 'eireli', 'epp', 'sa', 'cia', 'de', 'da', 'do', 'das', 'dos', 'e']);

function tokens(text: string | null | undefined): string[] {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t));
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((t) => b.has(t));
}

function covers(inner: Set<string>, outer: Set<string>): boolean {
  return inner.size >= 2 && [...inner].every((t) => outer.has(t));
}

/** O nome digitado é o da razão social ou o do nome fantasia (sem acento, caixa nem "LTDA"). */
export function sameCompanyName(typed: string, legalName: string | null, fantasyName: string | null): boolean {
  const t = new Set(tokens(typed));
  if (!t.size) return false;
  return [legalName, fantasyName].some((candidate) => {
    const c = new Set(tokens(candidate));
    return c.size > 0 && (sameSet(t, c) || covers(t, c) || covers(c, t));
  });
}

const last8 = (value: string | null | undefined): string => (value ?? '').replace(/\D/g, '').slice(-8);

/** O WhatsApp da conta é um dos telefones da Receita (últimos 8 dígitos), ou o e-mail da conta é o da Receita. */
export function sameContact(
  body: Record<string, unknown>,
  whatsapp: string | null | undefined,
  email: string | null | undefined
): boolean {
  const mine = last8(whatsapp);
  const phones = [body.ddd_telefone_1, body.ddd_telefone_2].map((p) => last8(typeof p === 'string' ? p : ''));
  const phoneOk = mine.length === 8 && phones.includes(mine);
  const theirs = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const emailOk = Boolean(theirs) && theirs === (email ?? '').trim().toLowerCase();
  return phoneOk || emailOk;
}

export type CnpjDecision = {
  status: 'verificada' | 'reprovada' | 'pendente';
  motivo?: string;
  confere?: { nome: boolean; contato: boolean };
};

/** O que fazer com a resposta da Receita (situação cadastral + dados da empresa) e os dados da conta. */
export function decideCnpjStatus(input: {
  situacao: string;
  body: Record<string, unknown>;
  name: string;
  whatsapp: string | null | undefined;
  email: string | null | undefined;
}): CnpjDecision {
  const { situacao, body } = input;
  if (!situacao) return { status: 'pendente' };
  if (situacao !== 'ATIVA') return { status: 'reprovada', motivo: situacao.toLowerCase() };
  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : null);
  const nome = sameCompanyName(input.name, str('razao_social'), str('nome_fantasia'));
  const contato = sameContact(body, input.whatsapp, input.email);
  if (nome && contato) return { status: 'verificada', confere: { nome, contato } };
  return { status: 'pendente', motivo: 'dados-nao-conferem', confere: { nome, contato } };
}
