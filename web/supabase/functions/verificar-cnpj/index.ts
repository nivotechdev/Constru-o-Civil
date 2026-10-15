// Verificação automática da construtora (L10): consulta o CNPJ na BrasilAPI (dados públicos da Receita).
//
// O app chama com o token da sessão, sem corpo, depois de completar o perfil ou pelo "Verificar agora".
// - Situação cadastral ATIVA → set_company_verification('verificada') (o selo aparece e chega o aviso).
// - BAIXADA / INAPTA / SUSPENSA / NULA → 'reprovada' (não publica até falar com a equipe).
// - CPF (recrutador por conta própria), CNPJ não encontrado ou a BrasilAPI fora do ar → continua 'pendente'
//   para a conferência manual. Até 5 consultas por construtora por dia.
//
// Respostas: 200 { status: 'verificada' | 'reprovada' | 'pendente', motivo? } · 401 · 429 · 502.
// Não precisa de chave: a BrasilAPI é aberta. BRASILAPI_URL troca o endereço (testes).
// L06: a resposta (razão social, situação, abertura, atividade, cidade) fica em companies.cnpj_check para a
// fila de construtoras do /admin.
import { adminClient, CORS, json, requestUser } from '../_shared/http.ts';
import { monitored } from '../_shared/monitoring.ts';

const API = Deno.env.get('BRASILAPI_URL') ?? 'https://brasilapi.com.br/api/cnpj/v1/';

Deno.serve(
  monitored('verificar-cnpj', async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ erro: 'metodo' }, 405);
    const user = await requestUser(req);
    if (!user) return json({ erro: 'BC401', mensagem: 'Entre na sua conta de novo para continuar.' }, 401);
    const admin = adminClient();

    const { data: company } = await admin
      .from('companies')
      .select('id, verification_status')
      .eq('id', user.id)
      .maybeSingle();
    if (!company) return json({ erro: 'BC401', mensagem: 'Essa conta não é de construtora.' }, 401);
    if (company.verification_status !== 'pendente') return json({ status: company.verification_status });

    const limit = await admin.rpc('rate_limit_hit', { p_key: 'cnpj:' + user.id, p_max: 5, p_window: '1 day' });
    if (limit.error) return json({ erro: 'falha' }, 502);
    if (limit.data === true)
      return json({ erro: 'muitas-tentativas', mensagem: 'Já conferimos hoje. Tente de novo amanhã.' }, 429);

    const { data: cnpj, error } = await admin.rpc('company_cnpj_for_check', { p_company: user.id });
    if (error) return json({ erro: 'falha' }, 502);
    if (!cnpj) return json({ status: 'pendente', motivo: 'sem-cnpj' });

    let situacao = '';
    try {
      const res = await fetch(API + cnpj, { headers: { Accept: 'application/json' } });
      if (res.status === 404) return json({ status: 'pendente', motivo: 'nao-encontrado' });
      if (!res.ok) return json({ status: 'pendente', motivo: 'indisponivel' });
      const body = (await res.json()) as Record<string, unknown>;
      situacao = String(body.descricao_situacao_cadastral ?? '').toUpperCase();
      // L06: o que a Receita respondeu fica para a fila da equipe (dados públicos da empresa, não da pessoa).
      const pick = (k: string) => (typeof body[k] === 'string' || typeof body[k] === 'number' ? String(body[k]) : null);
      await admin
        .from('companies')
        .update({
          cnpj_check: {
            razao_social: pick('razao_social'),
            nome_fantasia: pick('nome_fantasia'),
            situacao: situacao || null,
            data_situacao: pick('data_situacao_cadastral'),
            abertura: pick('data_inicio_atividade'),
            atividade: pick('cnae_fiscal_descricao'),
            municipio: pick('municipio'),
            uf: pick('uf'),
            consultado_em: new Date().toISOString()
          }
        })
        .eq('id', user.id);
    } catch {
      return json({ status: 'pendente', motivo: 'indisponivel' });
    }

    const status = situacao === 'ATIVA' ? 'verificada' : situacao ? 'reprovada' : 'pendente';
    if (status !== 'pendente') {
      const { error: setError } = await admin.rpc('set_company_verification', { p_company: user.id, p_status: status });
      if (setError) return json({ erro: 'falha' }, 502);
    }
    return json({ status, ...(situacao && status === 'reprovada' ? { motivo: situacao.toLowerCase() } : {}) });
  })
);
