// WhatsApp contact between a company and a worker. The number is private on both sides: it is handed
// out only here, and only while the company has picked or hired the worker (then it opens for both).
import { contactOpen } from './applicationMachine';
import { oficioNome } from './catalog';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { getDb, getSession } from './store';
import { companyToWorkerUrl, workerToCompanyUrl } from '../utils/whatsapp';
import { IS_DEMO } from './mode';
import * as remote from './remote/actions';

export interface Contact {
  /** Who is on the other side ("Construtora Meridiano", "Jorge Mendes"). */
  name: string;
  phone: string;
  /** wa.me link with the ready-made first message. */
  url: string;
}

/**
 * The other side's WhatsApp for one candidacy, as seen by the logged-in account. Refused unless the
 * candidacy is picked or hired and the account is one of its two sides. Backend: an RPC (security
 * definer) that checks the same thing before reading the private phone column.
 */
export async function getContact(applicationId: string): Promise<Contact> {
  if (!IS_DEMO) return remote.getContact(applicationId);
  await mockLatency(250);
  const db = getDb();
  const session = getSession();
  const app = db.applications.find((a) => a.id === applicationId);
  const job = app ? db.jobs[app.jobId] : undefined;
  if (!app || !job) throw serviceError('nao_encontrado', 'Essa candidatura não existe mais.');
  if (!contactOpen(app.status))
    throw serviceError('nao_autorizado', 'O contato abre quando a construtora aprova o candidato.');
  const company = db.companies[job.companyId];
  const worker = db.workers[app.workerId];
  if (session?.role === 'trabalhador' && session.workerId === app.workerId) {
    const url = workerToCompanyUrl(company.whatsapp, job);
    if (!url) throw serviceError('nao_encontrado', 'A construtora ainda não cadastrou um WhatsApp.');
    return { name: company.name, phone: company.whatsapp, url };
  }
  if (session?.role === 'recrutador' && session.companyId === job.companyId) {
    const url = companyToWorkerUrl(worker.whatsapp, worker.name, company.name, job);
    if (!url) throw serviceError('nao_encontrado', 'Esse trabalhador ainda não cadastrou um WhatsApp.');
    return { name: worker.name, phone: worker.whatsapp, url };
  }
  throw serviceError('nao_autorizado', `Esse contato é só de quem está no bico de ${oficioNome(job.oficioId)}.`);
}
