// Fluxo 7 (L06): a equipe trata as três filas pelo /admin — identidade (fotos por URL assinada), construtora
// e denúncia (suspender e reativar) — e cada decisão fica no registro. Conta comum não vê nada disso.
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { admin, comoConta, contaPorApi, entrar, estado, prepararPagina, print } from '../apoio';

const FOTO = fileURLToPath(new URL('../fixtures/foto.png', import.meta.url));

test('conta comum não entra na área da equipe', async ({ page }) => {
  await prepararPagina(page);
  await entrar(page, estado().contas.trabalhador.email);
  await page.goto('/admin');
  await expect(page.getByText('Área só da equipe')).toBeVisible();
  await print(page, 'f7', 'admin recusado para conta comum');
  const r = await (
    await comoConta(estado().contas.trabalhador.email)
  ).rpc('admin_report_queue', { p_status: 'aberta' });
  expect(r.error?.code).toBe('BC401');
});

test('equipe aprova identidade e construtora e trata a denúncia', async ({ browser }) => {
  const { contas } = estado();
  const equipe = await contaPorApi('equipe', 'trabalhador', 'Pessoa Da Equipe E2E');
  expect((await admin().rpc('add_staff_member', { p_email: equipe.email, p_role: 'admin' })).error).toBeNull();

  // Um trabalhador pede o selo, com o consentimento da selfie.
  const quer = await contaPorApi('selo', 'trabalhador', 'Quer O Selo E2E');
  const w = await browser.newPage();
  await prepararPagina(w);
  await entrar(w, quer.email);
  await w.goto('/perfil/verificar');
  const arquivos = w.locator('input[type=file]');
  await arquivos.nth(0).setInputFiles(FOTO);
  await arquivos.nth(1).setInputFiles(FOTO);
  await expect(w.getByRole('button', { name: 'Enviar para verificação' })).toBeDisabled();
  await w.getByText(/Concordo que a Bicos use minha selfie/).click();
  await print(w, 'f7', 'consentimento da selfie');
  await w.getByRole('button', { name: 'Enviar para verificação' }).click();
  await expect(w.getByText('Em análise')).toBeVisible();

  const e = await browser.newPage();
  await prepararPagina(e);
  await entrar(e, equipe.email);
  await e.goto('/admin');
  // Fila de identidades: fotos por link de 5 minutos, aprovar.
  const card = e.getByText(quer.nome, { exact: true }).locator('xpath=ancestor::div[.//button][1]/..');
  await card.getByRole('button', { name: 'Ver selfie e documento' }).click();
  await expect(card.getByRole('img', { name: `Selfie de ${quer.nome}` })).toBeVisible();
  const src = await card.getByRole('img', { name: `Selfie de ${quer.nome}` }).getAttribute('src');
  expect(src).toMatch(/\/storage\/v1\/object\/sign\/identidade\//);
  await print(e, 'f7', 'fila de identidades');
  await card.getByRole('button', { name: 'Aprovar' }).click();
  await expect(e.getByText('Identidade aprovada')).toBeVisible();
  const { data: wk } = await admin().from('workers').select('verified, identity_status').eq('id', quer.id).single();
  expect(wk).toEqual({ verified: true, identity_status: 'verificado' });

  // Fila de construtoras: a do fluxo 2 está pendente; aprovar.
  await e.getByRole('tab', { name: 'Construtoras' }).click();
  await expect(e.getByText(contas.construtora.nome, { exact: true })).toBeVisible();
  await print(e, 'f7', 'fila de construtoras');
  const cc = e
    .getByText(contas.construtora.nome, { exact: true })
    .locator('xpath=ancestor::div[.//button[normalize-space()="Aprovar"]][1]');
  await cc.getByRole('button', { name: 'Aprovar' }).click();
  await expect(e.getByText('Construtora aprovada')).toBeVisible();
  const { data: co } = await admin()
    .from('companies')
    .select('verification_status')
    .eq('id', contas.construtora.id)
    .single();
  expect(co!.verification_status).toBe('verificada');

  // Fila de denúncias: a do fluxo 5 → suspender a conta denunciada → não entra mais → reativar.
  await e.getByRole('tab', { name: 'Denúncias' }).click();
  await expect(e.getByText('Golpe ou pedido de dinheiro').first()).toBeVisible();
  await print(e, 'f7', 'fila de denuncias');
  const denuncia = e
    .getByText(contas.construtora.nome, { exact: true })
    .first()
    .locator('xpath=ancestor::div[.//button[normalize-space()="Suspender conta"]][1]');
  await denuncia.getByRole('button', { name: 'Suspender conta' }).click();
  const motivo = e.getByRole('alertdialog');
  await motivo.getByText('Golpe ou pedido de dinheiro').click();
  await motivo.getByRole('button', { name: 'Suspender' }).click();
  await expect(motivo).toBeHidden();
  const { data: acc } = await admin().from('accounts').select('suspended_at').eq('id', contas.construtora.id).single();
  expect(acc!.suspended_at).not.toBeNull();

  const s = await browser.newPage();
  await prepararPagina(s);
  await s.goto('/login');
  await s.fill('#login-identifier', contas.construtora.email);
  await s.fill('#login-password', (await import('../apoio')).ENV.password);
  await s.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(s.getByText('Sua conta está suspensa')).toBeVisible();
  await print(s, 'f7', 'conta suspensa nao entra');

  await e
    .getByText(contas.construtora.nome, { exact: true })
    .first()
    .locator('xpath=ancestor::div[.//button[normalize-space()="Reativar a conta"]][1]')
    .getByRole('button', { name: 'Reativar a conta' })
    .click();
  await expect(e.getByText('Desfeito')).toBeVisible();
  await e.getByRole('tab', { name: 'Registro' }).click();
  // Cada decisão desta execução, com quem decidiu.
  const minhas = e.getByRole('listitem').filter({ hasText: equipe.email });
  for (const acao of ['Aprovou identidade', 'Aprovou construtora', 'Suspendeu conta', 'Reativou conta'])
    await expect(minhas.filter({ hasText: acao })).toHaveCount(1);
  await print(e, 'f7', 'registro de auditoria');
  for (const p of [w, e, s]) await p.close();
});
