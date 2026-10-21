// Fluxo 8 (U40–U42): cadastro com o Google — as mesmas telas do cadastro normal, só sem o passo do e-mail, sem a
// confirmação dele e sem o botão do Google — e nenhuma tela de entrada rola. A janela do Google não abre em robô: o
// teste começa logo depois dela, do jeito que o app continua quando ela fecha — um login com o e-mail confirmado pelo
// Google e sem conta na Bicos (o que a função entrar-com-firebase cria), aberto por um link de acesso.
import { expect, test, type Page } from '@playwright/test';
import {
  admin,
  comoConta,
  cpfValido,
  criada,
  emailDeTeste,
  ENV,
  preencherEndereco,
  linkDeConfirmacao,
  nomeDeTeste,
  prepararPagina,
  print,
  whatsappDeTeste
} from '../apoio';

/** A tela não rola no celular do teste nem num Android pequeno com a barra do navegador (360×600). */
async function semRolagem(page: Page, tela: string): Promise<void> {
  const original = page.viewportSize();
  for (const size of [original, { width: 360, height: 600 }]) {
    if (!size) continue;
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    // Runs in the page (the E2E has no DOM types): how far the screen's scrolling area goes past its height.
    const passa = await page.evaluate<number>(`(() => {
      const el = document.querySelector('main') ?? document.querySelector('.overflow-y-auto') ?? document.documentElement;
      return el.scrollHeight - el.clientHeight;
    })()`);
    expect(passa, `${tela} rola a ${size.width}×${size.height}`).toBeLessThanOrEqual(1);
  }
  if (original) await page.setViewportSize(original);
}

test('login e escolha do lado: só o Google como outro jeito de entrar, sem rolagem', async ({ page }) => {
  await prepararPagina(page);
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Continuar com o Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar com o celular' })).toHaveCount(0);
  await semRolagem(page, 'login');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page).toHaveURL(/\/escolha-perfil/);
  await semRolagem(page, 'escolha do lado');
});

test('Google sem conta: o mesmo cadastro, sem o e-mail, e a conta nasce com o e-mail confirmado', async ({ page }) => {
  await prepararPagina(page);
  const email = emailDeTeste('google');
  const nome = nomeDeTeste('Teste Google');
  const cpf = cpfValido('google');
  const whatsapp = whatsappDeTeste('google');

  // O que entrar-com-firebase faz para um Google sem conta: o login, com o e-mail já confirmado e sem conta na Bicos.
  const { data, error } = await admin().auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { provider: 'google', providers: ['google'], via: 'firebase' },
    user_metadata: { full_name: nome, name: nome }
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const id = data.user.id;
  criada(id, email);
  await page.goto(await linkDeConfirmacao(email));

  // Veio do login (sem lado): escolhe o lado primeiro — a mesma tela, sem o botão do Google.
  await expect(page).toHaveURL(/\/escolha-perfil/);
  await expect(page.getByRole('heading', { name: 'Como você vai usar o Bicos?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar com o Google' })).toHaveCount(0);
  await semRolagem(page, 'escolha do lado (Google)');
  await print(page, 'f8', 'google escolha do lado');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Os mesmos passos, sem "Qual é o seu e-mail?": 4 em vez de 5, e o nome do Google já no campo.
  const k = '#cadastro-trabalhador-';
  await expect(page).toHaveURL(/\/cadastro\/trabalhador/);
  await expect(page.getByText('Passo 1 de 4')).toBeVisible();
  await expect(page.locator(k + 'nome')).toHaveValue(nome);
  await expect(page.getByRole('button', { name: 'Continuar com o Google' })).toHaveCount(0);
  await semRolagem(page, 'nome (Google)');
  await print(page, 'f8', 'google nome ja preenchido');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  // U45: the phone's back button goes back one question (and the answer stays); forward again with "Continuar".
  await expect(page.getByText('Passo 2 de 4')).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Passo 1 de 4')).toBeVisible();
  await expect(page).toHaveURL(/\/cadastro\/trabalhador/);
  await expect(page.locator(k + 'nome')).toHaveValue(nome);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.fill(k + 'doc', cpf);
  await semRolagem(page, 'CPF (Google)');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Qual é o seu WhatsApp?' })).toBeVisible();
  await expect(page.locator(k + 'email')).toHaveCount(0);
  await page.fill(k + 'whatsapp', whatsapp);
  await semRolagem(page, 'WhatsApp (Google)');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Passo 4 de 4')).toBeVisible();
  await page.fill(k + 'senha', ENV.password);
  await page.getByText('Tenho 18 anos ou mais').click();
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check({ force: true });
  await semRolagem(page, 'senha e aceites (Google)');
  await print(page, 'f8', 'google senha e aceites');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();

  // Sem confirmar e-mail: direto para completar o perfil.
  await expect(page).toHaveURL(/\/completar-perfil\/trabalhador/);
  await semRolagem(page, 'completar perfil (Google)');
  const { data: conta } = await admin()
    .from('accounts')
    .select('role, email_confirmed_at, worker_id')
    .eq('id', id)
    .single();
  expect(conta?.role).toBe('trabalhador');
  expect(conta?.email_confirmed_at).toBeTruthy();
  expect(conta?.worker_id).toBe(id);

  await preencherEndereco(page);
  await semRolagem(page, 'fotos do perfil (Google)');
  await page.getByRole('button', { name: 'Concluir perfil' }).click();
  await expect(page).toHaveURL(/\/mural/);
  await print(page, 'f8', 'google mural');

  // A senha criada no cadastro também entra (sem o Google).
  await comoConta(email);
});
