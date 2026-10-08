// The fixed option lists the forms and filters offer (trades, regions, requirements…) and the boost
// plans. Today they ship with the app, in the mock data; a backend can serve them later without the
// screens changing.
import { OFICIOS } from '../data/seed';
import type { BoostPlan, Job, Oficio } from '../types/models';
import { fold } from '../utils/text';

export { ESPECIALIDADES, REGIOES_RECRUTADOR, REGIOES_TRABALHADOR, REQUISITOS_OPCOES, TIPOS_OBRA } from '../data/seed';
export { OFICIOS };

// ---- ofícios (one catalog for jobs, the mural's filter, worker profiles and the search) ----

const BY_ID = new Map(OFICIOS.map((o) => [o.id, o]));

export function getOficio(id: string | null | undefined): Oficio | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** The trade's name; '' for an unknown or empty id (e.g. a profile not completed yet). */
export function oficioNome(id: string | null | undefined): string {
  return getOficio(id)?.nome ?? '';
}

/** How a job is called everywhere: its own title, or else its trade's name. */
export function jobTitle(job: Pick<Job, 'oficioId' | 'title'>): string {
  return job.title?.trim() || oficioNome(job.oficioId) || 'Bico';
}

/** Every word the search should find a trade by: its name and its synonyms. */
export function oficioSearchText(id: string | null | undefined): string {
  const o = getOficio(id);
  return o ? fold([o.nome, ...o.sinonimos].join(' ')) : '';
}

/** The catalog as select options (value = id). */
export const OFICIO_OPTIONS = OFICIOS.map((o) => ({ value: o.id, label: o.nome }));

/** Trades whose name or a synonym contains `query` (accents and case ignored). */
export function searchOficios(query: string): Oficio[] {
  const q = fold(query.trim());
  if (!q) return OFICIOS;
  return OFICIOS.filter((o) => oficioSearchText(o.id).includes(q));
}

/** What "Impulsionar vaga" offers, in the order shown. */
export const BOOST_PLANS: BoostPlan[] = [
  { id: '24h', label: 'Topo do mural por 24h', desc: 'Aparece antes das outras vagas da região.', price: 'R$ 12' },
  { id: '3d', label: 'Topo do mural por 3 dias', desc: 'Para vaga com data mais distante.', price: 'R$ 28' },
  {
    id: 'whats',
    label: '24h + aviso por WhatsApp',
    desc: 'Avisamos quem tem o perfil da vaga por perto.',
    price: 'R$ 39'
  }
];
