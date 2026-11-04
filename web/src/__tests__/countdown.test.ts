// AUD-101: the resend countdown reads the same everywhere, counts down to 0 and never shows "0:60".
import { describe, expect, it } from 'vitest';
import { clock, secondsLeft } from '../utils/countdown';

describe('contagem do reenviar código (AUD-101)', () => {
  it('clock text', () => {
    expect(clock(60)).toBe('1:00');
    expect(clock(45)).toBe('0:45');
    expect(clock(0)).toBe('0:00');
    expect(clock(-3)).toBe('0:00');
    expect(clock(59.9)).toBe('0:59');
  });
  it('seconds left: from the send time, never negative, none before a send', () => {
    const sent = 1_000_000;
    expect(secondsLeft(sent, 60, sent)).toBe(60);
    expect(secondsLeft(sent, 60, sent + 20_500)).toBe(40);
    expect(secondsLeft(sent, 60, sent + 90_000)).toBe(0);
    expect(secondsLeft(0, 60, sent)).toBe(0);
  });
});
