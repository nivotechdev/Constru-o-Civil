import type { Oficio } from '../types/models';

// The one list of trades (ofícios) used everywhere: publishing a job, the mural's filter, the worker's
// profile and the search. `id` is what is stored; `sinonimos` are other words people use for the trade
// (the search finds a trade by any of them).
export const OFICIOS: Oficio[] = [
  { id: 'pedreiro', nome: 'Pedreiro', sinonimos: ['alvenaria', 'reboco', 'contrapiso', 'construtor'] },
  {
    id: 'pedreiro-acabamento',
    nome: 'Pedreiro de acabamento',
    sinonimos: ['acabamento', 'massa corrida', 'acabador', 'rodapé']
  },
  {
    id: 'servente',
    nome: 'Servente',
    sinonimos: ['servente de obra', 'ajudante de pedreiro', 'auxiliar de obra', 'massa']
  },
  {
    id: 'ajudante-geral',
    nome: 'Ajudante geral',
    sinonimos: ['ajudante', 'auxiliar', 'carga e descarga', 'limpeza de obra']
  },
  { id: 'pintor', nome: 'Pintor', sinonimos: ['pintura', 'textura', 'grafiato', 'fachada'] },
  { id: 'eletricista', nome: 'Eletricista', sinonimos: ['elétrica', 'instalação elétrica', 'fiação', 'quadro de luz'] },
  { id: 'encanador', nome: 'Encanador', sinonimos: ['hidráulica', 'bombeiro hidráulico', 'encanamento', 'vazamento'] },
  {
    id: 'azulejista',
    nome: 'Azulejista',
    sinonimos: ['revestimento', 'porcelanato', 'assentador', 'ladrilheiro', 'piso']
  },
  { id: 'armador', nome: 'Armador', sinonimos: ['ferragem', 'ferreiro armador', 'vergalhão', 'laje'] },
  { id: 'carpinteiro', nome: 'Carpinteiro', sinonimos: ['fôrma', 'madeira', 'carpintaria', 'escoramento'] },
  { id: 'gesseiro', nome: 'Gesseiro', sinonimos: ['gesso', 'drywall', 'forro', 'sanca'] },
  { id: 'telhadista', nome: 'Telhadista', sinonimos: ['telhado', 'calha', 'cobertura', 'telha'] },
  { id: 'serralheiro', nome: 'Serralheiro', sinonimos: ['solda', 'portão', 'estrutura metálica', 'grade'] },
  { id: 'mestre-de-obras', nome: 'Mestre de obras', sinonimos: ['encarregado', 'mestre', 'líder de equipe'] }
];
