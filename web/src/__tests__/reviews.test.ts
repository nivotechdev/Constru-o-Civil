// B03/B04 — reviews after a concluded diária: stored on the reviewed profile, rating and count updated,
// once per side, only when the diária is concluded.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addToAverage } from '../services/reviews';

type M = {
  reviews: typeof import('../services/reviews');
  auth: typeof import('../services/auth');
  store: typeof import('../services/store');
};

describe('reviews', () => {
  let m: M;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    m = {
      reviews: await import('../services/reviews'),
      auth: await import('../services/auth'),
      store: await import('../services/store')
    };
  });
  afterEach(() => vi.useRealTimers());

  const settle = async <T>(p: Promise<T>) => {
    const r = p.then(
      (v) => ({ ok: true as const, v }),
      (e: unknown) => ({ ok: false as const, e: e as Error })
    );
    await vi.runAllTimersAsync();
    return r;
  };

  it('averages one more review into the rating', () => {
    expect(addToAverage(4.5, 10, 5)).toEqual({ rating: 4.5, count: 11 });
    expect(addToAverage(0, 0, 4)).toEqual({ rating: 4, count: 1 });
  });

  it('the company reviews the worker once: stored, rating updated, side marked', async () => {
    await settle(m.auth.signIn('construtora@bicos.demo', 'bicos123'));
    // a16: marcos, concluded on Meridiano's BC-4960, not reviewed by the company yet.
    const before = m.store.getDb().workers.marcos;
    expect(m.reviews.reviewableApplication('BC-4960', 'marcos', 'construtora')?.id).toBe('a16');
    const input = {
      applicationId: 'a16',
      direction: 'para_trabalhador' as const,
      value: 3,
      tags: ['Usou EPI'],
      comment: '  Bom, mas chegou atrasado. '
    };
    expect((await settle(m.reviews.submitReview(input))).ok).toBe(true);
    const after = m.store.getDb().workers.marcos;
    expect(after.reviewCount).toBe(before.reviewCount + 1);
    expect(after.rating).toBe(addToAverage(before.rating, before.reviewCount, 3).rating);
    expect(after.reviews[0]).toMatchObject({
      authorLabel: 'Construtora Meridiano',
      value: 3,
      tags: ['Usou EPI'],
      comment: 'Bom, mas chegou atrasado.'
    });
    expect(m.store.getDb().applications.find((a) => a.id === 'a16')?.companyReviewed).toBe(true);
    // Once only.
    const again = await settle(m.reviews.submitReview(input));
    expect(!again.ok && again.e.message).toMatch(/não está disponível/);
    expect(m.reviews.reviewableApplication('BC-4960', 'marcos', 'construtora')).toBeNull();
  });

  it('refuses a review before the diária is concluded, a bad note and a long comment', async () => {
    await settle(m.auth.signIn('trabalhador@bicos.demo', 'bicos123'));
    const notYet = await settle(
      m.reviews.submitReview({ applicationId: 'a1', direction: 'para_construtora', value: 5, tags: [], comment: '' })
    );
    expect(!notYet.ok && notYet.e.message).toMatch(/não está disponível/);
    const zero = await settle(
      m.reviews.submitReview({ applicationId: 'a9', direction: 'para_construtora', value: 0, tags: [], comment: '' })
    );
    expect(!zero.ok && zero.e.message).toMatch(/nota/);
    const long = await settle(
      m.reviews.submitReview({
        applicationId: 'a9',
        direction: 'para_construtora',
        value: 4,
        tags: [],
        comment: 'x'.repeat(301)
      })
    );
    expect(long.ok).toBe(false);
  });

  it("the worker reviews the company; a company can't review someone else's worker", async () => {
    await settle(m.auth.signIn('trabalhador@bicos.demo', 'bicos123'));
    const cangaiba = m.store.getDb().companies.cangaiba;
    const r = await settle(
      m.reviews.submitReview({
        applicationId: 'a9',
        direction: 'para_construtora',
        value: 5,
        tags: ['Pagou no dia'],
        comment: ''
      })
    );
    expect(r.ok).toBe(true);
    expect(m.store.getDb().companies.cangaiba.reviewCount).toBe(cangaiba.reviewCount + 1);
    expect(m.store.getDb().companies.cangaiba.reviews[0].authorLabel).toBe('Jorge M. · pedreiro de acabamento');

    await settle(m.auth.signIn('construtora@bicos.demo', 'bicos123'));
    const other = await settle(
      m.reviews.submitReview({ applicationId: 'a9', direction: 'para_trabalhador', value: 5, tags: [], comment: '' })
    );
    expect(!other.ok && other.e.message).toMatch(/não é sua/);
  });
});
