// Mock marketplace data. In production this is an API — here it seeds the in-memory
// store (see store.js), which is the single source of truth every screen reads from,
// so the same job/candidate/company record renders identically wherever it's used.

export const CURRENT_COMPANY_ID = 'meridiano';
export const CURRENT_WORKER_ID = 'jorge';

export const COMPANIES = {
  meridiano: {
    id: 'meridiano', name: 'Construtora Meridiano',
    cnpj: '18.402.551/0001-07', tipoObra: 'Residencial e reforma', location: 'Zona Leste, SP',
    whatsapp: '(11) 98842-3310', rating: 4.7, reviewCount: 31,
    verified: true, verifiedSince: '12 ago', sinceLabel: 'Na Bicos desde março de 2025',
    respondTime: 'Responde em 1h20, em média', paidCount: 128,
    reviews: [
      { author: 'Marcos A. · servente', value: 5, text: 'Pagou em PIX no fim da diária, como combinado.', date: '2 set' },
      { author: 'Jorge M. · pedreiro', value: 4, text: 'Obra organizada e EPI no local. Começou 30 min atrasado.', date: '25 ago' },
      { author: 'Edson B. · pedreiro', value: 5, text: 'Já trabalhei com eles três vezes. Sempre no horário certo.', date: '18 ago' }
    ]
  },
  alvorada: { id: 'alvorada', name: 'Construtora Alvorada', location: 'Mooca, SP', whatsapp: '(11) 97731-4402', rating: 4.5, reviewCount: 18, verified: true,
    reviews: [{ author: 'Caio N. · pedreiro', value: 4, text: 'Bom acabamento, chegou 20 min atrasado.', date: '30 jul' }] },
  'vila-formosa': { id: 'vila-formosa', name: 'Instalações Vila Formosa', location: 'Vila Formosa, SP', whatsapp: '(11) 96614-2078', rating: 4.6, reviewCount: 9, verified: false, reviews: [] },
  'serra-braganca': { id: 'serra-braganca', name: 'Reforma Serra de Bragança', location: 'Tatuapé, SP', whatsapp: '(11) 98127-5530', rating: 4.8, reviewCount: 14, verified: true,
    reviews: [{ author: 'Nelson A. · azulejista', value: 5, text: 'Assentamento impecável, obra organizada.', date: '22 ago' }] },
  'vila-prudente': { id: 'vila-prudente', name: 'Obra Vila Prudente', location: 'Vila Prudente, SP', whatsapp: '(11) 95548-9016', rating: 4.4, reviewCount: 7, verified: false,
    reviews: [{ author: 'Bruno T. · servente', value: 5, text: 'Trabalhador de confiança. Já chamei três vezes.', date: '27 ago' }] },
  belem: { id: 'belem', name: 'Obra Belém', location: 'Belém, SP', whatsapp: '(11) 97402-6621', rating: 4.3, reviewCount: 5, verified: false, reviews: [] },
  aricanduva: { id: 'aricanduva', name: 'Obra Aricanduva', location: 'Aricanduva, SP', whatsapp: '(11) 96280-3147', rating: 4.2, reviewCount: 4, verified: false, reviews: [] },
  cangaiba: { id: 'cangaiba', name: 'Obra Cangaíba', location: 'Cangaíba, SP', whatsapp: '(11) 98865-1204', rating: 4.3, reviewCount: 6, verified: false, reviews: [] }
};

export const WORKERS = {
  jorge: { id: 'jorge', name: 'Jorge Mendes', initials: 'JM', role: 'Pedreiro de acabamento', region: 'Tatuapé, SP', distance: '3,2 km', rating: 4.8, jobsDone: 23, verified: true, specialties: ['Acabamento', 'Alvenaria', 'Reboco', 'Assentamento'],
    facts: ['23 diárias pagas pela plataforma', 'RG e CPF conferidos em 12 ago', 'Responde em 40 min, em média', 'Nunca faltou a uma diária combinada'],
    reviews: [
      { company: 'Obra Vila Prudente', value: 5, text: 'Trabalhou o dia todo sem reclamar. Deixou a área limpa.', date: '14 ago' },
      { company: 'Reforma Serra de Bragança', value: 5, text: 'Chegou no horário, acabamento bem feito.', date: '2 ago' },
      { company: 'Construtora Meridiano', value: 5, text: 'Chegou no horário, acabamento bem feito. Chamo de novo.', date: '28 ago' }
    ] },
  rafael: { id: 'rafael', name: 'Rafael Duarte', initials: 'RD', role: 'Servente de obra', region: 'Vila Prudente, SP', distance: '1,8 km', rating: 4.5, jobsDone: 17, verified: true, specialties: ['Carga de material', 'Limpeza de obra'],
    facts: ['17 diárias pagas pela plataforma', 'RG e CPF conferidos em 5 ago', 'Responde em 55 min, em média'],
    reviews: [{ company: 'Obra Belém', value: 4, text: 'Fez o serviço direito. Saiu 20 min mais cedo.', date: '19 ago' }] },
  nelson: { id: 'nelson', name: 'Nelson Aquino', initials: 'NA', role: 'Azulejista', region: 'Tatuapé, SP', distance: '1,6 km', rating: 4.9, jobsDone: 52, verified: true, specialties: ['Porcelanato 60x60', 'Rejunte', 'Nivelamento'],
    facts: ['52 diárias pagas pela plataforma', 'RG e CPF conferidos em 8 abr', 'Responde em 15 min, em média'],
    reviews: [{ company: 'Reforma Serra de Bragança', value: 5, text: 'Assentamento impecável. Levou as próprias ferramentas.', date: '22 ago' }] },
  bruno: { id: 'bruno', name: 'Bruno Tavares', initials: 'BT', role: 'Servente de obra', region: 'Vila Prudente, SP', distance: '2,9 km', rating: 4.8, jobsDone: 28, verified: true, specialties: ['Carga de material', 'Massa'],
    facts: ['28 diárias pagas pela plataforma', 'RG e CPF conferidos em 15 jun', 'Nunca faltou a uma diária combinada'],
    reviews: [{ company: 'Obra Vila Prudente', value: 5, text: 'Trabalhador de confiança. Já chamei três vezes.', date: '27 ago' }] },
  marcos: { id: 'marcos', name: 'Marcos Aurélio', initials: 'MA', role: 'Servente e ajudante', region: 'Penha, SP', distance: '5,1 km', rating: 4.6, jobsDone: 41, verified: true, specialties: ['Carga de material', 'Limpeza de obra', 'Massa'],
    facts: ['41 diárias pagas pela plataforma', 'RG e CPF conferidos em 30 jul', 'Responde em 1h10, em média'],
    reviews: [{ company: 'Construtora Alvorada', value: 5, text: 'Pegou no pesado o dia todo. Chamo de novo.', date: '21 ago' }] },
  silas: { id: 'silas', name: 'Silas Pereira', initials: 'SP', role: 'Azulejista', region: 'Mooca, SP', distance: '2,4 km', rating: 0, jobsDone: 0, novo: true, verified: false, specialties: ['Porcelanato', 'Rejunte'],
    facts: ['11 anos de obra, primeiro bico pela plataforma', 'Documentos enviados, em conferência', 'Telefone confirmado por SMS'], reviews: [] },
  vitor: { id: 'vitor', name: 'Vitor Camargo', initials: 'VC', role: 'Pedreiro', region: 'Tatuapé, SP', distance: '2,1 km', rating: 4.7, jobsDone: 31, verified: true, specialties: ['Reboco', 'Contrapiso'],
    facts: ['31 diárias pagas pela plataforma', 'RG e CPF conferidos em 21 jul', 'Responde em 35 min, em média'],
    reviews: [{ company: 'Obra Belém', value: 5, text: 'Serviço limpo e no prazo combinado.', date: '12 ago' }] },
  caio: { id: 'caio', name: 'Caio Nogueira', initials: 'CN', role: 'Pedreiro de acabamento', region: 'Penha, SP', distance: '7,4 km', rating: 4.2, jobsDone: 9, verified: true, specialties: ['Massa corrida', 'Acabamento'],
    facts: ['9 diárias pagas pela plataforma', 'RG e CPF conferidos em 2 set', 'Faltou a 1 diária combinada em julho'],
    reviews: [{ company: 'Construtora Alvorada', value: 4, text: 'Bom acabamento, chegou 20 min atrasado.', date: '30 jul' }] },
  edson: { id: 'edson', name: 'Edson Batista', initials: 'EB', role: 'Pedreiro', region: 'Belém, SP', distance: '6,8 km', rating: 4.9, jobsDone: 64, verified: true, specialties: ['Alvenaria estrutural', 'Contrapiso', 'Reboco'],
    facts: ['64 diárias pagas pela plataforma', 'RG e CPF conferidos em 4 mar', 'Responde em 25 min, em média'],
    reviews: [{ company: 'Construtora Meridiano', value: 5, text: 'Já trabalhou com a gente três vezes. Sempre pontual.', date: '18 ago' }] },
  joel: { id: 'joel', name: 'Joel Ribeiro', initials: 'JR', role: 'Ajudante geral', region: 'Belém, SP', distance: '6,1 km', rating: 0, jobsDone: 0, novo: true, verified: false, specialties: ['Carga de material'],
    facts: ['6 anos de obra, primeiro bico pela plataforma', 'Documentos enviados, em conferência', 'Telefone confirmado por SMS'], reviews: [] },
  antonio: { id: 'antonio', name: 'Antônio Ferraz', initials: 'AF', role: 'Servente de obra', region: 'Vila Prudente, SP', distance: '4,0 km', rating: 4.6, jobsDone: 19, verified: true, specialties: ['Carga de material', 'Limpeza de obra'],
    facts: ['19 diárias pagas pela plataforma', 'RG e CPF conferidos em 3 mai'], reviews: [] }
};

// pay: number = fixed R$/diária. pay: null = "A combinar".
export const JOBS = {
  'BC-4821': { id: 'BC-4821', companyId: 'meridiano', role: 'Pedreiro de acabamento', pay: 220, location: 'Tatuapé, SP', address: 'Rua Serra de Bragança, 1240', distance: '3,2 km', date: 'Hoje', hours: '7h–17h', duration: '1 diária, com 1h de almoço', dias: 'semana', urgent: true, boosted: true, photos: ['img/jobs/pedreiro-2.jpg', 'img/jobs/pedreiro-1.jpg', 'img/jobs/pedreiro-3.jpg'], slots: 4,
    description: 'Reboco e regularização de duas paredes externas e acabamento em massa corrida numa reforma residencial. Material já está no canteiro.',
    requirements: ['Experiência com reboco e massa corrida', 'Botina e capacete próprios', 'Chegar 10 minutos antes'] },
  'BC-4822': { id: 'BC-4822', companyId: 'alvorada', role: 'Pintor', pay: null, location: 'Mooca, SP', address: 'Rua da Mooca, 3180', distance: '4,4 km', date: 'Hoje', hours: '8h–17h', duration: '1 diária', dias: 'qualquer', urgent: true, photos: ['img/jobs/pintor-1.jpg', 'img/jobs/pintor-2.jpg'], slots: 1,
    description: 'Pintura interna em parede lisa de apartamento recém-reformado, duas demãos de tinta acrílica branca.',
    requirements: ['Pintura interna, parede lisa', 'Rolo e pincel próprios', 'Tinta e lixa fornecidas pela obra'] },
  'BC-4855': { id: 'BC-4855', companyId: 'vila-formosa', role: 'Eletricista', pay: null, location: 'Vila Formosa, SP', address: 'Rua Vila Formosa, 210', distance: '5,6 km', date: 'Seg, 14 set', hours: '7h–17h', duration: '1 diária', dias: 'semana', slots: 1,
    description: 'Instalação elétrica residencial em casa em reforma: troca de disjuntores, tomadas e pontos de luz em três cômodos.',
    requirements: ['Instalação elétrica residencial', 'Ferramentas próprias', 'Combine o valor direto com a construtora'] },
  'BC-4830': { id: 'BC-4830', companyId: 'vila-prudente', role: 'Servente de obra', pay: 150, location: 'Vila Prudente, SP', address: 'Av. Vila Ema, 2790', distance: '6,8 km', date: 'Qua, 9 set', hours: '7h–16h', duration: '2 diárias seguidas', dias: 'semana', slots: 1,
    description: 'Carga e descarga de material de construção e limpeza do piso ao fim do expediente, em obra residencial de dois pavimentos.',
    requirements: ['Carregar material e limpar o piso', 'Botina própria', 'Capacete fornecido pela obra'] },
  'BC-4835': { id: 'BC-4835', companyId: 'serra-braganca', role: 'Azulejista', pay: 260, location: 'Tatuapé, SP', address: 'Rua Serra de Bragança, 640', distance: '4,1 km', date: 'Qui, 10 set', hours: '8h–17h', duration: '1 diária', dias: 'semana', slots: 1,
    description: 'Assentamento de porcelanato 60x60 em sala e cozinha, com nivelamento e rejunte incluídos.',
    requirements: ['Assentamento de porcelanato 60x60', 'Desempenadeira e nível próprios', 'Argamassa fornecida pela obra'] },
  'BC-4841': { id: 'BC-4841', companyId: 'meridiano', role: 'Armador', pay: 240, location: 'Penha, SP', address: 'Rua Cantagalo, 890', distance: '5,0 km', date: 'Sex, 11 set', hours: '7h–17h', duration: '3 diárias', dias: 'semana', slots: 1,
    description: 'Montagem da ferragem de laje de um pavimento, seguindo projeto estrutural fornecido pela construtora.',
    requirements: ['Montagem de ferragem de laje', 'Botina, capacete e luva próprios', 'Experiência com vergalhão'] },
  'BC-4848': { id: 'BC-4848', companyId: 'belem', role: 'Ajudante geral', pay: 140, location: 'Belém, SP', address: 'Rua Padre Adelino, 410', distance: '7,2 km', date: 'Sáb, 12 set', hours: '8h–14h', duration: 'Meia diária', dias: 'fimdesemana', slots: 1,
    description: 'Descarregar um caminhão de material de construção e organizar no canteiro. Serviço de meio período.',
    requirements: ['Descarregar caminhão de material', 'Botina própria', 'Sem experiência exigida'] },
  'BC-4998': { id: 'BC-4998', companyId: 'meridiano', role: 'Servente de obra', pay: 150, location: 'Vila Prudente, SP', address: 'Av. Vila Ema, 2790', distance: '6,8 km', date: 'Qua, 9 set', hours: '7h–16h', duration: '2 diárias seguidas', dias: 'semana', slots: 2,
    description: 'Carga e descarga de material de construção e limpeza do piso ao fim do expediente, em obra residencial de dois pavimentos.',
    requirements: ['Carregar material e limpar o piso', 'Botina própria'] },
  'BC-4995': { id: 'BC-4995', companyId: 'meridiano', role: 'Azulejista', pay: 260, location: 'Tatuapé, SP', address: 'Rua Serra de Bragança, 640', distance: '4,1 km', date: 'Qui, 10 set', hours: '8h–17h', duration: '1 diária', dias: 'semana', slots: 1,
    description: 'Assentamento de porcelanato 60x60 em sala e cozinha, com nivelamento e rejunte incluídos.',
    requirements: ['Assentamento de porcelanato 60x60', 'Desempenadeira e nível próprios'] },
  'BC-5010': { id: 'BC-5010', companyId: 'alvorada', role: 'Eletricista', pay: 250, location: 'Mooca, SP', address: 'Rua Taquari, 1180', distance: '4,4 km', date: 'Amanhã', hours: '8h–17h', duration: '1 diária', dias: 'semana', urgent: true, photos: ['img/jobs/eletricista-1.jpg', 'img/jobs/eletricista-2.jpg'], slots: 1,
    description: 'Troca da fiação de um apartamento de dois quartos e instalação de quadro de distribuição novo.',
    requirements: ['NR-10 em dia', 'Ferramentas próprias', 'Material fornecido pela obra'] },
  'BC-5011': { id: 'BC-5011', companyId: 'serra-braganca', role: 'Pintor', pay: 200, location: 'Tatuapé, SP', address: 'Rua Tuiuti, 2210', distance: '2,6 km', date: 'Sex, 25 set', hours: '8h–17h', duration: '2 diárias', dias: 'semana', slots: 2,
    description: 'Pintura de fachada de sobrado, com andaime já montado pela obra.',
    requirements: ['Experiência com pintura externa', 'Rolo, pincel e trincha próprios', 'EPI fornecido pela obra'] },
  'BC-5012': { id: 'BC-5012', companyId: 'vila-prudente', role: 'Encanador', pay: null, location: 'Vila Prudente, SP', address: 'Rua Ibitirama, 845', distance: '5,9 km', date: 'Hoje', hours: '9h–18h', duration: '1 diária', dias: 'qualquer', urgent: true, slots: 1,
    description: 'Vazamento na prumada do banheiro. Trocar a tubulação de água fria e testar a pressão.',
    requirements: ['Experiência com PVC e PPR', 'Ferramentas próprias'] },
  'BC-5013': { id: 'BC-5013', companyId: 'belem', role: 'Servente de obra', pay: 150, location: 'Belém, SP', address: 'Rua Siqueira Bueno, 1320', distance: '6,5 km', date: 'Sáb, 26 set', hours: '7h–16h', duration: '1 diária', dias: 'fimdesemana', slots: 2,
    description: 'Apoio ao pedreiro no preparo de massa e transporte de blocos para o segundo andar.',
    requirements: ['Botina própria', 'Capacete e luvas fornecidos pela obra'] },
  'BC-5014': { id: 'BC-5014', companyId: 'alvorada', role: 'Azulejista', pay: 280, location: 'Mooca, SP', address: 'Rua Javari, 540', distance: '4,8 km', date: null, hours: null, duration: '2 diárias', dias: 'semana', photos: ['img/jobs/azulejista-1.jpg', 'img/jobs/azulejista-2.jpg'], slots: 1,
    description: 'Revestimento de banheiro inteiro com porcelanato 60x120, incluindo recortes para nichos.',
    requirements: ['Experiência com peça grande', 'Cortador e nível a laser próprios'] },
  'BC-5015': { id: 'BC-5015', companyId: 'vila-formosa', role: 'Carpinteiro', pay: 260, location: 'Vila Formosa, SP', address: 'Av. Renata, 910', distance: '5,2 km', date: 'Ter, 29 set', hours: '7h–17h', duration: '3 diárias', dias: 'semana', slots: 2,
    description: 'Montagem de fôrmas de madeira para a laje do térreo.',
    requirements: ['Experiência com fôrma de laje', 'Serrote, martelo e trena próprios'] },
  'BC-5016': { id: 'BC-5016', companyId: 'cangaiba', role: 'Pedreiro', pay: 230, location: 'Cangaíba, SP', address: 'Rua Pedro Álvares, 77', distance: '8,1 km', date: 'Amanhã', hours: '7h–17h', duration: '2 diárias', dias: 'qualquer', photos: ['img/jobs/pedreiro-1.jpg', 'img/jobs/pedreiro-3.jpg', 'img/jobs/pedreiro-2.jpg'], slots: 1,
    description: 'Levantamento de muro de divisa com bloco de concreto, cerca de 20 metros.',
    requirements: ['Experiência com alvenaria', 'Colher e prumo próprios'] },
  'BC-5017': { id: 'BC-5017', companyId: 'aricanduva', role: 'Ajudante geral', pay: 130, location: 'Aricanduva, SP', address: 'Rua Olga Fadel Abarca, 300', distance: '9,0 km', date: 'Hoje', hours: '8h–14h', duration: 'Meia diária', dias: 'fimdesemana', urgent: true, slots: 1,
    description: 'Limpeza pós-obra de uma casa térrea: retirada de entulho e varrição.',
    requirements: ['Sem experiência exigida', 'Botina própria'] },
  'BC-5018': { id: 'BC-5018', companyId: 'serra-braganca', role: 'Gesseiro', pay: 240, location: 'Tatuapé, SP', address: 'Rua Apucarana, 1450', distance: '3,0 km', date: 'Qua, 30 set', hours: '8h–17h', duration: '2 diárias', dias: 'semana', slots: 1,
    description: 'Instalação de forro de gesso em sala e dois quartos, com sanca aberta na sala.',
    requirements: ['Experiência com forro e sanca', 'Ferramentas próprias'] },
  'BC-5019': { id: 'BC-5019', companyId: 'vila-prudente', role: 'Pintor', pay: 190, location: 'Vila Prudente, SP', address: 'Av. Paes de Barros, 3100', distance: '6,1 km', date: null, hours: null, duration: '1 diária', dias: 'qualquer', slots: 1,
    description: 'Pintura interna de apartamento de 60 m², com massa corrida nos pontos danificados.',
    requirements: ['Rolo e pincel próprios', 'Tinta fornecida pela obra'] },
  'BC-5020': { id: 'BC-5020', companyId: 'belem', role: 'Eletricista', pay: null, location: 'Belém, SP', address: 'Av. Álvaro Ramos, 890', distance: '6,9 km', date: 'Seg, 28 set', hours: '8h–17h', duration: '1 diária', dias: 'semana', slots: 1,
    description: 'Instalação de iluminação em LED e tomadas numa loja de 80 m².',
    requirements: ['NR-10 em dia', 'Ferramentas próprias'] },
  'BC-5021': { id: 'BC-5021', companyId: 'alvorada', role: 'Mestre de obras', pay: 380, location: 'Mooca, SP', address: 'Rua dos Trilhos, 1600', distance: '4,4 km', date: null, hours: '7h–17h', duration: '5 diárias', dias: 'semana', slots: 1,
    description: 'Coordenar uma equipe de quatro pessoas na reforma completa de um apartamento.',
    requirements: ['Experiência comprovada como mestre', 'Leitura de projeto'] },
  'BC-5022': { id: 'BC-5022', companyId: 'cangaiba', role: 'Servente de obra', pay: 140, location: 'Cangaíba, SP', address: 'Rua Dr. Assis Ribeiro, 2200', distance: '7,7 km', date: 'Hoje', hours: '7h–16h', duration: '1 diária', dias: 'semana', urgent: true, slots: 2,
    description: 'Carga e descarga de sacos de cimento e areia para a concretagem de sábado.',
    requirements: ['Botina própria'] },
  'BC-5023': { id: 'BC-5023', companyId: 'vila-formosa', role: 'Encanador', pay: 220, location: 'Vila Formosa, SP', address: 'Rua Itapeti, 60', distance: '5,4 km', date: 'Sáb, 26 set', hours: '8h–17h', duration: '1 diária', dias: 'fimdesemana', slots: 1,
    description: 'Instalação de aquecedor a gás e ligação das tubulações de água quente.',
    requirements: ['Experiência com aquecedor a gás', 'Ferramentas próprias'] },
  'BC-5024': { id: 'BC-5024', companyId: 'serra-braganca', role: 'Pedreiro de acabamento', pay: 240, location: 'Tatuapé, SP', address: 'Rua Cantagalo, 1220', distance: '2,2 km', date: 'Ter, 29 set', hours: '8h–17h', duration: '1 diária', dias: 'semana', slots: 1,
    description: 'Assentamento de rodapé e soleiras de granito, com acabamento em rejunte epóxi.',
    requirements: ['Experiência com granito', 'Nível e esquadro próprios'] },
  'BC-5025': { id: 'BC-5025', companyId: 'meridiano', role: 'Telhadista', pay: 250, location: 'Penha, SP', address: 'Rua Padre João, 480', distance: '5,0 km', date: 'Qua, 30 set', hours: '7h–16h', duration: '1 diária', dias: 'semana', slots: 2,
    description: 'Troca de telhas quebradas e revisão das calhas de um galpão.',
    requirements: ['Experiência em altura', 'Cinto de segurança fornecido pela obra'] },
  'BC-5026': { id: 'BC-5026', companyId: 'meridiano', role: 'Pintor', pay: 210, location: 'Tatuapé, SP', address: 'Rua Itapura, 900', distance: '3,4 km', date: 'Sex, 25 set', hours: '8h–17h', duration: '2 diárias', dias: 'semana', slots: 3,
    description: 'Pintura das áreas comuns de um condomínio: escadas e corredores de quatro andares.',
    requirements: ['Rolo e pincel próprios', 'Tinta fornecida pela obra'] },
  // closed / historical
  'BC-4712': { id: 'BC-4712', companyId: 'aricanduva', role: 'Ajudante geral', pay: 140, location: 'Aricanduva, SP', address: 'Av. Aricanduva, 5200', distance: '9,4 km', date: 'Ter, 26 ago', hours: '8h–14h', duration: 'Meia diária', dias: 'semana', slots: 1, closed: true,
    description: 'Descarregar material de construção na entrada da obra e organizar no canteiro.',
    requirements: ['Descarregar material', 'Botina própria'] },
  'BC-4703': { id: 'BC-4703', companyId: 'cangaiba', role: 'Servente de obra', pay: 150, location: 'Cangaíba, SP', address: 'Rua Cachoeira Tijuco Preto, 75', distance: '8,5 km', date: 'Sáb, 30 ago', hours: '8h–14h', duration: '1 diária', dias: 'fimdesemana', slots: 1, closed: true,
    description: 'Limpeza geral do piso e carga de material de construção durante a diária.',
    requirements: ['Limpeza de piso e carga de material', 'Botina própria'] },
  'BC-4698': { id: 'BC-4698', companyId: 'alvorada', role: 'Pintor', pay: 190, location: 'Mooca, SP', address: 'Rua da Mooca, 3180', distance: '4,4 km', date: 'Qui, 21 ago', hours: '8h–17h', duration: '1 diária', dias: 'semana', slots: 1, closed: true,
    description: 'Pintura interna em parede lisa, duas demãos de tinta acrílica.',
    requirements: ['Pintura interna', 'Rolo e pincel próprios'] },
  'BC-4960': { id: 'BC-4960', companyId: 'meridiano', role: 'Pintor', pay: 190, location: 'Mooca, SP', address: 'Rua da Mooca, 3180', distance: '4,4 km', date: 'Qui, 21 ago', hours: '8h–17h', duration: '1 diária', dias: 'semana', slots: 1, closed: true,
    description: 'Pintura interna em parede lisa, duas demãos de tinta acrílica.',
    requirements: ['Pintura interna', 'Rolo e pincel próprios'] },
  'BC-4944': { id: 'BC-4944', companyId: 'meridiano', role: 'Armador', pay: 240, location: 'Penha, SP', address: 'Rua Cantagalo, 890', distance: '5,0 km', date: 'Sex, 15 ago', hours: '7h–17h', duration: '3 diárias', dias: 'semana', slots: 2, closed: true, semContratacao: true,
    description: 'Montagem da ferragem de laje de um pavimento, seguindo projeto estrutural fornecido pela construtora.',
    requirements: ['Montagem de ferragem de laje'] },
  'BC-4918': { id: 'BC-4918', companyId: 'meridiano', role: 'Pedreiro de acabamento', pay: 220, location: 'Tatuapé, SP', address: 'Rua Serra de Bragança, 1240', distance: '3,2 km', date: '18 ago', hours: '7h–17h', duration: '1 diária', dias: 'semana', slots: 1, closed: true,
    description: 'Reboco e regularização de parede externa numa reforma residencial.',
    requirements: ['Experiência com reboco e massa corrida'] },
  'BC-4899': { id: 'BC-4899', companyId: 'meridiano', role: 'Pedreiro de acabamento', pay: 220, location: 'Tatuapé, SP', address: 'Rua Serra de Bragança, 1240', distance: '3,2 km', date: '14 ago', hours: '7h–17h', duration: '1 diária', dias: 'semana', slots: 1, closed: true,
    description: 'Acabamento em massa corrida antes da pintura, numa reforma residencial.',
    requirements: ['Experiência com reboco e massa corrida'] },
  'BC-4870': { id: 'BC-4870', companyId: 'meridiano', role: 'Servente de obra', pay: 150, location: 'Vila Prudente, SP', address: 'Av. Vila Ema, 2790', distance: '6,8 km', date: '9 ago', hours: '7h–16h', duration: '1 diária', dias: 'semana', slots: 1, closed: true,
    description: 'Carga de material de construção e limpeza do piso ao fim do expediente.',
    requirements: ['Carregar material e limpar o piso'] }
};

// One application = one worker's candidacy on one job. Status funnel (worker-facing):
// enviada -> em_analise -> pre_selecionado -> contratado -> concluida (needs review) | avaliada
// nao_selecionado is a terminal rejection at any point.
export const APPLICATIONS = [
  { id: 'a1', jobId: 'BC-4821', workerId: 'jorge', status: 'pre_selecionado' },
  { id: 'a2', jobId: 'BC-4821', workerId: 'edson', status: 'em_analise' },
  { id: 'a3', jobId: 'BC-4821', workerId: 'marcos', status: 'em_analise' },
  { id: 'a4', jobId: 'BC-4821', workerId: 'vitor', status: 'em_analise' },
  { id: 'a5', jobId: 'BC-4821', workerId: 'caio', status: 'em_analise' },
  { id: 'a6', jobId: 'BC-4830', workerId: 'jorge', status: 'em_analise' },
  { id: 'a7', jobId: 'BC-4835', workerId: 'jorge', status: 'enviada' },
  { id: 'a8', jobId: 'BC-4712', workerId: 'jorge', status: 'contratado' },
  { id: 'a9', jobId: 'BC-4703', workerId: 'jorge', status: 'concluida' },
  { id: 'a10', jobId: 'BC-4698', workerId: 'jorge', status: 'nao_selecionado' },
  { id: 'a11', jobId: 'BC-4998', workerId: 'rafael', status: 'em_analise' },
  { id: 'a12', jobId: 'BC-4998', workerId: 'bruno', status: 'em_analise' },
  { id: 'a13', jobId: 'BC-4998', workerId: 'joel', status: 'em_analise' },
  { id: 'a14', jobId: 'BC-4995', workerId: 'nelson', status: 'em_analise' },
  { id: 'a15', jobId: 'BC-4995', workerId: 'silas', status: 'em_analise' },
  { id: 'a16', jobId: 'BC-4960', workerId: 'marcos', status: 'concluida' },
  { id: 'a17', jobId: 'BC-4918', workerId: 'edson', status: 'concluida' },
  { id: 'a18', jobId: 'BC-4899', workerId: 'jorge', status: 'concluida' },
  { id: 'a19', jobId: 'BC-4870', workerId: 'antonio', status: 'concluida' }
];

export const SAVED_JOB_IDS = ['BC-4841', 'BC-4848', 'BC-4712', 'BC-4698'];

export const CARGOS_TRABALHADOR = ['Pedreiro de acabamento', 'Servente de obra', 'Pintor', 'Eletricista', 'Azulejista', 'Armador', 'Ajudante geral', 'Encanador'];
export const REGIOES_TRABALHADOR = ['Tatuapé, SP', 'Mooca, SP', 'Penha, SP', 'Vila Prudente, SP', 'Belém, SP', 'Vila Formosa, SP'];
export const ESPECIALIDADES = ['Acabamento', 'Alvenaria', 'Reboco', 'Assentamento', 'Pintura', 'Elétrica', 'Hidráulica'];
export const TIPOS_OBRA = ['Residencial', 'Comercial', 'Reforma', 'Residencial e reforma', 'Industrial'];
export const REGIOES_RECRUTADOR = ['Zona Leste, SP', 'Zona Norte, SP', 'Zona Sul, SP', 'Zona Oeste, SP', 'Centro, SP'];
export const TIPOS_SERVICO = ['Pedreiro', 'Servente', 'Azulejista', 'Pintor', 'Armador', 'Ajudante geral'];
export const REQUISITOS_OPCOES = ['Botina e capacete próprios', 'Ferramenta própria', 'Experiência comprovada', 'Chegar 10 min antes', 'EPI fornecido pela obra'];

// Portfolio posts (photo/video of finished work) a worker publishes on their own profile.
// mediaUrl: null renders the same neutral placeholder job photos use elsewhere in the app —
// there's no real uploaded file behind the seed data, only what a real session uploads.
export const WORKER_POSTS = [
  { id: 'wp1', workerId: 'jorge', mediaUrl: null, mediaType: 'image', caption: 'Reboco e regularização de parede externa, obra em Tatuapé. Dois dias de serviço.', date: '2026-09-10' },
  { id: 'wp2', workerId: 'jorge', mediaUrl: null, mediaType: 'image', caption: 'Acabamento em massa corrida antes da pintura. Cliente pediu prazo curto e entreguei em 1 diária.', date: '2026-08-22' },
  { id: 'wp3', workerId: 'jorge', mediaUrl: null, mediaType: 'image', caption: 'Assentamento de contrapiso em área externa.', date: '2026-08-05' }
];
