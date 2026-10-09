// Specialties chosen by a worker (Y23): free text plus the catalog's suggestions.

export const MAX_SPECIALTIES = 10;
const MAX_LENGTH = 40;

export const sameSpecialty = (a: string, b: string) => a.toLocaleLowerCase('pt-BR') === b.toLocaleLowerCase('pt-BR');

/** The list with `value` added (trimmed, no repeats ignoring case, at most MAX_SPECIALTIES). */
export function addSpecialty(list: string[], value: string): string[] {
  const clean = value.trim().replace(/\s+/g, ' ').slice(0, MAX_LENGTH);
  if (!clean || list.some((s) => sameSpecialty(s, clean)) || list.length >= MAX_SPECIALTIES) return list;
  return [...list, clean];
}
