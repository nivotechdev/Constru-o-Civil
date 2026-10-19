// Fluxo 2: cadastro da construtora (CNPJ válido) → publicar vaga com foto → a vaga aparece no mural do
// trabalhador (filtro por cidade e por raio).
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import {
  admin,
  atualizar,
  cnpjValido,
  comoConta,
  criada,
  emailDeTeste,
  entrar,
  ENV,
  estado,
  idDaConta,
  linkDeConfirmacao,
  nomeDeTeste,
  prepararPagina,
  print
} from '../apoio';

const FOTO = fileURLToPath(new URL('../fixtures/foto.png', import.meta.url));
const dia = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
};

test('construtora se cadastra e publica uma vaga com foto', async ({ page }) => {
  await prepararPagina(page);
  const email = emailDeTeste('construtora');
  const cnpj = cnpjValido('construtora');
  const nome = nomeDeTeste('Construtora Teste');

  await page.goto('/cadastro/recrutador');
  const k = '#cadastro-recrutador-';
  const seguir = () => page.getByRole('button', { name: 'Continuar' }).click();
  await page.fill(k + 'razao', nome);
  await seguir();
  await page.fill(k + 'responsavel', 'Ana Responsável');
  await seguir();
  await page.fill(k + 'doc', cnpj);
  await seguir();
  await page.fill(k + 'email', email);
  await seguir();
  await page.fill(k + 'whatsapp', '11955554444');
  await seguir();
  await page.fill(k + 'senha', ENV.password);
  await page.fill(k + 'confirm', ENV.password);
  await page.getByText('Tenho 18 anos ou mais').click();
  await page.getByText('Li e aceito os Termos de uso e a Política de privacidade').click();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page).toHaveURL(/\/verificar-email/);
  const id = await idDaConta(email);
  criada(id, email);
  atualizar((e) => (e.contas.construtora = { id, email, documento: cnpj, nome }));

  await page.goto(await linkDeConfirmacao(email));
  await expect(page).toHaveURL(/\/completar-perfil\/recrutador/);
  await seguir();
  await page.getByLabel('Tipo de obra').selectOption({ index: 1 });
  await print(page, 'f2', 'construtora completa o perfil');
  await page.getByRole('button', { name: 'Concluir perfil' }).click();
  await expect(page).not.toHaveURL(/completar-perfil/);

  // Publicar a vaga (passo 1: foto, ofício, endereço, datas; passo 2: valor, pagamento, descrição).
  await page.goto('/criar-vaga');
  await page.locator('input[type=file]').first().setInputFiles(FOTO);
  await page.getByLabel('Ofício').selectOption('pedreiro');
  await page.fill('#create-job-titulo', 'Reboco de parede E2E');
  await page.fill('#create-job-cep', '03307000');
  await expect(page.getByText('Endereço encontrado')).toBeVisible();
  await page.fill('#create-job-numero', '100');
  await page.getByRole('radio', { name: /Qualquer dia/ }).click();
  await page.fill('#create-job-inicio', dia(2));
  await page.fill('#create-job-fim', dia(3));
  await page.fill('#create-job-hora-inicio', '07:00');
  await page.fill('#create-job-hora-fim', '17:00');
  await page.fill('#create-job-vagas', '2');
  await print(page, 'f2', 'publicar vaga passo 1');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.fill('#create-job-valor', '250');
  await page.getByText('PIX no fim de cada diária').click();
  await page.fill('#create-job-detalhe', 'Reboco de duas paredes internas. Material no local.');
  await print(page, 'f2', 'publicar vaga passo 2');
  await page.getByRole('button', { name: 'Publicar vaga' }).click();
  await expect(page).toHaveURL(/\/vaga-publicada\/BC-\d+/);
  await print(page, 'f2', 'vaga publicada');
  const vaga = /BC-\d+/.exec(page.url())![0];
  atualizar((e) => (e.vaga = vaga));

  const { data: job } = await admin().from('jobs').select('city, uf, photos').eq('id', vaga).single();
  expect(job).toMatchObject({ city: 'São Paulo', uf: 'SP' });
  expect(job!.photos?.length).toBe(1);
});

test('a vaga aparece no mural do trabalhador (por cidade e por raio)', async ({ page }) => {
  await prepararPagina(page);
  const { contas, vaga } = estado();
  await entrar(page, contas.trabalhador.email);
  await expect(page).toHaveURL(/\/mural/);
  await expect(page.getByText('Reboco de parede E2E').first()).toBeVisible();
  await print(page, 'f2', 'mural por cidade mostra a vaga');

  // Raio: a mesma vaga pelo filtro "Até X km" (feed_jobs com p_radius_km), como o app chama.
  const worker = await comoConta(contas.trabalhador.email);
  const { data: porRaio, error } = await worker.rpc('feed_jobs', {
    p_city: 'São Paulo',
    p_uf: 'SP',
    p_lat: -23.55,
    p_lon: -46.63,
    p_radius_km: 15
  });
  expect(error).toBeNull();
  expect((porRaio as { id: string }[]).map((j) => j.id)).toContain(vaga);
  const { data: longe } = await worker.rpc('feed_jobs', {
    p_city: 'Caxias do Sul',
    p_uf: 'RS',
    p_lat: -29.17,
    p_lon: -51.18,
    p_radius_km: 50
  });
  expect((longe as { id: string }[]).map((j) => j.id)).not.toContain(vaga);
});
