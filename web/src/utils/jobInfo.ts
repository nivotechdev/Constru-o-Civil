// How a job's schedule reads everywhere in the app. Date and hours are optional (a job
// can leave them to be arranged with the worker); `dias` says which part of the week
// the job can happen on.
import type { DiasKey, Job } from '../types/models';

interface DiasInfo {
  /** Job page. */
  label: string;
  /** Tiles. */
  short: string;
  /** Job page. */
  hint: string;
  /** The three cards in the publish form. */
  pick: string;
  pickSub: string;
}

export const DIAS: Record<DiasKey, DiasInfo> = {
  semana: {
    label: 'Durante a semana',
    short: 'Seg a sex',
    hint: 'De segunda a sexta',
    pick: 'Semana',
    pickSub: 'Seg a sex'
  },
  fimdesemana: {
    label: 'No fim de semana',
    short: 'Sáb e dom',
    hint: 'Sábado e domingo',
    pick: 'Fim de semana',
    pickSub: 'Sáb e dom'
  },
  qualquer: {
    label: 'Qualquer dia',
    short: 'Qualquer dia',
    hint: 'Semana ou fim de semana',
    pick: 'Qualquer dia',
    pickSub: 'Seg a dom'
  }
};
export const DIAS_ORDEM: DiasKey[] = ['semana', 'fimdesemana', 'qualquer'];

type Schedule = Pick<Job, 'date' | 'hours'> & { dias?: DiasKey | null };

export function diasInfo(job: Schedule): DiasInfo | null {
  return (job.dias && DIAS[job.dias]) || null;
}

/** "Hoje", or "Data a combinar" when the job has no date. */
export function dateText(job: Schedule): string {
  return job.date || 'Data a combinar';
}

/** "Hoje · 7h–17h", "Hoje", "Data a combinar · 7h–17h" or "Data e horário a combinar". */
export function whenText(job: Schedule): string {
  if (job.date) return job.hours ? `${job.date} · ${job.hours}` : job.date;
  return job.hours ? `Data a combinar · ${job.hours}` : 'Data e horário a combinar';
}

export function hoursText(job: Schedule): string {
  return job.hours || 'Horário a combinar';
}
