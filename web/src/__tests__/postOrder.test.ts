// AUD-094: posts of the same day keep their order, and the newest day comes first.
import { describe, expect, it } from 'vitest';
import { postsForWorker } from '../services/selectors';
import type { Database, WorkerPost } from '../types/models';

const post = (id: string, date: string): WorkerPost => ({
  id,
  workerId: 'w1',
  mediaUrl: null,
  mediaType: 'image',
  caption: '',
  date
});

describe('ordem dos posts (AUD-094)', () => {
  it('newest day first; the same day keeps the order it was published in', () => {
    const db = {
      workerPosts: [post('a', '2026-10-01'), post('b', '2026-10-05'), post('c', '2026-10-05'), post('d', '2026-10-03')]
    } as unknown as Database;
    expect(postsForWorker(db, 'w1').map((p) => p.id)).toEqual(['b', 'c', 'd', 'a']);
  });
});
