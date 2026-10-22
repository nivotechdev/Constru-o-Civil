import { TERMS_VERSION } from '../services/legal';
import type {
  Account,
  Actor,
  Application,
  ApplicationEvent,
  ApplicationStatus,
  AppNotification,
  BoostPayment,
  Company,
  DiasKey,
  HomeAddress,
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

/** U51: the demo workers' own addresses (each account sees only its own). */
export const ADDRESSES: Record<string, HomeAddress> = {
  'conta-jorge': {
    cep: '03081-000',
    street: 'Rua Tuiuti',
    neighborhood: 'Tatuapé',
    city: 'São Paulo',
    uf: 'SP',
    lat: -23.5394,
    lon: -46.5747,
    precision: 'rua'
  }
  // U62: companies have no fixed address (each job has its own).
};

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
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: '2025-03-02T13:30:00.000Z',
    workerId: CURRENT_WORKER_ID,
    companyId: null,
    createdAt: '2025-03-02T13:00:00.000Z',
    theme: 'claro'
  },
  'conta-meridiano': {
    id: 'conta-meridiano',
    email: 'empresa@bicos.demo',
    role: 'recrutador',
    document: '18.402.551/0001-47',
    whatsapp: '(11) 98842-3310',
    whatsappVerifiedAt: '2025-03-01T12:10:00.000Z',
    emailConfirmedAt: '2025-03-01T12:20:00.000Z',
    profileCompletedAt: '2025-03-01T12:30:00.000Z',
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: '2025-03-01T12:30:00.000Z',
    workerId: null,
    companyId: CURRENT_COMPANY_ID,
    createdAt: '2025-03-01T12:00:00.000Z',
    theme: 'claro'
  }
};

// ---- places and dates ----
const HOUR = 3600000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

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
    name: 'Eventos Meridiano',
    contactName: 'Ricardo Alves',
    cnpj: '18.402.551/0001-47',
    location: 'Zona Leste, SP',
    whatsapp: '(11) 98842-3310',
    rating: 4.7,
    reviewCount: 31,
    verified: true,
    verification: 'verificada',
    verifiedSince: '12 ago',
    sinceLabel: 'Na Bicos desde março de 2025',
    respondTime: 'Responde em 1h20, em média',
    paidCount: 128,
    about:
      'Empresa de eventos da Zona Leste: casamentos, formaturas e festas de empresa. Pagamos a diária no fim do dia e oferecemos almoço.',
    reviews: [
      {
        id: 'r1',
        applicationId: null,
        direction: 'para_construtora',
        authorLabel: 'Marcos A.',
        value: 5,
        tags: [],
        comment: 'Pagou em PIX no fim da diária, como combinado.',
        createdAt: ago(24 * 23)
      },
      {
        id: 'r2',
        applicationId: null,
        direction: 'para_construtora',
        authorLabel: 'Jorge M.',
        value: 4,
        tags: [],
        comment: 'Evento bem organizado e local seguro. Começou 30 min atrasado.',
        createdAt: ago(24 * 31)
      },
      {
        id: 'r3',
        applicationId: null,
        direction: 'para_construtora',
        authorLabel: 'Edson B.',
        value: 5,
        tags: [],
        comment: 'Já trabalhei com eles três vezes. Sempre no horário certo.',
        createdAt: ago(24 * 38)
      }
    ]
  },
  alvorada: {
    id: 'alvorada',
    name: 'Restaurante Alvorada',
    location: 'Mooca, SP',
    whatsapp: '(11) 97731-4402',
    rating: 4.5,
    reviewCount: 18,
    verified: true,
    verification: 'verificada',
    reviews: [
      {
        id: 'r4',
        applicationId: null,
        direction: 'para_construtora',
        authorLabel: 'Caio N.',
        value: 4,
        tags: [],
        comment: 'Bom serviço, chegou 20 min atrasado.',
        createdAt: ago(24 * 57)
      }
    ]
  },
  'vila-formosa': {
    id: 'vila-formosa',
    name: 'Loja Vila Formosa',
    location: 'Vila Formosa, SP',
    whatsapp: '(11) 96614-2078',
    rating: 4.6,
    reviewCount: 9,
    verified: false,
    verification: 'pendente',
    reviews: []
  },
  'serra-braganca': {
    id: 'serra-braganca',
    name: 'Buffet Serra de Bragança',
    location: 'Tatuapé, SP',
    whatsapp: '(11) 98127-5530',
    rating: 4.8,
    reviewCount: 14,
    verified: true,
    verification: 'verificada',
    reviews: [
      {
        id: 'r5',
        applicationId: null,
        direction: 'para_construtora',
        authorLabel: 'Nelson A.',
        value: 5,
        tags: [],
        comment: 'Equipe educada e tudo bem organizado.',
        createdAt: ago(24 * 34)
      }
    ]
  },
  'vila-prudente': {
    id: 'vila-prudente',
    name: 'Mercado Vila Prudente',
    location: 'Vila Prudente, SP',
    whatsapp: '(11) 95548-9016',
    rating: 4.4,
    reviewCount: 7,
    verified: false,
    verification: 'pendente',
    reviews: [
      {
        id: 'r6',
        applicationId: null,
        direction: 'para_construtora',
        authorLabel: 'Bruno T.',
        value: 5,
        tags: [],
        comment: 'Trabalhador de confiança. Já chamei três vezes.',
        createdAt: ago(24 * 29)
      }
    ]
  },
  belem: {
    id: 'belem',
    name: 'Padaria Belém',
    location: 'Belém, SP',
    whatsapp: '(11) 97402-6621',
    rating: 4.3,
    reviewCount: 5,
    verified: false,
    verification: 'pendente',
    reviews: []
  },
  aricanduva: {
    id: 'aricanduva',
    name: 'Mudanças Aricanduva',
    location: 'Aricanduva, SP',
    whatsapp: '(11) 96280-3147',
    rating: 4.2,
    reviewCount: 4,
    verified: false,
    verification: 'pendente',
    reviews: []
  },
  cangaiba: {
    id: 'cangaiba',
    name: 'Casa de Festas Cangaíba',
    location: 'Cangaíba, SP',
    whatsapp: '(11) 98865-1204',
    rating: 4.3,
    reviewCount: 6,
    verified: false,
    verification: 'pendente',
    reviews: []
  }
};

export const WORKERS: Record<string, Worker> = {
  jorge: {
    id: 'jorge',
    name: 'Jorge Mendes',
    initials: 'JM',
    whatsapp: '(11) 97412-5580',
    ...home('Tatuapé', 'jorge'),
    rating: 4.8,
    reviewCount: 23,
    jobsDone: 23,
    verified: true,
    identity: 'verificado',
    bio: 'Trabalho com eventos há 12 anos: garçom, montagem de salão e apoio na cozinha. Sou pontual e caprichoso.',
    experiences: [
      'Garçom em casamentos e formaturas',
      'Montagem e desmontagem de salão de festas',
      'Apoio na cozinha de buffet'
    ],
    facts: [
      '23 diárias pagas pela plataforma',
      'RG e CPF conferidos em 12 ago',
      'Responde em 40 min, em média',
      'Nunca faltou a uma diária combinada'
    ],
    reviews: [
      {
        id: 'r7',
        applicationId: null,
        direction: 'para_trabalhador',
        authorLabel: 'Mercado Vila Prudente',
        value: 5,
        tags: [],
        comment: 'Trabalhou o dia todo sem reclamar. Deixou a área limpa.',
        createdAt: ago(24 * 42)
      },
      {
        id: 'r8',
        applicationId: null,
        direction: 'para_trabalhador',
        authorLabel: 'Buffet Serra de Bragança',
        value: 5,
        tags: [],
        comment: 'Chegou no horário, serviço bem feito.',
        createdAt: ago(24 * 54)
      },
      {
        id: 'r9',
        applicationId: null,
        direction: 'para_trabalhador',
        authorLabel: 'Eventos Meridiano',
        value: 5,
        tags: [],
        comment: 'Chegou no horário, serviço bem feito. Chamo de novo.',
        createdAt: ago(24 * 28)
      }
    ]
  },
  rafael: {
    id: 'rafael',
    name: 'Rafael Duarte',
    initials: 'RD',
    whatsapp: '(11) 96630-1147',
    ...home('Vila Prudente', 'rafael'),
    rating: 4.5,
    reviewCount: 17,
    jobsDone: 17,
    verified: true,
    identity: 'verificado',
    facts: ['17 diárias pagas pela plataforma', 'RG e CPF conferidos em 5 ago', 'Responde em 55 min, em média'],
    reviews: [
      {
        id: 'r10',
        applicationId: null,
        direction: 'para_trabalhador',
        authorLabel: 'Padaria Belém',
        value: 4,
        tags: [],
        comment: 'Fez o serviço direito. Saiu 20 min mais cedo.',
        createdAt: ago(24 * 37)
      }
    ]
  },
  nelson: {
    id: 'nelson',
    name: 'Nelson Aquino',
    initials: 'NA',
    whatsapp: '(11) 98215-4402',
    ...home('Tatuapé', 'nelson'),
    rating: 4.9,
    reviewCount: 52,
    jobsDone: 52,
    verified: true,
    identity: 'verificado',
    facts: ['52 diárias pagas pela plataforma', 'RG e CPF conferidos em 8 abr', 'Responde em 15 min, em média'],
    reviews: [
      {
        id: 'r11',
        applicationId: null,
        direction: 'para_trabalhador',
        authorLabel: 'Buffet Serra de Bragança',
        value: 5,
        tags: [],
        comment: 'Atendimento impecável. Chegou já de uniforme.',
        createdAt: ago(24 * 34)
      }
    ]
  },
  bruno: {
    id: 'bruno',
    name: 'Bruno Tavares',
    initials: 'BT',
    whatsapp: '(11) 95508-7731',
    ...home('Vila Prudente', 'bruno'),
    rating: 4.8,
    reviewCount: 28,
    jobsDone: 28,
    verified: true,
    identity: 'verificado',
    facts: ['28 diárias pagas pela plataforma', 'RG e CPF conferidos em 15 jun', 'Nunca faltou a uma diária combinada'],
    reviews: [
      {
        id: 'r12',
        applicationId: null,
        direction: 'para_trabalhador',
        authorLabel: 'Mercado Vila Prudente',
        value: 5,
        tags: [],
        comment: 'Trabalhador de confiança. Já chamei três vezes.',
        createdAt: ago(24 * 29)
      }
    ]
  },
  marcos: {
    id: 'marcos',
    name: 'Marcos Aurélio',
    initials: 'MA',
    whatsapp: '(11) 94471-2265',
    ...home('Penha', 'marcos'),
    rating: 4.6,
    reviewCount: 41,
    jobsDone: 41,
    verified: true,
    identity: 'verificado',
    facts: ['41 diárias pagas pela plataforma', 'RG e CPF conferidos em 30 jul', 'Responde em 1h10, em média'],
    reviews: [
      {
        id: 'r13',
        applicationId: null,
        direction: 'para_trabalhador',
        authorLabel: 'Restaurante Alvorada',
        value: 5,
        tags: [],
        comment: 'Pegou no pesado o dia todo. Chamo de novo.',
        createdAt: ago(24 * 35)
      }
    ]
  },
  silas: {
    id: 'silas',
    name: 'Silas Pereira',
    initials: 'SP',
    whatsapp: '(11) 99183-0456',
    ...home('Mooca', 'silas'),
    rating: 0,
    reviewCount: 0,
    jobsDone: 0,
    novo: true,
    verified: false,
    facts: [
      '11 anos de experiência, primeiro bico pela plataforma',
      'Documentos enviados, em conferência',
      'Telefone confirmado por SMS'
    ],
    reviews: []
  },
  vitor: {
    id: 'vitor',
    name: 'Vitor Camargo',
    initials: 'VC',
    whatsapp: '(11) 97726-3398',
    ...home('Tatuapé', 'vitor'),
    rating: 4.7,
    reviewCount: 31,
    jobsDone: 31,
    verified: true,
    identity: 'verificado',
    facts: ['31 diárias pagas pela plataforma', 'RG e CPF conferidos em 21 jul', 'Responde em 35 min, em média'],
    reviews: [
      {
        id: 'r14',
        applicationId: null,
        direction: 'para_trabalhador',
        authorLabel: 'Padaria Belém',
        value: 5,
        tags: [],
        comment: 'Serviço limpo e no prazo combinado.',
        createdAt: ago(24 * 44)
      }
    ]
  },
  caio: {
    id: 'caio',
    name: 'Caio Nogueira',
    initials: 'CN',
    whatsapp: '(11) 96052-8814',
    ...home('Penha', 'caio'),
    rating: 4.2,
    reviewCount: 9,
    jobsDone: 9,
    verified: true,
    identity: 'verificado',
    facts: ['9 diárias pagas pela plataforma', 'RG e CPF conferidos em 2 set', 'Faltou a 1 diária combinada em julho'],
    reviews: [
      {
        id: 'r15',
        applicationId: null,
        direction: 'para_trabalhador',
        authorLabel: 'Restaurante Alvorada',
        value: 4,
        tags: [],
        comment: 'Bom serviço, chegou 20 min atrasado.',
        createdAt: ago(24 * 57)
      }
    ]
  },
  edson: {
    id: 'edson',
    name: 'Edson Batista',
    initials: 'EB',
    whatsapp: '(11) 98840-1173',
    ...home('Belém', 'edson'),
    rating: 4.9,
    reviewCount: 64,
    jobsDone: 64,
    verified: true,
    identity: 'verificado',
    facts: ['64 diárias pagas pela plataforma', 'RG e CPF conferidos em 4 mar', 'Responde em 25 min, em média'],
    reviews: [
      {
        id: 'r16',
        applicationId: null,
        direction: 'para_trabalhador',
        authorLabel: 'Eventos Meridiano',
        value: 5,
        tags: [],
        comment: 'Já trabalhou com a gente três vezes. Sempre pontual.',
        createdAt: ago(24 * 38)
      }
    ]
  },
  joel: {
    id: 'joel',
    name: 'Joel Ribeiro',
    initials: 'JR',
    whatsapp: '(11) 95317-6629',
    ...home('Belém', 'joel'),
    rating: 0,
    reviewCount: 0,
    jobsDone: 0,
    novo: true,
    verified: false,
    facts: [
      '6 anos de experiência, primeiro bico pela plataforma',
      'Documentos enviados, em conferência',
      'Telefone confirmado por SMS'
    ],
    reviews: []
  },
  antonio: {
    id: 'antonio',
    name: 'Antônio Ferraz',
    initials: 'AF',
    whatsapp: '(11) 94208-5590',
    ...home('Vila Prudente', 'antonio'),
    rating: 4.6,
    reviewCount: 19,
    jobsDone: 19,
    verified: true,
    identity: 'verificado',
    facts: ['19 diárias pagas pela plataforma', 'RG e CPF conferidos em 3 mai'],
    reviews: []
  }
};

// pay: number = fixed R$/diária. pay: null = "A combinar".
export const JOBS: Record<string, Job> = {
  'BC-4821': {
    id: 'BC-4821',
    companyId: 'meridiano',
    oficioId: 'garcom',
    title: 'Garçom para casamento',
    pay: 220,
    address: addr('Tatuapé', 'Rua Serra de Bragança', '1240', 'BC-4821'),
    ...span(0, 1, 'qualquer'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'qualquer',
    urgent: true,
    boostEndsAt: ago(-20),
    photos: [],
    slots: 4,
    description:
      'Servir as mesas num casamento de 150 convidados e ajudar na montagem do salão antes da festa. Almoço e uniforme por nossa conta.',
    payment: 'pix_dia',
    requirements: ['Experiência como garçom', 'Calça preta e sapato fechado', 'Chegar 10 minutos antes']
  },
  'BC-4822': {
    id: 'BC-4822',
    companyId: 'alvorada',
    oficioId: 'cozinha',
    title: 'Auxiliar de cozinha',
    pay: null,
    address: addr('Mooca', 'Rua da Mooca', '3180', 'BC-4822'),
    ...span(0, 1, 'qualquer'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'qualquer',
    urgent: true,
    photos: [],
    slots: 1,
    description: 'Ajudar no preparo do almoço de um restaurante: cortar legumes, montar os pratos e lavar a louça.',
    payment: 'pix_dia',
    requirements: ['Experiência em cozinha', 'Touca e avental fornecidos', 'Cabelo preso']
  },
  'BC-4855': {
    id: 'BC-4855',
    companyId: 'vila-formosa',
    oficioId: 'vendas',
    title: 'Vendedor para loja de roupas',
    pay: null,
    address: addr('Vila Formosa', 'Rua Vila Formosa', '210', 'BC-4855'),
    ...span(6, 1, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Atender os clientes, organizar as araras e ajudar no caixa durante a semana de liquidação.',
    payment: 'pix_dia',
    requirements: ['Gostar de atender pessoas', 'Saber fazer troco', 'Combine o valor direto com a empresa']
  },
  'BC-4830': {
    id: 'BC-4830',
    companyId: 'vila-prudente',
    oficioId: 'estoque',
    title: 'Repositor de mercado',
    pay: 150,
    address: addr('Vila Prudente', 'Av. Vila Ema', '2790', 'BC-4830'),
    ...span(2, 2, 'semana'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'semana',
    slots: 1,
    description: 'Repor as prateleiras, conferir a validade dos produtos e organizar o estoque ao fim do expediente.',
    payment: 'pix_dia',
    requirements: ['Repor prateleiras e organizar o estoque', 'Sapato fechado', 'Uniforme fornecido pela empresa']
  },
  'BC-4835': {
    id: 'BC-4835',
    companyId: 'serra-braganca',
    oficioId: 'garcom',
    title: 'Copeiro para buffet',
    pay: 260,
    address: addr('Tatuapé', 'Rua Serra de Bragança', '640', 'BC-4835'),
    ...span(3, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Montar a copa, servir bebidas e repor o buffet numa festa de formatura.',
    payment: 'pix_dia',
    requirements: ['Experiência com buffet', 'Roupa preta', 'Uniforme fornecido pela empresa']
  },
  'BC-4841': {
    id: 'BC-4841',
    companyId: 'meridiano',
    oficioId: 'eventos',
    title: 'Montagem de feira',
    pay: 240,
    address: addr('Penha', 'Rua Cantagalo', '890', 'BC-4841'),
    ...span(4, 3, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Montar e desmontar mesas, cadeiras e a decoração de uma feira de três dias.',
    payment: 'pix_dia',
    requirements: ['Montagem de mesas e decoração', 'Sapato fechado e luva própria', 'Disposição para pegar peso']
  },
  'BC-4848': {
    id: 'BC-4848',
    companyId: 'belem',
    oficioId: 'mudanca',
    title: 'Ajudante de carga e descarga',
    pay: 140,
    address: addr('Belém', 'Rua Padre Adelino', '410', 'BC-4848'),
    ...span(5, 1, 'fimdesemana'),
    startTime: '08:00',
    endTime: '14:00',
    dias: 'fimdesemana',
    slots: 1,
    description: 'Descarregar um caminhão de farinha e organizar no depósito. Serviço de meio período.',
    payment: 'pix_dia',
    requirements: ['Descarregar caminhão', 'Sapato fechado', 'Sem experiência exigida']
  },
  'BC-4998': {
    id: 'BC-4998',
    companyId: 'meridiano',
    oficioId: 'estoque',
    title: 'Repositor de estoque',
    pay: 150,
    address: addr('Vila Prudente', 'Av. Vila Ema', '2790', 'BC-4998'),
    ...span(2, 2, 'semana'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'semana',
    slots: 2,
    description: 'Separar e organizar o material dos eventos no depósito e limpar o espaço ao fim do expediente.',
    payment: 'pix_dia',
    requirements: ['Organizar o depósito', 'Sapato fechado']
  },
  'BC-4995': {
    id: 'BC-4995',
    companyId: 'meridiano',
    oficioId: 'eventos',
    title: 'Recepcionista de evento',
    pay: 260,
    address: addr('Tatuapé', 'Rua Serra de Bragança', '640', 'BC-4995'),
    ...span(3, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Receber os convidados de uma festa de empresa, conferir a lista e indicar as mesas.',
    payment: 'pix_dia',
    requirements: ['Experiência com recepção', 'Roupa social']
  },
  'BC-5010': {
    id: 'BC-5010',
    companyId: 'alvorada',
    oficioId: 'garcom',
    title: 'Garçom para almoço executivo',
    pay: 250,
    address: addr('Mooca', 'Rua Taquari', '1180', 'BC-5010'),
    ...span(1, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    urgent: true,
    photos: [],
    slots: 1,
    description: 'Atender as mesas no almoço de um restaurante movimentado, de segunda a sexta.',
    payment: 'pix_dia',
    requirements: ['Experiência como garçom', 'Calça preta', 'Uniforme fornecido pela empresa']
  },
  'BC-5011': {
    id: 'BC-5011',
    companyId: 'serra-braganca',
    oficioId: 'baba',
    title: 'Recreador para colônia de férias',
    pay: 200,
    address: addr('Tatuapé', 'Rua Tuiuti', '2210', 'BC-5011'),
    ...span(7, 2, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 2,
    description: 'Brincar com as crianças e organizar as atividades numa colônia de férias.',
    payment: 'pix_dia',
    requirements: ['Experiência com crianças', 'Animação e paciência', 'Camiseta fornecida pela empresa']
  },
  'BC-5012': {
    id: 'BC-5012',
    companyId: 'vila-prudente',
    oficioId: 'limpeza',
    title: 'Limpeza urgente no mercado',
    pay: null,
    address: addr('Vila Prudente', 'Rua Ibitirama', '845', 'BC-5012'),
    ...span(0, 1, 'qualquer'),
    startTime: '09:00',
    endTime: '18:00',
    dias: 'qualquer',
    urgent: true,
    slots: 1,
    description: 'Limpar o piso e os corredores depois de um vazamento no freezer, hoje até as 18h.',
    payment: 'pix_dia',
    requirements: ['Experiência com limpeza', 'Material de limpeza fornecido']
  },
  'BC-5013': {
    id: 'BC-5013',
    companyId: 'belem',
    oficioId: 'vendas',
    title: 'Atendente de padaria',
    pay: 150,
    address: addr('Belém', 'Rua Siqueira Bueno', '1320', 'BC-5013'),
    ...span(8, 1, 'fimdesemana'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'fimdesemana',
    slots: 2,
    description: 'Atender no balcão e repor os pães e os doces no fim de semana.',
    payment: 'pix_dia',
    requirements: ['Simpatia no atendimento', 'Touca e avental fornecidos']
  },
  'BC-5014': {
    id: 'BC-5014',
    companyId: 'alvorada',
    oficioId: 'cozinha',
    title: 'Cozinheiro para eventos',
    pay: 280,
    address: addr('Mooca', 'Rua Javari', '540', 'BC-5014'),
    ...toArrange(2),
    startTime: null,
    endTime: null,
    dias: 'semana',
    photos: [],
    slots: 1,
    description: 'Preparar os pratos quentes de dois eventos do restaurante, em datas a combinar.',
    payment: 'pix_dia',
    requirements: ['Experiência em cozinha industrial', 'Facas próprias']
  },
  'BC-5015': {
    id: 'BC-5015',
    companyId: 'vila-formosa',
    oficioId: 'vendas',
    title: 'Promotor de vendas',
    pay: 260,
    address: addr('Vila Formosa', 'Av. Renata', '910', 'BC-5015'),
    ...span(10, 3, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 2,
    description: 'Apresentar produtos aos clientes e distribuir amostras na semana de inauguração da loja.',
    payment: 'pix_dia',
    requirements: ['Gostar de falar com o público', 'Roupa social']
  },
  'BC-5016': {
    id: 'BC-5016',
    companyId: 'cangaiba',
    oficioId: 'jardinagem',
    title: 'Jardineiro para casa de festas',
    pay: 230,
    address: addr('Cangaíba', 'Rua Pedro Álvares', '77', 'BC-5016'),
    ...span(1, 2, 'qualquer'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'qualquer',
    photos: [],
    slots: 1,
    description: 'Cortar a grama, podar as plantas e limpar o jardim da casa de festas, cerca de 500 m².',
    payment: 'pix_dia',
    requirements: ['Experiência com jardinagem', 'Cortador de grama fornecido']
  },
  'BC-5017': {
    id: 'BC-5017',
    companyId: 'aricanduva',
    oficioId: 'mudanca',
    title: 'Ajudante de mudança',
    pay: 130,
    address: addr('Aricanduva', 'Rua Olga Fadel Abarca', '300', 'BC-5017'),
    ...span(0, 1, 'qualquer'),
    startTime: '08:00',
    endTime: '14:00',
    dias: 'qualquer',
    urgent: true,
    slots: 1,
    description: 'Carregar móveis e caixas numa mudança de apartamento, com elevador.',
    payment: 'pix_dia',
    requirements: ['Sem experiência exigida', 'Sapato fechado']
  },
  'BC-5018': {
    id: 'BC-5018',
    companyId: 'serra-braganca',
    oficioId: 'cozinha',
    title: 'Auxiliar de cozinha para buffet',
    pay: 240,
    address: addr('Tatuapé', 'Rua Apucarana', '1450', 'BC-5018'),
    ...span(11, 2, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Preparar salgados e montar as bandejas para dois eventos do buffet.',
    payment: 'pix_dia',
    requirements: ['Experiência com salgados', 'Touca e avental fornecidos']
  },
  'BC-5019': {
    id: 'BC-5019',
    companyId: 'vila-prudente',
    oficioId: 'vendas',
    title: 'Caixa de mercado',
    pay: 190,
    address: addr('Vila Prudente', 'Av. Paes de Barros', '3100', 'BC-5019'),
    ...toArrange(1),
    startTime: null,
    endTime: null,
    dias: 'qualquer',
    slots: 1,
    description: 'Trabalhar no caixa num dia de promoção, em data a combinar.',
    payment: 'pix_dia',
    requirements: ['Experiência como caixa', 'Uniforme fornecido pela empresa']
  },
  'BC-5020': {
    id: 'BC-5020',
    companyId: 'belem',
    oficioId: 'entregas',
    title: 'Entregador de pães',
    pay: null,
    address: addr('Belém', 'Av. Álvaro Ramos', '890', 'BC-5020'),
    ...span(9, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Entregar os pedidos de café da manhã no bairro, de bicicleta ou moto.',
    payment: 'pix_dia',
    requirements: ['Bicicleta ou moto própria', 'Conhecer o bairro']
  },
  'BC-5021': {
    id: 'BC-5021',
    companyId: 'alvorada',
    oficioId: 'garcom',
    title: 'Líder de equipe de salão',
    pay: 380,
    address: addr('Mooca', 'Rua dos Trilhos', '1600', 'BC-5021'),
    ...toArrange(5),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Coordenar uma equipe de quatro garçons na reabertura do restaurante.',
    payment: 'pix_dia',
    requirements: ['Experiência como líder de equipe', 'Saber organizar escalas']
  },
  'BC-5022': {
    id: 'BC-5022',
    companyId: 'cangaiba',
    oficioId: 'limpeza',
    title: 'Limpeza pós-festa',
    pay: 140,
    address: addr('Cangaíba', 'Rua Dr. Assis Ribeiro', '2200', 'BC-5022'),
    ...span(0, 1, 'qualquer'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'qualquer',
    urgent: true,
    slots: 2,
    description: 'Limpar o salão, os banheiros e a cozinha depois de uma festa de sábado.',
    payment: 'pix_dia',
    requirements: ['Sapato fechado']
  },
  'BC-5023': {
    id: 'BC-5023',
    companyId: 'vila-formosa',
    oficioId: 'estoque',
    title: 'Embalador para loja',
    pay: 220,
    address: addr('Vila Formosa', 'Rua Itapeti', '60', 'BC-5023'),
    ...span(8, 1, 'fimdesemana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'fimdesemana',
    slots: 1,
    description: 'Embalar os pedidos da loja virtual no fim de semana.',
    payment: 'pix_dia',
    requirements: ['Atenção aos detalhes', 'Material fornecido pela empresa']
  },
  'BC-5024': {
    id: 'BC-5024',
    companyId: 'serra-braganca',
    oficioId: 'garcom',
    title: 'Garçom para formatura',
    pay: 240,
    address: addr('Tatuapé', 'Rua Cantagalo', '1220', 'BC-5024'),
    ...span(10, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    description: 'Servir bebidas e salgados numa festa de formatura de 300 pessoas.',
    payment: 'pix_dia',
    requirements: ['Experiência como garçom', 'Roupa preta']
  },
  'BC-5025': {
    id: 'BC-5025',
    companyId: 'meridiano',
    oficioId: 'eventos',
    title: 'Controle de entrada em evento',
    pay: 250,
    address: addr('Penha', 'Rua Padre João', '480', 'BC-5025'),
    ...span(11, 1, 'semana'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'semana',
    slots: 2,
    description: 'Controlar a entrada dos convidados e entregar as pulseiras num show do bairro.',
    payment: 'pix_dia',
    requirements: ['Experiência com público', 'Colete fornecido pela empresa']
  },
  'BC-5026': {
    id: 'BC-5026',
    companyId: 'meridiano',
    oficioId: 'limpeza',
    title: 'Limpeza de salão de eventos',
    pay: 210,
    address: addr('Tatuapé', 'Rua Itapura', '900', 'BC-5026'),
    ...span(7, 2, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 3,
    description: 'Limpar o salão de eventos e os banheiros entre duas festas.',
    payment: 'pix_dia',
    requirements: ['Experiência com limpeza', 'Material de limpeza fornecido']
  },
  // closed / historical
  'BC-4712': {
    id: 'BC-4712',
    companyId: 'aricanduva',
    oficioId: 'mudanca',
    title: 'Ajudante de mudança',
    pay: 140,
    address: addr('Aricanduva', 'Av. Aricanduva', '5200', 'BC-4712'),
    ...span(-30, 1, 'semana'),
    startTime: '08:00',
    endTime: '14:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Carregar móveis e caixas numa mudança de casa.',
    payment: 'pix_dia',
    requirements: ['Carregar móveis', 'Sapato fechado']
  },
  'BC-4703': {
    id: 'BC-4703',
    companyId: 'cangaiba',
    oficioId: 'limpeza',
    title: 'Limpeza de salão',
    pay: 150,
    address: addr('Cangaíba', 'Rua Cachoeira Tijuco Preto', '75', 'BC-4703'),
    ...span(-26, 1, 'fimdesemana'),
    startTime: '08:00',
    endTime: '14:00',
    dias: 'fimdesemana',
    slots: 1,
    closed: true,
    description: 'Limpeza geral do salão e organização das mesas durante a diária.',
    payment: 'pix_dia',
    requirements: ['Limpeza de salão e organização das mesas', 'Sapato fechado']
  },
  'BC-4698': {
    id: 'BC-4698',
    companyId: 'alvorada',
    oficioId: 'cozinha',
    title: 'Auxiliar de cozinha',
    pay: 190,
    address: addr('Mooca', 'Rua da Mooca', '3180', 'BC-4698'),
    ...span(-35, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Ajudar no preparo do almoço e lavar a louça.',
    payment: 'pix_dia',
    requirements: ['Experiência em cozinha', 'Touca fornecida']
  },
  'BC-4960': {
    id: 'BC-4960',
    companyId: 'meridiano',
    oficioId: 'garcom',
    title: 'Garçom para aniversário',
    pay: 190,
    address: addr('Mooca', 'Rua da Mooca', '3180', 'BC-4960'),
    ...span(-35, 1, 'semana'),
    startTime: '08:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Servir as mesas numa festa de aniversário de 80 pessoas.',
    payment: 'pix_dia',
    requirements: ['Experiência como garçom', 'Roupa preta']
  },
  'BC-4944': {
    id: 'BC-4944',
    companyId: 'meridiano',
    oficioId: 'eventos',
    title: 'Montagem de estandes',
    pay: 240,
    address: addr('Penha', 'Rua Cantagalo', '890', 'BC-4944'),
    ...span(-41, 3, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 2,
    closed: true,
    semContratacao: true,
    description: 'Montar e desmontar os estandes de uma feira de três dias.',
    payment: 'pix_dia',
    requirements: ['Montagem de estandes']
  },
  'BC-4918': {
    id: 'BC-4918',
    companyId: 'meridiano',
    oficioId: 'garcom',
    title: 'Garçom para casamento',
    pay: 220,
    address: addr('Tatuapé', 'Rua Serra de Bragança', '1240', 'BC-4918'),
    ...span(-38, 1, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Servir as mesas num casamento de 120 convidados.',
    payment: 'pix_dia',
    requirements: ['Experiência como garçom']
  },
  'BC-4899': {
    id: 'BC-4899',
    companyId: 'meridiano',
    oficioId: 'garcom',
    title: 'Copeiro para evento',
    pay: 220,
    address: addr('Tatuapé', 'Rua Serra de Bragança', '1240', 'BC-4899'),
    ...span(-42, 1, 'semana'),
    startTime: '07:00',
    endTime: '17:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Montar a copa e servir bebidas numa festa de empresa.',
    payment: 'pix_dia',
    requirements: ['Experiência com copa']
  },
  'BC-4870': {
    id: 'BC-4870',
    companyId: 'meridiano',
    oficioId: 'estoque',
    title: 'Repositor de estoque',
    pay: 150,
    address: addr('Vila Prudente', 'Av. Vila Ema', '2790', 'BC-4870'),
    ...span(-47, 1, 'semana'),
    startTime: '07:00',
    endTime: '16:00',
    dias: 'semana',
    slots: 1,
    closed: true,
    description: 'Organizar o material dos eventos no depósito e limpar o espaço ao fim do expediente.',
    payment: 'pix_dia',
    requirements: ['Organizar o depósito']
  }
};

// When each job was published: two days before its first day (or two days ago when the date is to be
// arranged, so those stay up for the 30 days of Y04 in the demo too).
for (const job of Object.values(JOBS)) {
  const start = job.startDate ? new Date(job.startDate + 'T09:00:00').getTime() : Date.now();
  job.createdAt = new Date(Math.min(start, Date.now()) - 48 * HOUR).toISOString();
}

// One application = one worker's candidacy on one job, with the history of its status (the status
// machine is in services/applicationMachine.ts). Times are relative to when the app opens.

const PATH: Record<ApplicationStatus, ApplicationStatus[]> = {
  enviada: ['enviada'],
  em_analise: ['enviada', 'em_analise'],
  pre_selecionado: ['enviada', 'em_analise', 'pre_selecionado'],
  contratado: ['enviada', 'em_analise', 'pre_selecionado', 'contratado'],
  concluida: ['enviada', 'em_analise', 'pre_selecionado', 'contratado', 'concluida'],
  nao_selecionado: ['enviada', 'em_analise', 'nao_selecionado'],
  desistiu: ['enviada', 'em_analise', 'pre_selecionado', 'desistiu'],
  cancelado_pela_construtora: ['enviada', 'em_analise', 'pre_selecionado', 'cancelado_pela_construtora'],
  nao_compareceu: ['enviada', 'em_analise', 'pre_selecionado', 'contratado', 'nao_compareceu'],
  expirada: ['enviada', 'em_analise', 'pre_selecionado', 'expirada'],
  cancelado_pela_equipe: ['enviada', 'em_analise', 'pre_selecionado', 'cancelado_pela_equipe']
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
  nao_compareceu: 'construtora',
  expirada: 'sistema',
  cancelado_pela_equipe: 'sistema'
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
    text: 'Eventos Meridiano quer falar com você sobre Garçom para casamento. O WhatsApp está liberado.',
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
    text: 'Auxiliar de cozinha na Mooca, hoje às 8h. Valor a combinar.',
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
    text: 'Casa de Festas Cangaíba · Limpeza de salão. Conte como foi.',
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
    text: 'Mercado Vila Prudente está avaliando seu perfil para Repositor de mercado.',
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
    text: 'Garçom para casamento · Tatuapé recebeu novas candidaturas.',
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
    text: 'Joel Ribeiro se candidatou para Repositor de estoque.',
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
    text: 'Marcos Aurélio concluiu a diária de Garçom para aniversário.',
    workerId: null,
    companyId: CURRENT_COMPANY_ID,
    target: '/avaliar-trabalhador/BC-4960/marcos',
    createdAt: ago(30),
    readAt: null
  }
];

// The demo's one boosted job was paid by PIX a few hours ago (24h plan).
export const BOOST_PAYMENTS: BoostPayment[] = [
  {
    id: 'pg1',
    jobId: 'BC-4821',
    companyId: CURRENT_COMPANY_ID,
    plan: '24h',
    method: 'pix',
    amountCents: 1200,
    status: 'confirmado',
    pixCode: null,
    cardLast4: null,
    createdAt: ago(4.1),
    expiresAt: null,
    confirmedAt: ago(4),
    boostEndsAt: ago(-20)
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
export const REGIOES_RECRUTADOR = ['Zona Leste, SP', 'Zona Norte, SP', 'Zona Sul, SP', 'Zona Oeste, SP', 'Centro, SP'];
export const REQUISITOS_OPCOES = [
  'Sapato fechado',
  'Uniforme próprio',
  'Experiência comprovada',
  'Chegar 10 min antes',
  'Uniforme fornecido pela empresa'
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
    caption: 'Montagem do salão e serviço de mesa num casamento no Tatuapé. Dois dias de trabalho.',
    date: '2026-09-10'
  },
  {
    id: 'wp2',
    workerId: 'jorge',
    mediaUrl: null,
    mediaType: 'image',
    caption: 'Garçom numa formatura de 300 pessoas. O cliente elogiou o atendimento.',
    date: '2026-08-22'
  },
  {
    id: 'wp3',
    workerId: 'jorge',
    mediaUrl: null,
    mediaType: 'image',
    caption: 'Apoio na cozinha de um buffet de aniversário.',
    date: '2026-08-05'
  }
];
