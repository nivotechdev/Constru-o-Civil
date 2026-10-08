import { oficioNome } from '../services/catalog';
import type { Job } from '../types/models';

// Opens a WhatsApp chat with a Brazilian number, optionally with a message typed in.
export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const number = digits.startsWith('55') ? digits : '55' + digits;
  return `https://wa.me/${number}` + (text ? `?text=${encodeURIComponent(text)}` : '');
}

type JobRef = Pick<Job, 'id' | 'oficioId'>;

/** The worker's first message to the company that picked them. */
export function workerToCompanyMessage(job: JobRef): string {
  return `Olá! Vi sua vaga de ${oficioNome(job.oficioId)} (${job.id}) na Bicos e fui aprovado. Podemos combinar os detalhes?`;
}

/** The company's first message to the worker it picked. */
export function companyToWorkerMessage(workerName: string, companyName: string, job: JobRef): string {
  const first = workerName.split(' ')[0];
  return `Olá, ${first}! Aqui é da ${companyName}, sobre a vaga de ${oficioNome(job.oficioId)} (${job.id}) na Bicos. Podemos combinar os detalhes?`;
}

export function workerToCompanyUrl(companyPhone: string, job: JobRef): string | null {
  return whatsappUrl(companyPhone, workerToCompanyMessage(job));
}

export function companyToWorkerUrl(workerPhone: string, workerName: string, companyName: string, job: JobRef) {
  return whatsappUrl(workerPhone, companyToWorkerMessage(workerName, companyName, job));
}
