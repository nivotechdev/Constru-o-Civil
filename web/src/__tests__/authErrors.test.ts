// AUD-096: wrong-password/code checks tell "too many tries" and "account suspended" apart from a generic failure.
// AUD-097: Firebase's captcha failure is not "feature off"; in-app browsers get "open it in Chrome or Safari".
import { describe, expect, it } from 'vitest';
import { sharedAuthError } from '../services/remote/auth';
import { firebaseError } from '../services/remote/firebase';

describe('erros de senha e código (AUD-096)', () => {
  it('muitas tentativas viram "conflito" com a mensagem de espera', () => {
    const e = sharedAuthError({ code: 'over_request_rate_limit', message: 'x' });
    expect(e?.code).toBe('conflito');
    expect(e?.message).toMatch(/Muitas tentativas/);
    expect(sharedAuthError({ status: 429, message: 'x' })?.code).toBe('conflito');
  });
  it('conta suspensa e captcha têm a própria mensagem', () => {
    expect(sharedAuthError({ code: 'user_banned' })?.code).toBe('nao_autorizado');
    expect(sharedAuthError({ code: 'captcha_failed' })?.code).toBe('validacao');
  });
  it('outro erro fica com quem chamou', () => {
    expect(sharedAuthError({ code: 'unexpected_failure' })).toBeNull();
    expect(sharedAuthError(null)).toBeNull();
  });
});

describe('erros do Firebase (AUD-097)', () => {
  it('captcha que falhou pede para tentar de novo e não diz "desligado"', () => {
    for (const code of ['auth/captcha-check-failed', 'auth/missing-recaptcha-token']) {
      const e = firebaseError({ code });
      expect(e.code).toBe('validacao');
      expect(e.message).toMatch(/robô/);
      expect(e.message).not.toMatch(/ainda não está ligado/);
    }
  });
  it('navegador embutido manda abrir no Chrome ou Safari', () => {
    for (const code of ['auth/web-storage-unsupported', 'auth/operation-not-supported-in-this-environment']) {
      expect(firebaseError({ code }).message).toMatch(/Chrome ou no Safari/);
    }
  });
  it('recurso realmente desligado segue com a mensagem antiga', () => {
    expect(firebaseError({ code: 'auth/operation-not-allowed' }).message).toMatch(/ainda não está ligado/);
  });
});
