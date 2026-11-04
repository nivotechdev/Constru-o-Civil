// AUD-089: the code step focuses its field when it opens (the rule is checked on the hook's source: the project has no
// component renderer for tests).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('campo do código recebe o foco (AUD-089)', () => {
  const hook = readFileSync(fileURLToPath(new URL('../hooks/useTextField.ts', import.meta.url)), 'utf8');
  it('autoFocus focuses on each mount, not once per document', () => {
    expect(hook).not.toMatch(/autofocusProcessed/);
    expect(hook).toMatch(/if \(active === document\.body\)|active === document\.body/);
  });
});
