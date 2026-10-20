// L04 (lançamento): the four Auth e-mails (supabase/email-templates/) — in Portuguese, with the link the Auth
// fills in, and nothing that hurts delivery (no remote images or scripts).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = fileURLToPath(new URL('../../supabase/email-templates/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.html'));
const CODES = ['confirmacao.html', 'link-de-acesso.html'];

describe('e-mails do Auth (L04)', () => {
  it('has the four templates', () => {
    expect(files.sort()).toEqual([
      'confirmacao.html',
      'link-de-acesso.html',
      'redefinir-senha.html',
      'troca-de-email.html'
    ]);
  });

  for (const f of files) {
    it(`${f}: link ou código do Auth, pt-BR, sem imagem nem script de fora`, () => {
      const html = readFileSync(dir + f, 'utf8');
      expect(html).toContain('lang="pt-BR"');
      expect(html).not.toMatch(/<img|<script|<link /i);
      // U11/U16: the sign-up confirmation and the security code carry a code to type; the others are links.
      if (CODES.includes(f)) expect(html.match(/\{\{ \.Token \}\}/g)?.length).toBeGreaterThanOrEqual(2);
      else expect(html).not.toMatch(/\{\{\s*\.Token\s*\}\}/);
      // U16: the security code has no link — it only works inside the app, for the account already logged in.
      if (f === 'link-de-acesso.html') expect(html).not.toContain('{{ .ConfirmationURL }}');
      else expect(html).toContain('href="{{ .ConfirmationURL }}"');
    });
  }

  it('U11: the sign-up code shows in the preview and can be selected in one tap', () => {
    const html = readFileSync(dir + 'confirmacao.html', 'utf8');
    expect(html).toMatch(/display: none[^>]*>\s*Seu código da Bicos: \{\{ \.Token \}\}/);
    expect(html).toMatch(/user-select: all;[\s\S]*\{\{ \.Token \}\}/);
  });

  it('U17: the code e-mails have a "Copiar código" button that opens the copy page with the code after the #', () => {
    for (const f of CODES) {
      const html = readFileSync(dir + f, 'utf8');
      expect(html).toContain('href="{{ .SiteURL }}copiar-codigo#{{ .Token }}"');
      expect(html).toContain('Copiar código');
    }
  });

  it('the e-mail change says the new address', () => {
    expect(readFileSync(dir + 'troca-de-email.html', 'utf8')).toContain('{{ .NewEmail }}');
  });
});
