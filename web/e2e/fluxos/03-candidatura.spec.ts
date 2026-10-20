// Fluxo 3: candidatura → construtora vê o candidato → aprova → WhatsApp liberado para os dois → recusa outro
// candidato → desfaz a recusa.
import { expect, test } from '@playwright/test';
import { comoConta, contaPorApi, entrar, estado, linhaDoCandidato, prepararPagina, print } from '../apoio';

test('candidatura, aprovação com WhatsApp liberado, recusa e desfazer', async ({ browser }) => {
  const { contas, vaga } = estado();
  expect(vaga, 'a vaga do fluxo 2').toBeTruthy();

  // Trabalhador 1 se candidata pela tela.
  const w = await browser.newPage();
  await prepararPagina(w);
  await entrar(w, contas.trabalhador.email);
  await w.goto('/vaga/' + vaga);
  await print(w, 'f3', 'detalhe da vaga');
  await w.getByRole('button', { name: 'Quero esse bico' }).click();
  await w.getByRole('button', { name: 'Sim, quero esse bico' }).click();
  await expect(w).toHaveURL(/\/enviado\//);
  await print(w, 'f3', 'candidatura enviada');

  // Trabalhador 2 (pela API) também se candidata.
  const outro = await contaPorApi('trabalhador2', 'trabalhador', 'Segundo Candidato E2E');
  const c2 = await comoConta(outro.email);
  expect((await c2.rpc('submit_application', { p_job_id: vaga })).error).toBeNull();
  // Antes da aprovação, ninguém vê o WhatsApp do outro.
  const { data: semContato } = await (
    await comoConta(contas.construtora.email)
  )
    .from('applications')
    .select('id')
    .eq('job_id', vaga!);
  for (const a of semContato ?? []) {
    const r = await (await comoConta(contas.construtora.email)).rpc('get_contact', { p_application_id: a.id });
    expect(r.error, 'contato antes da aprovação').not.toBeNull();
  }

  // Construtora vê os dois, aprova o 1 e recusa o 2 — e desfaz a recusa.
  const c = await browser.newPage();
  await prepararPagina(c);
  await entrar(c, contas.construtora.email);
  await c.goto('/vaga-gerenciar/' + vaga);
  await expect(c.getByText(contas.trabalhador.nome, { exact: true })).toBeVisible();
  await expect(c.getByText(outro.nome, { exact: true })).toBeVisible();
  await print(c, 'f3', 'construtora ve os candidatos');
  await linhaDoCandidato(c, contas.trabalhador.nome).getByRole('button', { name: 'Aprovar candidato' }).click();
  await expect(c.getByText('O WhatsApp está liberado')).toBeVisible();
  await expect(
    linhaDoCandidato(c, contas.trabalhador.nome).getByRole('link', { name: 'Falar no WhatsApp' })
  ).toBeVisible();
  await print(c, 'f3', 'aprovado whatsapp liberado para a construtora');

  await linhaDoCandidato(c, outro.nome).getByRole('button', { name: 'Recusar candidato' }).click();
  // O "Desfazer" do aviso da recusa (o da aprovação pode ainda estar na tela).
  await c
    .getByText(`${outro.nome.split(' ')[0]} recusado`)
    .locator('xpath=ancestor::*[.//button[normalize-space()="Desfazer"]][1]')
    .getByRole('button', { name: 'Desfazer' })
    .click();
  await expect(c.getByText('Recusa desfeita')).toBeVisible();
  await print(c, 'f3', 'recusa desfeita');
  const { data: apps } = await (
    await comoConta(contas.construtora.email)
  )
    .from('applications')
    .select('worker_id, status')
    .eq('job_id', vaga!);
  const status = Object.fromEntries((apps ?? []).map((a) => [a.worker_id, a.status]));
  expect(status[contas.trabalhador.id]).toBe('pre_selecionado');
  expect(['enviada', 'em_analise']).toContain(status[outro.id]);

  // O trabalhador aprovado também vê o WhatsApp da construtora.
  await w.goto('/minhas-candidaturas');
  await expect(w.getByRole('link', { name: 'Falar no WhatsApp' }).first()).toBeVisible();
  await print(w, 'f3', 'whatsapp liberado para o trabalhador');
  const href = await w.getByRole('link', { name: 'Falar no WhatsApp' }).first().getAttribute('href');
  expect(href).toContain('wa.me/55' + contas.construtora.whatsapp);
  await w.close();
  await c.close();
});
