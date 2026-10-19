// Fluxo 4: contratar → trabalhador confirma presença → diária concluída (conclude_finished_jobs, como o cron)
// → avaliação dos dois lados → as notas aparecem nos perfis.
import { expect, test } from '@playwright/test';
import { admin, entrar, estado, linhaDoCandidato, prepararPagina, print } from '../apoio';

const dia = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

test('presença, diária concluída e avaliação dos dois lados', async ({ browser }) => {
  const { contas, vaga } = estado();
  const c = await browser.newPage();
  await prepararPagina(c);
  await entrar(c, contas.construtora.email);
  await c.goto('/vaga-gerenciar/' + vaga);
  await linhaDoCandidato(c, contas.trabalhador.nome).getByRole('button', { name: 'Confirmar contratação' }).click();
  await c.getByRole('dialog').getByRole('button', { name: 'Confirmar contratação' }).click();
  await expect(c.getByRole('dialog')).toBeHidden();
  await print(c, 'f4', 'construtora confirma a contratacao');

  const w = await browser.newPage();
  await prepararPagina(w);
  await entrar(w, contas.trabalhador.email);
  await w.goto('/selecionado/' + vaga);
  await w.getByRole('button', { name: 'Confirmar que vou' }).click();
  await expect(w.getByText('Presença confirmada')).toBeVisible();
  await print(w, 'f4', 'trabalhador confirma presenca');
  const { data: app } = await admin()
    .from('applications')
    .select('status, presence_confirmed_at')
    .eq('job_id', vaga!)
    .eq('worker_id', contas.trabalhador.id)
    .single();
  expect(app).toMatchObject({ status: 'contratado' });
  expect(app!.presence_confirmed_at).not.toBeNull();

  // O tempo passa: a diária acabou há 2 dias (o prazo para marcar falta) e a rotina das horas
  // (cron bicos-concluir-diarias) roda.
  expect(
    (
      await admin()
        .from('jobs')
        .update({ start_date: dia(-4), end_date: dia(-2) })
        .eq('id', vaga!)
    ).error
  ).toBeNull();
  expect((await admin().rpc('conclude_finished_jobs')).error).toBeNull();
  const { data: done } = await admin()
    .from('applications')
    .select('status')
    .eq('job_id', vaga!)
    .eq('worker_id', contas.trabalhador.id)
    .single();
  expect(done!.status).toBe('concluida');

  // Trabalhador avalia a construtora.
  await w.goto('/avaliar/' + vaga);
  await w.getByRole('radio', { name: /^5 estrelas/ }).click();
  await w.getByRole('button', { name: 'Enviar avaliação' }).click();
  await expect(w.getByRole('button', { name: 'Enviar avaliação' })).toBeHidden();
  await print(w, 'f4', 'trabalhador avaliou a construtora');

  // Construtora avalia o trabalhador.
  await c.goto(`/avaliar-trabalhador/${vaga}/${contas.trabalhador.id}`);
  await c.getByRole('radio', { name: /^4 estrelas/ }).click();
  await c.getByRole('button', { name: 'Enviar avaliação' }).click();
  await expect(c.getByRole('button', { name: 'Enviar avaliação' })).toBeHidden();
  await print(c, 'f4', 'construtora avaliou o trabalhador');

  const { data: wk } = await admin()
    .from('workers')
    .select('rating, review_count, jobs_done')
    .eq('id', contas.trabalhador.id)
    .single();
  const { data: co } = await admin()
    .from('companies')
    .select('rating, review_count')
    .eq('id', contas.construtora.id)
    .single();
  expect(wk).toMatchObject({ rating: 4, review_count: 1 });
  expect(co).toMatchObject({ rating: 5, review_count: 1 });

  // As notas nos perfis, como cada lado vê o outro.
  await c.goto('/trabalhador/' + contas.trabalhador.id);
  await expect(c.getByText('4,0', { exact: true })).toBeVisible();
  await expect(c.getByText('1 bico concluído na Bicos')).toBeVisible();
  await print(c, 'f4', 'nota no perfil do trabalhador');
  await w.goto('/construtora/' + contas.construtora.id);
  await expect(w.getByText('5,0', { exact: true })).toBeVisible();
  await print(w, 'f4', 'nota no perfil da construtora');
  await c.close();
  await w.close();
});
