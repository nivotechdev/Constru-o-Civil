// X02/X16: fails the CI when a Lighthouse report (JSON) is below the targets for a phone.
import { readFileSync } from 'node:fs';

const TARGETS = { performance: 85, accessibility: 95, 'best-practices': 95 };
const report = JSON.parse(readFileSync(process.argv[2] ?? 'lighthouse.json', 'utf8'));
let failed = false;
for (const [id, min] of Object.entries(TARGETS)) {
  const score = Math.round((report.categories[id]?.score ?? 0) * 100);
  const ok = score >= min;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${id}: ${score} (meta ${min})`);
}
process.exit(failed ? 1 : 0);
