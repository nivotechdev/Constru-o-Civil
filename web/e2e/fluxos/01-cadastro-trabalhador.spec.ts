// Fluxo 1: cadastro do trabalhador (CPF válido, 18+) → confirmação de e-mail pelo código de 6 números (U11) →
// completar perfil → mural.
import { expect, test } from '@playwright/test';
import {
  atualizar,
  codigoDeConfirmacao,
  cpfValido,
  criada,
  emailDeTeste,
  ENV,
  idDaConta,
  nomeDeTeste,
  prepararPagina,
  print,
  whatsappDeTeste
} from '../apoio';

test('trabalhador se cadastra, confirma o e-mail e completa o perfil', async ({ page }) => {
  await prepararPagina(page);
  const email = emailDeTeste('trabalhador');
  const cpf = cpfValido('trabalhador');
  const nome = nomeDeTeste('Teste Trabalhador');
  const whatsapp = whatsappDeTeste('trabalhador');

  await page.goto('/cadastro/trabalhador');
  const k = '#cadastro-trabalhador-';
  await page.fill(k + 'nome', nome);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.fill(k + 'doc', cpf);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.fill(k + 'email', email);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.fill(k + 'whatsapp', whatsapp);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.fill(k + 'senha', ENV.password);
  await page.fill(k + 'confirm', ENV.password);
  await page.getByText('Tenho 18 anos ou mais').click();
  await page.getByText('Li e aceito os Termos de uso e a Política de privacidade').click();
  await print(page, 'f1', 'cadastro senha e aceites');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();

  await expect(page).toHaveURL(/\/verificar-email/);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await print(page, 'f1', 'confirme seu e-mail');
  const id = await idDaConta(email);
  criada(id, email);

  // U11: digitar os 6 números confirma sozinho e segue para completar o perfil.
  const codigo = await codigoDeConfirmacao(email);
  await page.fill('#verificar-codigo', codigo);
  await expect(page).toHaveURL(/\/completar-perfil\/trabalhador/);
  await page.getByLabel('Seu ofício principal').selectOption('pedreiro');
  await print(page, 'f1', 'completar perfil oficio');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.fill('#completar-especialidade', 'Reboco');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await print(page, 'f1', 'completar perfil especialidade');
  await page.getByRole('button', { name: 'Concluir perfil' }).click();
  await expect(page).toHaveURL(/\/mural/);
  await print(page, 'f1', 'mural do trabalhador');
  atualizar((e) => (e.contas.trabalhador = { id, email, documento: cpf, nome, whatsapp }));
});
