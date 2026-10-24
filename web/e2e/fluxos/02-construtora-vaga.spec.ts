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
  print,
  whatsappDeTeste
} from '../apoio';

const FOTO = fileURLToPath(new URL('../fixtures/foto.png', import.meta.url));

test('construtora se cadastra e publica uma vaga com foto', async ({ page }) => {
  await prepararPagina(page);
  const email = emailDeTeste('construtora');
  const cnpj = cnpjValido('construtora');
  const nome = nomeDeTeste('Empresa Teste');
  const whatsapp = whatsappDeTeste('construtora');
  const trabalhador = estado().contas.trabalhador;

  await page.goto('/cadastro/recrutador');
  const k = '#cadastro-recrutador-';
  const seguir = () => page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.fill(k + 'razao', nome);
  await seguir();
  // U10: CPF, e-mail e WhatsApp de outra conta param o cadastro no próprio passo (o do trabalhador do fluxo 1).
  await page.fill(k + 'doc', trabalhador.documento);
  await seguir();
  await expect(page.getByText('Esse CPF já tem conta na Bicos.', { exact: false })).toBeVisible();
  await print(page, 'f2', 'cadastro para no CPF que já tem conta');
  await page.fill(k + 'doc', cnpj);
  await seguir();
  await page.fill(k + 'email', trabalhador.email);
  await seguir();
  await expect(page.getByText('Esse e-mail já tem conta na Bicos.', { exact: false })).toBeVisible();
  await page.fill(k + 'email', email);
  await seguir();
  if (trabalhador.whatsapp) {
    await page.fill(k + 'whatsapp', trabalhador.whatsapp);
    await seguir();
    await expect(page.getByText('Esse WhatsApp já está em outra conta', { exact: false })).toBeVisible();
  }
  await page.fill(k + 'whatsapp', whatsapp);
  await seguir();
  await page.fill(k + 'senha', ENV.password);
  await page.getByText('Tenho 18 anos ou mais').click();
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check({ force: true });
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page).toHaveURL(/\/verificar-email/);
  const id = await idDaConta(email);
  criada(id, email);
  atualizar((e) => (e.contas.construtora = { id, email, documento: cnpj, nome, whatsapp }));

  await page.goto(await linkDeConfirmacao(email));
  await expect(page).toHaveURL(/\/completar-perfil\/recrutador/);
  // U62/U67: a empresa não tem endereço fixo, só a cidade onde está (o mural abre nela) — depois capa e logo.
  await expect(page.getByText('Em que cidade você está?')).toBeVisible();
  await page.getByRole('button', { name: 'Digitar a cidade' }).click();
  await page.fill('#completar-cidade-search', 'Caxias do Sul');
  await page
    .getByRole('option', { name: /Caxias do Sul/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await print(page, 'f2', 'empresa completa o perfil');
  await page.getByRole('button', { name: 'Concluir perfil' }).click();
  await expect(page).not.toHaveURL(/completar-perfil/);

  // Publicar a vaga (U01/U52 — passo 1: foto, título, endereço pelo CEP com número e tipo do local, os dias da
  // semana; passo 2: valor, diárias, horário, pessoas e descrição, sem data — a combinar). Sem ofício, sem urgente,
  // sem pagamento e sem requisitos. Em Caxias do Sul, a cidade do trabalhador do fluxo 1.
  await page.goto('/criar-vaga');
  await page.locator('input[type=file]').first().setInputFiles(FOTO);
  // O título é obrigatório: sem ele, não passa do passo 1.
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Dê um título para a vaga')).toBeVisible();
  await page.fill('#create-job-titulo', 'Garçom para evento E2E');
  await page.fill('#create-job-cep', '95020000');
  await expect(page.getByText('Endereço encontrado')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Cidade' })).toHaveValue('Caxias do Sul, RS');
  await page.fill('#create-job-numero', '120');
  await page.selectOption('#create-job-tipo', 'casa');
  // Sem dia marcado não passa; "Fim de semana" e mais a sexta.
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Marque pelo menos um dia.')).toBeVisible();
  await page.getByRole('button', { name: 'Fim de semana', exact: true }).click();
  await page.getByRole('button', { name: 'Sex', exact: true }).click();
  await expect(page.getByText('No mural: Sex a dom')).toBeVisible();
  await print(page, 'f2', 'publicar vaga passo 1');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  // U02: diárias, horário e pessoas ficam no passo 2 (valor e pessoas).
  await page.fill('#create-job-valor', '250');
  await page.fill('#create-job-diarias', '2');
  await page.fill('#create-job-hora-inicio', '07:00');
  await page.fill('#create-job-hora-fim', '17:00');
  await page.fill('#create-job-vagas', '2');
  await page.fill('#create-job-detalhe', 'Servir as mesas de um aniversário. Uniforme preto.');
  await print(page, 'f2', 'publicar vaga passo 2');
  await page.getByRole('button', { name: 'Publicar vaga' }).click();
  await expect(page).toHaveURL(/\/vaga-publicada\/BC-\d+/);
  await print(page, 'f2', 'vaga publicada');
  const vaga = /BC-\d+/.exec(page.url())![0];
  atualizar((e) => (e.vaga = vaga));

  const { data: job } = await admin()
    .from('jobs')
    .select(
      'city, uf, cep, number, photos, oficio_id, date_to_arrange, diarias, slots, payment_method, weekdays, dias, place_type'
    )
    .eq('id', vaga)
    .single();
  expect(job).toMatchObject({
    city: 'Caxias do Sul',
    uf: 'RS',
    cep: '95020-000',
    number: '120',
    oficio_id: null,
    date_to_arrange: true,
    diarias: 2,
    slots: 2,
    payment_method: null,
    weekdays: [5, 6, 7],
    dias: 'qualquer',
    place_type: 'casa'
  });
  expect(job!.photos?.length).toBe(1);
});

test('a vaga aparece no mural do trabalhador (por cidade e por raio)', async ({ page }) => {
  await prepararPagina(page);
  const { contas, vaga } = estado();
  await entrar(page, contas.trabalhador.email);
  await expect(page).toHaveURL(/\/mural/);
  await expect(page.getByText('Garçom para evento E2E').first()).toBeVisible();
  await print(page, 'f2', 'mural por cidade mostra a vaga');

  // Raio: a mesma vaga pelo filtro "Até X km" (feed_jobs com p_radius_km), como o app chama.
  const worker = await comoConta(contas.trabalhador.email);
  const { data: porRaio, error } = await worker.rpc('feed_jobs', {
    p_city: 'Caxias do Sul',
    p_uf: 'RS',
    p_lat: -29.17,
    p_lon: -51.18,
    p_radius_km: 15
  });
  expect(error).toBeNull();
  expect((porRaio as { id: string }[]).map((j) => j.id)).toContain(vaga);
  const { data: longe } = await worker.rpc('feed_jobs', {
    p_city: 'São Paulo',
    p_uf: 'SP',
    p_lat: -23.55,
    p_lon: -46.63,
    p_radius_km: 50
  });
  expect((longe as { id: string }[]).map((j) => j.id)).not.toContain(vaga);
});
