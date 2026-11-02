// AUD-013: an active CNPJ alone does not give the "Verificada" seal. The name typed and the phone/e-mail of the
// account must match what the Receita has for that CNPJ; otherwise the company stays "pendente" for the staff.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decideCnpjStatus, sameCompanyName } from '../../supabase/functions/_shared/cnpjMatch.ts';

const receita = {
  razao_social: 'PADARIA BELEM COMERCIO DE ALIMENTOS LTDA',
  nome_fantasia: 'Padaria Belém',
  ddd_telefone_1: '5432223333',
  ddd_telefone_2: '54999998888',
  email: 'contato@padariabelem.com.br'
};
const account = { name: 'Padaria Belém', whatsapp: '(54) 99999-8888', email: 'dono@gmail.com' };

describe('nome da empresa (AUD-013)', () => {
  it('matches the fantasy name or the legal name, ignoring accents, case and "LTDA"', () => {
    expect(sameCompanyName('Padaria Belém', receita.razao_social, receita.nome_fantasia)).toBe(true);
    expect(sameCompanyName('padaria belem comercio de alimentos', receita.razao_social, null)).toBe(true);
    expect(sameCompanyName('Belem', receita.razao_social, null)).toBe(false);
  });
  it('another company is not the same', () => {
    expect(sameCompanyName('Mercado Vila Prudente', receita.razao_social, receita.nome_fantasia)).toBe(false);
    expect(sameCompanyName('', receita.razao_social, receita.nome_fantasia)).toBe(false);
  });
});

describe('decisão da verificação (AUD-013)', () => {
  it('active + same name + same phone → verified', () => {
    expect(decideCnpjStatus({ situacao: 'ATIVA', body: receita, ...account })).toMatchObject({ status: 'verificada' });
  });
  it('active + same name + same e-mail → verified', () => {
    expect(
      decideCnpjStatus({
        situacao: 'ATIVA',
        body: receita,
        name: 'Padaria Belém',
        whatsapp: '11911112222',
        email: 'Contato@PadariaBelem.com.br'
      })
    ).toMatchObject({ status: 'verificada' });
  });
  it('active but ANOTHER name → stays pending, with the reason (the test from the audit)', () => {
    expect(decideCnpjStatus({ situacao: 'ATIVA', body: receita, ...account, name: 'Mercado Vila Prudente' })).toEqual({
      status: 'pendente',
      motivo: 'dados-nao-conferem',
      confere: { nome: false, contato: true }
    });
  });
  it('active, same name, but a contact that is not the company’s → pending', () => {
    expect(
      decideCnpjStatus({
        situacao: 'ATIVA',
        body: receita,
        name: 'Padaria Belém',
        whatsapp: '11911112222',
        email: 'x@y.com'
      })
    ).toMatchObject({ status: 'pendente', confere: { nome: true, contato: false } });
  });
  it('closed/unfit CNPJ is refused, no answer stays pending', () => {
    expect(decideCnpjStatus({ situacao: 'BAIXADA', body: receita, ...account })).toMatchObject({ status: 'reprovada' });
    expect(decideCnpjStatus({ situacao: '', body: receita, ...account })).toMatchObject({ status: 'pendente' });
  });
});

describe('verificar-cnpj usa a decisão (AUD-013)', () => {
  it('the function no longer verifies on an active CNPJ alone', () => {
    const source = readFileSync(new URL('../../supabase/functions/verificar-cnpj/index.ts', import.meta.url), 'utf8');
    expect(source).toContain('decideCnpjStatus');
    expect(source).not.toMatch(/situacao === 'ATIVA'/);
  });
});
