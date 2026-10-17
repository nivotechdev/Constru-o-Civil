import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';
import { Card } from './Card.js';
import { JobCover, SaveFlag, jobPhotos } from './JobCover.js';
import { formatBRL } from '../utils/format.js';
import { dateText } from '../utils/jobInfo.js';

function PayBlock({ job, muted }) {
  if (muted) {
    return h('div', { class: 'shrink-0 w-24 h-16 rounded-card bg-concrete-100 flex flex-col items-center justify-center gap-0.5' },
      h('span', { class: 'font-mono font-bold text-lg text-concrete-500' }, job.pay != null ? formatBRL(job.pay) : 'A combinar'),
      h('span', { class: 'text-[0.5625rem] font-semibold tracking-wide uppercase text-concrete-500' }, 'por diária')
    );
  }
  if (job.pay == null) {
    return h('div', { class: 'shrink-0 w-24 h-16 rounded-card bg-white border-[1.5px] border-brand-200 flex flex-col items-center justify-center gap-1' },
      Icon('handshake', { size: 16, color: 'var(--text-brand)' }),
      h('span', { class: 'text-xs font-semibold text-brand-600' }, 'A combinar')
    );
  }
  return h('div', { class: 'shrink-0 w-24 h-16 rounded-card bg-brand-500 shadow-card flex flex-col items-center justify-center gap-0.5' },
    h('span', { class: 'font-mono font-bold text-lg text-white' }, formatBRL(job.pay)),
    h('span', { class: 'text-[0.5625rem] font-semibold tracking-wide uppercase text-white/85' }, 'por diária')
  );
}

/**
 * The one job card in the app: same component on the feed, applications, saved jobs
 * and company-profile posts — only `footer` and the overlay `badge` change per screen.
 */
export function JobCard({ job, companyName, onClick, overlay = null, footer = null, photoLabel = 'Foto do canteiro', muted = false, saved = false, onToggleSave = null }) {
  const cover = jobPhotos(job)[0];
  const photo = h('div', { class: cx('relative h-[9.25rem] bg-concrete-200 overflow-hidden', muted ? 'grayscale' : '') },
    cover
      ? h('img', { src: cover, alt: '', class: 'w-full h-full object-cover' })
      : [
          h('div', { class: 'lg:hidden w-full h-full flex items-center justify-center text-concrete-400 text-xs' }, photoLabel),
          h('div', { class: 'hidden lg:block absolute inset-0' }, JobCover({ job }))
        ],
    overlay,
    onToggleSave ? SaveFlag({ saved, onToggle: onToggleSave }) : null
  );

  const body = h('div', { class: 'flex flex-col gap-3 p-4' },
    h('div', { class: 'flex items-center gap-2.5' },
      h('span', { class: 'flex-1 min-w-0 font-display font-semibold text-lg leading-tight text-concrete-900 truncate' }, job.role),
      PayBlock({ job, muted })
    ),
    h('div', { class: 'flex items-center flex-wrap gap-2' },
      h('span', { class: 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-concrete-100 text-sm font-semibold text-concrete-900' },
        Icon('calendar', { size: 14 }), dateText(job)
      ),
      h('span', { class: 'inline-flex items-center gap-1.5 text-sm text-concrete-500' },
        Icon('map-pin', { size: 14, color: 'var(--text-subtle)' }), companyName ? `${companyName} · ${job.location}` : job.location
      )
    )
  );

  const card = Card({ padding: 'none', onClick, className: 'flex flex-col' }, photo, body, footer);
  return card;
}

export function JobCardFooter({ badgeEl, hint, hintColor = 'var(--text-brand)', extra }) {
  return h('div', { class: 'flex items-center justify-between gap-2 px-4 py-2.5 bg-concrete-100 border-t border-concrete-200' },
    badgeEl,
    extra || (hint ? h('span', { class: 'inline-flex items-center gap-0.5 text-sm font-semibold whitespace-nowrap', style: { color: hintColor } }, hint, Icon('chevron-right', { size: 16, color: hintColor })) : null)
  );
}
