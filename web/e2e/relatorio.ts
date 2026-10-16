// L03: docs/E2E.md a partir da última execução (estado.json + prints), com os prints copiados para
// docs/e2e-prints/. Roda no fim (antes da limpeza) quando E2E_RELATORIO=1.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { estado } from './apoio';

const FLUXOS: Record<string, string> = {
  f1: '1. Cadastro do trabalhador → confirmação de e-mail → completar perfil',
  f2: '2. Cadastro da construtora → vaga com foto → mural (cidade e raio)',
  f3: '3. Candidatura → aprovação → WhatsApp liberado para os dois → recusa e desfazer',
  f4: '4. Presença → diária concluída → avaliação dos dois lados → notas nos perfis',
  f5: '5. Denúncia e bloqueio → exportar dados → excluir conta (Auth e Storage)',
  f6: '6. Login por CPF/CNPJ → limite de tentativas (429) → recuperação de senha',
  f7: '7. Área da equipe (L06): identidade, construtora, denúncia, suspensão e registro'
};

export function gerarRelatorio(resumo: { passou: number; falhou: number; ambiente: string }): void {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const docs = here + '../docs/';
  const destino = docs + 'e2e-prints/';
  if (existsSync(destino)) rmSync(destino, { recursive: true });
  mkdirSync(destino, { recursive: true });
  const { prints, execucao } = estado();
  for (const p of prints)
    if (existsSync(here + 'resultados/prints/' + p.arquivo))
      copyFileSync(here + 'resultados/prints/' + p.arquivo, destino + p.arquivo);
  const linhas = [
    '# E2E — os fluxos de ponta a ponta num backend de verdade (L03)',
    '',
    `Gerado por \`e2e/relatorio.ts\` · execução \`${execucao}\` · ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    '',
    `**Ambiente**: ${resumo.ambiente}`,
    '',
    `**Resultado**: ${resumo.passou} testes passaram, ${resumo.falhou} falharam.`,
    '',
    'Como rodar: `e2e/LEIA.md`. Cada fluxo cria as próprias contas (e-mail `+e2e-<execução>`) e todas são apagadas no fim',
    'pelo mesmo caminho do app (`excluir-conta`).',
    ''
  ];
  for (const [id, titulo] of Object.entries(FLUXOS)) {
    const meus = prints.filter((p) => p.fluxo === id);
    if (!meus.length) continue;
    linhas.push(`## ${titulo}`, '');
    for (const p of meus)
      linhas.push(`- ${p.legenda}`, '', `  <img src="e2e-prints/${p.arquivo}" alt="${p.legenda}" width="240">`, '');
  }
  writeFileSync(docs + 'E2E.md', linhas.join('\n'));
  console.log(`docs/E2E.md: ${prints.length} prints de ${readdirSync(destino).length} arquivos.`);
}

/** Reporter do Playwright: conta os testes e, com E2E_RELATORIO=1, escreve docs/E2E.md no fim. */
export default class RelatorioE2E implements Reporter {
  private passou = 0;
  private falhou = 0;
  onTestEnd(_test: TestCase, result: TestResult): void {
    if (result.status === 'passed') this.passou++;
    else if (result.status !== 'skipped') this.falhou++;
  }
  onEnd(): void {
    if (process.env.E2E_RELATORIO !== '1') return;
    gerarRelatorio({ passou: this.passou, falhou: this.falhou, ambiente: process.env.E2E_AMBIENTE ?? 'staging' });
  }
}
