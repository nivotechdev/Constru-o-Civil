import { h } from '../../dom.js';
import { IconButton } from '../../components/IconButton.js';
import { Button } from '../../components/Button.js';
import { Badge } from '../../components/Badge.js';
import { Rating } from '../../components/Rating.js';
import { Card } from '../../components/Card.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Dialog, Sheet } from '../../components/Modal.js';
import { Icon } from '../../utils/icons.js';
import { formatPostDate } from '../../utils/format.js';
import { goBack } from '../../router.js';
import * as store from '../../store.js';

const POSTS_KEY = 'worker-posts';

export default function renderWorkerProfile(navigate, params) {
  const isOwn = !params.id;
  const worker = isOwn ? store.currentWorker() : store.getWorker(params.id);
  if (!worker) return notFound(navigate);

  const jobIdRaw = params.jobId;
  const jobForCtx = jobIdRaw ? store.getJob(jobIdRaw) : null;
  // Only the recruiter who owns this job may see candidate-review context (approve/reject, slots left).
  const jobId = jobForCtx && store.getRole() === 'recrutador' && jobForCtx.companyId === store.currentCompanyId() ? jobIdRaw : null;
  const decision = jobId ? (store.applicationFor(jobId, worker.id) || {}).status : null;
  const decidedForJob = jobId && (decision === 'pre_selecionado' || decision === 'nao_selecionado');
  const jobFull = jobId ? store.isJobClosed(store.getJob(jobId)) : false;

  const ui = store.getUI('worker-profile-photo', { photo: null });

  return h('div', { class: 'min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0' },
    h('div', { class: 'relative' },
      isOwn && ui.photo
        ? h('img', { src: ui.photo, alt: '', class: 'w-full h-52 object-cover lg:rounded-card' })
        : h('div', { class: 'h-52 bg-concrete-200 lg:rounded-card' }),
      !isOwn ? h('div', { class: 'absolute top-2 left-2' }, IconButton({ icon: 'arrow-left', label: 'Voltar', variant: 'solid', onClick: () => goBack(jobId ? '/vaga-gerenciar/' + jobId : '/mural') })) : null,
      h('div', { class: 'absolute left-4 sm:left-6 -bottom-10 w-24 h-24 rounded-full bg-white p-1 shadow-raised' },
        h('div', { class: 'relative w-full h-full' },
          h('div', { class: 'w-full h-full rounded-full bg-accent-50 text-accent-600 flex items-center justify-center font-bold text-2xl overflow-hidden' }, worker.initials),
          worker.verified ? h('span', { class: 'absolute -right-0.5 -bottom-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-500 border-[3px] border-white' }, Icon('check', { size: 14, color: '#fff' })) : null
        )
      )
    ),
    h('div', { class: 'flex flex-col gap-5 pt-12 px-4 sm:px-6 pb-40 lg:pb-6' },
      h('div', { class: 'flex items-start justify-between gap-3' },
        h('div', { class: 'flex flex-col gap-1.5 min-w-0' },
          h('span', { class: 'font-display font-bold text-2xl text-concrete-900' }, worker.name),
          h('span', { class: 'text-sm text-concrete-700' }, `${worker.role} · ${worker.region}`),
          h('span', { class: 'inline-flex items-center gap-1.5 text-sm font-semibold text-concrete-700' },
            Icon('hammer', { size: 15, color: 'var(--text-subtle)' }),
            `${worker.jobsDone} ${worker.jobsDone === 1 ? 'bico realizado' : 'bicos realizados'}`
          ),
          h('div', { class: 'flex items-center gap-3' },
            Rating({ value: worker.rating, count: worker.jobsDone }),
            !isOwn ? h('button', {
              type: 'button', class: 'inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600',
              onClick: () => navigate('/avaliacoes/trabalhador/' + worker.id)
            }, 'Ver avaliações', Icon('chevron-right', { size: 16, color: 'var(--text-brand)' })) : null
          )
        ),
        isOwn ? Button({ label: 'Editar', variant: 'secondary', size: 'sm', iconLeft: 'pencil', onClick: () => navigate('/perfil/editar') })
          : worker.novo ? Badge({ label: 'Novo na plataforma', tone: 'accent' }) : (worker.verified ? Badge({ label: 'Verificado', tone: 'success', icon: 'shield-check' }) : null)
      ),

      h('div', { class: 'flex flex-col gap-2.5' },
        h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Especialidades'),
        h('div', { class: 'flex flex-wrap gap-2' }, ...worker.specialties.map((s) => h('span', { class: 'inline-flex items-center h-9 px-3 rounded-full bg-white border border-concrete-300 text-sm font-semibold text-concrete-700' }, s)))
      ),

      !isOwn && worker.facts && worker.facts.length ? Card({ padding: 'md' },
        h('div', { class: 'flex flex-col gap-3.5' }, ...worker.facts.map((f) => h('div', { class: 'flex gap-2.5 items-center' }, Icon('circle-check', { size: 18, color: 'var(--text-subtle)' }), h('span', { class: 'text-sm text-concrete-700' }, f))))
      ) : null,

      postsSection(worker, isOwn),

      !isOwn && jobId ? h('p', { class: 'text-sm text-concrete-500' }, 'O contato por WhatsApp abre depois que você aprovar esse trabalhador para a vaga.') : null
    ),

    !isOwn && jobId ? h('div', { class: 'sticky bottom-0 px-4 sm:px-6 py-3 bg-white shadow-bar flex flex-col gap-2 lg:static lg:bg-transparent lg:shadow-none lg:pt-0 lg:pb-6' },
      !decidedForJob && !jobFull ? h('div', { class: 'flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3' },
        Button({
          label: `Aprovar para a vaga · ${store.approvedCount(jobId) + 1} de ${store.getJob(jobId).slots || 1}`,
          size: 'lg', fullWidth: true, iconLeft: 'circle-check', className: 'lg:w-auto lg:px-8',
          onClick: () => { store.decideApplication(jobId, worker.id, 'aprovado'); navigate(store.isJobClosed(store.getJob(jobId)) ? '/fechado/' + jobId : '/vaga-gerenciar/' + jobId); }
        }),
        Button({ label: 'Recusar candidato', variant: 'ghost', fullWidth: true, className: 'lg:w-auto', onClick: () => { store.decideApplication(jobId, worker.id, 'recusado'); navigate('/vaga-gerenciar/' + jobId); } })
      ) : decidedForJob ? h('div', { class: 'flex items-center gap-2.5' },
        Badge({ label: decision === 'pre_selecionado' ? 'Aprovado' : 'Recusado', tone: decision === 'pre_selecionado' ? 'success' : 'danger', icon: decision === 'pre_selecionado' ? 'circle-check' : 'circle-x' }),
        h('span', { class: 'flex-1 text-sm text-concrete-500' }, decision === 'pre_selecionado' ? 'Contato por WhatsApp liberado para os dois lados.' : 'Avisamos que dessa vez não deu certo.'),
        Button({ label: 'Desfazer', variant: 'secondary', size: 'sm', onClick: () => { store.decideApplication(jobId, worker.id, null); } })
      ) : h('span', { class: 'text-center text-xs text-concrete-500' }, 'As vagas desse bico já foram preenchidas.')
    ) : null
  );
}

function postsSection(worker, isOwn) {
  const posts = store.postsForWorker(worker.id);
  const ui = store.getUI(POSTS_KEY, { composing: false, mediaUrl: null, mediaType: 'image', caption: '', deleteId: null });
  const firstName = worker.name.split(' ')[0];

  return h('div', { class: 'flex flex-col gap-2.5' },
    h('div', { class: 'flex items-center justify-between gap-2' },
      h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, isOwn ? 'Seus trabalhos' : `Trabalhos de ${firstName}`),
      isOwn ? Button({ label: 'Publicar', variant: 'ghost', size: 'sm', iconLeft: 'plus', onClick: () => store.setUI(POSTS_KEY, { composing: true }) }) : null
    ),
    posts.length === 0
      ? EmptyState({
          icon: 'camera',
          title: isOwn ? 'Mostre o seu trabalho' : 'Nenhum post ainda',
          description: isOwn
            ? 'Publique fotos ou vídeos dos seus bicos para as construtoras verem a qualidade do seu serviço.'
            : `${firstName} ainda não publicou fotos ou vídeos do trabalho.`,
          actionLabel: isOwn ? 'Publicar primeiro post' : null,
          onAction: isOwn ? () => store.setUI(POSTS_KEY, { composing: true }) : null
        })
      : h('div', { class: 'flex flex-col gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5' }, ...posts.map((p) => postCard(p, isOwn))),
    isOwn ? composer(worker, ui) : null,
    isOwn ? Dialog({
      open: Boolean(ui.deleteId), tone: 'danger', title: 'Excluir esse post?',
      description: 'A publicação some do seu perfil imediatamente.',
      confirmLabel: 'Excluir post', onConfirm: () => { store.deleteWorkerPost(ui.deleteId); store.setUI(POSTS_KEY, { deleteId: null }); },
      cancelLabel: 'Cancelar', onCancel: () => store.setUI(POSTS_KEY, { deleteId: null })
    }) : null
  );
}

function postCard(post, isOwn) {
  return h('div', { class: 'flex flex-col rounded-card overflow-hidden border border-concrete-200 bg-white' },
    h('div', { class: 'relative' },
      post.mediaUrl
        ? (post.mediaType === 'video'
            ? h('video', { src: post.mediaUrl, controls: true, class: 'w-full h-72 lg:h-auto lg:aspect-square object-cover bg-concrete-900' })
            : h('img', { src: post.mediaUrl, alt: '', class: 'w-full h-72 lg:h-auto lg:aspect-square object-cover' }))
        : h('div', { class: 'w-full h-72 lg:h-auto lg:aspect-square bg-concrete-200 flex items-center justify-center' }, Icon('camera', { size: 32, color: 'var(--text-subtle)' })),
      post.mediaType === 'video' ? h('span', { class: 'absolute top-2.5 left-2.5' }, Badge({ label: 'Vídeo', tone: 'neutral' })) : null,
      isOwn ? h('span', { class: 'absolute top-2.5 right-2.5' }, IconButton({ icon: 'trash-2', label: 'Excluir post', variant: 'solid', size: 'sm', onClick: () => store.setUI(POSTS_KEY, { deleteId: post.id }) })) : null
    ),
    h('div', { class: 'flex flex-col gap-1.5 p-3.5' },
      post.caption ? h('p', { class: 'text-sm text-concrete-800 leading-relaxed' }, post.caption) : null,
      h('span', { class: 'text-xs text-concrete-400' }, formatPostDate(post.date))
    )
  );
}

function composer(worker, ui) {
  const closeAndReset = () => store.setUI(POSTS_KEY, { composing: false, mediaUrl: null, mediaType: 'image', caption: '' });
  const fileInput = h('input', {
    type: 'file', accept: 'image/*,video/*', class: 'sr-only',
    onchange: (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      store.setUI(POSTS_KEY, { mediaUrl: URL.createObjectURL(file), mediaType: file.type.indexOf('video') === 0 ? 'video' : 'image' });
    }
  });

  return Sheet({ open: ui.composing, title: 'Publicar trabalho', onClose: closeAndReset },
    h('label', {
      class: 'relative flex items-center justify-center overflow-hidden cursor-pointer bg-concrete-100 border-2 border-dashed border-concrete-300 hover:border-brand-400 rounded-card w-full transition-colors',
      style: { height: '12rem' }
    },
      fileInput,
      ui.mediaUrl
        ? (ui.mediaType === 'video'
            ? h('video', { src: ui.mediaUrl, controls: true, class: 'absolute inset-0 w-full h-full object-cover' })
            : h('img', { src: ui.mediaUrl, alt: '', class: 'absolute inset-0 w-full h-full object-cover' }))
        : h('span', { class: 'flex flex-col items-center gap-1.5 text-concrete-500 px-3 text-center' }, Icon('camera', { size: 24 }), h('span', { class: 'text-xs font-semibold' }, 'Toque para escolher uma foto ou vídeo'))
    ),
    h('div', { class: 'flex flex-col gap-1.5 w-full' },
      h('label', { for: 'worker-post-caption', class: 'text-sm font-semibold text-concrete-900' }, 'Descrição'),
      h('textarea', {
        id: 'worker-post-caption', 'data-focus-id': 'worker-post-caption', rows: 3, placeholder: 'Conte o que foi feito nesse bico...', value: ui.caption,
        class: 'w-full px-3 py-2.5 bg-white rounded-control border border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none text-base text-concrete-900 placeholder:text-concrete-400 resize-none transition-colors duration-150',
        oninput: (e) => store.setUI(POSTS_KEY, { caption: e.target.value })
      })
    ),
    Button({
      label: 'Publicar', size: 'lg', fullWidth: true, disabled: !ui.mediaUrl,
      onClick: () => {
        store.addWorkerPost(worker.id, { mediaUrl: ui.mediaUrl, mediaType: ui.mediaType, caption: ui.caption.trim() });
        closeAndReset();
      }
    })
  );
}

function notFound(navigate) {
  return h('div', { class: 'flex flex-col items-center justify-center min-h-screen gap-3' },
    h('p', { class: 'text-concrete-500' }, 'Trabalhador não encontrado.'),
    Button({ label: 'Voltar ao mural', variant: 'secondary', onClick: () => navigate('/mural') })
  );
}
