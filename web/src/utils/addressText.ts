// U51: comparing addresses the way people type them — accents, case, punctuation and the street's kind aside.

/** "Av. Júlio de Castilhos" → "av julio de castilhos". */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STREET_KIND =
  /^(rua|r|avenida|av|travessa|tv|trav|alameda|al|estrada|est|rodovia|rod|praca|pca|largo|lgo|beco|viela|via|servidao|ladeira|passagem|vila|acesso)\s+/;

/** The street's name without its kind ("Rua", "Av.") or a leading article: "Rua Os 18 do Forte" → "18 do forte". */
export function streetKey(street: string): string {
  return fold(street)
    .replace(STREET_KIND, '')
    .replace(/^(d[aeo]s?|os|as|o|a)\s+/, '');
}

/** The same street, as people type it ("rua sinimbu" = "Rua Sinimbu"; "av julio de castilhos" = "Avenida Júlio…"). */
export function sameStreet(a: string, b: string): boolean {
  const x = streetKey(a);
  return Boolean(x) && x === streetKey(b);
}

/** The same neighbourhood ("Sao Pelegrino" = "São Pelegrino"; "Centro" and "Centro Histórico" too). */
export function sameNeighborhood(a: string, b: string): boolean {
  const x = fold(a);
  const y = fold(b);
  return Boolean(x && y) && (x === y || x.startsWith(y + ' ') || y.startsWith(x + ' '));
}

/** Every word typed is somewhere in the text. */
export function hasWords(text: string, typed: string): boolean {
  const t = fold(text);
  return fold(typed)
    .split(' ')
    .every((w) => t.includes(w));
}
