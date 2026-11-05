// AUD-098/099/100/104/108/111/113: small screen fixes. The project has no component renderer for tests, so the screen
// rules are checked on the source text; the pure helpers are tested directly.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { restoreExperience } from '../utils/profileText';
import { countText } from '../pages/recruiter/MyJobs';

const src = (p: string) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8');

describe('AUD-098: "Ver outros bicos" não volta para a vaga encerrada', () => {
  const s = src('pages/shared/PublicJob.tsx');
  it('a vaga fechada usa a saída sem guardar a vaga', () => {
    expect(s).toMatch(/label="Ver outros bicos"[^>]*onClick=\{onOthers\}/);
    expect(s).toMatch(/onOthers=\{elsewhere\}/);
  });
});

describe('AUD-099: legenda em edição some ao fechar o visualizador', () => {
  it('a edição pertence a um post só', () => {
    const v = src('pages/shared/PostViewer.tsx');
    expect(v).toMatch(/draft && draft\.id === post\.id/);
    expect(v).not.toMatch(/setEditing/);
  });
});

describe('AUD-100: reabrir "Publicar trabalho" não mostra o erro antigo', () => {
  const s = src('pages/shared/WorkerPosts.tsx');
  it('closeAndReset limpa o erro do arquivo e o da publicação', () => {
    expect(s).toMatch(/function closeAndReset\(\)[\s\S]*setFileError\(null\);[\s\S]*publish\.reset\(\)/);
  });
});

describe('AUD-104: desfazer devolve só a experiência removida', () => {
  it('mantém o que foi adicionado depois, na posição antiga', () => {
    // Lista: A, B, C. Remove B; adiciona D; desfaz.
    expect(restoreExperience(['A', 'C', 'D'], 'B', 1)).toEqual(['A', 'B', 'C', 'D']);
  });
  it('vai para o fim se a lista ficou menor e não repete', () => {
    expect(restoreExperience(['A'], 'B', 5)).toEqual(['A', 'B']);
    expect(restoreExperience(['a', 'B'], 'A', 0)).toEqual(['a', 'B']);
  });
  it('respeita o máximo', () => {
    const full = Array.from({ length: 10 }, (_, i) => 'x' + i);
    expect(restoreExperience(full, 'novo', 0)).toEqual(full);
  });
});

describe('AUD-108: recarregar "Vaga publicada" busca a vaga', () => {
  it('carrega a vaga antes de dizer que não existe', () => {
    const s = src('pages/recruiter/JobPublished.tsx');
    expect(s).toMatch(/useQuery\('job:' \+ params\.id, \(\) => loadJob\(params\.id\)\)/);
    expect(s.indexOf('ScreenLoading')).toBeLessThan(s.indexOf('<JobNotFound'));
  });
});

describe('AUD-111: "Todas · N" com mais páginas mostra "30+"', () => {
  it('countText', () => {
    expect(countText(30, true)).toBe('30+');
    expect(countText(12, false)).toBe('12');
  });
});

describe('AUD-113: o prazo de 30 dias é dito a quem publica', () => {
  it('o texto do passo de datas fala dos 30 dias', () => {
    expect(src('pages/recruiter/CreateJob.tsx')).toMatch(/fica 30 dias no mural/);
  });
});
