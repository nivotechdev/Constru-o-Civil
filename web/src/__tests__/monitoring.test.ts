// L05: what goes to Sentry carries no personal data, and the stack keeps what the source maps need.
import { describe, expect, it } from 'vitest';
import { beforeSend, buildEvent, parseStack, scrubText } from '../services/monitoring';

const PERSONAL = [
  'ana.souza+obra@gmail.com',
  '529.982.247-25',
  '52998224725',
  '11.222.333/0001-81',
  '11222333000181',
  '(11) 98888-7777',
  '+55 11 988887777',
  '11988887777',
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl',
  'Bearer abcdefghijklmnop',
  'access_token=abcdefghijklmnop',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
];

describe('Sentry sem dado pessoal (L05)', () => {
  it('scrubs e-mail, CPF, CNPJ, phone, tokens and ids', () => {
    for (const piece of PERSONAL) {
      const out = scrubText(`falhou para ${piece} agora`);
      expect(out).not.toContain(piece.replace(/^(Bearer |access_token=)/, ''));
      expect(out.startsWith('falhou para ')).toBe(true);
    }
    expect(scrubText('ana@x.com')).toBe('<email>');
    expect(scrubText('CPF 529.982.247-25')).toBe('CPF <cpf>');
    expect(scrubText('CNPJ 11.222.333/0001-81')).toBe('CNPJ <cnpj>');
    expect(scrubText('vaga BC-42')).toBe('vaga :vaga');
  });

  it('leaves ordinary messages alone', () => {
    expect(scrubText("Cannot read properties of undefined (reading 'map')")).toBe(
      "Cannot read properties of undefined (reading 'map')"
    );
  });

  it('beforeSend cleans message, tags and extras of a whole event, keeping the frames usable', () => {
    const err = new Error('Falha ao salvar o WhatsApp 11988887777 de ana@x.com');
    err.stack = [
      'Error: Falha ao salvar o WhatsApp 11988887777 de ana@x.com',
      '    at saveProfile (https://bicos.nivotech.com.br/assets/Profile-DG4SrBm_.js:1:2345)',
      '    at https://bicos.nivotech.com.br/assets/index-AbC123.js?v=1:10:20'
    ].join('\n');
    const event = beforeSend(
      buildEvent(err, { where: 'render', email: 'ana@x.com', componentStack: 'at <cpf 52998224725>' })
    );
    const text = JSON.stringify(event);
    expect(text).not.toContain('ana@x.com');
    expect(text).not.toContain('11988887777');
    expect(text).not.toContain('52998224725');
    const frames = event.exception.values[0].stacktrace?.frames ?? [];
    expect(frames).toHaveLength(2);
    // Oldest call first; script addresses untouched except the query string.
    expect(frames[0].filename).toBe('https://bicos.nivotech.com.br/assets/index-AbC123.js');
    expect(frames[1]).toMatchObject({
      function: 'saveProfile',
      filename: 'https://bicos.nivotech.com.br/assets/Profile-DG4SrBm_.js',
      lineno: 1,
      colno: 2345
    });
    expect(event.release).toMatch(/^bicos-web@/);
  });

  it('reads Firefox and Safari stacks too', () => {
    expect(parseStack('save@https://x.com/assets/a.js:3:9\n@https://x.com/assets/b.js:1:1')).toEqual([
      { function: '?', filename: 'https://x.com/assets/b.js', lineno: 1, colno: 1, in_app: true },
      { function: 'save', filename: 'https://x.com/assets/a.js', lineno: 3, colno: 9, in_app: true }
    ]);
  });
});
