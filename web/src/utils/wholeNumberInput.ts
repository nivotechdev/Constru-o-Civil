// AUD-026: the job's number fields (the day's pay, how many days, how many people) take whole numbers only. Before,
// a comma or a point was dropped without a word: "45,50" became 4550 and "1.5" became 15 days. Now a field that gets a
// separator or a sign keeps its last good value and says why, so the number on the screen is always the one saved.

export interface WholeInput {
  /** The digits to keep, or `null` when the typed text is refused (the caller keeps its last value). */
  value: string | null;
  /** The message for the person, or `null` when the text is a whole number. */
  problem: string | null;
}

export function readWholeInput(raw: string, max: number, kind: 'reais' | 'quantidade'): WholeInput {
  const text = String(raw).trim();
  if (text === '') return { value: '', problem: null };
  if (/[.,]/.test(text)) {
    return {
      value: null,
      problem: kind === 'reais' ? 'Use só o valor em reais, sem centavos.' : 'Use só números inteiros, sem vírgula.'
    };
  }
  if (/[-+]/.test(text)) return { value: null, problem: 'Use só números, sem sinal.' };
  if (/[^\d\s]/.test(text)) return { value: null, problem: 'Use só números.' };
  return { value: text.replace(/\D/g, '').slice(0, max), problem: null };
}
