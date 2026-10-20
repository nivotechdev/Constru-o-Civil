// L06 (lançamento): Área da equipe (/admin) — the three queues (identity, companies, reports) and the audit
// log. Only for accounts in staff_members: the server refuses every admin_* call from anyone else, and this
// screen asks it first (is_staff) so nobody else even sees the tabs.
import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { FieldError } from '../../components/FieldError';
import { QueryView } from '../../components/QueryView';
import { ReasonDialog } from '../../components/ReasonDialog';
import { ListSkeleton } from '../../components/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useScreenUI, useUI } from '../../hooks/useStore';
import {
  ACTION_LABELS,
  ADMIN_DEFAULTS,
  ADMIN_KEY,
  checkStaff,
  decideCompany,
  decideIdentity,
  identityPhotoLinks,
  loadCompanyQueue,
  loadIdentityQueue,
  loadReportQueue,
  loadStaffActions,
  resolveReport,
  unhideJob,
  unsuspendAccount,
  type CompanyItem,
  type IdentityItem,
  type ReportAction,
  type ReportItem
} from '../../services/admin';
import { goBack } from '../../services/router';
import { REPORT_REASONS } from '../../services/safety';
import { showToast } from '../../services/toast';
import { cx } from '../../utils/cx';

type Tab = 'identidades' | 'construtoras' | 'denuncias' | 'registro';
const TABS: { id: Tab; label: string }[] = [
  { id: 'identidades', label: 'Identidades' },
  { id: 'construtoras', label: 'Construtoras' },
  { id: 'denuncias', label: 'Denúncias' },
  { id: 'registro', label: 'Registro' }
];

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export default function Admin() {
  const [ui, setUi] = useScreenUI<{ tab: Tab }>('admin-tab', { tab: 'identidades' });
  const [data] = useUI(ADMIN_KEY, ADMIN_DEFAULTS);
  const staff = useQuery('admin-staff', checkStaff);

  return (
    <div className="flex flex-col">
      <BackBar title="Área da equipe" onBack={() => goBack('/configuracoes')} />
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4">
        <QueryView query={staff} skeleton={<ListSkeleton />}>
          {() =>
            !data.isStaff ? (
              <EmptyState
                icon="lock"
                title="Área só da equipe"
                description="Esta área é da equipe da Bicos. Se você faz parte dela, peça para incluírem sua conta."
              />
            ) : (
              <>
                <div
                  className="flex bg-concrete-100 rounded-full p-1 gap-1"
                  role="tablist"
                  aria-label="Filas da equipe"
                >
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={ui.tab === t.id}
                      className={cx(
                        'flex-1 h-10 rounded-full text-xs sm:text-sm font-bold transition-colors',
                        ui.tab === t.id ? 'bg-white text-brand-600 shadow-card' : 'text-concrete-500'
                      )}
                      onClick={() => setUi({ tab: t.id })}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {ui.tab === 'identidades' ? <IdentityQueue /> : null}
                {ui.tab === 'construtoras' ? <CompanyQueue /> : null}
                {ui.tab === 'denuncias' ? <ReportQueue /> : null}
                {ui.tab === 'registro' ? <AuditLog /> : null}
              </>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}

// ---- Identidades ----

function IdentityQueue() {
  const query = useQuery('admin-identities', loadIdentityQueue);
  const [data] = useUI(ADMIN_KEY, ADMIN_DEFAULTS);
  return (
    <QueryView query={query} skeleton={<ListSkeleton />}>
      {() =>
        data.identities.length === 0 ? (
          <EmptyState icon="id-card" title="Nenhuma identidade esperando" description="Fila em dia." />
        ) : (
          <div className="flex flex-col gap-3">
            {data.identities.map((item) => (
              <IdentityCard key={item.workerId} item={item} />
            ))}
          </div>
        )
      }
    </QueryView>
  );
}

function IdentityCard({ item }: { item: IdentityItem }) {
  const [links, setLinks] = useState<{ selfie: string | null; document: string | null } | null>(null);
  const [refusing, setRefusing] = useState(false);
  const open = useAction(() => identityPhotoLinks(item), setLinks);
  const approve = useAction(
    () => decideIdentity(item.workerId, true),
    () => showToast('Identidade aprovada')
  );
  const refuse = useAction(
    (reason: string) => decideIdentity(item.workerId, false, reason),
    () => {
      setRefusing(false);
      showToast('Identidade recusada');
    }
  );
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-concrete-900">{item.name}</span>
          <span className="text-sm text-concrete-500">{[item.city, item.document].filter(Boolean).join(' · ')}</span>
          <span className="text-xs text-concrete-500">
            Conta de {when(item.createdAt)} · enviado em {when(item.submittedAt)}
            {item.submissions > 1 ? ` · ${item.submissions}º envio` : ''}
          </span>
        </div>
        {links ? (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Selfie', url: links.selfie },
              { label: 'Documento', url: links.document }
            ].map((p) =>
              p.url ? (
                <a key={p.label} href={p.url} target="_blank" rel="noreferrer noopener" className="flex flex-col gap-1">
                  <img
                    src={p.url}
                    alt={`${p.label} de ${item.name}`}
                    className="w-full aspect-[3/4] object-cover rounded-lg bg-concrete-100"
                  />
                  <span className="text-xs text-brand-600 font-semibold">{p.label} (link vale 5 min)</span>
                </a>
              ) : (
                <span key={p.label} className="text-sm text-concrete-500">
                  {p.label}: arquivo não encontrado
                </span>
              )
            )}
          </div>
        ) : (
          <Button
            label="Ver selfie e documento"
            variant="secondary"
            size="sm"
            iconLeft="eye"
            loading={open.loading}
            onClick={() => void open.run()}
          />
        )}
        <div className="flex gap-2">
          <Button
            label="Aprovar"
            size="sm"
            iconLeft="check"
            disabled={!links}
            loading={approve.loading}
            onClick={() => void approve.run()}
          />
          <Button label="Recusar" size="sm" variant="danger" disabled={!links} onClick={() => setRefusing(true)} />
        </div>
        {open.error || approve.error ? <FieldError message={open.error ?? approve.error ?? ''} /> : null}
      </div>
      <ReasonDialog
        open={refusing}
        title="Recusar identidade"
        description="O trabalhador recebe o motivo e pode enviar as fotos de novo."
        reasons={['Foto do documento ilegível', 'Selfie não confere com o documento', 'Documento vencido ou inválido']}
        confirmLabel="Recusar"
        loading={refuse.loading}
        error={refuse.error}
        onConfirm={(reason) => void refuse.run(reason)}
        onCancel={() => setRefusing(false)}
      />
    </Card>
  );
}

// ---- Construtoras ----

function CompanyQueue() {
  const query = useQuery('admin-companies', loadCompanyQueue);
  const [data] = useUI(ADMIN_KEY, ADMIN_DEFAULTS);
  return (
    <QueryView query={query} skeleton={<ListSkeleton />}>
      {() =>
        data.companies.length === 0 ? (
          <EmptyState icon="hard-hat" title="Nenhuma construtora pendente" description="Fila em dia." />
        ) : (
          <div className="flex flex-col gap-3">
            {data.companies.map((item) => (
              <CompanyCard key={item.companyId} item={item} />
            ))}
          </div>
        )
      }
    </QueryView>
  );
}

function CompanyCard({ item }: { item: CompanyItem }) {
  const [refusing, setRefusing] = useState(false);
  const approve = useAction(
    () => decideCompany(item.companyId, true),
    () => showToast('Construtora aprovada')
  );
  const refuse = useAction(
    (reason: string) => decideCompany(item.companyId, false, reason),
    () => {
      setRefusing(false);
      showToast('Construtora recusada');
    }
  );
  const r = item.receita;
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-concrete-900">{item.name}</span>
          <span className="text-sm text-concrete-500">
            {item.documentKind === 'cnpj' ? 'CNPJ' : 'CPF'} {item.document} · {item.location}
          </span>
          <span className="text-xs text-concrete-500">
            {item.email} · conta de {when(item.createdAt)}
          </span>
        </div>
        {r ? (
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm bg-concrete-50 rounded-lg p-3">
            <dt className="text-concrete-500">Receita</dt>
            <dd className="font-semibold text-concrete-900">{r.situacao ?? '—'}</dd>
            <dt className="text-concrete-500">Razão social</dt>
            <dd className="text-concrete-900">{r.razao_social ?? '—'}</dd>
            <dt className="text-concrete-500">Abertura</dt>
            <dd className="text-concrete-900">{r.abertura ?? '—'}</dd>
            <dt className="text-concrete-500">Atividade</dt>
            <dd className="text-concrete-900">{r.atividade ?? '—'}</dd>
            <dt className="text-concrete-500">Cidade</dt>
            <dd className="text-concrete-900">{[r.municipio, r.uf].filter(Boolean).join('/') || '—'}</dd>
          </dl>
        ) : (
          <p className="text-sm text-concrete-500">
            Sem resposta da Receita ainda (CPF, CNPJ não encontrado ou consulta fora do ar). Confira manualmente.
          </p>
        )}
        <div className="flex gap-2">
          <Button
            label="Aprovar"
            size="sm"
            iconLeft="check"
            loading={approve.loading}
            onClick={() => void approve.run()}
          />
          <Button label="Recusar" size="sm" variant="danger" onClick={() => setRefusing(true)} />
        </div>
        {approve.error ? <FieldError message={approve.error} /> : null}
      </div>
      <ReasonDialog
        open={refusing}
        title="Recusar construtora"
        description="A empresa não publica vagas até falar com a equipe."
        reasons={['CNPJ inativo na Receita', 'Dados não batem com a Receita', 'Empresa não encontrada']}
        confirmLabel="Recusar"
        loading={refuse.loading}
        error={refuse.error}
        onConfirm={(reason) => void refuse.run(reason)}
        onCancel={() => setRefusing(false)}
      />
    </Card>
  );
}

// ---- Denúncias ----

const TARGET_LABEL: Record<ReportItem['targetType'], string> = {
  vaga: 'Vaga',
  perfil: 'Perfil',
  avaliacao: 'Avaliação',
  post: 'Portfólio'
};
const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

function ReportQueue() {
  const query = useQuery('admin-reports', loadReportQueue);
  const [data] = useUI(ADMIN_KEY, ADMIN_DEFAULTS);
  return (
    <QueryView query={query} skeleton={<ListSkeleton />}>
      {() => (
        <div className="flex flex-col gap-3">
          {data.reports.length === 0 ? (
            <EmptyState icon="flag" title="Nenhuma denúncia aberta" description="Fila em dia." />
          ) : (
            data.reports.map((item) => <ReportCard key={item.id} item={item} />)
          )}
          {data.history.length ? (
            <>
              <h2 className="text-sm font-bold text-concrete-500 uppercase tracking-wide pt-2">Já resolvidas</h2>
              {data.history.slice(0, 30).map((item) => (
                <ReportCard key={item.id} item={item} />
              ))}
            </>
          ) : null}
        </div>
      )}
    </QueryView>
  );
}

function ReportCard({ item }: { item: ReportItem }) {
  const [asking, setAsking] = useState<ReportAction | null>(null);
  const archive = useAction(
    () => resolveReport(item, 'arquivar'),
    () => showToast('Denúncia arquivada')
  );
  const act = useAction(
    (action: ReportAction, reason: string) => resolveReport(item, action, reason),
    () => {
      setAsking(null);
      showToast('Feito');
    }
  );
  const restore = useAction(
    () =>
      item.targetType === 'vaga' && item.target.hidden
        ? unhideJob(item.targetId, 'revisão da equipe')
        : unsuspendAccount(item.account?.account_id ?? '', 'revisão da equipe'),
    () => showToast('Desfeito')
  );
  const acc = item.account;
  const open = item.status === 'aberta';
  return (
    <Card>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={TARGET_LABEL[item.targetType]} tone="neutral" />
          <Badge label={reasonLabel(item.reason)} tone="danger" icon="flag" />
          {item.reportsOnTarget > 1 ? <Badge label={`${item.reportsOnTarget} denúncias`} tone="warning" /> : null}
          {!open && item.resolution ? <Badge label={item.resolution.replace('_', ' ')} tone="success" /> : null}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-bold text-concrete-900">{item.target.title}</span>
          {item.target.text ? (
            <p className="text-sm text-concrete-700 whitespace-pre-line">{item.target.text}</p>
          ) : null}
          {item.details ? <p className="text-sm text-concrete-500">Quem denunciou disse: “{item.details}”</p> : null}
          <span className="text-xs text-concrete-500">
            {when(item.createdAt)} · {item.targetType === 'vaga' ? item.targetId : ''}
          </span>
        </div>
        {acc ? (
          <div className="text-sm bg-concrete-50 rounded-lg p-3 flex flex-col gap-0.5">
            <span className="font-semibold text-concrete-900">
              {acc.name ?? 'Conta'} · {acc.role === 'recrutador' ? 'construtora' : 'trabalhador'}
              {acc.suspended_at ? ' · SUSPENSA' : ''}
            </span>
            <span className="text-concrete-500">
              Conta de {when(acc.created_at)} · nota {acc.rating ?? 0} ({acc.review_count ?? 0}) ·{' '}
              {acc.role === 'recrutador' ? `${acc.jobs} vagas` : `${acc.applications} candidaturas`} ·{' '}
              {acc.reports_against} denúncias · {acc.staff_actions} ações da equipe
            </span>
          </div>
        ) : null}
        {open ? (
          <div className="flex flex-wrap gap-2">
            <Button
              label="Arquivar"
              size="sm"
              variant="secondary"
              loading={archive.loading}
              onClick={() => void archive.run()}
            />
            {item.targetType === 'vaga' ? (
              <Button label="Ocultar vaga" size="sm" variant="danger" onClick={() => setAsking('ocultar_vaga')} />
            ) : null}
            {acc && !acc.suspended_at ? (
              <Button label="Suspender conta" size="sm" variant="danger" onClick={() => setAsking('suspender_conta')} />
            ) : null}
          </div>
        ) : (item.targetType === 'vaga' && item.target.hidden) || acc?.suspended_at ? (
          <Button
            label={item.targetType === 'vaga' && item.target.hidden ? 'Mostrar a vaga de novo' : 'Reativar a conta'}
            size="sm"
            variant="secondary"
            loading={restore.loading}
            onClick={() => void restore.run()}
          />
        ) : null}
        {archive.error || restore.error ? <FieldError message={archive.error ?? restore.error ?? ''} /> : null}
      </div>
      <ReasonDialog
        open={asking !== null}
        title={asking === 'ocultar_vaga' ? 'Ocultar a vaga' : 'Suspender a conta'}
        description={
          asking === 'ocultar_vaga'
            ? 'A vaga sai do mural e do link público. A construtora é avisada com o motivo.'
            : 'A conta não entra mais, não publica e não se candidata. Dá para reativar depois.'
        }
        reasons={[
          'Golpe ou pedido de dinheiro',
          'Ofensa ou discriminação',
          'Informação falsa',
          'Trabalho perigoso ou ilegal'
        ]}
        confirmLabel={asking === 'ocultar_vaga' ? 'Ocultar' : 'Suspender'}
        loading={act.loading}
        error={act.error}
        onConfirm={(reason) => asking && void act.run(asking, reason)}
        onCancel={() => setAsking(null)}
      />
    </Card>
  );
}

// ---- Registro (auditoria) ----

function AuditLog() {
  const query = useQuery('admin-actions', loadStaffActions);
  const [data] = useUI(ADMIN_KEY, ADMIN_DEFAULTS);
  return (
    <QueryView query={query} skeleton={<ListSkeleton />}>
      {() =>
        data.actions.length === 0 ? (
          <EmptyState icon="history" title="Nenhuma ação ainda" description="Cada decisão da equipe aparece aqui." />
        ) : (
          <Card padding="none">
            <ol className="flex flex-col divide-y divide-concrete-200">
              {data.actions.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3">
                  <span className="text-sm font-semibold text-concrete-900">
                    {ACTION_LABELS[a.action] ?? a.action} · {a.targetType} {a.targetId.slice(0, 13)}
                  </span>
                  <span className="text-xs text-concrete-500">
                    {when(a.createdAt)} · {a.staffEmail ?? 'conta removida'}
                    {a.reason ? ` · ${a.reason}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        )
      }
    </QueryView>
  );
}
