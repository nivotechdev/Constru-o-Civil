import type { Company, Job } from '../types/models';

// Opens a WhatsApp chat with a Brazilian number, optionally with a message typed in.
export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const number = digits.startsWith('55') ? digits : '55' + digits;
  return `https://wa.me/${number}` + (text ? `?text=${encodeURIComponent(text)}` : '');
}

/** The worker's first message to the company that picked them for a job. */
export function workerToCompanyUrl(company: Company, job: Job): string | null {
  return whatsappUrl(
    company.whatsapp,
    `Olá, ${company.name}! Sou da Bicos e fui escolhido para a vaga de ${job.role} (${job.id}). Podemos combinar os detalhes?`
  );
}
