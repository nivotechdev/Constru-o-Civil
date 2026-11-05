// U51/U76: comparing addresses the way people type them — accents, case, punctuation, the street's kind, the usual
// abbreviations ("R. Pe." = "Rua Padre"), numbers in words ("Dezoito" = "18") and a middle name left out aside.

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
  /^(rua|r|avenida|av|travessa|tv|trav|alameda|al|estrada|est|rodovia|rod|praca|pca|largo|lgo|beco|viela|via|servidao|ladeira|passagem|vila|acesso)(?:\s+|$)/;

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

// ---- U76: names of streets and neighbourhoods as the map writes them, which is rarely as the Correios do ----

/** Titles and words the Correios, the map and people abbreviate ("Pe." / "Padre", "N. Sra." / "Nossa Senhora"). */
const ABBREVIATIONS: Record<string, string> = {
  dr: 'doutor',
  dra: 'doutora',
  prof: 'professor',
  profa: 'professora',
  pe: 'padre',
  pde: 'padre',
  gen: 'general',
  mal: 'marechal',
  marech: 'marechal',
  cel: 'coronel',
  cap: 'capitao',
  ten: 'tenente',
  sgt: 'sargento',
  sen: 'senador',
  dep: 'deputado',
  ver: 'vereador',
  gov: 'governador',
  pres: 'presidente',
  eng: 'engenheiro',
  des: 'desembargador',
  min: 'ministro',
  alm: 'almirante',
  brig: 'brigadeiro',
  visc: 'visconde',
  cons: 'conselheiro',
  comend: 'comendador',
  maj: 'major',
  arq: 'arquiteto',
  jorn: 'jornalista',
  ir: 'irmao',
  mons: 'monsenhor',
  card: 'cardeal',
  d: 'dom',
  sta: 'santa',
  sto: 'santo',
  s: 'sao',
  n: 'nossa',
  ns: 'nossa senhora',
  nsa: 'nossa senhora',
  sra: 'senhora',
  sr: 'senhor',
  vl: 'vila',
  jd: 'jardim',
  jrd: 'jardim',
  pq: 'parque',
  res: 'residencial',
  cj: 'conjunto',
  conj: 'conjunto',
  lot: 'loteamento'
};

/** Numbers people write in words in street names ("Rua Os Dezoito do Forte", "Sete de Setembro"). */
const NUMBER_WORDS: Record<string, string> = {
  um: '1',
  uma: '1',
  primeiro: '1',
  dois: '2',
  duas: '2',
  tres: '3',
  quatro: '4',
  cinco: '5',
  seis: '6',
  sete: '7',
  oito: '8',
  nove: '9',
  dez: '10',
  onze: '11',
  doze: '12',
  treze: '13',
  quatorze: '14',
  catorze: '14',
  quinze: '15',
  dezesseis: '16',
  dezessete: '17',
  dezoito: '18',
  dezenove: '19',
  vinte: '20',
  trinta: '30'
};

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };

/** "xv" → "15"; null when the word is not a well-formed roman numeral ("civil", "li" as a name are not turned). */
function roman(word: string): string | null {
  if (!/^[ivxlc]{1,6}$/.test(word)) return null;
  let total = 0;
  for (let i = 0; i < word.length; i++) {
    const v = ROMAN[word[i]];
    const next = ROMAN[word[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  if (total <= 0 || total > 199) return null;
  // Written back, it must be the same word (rejects "iiii", "vx", "ic"…).
  const parts: [number, string][] = [
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i']
  ];
  let n = total;
  let back = '';
  for (const [value, letters] of parts)
    while (n >= value) {
      back += letters;
      n -= value;
    }
  return back === word ? String(total) : null;
}

const LINKING = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'del', 'di']);

/**
 * The words that name a street, comparable across sources: no kind, no linking words, abbreviations spelled out and
 * numbers as digits. "R. Pe. Alberto Luiz Lamonato" → ["padre", "alberto", "luiz", "lamonato"];
 * "Rua Os Dezoito do Forte" → ["18", "forte"]; "Av. XV de Novembro" → ["15", "novembro"].
 */
export function streetWords(street: string): string[] {
  const words = fold(street.replace(/(\d)\s*[ºª°]/g, '$1'))
    .replace(STREET_KIND, '')
    .split(' ')
    .filter(Boolean);
  const spelled = words.flatMap((w) => (ABBREVIATIONS[w] ?? NUMBER_WORDS[w] ?? roman(w) ?? w).split(' '));
  const named = spelled.filter((w) => !LINKING.has(w));
  // "Rua A", "Rua E" (streets of a new neighbourhood): the letter is the name.
  const out = named.length ? named : spelled;
  // "Vinte e Cinco de Julho" → 20, 5 → 25.
  for (let i = 0; i + 1 < out.length; i++) {
    const a = Number(out[i]);
    const b = Number(out[i + 1]);
    if (a >= 20 && a % 10 === 0 && b > 0 && b < 10) out.splice(i, 2, String(a + b));
  }
  return out;
}

/** Two words are the same with one letter off in a long word ("Beviláqua"/"Bevilacqua" folds closer still). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b) || Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1)
    return false;
  // One edit at most (insert, delete or change).
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Every word of `short`, in order, among the words of `long`. */
function inOrder(short: string[], long: string[]): boolean {
  let k = 0;
  for (const w of long) if (k < short.length && sameWord(w, short[k])) k++;
  return k === short.length;
}

/**
 * How much two street names are the same street, 0 to 1. 1: the same words. 0.9: one name has every word of the
 * other and both end the same (a middle name or a title left out: "Rua Padre Alberto Lamonato" / "Rua Pe. Alberto
 * Luiz Lamonato"). 0.85: the short name of a longer one ("Rua Marechal Floriano" / "Rua Mal. Floriano Peixoto").
 * Otherwise the share of words in common, halved when the last word (the surname, the part people keep) differs.
 */
export function streetSimilarity(a: string, b: string): number {
  const x = streetWords(a);
  const y = streetWords(b);
  if (!x.length || !y.length) return 0;
  if (x.length === y.length && x.every((w, i) => sameWord(w, y[i]))) return 1;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const sameEnd = sameWord(short[short.length - 1], long[long.length - 1]);
  if (short.length < long.length && inOrder(short, long)) return sameEnd ? 0.9 : short.length > 1 ? 0.85 : 0.6;
  const found = short.filter((w) => long.some((v) => sameWord(w, v))).length;
  const dice = (2 * found) / (x.length + y.length);
  return sameEnd ? dice : dice / 2;
}

const KIND_NAMES: Record<string, string> = {
  r: 'rua',
  av: 'avenida',
  tv: 'travessa',
  trav: 'travessa',
  al: 'alameda',
  est: 'estrada',
  rod: 'rodovia',
  pca: 'praca',
  lgo: 'largo'
};

/** The kind of the street ("rua", "avenida"…), spelled out; '' when the name has none. */
export function streetKind(street: string): string {
  const k = STREET_KIND.exec(fold(street))?.[1] ?? '';
  return KIND_NAMES[k] ?? k;
}

/** The same street for the map's purposes (see streetSimilarity). */
export function likelySameStreet(a: string, b: string): boolean {
  return streetSimilarity(a, b) >= 0.8;
}

/** "N. Sra. de Lourdes" → "nossa senhora lourdes" (abbreviations spelled out, no linking words). */
export function neighborhoodWords(name: string): string[] {
  return streetWords(name.replace(/^\s*(bairro|b\.)\s+/i, ''));
}

/**
 * The same neighbourhood, as the Correios and the map name it: "Lourdes" / "Nossa Senhora de Lourdes",
 * "São Pelegrino" / "Sao Pelegrino", "Centro" / "Centro Histórico", "Jd. América" / "Jardim América".
 */
export function likelySameNeighborhood(a: string, b: string): boolean {
  const x = neighborhoodWords(a);
  const y = neighborhoodWords(b);
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return inOrder(short, long);
}

const NUMBER_AFTER_STREET = /(\s*,\s*|\s+(?:n[º°o]\.?|n\.|num\.?|n[uú]mero)\s*|\s+)(\d{1,5})(?:\s?([a-z])(?![a-z]))?/gi;
const AFTER_NUMBER =
  /^\s*(?:$|[-,/;]|(?:ap|apto|apartamento|casa|bloco|bl|sala|fundos|frente|lote|lt|quadra|qd|andar|loja|sobrado)\b)/i;

/**
 * U76: the house number typed together with the street ("Rua Sinimbu, 1234", "Rua Sinimbu nº 1234 ap 3") — the form
 * of the worker's address has no field for it, and with it the map finds the house, not just the street. A name
 * that is a number stays the name ("Rua 7", "Avenida 25 de Julho"); "Rua 7, 120" is the 120 of Rua 7.
 */
export function splitHouseNumber(typed: string): { street: string; number: string } {
  const text = typed.trim().replace(/\s+/g, ' ');
  for (const m of text.matchAll(NUMBER_AFTER_STREET)) {
    const head = text.slice(0, m.index).trim();
    const tail = text.slice((m.index ?? 0) + m[0].length);
    if (streetKey(head) && AFTER_NUMBER.test(tail))
      return { street: head.replace(/[\s,]+$/, ''), number: m[2] + (m[3] ?? '').toUpperCase() };
  }
  return { street: text, number: '' };
}
