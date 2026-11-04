// AUD-085: names take letters and ordinary punctuation; emoji and symbols are refused on both forms.
import { describe, expect, it } from 'vitest';
import { nameProblem } from '../utils/nameText';

describe('nome (AUD-085)', () => {
  it('a person: letters, accents, apostrophes and hyphens are fine', () => {
    expect(nameProblem('Maria Souza', 'pessoa')).toBeNull();
    expect(nameProblem("José D'Ávila-Neto", 'pessoa')).toBeNull();
    expect(nameProblem('Maria 😀 Souza', 'pessoa')).not.toBeNull();
    expect(nameProblem('João 2 Silva', 'pessoa')).not.toBeNull();
  });
  it('a company: numbers and & are fine, emoji are not', () => {
    expect(nameProblem('Padaria 3 Irmãos & Cia.', 'empresa')).toBeNull();
    expect(nameProblem('Buffet ✨ Festa', 'empresa')).not.toBeNull();
  });
  it('length: at most 80 characters, on any form', () => {
    expect(nameProblem('a'.repeat(80), 'pessoa')).toBeNull();
    expect(nameProblem('a'.repeat(81), 'pessoa')).toBe('Use até 80 caracteres.');
  });
});
