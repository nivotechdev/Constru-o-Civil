import { jobTitle } from '../services/catalog';
import type { Job } from '../types/models';

// Opens a WhatsApp chat with a Brazilian number, optionally with a message typed in.
export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  // L11: decide by the length, not by a leading 55 — DDD 55 (Santa Maria, RS…) is also "55".
  const number = digits.length <= 11 ? '55' + digits : digits;
  return `https://wa.me/${number}` + (text ? `?text=${encodeURIComponent(text)}` : '');
}

type JobRef = Pick<Job, 'id' | 'oficioId' | 'title'> & Partial<Pick<Job, 'startDate' | 'endDate' | 'dateToArrange'>>;

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "do dia 12/10", "de 12/10 a 15/10" or "com data a combinar" (P07). */
function whenText(job: JobRef): string {
  if (job.dateToArrange || !job.startDate) return 'com data a combinar';
  if (!job.endDate || job.endDate === job.startDate) return `do dia ${dm(job.startDate)}`;
  return `de ${dm(job.startDate)} a ${dm(job.endDate)}`;
}

/** Who writes and about what (P07). `hired`: the hire was confirmed ("fui contratado"). */
export interface MessageParts {
  workerName: string;
  companyName: string;
  job: JobRef;
  hired: boolean;
}

/** The worker's first message to the company that picked them. */
export function workerToCompanyMessage({ workerName, companyName, job, hired }: MessageParts): string {
  const first = workerName.split(' ')[0];
  // U63: the one name of whoever hires (a person or a company).
  const to = companyName ? `, ${companyName}` : '';
  return `Olá${to}! Aqui é ${first}, da Bicos. Fui ${hired ? 'contratado' : 'aprovado'} para a vaga "${jobTitle(job)}" (${job.id}) ${whenText(job)}. Podemos combinar os detalhes?`;
}

/** The company's first message to the worker it picked. */
export function companyToWorkerMessage({ workerName, companyName, job, hired }: MessageParts): string {
  const first = workerName.split(' ')[0];
  return `Olá, ${first}! Aqui é da ${companyName}, pela Bicos. Você foi ${hired ? 'contratado' : 'aprovado'} para a vaga "${jobTitle(job)}" (${job.id}) ${whenText(job)}. Podemos combinar os detalhes?`;
}

export function workerToCompanyUrl(companyPhone: string, parts: MessageParts): string | null {
  return whatsappUrl(companyPhone, workerToCompanyMessage(parts));
}

export function companyToWorkerUrl(workerPhone: string, parts: MessageParts): string | null {
  return whatsappUrl(workerPhone, companyToWorkerMessage(parts));
}
