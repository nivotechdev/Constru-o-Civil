import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/IconButton';
import { JobTile, TileGrid } from '../../components/JobTile';
import { Dialog } from '../../components/Modal';
import { NotFound } from '../../components/NotFound';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { toggleSaved } from '../../services/feedback';
import { deleteJob } from '../../services/jobs';
import { loadCompanyProfile } from '../../services/profiles';
import { showToast } from '../../services/toast';
import { Rating } from '../../components/Rating';
import { useDb, useRole, useUI } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import {
  activeJobs,
  applicationsForJob,
  candidateCount,
  approvedCount,
  currentCompany,
  getCompany,
  isJobSaved,
  jobState,
  pendingCount,
  successfulJobsForCompany
} from '../../services/selectors';
import type { Database, Job } from '../../types/models';
import type { StatusBadge } from '../../types/ui';
import { AccountMenuButton } from '../../components/AccountMenuSheet';
import { CompanyAvatar } from '../../components/Avatar';
import { holdsSlot } from '../../services/applicationMachine';

export default function CompanyProfileScreen({ params }: ScreenProps) {
  const db = useDb();
  const role = useRole();
  const [ui, setUi] = useUI<{ deleteId: string | null }>('company-profile-delete', { deleteId: null });

  const isOwn = !params.id;
  const companyId = isOwn ? currentCompany(db).id : params.id;
  const query = useQuery('company:' + companyId, () => loadCompanyProfile(companyId));
  const remove = useAction(deleteJob, () => {
    setUi({ deleteId: null });
    showToast('Vaga excluída');
  });
  if (query.status !== 'ready')
    return (
      <ScreenLoading
        title={isOwn ? 'Sua empresa' : 'Construtora'}
        onBack={() => goBack('/mural')}
        query={query}
        skeleton={<PageSkeleton />}
      />
    );
  const company = isOwn ? currentCompany(db) : getCompany(db, params.id);
  if (!company) return <NotFound message="Construtora não encontrada." />;

  const mine = activeJobs(db).filter((j) => j.companyId === company.id);
  // Workers see the jobs taking candidates; the company sees its open and full ones (W05/Y01).
  const openJobs = mine.filter((j) => jobState(db, j) === 'aberta');
  const ownJobs = mine.filter((j) => {
    const s = jobState(db, j);
    return s === 'aberta' || s === 'cheia';
  });
  const teamOn = (jobId: string) => applicationsForJob(db, jobId).some((a) => holdsSlot(a.status));
  const successfulJobs = successfulJobsForCompany(db, company.id);

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <div className="relative">
        {company.coverUrl ? (
          <img src={company.coverUrl} alt="" className="w-full h-60 object-cover lg:rounded-card" />
        ) : (
          <div className="h-60 bg-concrete-200 lg:rounded-card" />
        )}
        {!isOwn ? (
          <div className="absolute top-2 left-2">
            <IconButton icon="arrow-left" label="Voltar" variant="solid" onClick={() => goBack('/mural')} />
          </div>
        ) : (
          <div className="absolute top-2 right-2">
            <AccountMenuButton role="recrutador" />
          </div>
        )}
        <div className="absolute left-4 sm:left-6 -bottom-10 w-24 h-24 rounded-full bg-white p-1 shadow-raised">
          <CompanyAvatar company={company} size="lg" className="w-full h-full" />
        </div>
      </div>
      <div className="flex flex-col gap-5 pt-12 px-4 sm:px-6 pb-24 lg:pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="font-display font-bold text-2xl text-concrete-900">{company.name}</span>
            <span className="text-sm text-concrete-700">{`${company.tipoObra || 'Construção civil'} · ${company.location}`}</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-concrete-700">
              <Icon name="circle-check" size={15} color="var(--text-subtle)" />
              {`${successfulJobs} ${successfulJobs === 1 ? 'bico concluído' : 'bicos concluídos'}`}
            </span>
            <div className="flex items-center gap-3">
              <Rating value={company.rating} count={company.reviewCount} />
              {!isOwn ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600"
                  onClick={() => navigate('/avaliacoes/construtora/' + company.id)}
                >
                  Ver avaliações
                  <Icon name="chevron-right" size={16} color="var(--text-brand)" />
                </button>
              ) : null}
            </div>
          </div>
          {isOwn ? (
            <Button
              label="Editar"
              variant="secondary"
              size="sm"
              iconLeft="pencil"
              onClick={() => navigate('/empresa/editar')}
            />
          ) : company.verified ? (
            <Badge label="Verificada" tone="success" icon="shield-check" />
          ) : null}
        </div>

        {isOwn ? (
          <Card padding="md">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-concrete-500">CNPJ</span>
                <span className="font-mono text-sm text-concrete-900">{company.cnpj}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-concrete-500">Tipo de obra</span>
                <span className="font-semibold text-concrete-900 text-right">{company.tipoObra}</span>
              </div>
              <div className="flex items-center gap-2 pt-3.5 border-t border-concrete-200">
                <Badge label="Verificada" tone="success" icon="shield-check" />
                <span className="text-xs text-concrete-500">{`CNPJ conferido em ${company.verifiedSince}`}</span>
              </div>
            </div>
          </Card>
        ) : (
          <Card padding="md">
            <div className="flex flex-col gap-3.5">
              <div className="flex gap-2.5 items-center">
                <Icon name="hand-coins" size={20} color="var(--text-subtle)" />
                <span className="text-sm text-concrete-700">{`${company.paidCount || 0} diárias pagas pela plataforma`}</span>
              </div>
              {company.respondTime ? (
                <div className="flex gap-2.5 items-center">
                  <Icon name="message-circle" size={20} color="var(--text-subtle)" />
                  <span className="text-sm text-concrete-700">{company.respondTime}</span>
                </div>
              ) : null}
              <div className="flex gap-2.5 items-center">
                <Icon name="hammer" size={20} color="var(--text-subtle)" />
                <span className="text-sm text-concrete-700">{`${openJobs.length} vagas abertas agora`}</span>
              </div>
              <div className="flex gap-2.5 items-center">
                <Icon name="calendar" size={20} color="var(--text-subtle)" />
                <span className="text-sm text-concrete-700">{company.sinceLabel || 'Na Bicos'}</span>
              </div>
            </div>
          </Card>
        )}

        {isOwn ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Suas vagas</span>
              <Button
                label="Publicar"
                variant="ghost"
                size="sm"
                iconLeft="plus"
                onClick={() => navigate('/criar-vaga')}
              />
            </div>
            {ownJobs.length === 0 ? (
              <EmptyState
                icon="hammer"
                title="Nenhuma vaga aberta agora"
                description="Publique seu primeiro bico para começar a receber candidatos."
                actionLabel="Publicar vaga"
                onAction={() => navigate('/criar-vaga')}
              />
            ) : (
              <TileGrid>
                {ownJobs.map((job) => (
                  <JobTile
                    key={job.id}
                    job={job}
                    company={company}
                    onClick={() => navigate('/vaga-gerenciar/' + job.id)}
                    badge={statusBadge(db, job)}
                    corner={
                      // Y08: with a team (picked/hired), closing the job is the way — in Gerenciar vaga.
                      teamOn(job.id) ? null : (
                        <IconButton
                          icon="trash-2"
                          label="Excluir vaga"
                          variant="solid"
                          onClick={() => setUi({ deleteId: job.id })}
                        />
                      )
                    }
                  />
                ))}
              </TileGrid>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Vagas publicadas</span>
            {openJobs.length === 0 ? (
              <EmptyState
                icon="hammer"
                title="Nenhuma vaga aberta no momento"
                description={`${company.name} não tem bicos publicados agora. Volte mais tarde para ver novidades.`}
              />
            ) : (
              <TileGrid>
                {openJobs.map((job) => (
                  <JobTile
                    key={job.id}
                    job={job}
                    company={company}
                    onClick={() => navigate('/vaga/' + job.id)}
                    saved={role === 'trabalhador' && isJobSaved(db, job.id)}
                    onToggleSave={role === 'trabalhador' ? () => toggleSaved(job.id) : null}
                  />
                ))}
              </TileGrid>
            )}
          </div>
        )}
      </div>
      <Dialog
        open={Boolean(ui.deleteId)}
        tone="danger"
        title="Excluir essa vaga?"
        description="O anúncio some do mural e do seu perfil. Quem ainda esperava resposta é avisado de que a vaga foi removida."
        confirmLabel="Excluir vaga"
        onConfirm={() => {
          if (ui.deleteId) void remove.run(ui.deleteId);
        }}
        loading={remove.loading}
        error={remove.error}
        cancelLabel="Cancelar"
        onCancel={() => {
          remove.reset();
          setUi({ deleteId: null });
        }}
      />
    </div>
  );
}

function statusBadge(db: Database, job: Job): StatusBadge {
  const pending = pendingCount(db, job.id);
  const approved = approvedCount(db, job.id);
  // Short labels: they sit in a pill on the tile's photo.
  if (jobState(db, job) === 'cheia')
    return { label: `Preenchida · ${approved} de ${job.slots || 1}`, tone: 'success', icon: 'circle-check' };
  if (pending) return { label: `${pending} em análise`, tone: 'warning', icon: 'clock' };
  const total = candidateCount(db, job.id);
  if (total) return { label: total === 1 ? '1 candidato' : `${total} candidatos`, tone: 'brand', icon: 'users' };
  return { label: 'Sem candidatos', tone: 'neutral', icon: 'search-x' };
}
