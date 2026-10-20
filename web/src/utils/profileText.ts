// U32/U34: the rules of the profile texts — the same in both modes and checked again by the database
// (workers_bio_check, workers_experiences_check, companies_about_check).

/** U32: "Sobre você" / "Sobre a empresa" — a short presentation, not a CV (the database checks it too). */
export const MAX_ABOUT = 500;
/** U34: how many experiences a worker lists, and how long each one is (one line, no pasted text). */
export const MAX_EXPERIENCES = 10;
export const MAX_EXPERIENCE_LENGTH = 80;
export const MIN_EXPERIENCE_LENGTH = 2;

/** U34: one experience as it is saved — spaces tidied, one line. */
export function cleanExperience(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** U34: the list as it is saved — tidied, without empty lines or repeats. */
export function cleanExperiences(list: string[]): string[] {
  const seen = new Set<string>();
  return list.map(cleanExperience).filter((e) => {
    const key = e.toLocaleLowerCase('pt-BR');
    if (!e || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
