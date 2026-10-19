// Fluxo 6: login por CPF e por CNPJ; limite de tentativas (6ª → 429); recuperação de senha.
import { expect, test } from '@playwright/test';
import { admin, CAPTCHA_TESTE, contaPorApi, ENV, estado, linkDeRecuperacao, prepararPagina, print } from '../apoio';

async function entrarComDocumento(page: import('@playwright/test').Page, documento: string, destino: RegExp) {
  await page.goto('/login');
  await page.fill('#login-identifier', documento);
  await page.fill('#login-password', ENV.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(destino);
}

test('entrar com CPF e com CNPJ', async ({ browser }) => {
  const { contas } = estado();
  const w = await browser.newPage();
  await prepararPagina(w);
  await entrarComDocumento(w, contas.trabalhador.documento, /\/mural/);
  await print(w, 'f6', 'entrou com cpf');
  const c = await browser.newPage();
  await prepararPagina(c);
  await entrarComDocumento(c, contas.construtora.documento, /\/(mural|minhas-vagas)/);
  await print(c, 'f6', 'entrou com cnpj');
  await w.close();
  await c.close();
});

test('a 6ª tentativa errada no mesmo documento é barrada (429)', async () => {
  const conta = await contaPorApi('limite', 'trabalhador', 'Limite De Tentativas E2E');
  if (ENV.fakeTurnstile) {
    // Só no E2E local (todas as execuções saem do mesmo IP): zera o limite por IP de execuções anteriores.
    await admin().from('auth_attempts').delete().like('key', 'ip:%');
  }
  const tentar = () =>
    fetch(`${ENV.functionsUrl}/functions/v1/entrar-com-documento`, {
      method: 'POST',
      headers: { apikey: ENV.anonKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documento: conta.documento,
        senha: 'senha-errada-123',
        captchaToken: CAPTCHA_TESTE
      })
    });
  const respostas: number[] = [];
  for (let i = 0; i < 6; i++) respostas.push((await tentar()).status);
  expect(respostas).toEqual([401, 401, 401, 401, 401, 429]);
  // Com o limite batido, nem a senha certa entra (sem revelar se a conta existe).
  const certa = await fetch(`${ENV.functionsUrl}/functions/v1/entrar-com-documento`, {
    method: 'POST',
    headers: { apikey: ENV.anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ documento: conta.documento, senha: ENV.password, captchaToken: CAPTCHA_TESTE })
  });
  expect(certa.status).toBe(429);
});

test('recuperar a senha pelo link do e-mail', async ({ page }) => {
  await prepararPagina(page);
  const conta = await contaPorApi('recupera', 'trabalhador', 'Esqueceu A Senha E2E');
  await page.goto('/esqueci-senha');
  await page.fill('#forgot-email', conta.email);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText('Link enviado')).toBeVisible();
  await print(page, 'f6', 'link de recuperacao enviado');

  const nova = 'Nova-senha-e2e-77';
  await page.goto(await linkDeRecuperacao(conta.email));
  await expect(page).toHaveURL(/\/redefinir-senha/);
  await page.fill('#reset-senha', nova);
  await page.fill('#reset-confirm', nova);
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('button', { name: 'Ir para o login' })).toBeVisible();
  await print(page, 'f6', 'senha nova salva');

  await page.goto('/login');
  await page.fill('#login-identifier', conta.email);
  await page.fill('#login-password', nova);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/mural/);
  // A senha antiga não entra mais.
  const antiga = await (
    await import('@supabase/supabase-js')
  )
    .createClient(ENV.supabaseUrl, ENV.anonKey(), { auth: { persistSession: false } })
    .auth.signInWithPassword({ email: conta.email, password: ENV.password, options: { captchaToken: CAPTCHA_TESTE } });
  // Recusada pela senha, não pelo captcha.
  expect(antiga.error?.message).not.toMatch(/captcha/i);
  expect(antiga.error).not.toBeNull();
  // Volta a senha padrão do E2E, para a limpeza sair pelo caminho do app.
  await admin().auth.admin.updateUserById(conta.id, { password: ENV.password });
});
