import type { Job } from '../types/models';
import { cx } from '../utils/cx';
import { jobTitle, oficioNome } from '../services/catalog';
import { Icon, type IconName } from './icons/Icon';

// Illustrated cover for jobs without a photo: a gradient, a fine grid texture and an icon of the kind of service
// (U48: services for everyone — cleaning, events, kitchen, deliveries, care…), so a grid of jobs doesn't read as a
// wall of grey boxes. The first rule whose words are in the job's title (or trade) wins; otherwise a briefcase.
interface Cover {
  icon: IconName;
  from: string;
  to: string;
}

const COVERS: (Cover & { test: RegExp })[] = [
  { test: /limp|faxin|diarist|arrum|higieniz/i, icon: 'sparkles', from: '#2AA096', to: '#08514A' },
  {
    test: /gar[cç]o|cozinh|buffet|churras|copeir|confeit|lanch|restaur|bar\b|bartender/i,
    icon: 'utensils',
    from: '#E0A24A',
    to: '#94540F'
  },
  { test: /event|festa|recep|anivers|casament|promot/i, icon: 'party-popper', from: '#B05BD9', to: '#5A1F7E' },
  { test: /entreg|motoboy|mudan[cç]|frete|motorist|carga|descarg/i, icon: 'truck', from: '#3AA9D1', to: '#0C5F80' },
  { test: /estoque|embal|reposi|invent[aá]ri/i, icon: 'package', from: '#9AA3AE', to: '#3F4852' },
  { test: /jardin|jardim|grama|poda|paisag|horta/i, icon: 'leaf', from: '#4CAF6A', to: '#1D5E33' },
  { test: /cuidad|idos|acompanhant|enfermag/i, icon: 'heart-handshake', from: '#E86A7A', to: '#8A1F31' },
  { test: /bab[aá]|crian[cç]|recreac|recreador/i, icon: 'baby', from: '#F08FB0', to: '#9A2E59' },
  { test: /\bpet|cachorr|c[aã]es|passeador|adestr/i, icon: 'dog', from: '#C08A4A', to: '#6E4015' },
  { test: /cabel|manicur|pedicur|barb|beleza|maqui|costur|estet/i, icon: 'scissors', from: '#D9774B', to: '#842F12' },
  { test: /passad|lavander|roupa/i, icon: 'shirt', from: '#8E9DB5', to: '#46546B' },
  { test: /lava-?jato|lavagem de carro|manobr|carro|ve[ií]culo/i, icon: 'car', from: '#5C6672', to: '#161C24' },
  {
    test: /inform[aá]t|digit|design|computad|site|redes sociais|suporte t[eé]c/i,
    icon: 'laptop',
    from: '#2F4BB5',
    to: '#0A1A54'
  },
  { test: /aula|professor|refor[cç]o escolar|ensin|tradu/i, icon: 'graduation-cap', from: '#6E8DF5', to: '#1D3FB8' },
  { test: /vend|loja|atendent|balc[aã]o|caixa|panfl/i, icon: 'store', from: '#3F63F0', to: '#0E2472' },
  { test: /ajudante|auxiliar|apoio/i, icon: 'handshake', from: '#5C9DF2', to: '#1A4A8F' }
];
const DEFAULT_COVER: Cover = { icon: 'briefcase', from: '#1D4BED', to: '#0A1A54' };

export function JobCover({ job, large = false }: { job: Pick<Job, 'oficioId' | 'title'>; large?: boolean }) {
  const c = COVERS.find((x) => x.test.test(oficioNome(job.oficioId) + ' ' + jobTitle(job))) || DEFAULT_COVER;
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
