// The fixed option lists the forms and filters offer (trades, regions, requirements…) and the boost
// plans. Today they ship with the app, in the mock data; a backend can serve them later without the
// screens changing.
export {
  CARGOS_TRABALHADOR,
  ESPECIALIDADES,
  REGIOES_RECRUTADOR,
  REGIOES_TRABALHADOR,
  REQUISITOS_OPCOES,
  TIPOS_OBRA,
  TIPOS_SERVICO
} from '../data/seed';
import type { BoostPlan } from '../types/models';

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
