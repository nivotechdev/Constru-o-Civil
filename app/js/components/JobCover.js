import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';

/** A job's photos, oldest data (single `photo`) included. */
export function jobPhotos(job) {
  if (Array.isArray(job.photos)) return job.photos;
  return job.photo ? [job.photo] : [];
}

// Illustrated cover for jobs without a photo (tablet/desktop): a trade-specific gradient,
// blueprint texture and icon, so a grid of jobs doesn't read as a wall of grey boxes.
const COVERS = [
  { test: /eletric/i, icon: 'plug-zap', from: '#2F4BB5', to: '#0A1A54' },
  { test: /pint/i, icon: 'paint-roller', from: '#2AA096', to: '#08514A' },
  { test: /azulej|porcelan|revest/i, icon: 'layout-grid', from: '#6E8DF5', to: '#1D3FB8' },
  { test: /encanad|hidr/i, icon: 'droplets', from: '#3AA9D1', to: '#0C5F80' },
  { test: /armador|ferr/i, icon: 'construction', from: '#5C6672', to: '#161C24' },
  { test: /carpint|marcen/i, icon: 'hammer', from: '#C08A4A', to: '#6E4015' },
  { test: /gess/i, icon: 'ruler', from: '#8E9DB5', to: '#46546B' },
  { test: /telhad|telhado/i, icon: 'house', from: '#E0A24A', to: '#94540F' },
  { test: /mestre/i, icon: 'hard-hat', from: '#3F63F0', to: '#0E2472' },
  { test: /servente|ajudante/i, icon: 'shovel', from: '#9AA3AE', to: '#3F4852' },
  { test: /pedreiro|alvenaria|reboco|acabamento/i, icon: 'brick-wall', from: '#D9774B', to: '#842F12' }
];
const DEFAULT_COVER = { icon: 'hard-hat', from: '#1D4BED', to: '#0A1A54' };

export function JobCover({ job, large = false }) {
  const c = COVERS.find((x) => x.test.test(job.role || '')) || DEFAULT_COVER;
  return h('div', { class: 'absolute inset-0', style: { background: `linear-gradient(145deg, ${c.from}, ${c.to})` } },
    h('div', { class: 'absolute inset-0 job-cover-grid' }),
    h('div', { class: 'absolute inset-0', style: { background: 'radial-gradient(circle at 28% 18%, rgba(255,255,255,0.22), transparent 58%)' } }),
    h('span', { class: 'absolute -right-8 -bottom-8 opacity-[0.13] -rotate-12' }, Icon(c.icon, { size: large ? 280 : 168, color: '#fff' })),
    h('div', { class: 'absolute inset-0 flex items-center justify-center' },
      h('span', {
        class: cx('inline-flex items-center justify-center bg-white/15 ring-1 ring-white/30 shadow-raised', large ? 'w-24 h-24 rounded-3xl' : 'w-16 h-16 rounded-2xl'),
        style: { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }
      }, Icon(c.icon, { size: large ? 44 : 30, color: '#fff' }))
    )
  );
}

/** Bookmark flag over a job's photo: save/unsave without opening the job. */
export function SaveFlag({ saved, onToggle }) {
  const label = saved ? 'Remover dos salvos' : 'Salvar vaga';
  return h('button', {
    type: 'button', 'aria-label': label, 'aria-pressed': saved ? 'true' : 'false', title: label,
    class: 'absolute top-2 right-2 z-10 inline-flex items-center justify-center w-10 h-10 rounded-full transition-transform active:scale-90 hover:scale-110',
    onClick: (e) => { e.stopPropagation(); onToggle(); }
  },
    h('span', { class: 'relative inline-flex w-6 h-6', style: { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' } },
      Icon('bookmark-solid', { size: 24, color: saved ? 'var(--brand)' : 'rgba(16,20,24,0.32)', className: 'absolute inset-0' }),
      Icon('bookmark', { size: 24, color: '#fff', className: 'absolute inset-0' })
    )
  );
}
