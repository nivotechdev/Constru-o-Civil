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
import type { ProviderCardToken } from '../payments';
import { db, invokeFunction, request } from './client';
import { loadJob } from './data';
import { apply, putPayments } from './merge';
import { checkPassword, signOut } from './auth';

// ---- notifications ----

export async function markAllNotificationsRead(): Promise<void> {
  const client = await db();
  const now = new Date().toISOString();
  // RLS limits the update to the session's notifications.
  await request(() => client.from('notifications').update({ read_at: now }).is('read_at', null));
  store.transact((d) => ({
    ...d,
    notifications: d.notifications.map((n) => (n.readAt ? n : { ...n, readAt: now })),
    unreadTotal: 0
  }));
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
    notifications: d.notifications.map((n) => (n.id === id ? { ...n, readAt: now } : n)),
    unreadTotal: d.unreadTotal === undefined ? undefined : Math.max(0, d.unreadTotal - 1)
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
  if (job && app) {
    const hired = app.status === 'contratado';
    if (session?.role === 'trabalhador') {
      const workerName = data.workers[app.workerId]?.name ?? '';
      const contactName = data.companies[job.companyId]?.contactName;
      url = workerToCompanyUrl(contact.phone, { workerName, companyName: contact.name, job, hired, contactName });
    } else {
      const companyName = data.companies[job.companyId]?.name ?? '';
      url = companyToWorkerUrl(contact.phone, { workerName: contact.name, companyName, job, hired });
    }
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

// ---- boost payments: the charge is created by the Edge Function criar-cobranca (Mercado Pago) and
// confirmed by the provider's webhook; the app only reads the payment back ----

async function keep(row: Parameters<typeof boostPaymentFromRow>[0]): Promise<BoostPayment> {
  apply(putPayments([row]));
  return boostPaymentFromRow(row);
}

type PaymentRow = Parameters<typeof boostPaymentFromRow>[0];

export async function getPayment(paymentId: string): Promise<BoostPayment> {
  const client = await db();
  const payment = await keep(await request(() => client.rpc('get_payment', { p_payment_id: paymentId })));
  if (payment.status === 'confirmado') await loadJob(payment.jobId);
  return payment;
}

export async function startPixPayment(jobId: string, planId: BoostPlanId): Promise<BoostPayment> {
  const { pagamento } = await invokeFunction<{ pagamento: PaymentRow }>('criar-cobranca', {
    jobId,
    plan: planId,
    method: 'pix'
  });
  return keep(pagamento);
}

/** The card was tokenized in the browser by the provider's form: only the token goes to the server. */
export async function payWithCard(jobId: string, planId: BoostPlanId, card: ProviderCardToken): Promise<BoostPayment> {
  const { pagamento } = await invokeFunction<{ pagamento: PaymentRow }>('criar-cobranca', {
    jobId,
    plan: planId,
    method: 'cartao',
    card
  });
  const payment = await keep(pagamento);
  if (payment.status === 'recusado')
    throw serviceError('conflito', 'O banco recusou o cartão. Confira os dados ou use outro cartão ou o PIX.');
  if (payment.status === 'confirmado') await loadJob(jobId);
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
  // Y15: the Edge Function runs delete_my_account as this user (recent sign-in, anonymized reviews) and
  // then removes the user's files from Storage.
  await invokeFunction('excluir-conta', { confirmCommitments });
  await signOut();
}

/** F11: the company's payments (RLS: own company). */
export async function loadMyPayments(): Promise<void> {
  const companyId = store.getSession()?.companyId;
  if (!companyId) return;
  const client = await db();
  const rows = await request(() =>
    client
      .from('boost_payments')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100)
  );
  apply(putPayments(rows));
}
