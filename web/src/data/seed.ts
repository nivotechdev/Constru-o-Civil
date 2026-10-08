import type {
  Account,
  Actor,
  Application,
  ApplicationEvent,
  ApplicationStatus,
  AppNotification,
  Company,
  DiasKey,
  Job,
  JobAddress,
  Worker,
  WorkerPost
} from '../types/models';
import { addDays, todayISO, weekday } from '../utils/dates';
export { OFICIOS } from './oficios';

// Mock marketplace data. In production this is an API — here it seeds the in-memory
// store (see services/store.ts), which is the single source of truth every screen reads from,
// so the same job/candidate/company record renders identically wherever it's used.

// The demo accounts' profiles (the login decides which one is in use; see services/auth.ts).
export const CURRENT_COMPANY_ID = 'meridiano';
export const CURRENT_WORKER_ID = 'jorge';

/** Password of both demo accounts. Only the mock auth knows it; a real backend keeps passwords in Auth. */
export const DEMO_PASSWORD = 'bicos123';

export const ACCOUNTS: Record<string, Account> = {
  'conta-jorge': {
    id: 'conta-jorge',
    email: 'trabalhador@bicos.demo',
    role: 'trabalhador',
    document: '529.982.247-25',
    whatsapp: '(11) 97412-5580',
    whatsappVerifiedAt: '2025-03-02T13:10:00.000Z',
    emailConfirmedAt: '2025-03-02T13:20:00.000Z',
    profileCompletedAt: '2025-03-02T13:30:00.000Z',
    workerId: CURRENT_WORKER_ID,
    companyId: null,
    createdAt: '2025-03-02T13:00:00.000Z'
  },
  'conta-meridiano': {
    id: 'conta-meridiano',
    email: 'construtora@bicos.demo',
    role: 'recrutador',
    document: '18.402.551/0001-07',
    whatsapp: '(11) 98842-3310',
    whatsappVerifiedAt: '2025-03-01T12:10:00.000Z',
    emailConfirmedAt: '2025-03-01T12:20:00.000Z',
    profileCompletedAt: '2025-03-01T12:30:00.000Z',
    workerId: null,
    companyId: CURRENT_COMPANY_ID,
    createdAt: '2025-03-01T12:00:00.000Z'
  }
};

// ---- places and dates ----
// Jobs and workers of the demo are in the east zone of São Paulo. Coordinates are the neighbourhood's
// centre plus a small fixed offset per record, so distances differ like they would in real life.
const NEIGHBORHOODS: Record<string, { cep: string; lat: number; lon: number }> = {
  Tatuapé: { cep: '03307-000', lat: -23.54, lon: -46.576 },
  Mooca: { cep: '03104-000', lat: -23.56, lon: -46.599 },
  'Vila Formosa': { cep: '03356-000', lat: -23.567, lon: -46.548 },
  'Vila Prudente': { cep: '03151-000', lat: -23.585, lon: -46.582 },
  Penha: { cep: '03605-000', lat: -23.528, lon: -46.542 },
  Belém: { cep: '03057-000', lat: -23.542, lon: -46.59 },
  Cangaíba: { cep: '03733-000', lat: -23.505, lon: -46.528 },
  Aricanduva: { cep: '03503-000', lat: -23.565, lon: -46.513 }
};

function jitter(seed: string, scale = 0.006): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 2001) / 1000 - 1) * scale;
}

function addr(neighborhood: string, street: string, number: string, id: string): JobAddress {
  const n = NEIGHBORHOODS[neighborhood];
  return {
    cep: n.cep,
    street,
    number,
    complement: null,
    neighborhood,
    city: 'São Paulo',
    uf: 'SP',
    lat: +(n.lat + jitter(id)).toFixed(5),
    lon: +(n.lon + jitter(id + 'x')).toFixed(5)
  };
}

function home(neighborhood: string, id: string): Pick<Worker, 'city' | 'neighborhood' | 'lat' | 'lon'> {
  const n = NEIGHBORHOODS[neighborhood];
  return {
    city: 'São Paulo, SP',
    neighborhood,
    lat: +(n.lat + jitter(id, 0.01)).toFixed(5),
    lon: +(n.lon + jitter(id + 'y', 0.01)).toFixed(5)
  };
}

// Dates are relative to the day the app opens, so the demo always has jobs "Hoje", "Amanhã" and next
// week, and a history in the past.
const TODAY = todayISO();

function fits(dias: DiasKey, iso: string): boolean {
  const d = weekday(iso);
  return dias === 'semana' ? d >= 1 && d <= 5 : dias === 'fimdesemana' ? d === 0 || d === 6 : true;
}

/** `n` diárias on the job's days of the week, starting `offset` days from today (or the next fitting day). */
function span(
  offset: number,
  n: number,
  dias: DiasKey
): Pick<Job, 'dateToArrange' | 'startDate' | 'endDate' | 'diarias'> {
  let start = addDays(TODAY, offset);
  while (offset !== 0 && !fits(dias, start)) start = addDays(start, 1);
  let end = start;
  for (let left = n - 1; left > 0;) {
    end = addDays(end, 1);
    if (fits(dias, end)) left--;
  }
  return { dateToArrange: false, startDate: start, endDate: end, diarias: n };
}

function toArrange(n: number): Pick<Job, 'dateToArrange' | 'startDate' | 'endDate' | 'diarias'> {
  return { dateToArrange: true, startDate: null, endDate: null, diarias: n };
}

export const COMPANIES: Record<string, Company> = {
  meridiano: {
    id: 'meridiano',
    name: 'Construtora Meridiano',
    cnpj: '18.402.551/0001-07',
    tipoObra: 'Residencial e reforma',
    location: 'Zona Leste, SP',
    whatsapp: '(11) 98842-3310',
    rating: 4.7,
    reviewCount: 31,
    verified: true,
    verifiedSince: '12 ago',
    sinceLabel: 'Na Bicos desde março de 2025',
    respondTime: 'Responde em 1h20, em média',
    paidCount: 128,
    reviews: [
      {
        author: 'Marcos A. · servente',
        value: 5,
        text: 'Pagou em PIX no fim da diária, como combinado.',
        date: '2 set'
      },
      {
        author: 'Jorge M. · pedreiro',
        value: 4,
        text: 'Obra organizada e EPI no local. Começou 30 min atrasado.',
        date: '25 ago'
      },
      {
        author: 'Edson B. · pedreiro',
        value: 5,
        text: 'Já trabalhei com eles três vezes. Sempre no horário certo.',
        date: '18 ago'
      }
    ]
  },
  alvorada: {
    id: 'alvorada',
    name: 'Construtora Alvorada',
    location: 'Mooca, SP',
    whatsapp: '(11) 97731-4402',
    rating: 4.5,
    reviewCount: 18,
    verified: true,
    reviews: [
      { author: 'Caio N. · pedreiro', value: 4, text: 'Bom acabamento, chegou 20 min atrasado.', date: '30 jul' }
    ]
  },
  'vila-formosa': {
    id: 'vila-formosa',
    name: 'Instalações Vila Formosa',
    location: 'Vila Formosa, SP',
    whatsapp: '(11) 96614-2078',
    rating: 4.6,
    reviewCount: 9,
    verified: false,
    reviews: []
  },
  'serra-braganca': {
    id: 'serra-braganca',
    name: 'Reforma Serra de Bragança',
    location: 'Tatuapé, SP',
    whatsapp: '(11) 98127-5530',
    rating: 4.8,
    reviewCount: 14,
    verified: true,
    reviews: [
      { author: 'Nelson A. · azulejista', value: 5, text: 'Assentamento impecável, obra organizada.', date: '22 ago' }
    ]
  },
  'vila-prudente': {
    id: 'vila-prudente',
    name: 'Obra Vila Prudente',
    location: 'Vila Prudente, SP',
    whatsapp: '(11) 95548-9016',
    rating: 4.4,
    reviewCount: 7,
    verified: false,
    reviews: [
      {
        author: 'Bruno T. · servente',
        value: 5,
        text: 'Trabalhador de confiança. Já chamei três vezes.',
        date: '27 ago'
      }
    ]
  },
  belem: {
    id: 'belem',
    name: 'Obra Belém',
    location: 'Belém, SP',
    whatsapp: '(11) 97402-6621',
    rating: 4.3,
    reviewCount: 5,
    verified: false,
    reviews: []
  },
  aricanduva: {
    id: 'aricanduva',
    name: 'Obra Aricanduva',
    location: 'Aricanduva, SP',
    whatsapp: '(11) 96280-3147',
    rating: 4.2,
    reviewCount: 4,
    verified: false,
    reviews: []
  },
  cangaiba: {
    id: 'cangaiba',
    name: 'Obra Cangaíba',
    location: 'Cangaíba, SP',
    whatsapp: '(11) 98865-1204',
    rating: 4.3,
    reviewCount: 6,
    verified: false,
    reviews: []
  }
};

export const WORKERS: Record<string, Worker> = {
  jorge: {
    id: 'jorge',
    name: 'Jorge Mendes',
    initials: 'JM',
    oficioId: 'pedreiro-acabamento',
    ...home('Tatuapé', 'jorge'),
    rating: 4.8,
    jobsDone: 23,
    verified: true,
    specialties: ['Acabamento', 'Alvenaria', 'Reboco', 'Assentamento'],
    facts: [
      '23 diárias pagas pela plataforma',
      'RG e CPF conferidos em 12 ago',
      'Responde em 40 min, em média',
      'Nunca faltou a uma diária combinada'
    ],
    reviews: [
      {
        company: 'Obra Vila Prudente',
        value: 5,
        text: 'Trabalhou o dia todo sem reclamar. Deixou a área limpa.',
        date: '14 ago'
      },
      {
        company: 'Reforma Serra de Bragança',
        value: 5,
        text: 'Chegou no horário, acabamento bem feito.',
        date: '2 ago'
      },
      {
        company: 'Construtora Meridiano',
        value: 5,
        text: 'Chegou no horário, acabamento bem feito. Chamo de novo.',
        date: '28 ago'
      }
    ]
  },
  rafael: {
    id: 'rafael',
    name: 'Rafael Duarte',
    initials: 'RD',
    oficioId: 'servente',
    ...home('Vila Prudente', 'rafael'),
    rating: 4.5,
    jobsDone: 17,
    verified: true,
    specialties: ['Carga de material', 'Limpeza de obra'],
    facts: ['17 diárias pagas pela plataforma', 'RG e CPF conferidos em 5 ago', 'Responde em 55 min, em média'],
    reviews: [
      { company: 'Obra Belém', value: 4, text: 'Fez o serviço direito. Saiu 20 min mais cedo.', date: '19 ago' }
    ]
  },
  nelson: {
    id: 'nelson',
    name: 'Nelson Aquino',
    initials: 'NA',
    oficioId: 'azulejista',
    ...home('Tatuapé', 'nelson'),
    rating: 4.9,
    jobsDone: 52,
    verified: true,
    specialties: ['Porcelanato 60x60', 'Rejunte', 'Nivelamento'],
    facts: ['52 diárias pagas pela plataforma', 'RG e CPF conferidos em 8 abr', 'Responde em 15 min, em média'],
    reviews: [
      {
        company: 'Reforma Serra de Bragança',
        value: 5,
        text: 'Assentamento impecável. Levou as próprias ferramentas.',
        date: '22 ago'
      }
    ]
  },
  bruno: {
    id: 'bruno',
    name: 'Bruno Tavares',
    initials: 'BT',
    oficioId: 'servente',
    ...home('Vila Prudente', 'bruno'),
    rating: 4.8,
    jobsDone: 28,
    verified: true,
    specialties: ['Carga de material', 'Massa'],
    facts: ['28 diárias pagas pela plataforma', 'RG e CPF conferidos em 15 jun', 'Nunca faltou a uma diária combinada'],
    reviews: [
      {
        company: 'Obra Vila Prudente',
        value: 5,
        text: 'Trabalhador de confiança. Já chamei três vezes.',
        date: '27 ago'
      }
    ]
  },
  marcos: {
    id: 'marcos',
    name: 'Marcos Aurélio',
    initials: 'MA',
    oficioId: 'servente',
    ...home('Penha', 'marcos'),
    rating: 4.6,
    jobsDone: 41,
    verified: true,
    specialties: ['Carga de material', 'Limpeza de obra', 'Massa'],
    facts: ['41 diárias pagas pela plataforma', 'RG e CPF conferidos em 30 jul', 'Responde em 1h10, em média'],
    reviews: [
      { company: 'Construtora Alvorada', value: 5, text: 'Pegou no pesado o dia todo. Chamo de novo.', date: '21 ago' }
    ]
  },
  silas: {
    id: 'silas',
    name: 'Silas Pereira',
    initials: 'SP',
    oficioId: 'azulejista',
    ...home('Mooca', 'silas'),
    rating: 0,
    jobsDone: 0,
    novo: true,
    verified: false,
    specialties: ['Porcelanato', 'Rejunte'],
    facts: [
      '11 anos de obra, primeiro bico pela plataforma',
      'Documentos enviados, em conferência',
      'Telefone confirmado por SMS'
    ],
    reviews: []
  },
  vitor: {
    id: 'vitor',
    name: 'Vitor Camargo',
    initials: 'VC',
    oficioId: 'pedreiro',
    ...home('Tatuapé', 'vitor'),
    rating: 4.7,
    jobsDone: 31,
    verified: true,
    specialties: ['Reboco', 'Contrapiso'],
    facts: ['31 diárias pagas pela plataforma', 'RG e CPF conferidos em 21 jul', 'Responde em 35 min, em média'],
    reviews: [{ company: 'Obra Belém', value: 5, text: 'Serviço limpo e no prazo combinado.', date: '12 ago' }]
  },
  caio: {
    id: 'caio',
    name: 'Caio Nogueira',
    initials: 'CN',
    oficioId: 'pedreiro-acabamento',
    ...home('Penha', 'caio'),
    rating: 4.2,
    jobsDone: 9,
    verified: true,
    specialties: ['Massa corrida', 'Acabamento'],
    facts: ['9 diárias pagas pela plataforma', 'RG e CPF conferidos em 2 set', 'Faltou a 1 diária combinada em julho'],
    reviews: [
      { company: 'Construtora Alvorada', value: 4, text: 'Bom acabamento, chegou 20 min atrasado.', date: '30 jul' }
    ]
  },
  edson: {
    id: 'edson',
    name: 'Edson Batista',
    initials: 'EB',
    oficioId: 'pedreiro',
    ...home('Belém', 'edson'),
    rating: 4.9,
    jobsDone: 64,
    verified: true,
    specialties: ['Alvenaria estrutural', 'Contrapiso', 'Reboco'],
    facts: ['64 diárias pagas pela plataforma', 'RG e CPF conferidos em 4 mar', 'Responde em 25 min, em média'],
    reviews: [
      {
        company: 'Construtora Meridiano',
        value: 5,
        text: 'Já trabalhou com a gente três vezes. Sempre pontual.',
        date: '18 ago'
      }
    ]
  },
  joel: {
    id: 'joel',
    name: 'Joel Ribeiro',
    initials: 'JR',
    oficioId: 'ajudante-geral',
    ...home('Belém', 'joel'),
    rating: 0,
    jobsDone: 0,
    novo: true,
    verified: false,
    specialties: ['Carga de material'],
    facts: [
      '6 anos de obra, primeiro bico pela plataforma',
      'Documentos enviados, em conferência',
      'Telefone confirmado por SMS'
    ],
    reviews: []
  },
  antonio: {
    id: 'antonio',
    name: 'Antônio Ferraz',
    initials: 'AF',
    oficioId: 'servente',
    ...home('Vila Prudente', 'antonio'),
    rating: 4.6,
    jobsDone: 19,
    verified: true,
    specialties: ['Carga de material', 'Limpeza de obra'],
    facts: ['19 diárias pagas pela plataforma', 'RG e CPF conferidos em 3 mai'],
    reviews: []
  }
};

// pay: number = fixed R$/diária. pay: null = "A combinar".
export const JOBS: Record<string, Job> = {
  'BC-4821': {
    id: 'BC-4821',
    companyId: 'meridiano',
    oficioId: 'pedreiro-acabamento',
    title: null,
    pay: 220,
    address: addr('Tatuapé', 'Rua Serra de Bragança', '1240', 'BC-4821'),
    ...span(0, 1, 'qualquer'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'qualquer',
    urgent: true,
    boosted: true,
    photos: ['img/jobs/pedreiro-2.jpg', 'img/jobs/pedreiro-1.jpg', 'img/jobs/pedreiro-3.jpg'],
    slots: 4,
    description:
      'Reboco e regularização de duas paredes externas e acabamento em massa corrida numa reforma residencial. Material já está no canteiro.',
    requirements: ['Experiência com reboco e massa corrida', 'Botina e capacete próprios', 'Chegar 10 minutos antes']
  },
  'BC-4822': {
    id: 'BC-4822',
    companyId: 'alvorada',
    oficioId: 'pintor',
    title: null,
    pay: null,
    address: addr('Mooca', 'Rua da Mooca', '3180', 'BC-4822'),
    ...span(0, 1, 'qualquer'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'qualquer',
    urgent: true,
    photos: ['img/jobs/pintor-1.jpg', 'img/jobs/pintor-2.jpg'],
    slots: 1,
    description: 'Pintura interna em parede lisa de apartamento recém-reformado, duas demãos de tinta acrílica branca.',
    requirements: ['Pintura interna, parede lisa', 'Rolo e pincel próprios', 'Tinta e lixa fornecidas pela obra']
  },
  'BC-4855': {
    id: 'BC-4855',
    companyId: 'vila-formosa',
    oficioId: 'eletricista',
    title: null,
    pay: null,
    address: addr('Vila Formosa', 'Rua Vila Formosa', '210', 'BC-4855'),
    ...span(6, 1, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description:
      'Instalação elétrica residencial em casa em reforma: troca de disjuntores, tomadas e pontos de luz em três cômodos.',
    requirements: [
      'Instalação elétrica residencial',
      'Ferramentas próprias',
      'Combine o valor direto com a construtora'
    ]
  },
  'BC-4830': {
    id: 'BC-4830',
    companyId: 'vila-prudente',
    oficioId: 'servente',
    title: null,
    pay: 150,
    address: addr('Vila Prudente', 'Av. Vila Ema', '2790', 'BC-4830'),
    ...span(2, 2, 'semana'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'semana',
    slots: 1,
    description:
      'Carga e descarga de material de construção e limpeza do piso ao fim do expediente, em obra residencial de dois pavimentos.',
    requirements: ['Carregar material e limpar o piso', 'Botina própria', 'Capacete fornecido pela obra']
  },
  'BC-4835': {
    id: 'BC-4835',
    companyId: 'serra-braganca',
    oficioId: 'azulejista',
    title: null,
    pay: 260,
    address: addr('Tatuapé', 'Rua Serra de Bragança', '640', 'BC-4835'),
    ...span(3, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Assentamento de porcelanato 60x60 em sala e cozinha, com nivelamento e rejunte incluídos.',
    requirements: [
      'Assentamento de porcelanato 60x60',
      'Desempenadeira e nível próprios',
      'Argamassa fornecida pela obra'
    ]
  },
  'BC-4841': {
    id: 'BC-4841',
    companyId: 'meridiano',
    oficioId: 'armador',
    title: null,
    pay: 240,
    address: addr('Penha', 'Rua Cantagalo', '890', 'BC-4841'),
    ...span(4, 3, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description:
      'Montagem da ferragem de laje de um pavimento, seguindo projeto estrutural fornecido pela construtora.',
    requirements: ['Montagem de ferragem de laje', 'Botina, capacete e luva próprios', 'Experiência com vergalhão']
  },
  'BC-4848': {
    id: 'BC-4848',
    companyId: 'belem',
    oficioId: 'ajudante-geral',
    title: null,
    pay: 140,
    address: addr('Belém', 'Rua Padre Adelino', '410', 'BC-4848'),
    ...span(5, 1, 'fimdesemana'),
    startTime: '08:00',
    endTime: '14:00',
    dias: 'fimdesemana',
    slots: 1,
    description: 'Descarregar um caminhão de material de construção e organizar no canteiro. Serviço de meio período.',
    requirements: ['Descarregar caminhão de material', 'Botina própria', 'Sem experiência exigida']
  },
  'BC-4998': {
    id: 'BC-4998',
    companyId: 'meridiano',
    oficioId: 'servente',
    title: null,
    pay: 150,
    address: addr('Vila Prudente', 'Av. Vila Ema', '2790', 'BC-4998'),
    ...span(2, 2, 'semana'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'semana',
    slots: 2,
    description:
      'Carga e descarga de material de construção e limpeza do piso ao fim do expediente, em obra residencial de dois pavimentos.',
    requirements: ['Carregar material e limpar o piso', 'Botina própria']
  },
  'BC-4995': {
    id: 'BC-4995',
    companyId: 'meridiano',
    oficioId: 'azulejista',
    title: null,
    pay: 260,
    address: addr('Tatuapé', 'Rua Serra de Bragança', '640', 'BC-4995'),
    ...span(3, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Assentamento de porcelanato 60x60 em sala e cozinha, com nivelamento e rejunte incluídos.',
    requirements: ['Assentamento de porcelanato 60x60', 'Desempenadeira e nível próprios']
  },
  'BC-5010': {
    id: 'BC-5010',
    companyId: 'alvorada',
    oficioId: 'eletricista',
    title: null,
    pay: 250,
    address: addr('Mooca', 'Rua Taquari', '1180', 'BC-5010'),
    ...span(1, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    urgent: true,
    photos: ['img/jobs/eletricista-1.jpg', 'img/jobs/eletricista-2.jpg'],
    slots: 1,
    description: 'Troca da fiação de um apartamento de dois quartos e instalação de quadro de distribuição novo.',
    requirements: ['NR-10 em dia', 'Ferramentas próprias', 'Material fornecido pela obra']
  },
  'BC-5011': {
    id: 'BC-5011',
    companyId: 'serra-braganca',
    oficioId: 'pintor',
    title: 'Pintor de fachada',
    pay: 200,
    address: addr('Tatuapé', 'Rua Tuiuti', '2210', 'BC-5011'),
    ...span(7, 2, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 2,
    description: 'Pintura de fachada de sobrado, com andaime já montado pela obra.',
    requirements: ['Experiência com pintura externa', 'Rolo, pincel e trincha próprios', 'EPI fornecido pela obra']
  },
  'BC-5012': {
    id: 'BC-5012',
    companyId: 'vila-prudente',
    oficioId: 'encanador',
    title: null,
    pay: null,
    address: addr('Vila Prudente', 'Rua Ibitirama', '845', 'BC-5012'),
    ...span(0, 1, 'qualquer'),
    startTime: '09:00',
    endTime: '18:00',
    dias: 'qualquer',
    urgent: true,
    slots: 1,
    description: 'Vazamento na prumada do banheiro. Trocar a tubulação de água fria e testar a pressão.',
    requirements: ['Experiência com PVC e PPR', 'Ferramentas próprias']
  },
  'BC-5013': {
    id: 'BC-5013',
    companyId: 'belem',
    oficioId: 'servente',
    title: null,
    pay: 150,
    address: addr('Belém', 'Rua Siqueira Bueno', '1320', 'BC-5013'),
    ...span(8, 1, 'fimdesemana'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'fimdesemana',
    slots: 2,
    description: 'Apoio ao pedreiro no preparo de massa e transporte de blocos para o segundo andar.',
    requirements: ['Botina própria', 'Capacete e luvas fornecidos pela obra']
  },
  'BC-5014': {
    id: 'BC-5014',
    companyId: 'alvorada',
    oficioId: 'azulejista',
    title: null,
    pay: 280,
    address: addr('Mooca', 'Rua Javari', '540', 'BC-5014'),
    ...toArrange(2),
    startTime: null,
    endTime: null,
    dias: 'semana',
    photos: ['img/jobs/azulejista-1.jpg', 'img/jobs/azulejista-2.jpg'],
    slots: 1,
    description: 'Revestimento de banheiro inteiro com porcelanato 60x120, incluindo recortes para nichos.',
    requirements: ['Experiência com peça grande', 'Cortador e nível a laser próprios']
  },
  'BC-5015': {
    id: 'BC-5015',
    companyId: 'vila-formosa',
    oficioId: 'carpinteiro',
    title: null,
    pay: 260,
    address: addr('Vila Formosa', 'Av. Renata', '910', 'BC-5015'),
    ...span(10, 3, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 2,
    description: 'Montagem de fôrmas de madeira para a laje do térreo.',
    requirements: ['Experiência com fôrma de laje', 'Serrote, martelo e trena próprios']
  },
  'BC-5016': {
    id: 'BC-5016',
    companyId: 'cangaiba',
    oficioId: 'pedreiro',
    title: 'Pedreiro para muro de divisa',
    pay: 230,
    address: addr('Cangaíba', 'Rua Pedro Álvares', '77', 'BC-5016'),
    ...span(1, 2, 'qualquer'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'qualquer',
    photos: ['img/jobs/pedreiro-1.jpg', 'img/jobs/pedreiro-3.jpg', 'img/jobs/pedreiro-2.jpg'],
    slots: 1,
    description: 'Levantamento de muro de divisa com bloco de concreto, cerca de 20 metros.',
    requirements: ['Experiência com alvenaria', 'Colher e prumo próprios']
  },
  'BC-5017': {
    id: 'BC-5017',
    companyId: 'aricanduva',
    oficioId: 'ajudante-geral',
    title: null,
    pay: 130,
    address: addr('Aricanduva', 'Rua Olga Fadel Abarca', '300', 'BC-5017'),
    ...span(0, 1, 'qualquer'),
    startTime: '08:00',
    endTime: '14:00',
    dias: 'qualquer',
    urgent: true,
    slots: 1,
    description: 'Limpeza pós-obra de uma casa térrea: retirada de entulho e varrição.',
    requirements: ['Sem experiência exigida', 'Botina própria']
  },
  'BC-5018': {
    id: 'BC-5018',
    companyId: 'serra-braganca',
    oficioId: 'gesseiro',
    title: null,
    pay: 240,
    address: addr('Tatuapé', 'Rua Apucarana', '1450', 'BC-5018'),
    ...span(11, 2, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Instalação de forro de gesso em sala e dois quartos, com sanca aberta na sala.',
    requirements: ['Experiência com forro e sanca', 'Ferramentas próprias']
  },
  'BC-5019': {
    id: 'BC-5019',
    companyId: 'vila-prudente',
    oficioId: 'pintor',
    title: null,
    pay: 190,
    address: addr('Vila Prudente', 'Av. Paes de Barros', '3100', 'BC-5019'),
    ...toArrange(1),
    startTime: null,
    endTime: null,
    dias: 'qualquer',
    slots: 1,
    description: 'Pintura interna de apartamento de 60 m², com massa corrida nos pontos danificados.',
    requirements: ['Rolo e pincel próprios', 'Tinta fornecida pela obra']
  },
  'BC-5020': {
    id: 'BC-5020',
    companyId: 'belem',
    oficioId: 'eletricista',
    title: null,
    pay: null,
    address: addr('Belém', 'Av. Álvaro Ramos', '890', 'BC-5020'),
    ...span(9, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Instalação de iluminação em LED e tomadas numa loja de 80 m².',
    requirements: ['NR-10 em dia', 'Ferramentas próprias']
  },
  'BC-5021': {
    id: 'BC-5021',
    companyId: 'alvorada',
    oficioId: 'mestre-de-obras',
    title: null,
    pay: 380,
    address: addr('Mooca', 'Rua dos Trilhos', '1600', 'BC-5021'),
    ...toArrange(5),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Coordenar uma equipe de quatro pessoas na reforma completa de um apartamento.',
    requirements: ['Experiência comprovada como mestre', 'Leitura de projeto']
  },
  'BC-5022': {
    id: 'BC-5022',
    companyId: 'cangaiba',
    oficioId: 'servente',
    title: null,
    pay: 140,
    address: addr('Cangaíba', 'Rua Dr. Assis Ribeiro', '2200', 'BC-5022'),
    ...span(0, 1, 'qualquer'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'qualquer',
    urgent: true,
    slots: 2,
    description: 'Carga e descarga de sacos de cimento e areia para a concretagem de sábado.',
    requirements: ['Botina própria']
  },
  'BC-5023': {
    id: 'BC-5023',
    companyId: 'vila-formosa',
    oficioId: 'encanador',
    title: null,
    pay: 220,
    address: addr('Vila Formosa', 'Rua Itapeti', '60', 'BC-5023'),
    ...span(8, 1, 'fimdesemana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'fimdesemana',
    slots: 1,
    description: 'Instalação de aquecedor a gás e ligação das tubulações de água quente.',
    requirements: ['Experiência com aquecedor a gás', 'Ferramentas próprias']
  },
  'BC-5024': {
    id: 'BC-5024',
    companyId: 'serra-braganca',
    oficioId: 'pedreiro-acabamento',
    title: null,
    pay: 240,
    address: addr('Tatuapé', 'Rua Cantagalo', '1220', 'BC-5024'),
    ...span(10, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Assentamento de rodapé e soleiras de granito, com acabamento em rejunte epóxi.',
    requirements: ['Experiência com granito', 'Nível e esquadro próprios']
  },
  'BC-5025': {
    id: 'BC-5025',
    companyId: 'meridiano',
    oficioId: 'telhadista',
    title: null,
    pay: 250,
    address: addr('Penha', 'Rua Padre João', '480', 'BC-5025'),
    ...span(11, 1, 'semana'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'semana',
    slots: 2,
    description: 'Troca de telhas quebradas e revisão das calhas de um galpão.',
    requirements: ['Experiência em altura', 'Cinto de segurança fornecido pela obra']
  },
  'BC-5026': {
    id: 'BC-5026',
    companyId: 'meridiano',
    oficioId: 'pintor',
    title: null,
    pay: 210,
    address: addr('Tatuapé', 'Rua Itapura', '900', 'BC-5026'),
    ...span(7, 2, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 3,
    description: 'Pintura das áreas comuns de um condomínio: escadas e corredores de quatro andares.',
    requirements: ['Rolo e pincel próprios', 'Tinta fornecida pela obra']
  },
  // closed / historical
  'BC-4712': {
    id: 'BC-4712',
    companyId: 'aricanduva',
    oficioId: 'ajudante-geral',
    title: null,
    pay: 140,
    address: addr('Aricanduva', 'Av. Aricanduva', '5200', 'BC-4712'),
    ...span(-30, 1, 'semana'),
    startTime: '08:00',
    endTime: '14:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Descarregar material de construção na entrada da obra e organizar no canteiro.',
    requirements: ['Descarregar material', 'Botina própria']
  },
  'BC-4703': {
    id: 'BC-4703',
    companyId: 'cangaiba',
    oficioId: 'servente',
    title: null,
    pay: 150,
    address: addr('Cangaíba', 'Rua Cachoeira Tijuco Preto', '75', 'BC-4703'),
    ...span(-26, 1, 'fimdesemana'),
    startTime: '08:00',
    endTime: '14:00',
    dias: 'fimdesemana',
    slots: 1,
    closed: true,
    description: 'Limpeza geral do piso e carga de material de construção durante a diária.',
    requirements: ['Limpeza de piso e carga de material', 'Botina própria']
  },
  'BC-4698': {
    id: 'BC-4698',
    companyId: 'alvorada',
    oficioId: 'pintor',
    title: null,
    pay: 190,
    address: addr('Mooca', 'Rua da Mooca', '3180', 'BC-4698'),
    ...span(-35, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Pintura interna em parede lisa, duas demãos de tinta acrílica.',
    requirements: ['Pintura interna', 'Rolo e pincel próprios']
  },
  'BC-4960': {
    id: 'BC-4960',
    companyId: 'meridiano',
    oficioId: 'pintor',
    title: null,
    pay: 190,
    address: addr('Mooca', 'Rua da Mooca', '3180', 'BC-4960'),
    ...span(-35, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Pintura interna em parede lisa, duas demãos de tinta acrílica.',
    requirements: ['Pintura interna', 'Rolo e pincel próprios']
  },
  'BC-4944': {
    id: 'BC-4944',
    companyId: 'meridiano',
    oficioId: 'armador',
    title: null,
    pay: 240,
    address: addr('Penha', 'Rua Cantagalo', '890', 'BC-4944'),
    ...span(-41, 3, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 2,
    closed: true,
    semContratacao: true,
    description:
      'Montagem da ferragem de laje de um pavimento, seguindo projeto estrutural fornecido pela construtora.',
    requirements: ['Montagem de ferragem de laje']
  },
  'BC-4918': {
    id: 'BC-4918',
    companyId: 'meridiano',
    oficioId: 'pedreiro-acabamento',
    title: null,
    pay: 220,
    address: addr('Tatuapé', 'Rua Serra de Bragança', '1240', 'BC-4918'),
    ...span(-38, 1, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Reboco e regularização de parede externa numa reforma residencial.',
    requirements: ['Experiência com reboco e massa corrida']
  },
  'BC-4899': {
    id: 'BC-4899',
    companyId: 'meridiano',
    oficioId: 'pedreiro-acabamento',
    title: null,
    pay: 220,
    address: addr('Tatuapé', 'Rua Serra de Bragança', '1240', 'BC-4899'),
    ...span(-42, 1, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Acabamento em massa corrida antes da pintura, numa reforma residencial.',
    requirements: ['Experiência com reboco e massa corrida']
  },
  'BC-4870': {
    id: 'BC-4870',
    companyId: 'meridiano',
    oficioId: 'servente',
    title: null,
    pay: 150,
    address: addr('Vila Prudente', 'Av. Vila Ema', '2790', 'BC-4870'),
    ...span(-47, 1, 'semana'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Carga de material de construção e limpeza do piso ao fim do expediente.',
    requirements: ['Carregar material e limpar o piso']
  }
};

// One application = one worker's candidacy on one job, with the history of its status (the status
// machine is in services/applicationMachine.ts). Times are relative to when the app opens.
const HOUR = 3600000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

const PATH: Record<ApplicationStatus, ApplicationStatus[]> = {
  enviada: ['enviada'],
  em_analise: ['enviada', 'em_analise'],
  pre_selecionado: ['enviada', 'em_analise', 'pre_selecionado'],
  contratado: ['enviada', 'em_analise', 'pre_selecionado', 'contratado'],
  concluida: ['enviada', 'em_analise', 'pre_selecionado', 'contratado', 'concluida'],
  nao_selecionado: ['enviada', 'em_analise', 'nao_selecionado'],
  desistiu: ['enviada', 'em_analise', 'pre_selecionado', 'desistiu'],
  cancelado_pela_construtora: ['enviada', 'em_analise', 'pre_selecionado', 'cancelado_pela_construtora'],
  nao_compareceu: ['enviada', 'em_analise', 'pre_selecionado', 'contratado', 'nao_compareceu']
};
const BY: Record<ApplicationStatus, Actor> = {
  enviada: 'trabalhador',
  em_analise: 'construtora',
  pre_selecionado: 'construtora',
  contratado: 'construtora',
  concluida: 'construtora',
  nao_selecionado: 'construtora',
  desistiu: 'trabalhador',
  cancelado_pela_construtora: 'construtora',
  nao_compareceu: 'construtora'
};

/** A candidacy sent `sentHoursAgo` hours ago that reached `status` (one step every `stepHours`). */
function application(
  id: string,
  jobId: string,
  workerId: string,
  status: ApplicationStatus,
  sentHoursAgo: number,
  { stepHours = 2, workerReviewed = false, companyReviewed = false } = {}
): Application {
  const events: ApplicationEvent[] = PATH[status].map((st, i) => ({
    status: st,
    at: ago(Math.max(0.2, sentHoursAgo - i * stepHours)),
    by: BY[st],
    reason: null
  }));
  const last = events[events.length - 1];
  return {
    id,
    jobId,
    workerId,
    status,
    createdAt: events[0].at,
    statusChangedAt: last.at,
    events,
    autoRejected: false,
    workerReviewed,
    companyReviewed
  };
}

export const APPLICATIONS: Application[] = [
  application('a1', 'BC-4821', 'jorge', 'pre_selecionado', 6, { stepHours: 2.9 }),
  application('a2', 'BC-4821', 'edson', 'em_analise', 20),
  application('a3', 'BC-4821', 'marcos', 'em_analise', 18),
  application('a4', 'BC-4821', 'vitor', 'em_analise', 9),
  application('a5', 'BC-4821', 'caio', 'em_analise', 3),
  application('a6', 'BC-4830', 'jorge', 'em_analise', 30),
  application('a7', 'BC-4835', 'jorge', 'enviada', 26),
  // Hired for a job whose last day has passed: concluded automatically on the first load.
  application('a8', 'BC-4712', 'jorge', 'contratado', 24 * 33, { stepHours: 20 }),
  application('a9', 'BC-4703', 'jorge', 'concluida', 24 * 29, { stepHours: 24 }),
  application('a10', 'BC-4698', 'jorge', 'nao_selecionado', 24 * 38),
  application('a11', 'BC-4998', 'rafael', 'em_analise', 28),
  application('a12', 'BC-4998', 'bruno', 'em_analise', 22),
  application('a13', 'BC-4998', 'joel', 'em_analise', 14),
  application('a14', 'BC-4995', 'nelson', 'em_analise', 40),
  application('a15', 'BC-4995', 'silas', 'em_analise', 8),
  application('a16', 'BC-4960', 'marcos', 'concluida', 24 * 38, { stepHours: 24 }),
  application('a17', 'BC-4918', 'edson', 'concluida', 24 * 41, { stepHours: 24, companyReviewed: true }),
  application('a18', 'BC-4899', 'jorge', 'concluida', 24 * 45, {
    stepHours: 24,
    workerReviewed: true,
    companyReviewed: true
  }),
  application('a19', 'BC-4870', 'antonio', 'concluida', 24 * 50, { stepHours: 24 })
];

// Notices already there when the demo opens (the rest are created by what happens in it).
export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    kind: 'pre_selecionado',
    title: 'Você foi pré-selecionado',
    text: 'Construtora Meridiano quer falar com você sobre Pedreiro de acabamento. O WhatsApp está liberado.',
    workerId: CURRENT_WORKER_ID,
    companyId: null,
    target: '/selecionado/BC-4821',
    createdAt: ago(0.2),
    readAt: null
  },
  {
    id: 'n2',
    kind: 'bico_urgente',
    title: 'Bico urgente perto de você',
    text: 'Pintor na Mooca, hoje às 8h. Valor a combinar.',
    workerId: CURRENT_WORKER_ID,
    companyId: null,
    target: '/vaga/BC-4822',
    createdAt: ago(2),
    readAt: null
  },
  {
    id: 'n3',
    kind: 'avaliar_diaria',
    title: 'Avalie sua diária',
    text: 'Obra Cangaíba · Servente. Conte como foi.',
    workerId: CURRENT_WORKER_ID,
    companyId: null,
    target: '/avaliar/BC-4703',
    createdAt: ago(26),
    readAt: ago(20)
  },
  {
    id: 'n4',
    kind: 'candidatura_em_analise',
    title: 'Candidatura em análise',
    text: 'Obra Vila Prudente está avaliando seu perfil para Servente.',
    workerId: CURRENT_WORKER_ID,
    companyId: null,
    target: '/vaga/BC-4830',
    createdAt: ago(28),
    readAt: ago(27)
  },
  {
    id: 'n5',
    kind: 'novos_candidatos',
    title: '2 novos candidatos',
    text: 'Pedreiro de acabamento · Tatuapé recebeu novas candidaturas.',
    workerId: null,
    companyId: CURRENT_COMPANY_ID,
    target: '/vaga-gerenciar/BC-4821',
    createdAt: ago(0.5),
    readAt: null
  },
  {
    id: 'n6',
    kind: 'novos_candidatos',
    title: 'Nova candidatura',
    text: 'Joel Ribeiro se candidatou para Servente.',
    workerId: null,
    companyId: CURRENT_COMPANY_ID,
    target: '/vaga-gerenciar/BC-4998',
    createdAt: ago(14),
    readAt: null
  },
  {
    id: 'n7',
    kind: 'avaliar_trabalhador',
    title: 'Avalie o trabalhador',
    text: 'Marcos Aurélio concluiu a diária de Pintor.',
    workerId: null,
    companyId: CURRENT_COMPANY_ID,
    target: '/avaliar-trabalhador/BC-4960/marcos',
    createdAt: ago(30),
    readAt: null
  }
];

export const SAVED_JOB_IDS: string[] = ['BC-4841', 'BC-4848', 'BC-4712', 'BC-4698'];

export const REGIOES_TRABALHADOR = [
  'Tatuapé, SP',
  'Mooca, SP',
  'Penha, SP',
  'Vila Prudente, SP',
  'Belém, SP',
  'Vila Formosa, SP'
];
export const ESPECIALIDADES = [
  'Acabamento',
  'Alvenaria',
  'Reboco',
  'Assentamento',
  'Pintura',
  'Elétrica',
  'Hidráulica'
];
export const TIPOS_OBRA = ['Residencial', 'Comercial', 'Reforma', 'Residencial e reforma', 'Industrial'];
export const REGIOES_RECRUTADOR = ['Zona Leste, SP', 'Zona Norte, SP', 'Zona Sul, SP', 'Zona Oeste, SP', 'Centro, SP'];
export const REQUISITOS_OPCOES = [
  'Botina e capacete próprios',
  'Ferramenta própria',
  'Experiência comprovada',
  'Chegar 10 min antes',
  'EPI fornecido pela obra'
];

// Portfolio posts (photo/video of finished work) a worker publishes on their own profile.
// mediaUrl: null renders the same neutral placeholder job photos use elsewhere in the app —
// there's no real uploaded file behind the seed data, only what a real session uploads.
export const WORKER_POSTS: WorkerPost[] = [
  {
    id: 'wp1',
    workerId: 'jorge',
    mediaUrl: null,
    mediaType: 'image',
    caption: 'Reboco e regularização de parede externa, obra em Tatuapé. Dois dias de serviço.',
    date: '2026-09-10'
  },
  {
    id: 'wp2',
    workerId: 'jorge',
    mediaUrl: null,
    mediaType: 'image',
    caption: 'Acabamento em massa corrida antes da pintura. Cliente pediu prazo curto e entreguei em 1 diária.',
    date: '2026-08-22'
  },
  {
    id: 'wp3',
    workerId: 'jorge',
    mediaUrl: null,
    mediaType: 'image',
    caption: 'Assentamento de contrapiso em área externa.',
    date: '2026-08-05'
  }
];
