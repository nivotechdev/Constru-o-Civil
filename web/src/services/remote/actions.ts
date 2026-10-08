// The remaining actions with the real backend: notifications read, WhatsApp contact, reviews, boost
// payments and the account's privacy operations. Same signatures, results and errors as the demo.
import type { BoostPayment, BoostPlanId } from '../../types/models';
import type { ReviewInput } from '../reviews';
import { MAX_COMMENT } from '../reviews';
import type { Contact } from '../contacts';
import { serviceError } from '../errors';
import * as store from '../store';
import { boostPaymentFromRow } from '../supabaseMappers';
import { companyToWorkerUrl, workerToCompanyUrl } from '../../utils/whatsapp';
import { validateCard, type CardInput } from '../../utils/card';
import { db, request } from './client';
import { loadJob } from './data';
import { apply, putPayments } from './merge';
import { checkPassword, signOut } from './auth';

// ---- notifications ----

export async function markAllNotificationsRead(): Promise<void> {
  const client = await db();
  const now = new Date().toISOString();
  // RLS limits the update to the session's notifications.
  await request(() => client.from('notifications').update({ read_at: now }).is('read_at', null));
  store.transact((d) => ({ ...d, notifications: d.notifications.map((n) => (n.readAt ? n : { ...n, readAt: now })) }));
}

export async function markNotificationRead(id: string): Promise<void> {
  const mine = store.getDb().notifications.find((n) => n.id === id);
  if (!mine) throw serviceError('nao_encontrado', 'Essa notificação não existe mais.');
  if (mine.readAt) return;
  const client = await db();
  const now = new Date().toISOString();
  await request(() => client.from('notifications').update({ read_at: now }).eq('id', id));
  store.transact((d) => ({
    ...d,
    notifications: d.notifications.map((n) => (n.id === id ? { ...n, readAt: now } : n))
  }));
}

// ---- WhatsApp ----

/** The server checks who may see the number (get_contact); the ready-made message is built here. */
export async function getContact(applicationId: string): Promise<Contact> {
  const client = await db();
  const rows = await request(() => client.rpc('get_contact', { p_application_id: applicationId }));
  const contact = rows[0];
  if (!contact) throw serviceError('nao_encontrado', 'Esse contato não está disponível.');
  const data = store.getDb();
  const app = data.applications.find((a) => a.id === applicationId);
  const job = app ? data.jobs[app.jobId] : undefined;
  const session = store.getSession();
  let url: string | null = null;
  if (job && session?.role === 'trabalhador') url = workerToCompanyUrl(contact.phone, job);
  else if (job && app) {
    const companyName = data.companies[job.companyId]?.name ?? '';
    url = companyToWorkerUrl(contact.phone, contact.name, companyName, job);
  }
  if (!url) throw serviceError('nao_encontrado', 'Esse contato não está disponível.');
  return { name: contact.name, phone: contact.phone, url };
}

// ---- reviews ----

export async function submitReview(input: ReviewInput): Promise<void> {
  if (!Number.isInteger(input.value) || input.value < 1 || input.value > 5)
    throw serviceError('validacao', 'Escolha uma nota de 1 a 5 estrelas.');
  const comment = input.comment.trim();
  if (comment.length > MAX_COMMENT) throw serviceError('validacao', `Use até ${MAX_COMMENT} caracteres.`);
  const client = await db();
  await request(() =>
    client.rpc('submit_review', {
      p_application_id: input.applicationId,
      p_direction: input.direction,
      p_value: input.value,
      p_tags: input.tags,
      p_comment: comment
    })
  );
  const app = store.getDb().applications.find((a) => a.id === input.applicationId);
  if (app) await loadJob(app.jobId);
}

// ---- boost payments (the provider is simulated on the server until it is integrated) ----

async function keep(row: Parameters<typeof boostPaymentFromRow>[0]): Promise<BoostPayment> {
  apply(putPayments([row]));
  return boostPaymentFromRow(row);
}

export async function getPayment(paymentId: string): Promise<BoostPayment> {
  const client = await db();
  return keep(await request(() => client.rpc('get_payment', { p_payment_id: paymentId })));
}

export async function startPixPayment(jobId: string, planId: BoostPlanId): Promise<BoostPayment> {
  const client = await db();
  return keep(await request(() => client.rpc('start_pix_payment', { p_job_id: jobId, p_plan: planId })));
}

export async function simulatePixPaid(paymentId: string): Promise<BoostPayment> {
  const client = await db();
  const payment = await keep(await request(() => client.rpc('simulate_pix_paid', { p_payment_id: paymentId })));
  await loadJob(payment.jobId);
  return payment;
}

/** The card number never leaves the device: only its last 4 digits go to the server, for the receipt. */
export async function payWithCard(jobId: string, planId: BoostPlanId, card: CardInput): Promise<BoostPayment> {
  if (Object.keys(validateCard(card)).length) throw serviceError('validacao', 'Confira os dados do cartão.');
  const last4 = card.number.replace(/\D/g, '').slice(-4);
  const client = await db();
  const payment = await keep(
    await request(() => client.rpc('pay_with_card', { p_job_id: jobId, p_plan: planId, p_card_last4: last4 }))
  );
  if (payment.status === 'recusado')
    throw serviceError('conflito', 'O banco recusou o cartão. Confira os dados ou use outro cartão ou o PIX.');
  await loadJob(jobId);
  return payment;
}

// ---- privacy (LGPD) ----

/** Builds the file with everything the account has on the server and saves it on the device. */
export async function exportMyData(): Promise<void> {
  const client = await db();
  const data = await request(() => client.rpc('export_my_data'));
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bicos-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function deleteAccount(password: string, confirmCommitments: boolean): Promise<void> {
  if (!(await checkPassword(password))) throw serviceError('validacao', 'Senha incorreta. Confira e tente de novo.');
  const client = await db();
  await request(() => client.rpc('delete_my_account', { p_confirm_commitments: confirmCommitments }));
  await signOut();
}
