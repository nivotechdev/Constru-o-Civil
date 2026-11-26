// Bloco 2 (confiabilidade): erros inesperados chegam ao monitor sem dado pessoal (AUD-036), falha de rede numa Edge
// Function vira "offline" (AUD-130), o app se recupera de um download que falhou (AUD-131) e o aviso do tema diz o motivo
// verdadeiro (AUD-132).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reported = vi.hoisted(() => [] as { error: unknown; context: Record<string, string> }[]);
vi.mock('../services/monitoring', () => ({
  reportError: (error: unknown, context: Record<string, string> = {}) => reported.push({ error, context })
}));

import { toServiceError } from '../services/remote/client';

const src = (p: string) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8');

describe('AUD-036: erro inesperado vai ao monitor, sem dado pessoal', () => {
  beforeEach(() => {
    reported.length = 0;
  });
  it('um código que ninguém previu é enviado só com nome, código e status', () => {
    const e = toServiceError({ name: 'PostgrestError', code: 'PGRST202', message: 'ana@exemplo.com 123.456.789-00' });
    expect(e.code).toBe('falha_demo');
    expect(reported).toHaveLength(1);
    expect(reported[0].context).toMatchObject({ code: 'PGRST202', kind: 'PostgrestError' });
    expect(JSON.stringify(reported[0])).not.toMatch(/ana@exemplo|123\.456/);
  });
  it('o mesmo tipo de erro é enviado uma vez só (não gasta as vagas do monitor)', () => {
    for (let i = 0; i < 5; i++) toServiceError({ name: 'PostgrestError', code: 'PGRST999', message: 'x' });
    expect(reported).toHaveLength(1);
  });
  it('erros que o app já entende não são enviados', () => {
    toServiceError({ code: '42501', message: 'permission denied' });
    toServiceError({ code: 'BC409', message: 'x' });
    toServiceError({ name: 'TypeError', message: 'Failed to fetch' });
    expect(reported).toHaveLength(0);
  });
});

describe('AUD-130: falha de rede numa Edge Function é "offline"', () => {
  it('FunctionsFetchError vira offline', () => {
    const e = toServiceError({ name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' });
    expect(e.code).toBe('offline');
  });
});

describe('AUD-131: o download do supabase-js que falhou é tentado de novo', () => {
  it('a promessa rejeitada não fica guardada', () => {
    expect(src('services/supabase.ts')).toMatch(
      /\.catch\(\(e: unknown\) => \{[\s\S]*client = undefined;[\s\S]*throw e;/
    );
  });
});

describe('AUD-132: tema que não salvou diz o motivo verdadeiro', () => {
  it('o aviso não é sempre "sem internet"', () => {
    const s = src('services/theme.ts');
    expect(s).not.toMatch(/serviceError\('offline'\)/);
    expect(s).toMatch(/errorMessage\(e\)/);
  });
});

import { waitForToken } from '../utils/tokenWait';

describe('AUD-037: o captcha não deixa o botão girando para sempre', () => {
  it('sem resposta no prazo, a espera termina com undefined e sai da fila', async () => {
    vi.useFakeTimers();
    const waiting: ((t: string | undefined) => void)[] = [];
    const started = vi.fn();
    const p = waitForToken(waiting, started, 1000);
    expect(started).toHaveBeenCalledTimes(1);
    expect(waiting).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toBeUndefined();
    expect(waiting).toHaveLength(0);
    vi.useRealTimers();
  });
  it('com a resposta do widget, entrega o token e cancela o prazo', async () => {
    vi.useFakeTimers();
    const waiting: ((t: string | undefined) => void)[] = [];
    const p = waitForToken(waiting, () => undefined, 1000);
    waiting.splice(0).forEach((done) => done('abc'));
    await expect(p).resolves.toBe('abc');
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
  it('o widget também termina a espera em timeout e em navegador sem suporte', () => {
    const s = src('components/Captcha.tsx');
    expect(s).toMatch(/'timeout-callback'/);
    expect(s).toMatch(/'unsupported-callback'/);
  });
});

describe('AUD-129: o fim da sessão, por qualquer caminho, desliga o push deste aparelho', () => {
  it('leaveSession solta a assinatura do aparelho', () => {
    expect(src('services/remote/session.ts')).toMatch(/dropPushOnThisDevice/);
    const push = src('services/push.ts');
    expect(push).toMatch(/export async function dropPushOnThisDevice/);
    expect(push).toMatch(/sub\?\.unsubscribe\(\)/);
  });
});
