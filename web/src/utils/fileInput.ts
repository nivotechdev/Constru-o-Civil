/** Lets a file <input> report the same file again: the legacy app re-created the input on every render. */
export function resetFileInput(input: HTMLInputElement): void {
  input.value = '';
}
