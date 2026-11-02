// AUD-014: the worker's saved address (street-level point) must not go to a routing server; the job page shows the
// straight-line distance and the map tiles only.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe('sem servidor de rota de terceiros (AUD-014)', () => {
  it('no source file calls a public routing service', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const offenders = sourceFiles(root).filter((f) =>
      /project-osrm\.org|routing\.openstreetmap\.de/.test(readFileSync(f, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('the CSP no longer lists the routing hosts', () => {
    const headers = readFileSync(fileURLToPath(new URL('../../public/_headers', import.meta.url)), 'utf8');
    expect(headers).not.toMatch(/project-osrm\.org|routing\.openstreetmap\.de/);
  });

  it('the job map shows the straight-line distance and does not ask for a driving route', () => {
    const map = readFileSync(fileURLToPath(new URL('../components/JobMap.tsx', import.meta.url)), 'utf8');
    expect(map).not.toMatch(/drivingRoute|services\/route['"]/);
    expect(map).toMatch(/em linha reta/);
  });
});
