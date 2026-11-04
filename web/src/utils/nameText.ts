// AUD-085: a name is letters, spaces and the punctuation names really use (. ' - and & for companies), up to 80
// characters. Emoji and symbols are refused here, with the same rule on the sign-up and the profile.

const PERSON = /^[\p{L}][\p{L}\s.'-]*$/u;
const COMPANY = /^[\p{L}\p{N}][\p{L}\p{N}\s.'&/-]*$/u;

/** The problem with a name typed for a person (`trabalhador`) or a company (`recrutador`); `null` when it is fine. */
export function nameProblem(value: string, kind: 'pessoa' | 'empresa'): string | null {
  const name = value.trim();
  if (name.length > 80) return 'Use até 80 caracteres.';
  if (!name) return null;
  const ok = kind === 'pessoa' ? PERSON.test(name) : COMPANY.test(name);
  if (!ok)
    return kind === 'pessoa'
      ? 'Use só letras no nome (sem emoji nem números).'
      : 'Use só letras, números e pontuação comum no nome da empresa.';
  return null;
}
