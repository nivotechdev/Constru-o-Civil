// AUD-001: deleting the account must also delete the selfie and the document (bucket `identidade`).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACCOUNT_BUCKETS, removeFolder, type StorageAdmin } from '../../supabase/functions/_shared/accountFiles.ts';

/** In-memory Storage: { bucket: { 'uid/file': true } }. */
function fakeStorage(files: Record<string, string[]>): StorageAdmin & { left: () => Record<string, string[]> } {
  const store = new Map(Object.entries(files).map(([bucket, names]) => [bucket, new Set(names)]));
  return {
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string, opts?: { limit?: number }) => {
          const names = [...(store.get(bucket) ?? [])]
            .filter((n) => n.startsWith(`${folder}/`))
            .slice(0, opts?.limit ?? 100)
            .map((n) => ({ id: n, name: n.slice(folder.length + 1) }));
          return { data: names, error: null };
        },
        remove: async (paths: string[]) => {
          for (const p of paths) store.get(bucket)?.delete(p);
          return { data: null, error: null };
        }
      })
    },
    left: () => Object.fromEntries([...store].map(([b, s]) => [b, [...s]]))
  };
}

describe('excluir-conta apaga os arquivos de identidade (AUD-001)', () => {
  it('the list of buckets cleaned on deletion includes identidade', () => {
    expect(ACCOUNT_BUCKETS).toEqual(expect.arrayContaining(['avatars', 'portfolio', 'vagas', 'identidade']));
  });

  it('removes <bucket>/<uid>/ in every bucket and leaves other people alone', async () => {
    const admin = fakeStorage({
      identidade: ['u1/selfie.jpg', 'u1/doc.jpg', 'u2/selfie.jpg'],
      avatars: ['u1/a.webp', 'u2/a.webp'],
      portfolio: [],
      vagas: ['u1/v.webp']
    });
    let removed = 0;
    for (const bucket of ACCOUNT_BUCKETS) removed += await removeFolder(admin, bucket, 'u1');
    expect(removed).toBe(4);
    expect(admin.left()).toEqual({
      identidade: ['u2/selfie.jpg'],
      avatars: ['u2/a.webp'],
      portfolio: [],
      vagas: []
    });
  });

  it('the function really uses the shared list (no private copy that could forget a bucket)', () => {
    const source = readFileSync(new URL('../../supabase/functions/excluir-conta/index.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/ACCOUNT_BUCKETS/);
    expect(source).not.toMatch(/const BUCKETS\s*=/);
  });
});
