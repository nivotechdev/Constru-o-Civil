// "Avisar quando aparecer bico novo" (Y28): one alert per worker — a city, or a radius around a point,
// and an optional trade. Each new job that matches sends the notice "Bico novo perto de você" (at most 5 a
// day). Backend: table job_alerts (the worker reads their own), RPCs save_job_alert / delete_job_alert,
// and a trigger on new jobs that writes the notices (migration 20261011000700).
import type { AppNotification, Database, Job, JobAlert, Session } from '../types/models';
import { distanceKm } from '../utils/geo';
import { fold } from '../utils/text';
import { formatPay } from '../utils/format';
import { jobTitle, oficioNome } from './catalog';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { IS_DEMO } from './mode';
import { withNotification } from './notifications';
import * as store from './store';
import { db, request } from './remote/client';

export type JobAlertInput = Omit<JobAlert, 'workerId'>;

/** Notices of new jobs a worker gets per day, at most. */
export const ALERTS_PER_DAY = 5;

/** The session's alert, if any. */
export function myJobAlert(database: Database, session: Session | null): JobAlert | null {
  return session?.workerId ? (database.jobAlerts?.[session.workerId] ?? null) : null;
}

/** "Pintor · São Paulo, SP · até 10 km" */
export function alertSummary(alert: JobAlertInput): string {
  return [
    alert.oficioId ? oficioNome(alert.oficioId) : 'Qualquer serviço',
    alert.city,
    alert.radiusKm ? `até ${alert.radiusKm} km` : 'toda a cidade'
  ].join(' · ');
}

/** Does a new job match the alert? (Same rule as the trigger notify_job_alerts.) */
export function alertMatches(alert: JobAlertInput, job: Job): boolean {
  // U01: a job without a trade reaches every alert of the area.
  if (alert.oficioId && job.oficioId && alert.oficioId !== job.oficioId) return false;
  if (alert.radiusKm == null) {
    const [city, uf = ''] = alert.city.split(',').map((x) => x.trim());
    return fold(city) === fold(job.address.city) && uf === job.address.uf;
  }
  return distanceKm(alert, job.address) <= alert.radiusKm;
}

/**
 * Demo: the snapshot with the notices for a job just published (what the trigger does). Pure, so the
 * publish adds them in the same transaction.
 */
export function withAlertNotices(database: Database, job: Job, at: string): Database {
  const today = at.slice(0, 10);
  let next = database;
  for (const alert of Object.values(database.jobAlerts ?? {})) {
    if (!alertMatches(alert, job)) continue;
    const sentToday = next.notifications.filter(
      (n: AppNotification) => n.workerId === alert.workerId && n.kind === 'bico_novo' && n.createdAt.startsWith(today)
    ).length;
    if (sentToday >= ALERTS_PER_DAY) continue;
    const where = job.address.neighborhood || job.address.city;
    next = withNotification(
      next,
      {
        kind: 'bico_novo',
        title: 'Bico novo perto de você',
        text: `${jobTitle(job)} em ${where}${job.pay ? ` · ${formatPay(job.pay)} por diária` : ''}`,
        workerId: alert.workerId,
        companyId: null,
        target: '/vaga/' + job.id
      },
      at
    );
  }
  return next;
}

function putAlert(workerId: string, alert: JobAlert | null): void {
  store.transact((d) => {
    const alerts = { ...(d.jobAlerts ?? {}) };
    if (alert) alerts[workerId] = alert;
    else delete alerts[workerId];
    return { ...d, jobAlerts: alerts };
  });
}

function workerId(): string {
  const id = store.getSession()?.workerId;
  if (!id) throw serviceError('nao_autorizado', 'Só trabalhadores recebem aviso de bico novo.');
  return id;
}

/** Reads the session's alert. Backend: select job_alerts (RLS: own). */
export async function loadMyJobAlert(): Promise<void> {
  const id = store.getSession()?.workerId;
  if (!id) return;
  if (IS_DEMO) return mockLatency(200);
  const client = await db();
  const row = await request(() => client.from('job_alerts').select('*').eq('worker_id', id).maybeSingle());
  putAlert(
    id,
    row
      ? {
          workerId: id,
          city: `${row.city}, ${row.uf}`,
          lat: row.lat,
          lon: row.lon,
          radiusKm: row.radius_km,
          oficioId: row.oficio_id
        }
      : null
  );
}

/** Turns the alert on (or replaces it). Backend: RPC save_job_alert. */
export async function saveJobAlert(input: JobAlertInput): Promise<void> {
  const id = workerId();
  const [city, uf = ''] = input.city.split(',').map((x) => x.trim());
  if (!city || !/^[A-Z]{2}$/.test(uf)) throw serviceError('validacao', 'Escolha a cidade do aviso.');
  if (input.radiusKm != null && (input.radiusKm < 1 || input.radiusKm > 100))
    throw serviceError('validacao', 'Escolha uma distância de até 100 km.');
  if (IS_DEMO) {
    await mockLatency(400);
  } else {
    const client = await db();
    await request(() =>
      client.rpc('save_job_alert', {
        p_city: city,
        p_uf: uf,
        p_lat: input.lat,
        p_lon: input.lon,
        p_radius_km: input.radiusKm,
        p_oficio: input.oficioId
      })
    );
  }
  putAlert(id, { ...input, workerId: id });
}

/** Turns the alert off. Backend: RPC delete_job_alert. */
export async function deleteJobAlert(): Promise<void> {
  const id = workerId();
  if (IS_DEMO) {
    await mockLatency(300);
  } else {
    const client = await db();
    await request(() => client.rpc('delete_job_alert'));
  }
  putAlert(id, null);
}
