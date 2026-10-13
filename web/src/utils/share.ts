// F09: sharing a job — the phone's share sheet when there is one, otherwise WhatsApp with the text ready.
import type { Job } from '../types/models';
import { jobTitle } from '../services/catalog';
import { formatPay } from './format';
import { routeUrl } from '../services/router';

/** The job's public link (opens without signing in: /v/:id). */
export function jobShareUrl(
  jobId: string,
  loc: Pick<Location, 'origin' | 'pathname' | 'protocol'> = window.location
): string {
  return routeUrl('/v/' + jobId, loc);
}

export function jobShareText(job: Pick<Job, 'oficioId' | 'title' | 'pay' | 'address'>): string {
  const where = job.address.neighborhood || job.address.city;
  const pay = job.pay ? ` · ${formatPay(job.pay)} por diária` : '';
  return `${jobTitle(job)} em ${where}${pay}. Vi na Bicos:`;
}

/** Opens the share sheet (or WhatsApp). Answers how it went. */
export async function shareJob(job: Job): Promise<'compartilhado' | 'whatsapp' | 'cancelado'> {
  const url = jobShareUrl(job.id);
  const text = jobShareText(job);
  const nav = globalThis.navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  if (nav?.share) {
    try {
      await nav.share({ title: jobTitle(job), text, url });
      return 'compartilhado';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelado';
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
  return 'whatsapp';
}
