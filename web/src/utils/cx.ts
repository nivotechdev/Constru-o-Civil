/** Joins the truthy class names with a space (same output as the legacy `cx()` helper). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
