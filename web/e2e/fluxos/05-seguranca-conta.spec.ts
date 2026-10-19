// Fluxo 5: denúncia e bloqueio entre contas; exportar os dados; excluir a conta (some do Auth e do Storage).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { admin, comoConta, contaPorApi, entrar, ENV, estado, prepararPagina, print } from '../apoio';

const FOTO = readFileSync(fileURLToPath(new URL('../fixtures/foto.png', import.meta.url)));

test('denunciar e bloquear uma construtora', async ({ page }) => {
  const { contas } = estado();
  await prepararPagina(page);
  await entrar(page, contas.trabalhador2.email);
  await page.goto('/construtora/' + contas.construtora.id);
  await page.getByRole('button', { name: 'Denunciar ou bloquear' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Denunciar / })
    .click();
  await page.getByRole('button', { name: 'Golpe ou pedido de dinheiro' }).click();
  await print(page, 'f5', 'denuncia');
  await page.getByRole('button', { name: 'Enviar denúncia' }).click();
  await expect(page.getByRole('button', { name: 'Enviar denúncia' })).toBeHidden();

  await page.getByRole('button', { name: 'Denunciar ou bloquear' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Bloquear / })
    .click();
  await page.getByRole('button', { name: 'Bloquear', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bloquear', exact: true })).toBeHidden();
  await print(page, 'f5', 'bloqueio');

  const { data: rep } = await admin()
    .from('reports')
    .select('target_type, reason')
    .eq('reporter_id', contas.trabalhador2.id);
  expect(rep).toEqual([{ target_type: 'perfil', reason: 'golpe' }]);
  const { data: bl } = await admin().from('blocks').select('blocked_id').eq('blocker_id', contas.trabalhador2.id);
  expect(bl).toEqual([{ blocked_id: contas.construtora.id }]);
  // Bloqueio vale no banco: a construtora não convida mais essa pessoa (nem o contrário).
  const empresa = await comoConta(contas.construtora.email);
  const convite = await empresa.rpc('invite_worker', { p_job_id: estado().vaga, p_worker_id: contas.trabalhador2.id });
  expect(convite.error).not.toBeNull();
});

test('exportar os próprios dados', async ({ page }) => {
  const { contas } = estado();
  await prepararPagina(page);
  await entrar(page, contas.trabalhador.email);
  await page.goto('/configuracoes/privacidade');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar meus dados' }).click()
  ]);
  const json = JSON.parse(readFileSync((await download.path())!, 'utf8')) as Record<string, unknown>;
  await print(page, 'f5', 'exportar dados');
  expect((json.conta as { email: string }).email).toBe(contas.trabalhador.email);
  expect(json).toHaveProperty('candidaturas');
  expect(json).toHaveProperty('aceites');
});

test('excluir a conta apaga o acesso e os arquivos', async ({ page }) => {
  await prepararPagina(page);
  const conta = await contaPorApi('excluir', 'trabalhador', 'Conta Que Sai E2E');
  const c = await comoConta(conta.email);
  const caminho = `${conta.id}/foto-e2e.png`;
  const up = await c.storage.from('avatars').upload(caminho, FOTO, { contentType: 'image/png' });
  expect(up.error).toBeNull();

  await entrar(page, conta.email);
  await page.goto('/configuracoes/excluir-conta');
  await page.fill('#delete-password', ENV.password);
  await page.getByRole('button', { name: 'Excluir minha conta' }).click();
  await print(page, 'f5', 'confirmar exclusao');
  await page.getByRole('button', { name: 'Sim, excluir conta' }).click();
  await expect(page).toHaveURL(/\/conta-excluida/);
  await print(page, 'f5', 'conta excluida');

  const { data: user } = await admin().auth.admin.getUserById(conta.id);
  expect(user?.user ?? null).toBeNull();
  const { data: arquivos } = await admin().storage.from('avatars').list(conta.id);
  expect((arquivos ?? []).filter((f) => f.id)).toEqual([]);
  const { data: acc } = await admin().from('accounts').select('id').eq('id', conta.id);
  expect(acc).toEqual([]);
});
