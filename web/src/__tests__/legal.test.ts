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

// AUD-092: the text of a version never changes under the same number. If this fails after editing a paragraph, raise
// `version` and `updatedAt` in services/legal.ts (everyone accepts again) and put the new hash here.
import { createHash } from 'node:crypto';
const BODY_HASH: Record<string, string> = {
  'Termos de uso@3.0': 'd59d5de668ad264805c1980f224b8314b78a138a7553fdfe0f5571498dd5bb32',
  'Política de privacidade@3.0': 'ce722eb2c1284c4d035082add86699ce417ee829db85640c05f6454146d048bc'
};
describe('versão do texto legal (AUD-092)', () => {
  for (const doc of [TERMS, PRIVACY]) {
    it(`${doc.title}: o texto desta versão não mudou sem subir a versão`, () => {
      const key = `${doc.title}@${doc.version}`;
      const hash = createHash('sha256').update(JSON.stringify(doc.sections)).digest('hex');
      expect(BODY_HASH[key], `texto novo para ${key}: hash ${hash}`).toBe(hash);
    });
  }
});
