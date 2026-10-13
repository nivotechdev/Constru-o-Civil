import { h } from '../../dom.js';
import { IconButton } from '../../components/IconButton.js';
import { Button } from '../../components/Button.js';
import { Badge } from '../../components/Badge.js';
import { Rating } from '../../components/Rating.js';
import { Card } from '../../components/Card.js';
import { JobTile, TileGrid } from '../../components/JobTile.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Dialog } from '../../components/Modal.js';
import { Icon } from '../../utils/icons.js';
import { goBack } from '../../router.js';
import * as store from '../../store.js';

export default function renderCompanyProfile(navigate, params) {
  const isOwn = !params.id;
  const company = isOwn ? store.currentCompany() : store.getCompany(params.id);
  if (!company) return notFound(navigate);

  const ui = store.getUI('company-profile', { capa: null, logo: null, deleteId: null });

  const openJobs = store.activeJobs().filter((j) => j.companyId === company.id && !j.closed && !store.isJobFull(j));
  const postToDelete = openJobs.find((j) => j.id === ui.deleteId);
  const successfulJobs = store.successfulJobsForCompany(company.id);

  return h('div', { class: 'min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0' },
    h('div', { class: 'relative' },
      isOwn && ui.capa
        ? h('img', { src: ui.capa, alt: '', class: 'w-full h-48 object-cover lg:rounded-card' })
        : h('div', { class: 'h-48 bg-concrete-200 lg:rounded-card' }),
      !isOwn ? h('div', { class: 'absolute top-2 left-2' }, IconButton({ icon: 'arrow-left', label: 'Voltar', variant: 'solid', onClick: () => goBack('/mural') })) : null,
      h('div', { class: 'absolute left-4 sm:left-6 -bottom-10 w-24 h-24 rounded-full bg-white p-1 shadow-raised' },
        h('div', { class: 'w-full h-full rounded-full bg-brand-50 flex items-center justify-center overflow-hidden' },
          isOwn && ui.logo
            ? h('img', { src: ui.logo, alt: '', class: 'w-full h-full object-cover' })
            : Icon('building-2', { size: 26, color: 'var(--brand)' })
        )
      )
    ),
    h('div', { class: 'flex flex-col gap-5 pt-12 px-4 sm:px-6 pb-24 lg:pb-6' },
      h('div', { class: 'flex items-start justify-between gap-3' },
        h('div', { class: 'flex flex-col gap-1.5 min-w-0' },
          h('span', { class: 'font-display font-bold text-2xl text-concrete-900' }, company.name),
          h('span', { class: 'text-sm text-concrete-700' }, `${company.tipoObra || 'Construção civil'} · ${company.location}`),
          h('span', { class: 'inline-flex items-center gap-1.5 text-sm font-semibold text-concrete-700' },
            Icon('circle-check', { size: 15, color: 'var(--text-subtle)' }),
            `${successfulJobs} ${successfulJobs === 1 ? 'bico concluído' : 'bicos concluídos'}`
          ),
          h('div', { class: 'flex items-center gap-3' },
            Rating({ value: company.rating, count: company.reviewCount }),
            !isOwn ? h('button', {
              type: 'button', class: 'inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600',
              onClick: () => navigate('/avaliacoes/construtora/' + company.id)
            }, 'Ver avaliações', Icon('chevron-right', { size: 16, color: 'var(--text-brand)' })) : null
          )
        ),
        isOwn ? Button({ label: 'Editar', variant: 'secondary', size: 'sm', iconLeft: 'pencil', onClick: () => navigate('/empresa/editar') })
          : (company.verified ? Badge({ label: 'Verificada', tone: 'success', icon: 'shield-check' }) : null)
      ),

      isOwn ? Card({ padding: 'md' },
        h('div', { class: 'flex flex-col gap-3.5' },
          h('div', { class: 'flex items-center justify-between gap-3' }, h('span', { class: 'text-sm text-concrete-500' }, 'CNPJ'), h('span', { class: 'font-mono text-sm text-concrete-900' }, company.cnpj)),
          h('div', { class: 'flex items-center justify-between gap-3' }, h('span', { class: 'text-sm text-concrete-500' }, 'Tipo de obra'), h('span', { class: 'font-semibold text-concrete-900 text-right' }, company.tipoObra)),
          h('div', { class: 'flex items-center gap-2 pt-3.5 border-t border-concrete-200' }, Badge({ label: 'Verificada', tone: 'success', icon: 'shield-check' }), h('span', { class: 'text-xs text-concrete-500' }, `CNPJ conferido em ${company.verifiedSince}`))
        )
      ) : Card({ padding: 'md' },
        h('div', { class: 'flex flex-col gap-3.5' },
          h('div', { class: 'flex gap-2.5 items-center' }, Icon('hand-coins', { size: 20, color: 'var(--text-subtle)' }), h('span', { class: 'text-sm text-concrete-700' }, `${company.paidCount || 0} diárias pagas pela plataforma`)),
          h('div', { class: 'flex gap-2.5 items-center' }, Icon('message-circle', { size: 20, color: 'var(--text-subtle)' }), h('span', { class: 'text-sm text-concrete-700' }, company.respondTime || 'Responde em poucas horas, em média')),
          h('div', { class: 'flex gap-2.5 items-center' }, Icon('hammer', { size: 20, color: 'var(--text-subtle)' }), h('span', { class: 'text-sm text-concrete-700' }, `${openJobs.length} vagas abertas agora`)),
          h('div', { class: 'flex gap-2.5 items-center' }, Icon('calendar', { size: 20, color: 'var(--text-subtle)' }), h('span', { class: 'text-sm text-concrete-700' }, company.sinceLabel || 'Na Bicos'))
        )
      ),

      isOwn
        ? h('div', { class: 'flex flex-col gap-2.5' },
            h('div', { class: 'flex items-center justify-between gap-2' },
              h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Seus posts'),
              Button({ label: 'Publicar', variant: 'ghost', size: 'sm', iconLeft: 'plus', onClick: () => navigate('/criar-vaga') })
            ),
            openJobs.length === 0
              ? EmptyState({ icon: 'hammer', title: 'Você ainda não publicou nenhuma vaga', description: 'Publique seu primeiro bico para começar a receber candidatos.', actionLabel: 'Publicar vaga', onAction: () => navigate('/criar-vaga') })
              : TileGrid(openJobs.map((job) => JobTile({
                  job, company, onClick: () => navigate('/vaga-gerenciar/' + job.id),
                  badge: statusBadge(job),
                  corner: IconButton({ icon: 'trash-2', label: 'Excluir post', variant: 'solid', onClick: () => store.setUI('company-profile', { deleteId: job.id }) })
                })))
          )
        : h('div', { class: 'flex flex-col gap-2.5' },
            h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Vagas publicadas'),
            openJobs.length === 0
              ? EmptyState({ icon: 'hammer', title: 'Nenhuma vaga aberta no momento', description: `${company.name} não tem bicos publicados agora. Volte mais tarde para ver novidades.` })
              : TileGrid(openJobs.map((job) => JobTile({
                  job, company, onClick: () => navigate('/vaga/' + job.id),
                  saved: store.getRole() === 'trabalhador' && store.isJobSaved(job.id),
                  onToggleSave: store.getRole() === 'trabalhador' ? () => store.toggleSavedJob(job.id) : null
                })))
          )
    ),
    Dialog({
      open: Boolean(ui.deleteId), tone: 'danger', title: 'Excluir esse post?',
      description: 'A vaga sai do mural imediatamente. Candidatos já enviados não são avisados.',
      confirmLabel: 'Excluir post', onConfirm: () => { store.deleteJobPost(ui.deleteId); store.setUI('company-profile', { deleteId: null }); },
      cancelLabel: 'Cancelar', onCancel: () => store.setUI('company-profile', { deleteId: null })
    })
  );
}

function statusBadge(job) {
  const pending = store.pendingCount(job.id);
  const approved = store.approvedCount(job.id);
  // Short labels: they sit in a pill on the tile's photo.
  if (store.isJobClosed(job)) return { label: `Fechado · ${approved} de ${job.slots || 1}`, tone: 'success', icon: 'circle-check' };
  if (pending) return { label: `${pending} em análise`, tone: 'warning', icon: 'clock' };
  const total = store.applicationsForJob(job.id).length;
  if (total) return { label: total === 1 ? '1 candidato' : `${total} candidatos`, tone: 'brand', icon: 'users' };
  return { label: 'Sem candidatos', tone: 'neutral', icon: 'search-x' };
}

function notFound(navigate) {
  return h('div', { class: 'flex flex-col items-center justify-center min-h-screen gap-3' },
    h('p', { class: 'text-concrete-500' }, 'Construtora não encontrada.'),
    Button({ label: 'Voltar ao mural', variant: 'secondary', onClick: () => navigate('/mural') })
  );
}
