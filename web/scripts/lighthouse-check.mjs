// X02/X16: fails the CI when Lighthouse reports (JSON) are below the targets for a phone. With several
// reports (runs of the same page), the median of each category counts — one slow run on a shared CI machine
// doesn't fail the build.
import { readFileSync } from 'node:fs';

const TARGETS = { performance: 85, accessibility: 95, 'best-practices': 95 };
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['lighthouse.json'];
const reports = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
let failed = false;
for (const [id, min] of Object.entries(TARGETS)) {
  const scores = reports.map((r) => Math.round((r.categories[id]?.score ?? 0) * 100));
  const score = median(scores);
  const ok = score >= min;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${id}: ${score} (meta ${min}; rodadas: ${scores.join(', ')})`);
}
process.exit(failed ? 1 : 0);
