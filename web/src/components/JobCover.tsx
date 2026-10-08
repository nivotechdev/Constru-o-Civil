import type { Job } from '../types/models';
import { cx } from '../utils/cx';
import { Icon, type IconName } from './icons/Icon';

// Illustrated cover for jobs without a photo: a trade-specific gradient, blueprint texture and
// icon, so a grid of jobs doesn't read as a wall of grey boxes.
interface Cover {
  icon: IconName;
  from: string;
  to: string;
}

const COVERS: (Cover & { test: RegExp })[] = [
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
const DEFAULT_COVER: Cover = { icon: 'hard-hat', from: '#1D4BED', to: '#0A1A54' };

export function JobCover({ job, large = false }: { job: Pick<Job, 'role'>; large?: boolean }) {
  const c = COVERS.find((x) => x.test.test(job.role || '')) || DEFAULT_COVER;
  return (
    <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${c.from}, ${c.to})` }}>
      <div className="absolute inset-0 job-cover-grid" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 28% 18%, rgba(255,255,255,0.22), transparent 58%)' }}
      />
      <span className="absolute -right-8 -bottom-8 opacity-[0.13] -rotate-12">
        <Icon name={c.icon} size={large ? 280 : 168} color="#fff" />
      </span>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cx(
            'inline-flex items-center justify-center bg-white/15 ring-1 ring-white/30 shadow-raised',
            large ? 'w-24 h-24 rounded-3xl' : 'w-16 h-16 rounded-2xl'
          )}
          style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        >
          <Icon name={c.icon} size={large ? 44 : 30} color="#fff" />
        </span>
      </div>
    </div>
  );
}
