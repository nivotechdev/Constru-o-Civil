// Single source of truth for how a worker's application status renders as a badge +
// next action, reused by MyApplications, SavedJobs and any other screen showing it.
export function statusInfo(status, jobId) {
  switch (status) {
    case 'enviada':
    case 'em_analise': return { label: 'Em análise', tone: 'warning', icon: 'clock', hint: 'Ver a vaga', to: '/vaga/' + jobId };
    case 'pre_selecionado': return { label: 'Pré-selecionado', tone: 'brand', icon: 'message-circle', hint: 'Falar no WhatsApp', to: '/selecionado/' + jobId };
    case 'contratado': return { label: 'Contratado', tone: 'success', icon: 'circle-check', hint: 'Falar no WhatsApp', to: '/selecionado/' + jobId };
    case 'concluida': return { label: 'Diária concluída', tone: 'accent', icon: 'star', hint: 'Avaliar a obra', to: '/avaliar/' + jobId };
    case 'avaliada': return { label: 'Avaliação enviada', tone: 'neutral', icon: 'circle-check', hint: 'Ver o bico', to: '/vaga/' + jobId };
    case 'nao_selecionado': return { label: 'Não foi essa vez', tone: 'danger', icon: 'circle-x', hint: 'Ver a vaga', to: '/vaga/' + jobId };
    default: return { label: status, tone: 'neutral', icon: 'circle', hint: 'Ver a vaga', to: '/vaga/' + jobId };
  }
}

export const IN_PROGRESS = new Set(['enviada', 'em_analise', 'pre_selecionado', 'contratado']);
export const CLOSED = new Set(['concluida', 'avaliada', 'nao_selecionado']);
