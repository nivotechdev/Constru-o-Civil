// L06 (lançamento): the team's back-office (/admin) — identity checks, company checks, reports and the audit
// log. Everything runs through `admin_*` RPCs that start by checking `is_staff()` on the server; the browser
// never holds a service_role key. The demo has no team: the screen explains that it exists only with the real
// backend. Backend: migration 20261015000100_lanc06_backoffice.
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { IS_DEMO } from './mode';
import * as store from './store';

export interface IdentityItem {
  workerId: string;
  name: string;
  city: string;
  photoUrl: string | null;
  document: string;
  createdAt: string;
  submittedAt: string | null;
  selfiePath: string | null;
  documentPath: string | null;
  submissions: number;
}

export interface ReceitaData {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  situacao?: string | null;
  abertura?: string | null;
  atividade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  consultado_em?: string | null;
}

export interface CompanyItem {
  companyId: string;
  name: string;
  location: string;
  email: string;
  document: string;
  documentKind: 'cnpj' | 'cpf';
  createdAt: string;
  receita: ReceitaData | null;
}

export interface AccountHistory {
  account_id: string;
  role: 'trabalhador' | 'recrutador';
  name: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  rating: number | null;
  review_count: number | null;
  verified: boolean | null;
  reports_against: number;
  jobs: number;
  applications: number;
  staff_actions: number;
}

export interface ReportItem {
  id: string;
  targetType: 'vaga' | 'perfil' | 'avaliacao' | 'post';
  targetId: string;
  reason: string;
  details: string | null;
  status: 'aberta' | 'analisada';
  resolution: ReportAction | null;
  createdAt: string;
  resolvedAt: string | null;
  reportsOnTarget: number;
  target: {
    title: string;
    text: string | null;
    account_id: string | null;
    account_name?: string | null;
    hidden?: boolean;
    deleted?: boolean;
    media_url?: string | null;
  };
  account: AccountHistory | null;
}

export type ReportAction = 'arquivar' | 'ocultar_vaga' | 'suspender_conta';

export interface StaffAction {
  id: number;
  staffEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
}

export interface AdminData {
  isStaff: boolean | null;
  identities: IdentityItem[];
  companies: CompanyItem[];
  reports: ReportItem[];
  history: ReportItem[];
  actions: StaffAction[];
}

export const ADMIN_KEY = 'admin';
export const ADMIN_DEFAULTS: AdminData = {
  isStaff: null,
  identities: [],
  companies: [],
  reports: [],
  history: [],
  actions: []
};

const save = (patch: Partial<AdminData>) => store.setUI<AdminData>(ADMIN_KEY, patch);
const remote = () => import('./remote/admin');
const notStaff = () => serviceError('nao_autorizado', 'Área só da equipe da Bicos.');

/** Whether the session is on the team (the server decides; the screen only reads it). */
export async function checkStaff(): Promise<void> {
  if (IS_DEMO) {
    await mockLatency(150);
    save({ isStaff: false });
    return;
  }
  save({ isStaff: await (await remote()).isStaff() });
}

export async function loadIdentityQueue(): Promise<void> {
  if (IS_DEMO) throw notStaff();
  save({ identities: await (await remote()).identityQueue() });
}

/** Short-lived (5 min) links to the selfie and the document photo — the bucket is private. */
export async function identityPhotoLinks(
  item: IdentityItem
): Promise<{ selfie: string | null; document: string | null }> {
  if (IS_DEMO) throw notStaff();
  return (await remote()).signedLinks([item.selfiePath, item.documentPath]).then(([selfie, document]) => ({
    selfie,
    document
  }));
}

export async function decideIdentity(workerId: string, approve: boolean, reason?: string): Promise<void> {
  if (IS_DEMO) throw notStaff();
  if (!approve && !reason?.trim()) throw serviceError('validacao', 'Diga o motivo da recusa.');
  await (await remote()).decideIdentity(workerId, approve ? 'verificado' : 'recusado', reason?.trim() || null);
  const { identities } = store.getUI(ADMIN_KEY, ADMIN_DEFAULTS);
  save({ identities: identities.filter((i) => i.workerId !== workerId) });
}

export async function loadCompanyQueue(): Promise<void> {
  if (IS_DEMO) throw notStaff();
  save({ companies: await (await remote()).companyQueue() });
}

export async function decideCompany(companyId: string, approve: boolean, reason?: string): Promise<void> {
  if (IS_DEMO) throw notStaff();
  if (!approve && !reason?.trim()) throw serviceError('validacao', 'Diga o motivo da recusa.');
  await (await remote()).decideCompany(companyId, approve ? 'verificada' : 'reprovada', reason?.trim() || null);
  const { companies } = store.getUI(ADMIN_KEY, ADMIN_DEFAULTS);
  save({ companies: companies.filter((c) => c.companyId !== companyId) });
}

export async function loadReportQueue(): Promise<void> {
  if (IS_DEMO) throw notStaff();
  const r = await remote();
  const [reports, history] = await Promise.all([r.reportQueue('aberta'), r.reportQueue('analisada')]);
  save({ reports, history });
}

export async function resolveReport(report: ReportItem, action: ReportAction, reason?: string): Promise<void> {
  if (IS_DEMO) throw notStaff();
  if (action !== 'arquivar' && !reason?.trim()) throw serviceError('validacao', 'Diga o motivo.');
  await (await remote()).resolveReport(report.id, action, reason?.trim() || null);
  await loadReportQueue();
}

export async function unsuspendAccount(accountId: string, reason?: string): Promise<void> {
  if (IS_DEMO) throw notStaff();
  await (await remote()).unsuspendAccount(accountId, reason?.trim() || null);
  await loadReportQueue();
}

export async function unhideJob(jobId: string, reason?: string): Promise<void> {
  if (IS_DEMO) throw notStaff();
  await (await remote()).unhideJob(jobId, reason?.trim() || null);
  await loadReportQueue();
}

export async function loadStaffActions(): Promise<void> {
  if (IS_DEMO) throw notStaff();
  save({ actions: await (await remote()).staffActions() });
}

/** The audit log's words for each action. */
export const ACTION_LABELS: Record<string, string> = {
  aprovar_identidade: 'Aprovou identidade',
  recusar_identidade: 'Recusou identidade',
  aprovar_construtora: 'Aprovou construtora',
  recusar_construtora: 'Recusou construtora',
  arquivar_denuncia: 'Arquivou denúncia',
  ocultar_vaga: 'Ocultou vaga',
  mostrar_vaga: 'Mostrou vaga de novo',
  suspender_conta: 'Suspendeu conta',
  reativar_conta: 'Reativou conta'
};
