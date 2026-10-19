// L04 (lançamento): the four Auth e-mails (supabase/email-templates/) — in Portuguese, with the link the Auth
// fills in, and nothing that hurts delivery (no remote images or scripts).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = fileURLToPath(new URL('../../supabase/email-templates/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.html'));

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
    it(`${f}: link do Auth, pt-BR, sem imagem nem script de fora`, () => {
      const html = readFileSync(dir + f, 'utf8');
      expect(html).toContain('href="{{ .ConfirmationURL }}"');
      expect(html).toContain('lang="pt-BR"');
      expect(html).not.toMatch(/<img|<script|<link /i);
      expect(html).not.toMatch(/\{\{\s*\.Token\s*\}\}/); // a link, not a code to type
    });
  }

  it('the e-mail change says the new address', () => {
    expect(readFileSync(dir + 'troca-de-email.html', 'utf8')).toContain('{{ .NewEmail }}');
  });
});
