// AUD-115: a picture that fails to load has a fallback; the carousel track is a labelled region.
// (The project has no component renderer for tests, so these are checks on the source of each component.)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');

describe('imagem que não carrega (AUD-115)', () => {
  it('avatars and the company logo fall back to initials or the building icon', () => {
    const avatar = read('components/Avatar.tsx');
    expect(avatar.match(/onError=\{markBroken\}/g)).toHaveLength(2);
    expect(avatar).toMatch(/worker\.photoUrl && !broken/);
    expect(avatar).toMatch(/company\.logoUrl && !broken/);
  });
  it('the carousel photo falls back to the cover, and the track is a region', () => {
    const carousel = read('components/PhotoCarousel.tsx');
    expect(carousel).toMatch(/onError=\{markBroken\}/);
    expect(carousel).toMatch(/role=\{compact \? undefined : 'region'\}/);
  });
});
