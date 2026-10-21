// U43: `.tap-target` enlarges a control's touch area with an invisible ::after sized from the nearest positioned
// element. On a control that is not positioned itself, that area grows to the size of a whole screen part and
// catches the taps meant for other buttons — the "Sair" of the e-mail code screen took the taps on "Corrigir"
// and signed people out. Every class list with `tap-target` must position the control too.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('área de toque (U43)', () => {
  it('every control with tap-target is positioned (relative, absolute, fixed or sticky)', () => {
    const wrong: string[] = [];
    for (const file of sources(join(__dirname, '..'))) {
      const text = readFileSync(file, 'utf8');
      for (const literal of text.match(/(['"`])[^'"`\n]*\btap-target\b[^'"`\n]*\1/g) ?? [])
        if (!/\b(relative|absolute|fixed|sticky)\b/.test(literal)) wrong.push(`${file}: ${literal}`);
    }
    expect(wrong).toEqual([]);
  });
});
