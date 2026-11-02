// Piloto enxuto (02/11/2026): para lançar sem advogado nem contador, em modo real o impulsionamento (pagamento) e a
// verificação de identidade (selfie + documento) ficam INATIVOS; só a demonstração os mostra. Ligar de novo é uma
// decisão dos sócios (variável de build + chave em app_config).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IDENTITY_CONSENT, PRIVACY, TERMS } from '../services/legal';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

describe('piloto enxuto', () => {
  const features = read('src/services/features.ts');

  it('payments need the provider configured; identity needs its own switch', () => {
    expect(features).toMatch(
      /payments: IS_DEMO \|\| \(env\.VITE_PAGAMENTOS === 'mercadopago' && Boolean\(env\.VITE_MP_PUBLIC_KEY\)\)/
    );
    expect(features).toMatch(/identity: IS_DEMO \|\| on\(env\.VITE_VERIFICACAO_IDENTIDADE\)/);
  });

  it('the screens that offer the identity check ask the switch', () => {
    expect(read('src/pages/shared/WorkerProfileScreen.tsx')).toMatch(/!FEATURES\.identity/);
    expect(read('src/pages/worker/VerifyIdentity.tsx')).toMatch(/!FEATURES\.identity\) return <IdentityUnavailable/);
  });

  it('no workflow or example turns the two features on', () => {
    for (const file of ['.env.example', '.env.staging.example']) {
      const text = read(file);
      expect(text, file).toMatch(/^VITE_VERIFICACAO_IDENTIDADE=$/m);
      expect(text, file).toMatch(/^VITE_PAGAMENTOS=$/m);
    }
  });

  it('the only blanks left in the legal texts are the company data only the partners know', () => {
    const text = [TERMS, PRIVACY]
      .flatMap((d) => d.sections.flatMap((s) => [s.title, ...s.body]))
      .concat(IDENTITY_CONSENT.points)
      .join('\n');
    const blanks = [...new Set(text.match(/\{\{[A-Z0-9_]+\}\}/g) ?? [])].sort();
    expect(blanks).toEqual([
      '{{CIDADE_FORO}}',
      '{{CNPJ}}',
      '{{DPO_EMAIL}}',
      '{{DPO_NOME}}',
      '{{ENDERECO}}',
      '{{RAZAO_SOCIAL}}'
    ]);
  });

  it('the texts do not promise payments, retention periods or a review that do not exist', () => {
    const text = [TERMS, PRIVACY].flatMap((d) => d.sections.flatMap((s) => s.body)).join('\n');
    expect(text).not.toMatch(/Mercado Pago|por obrigação fiscal|Marco Civil/);
    expect(text).toMatch(/não cobra nada/);
  });
});
