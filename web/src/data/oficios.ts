import type { Oficio } from '../types/models';

// The one list of services (ofícios) used everywhere: publishing a job, the mural's filter, the worker's
// profile and the search. U48: services for the general public (not only construction). `id` is what is
// stored; `sinonimos` are other words people use for the service (the search finds it by any of them).
export const OFICIOS: Oficio[] = [
  { id: 'garcom', nome: 'Garçom', sinonimos: ['garçonete', 'copeiro', 'atendimento de mesa', 'servir'] },
  { id: 'cozinha', nome: 'Auxiliar de cozinha', sinonimos: ['cozinheiro', 'cozinheira', 'chapeiro', 'salgadeira'] },
  { id: 'limpeza', nome: 'Limpeza', sinonimos: ['faxina', 'diarista', 'faxineira', 'higienização'] },
  { id: 'eventos', nome: 'Eventos', sinonimos: ['recepcionista', 'recepção', 'montagem de festa', 'hostess'] },
  { id: 'mudanca', nome: 'Ajudante de mudança', sinonimos: ['mudança', 'carregador', 'carga e descarga', 'frete'] },
  { id: 'entregas', nome: 'Entregas', sinonimos: ['entregador', 'motoboy', 'delivery', 'motorista'] },
  { id: 'estoque', nome: 'Estoque', sinonimos: ['repositor', 'embalador', 'separador', 'conferente'] },
  {
    id: 'vendas',
    nome: 'Vendas e atendimento',
    sinonimos: ['vendedor', 'atendente', 'caixa', 'balconista', 'promotor']
  },
  { id: 'jardinagem', nome: 'Jardinagem', sinonimos: ['jardineiro', 'poda', 'roçada', 'grama'] },
  { id: 'cuidador', nome: 'Cuidador', sinonimos: ['cuidadora', 'cuidador de idosos', 'acompanhante', 'idoso'] },
  { id: 'baba', nome: 'Babá', sinonimos: ['babá', 'recreador', 'recreação', 'cuidar de criança'] },
  { id: 'beleza', nome: 'Beleza', sinonimos: ['cabeleireiro', 'manicure', 'maquiadora', 'barbeiro'] },
  { id: 'lavagem-de-carro', nome: 'Lavagem de carro', sinonimos: ['lava-rápido', 'lavador', 'polimento', 'carro'] },
  { id: 'ajudante-geral', nome: 'Ajudante geral', sinonimos: ['ajudante', 'auxiliar', 'serviços gerais', 'apoio'] }
];
