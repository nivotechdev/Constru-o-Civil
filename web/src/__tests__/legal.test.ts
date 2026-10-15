// L07 (lançamento): the terms and the privacy policy exist in two places — the app (services/legal.ts) and
// /legal/*.md — and must say the same. The Markdown is generated: `LEGAL_WRITE=1 npx vitest run legal` rewrites it.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IDENTITY_CONSENT, legalMarkdown, PRIVACY, TERMS } from '../services/legal';

const FILES = [
  { doc: TERMS, file: '../../../legal/termos-de-uso.md' },
  { doc: PRIVACY, file: '../../../legal/politica-de-privacidade.md' }
];

describe('textos legais (L07)', () => {
  for (const { doc, file } of FILES) {
    it(`${doc.title}: /legal igual ao app`, () => {
      const path = fileURLToPath(new URL(file, import.meta.url));
      const expected = legalMarkdown(doc);
      if (process.env.LEGAL_WRITE === '1') writeFileSync(path, expected);
      expect(readFileSync(path, 'utf8')).toBe(expected);
    });
  }

  it('terms and policy share the version the sign-up records', () => {
    expect(PRIVACY.version).toBe(TERMS.version);
  });

  it('the policy covers what the app collects (sensitive data, operators, retention, rights, DPO)', () => {
    const text = PRIVACY.sections.flatMap((s) => [s.title, ...s.body]).join('\n');
    for (const needle of [
      'biométrico',
      'art. 11',
      '30 dias',
      'Supabase',
      'Cloudflare',
      'Mercado Pago',
      'Twilio',
      'Sentry',
      'Brevo',
      'art. 33',
      'ANPD',
      '{{DPO_EMAIL}}',
      '{{RAZAO_SOCIAL}}',
      '{{CNPJ}}'
    ])
      expect(text).toContain(needle);
    expect(IDENTITY_CONSENT.points.join(' ')).toContain('30 dias');
  });
});
