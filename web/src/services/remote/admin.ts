// L06 (lançamento): the real body of services/admin.ts — the `admin_*` RPCs (each checks is_staff() on the
// server) and signed links to the private identity photos (storage policy: only the team reads them).
import type { AccountHistory, CompanyItem, IdentityItem, ReceitaData, ReportItem, StaffAction } from '../admin';
import { db, request } from './client';

/** How long a link to a selfie or document photo works. */
const PHOTO_LINK_SECONDS = 300;

export async function isStaff(): Promise<boolean> {
  const client = await db();
  return Boolean(await request(() => client.rpc('is_staff')));
}

export async function identityQueue(): Promise<IdentityItem[]> {
  const client = await db();
  const rows = await request(() => client.rpc('admin_identity_queue'));
  return (rows ?? []).map((r) => ({
    workerId: r.worker_id,
    name: r.name,
    oficio: r.oficio,
    city: r.city,
    photoUrl: r.photo_url,
    document: r.document,
    createdAt: r.created_at,
    submittedAt: r.submitted_at,
    selfiePath: r.selfie_path,
    documentPath: r.document_path,
    submissions: Number(r.submissions)
  }));
}

export async function signedLinks(paths: (string | null)[]): Promise<(string | null)[]> {
  const client = await db();
  return Promise.all(
    paths.map(async (path) => {
      if (!path) return null;
      const { data, error } = await client.storage.from('identidade').createSignedUrl(path, PHOTO_LINK_SECONDS);
      return error ? null : data.signedUrl;
    })
  );
}

export async function decideIdentity(workerId: string, status: 'verificado' | 'recusado', reason: string | null) {
  const client = await db();
  await request(() => client.rpc('admin_decide_identity', { p_worker: workerId, p_status: status, p_reason: reason }));
}

export async function companyQueue(): Promise<CompanyItem[]> {
  const client = await db();
  const rows = await request(() => client.rpc('admin_company_queue'));
  return (rows ?? []).map((r) => ({
    companyId: r.company_id,
    name: r.name,
    location: r.location,
    tipoObra: r.tipo_obra,
    email: r.email,
    document: r.document,
    documentKind: r.document_kind === 'cnpj' ? 'cnpj' : 'cpf',
    createdAt: r.created_at,
    receita: (r.cnpj_check as ReceitaData | null) ?? null
  }));
}

export async function decideCompany(companyId: string, status: 'verificada' | 'reprovada', reason: string | null) {
  const client = await db();
  await request(() => client.rpc('admin_decide_company', { p_company: companyId, p_status: status, p_reason: reason }));
}

export async function reportQueue(status: 'aberta' | 'analisada'): Promise<ReportItem[]> {
  const client = await db();
  const rows = await request(() => client.rpc('admin_report_queue', { p_status: status }));
  return (rows ?? []).map((r) => ({
    id: r.id,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    details: r.details,
    status: r.status === 'analisada' ? 'analisada' : 'aberta',
    resolution: (r.resolution as ReportItem['resolution']) ?? null,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    reportsOnTarget: Number(r.reports_on_target),
    target: r.target as unknown as ReportItem['target'],
    account: (r.account as unknown as AccountHistory | null) ?? null
  }));
}

export async function resolveReport(reportId: string, action: string, reason: string | null) {
  const client = await db();
  await request(() => client.rpc('admin_resolve_report', { p_report: reportId, p_action: action, p_reason: reason }));
}

export async function unsuspendAccount(accountId: string, reason: string | null) {
  const client = await db();
  await request(() => client.rpc('admin_unsuspend_account', { p_account: accountId, p_reason: reason }));
}

export async function unhideJob(jobId: string, reason: string | null) {
  const client = await db();
  await request(() => client.rpc('admin_unhide_job', { p_job: jobId, p_reason: reason }));
}

export async function staffActions(): Promise<StaffAction[]> {
  const client = await db();
  const rows = await request(() => client.rpc('admin_actions', { p_limit: 100 }));
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    staffEmail: r.staff_email,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    createdAt: r.created_at
  }));
}
