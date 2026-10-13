(() => {
  // js/dom.js
  function h(tag, props, ...children) {
    const parts = tag.split(".");
    const tagName = parts[0] || "div";
    const classes = parts.slice(1);
    const el = document.createElement(tagName);
    if (classes.length) el.className = classes.join(" ");
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === "class" || k === "className") {
          el.className = el.className ? el.className + " " + v : v;
        } else if (k.startsWith("on") && typeof v === "function") {
          el.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === "style" && typeof v === "object") {
          Object.assign(el.style, v);
        } else if (k === "html") {
          el.innerHTML = v;
        } else if (k === "value" || k === "checked" || k === "disabled" || k === "selected") {
          el[k] = v;
        } else {
          el.setAttribute(k, v);
        }
      }
    }
    appendChildren(el, children);
    return el;
  }
  function appendChildren(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }
  function mount(el, ...children) {
    clear(el);
    appendChildren(el, children);
    return el;
  }
  function cx(...parts) {
    return parts.filter(Boolean).join(" ");
  }
  function rem(px) {
    return px / 16 + "rem";
  }

  // js/router.js
  var routes = [];
  var onChange = null;
  var backStack = [];
  function route(pattern, handler) {
    const keys = [];
    const regexStr = pattern.replace(/:[^/]+/g, (m) => {
      keys.push(m.slice(1));
      return "([^/]+)";
    });
    routes.push({ pattern, handler, regex: new RegExp("^" + regexStr + "$"), keys });
  }
  function onRouteChange(fn) {
    onChange = fn;
  }
  function currentPath() {
    const h2 = location.hash.slice(1);
    return h2 || "/";
  }
  function match(path) {
    for (const r of routes) {
      const m = r.regex.exec(path);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => {
          params[k] = decodeURIComponent(m[i + 1]);
        });
        return { handler: r.handler, params, pattern: r.pattern };
      }
    }
    return null;
  }
  function navigate(path, { replace = false } = {}) {
    if (!replace) {
      const from = currentPath();
      if (from !== path) backStack.push(from);
    }
    if (replace) {
      history.replaceState(null, "", location.pathname + location.search + "#" + path);
      dispatch();
    } else {
      location.hash = path;
    }
  }
  function goBack(fallback = "/mural") {
    const prev = backStack.pop();
    navigate(prev || fallback, { replace: true });
  }
  function dispatch() {
    const path = currentPath();
    const m = match(path);
    if (onChange) onChange(m, path);
  }
  function startRouter() {
    window.addEventListener("hashchange", dispatch);
    dispatch();
  }

  // js/data/seed.js
  var CURRENT_COMPANY_ID = "meridiano";
  var CURRENT_WORKER_ID = "jorge";
  var COMPANIES = {
    meridiano: {
      id: "meridiano",
      name: "Construtora Meridiano",
      cnpj: "18.402.551/0001-07",
      tipoObra: "Residencial e reforma",
      location: "Zona Leste, SP",
      whatsapp: "(11) 98842-3310",
      rating: 4.7,
      reviewCount: 31,
      verified: true,
      verifiedSince: "12 ago",
      sinceLabel: "Na Bicos desde mar\xE7o de 2025",
      respondTime: "Responde em 1h20, em m\xE9dia",
      paidCount: 128,
      reviews: [
        { author: "Marcos A. \xB7 servente", value: 5, text: "Pagou em PIX no fim da di\xE1ria, como combinado.", date: "2 set" },
        { author: "Jorge M. \xB7 pedreiro", value: 4, text: "Obra organizada e EPI no local. Come\xE7ou 30 min atrasado.", date: "25 ago" },
        { author: "Edson B. \xB7 pedreiro", value: 5, text: "J\xE1 trabalhei com eles tr\xEAs vezes. Sempre no hor\xE1rio certo.", date: "18 ago" }
      ]
    },
    alvorada: {
      id: "alvorada",
      name: "Construtora Alvorada",
      location: "Mooca, SP",
      whatsapp: "(11) 97731-4402",
      rating: 4.5,
      reviewCount: 18,
      verified: true,
      reviews: [{ author: "Caio N. \xB7 pedreiro", value: 4, text: "Bom acabamento, chegou 20 min atrasado.", date: "30 jul" }]
    },
    "vila-formosa": { id: "vila-formosa", name: "Instala\xE7\xF5es Vila Formosa", location: "Vila Formosa, SP", whatsapp: "(11) 96614-2078", rating: 4.6, reviewCount: 9, verified: false, reviews: [] },
    "serra-braganca": {
      id: "serra-braganca",
      name: "Reforma Serra de Bragan\xE7a",
      location: "Tatuap\xE9, SP",
      whatsapp: "(11) 98127-5530",
      rating: 4.8,
      reviewCount: 14,
      verified: true,
      reviews: [{ author: "Nelson A. \xB7 azulejista", value: 5, text: "Assentamento impec\xE1vel, obra organizada.", date: "22 ago" }]
    },
    "vila-prudente": {
      id: "vila-prudente",
      name: "Obra Vila Prudente",
      location: "Vila Prudente, SP",
      whatsapp: "(11) 95548-9016",
      rating: 4.4,
      reviewCount: 7,
      verified: false,
      reviews: [{ author: "Bruno T. \xB7 servente", value: 5, text: "Trabalhador de confian\xE7a. J\xE1 chamei tr\xEAs vezes.", date: "27 ago" }]
    },
    belem: { id: "belem", name: "Obra Bel\xE9m", location: "Bel\xE9m, SP", whatsapp: "(11) 97402-6621", rating: 4.3, reviewCount: 5, verified: false, reviews: [] },
    aricanduva: { id: "aricanduva", name: "Obra Aricanduva", location: "Aricanduva, SP", whatsapp: "(11) 96280-3147", rating: 4.2, reviewCount: 4, verified: false, reviews: [] },
    cangaiba: { id: "cangaiba", name: "Obra Canga\xEDba", location: "Canga\xEDba, SP", whatsapp: "(11) 98865-1204", rating: 4.3, reviewCount: 6, verified: false, reviews: [] }
  };
  var WORKERS = {
    jorge: {
      id: "jorge",
      name: "Jorge Mendes",
      initials: "JM",
      role: "Pedreiro de acabamento",
      region: "Tatuap\xE9, SP",
      distance: "3,2 km",
      rating: 4.8,
      jobsDone: 23,
      verified: true,
      specialties: ["Acabamento", "Alvenaria", "Reboco", "Assentamento"],
      facts: ["23 di\xE1rias pagas pela plataforma", "RG e CPF conferidos em 12 ago", "Responde em 40 min, em m\xE9dia", "Nunca faltou a uma di\xE1ria combinada"],
      reviews: [
        { company: "Obra Vila Prudente", value: 5, text: "Trabalhou o dia todo sem reclamar. Deixou a \xE1rea limpa.", date: "14 ago" },
        { company: "Reforma Serra de Bragan\xE7a", value: 5, text: "Chegou no hor\xE1rio, acabamento bem feito.", date: "2 ago" },
        { company: "Construtora Meridiano", value: 5, text: "Chegou no hor\xE1rio, acabamento bem feito. Chamo de novo.", date: "28 ago" }
      ]
    },
    rafael: {
      id: "rafael",
      name: "Rafael Duarte",
      initials: "RD",
      role: "Servente de obra",
      region: "Vila Prudente, SP",
      distance: "1,8 km",
      rating: 4.5,
      jobsDone: 17,
      verified: true,
      specialties: ["Carga de material", "Limpeza de obra"],
      facts: ["17 di\xE1rias pagas pela plataforma", "RG e CPF conferidos em 5 ago", "Responde em 55 min, em m\xE9dia"],
      reviews: [{ company: "Obra Bel\xE9m", value: 4, text: "Fez o servi\xE7o direito. Saiu 20 min mais cedo.", date: "19 ago" }]
    },
    nelson: {
      id: "nelson",
      name: "Nelson Aquino",
      initials: "NA",
      role: "Azulejista",
      region: "Tatuap\xE9, SP",
      distance: "1,6 km",
      rating: 4.9,
      jobsDone: 52,
      verified: true,
      specialties: ["Porcelanato 60x60", "Rejunte", "Nivelamento"],
      facts: ["52 di\xE1rias pagas pela plataforma", "RG e CPF conferidos em 8 abr", "Responde em 15 min, em m\xE9dia"],
      reviews: [{ company: "Reforma Serra de Bragan\xE7a", value: 5, text: "Assentamento impec\xE1vel. Levou as pr\xF3prias ferramentas.", date: "22 ago" }]
    },
    bruno: {
      id: "bruno",
      name: "Bruno Tavares",
      initials: "BT",
      role: "Servente de obra",
      region: "Vila Prudente, SP",
      distance: "2,9 km",
      rating: 4.8,
      jobsDone: 28,
      verified: true,
      specialties: ["Carga de material", "Massa"],
      facts: ["28 di\xE1rias pagas pela plataforma", "RG e CPF conferidos em 15 jun", "Nunca faltou a uma di\xE1ria combinada"],
      reviews: [{ company: "Obra Vila Prudente", value: 5, text: "Trabalhador de confian\xE7a. J\xE1 chamei tr\xEAs vezes.", date: "27 ago" }]
    },
    marcos: {
      id: "marcos",
      name: "Marcos Aur\xE9lio",
      initials: "MA",
      role: "Servente e ajudante",
      region: "Penha, SP",
      distance: "5,1 km",
      rating: 4.6,
      jobsDone: 41,
      verified: true,
      specialties: ["Carga de material", "Limpeza de obra", "Massa"],
      facts: ["41 di\xE1rias pagas pela plataforma", "RG e CPF conferidos em 30 jul", "Responde em 1h10, em m\xE9dia"],
      reviews: [{ company: "Construtora Alvorada", value: 5, text: "Pegou no pesado o dia todo. Chamo de novo.", date: "21 ago" }]
    },
    silas: {
      id: "silas",
      name: "Silas Pereira",
      initials: "SP",
      role: "Azulejista",
      region: "Mooca, SP",
      distance: "2,4 km",
      rating: 0,
      jobsDone: 0,
      novo: true,
      verified: false,
      specialties: ["Porcelanato", "Rejunte"],
      facts: ["11 anos de obra, primeiro bico pela plataforma", "Documentos enviados, em confer\xEAncia", "Telefone confirmado por SMS"],
      reviews: []
    },
    vitor: {
      id: "vitor",
      name: "Vitor Camargo",
      initials: "VC",
      role: "Pedreiro",
      region: "Tatuap\xE9, SP",
      distance: "2,1 km",
      rating: 4.7,
      jobsDone: 31,
      verified: true,
      specialties: ["Reboco", "Contrapiso"],
      facts: ["31 di\xE1rias pagas pela plataforma", "RG e CPF conferidos em 21 jul", "Responde em 35 min, em m\xE9dia"],
      reviews: [{ company: "Obra Bel\xE9m", value: 5, text: "Servi\xE7o limpo e no prazo combinado.", date: "12 ago" }]
    },
    caio: {
      id: "caio",
      name: "Caio Nogueira",
      initials: "CN",
      role: "Pedreiro de acabamento",
      region: "Penha, SP",
      distance: "7,4 km",
      rating: 4.2,
      jobsDone: 9,
      verified: true,
      specialties: ["Massa corrida", "Acabamento"],
      facts: ["9 di\xE1rias pagas pela plataforma", "RG e CPF conferidos em 2 set", "Faltou a 1 di\xE1ria combinada em julho"],
      reviews: [{ company: "Construtora Alvorada", value: 4, text: "Bom acabamento, chegou 20 min atrasado.", date: "30 jul" }]
    },
    edson: {
      id: "edson",
      name: "Edson Batista",
      initials: "EB",
      role: "Pedreiro",
      region: "Bel\xE9m, SP",
      distance: "6,8 km",
      rating: 4.9,
      jobsDone: 64,
      verified: true,
      specialties: ["Alvenaria estrutural", "Contrapiso", "Reboco"],
      facts: ["64 di\xE1rias pagas pela plataforma", "RG e CPF conferidos em 4 mar", "Responde em 25 min, em m\xE9dia"],
      reviews: [{ company: "Construtora Meridiano", value: 5, text: "J\xE1 trabalhou com a gente tr\xEAs vezes. Sempre pontual.", date: "18 ago" }]
    },
    joel: {
      id: "joel",
      name: "Joel Ribeiro",
      initials: "JR",
      role: "Ajudante geral",
      region: "Bel\xE9m, SP",
      distance: "6,1 km",
      rating: 0,
      jobsDone: 0,
      novo: true,
      verified: false,
      specialties: ["Carga de material"],
      facts: ["6 anos de obra, primeiro bico pela plataforma", "Documentos enviados, em confer\xEAncia", "Telefone confirmado por SMS"],
      reviews: []
    },
    antonio: {
      id: "antonio",
      name: "Ant\xF4nio Ferraz",
      initials: "AF",
      role: "Servente de obra",
      region: "Vila Prudente, SP",
      distance: "4,0 km",
      rating: 4.6,
      jobsDone: 19,
      verified: true,
      specialties: ["Carga de material", "Limpeza de obra"],
      facts: ["19 di\xE1rias pagas pela plataforma", "RG e CPF conferidos em 3 mai"],
      reviews: []
    }
  };
  var JOBS = {
    "BC-4821": {
      id: "BC-4821",
      companyId: "meridiano",
      role: "Pedreiro de acabamento",
      pay: 220,
      location: "Tatuap\xE9, SP",
      address: "Rua Serra de Bragan\xE7a, 1240",
      distance: "3,2 km",
      date: "Hoje",
      hours: "7h\u201317h",
      duration: "1 di\xE1ria, com 1h de almo\xE7o",
      dias: "semana",
      urgent: true,
      boosted: true,
      photos: ["img/jobs/pedreiro-2.jpg", "img/jobs/pedreiro-1.jpg", "img/jobs/pedreiro-3.jpg"],
      slots: 4,
      description: "Reboco e regulariza\xE7\xE3o de duas paredes externas e acabamento em massa corrida numa reforma residencial. Material j\xE1 est\xE1 no canteiro.",
      requirements: ["Experi\xEAncia com reboco e massa corrida", "Botina e capacete pr\xF3prios", "Chegar 10 minutos antes"]
    },
    "BC-4822": {
      id: "BC-4822",
      companyId: "alvorada",
      role: "Pintor",
      pay: null,
      location: "Mooca, SP",
      address: "Rua da Mooca, 3180",
      distance: "4,4 km",
      date: "Hoje",
      hours: "8h\u201317h",
      duration: "1 di\xE1ria",
      dias: "qualquer",
      urgent: true,
      photos: ["img/jobs/pintor-1.jpg", "img/jobs/pintor-2.jpg"],
      slots: 1,
      description: "Pintura interna em parede lisa de apartamento rec\xE9m-reformado, duas dem\xE3os de tinta acr\xEDlica branca.",
      requirements: ["Pintura interna, parede lisa", "Rolo e pincel pr\xF3prios", "Tinta e lixa fornecidas pela obra"]
    },
    "BC-4855": {
      id: "BC-4855",
      companyId: "vila-formosa",
      role: "Eletricista",
      pay: null,
      location: "Vila Formosa, SP",
      address: "Rua Vila Formosa, 210",
      distance: "5,6 km",
      date: "Seg, 14 set",
      hours: "7h\u201317h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 1,
      description: "Instala\xE7\xE3o el\xE9trica residencial em casa em reforma: troca de disjuntores, tomadas e pontos de luz em tr\xEAs c\xF4modos.",
      requirements: ["Instala\xE7\xE3o el\xE9trica residencial", "Ferramentas pr\xF3prias", "Combine o valor direto com a construtora"]
    },
    "BC-4830": {
      id: "BC-4830",
      companyId: "vila-prudente",
      role: "Servente de obra",
      pay: 150,
      location: "Vila Prudente, SP",
      address: "Av. Vila Ema, 2790",
      distance: "6,8 km",
      date: "Qua, 9 set",
      hours: "7h\u201316h",
      duration: "2 di\xE1rias seguidas",
      dias: "semana",
      slots: 1,
      description: "Carga e descarga de material de constru\xE7\xE3o e limpeza do piso ao fim do expediente, em obra residencial de dois pavimentos.",
      requirements: ["Carregar material e limpar o piso", "Botina pr\xF3pria", "Capacete fornecido pela obra"]
    },
    "BC-4835": {
      id: "BC-4835",
      companyId: "serra-braganca",
      role: "Azulejista",
      pay: 260,
      location: "Tatuap\xE9, SP",
      address: "Rua Serra de Bragan\xE7a, 640",
      distance: "4,1 km",
      date: "Qui, 10 set",
      hours: "8h\u201317h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 1,
      description: "Assentamento de porcelanato 60x60 em sala e cozinha, com nivelamento e rejunte inclu\xEDdos.",
      requirements: ["Assentamento de porcelanato 60x60", "Desempenadeira e n\xEDvel pr\xF3prios", "Argamassa fornecida pela obra"]
    },
    "BC-4841": {
      id: "BC-4841",
      companyId: "meridiano",
      role: "Armador",
      pay: 240,
      location: "Penha, SP",
      address: "Rua Cantagalo, 890",
      distance: "5,0 km",
      date: "Sex, 11 set",
      hours: "7h\u201317h",
      duration: "3 di\xE1rias",
      dias: "semana",
      slots: 1,
      description: "Montagem da ferragem de laje de um pavimento, seguindo projeto estrutural fornecido pela construtora.",
      requirements: ["Montagem de ferragem de laje", "Botina, capacete e luva pr\xF3prios", "Experi\xEAncia com vergalh\xE3o"]
    },
    "BC-4848": {
      id: "BC-4848",
      companyId: "belem",
      role: "Ajudante geral",
      pay: 140,
      location: "Bel\xE9m, SP",
      address: "Rua Padre Adelino, 410",
      distance: "7,2 km",
      date: "S\xE1b, 12 set",
      hours: "8h\u201314h",
      duration: "Meia di\xE1ria",
      dias: "fimdesemana",
      slots: 1,
      description: "Descarregar um caminh\xE3o de material de constru\xE7\xE3o e organizar no canteiro. Servi\xE7o de meio per\xEDodo.",
      requirements: ["Descarregar caminh\xE3o de material", "Botina pr\xF3pria", "Sem experi\xEAncia exigida"]
    },
    "BC-4998": {
      id: "BC-4998",
      companyId: "meridiano",
      role: "Servente de obra",
      pay: 150,
      location: "Vila Prudente, SP",
      address: "Av. Vila Ema, 2790",
      distance: "6,8 km",
      date: "Qua, 9 set",
      hours: "7h\u201316h",
      duration: "2 di\xE1rias seguidas",
      dias: "semana",
      slots: 2,
      description: "Carga e descarga de material de constru\xE7\xE3o e limpeza do piso ao fim do expediente, em obra residencial de dois pavimentos.",
      requirements: ["Carregar material e limpar o piso", "Botina pr\xF3pria"]
    },
    "BC-4995": {
      id: "BC-4995",
      companyId: "meridiano",
      role: "Azulejista",
      pay: 260,
      location: "Tatuap\xE9, SP",
      address: "Rua Serra de Bragan\xE7a, 640",
      distance: "4,1 km",
      date: "Qui, 10 set",
      hours: "8h\u201317h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 1,
      description: "Assentamento de porcelanato 60x60 em sala e cozinha, com nivelamento e rejunte inclu\xEDdos.",
      requirements: ["Assentamento de porcelanato 60x60", "Desempenadeira e n\xEDvel pr\xF3prios"]
    },
    "BC-5010": {
      id: "BC-5010",
      companyId: "alvorada",
      role: "Eletricista",
      pay: 250,
      location: "Mooca, SP",
      address: "Rua Taquari, 1180",
      distance: "4,4 km",
      date: "Amanh\xE3",
      hours: "8h\u201317h",
      duration: "1 di\xE1ria",
      dias: "semana",
      urgent: true,
      photos: ["img/jobs/eletricista-1.jpg", "img/jobs/eletricista-2.jpg"],
      slots: 1,
      description: "Troca da fia\xE7\xE3o de um apartamento de dois quartos e instala\xE7\xE3o de quadro de distribui\xE7\xE3o novo.",
      requirements: ["NR-10 em dia", "Ferramentas pr\xF3prias", "Material fornecido pela obra"]
    },
    "BC-5011": {
      id: "BC-5011",
      companyId: "serra-braganca",
      role: "Pintor",
      pay: 200,
      location: "Tatuap\xE9, SP",
      address: "Rua Tuiuti, 2210",
      distance: "2,6 km",
      date: "Sex, 25 set",
      hours: "8h\u201317h",
      duration: "2 di\xE1rias",
      dias: "semana",
      slots: 2,
      description: "Pintura de fachada de sobrado, com andaime j\xE1 montado pela obra.",
      requirements: ["Experi\xEAncia com pintura externa", "Rolo, pincel e trincha pr\xF3prios", "EPI fornecido pela obra"]
    },
    "BC-5012": {
      id: "BC-5012",
      companyId: "vila-prudente",
      role: "Encanador",
      pay: null,
      location: "Vila Prudente, SP",
      address: "Rua Ibitirama, 845",
      distance: "5,9 km",
      date: "Hoje",
      hours: "9h\u201318h",
      duration: "1 di\xE1ria",
      dias: "qualquer",
      urgent: true,
      slots: 1,
      description: "Vazamento na prumada do banheiro. Trocar a tubula\xE7\xE3o de \xE1gua fria e testar a press\xE3o.",
      requirements: ["Experi\xEAncia com PVC e PPR", "Ferramentas pr\xF3prias"]
    },
    "BC-5013": {
      id: "BC-5013",
      companyId: "belem",
      role: "Servente de obra",
      pay: 150,
      location: "Bel\xE9m, SP",
      address: "Rua Siqueira Bueno, 1320",
      distance: "6,5 km",
      date: "S\xE1b, 26 set",
      hours: "7h\u201316h",
      duration: "1 di\xE1ria",
      dias: "fimdesemana",
      slots: 2,
      description: "Apoio ao pedreiro no preparo de massa e transporte de blocos para o segundo andar.",
      requirements: ["Botina pr\xF3pria", "Capacete e luvas fornecidos pela obra"]
    },
    "BC-5014": {
      id: "BC-5014",
      companyId: "alvorada",
      role: "Azulejista",
      pay: 280,
      location: "Mooca, SP",
      address: "Rua Javari, 540",
      distance: "4,8 km",
      date: null,
      hours: null,
      duration: "2 di\xE1rias",
      dias: "semana",
      photos: ["img/jobs/azulejista-1.jpg", "img/jobs/azulejista-2.jpg"],
      slots: 1,
      description: "Revestimento de banheiro inteiro com porcelanato 60x120, incluindo recortes para nichos.",
      requirements: ["Experi\xEAncia com pe\xE7a grande", "Cortador e n\xEDvel a laser pr\xF3prios"]
    },
    "BC-5015": {
      id: "BC-5015",
      companyId: "vila-formosa",
      role: "Carpinteiro",
      pay: 260,
      location: "Vila Formosa, SP",
      address: "Av. Renata, 910",
      distance: "5,2 km",
      date: "Ter, 29 set",
      hours: "7h\u201317h",
      duration: "3 di\xE1rias",
      dias: "semana",
      slots: 2,
      description: "Montagem de f\xF4rmas de madeira para a laje do t\xE9rreo.",
      requirements: ["Experi\xEAncia com f\xF4rma de laje", "Serrote, martelo e trena pr\xF3prios"]
    },
    "BC-5016": {
      id: "BC-5016",
      companyId: "cangaiba",
      role: "Pedreiro",
      pay: 230,
      location: "Canga\xEDba, SP",
      address: "Rua Pedro \xC1lvares, 77",
      distance: "8,1 km",
      date: "Amanh\xE3",
      hours: "7h\u201317h",
      duration: "2 di\xE1rias",
      dias: "qualquer",
      photos: ["img/jobs/pedreiro-1.jpg", "img/jobs/pedreiro-3.jpg", "img/jobs/pedreiro-2.jpg"],
      slots: 1,
      description: "Levantamento de muro de divisa com bloco de concreto, cerca de 20 metros.",
      requirements: ["Experi\xEAncia com alvenaria", "Colher e prumo pr\xF3prios"]
    },
    "BC-5017": {
      id: "BC-5017",
      companyId: "aricanduva",
      role: "Ajudante geral",
      pay: 130,
      location: "Aricanduva, SP",
      address: "Rua Olga Fadel Abarca, 300",
      distance: "9,0 km",
      date: "Hoje",
      hours: "8h\u201314h",
      duration: "Meia di\xE1ria",
      dias: "fimdesemana",
      urgent: true,
      slots: 1,
      description: "Limpeza p\xF3s-obra de uma casa t\xE9rrea: retirada de entulho e varri\xE7\xE3o.",
      requirements: ["Sem experi\xEAncia exigida", "Botina pr\xF3pria"]
    },
    "BC-5018": {
      id: "BC-5018",
      companyId: "serra-braganca",
      role: "Gesseiro",
      pay: 240,
      location: "Tatuap\xE9, SP",
      address: "Rua Apucarana, 1450",
      distance: "3,0 km",
      date: "Qua, 30 set",
      hours: "8h\u201317h",
      duration: "2 di\xE1rias",
      dias: "semana",
      slots: 1,
      description: "Instala\xE7\xE3o de forro de gesso em sala e dois quartos, com sanca aberta na sala.",
      requirements: ["Experi\xEAncia com forro e sanca", "Ferramentas pr\xF3prias"]
    },
    "BC-5019": {
      id: "BC-5019",
      companyId: "vila-prudente",
      role: "Pintor",
      pay: 190,
      location: "Vila Prudente, SP",
      address: "Av. Paes de Barros, 3100",
      distance: "6,1 km",
      date: null,
      hours: null,
      duration: "1 di\xE1ria",
      dias: "qualquer",
      slots: 1,
      description: "Pintura interna de apartamento de 60 m\xB2, com massa corrida nos pontos danificados.",
      requirements: ["Rolo e pincel pr\xF3prios", "Tinta fornecida pela obra"]
    },
    "BC-5020": {
      id: "BC-5020",
      companyId: "belem",
      role: "Eletricista",
      pay: null,
      location: "Bel\xE9m, SP",
      address: "Av. \xC1lvaro Ramos, 890",
      distance: "6,9 km",
      date: "Seg, 28 set",
      hours: "8h\u201317h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 1,
      description: "Instala\xE7\xE3o de ilumina\xE7\xE3o em LED e tomadas numa loja de 80 m\xB2.",
      requirements: ["NR-10 em dia", "Ferramentas pr\xF3prias"]
    },
    "BC-5021": {
      id: "BC-5021",
      companyId: "alvorada",
      role: "Mestre de obras",
      pay: 380,
      location: "Mooca, SP",
      address: "Rua dos Trilhos, 1600",
      distance: "4,4 km",
      date: null,
      hours: "7h\u201317h",
      duration: "5 di\xE1rias",
      dias: "semana",
      slots: 1,
      description: "Coordenar uma equipe de quatro pessoas na reforma completa de um apartamento.",
      requirements: ["Experi\xEAncia comprovada como mestre", "Leitura de projeto"]
    },
    "BC-5022": {
      id: "BC-5022",
      companyId: "cangaiba",
      role: "Servente de obra",
      pay: 140,
      location: "Canga\xEDba, SP",
      address: "Rua Dr. Assis Ribeiro, 2200",
      distance: "7,7 km",
      date: "Hoje",
      hours: "7h\u201316h",
      duration: "1 di\xE1ria",
      dias: "semana",
      urgent: true,
      slots: 2,
      description: "Carga e descarga de sacos de cimento e areia para a concretagem de s\xE1bado.",
      requirements: ["Botina pr\xF3pria"]
    },
    "BC-5023": {
      id: "BC-5023",
      companyId: "vila-formosa",
      role: "Encanador",
      pay: 220,
      location: "Vila Formosa, SP",
      address: "Rua Itapeti, 60",
      distance: "5,4 km",
      date: "S\xE1b, 26 set",
      hours: "8h\u201317h",
      duration: "1 di\xE1ria",
      dias: "fimdesemana",
      slots: 1,
      description: "Instala\xE7\xE3o de aquecedor a g\xE1s e liga\xE7\xE3o das tubula\xE7\xF5es de \xE1gua quente.",
      requirements: ["Experi\xEAncia com aquecedor a g\xE1s", "Ferramentas pr\xF3prias"]
    },
    "BC-5024": {
      id: "BC-5024",
      companyId: "serra-braganca",
      role: "Pedreiro de acabamento",
      pay: 240,
      location: "Tatuap\xE9, SP",
      address: "Rua Cantagalo, 1220",
      distance: "2,2 km",
      date: "Ter, 29 set",
      hours: "8h\u201317h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 1,
      description: "Assentamento de rodap\xE9 e soleiras de granito, com acabamento em rejunte ep\xF3xi.",
      requirements: ["Experi\xEAncia com granito", "N\xEDvel e esquadro pr\xF3prios"]
    },
    "BC-5025": {
      id: "BC-5025",
      companyId: "meridiano",
      role: "Telhadista",
      pay: 250,
      location: "Penha, SP",
      address: "Rua Padre Jo\xE3o, 480",
      distance: "5,0 km",
      date: "Qua, 30 set",
      hours: "7h\u201316h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 2,
      description: "Troca de telhas quebradas e revis\xE3o das calhas de um galp\xE3o.",
      requirements: ["Experi\xEAncia em altura", "Cinto de seguran\xE7a fornecido pela obra"]
    },
    "BC-5026": {
      id: "BC-5026",
      companyId: "meridiano",
      role: "Pintor",
      pay: 210,
      location: "Tatuap\xE9, SP",
      address: "Rua Itapura, 900",
      distance: "3,4 km",
      date: "Sex, 25 set",
      hours: "8h\u201317h",
      duration: "2 di\xE1rias",
      dias: "semana",
      slots: 3,
      description: "Pintura das \xE1reas comuns de um condom\xEDnio: escadas e corredores de quatro andares.",
      requirements: ["Rolo e pincel pr\xF3prios", "Tinta fornecida pela obra"]
    },
    // closed / historical
    "BC-4712": {
      id: "BC-4712",
      companyId: "aricanduva",
      role: "Ajudante geral",
      pay: 140,
      location: "Aricanduva, SP",
      address: "Av. Aricanduva, 5200",
      distance: "9,4 km",
      date: "Ter, 26 ago",
      hours: "8h\u201314h",
      duration: "Meia di\xE1ria",
      dias: "semana",
      slots: 1,
      closed: true,
      description: "Descarregar material de constru\xE7\xE3o na entrada da obra e organizar no canteiro.",
      requirements: ["Descarregar material", "Botina pr\xF3pria"]
    },
    "BC-4703": {
      id: "BC-4703",
      companyId: "cangaiba",
      role: "Servente de obra",
      pay: 150,
      location: "Canga\xEDba, SP",
      address: "Rua Cachoeira Tijuco Preto, 75",
      distance: "8,5 km",
      date: "S\xE1b, 30 ago",
      hours: "8h\u201314h",
      duration: "1 di\xE1ria",
      dias: "fimdesemana",
      slots: 1,
      closed: true,
      description: "Limpeza geral do piso e carga de material de constru\xE7\xE3o durante a di\xE1ria.",
      requirements: ["Limpeza de piso e carga de material", "Botina pr\xF3pria"]
    },
    "BC-4698": {
      id: "BC-4698",
      companyId: "alvorada",
      role: "Pintor",
      pay: 190,
      location: "Mooca, SP",
      address: "Rua da Mooca, 3180",
      distance: "4,4 km",
      date: "Qui, 21 ago",
      hours: "8h\u201317h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 1,
      closed: true,
      description: "Pintura interna em parede lisa, duas dem\xE3os de tinta acr\xEDlica.",
      requirements: ["Pintura interna", "Rolo e pincel pr\xF3prios"]
    },
    "BC-4960": {
      id: "BC-4960",
      companyId: "meridiano",
      role: "Pintor",
      pay: 190,
      location: "Mooca, SP",
      address: "Rua da Mooca, 3180",
      distance: "4,4 km",
      date: "Qui, 21 ago",
      hours: "8h\u201317h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 1,
      closed: true,
      description: "Pintura interna em parede lisa, duas dem\xE3os de tinta acr\xEDlica.",
      requirements: ["Pintura interna", "Rolo e pincel pr\xF3prios"]
    },
    "BC-4944": {
      id: "BC-4944",
      companyId: "meridiano",
      role: "Armador",
      pay: 240,
      location: "Penha, SP",
      address: "Rua Cantagalo, 890",
      distance: "5,0 km",
      date: "Sex, 15 ago",
      hours: "7h\u201317h",
      duration: "3 di\xE1rias",
      dias: "semana",
      slots: 2,
      closed: true,
      semContratacao: true,
      description: "Montagem da ferragem de laje de um pavimento, seguindo projeto estrutural fornecido pela construtora.",
      requirements: ["Montagem de ferragem de laje"]
    },
    "BC-4918": {
      id: "BC-4918",
      companyId: "meridiano",
      role: "Pedreiro de acabamento",
      pay: 220,
      location: "Tatuap\xE9, SP",
      address: "Rua Serra de Bragan\xE7a, 1240",
      distance: "3,2 km",
      date: "18 ago",
      hours: "7h\u201317h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 1,
      closed: true,
      description: "Reboco e regulariza\xE7\xE3o de parede externa numa reforma residencial.",
      requirements: ["Experi\xEAncia com reboco e massa corrida"]
    },
    "BC-4899": {
      id: "BC-4899",
      companyId: "meridiano",
      role: "Pedreiro de acabamento",
      pay: 220,
      location: "Tatuap\xE9, SP",
      address: "Rua Serra de Bragan\xE7a, 1240",
      distance: "3,2 km",
      date: "14 ago",
      hours: "7h\u201317h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 1,
      closed: true,
      description: "Acabamento em massa corrida antes da pintura, numa reforma residencial.",
      requirements: ["Experi\xEAncia com reboco e massa corrida"]
    },
    "BC-4870": {
      id: "BC-4870",
      companyId: "meridiano",
      role: "Servente de obra",
      pay: 150,
      location: "Vila Prudente, SP",
      address: "Av. Vila Ema, 2790",
      distance: "6,8 km",
      date: "9 ago",
      hours: "7h\u201316h",
      duration: "1 di\xE1ria",
      dias: "semana",
      slots: 1,
      closed: true,
      description: "Carga de material de constru\xE7\xE3o e limpeza do piso ao fim do expediente.",
      requirements: ["Carregar material e limpar o piso"]
    }
  };
  var APPLICATIONS = [
    { id: "a1", jobId: "BC-4821", workerId: "jorge", status: "pre_selecionado" },
    { id: "a2", jobId: "BC-4821", workerId: "edson", status: "em_analise" },
    { id: "a3", jobId: "BC-4821", workerId: "marcos", status: "em_analise" },
    { id: "a4", jobId: "BC-4821", workerId: "vitor", status: "em_analise" },
    { id: "a5", jobId: "BC-4821", workerId: "caio", status: "em_analise" },
    { id: "a6", jobId: "BC-4830", workerId: "jorge", status: "em_analise" },
    { id: "a7", jobId: "BC-4835", workerId: "jorge", status: "enviada" },
    { id: "a8", jobId: "BC-4712", workerId: "jorge", status: "contratado" },
    { id: "a9", jobId: "BC-4703", workerId: "jorge", status: "concluida" },
    { id: "a10", jobId: "BC-4698", workerId: "jorge", status: "nao_selecionado" },
    { id: "a11", jobId: "BC-4998", workerId: "rafael", status: "em_analise" },
    { id: "a12", jobId: "BC-4998", workerId: "bruno", status: "em_analise" },
    { id: "a13", jobId: "BC-4998", workerId: "joel", status: "em_analise" },
    { id: "a14", jobId: "BC-4995", workerId: "nelson", status: "em_analise" },
    { id: "a15", jobId: "BC-4995", workerId: "silas", status: "em_analise" },
    { id: "a16", jobId: "BC-4960", workerId: "marcos", status: "concluida" },
    { id: "a17", jobId: "BC-4918", workerId: "edson", status: "concluida" },
    { id: "a18", jobId: "BC-4899", workerId: "jorge", status: "concluida" },
    { id: "a19", jobId: "BC-4870", workerId: "antonio", status: "concluida" }
  ];
  var SAVED_JOB_IDS = ["BC-4841", "BC-4848", "BC-4712", "BC-4698"];
  var CARGOS_TRABALHADOR = ["Pedreiro de acabamento", "Servente de obra", "Pintor", "Eletricista", "Azulejista", "Armador", "Ajudante geral", "Encanador"];
  var REGIOES_TRABALHADOR = ["Tatuap\xE9, SP", "Mooca, SP", "Penha, SP", "Vila Prudente, SP", "Bel\xE9m, SP", "Vila Formosa, SP"];
  var ESPECIALIDADES = ["Acabamento", "Alvenaria", "Reboco", "Assentamento", "Pintura", "El\xE9trica", "Hidr\xE1ulica"];
  var TIPOS_OBRA = ["Residencial", "Comercial", "Reforma", "Residencial e reforma", "Industrial"];
  var REGIOES_RECRUTADOR = ["Zona Leste, SP", "Zona Norte, SP", "Zona Sul, SP", "Zona Oeste, SP", "Centro, SP"];
  var TIPOS_SERVICO = ["Pedreiro", "Servente", "Azulejista", "Pintor", "Armador", "Ajudante geral"];
  var REQUISITOS_OPCOES = ["Botina e capacete pr\xF3prios", "Ferramenta pr\xF3pria", "Experi\xEAncia comprovada", "Chegar 10 min antes", "EPI fornecido pela obra"];
  var WORKER_POSTS = [
    { id: "wp1", workerId: "jorge", mediaUrl: null, mediaType: "image", caption: "Reboco e regulariza\xE7\xE3o de parede externa, obra em Tatuap\xE9. Dois dias de servi\xE7o.", date: "2026-09-10" },
    { id: "wp2", workerId: "jorge", mediaUrl: null, mediaType: "image", caption: "Acabamento em massa corrida antes da pintura. Cliente pediu prazo curto e entreguei em 1 di\xE1ria.", date: "2026-08-22" },
    { id: "wp3", workerId: "jorge", mediaUrl: null, mediaType: "image", caption: "Assentamento de contrapiso em \xE1rea externa.", date: "2026-08-05" }
  ];

  // js/store.js
  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }
  var state = {
    role: "trabalhador",
    // demo account switch — which side of the marketplace is "logged in"
    db: {
      jobs: clone(JOBS),
      applications: clone(APPLICATIONS),
      savedJobIds: [...SAVED_JOB_IDS],
      deletedJobIds: [],
      workerPosts: clone(WORKER_POSTS)
    },
    ui: {}
  };
  var listeners = /* @__PURE__ */ new Set();
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function notify() {
    listeners.forEach((fn) => fn());
  }
  function getRole() {
    return state.role;
  }
  function setRole(role) {
    state.role = role;
    notify();
  }
  function getUI(key, defaults) {
    if (!(key in state.ui)) state.ui[key] = typeof defaults === "function" ? defaults() : Object.assign({}, defaults);
    return state.ui[key];
  }
  function setUI(key, patch) {
    const cur = state.ui[key] || {};
    state.ui[key] = Object.assign({}, cur, typeof patch === "function" ? patch(cur) : patch);
    notify();
  }
  function resetUI(key) {
    delete state.ui[key];
    notify();
  }
  function getCompany(id) {
    return COMPANIES[id];
  }
  function allCompanies() {
    return Object.values(COMPANIES);
  }
  function currentCompany() {
    return COMPANIES[CURRENT_COMPANY_ID];
  }
  function currentCompanyId() {
    return CURRENT_COMPANY_ID;
  }
  function getWorker(id) {
    return WORKERS[id];
  }
  function allWorkers() {
    return Object.values(WORKERS);
  }
  function currentWorker() {
    return WORKERS[CURRENT_WORKER_ID];
  }
  function currentWorkerId() {
    return CURRENT_WORKER_ID;
  }
  function allJobs() {
    return Object.values(state.db.jobs);
  }
  function getJob(id) {
    return state.db.jobs[id];
  }
  function activeJobs() {
    return allJobs().filter((j) => state.db.deletedJobIds.indexOf(j.id) < 0);
  }
  function isMine(job) {
    return job.companyId === CURRENT_COMPANY_ID;
  }
  function successfulJobsForCompany(companyId) {
    return allJobs().filter((j) => j.companyId === companyId && j.closed && !j.semContratacao).length;
  }
  function createJob(job) {
    state.db.jobs[job.id] = job;
    notify();
    return job.id;
  }
  function deleteJobPost(jobId) {
    state.db.deletedJobIds.push(jobId);
    notify();
  }
  function updateJob(jobId, patch) {
    const job = state.db.jobs[jobId];
    if (job) {
      Object.assign(job, patch);
      notify();
    }
  }
  function closeJob(jobId) {
    const job = getJob(jobId);
    if (!job) return;
    const hired = approvedCount(jobId) > 0;
    job.closed = true;
    if (!hired) job.semContratacao = true;
    applicationsForJob(jobId).forEach((a) => {
      if (a.status === "enviada" || a.status === "em_analise") a.status = "nao_selecionado";
    });
    notify();
  }
  function applicationsForJob(jobId) {
    return state.db.applications.filter((a) => a.jobId === jobId);
  }
  function applicationsForWorker(workerId) {
    return state.db.applications.filter((a) => a.workerId === workerId);
  }
  function applicationFor(jobId, workerId) {
    return state.db.applications.find((a) => a.jobId === jobId && a.workerId === workerId) || null;
  }
  function approvedCount(jobId) {
    return state.db.applications.filter((a) => a.jobId === jobId && (a.status === "pre_selecionado" || a.status === "contratado")).length;
  }
  function pendingCount(jobId) {
    return state.db.applications.filter((a) => a.jobId === jobId && (a.status === "enviada" || a.status === "em_analise")).length;
  }
  function isJobFull(job) {
    return approvedCount(job.id) >= (job.slots || 1);
  }
  function isJobClosed(job) {
    return Boolean(job.closed) || isJobFull(job);
  }
  function applyToJob(jobId, workerId) {
    if (!applicationFor(jobId, workerId)) {
      state.db.applications.push({ id: "a" + Date.now(), jobId, workerId, status: "enviada" });
    }
    notify();
  }
  function cancelApplication(jobId, workerId) {
    const i = state.db.applications.findIndex((a) => a.jobId === jobId && a.workerId === workerId);
    if (i >= 0) {
      state.db.applications.splice(i, 1);
      notify();
    }
  }
  function decideApplication(jobId, workerId, decision) {
    const app = applicationFor(jobId, workerId);
    if (!app) return;
    app.status = decision === "aprovado" ? "pre_selecionado" : decision === "recusado" ? "nao_selecionado" : "em_analise";
    const job = getJob(jobId);
    if (decision === "aprovado" && job && approvedCount(jobId) >= (job.slots || 1)) {
      applicationsForJob(jobId).forEach((a) => {
        if (a.status === "enviada" || a.status === "em_analise") a.status = "nao_selecionado";
      });
    }
    notify();
  }
  function markReviewed(jobId, workerId) {
    const app = applicationFor(jobId, workerId);
    if (app) {
      app.status = "avaliada";
      notify();
    }
  }
  function isJobSaved(jobId) {
    return state.db.savedJobIds.indexOf(jobId) >= 0;
  }
  function toggleSavedJob(jobId) {
    const i = state.db.savedJobIds.indexOf(jobId);
    if (i >= 0) state.db.savedJobIds.splice(i, 1);
    else state.db.savedJobIds.push(jobId);
    notify();
  }
  function savedJobs() {
    return state.db.savedJobIds.map((id) => getJob(id)).filter(Boolean);
  }
  function postsForWorker(workerId) {
    return state.db.workerPosts.filter((p) => p.workerId === workerId).sort((a, b) => a.date < b.date ? 1 : -1);
  }
  function addWorkerPost(workerId, { mediaUrl, mediaType, caption }) {
    state.db.workerPosts.unshift({ id: "wp" + Date.now(), workerId, mediaUrl, mediaType, caption, date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) });
    notify();
  }
  function deleteWorkerPost(postId) {
    const i = state.db.workerPosts.findIndex((p) => p.id === postId);
    if (i >= 0) {
      state.db.workerPosts.splice(i, 1);
      notify();
    }
  }

  // js/utils/iconData.js
  var ICON_DATA = {
    "arrow-left": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-arrow-left%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m12%2019-7-7%207-7%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M19%2012H5%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "arrow-right": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-arrow-right%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M5%2012h14%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m12%205%207%207-7%207%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "bell": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-bell%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M10.268%2021a2%202%200%200%200%203.464%200%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3.262%2015.326A1%201%200%200%200%204%2017h16a1%201%200%200%200%20.74-1.673C19.41%2013.956%2018%2012.499%2018%208A6%206%200%200%200%206%208c0%204.499-1.411%205.956-2.738%207.326%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "bookmark-solid": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-bookmark-solid%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22%23000%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M17%203a2%202%200%200%201%202%202v15a1%201%200%200%201-1.496.868l-4.512-2.578a2%202%200%200%200-1.984%200l-4.512%202.578A1%201%200%200%201%205%2020V5a2%202%200%200%201%202-2z%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "bookmark-x": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-bookmark-x%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m14.5%207.5-5%205%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M17%203a2%202%200%200%201%202%202v15a1%201%200%200%201-1.496.868l-4.512-2.578a2%202%200%200%200-1.984%200l-4.512%202.578A1%201%200%200%201%205%2020V5a2%202%200%200%201%202-2z%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m9.5%207.5%205%205%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "bookmark": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-bookmark%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M17%203a2%202%200%200%201%202%202v15a1%201%200%200%201-1.496.868l-4.512-2.578a2%202%200%200%200-1.984%200l-4.512%202.578A1%201%200%200%201%205%2020V5a2%202%200%200%201%202-2z%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "brick-wall": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-brick-wall%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Crect%20width%3D%2218%22%20height%3D%2218%22%20x%3D%223%22%20y%3D%223%22%20rx%3D%222%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%209v6%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M16%2015v6%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M16%203v6%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3%2015h18%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3%209h18%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M8%2015v6%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M8%203v6%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "building-2": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-building-2%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M10%2012h4%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M10%208h4%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M14%2021v-3a2%202%200%200%200-4%200v3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M6%2010H4a2%202%200%200%200-2%202v7a2%202%200%200%200%202%202h16a2%202%200%200%200%202-2V9a2%202%200%200%200-2-2h-2%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M6%2021V5a2%202%200%200%201%202-2h8a2%202%200%200%201%202%202v16%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "calendar-days": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-calendar-days%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M8%202v3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M16%202v3%22%20%2F%3E%0A%20%20%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3%209h18%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M8%2013h.01%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%2013h.01%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M16%2013h.01%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M8%2017h.01%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%2017h.01%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M16%2017h.01%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "calendar": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-calendar%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M8%202v3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M16%202v3%22%20%2F%3E%0A%20%20%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3%209h18%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "camera": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-camera%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M13.997%204a2%202%200%200%201%201.76%201.05l.486.9A2%202%200%200%200%2018.003%207H20a2%202%200%200%201%202%202v9a2%202%200%200%201-2%202H4a2%202%200%200%201-2-2V9a2%202%200%200%201%202-2h1.997a2%202%200%200%200%201.759-1.048l.489-.904A2%202%200%200%201%2010.004%204z%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2213%22%20r%3D%223%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "check": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-check%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M20%206%209%2017l-5-5%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "chevron-down": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-chevron-down%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m6%209%206%206%206-6%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "chevron-left": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-chevron-left%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m15%2018-6-6%206-6%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "chevron-right": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-chevron-right%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m9%2018%206-6-6-6%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "circle-alert": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-circle-alert%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%20%2F%3E%0A%20%20%3Cline%20x1%3D%2212%22%20x2%3D%2212%22%20y1%3D%228%22%20y2%3D%2212%22%20%2F%3E%0A%20%20%3Cline%20x1%3D%2212%22%20x2%3D%2212.01%22%20y1%3D%2216%22%20y2%3D%2216%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "circle-check": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-circle-check%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m16%209-5.5%205.5L8%2012%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "circle-x": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-circle-x%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m15%209-6%206%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m9%209%206%206%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "circle": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-circle%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "clock": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-clock%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%206v6l4%202%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "construction": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-construction%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Crect%20x%3D%222%22%20y%3D%226%22%20width%3D%2220%22%20height%3D%228%22%20rx%3D%221%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M17%2014v7%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M7%2014v7%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M17%203v3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M7%203v3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M10%2014%202.3%206.3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m14%206%207.7%207.7%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m8%206%208%208%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "download": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-download%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M12%2015V3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M21%2015v4a2%202%200%200%201-2%202H5a2%202%200%200%201-2-2v-4%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m7%2010%205%205%205-5%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "droplets": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-droplets%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M7%2016.3c2.2%200%204-1.83%204-4.05%200-1.16-.57-2.26-1.71-3.19S7.29%206.75%207%205.3c-.29%201.45-1.14%202.84-2.29%203.76S3%2011.1%203%2012.25c0%202.22%201.8%204.05%204%204.05z%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12.56%206.6A10.97%2010.97%200%200%200%2014%203.02c.5%202.5%202%204.9%204%206.5s3%203.5%203%205.5a6.98%206.98%200%200%201-11.91%204.97%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "file-check": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-file-check%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M6%2022a2%202%200%200%201-2-2V4a2%202%200%200%201%202-2h8a2.4%202.4%200%200%201%201.704.706l3.588%203.588A2.4%202.4%200%200%201%2020%208v12a2%202%200%200%201-2%202z%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M14%202v5a1%201%200%200%200%201%201h5%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m9%2015%202%202%204-4%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "globe": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-globe%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%202a14.5%2014.5%200%200%200%200%2020%2014.5%2014.5%200%200%200%200-20%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M2%2012h20%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "hammer": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-hammer%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m15%2012-9.373%209.373a1%201%200%200%201-3.001-3L12%209%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m18%2015%204-4%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m21.5%2011.5-1.914-1.914A2%202%200%200%201%2019%208.172v-.344a2%202%200%200%200-.586-1.414l-1.657-1.657A6%206%200%200%200%2012.516%203H9l1.243%201.243A6%206%200%200%201%2012%208.485V10l2%202h1.172a2%202%200%200%201%201.414.586L18.5%2014.5%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "hand-coins": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-hand-coins%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M11%2015h2a2%202%200%201%200%200-4h-3c-.6%200-1.1.2-1.4.6L3%2017%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m7%2021%201.6-1.4c.3-.4.8-.6%201.4-.6h4c1.1%200%202.1-.4%202.8-1.2l4.6-4.4a2%202%200%200%200-2.75-2.91l-4.2%203.9%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m2%2016%206%206%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%2216%22%20cy%3D%229%22%20r%3D%222.9%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%226%22%20cy%3D%225%22%20r%3D%223%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "handshake": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-handshake%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m11%2017%202%202a1%201%200%201%200%203-3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m14%2014%202.5%202.5a1%201%200%201%200%203-3l-3.88-3.88a3%203%200%200%200-4.24%200l-.88.88a1%201%200%201%201-3-3l2.81-2.81a5.79%205.79%200%200%201%207.06-.87l.47.28a2%202%200%200%200%201.42.25L21%204%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m21%203%201%2011h-2%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3%203%202%2014l6.5%206.5a1%201%200%201%200%203-3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3%204h8%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "hard-hat": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-hard-hat%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M10%2010V5a1%201%200%200%201%201-1h2a1%201%200%200%201%201%201v5%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M14%206a6%206%200%200%201%206%206v3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M4%2015v-3a6%206%200%200%201%206-6%22%20%2F%3E%0A%20%20%3Crect%20x%3D%222%22%20y%3D%2215%22%20width%3D%2220%22%20height%3D%224%22%20rx%3D%221%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "history": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-history%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M3%2012a9%209%200%201%200%209-9%209.75%209.75%200%200%200-6.74%202.74L3%208%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3%203v5h5%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%207v5l4%202%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "house": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-house%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M15%2021v-8a1%201%200%200%200-1-1h-4a1%201%200%200%200-1%201v8%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3%2010a2%202%200%200%201%20.709-1.528l7-6a2%202%200%200%201%202.582%200l7%206A2%202%200%200%201%2021%2010v9a2%202%200%200%201-2%202H5a2%202%200%200%201-2-2z%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "id-card": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-id-card%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M13%2019a4%204%200%2000-8%200%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M16%2010h2%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M16%2014h2%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%229%22%20cy%3D%2212%22%20r%3D%223%22%20%2F%3E%0A%20%20%3Crect%20x%3D%222%22%20y%3D%225%22%20width%3D%2220%22%20height%3D%2214%22%20rx%3D%222%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "layout-grid": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-layout-grid%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Crect%20width%3D%227%22%20height%3D%227%22%20x%3D%223%22%20y%3D%223%22%20rx%3D%221%22%20%2F%3E%0A%20%20%3Crect%20width%3D%227%22%20height%3D%227%22%20x%3D%2214%22%20y%3D%223%22%20rx%3D%221%22%20%2F%3E%0A%20%20%3Crect%20width%3D%227%22%20height%3D%227%22%20x%3D%2214%22%20y%3D%2214%22%20rx%3D%221%22%20%2F%3E%0A%20%20%3Crect%20width%3D%227%22%20height%3D%227%22%20x%3D%223%22%20y%3D%2214%22%20rx%3D%221%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "locate-fixed": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-locate-fixed%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cline%20x1%3D%222%22%20x2%3D%225%22%20y1%3D%2212%22%20y2%3D%2212%22%20%2F%3E%0A%20%20%3Cline%20x1%3D%2219%22%20x2%3D%2222%22%20y1%3D%2212%22%20y2%3D%2212%22%20%2F%3E%0A%20%20%3Cline%20x1%3D%2212%22%20x2%3D%2212%22%20y1%3D%222%22%20y2%3D%225%22%20%2F%3E%0A%20%20%3Cline%20x1%3D%2212%22%20x2%3D%2212%22%20y1%3D%2219%22%20y2%3D%2222%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%227%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%223%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "lock": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-lock%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Crect%20width%3D%2218%22%20height%3D%2211%22%20x%3D%223%22%20y%3D%2211%22%20rx%3D%222%22%20ry%3D%222%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M7%2011V7a5%205%200%200%201%2010%200v4%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "log-out": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-log-out%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m16%2017%205-5-5-5%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M21%2012H9%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M9%2021H5a2%202%200%200%201-2-2V5a2%202%200%200%201%202-2h4%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "mail-check": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-mail-check%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M22%2013V6a2%202%200%200%200-2-2H4a2%202%200%200%200-2%202v12c0%201.1.9%202%202%202h8%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m22%207-8.97%205.7a1.94%201.94%200%200%201-2.06%200L2%207%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m16%2019%202%202%204-4%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "mail": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-mail%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m22%207-8.991%205.727a2%202%200%200%201-2.009%200L2%207%22%20%2F%3E%0A%20%20%3Crect%20x%3D%222%22%20y%3D%224%22%20width%3D%2220%22%20height%3D%2216%22%20rx%3D%222%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "map-pin": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-map-pin%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M20%2010c0%204.993-5.539%2010.193-7.399%2011.799a1%201%200%200%201-1.202%200C9.539%2020.193%204%2014.993%204%2010a8%208%200%200%201%2016%200%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2210%22%20r%3D%223%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "menu": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-menu%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M4%205h16%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M4%2012h16%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M4%2019h16%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "message-circle": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-message-circle%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M2.992%2016.342a2%202%200%200%201%20.094%201.167l-1.065%203.29a1%201%200%200%200%201.236%201.168l3.413-.998a2%202%200%200%201%201.099.092%2010%2010%200%201%200-4.777-4.719%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "paint-roller": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-paint-roller%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Crect%20width%3D%2216%22%20height%3D%226%22%20x%3D%222%22%20y%3D%222%22%20rx%3D%222%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M10%2016v-2a2%202%200%200%201%202-2h8a2%202%200%200%200%202-2V7a2%202%200%200%200-2-2h-2%22%20%2F%3E%0A%20%20%3Crect%20width%3D%224%22%20height%3D%226%22%20x%3D%228%22%20y%3D%2216%22%20rx%3D%221%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "pencil": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-pencil%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M21.174%206.812a1%201%200%200%200-3.986-3.987L3.842%2016.174a2%202%200%200%200-.5.83l-1.321%204.352a.5.5%200%200%200%20.623.622l4.353-1.32a2%202%200%200%200%20.83-.497z%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m15%205%204%204%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "phone-call": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-phone-call%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M13%202a9%209%200%200%201%209%209%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M13%206a5%205%200%200%201%205%205%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M13.832%2016.568a1%201%200%200%200%201.213-.303l.355-.465A2%202%200%200%201%2017%2015h3a2%202%200%200%201%202%202v3a2%202%200%200%201-2%202A18%2018%200%200%201%202%204a2%202%200%200%201%202-2h3a2%202%200%200%201%202%202v3a2%202%200%200%201-.8%201.6l-.468.351a1%201%200%200%200-.292%201.233%2014%2014%200%200%200%206.392%206.384%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "phone": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-phone%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M13.832%2016.568a1%201%200%200%200%201.213-.303l.355-.465A2%202%200%200%201%2017%2015h3a2%202%200%200%201%202%202v3a2%202%200%200%201-2%202A18%2018%200%200%201%202%204a2%202%200%200%201%202-2h3a2%202%200%200%201%202%202v3a2%202%200%200%201-.8%201.6l-.468.351a1%201%200%200%200-.292%201.233%2014%2014%200%200%200%206.392%206.384%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "plug-zap": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-plug-zap%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M6.3%2020.3a2.4%202.4%200%200%200%203.4%200L12%2018l-6-6-2.3%202.3a2.4%202.4%200%200%200%200%203.4Z%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m2%2022%203-3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M7.5%2013.5%2010%2011%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M10.5%2016.5%2013%2014%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m18%203-4%204h6l-4%204%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "plus": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-plus%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M5%2012h14%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%205v14%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "ruler": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-ruler%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M21.3%2015.3a2.4%202.4%200%200%201%200%203.4l-2.6%202.6a2.4%202.4%200%200%201-3.4%200L2.7%208.7a2.41%202.41%200%200%201%200-3.4l2.6-2.6a2.41%202.41%200%200%201%203.4%200Z%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m14.5%2012.5%202-2%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m11.5%209.5%202-2%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m8.5%206.5%202-2%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m17.5%2015.5%202-2%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "search-x": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-search-x%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m13.5%208.5-5%205%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m8.5%208.5%205%205%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%2211%22%20cy%3D%2211%22%20r%3D%228%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m21%2021-4.3-4.3%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "search": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-search%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m21%2021-4.34-4.34%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%2211%22%20cy%3D%2211%22%20r%3D%228%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "send": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-send%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M14.536%2021.686a.5.5%200%200%200%20.937-.024l6.5-19a.496.496%200%200%200-.635-.635l-19%206.5a.5.5%200%200%200-.024.937l7.93%203.18a2%202%200%200%201%201.112%201.11z%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m21.854%202.147-10.94%2010.939%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "settings": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-settings%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M9.671%204.136a2.34%202.34%200%200%201%204.659%200%202.34%202.34%200%200%200%203.319%201.915%202.34%202.34%200%200%201%202.33%204.033%202.34%202.34%200%200%200%200%203.831%202.34%202.34%200%200%201-2.33%204.033%202.34%202.34%200%200%200-3.319%201.915%202.34%202.34%200%200%201-4.659%200%202.34%202.34%200%200%200-3.32-1.915%202.34%202.34%200%200%201-2.33-4.033%202.34%202.34%200%200%200%200-3.831A2.34%202.34%200%200%201%206.35%206.051a2.34%202.34%200%200%200%203.319-1.915%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%223%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "shield-check": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-shield-check%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M20%2013c0%205-3.5%207.5-7.66%208.95a1%201%200%200%201-.67-.01C7.5%2020.5%204%2018%204%2013V6a1%201%200%200%201%201-1c2%200%204.5-1.2%206.24-2.72a1.17%201.17%200%200%201%201.52%200C14.51%203.81%2017%205%2019%205a1%201%200%200%201%201%201z%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m9%2012%202%202%204-4%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "shovel": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-shovel%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M21.56%204.56a1.5%201.5%200%200%201%200%202.122l-.47.47a3%203%200%200%201-4.212-.03%203%203%200%200%201%200-4.243l.44-.44a1.5%201.5%200%200%201%202.121%200z%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3%2022a1%201%200%200%201-1-1v-3.586a1%201%200%200%201%20.293-.707l3.355-3.355a1.205%201.205%200%200%201%201.704%200l3.296%203.296a1.205%201.205%200%200%201%200%201.704l-3.355%203.355a1%201%200%200%201-.707.293z%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m9%2015%207.879-7.878%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "sliders-horizontal": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-sliders-horizontal%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M10%205H3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%2019H3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M14%203v4%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M16%2017v4%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M21%2012h-9%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M21%2019h-5%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M21%205h-7%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M8%2010v4%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M8%2012H3%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "smartphone": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-smartphone%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Crect%20width%3D%2214%22%20height%3D%2220%22%20x%3D%225%22%20y%3D%222%22%20rx%3D%222%22%20ry%3D%222%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%2018h.01%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "star": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-star%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M11.525%202.295a.53.53%200%200%201%20.95%200l2.31%204.679a2.123%202.123%200%200%200%201.595%201.16l5.166.756a.53.53%200%200%201%20.294.904l-3.736%203.638a2.123%202.123%200%200%200-.611%201.878l.882%205.14a.53.53%200%200%201-.771.56l-4.618-2.428a2.122%202.122%200%200%200-1.973%200L6.396%2021.01a.53.53%200%200%201-.77-.56l.881-5.139a2.122%202.122%200%200%200-.611-1.879L2.16%209.795a.53.53%200%200%201%20.294-.906l5.165-.755a2.122%202.122%200%200%200%201.597-1.16z%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "trash-2": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-trash-2%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M10%2011v6%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M14%2011v6%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M19%206v14a2%202%200%200%201-2%202H7a2%202%200%200%201-2-2V6%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M3%206h18%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M8%206V4a2%202%200%200%201%202-2h4a2%202%200%200%201%202%202v2%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "triangle-alert": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-triangle-alert%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22m21.73%2018-8-14a2%202%200%200%200-3.48%200l-8%2014A2%202%200%200%200%204%2021h16a2%202%200%200%200%201.73-3%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%209v4%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M12%2017h.01%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "user": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-user%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M19%2021v-2a4%204%200%200%200-4-4H9a4%204%200%200%200-4%204v2%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%227%22%20r%3D%224%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "users": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-users%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M16%2021v-2a4%204%200%200%200-4-4H6a4%204%200%200%200-4%204v2%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M16%203.128a4%204%200%200%201%200%207.744%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M22%2021v-2a4%204%200%200%200-3-3.87%22%20%2F%3E%0A%20%20%3Ccircle%20cx%3D%229%22%20cy%3D%227%22%20r%3D%224%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "wifi-off": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-wifi-off%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M12%2020h.01%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M8.5%2016.429a5%205%200%200%201%207%200%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M5%2012.859a10%2010%200%200%201%205.17-2.69%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M19%2012.859a10%2010%200%200%200-2.007-1.523%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M2%208.82a15%2015%200%200%201%204.177-2.643%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22M22%208.82a15%2015%200%200%200-11.288-3.764%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m2%202%2020%2020%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "x": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-x%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M18%206%206%2018%22%20%2F%3E%0A%20%20%3Cpath%20d%3D%22m6%206%2012%2012%22%20%2F%3E%0A%3C%2Fsvg%3E",
    "zap": "data:image/svg+xml,%3C!--%20%40license%20lucide-static%20v1.46.0%20-%20ISC%20--%3E%0A%3Csvg%0A%20%20class%3D%22lucide%20lucide-zap%22%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20width%3D%2224%22%0A%20%20height%3D%2224%22%0A%20%20viewBox%3D%220%200%2024%2024%22%0A%20%20fill%3D%22none%22%0A%20%20stroke%3D%22currentColor%22%0A%20%20stroke-width%3D%222%22%0A%20%20stroke-linecap%3D%22round%22%0A%20%20stroke-linejoin%3D%22round%22%0A%3E%0A%20%20%3Cpath%20d%3D%22M15.914%204a1.5%201.5%200%2000-2.474-1.561l-9%209A1.5%201.5%200%20005.5%2014h4.002a.5.5%200%2001.471.666L8.086%2020a1.5%201.5%200%20002.475%201.56l9-9A1.5%201.5%200%200018.5%2010h-3.997a.5.5%200%2001-.472-.667z%22%20%2F%3E%0A%3C%2Fsvg%3E"
  };

  // js/utils/icons.js
  var GOOGLE_G_SVG = `<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
  <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.6154z"/>
  <path fill="#34A853" d="M9 18c2.43 0 4.4673-.8064 5.9564-2.1805l-2.9087-2.2581c-.8064.54-1.8368.8591-3.0477.8591-2.3441 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/>
  <path fill="#FBBC05" d="M3.9641 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2822-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9641 10.71z"/>
  <path fill="#EA4335" d="M9 3.5782c1.3214 0 2.5077.4541 3.4405 1.346l2.5818-2.5818C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6559 3.5782 9 3.5782z"/>
</svg>`;
  function GoogleIcon({ size = 20 } = {}) {
    const el = h("span", { class: "shrink-0 inline-flex", style: { width: rem(size), height: rem(size) } });
    el.innerHTML = GOOGLE_G_SVG;
    el.firstElementChild.setAttribute("width", "100%");
    el.firstElementChild.setAttribute("height", "100%");
    return el;
  }
  function Icon(name, { size = 20, color, className = "", label } = {}) {
    const url = ICON_DATA[name];
    const el = h("span", {
      class: `icon shrink-0 ${className}`,
      style: {
        width: rem(size),
        height: rem(size),
        WebkitMaskImage: url ? `url("${url}")` : "none",
        maskImage: url ? `url("${url}")` : "none",
        color: color || "currentColor"
      }
    });
    if (!url) el.style.backgroundColor = "transparent";
    if (label) {
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", label);
    } else {
      el.setAttribute("aria-hidden", "true");
    }
    return el;
  }

  // js/components/Logo.js
  function Logo({ compact = false } = {}) {
    return h(
      "span",
      { class: cx("inline-flex items-center", compact ? "gap-2" : "gap-2.5") },
      h(
        "span",
        { class: cx("inline-flex items-center justify-center bg-brand-500 shadow-raised", compact ? "w-9 h-9 rounded-[0.625rem]" : "w-10 h-10 rounded-xl") },
        Icon("hammer", { size: compact ? 19 : 21, color: "#fff" })
      ),
      h("span", { class: cx("font-display font-bold leading-none tracking-tight text-brand-500", compact ? "text-[1.5rem]" : "text-[1.625rem]") }, "Bicos")
    );
  }

  // js/components/AppNav.js
  var ITEMS = {
    trabalhador: [
      { id: "mural", icon: "hammer", label: "Vagas", path: "/mural" },
      { id: "minhas-candidaturas", icon: "file-check", label: "Minhas", desktopLabel: "Candidaturas", path: "/minhas-candidaturas" },
      { id: "perfil", icon: "user", label: "Perfil", path: "/perfil" }
    ],
    recrutador: [
      { id: "mural", icon: "hammer", label: "In\xEDcio", path: "/mural" },
      { id: "criar-vaga", icon: "plus", label: "Publicar", desktopLabel: "Publicar vaga", path: "/criar-vaga" },
      { id: "empresa", icon: "building-2", label: "Perfil", path: "/empresa" }
    ]
  };
  var MENU = {
    trabalhador: [
      { icon: "user", label: "Meu perfil", path: "/perfil" },
      { icon: "bookmark", label: "Vagas salvas", path: "/vagas-salvas" },
      { icon: "bell", label: "Notifica\xE7\xF5es", path: "/notificacoes" },
      { icon: "settings", label: "Configura\xE7\xF5es", path: "/configuracoes" }
    ],
    recrutador: [
      { icon: "building-2", label: "Minha empresa", path: "/empresa" },
      { icon: "history", label: "Bicos fechados", path: "/historico" },
      { icon: "bell", label: "Notifica\xE7\xF5es", path: "/notificacoes" },
      { icon: "settings", label: "Configura\xE7\xF5es", path: "/configuracoes" }
    ]
  };
  var MENU_KEY = "app-nav";
  if (typeof window !== "undefined") {
    window.addEventListener("scroll", () => {
      const header = document.querySelector(".app-header");
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    }, { passive: true });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && getUI(MENU_KEY, { menuOpen: false }).menuOpen) setUI(MENU_KEY, { menuOpen: false });
    });
    window.addEventListener("resize", () => {
      placeIndicator(false);
      placePillDot(false);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeIndicator(false));
  }
  var EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  var reducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lastPillDot = null;
  function placePillDot(animate) {
    const dot = document.querySelector(".nav-pill-dot");
    if (!dot || !dot.parentElement.getClientRects().length) return;
    const tab = dot.parentElement.querySelector('[aria-current="page"]');
    if (!tab) {
      dot.style.opacity = "0";
      lastPillDot = null;
      return;
    }
    const x = tab.offsetLeft + (tab.offsetWidth - dot.offsetWidth) / 2;
    const icon = tab.querySelector(".icon");
    const slide = animate && lastPillDot != null && lastPillDot !== x && !reducedMotion();
    dot.style.transition = "none";
    if (slide) {
      dot.style.transform = `translateX(${lastPillDot}px)`;
      if (icon) {
        icon.style.transition = "none";
        icon.style.color = "var(--gray-500)";
      }
      void dot.offsetWidth;
      dot.style.transition = `transform 420ms ${EASE}`;
      if (icon) {
        icon.style.transition = "color 200ms ease 180ms";
        icon.style.color = "#fff";
      }
    }
    dot.style.transform = `translateX(${x}px)`;
    dot.style.opacity = "1";
    lastPillDot = x;
  }
  var lastIndicator = null;
  function placeIndicator(animate) {
    const bar = document.querySelector(".app-header .nav-indicator");
    if (!bar || !bar.parentElement.offsetParent) return;
    const tab = bar.parentElement.querySelector('[aria-current="page"]');
    if (!tab) {
      bar.style.opacity = "0";
      lastIndicator = null;
      return;
    }
    const target = { x: tab.offsetLeft, w: tab.offsetWidth };
    const slide = animate && lastIndicator && !reducedMotion() && (lastIndicator.x !== target.x || lastIndicator.w !== target.w);
    bar.style.transition = "none";
    if (slide) {
      bar.style.transform = `translateX(${lastIndicator.x}px)`;
      bar.style.width = `${lastIndicator.w}px`;
      void bar.offsetWidth;
      bar.style.transition = `transform 380ms ${EASE}, width 380ms ${EASE}`;
    }
    bar.style.transform = `translateX(${target.x}px)`;
    bar.style.width = `${target.w}px`;
    bar.style.opacity = "1";
    lastIndicator = target;
  }
  function AppNav({ role, active, navigate: navigate2, showMobilePill = true, notifications = 0, account = {} }) {
    const items = ITEMS[role] || ITEMS.trabalhador;
    const mobile = showMobilePill ? h(
      "nav",
      {
        "aria-label": "Navega\xE7\xE3o principal",
        class: "lg:hidden fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-3.5 rounded-full px-5 py-2 shadow-raised border border-white/60",
        style: { bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))", backgroundColor: "rgba(255,255,255,0.72)", backdropFilter: "blur(16px) saturate(1.6)", WebkitBackdropFilter: "blur(16px) saturate(1.6)" }
      },
      // One shared blue circle behind the icons; it rolls to the tab you open.
      h("span", {
        "aria-hidden": "true",
        class: "nav-pill-dot pointer-events-none absolute left-0 top-1/2 -mt-5 w-10 h-10 rounded-full bg-brand-500 shadow-[0_4px_12px_rgba(29,75,237,0.35)]",
        style: lastPillDot != null ? { transform: `translateX(${lastPillDot}px)` } : { opacity: "0" }
      }),
      ...items.map((it) => navPill(it, active, navigate2))
    ) : null;
    if (mobile) requestAnimationFrame(() => placePillDot(true));
    return h("div", { class: "contents" }, mobile, topBar({ role, items, active, navigate: navigate2, notifications, account }));
  }
  function navPill(it, active, navigate2) {
    const isActive = active === it.id;
    return h(
      "button",
      {
        type: "button",
        "aria-label": it.label,
        "aria-current": isActive ? "page" : null,
        class: "relative z-10 inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brand-100 active:scale-95 transition-transform",
        onClick: () => navigate2(it.path)
      },
      Icon(it.icon, { size: 22, color: isActive ? "#fff" : "var(--gray-500)" })
    );
  }
  function topBar({ role, items, active, navigate: navigate2, notifications, account }) {
    const menu = getUI(MENU_KEY, { menuOpen: false });
    const go = (path) => {
      setUI(MENU_KEY, { menuOpen: false });
      navigate2(path);
    };
    const logo = h("button", { type: "button", class: "inline-flex items-center pl-1 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brand-100", "aria-label": "Bicos, ir para o in\xEDcio", onClick: () => go("/mural") }, Logo());
    const indicator = h("span", {
      "aria-hidden": "true",
      class: "nav-indicator pointer-events-none absolute left-0 top-[calc(100%+0.375rem)] h-[2px] rounded-full bg-brand-500",
      style: lastIndicator ? { transform: `translateX(${lastIndicator.x}px)`, width: `${lastIndicator.w}px` } : { opacity: "0" }
    });
    const tabs = h(
      "nav",
      { "aria-label": "Navega\xE7\xE3o principal", class: "relative flex items-center gap-7 xl:gap-9" },
      ...items.map((it) => topTab(it, active, go)),
      indicator
    );
    requestAnimationFrame(() => placeIndicator(true));
    const bell = h(
      "button",
      {
        type: "button",
        "aria-label": notifications ? `Notifica\xE7\xF5es, ${notifications} novas` : "Notifica\xE7\xF5es",
        title: "Notifica\xE7\xF5es",
        class: "relative inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/70 text-concrete-900 ring-1 ring-concrete-900/5 transition-colors hover:bg-white",
        onClick: () => go("/notificacoes")
      },
      Icon("bell", { size: 18 }),
      notifications ? h("span", { class: "absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-danger-500 text-white text-[0.625rem] font-bold leading-[1.125rem] text-center ring-2 ring-white" }, String(notifications)) : null
    );
    const avatar = h(
      "span",
      { class: cx("inline-flex items-center justify-center w-8 h-8 rounded-full overflow-hidden text-xs font-bold", role === "recrutador" ? "bg-brand-50" : "bg-accent-50 text-accent-600") },
      account.photo ? h("img", { src: account.photo, alt: "", class: "w-full h-full object-cover" }) : role === "recrutador" ? Icon("building-2", { size: 16, color: "var(--brand)" }) : account.initials || ""
    );
    const menuButton = h("button", {
      type: "button",
      "aria-label": "Menu da conta",
      "aria-haspopup": "menu",
      "aria-expanded": menu.menuOpen ? "true" : "false",
      class: cx("inline-flex items-center gap-2.5 h-11 pl-3.5 pr-1.5 rounded-full border bg-white/80 transition-shadow hover:bg-white hover:shadow-raised", menu.menuOpen ? "border-concrete-300 shadow-raised" : "border-concrete-200"),
      onClick: () => setUI(MENU_KEY, { menuOpen: !menu.menuOpen })
    }, Icon("menu", { size: 18, color: "var(--gray-700)" }), avatar);
    const dropdown = menu.menuOpen ? [
      h("div", { class: "fixed inset-0 z-40", "aria-hidden": "true", onClick: () => setUI(MENU_KEY, { menuOpen: false }) }),
      h(
        "div",
        { role: "menu", class: "absolute right-0 top-full mt-3 z-50 w-72 py-2 bg-white rounded-2xl border border-concrete-200 shadow-float animate-fade-in" },
        h(
          "div",
          { class: "flex items-center gap-3 px-4 pt-2 pb-3" },
          h(
            "span",
            { class: cx("inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden shrink-0 text-sm font-bold", role === "recrutador" ? "bg-brand-50" : "bg-accent-50 text-accent-600") },
            account.photo ? h("img", { src: account.photo, alt: "", class: "w-full h-full object-cover" }) : role === "recrutador" ? Icon("building-2", { size: 20, color: "var(--brand)" }) : account.initials || ""
          ),
          h(
            "div",
            { class: "flex flex-col min-w-0" },
            h("span", { class: "font-semibold text-concrete-900 truncate" }, account.name || ""),
            h("span", { class: "text-sm text-concrete-500 truncate" }, role === "recrutador" ? "Conta de recrutador" : "Conta de trabalhador")
          )
        ),
        h("div", { class: "h-px bg-concrete-200 my-1" }),
        ...(MENU[role] || MENU.trabalhador).map((m) => menuItem(m, () => go(m.path))),
        h("div", { class: "h-px bg-concrete-200 my-1" }),
        menuItem({ icon: "log-out", label: "Sair da conta", danger: true }, () => go("/login"))
      )
    ] : [];
    return h(
      "header",
      { class: cx("app-header hidden lg:block sticky top-0 z-30 page-x pt-3 pb-2 pointer-events-none", window.scrollY > 8 ? "is-scrolled" : "") },
      h(
        "div",
        { class: "app-island pointer-events-auto w-full max-w-[1000px] mx-auto h-[4.25rem] grid grid-cols-[1fr_auto_1fr] items-center gap-6 pl-3 pr-2.5 rounded-full" },
        h("div", { class: "flex items-center min-w-0" }, logo),
        tabs,
        h(
          "div",
          { class: "flex items-center justify-end gap-2" },
          bell,
          h("div", { class: "relative" }, menuButton, ...dropdown)
        )
      )
    );
  }
  function topTab(it, active, go) {
    const isActive = active === it.id;
    return h(
      "button",
      {
        type: "button",
        "aria-current": isActive ? "page" : null,
        class: cx("group relative inline-flex items-center gap-2.5 rounded-xl text-[0.9375rem] font-semibold whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-brand-100", isActive ? "text-concrete-900" : "text-concrete-500 hover:text-concrete-900"),
        onClick: () => go(it.path)
      },
      h(
        "span",
        {
          class: cx(
            "relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200",
            isActive ? "bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-raised" : "bg-concrete-100 text-concrete-600 group-hover:bg-concrete-200 group-hover:scale-105"
          )
        },
        Icon(it.icon, { size: 19 })
      ),
      it.desktopLabel || it.label
    );
  }
  function menuItem(m, onClick) {
    return h("button", {
      type: "button",
      role: "menuitem",
      class: cx("w-full flex items-center gap-3 px-4 h-11 text-left text-[0.9375rem] transition-colors hover:bg-concrete-50", m.danger ? "text-danger-500 font-semibold" : "text-concrete-800"),
      onClick
    }, Icon(m.icon, { size: 18, color: m.danger ? "var(--red-500)" : "var(--gray-500)" }), m.label);
  }

  // js/components/Button.js
  var VARIANTS = {
    primary: "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 border border-transparent",
    secondary: "bg-white text-concrete-900 border border-concrete-300 hover:bg-concrete-50",
    ghost: "bg-transparent text-brand-600 border border-transparent hover:bg-brand-50",
    accent: "bg-accent-500 text-white border border-transparent hover:bg-accent-600",
    danger: "bg-white text-danger-500 border border-danger-100 hover:bg-danger-50",
    inverse: "bg-transparent text-white border border-white/40 hover:bg-white/10"
  };
  var SIZES = {
    sm: "h-11 px-3 text-sm gap-1.5",
    md: "h-12 px-4 text-base gap-2",
    lg: "h-14 px-5 text-base gap-2"
  };
  function Button(props) {
    const {
      label,
      variant = "primary",
      size = "md",
      fullWidth = false,
      iconLeft,
      iconRight,
      iconLeftEl,
      disabled = false,
      loading = false,
      onClick,
      type = "button",
      className = ""
    } = props;
    const btn = h("button", {
      type,
      disabled: disabled || loading,
      "aria-busy": loading ? "true" : null,
      class: cx(
        "inline-flex items-center justify-center rounded-control font-body font-bold whitespace-nowrap select-none",
        "transition-colors duration-150 ease-out active:scale-[0.98]",
        "disabled:bg-concrete-100 disabled:text-concrete-400 disabled:border-concrete-200 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        fullWidth ? "w-full" : "",
        className
      ),
      onClick: disabled || loading ? null : onClick
    });
    if (loading) {
      btn.appendChild(h("span.animate-spin-token", {
        style: { width: "1.1rem", height: "1.1rem", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "9999px" }
      }));
    } else {
      if (iconLeftEl) btn.appendChild(iconLeftEl);
      else if (iconLeft) btn.appendChild(Icon(iconLeft, { size: 20 }));
      btn.appendChild(h("span", {}, label));
      if (iconRight) btn.appendChild(Icon(iconRight, { size: 20 }));
    }
    return btn;
  }

  // js/screens/shared/Splash.js
  function renderSplash(navigate2) {
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-brand-500" },
      h(
        "div",
        { class: "flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center" },
        h("span", { class: "font-display font-bold text-5xl sm:text-6xl text-white tracking-tight" }, "Bicos"),
        h("p", { class: "max-w-xs sm:max-w-sm text-base sm:text-lg text-white/85" }, "Di\xE1rias de obra perto de voc\xEA. Sem taxa para o trabalhador.")
      ),
      h(
        "div",
        { class: "flex flex-col gap-3 px-6 pb-10 sm:pb-14 w-full max-w-app mx-auto" },
        Button({ label: "Entrar", size: "lg", fullWidth: true, variant: "secondary", onClick: () => navigate2("/login") }),
        Button({ label: "Criar minha conta", size: "lg", fullWidth: true, variant: "inverse", onClick: () => navigate2("/escolha-perfil") })
      )
    );
  }

  // js/components/Radio.js
  var uid = 0;
  function RadioCard({ id, name, icon, label, description, checked = false, onChange: onChange2 }) {
    const fieldId = id || "radio-" + uid++;
    return h(
      "label",
      {
        for: fieldId,
        class: cx(
          "flex items-center gap-3.5 min-h-[5.5rem] p-4 rounded-card border cursor-pointer transition-colors",
          checked ? "bg-brand-50 border-brand-500" : "bg-white border-concrete-300 hover:bg-concrete-50"
        )
      },
      h("input", { id: fieldId, type: "radio", name, checked, class: "sr-only", onchange: onChange2 ? () => onChange2() : null }),
      h("span", {
        class: cx("inline-flex items-center justify-center w-11 h-11 rounded-full shrink-0", checked ? "bg-brand-500 text-white" : "bg-concrete-100 text-concrete-600")
      }, Icon(icon, { size: 22 })),
      h(
        "span",
        { class: "flex flex-col gap-0.5 min-w-0" },
        h("span", { class: cx("text-base font-bold", checked ? "text-brand-600" : "text-concrete-900") }, label),
        h("span", { class: "text-sm text-concrete-500" }, description)
      )
    );
  }
  function Switch({ id, label, description, checked = false, onChange: onChange2 }) {
    const fieldId = id || "switch-" + uid++;
    return h(
      "label",
      { for: fieldId, class: "flex items-center gap-3 min-h-12 py-2 cursor-pointer select-none" },
      h(
        "span",
        { class: "flex-1 min-w-0 flex flex-col gap-0.5" },
        h("span", { class: "text-sm font-semibold text-concrete-900" }, label),
        description ? h("span", { class: "text-sm text-concrete-500" }, description) : null
      ),
      h("input", { id: fieldId, type: "checkbox", checked, class: "sr-only", onchange: onChange2 ? (e) => onChange2(e.target.checked) : null }),
      h(
        "span",
        {
          class: cx("relative inline-flex items-center w-11 h-6 rounded-full shrink-0 transition-colors", checked ? "bg-brand-500" : "bg-concrete-300")
        },
        h("span", {
          class: cx("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-card transition-transform", checked ? "translate-x-[1.375rem]" : "translate-x-0.5")
        })
      )
    );
  }

  // js/components/IconButton.js
  var VARIANTS2 = {
    ghost: "bg-transparent text-concrete-700 hover:bg-concrete-100",
    solid: "bg-white text-concrete-700 shadow-card hover:bg-concrete-50",
    brand: "bg-brand-50 text-brand-600 hover:bg-brand-100"
  };
  var SIZES2 = { sm: "w-10 h-10", md: "w-11 h-11", lg: "w-12 h-12" };
  function IconButton({ icon, label, variant = "ghost", size = "md", onClick, className = "", badge }) {
    const sizeClass = SIZES2[size] || SIZES2.md;
    const btn = h("button", {
      type: "button",
      "aria-label": label,
      title: label,
      class: cx(
        "relative inline-flex items-center justify-center rounded-full shrink-0 transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        VARIANTS2[variant] || VARIANTS2.ghost,
        sizeClass,
        className
      ),
      onClick
    }, Icon(icon, { size: 20 }));
    if (badge) {
      btn.appendChild(h("span", {
        class: "absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-danger-500 text-white text-[0.625rem] font-bold leading-4 text-center pointer-events-none"
      }, String(badge)));
    }
    return btn;
  }

  // js/components/TopBar.js
  function BackBar({ title, onBack, actions = [] }) {
    return h(
      "header",
      {
        class: "sticky top-0 z-20 flex items-center gap-1.5 min-h-14 px-2 bg-white border-b border-concrete-200 lg:static lg:bg-transparent lg:border-0 lg:-ml-3 lg:px-0 lg:pb-4 lg:mb-2"
      },
      onBack ? IconButton({ icon: "arrow-left", label: "Voltar", onClick: onBack }) : null,
      h("h1", { class: "flex-1 min-w-0 font-display font-semibold text-xl text-concrete-900 truncate" }, title),
      ...actions.map((a) => IconButton(a))
    );
  }
  function NotificationBell({ count = 0, onClick }) {
    return IconButton({ icon: "bell", label: "Notifica\xE7\xF5es", onClick, badge: count > 0 ? count : null });
  }

  // js/screens/shared/ChooseProfile.js
  var KEY = "escolhaPerfil";
  function renderChooseProfile(navigate2) {
    const ui = getUI(KEY, { role: "trabalhador" });
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-concrete-50" },
      BackBar({ title: "Criar minha conta", onBack: () => goBack("/login") }),
      h(
        "div",
        { class: "flex-1 max-w-app w-full mx-auto px-5 sm:px-8 pt-6 sm:pt-10 pb-8 flex flex-col gap-7" },
        h(
          "div",
          { class: "flex flex-col gap-2.5" },
          h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Criar conta"),
          h("h1", { class: "font-display font-bold text-3xl text-concrete-900" }, "Como voc\xEA vai usar o Bicos?"),
          h("p", { class: "text-base text-concrete-700" }, "D\xE1 para trocar depois no seu perfil.")
        ),
        h(
          "div",
          { class: "flex flex-col gap-3" },
          RadioCard({
            name: "perfil-cadastro",
            icon: "hard-hat",
            label: "Quero pegar bico",
            description: "Sou pedreiro, servente, pintor ou eletricista",
            checked: ui.role === "trabalhador",
            onChange: () => setUI(KEY, { role: "trabalhador" })
          }),
          RadioCard({
            name: "perfil-cadastro",
            icon: "building-2",
            label: "Quero contratar",
            description: "Represento uma construtora ou uma obra",
            checked: ui.role === "recrutador",
            onChange: () => setUI(KEY, { role: "recrutador" })
          })
        )
      ),
      h(
        "div",
        { class: "max-w-app w-full mx-auto px-5 sm:px-8 py-3 sticky bottom-0 bg-white shadow-bar sm:static sm:bg-transparent sm:shadow-none" },
        Button({ label: "Continuar", size: "lg", fullWidth: true, iconRight: "arrow-right", onClick: () => navigate2("/cadastro/" + ui.role) })
      )
    );
  }

  // js/components/Input.js
  var uid2 = 0;
  function Input(props) {
    const {
      id,
      label,
      placeholder = "",
      icon,
      value = "",
      onInput,
      error,
      hint,
      type = "text",
      inputMode,
      mono = false,
      suffix,
      disabled = false,
      autoFocus = false,
      invalid = false
      // red border only, for fields that share one message with a neighbour
    } = props;
    const fieldId = id || "field-" + uid2++;
    const wrap = h("div", { class: "flex flex-col gap-1.5 w-full" });
    if (label) wrap.appendChild(h("label", { for: fieldId, class: "text-sm font-semibold text-concrete-900" }, label));
    const row = h("div", {
      class: cx(
        "flex items-center gap-2 min-h-12 px-3 bg-white rounded-control border transition-colors duration-150",
        error || invalid ? "border-danger-500" : "border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100"
      )
    });
    if (icon) row.appendChild(Icon(icon, { size: 20, color: "var(--text-subtle)" }));
    const inputEl = h("input", {
      id: fieldId,
      "data-focus-id": fieldId,
      type,
      placeholder,
      inputmode: inputMode || null,
      disabled,
      autofocus: autoFocus ? true : null,
      class: cx("flex-1 min-w-0 h-11 bg-transparent outline-none text-base text-concrete-900 placeholder:text-concrete-400", mono ? "font-mono" : ""),
      value,
      oninput: onInput ? (e) => onInput(e.target.value, e) : null
    });
    row.appendChild(inputEl);
    if (suffix) row.appendChild(h("span", { class: "text-sm text-concrete-500 font-semibold shrink-0" }, suffix));
    wrap.appendChild(row);
    if (error) {
      wrap.appendChild(h("span", { class: "flex items-center gap-1.5 text-sm text-danger-500" }, Icon("circle-alert", { size: 14 }), error));
    } else if (hint) {
      wrap.appendChild(h("span", { class: "text-sm text-concrete-500" }, hint));
    }
    return wrap;
  }
  function PasswordInput(props) {
    const { id, label = "Senha", placeholder = "Sua senha", value = "", onInput, error, visible, onToggleVisible } = props;
    const fieldId = id || "field-" + uid2++;
    const wrap = h("div", { class: "flex flex-col gap-1.5 w-full" });
    wrap.appendChild(h("label", { for: fieldId, class: "text-sm font-semibold text-concrete-900" }, label));
    const row = h(
      "div",
      {
        class: cx(
          "flex items-center gap-2 min-h-12 pl-3 pr-1.5 bg-white rounded-control border transition-colors duration-150",
          error ? "border-danger-500" : "border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100"
        )
      },
      h("input", {
        id: fieldId,
        "data-focus-id": fieldId,
        type: visible ? "text" : "password",
        placeholder,
        value,
        class: "flex-1 min-w-0 h-11 bg-transparent outline-none text-base text-concrete-900 placeholder:text-concrete-400",
        oninput: onInput ? (e) => onInput(e.target.value, e) : null
      }),
      h("button", {
        type: "button",
        class: "inline-flex items-center justify-center w-9 h-9 rounded-full text-concrete-500 hover:bg-concrete-100 shrink-0",
        "aria-label": visible ? "Ocultar senha" : "Mostrar senha",
        onClick: onToggleVisible
      }, Icon(visible ? "eye-off" : "eye", { size: 22 }))
    );
    wrap.appendChild(row);
    if (error) wrap.appendChild(h("span", { class: "flex items-center gap-1.5 text-sm text-danger-500" }, Icon("circle-alert", { size: 14 }), error));
    return wrap;
  }

  // js/components/Checkbox.js
  var uid3 = 0;
  function Checkbox({ id, label, checked = false, error = false, onChange: onChange2 }) {
    const fieldId = id || "chk-" + uid3++;
    return h(
      "label",
      { for: fieldId, class: "flex items-center gap-3 min-h-12 py-2 cursor-pointer select-none" },
      h("input", {
        id: fieldId,
        type: "checkbox",
        checked,
        class: "sr-only peer",
        onchange: onChange2 ? (e) => onChange2(e.target.checked, e) : null
      }),
      h("span", {
        class: cx(
          "inline-flex items-center justify-center w-6 h-6 rounded shrink-0 border-2 transition-colors",
          checked ? "bg-brand-500 border-brand-500" : error ? "border-danger-500" : "border-concrete-400 bg-white"
        )
      }, checked ? Icon("check", { size: 16, color: "#fff" }) : null),
      h("span", { class: "text-sm text-concrete-900" }, label)
    );
  }

  // js/utils/format.js
  function maskCPF(v) {
    const d = String(v || "").replace(/\D/g, "").slice(0, 11);
    if (d.length > 9) return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9);
    if (d.length > 6) return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6);
    if (d.length > 3) return d.slice(0, 3) + "." + d.slice(3);
    return d;
  }
  function maskCNPJ(v) {
    const d = String(v || "").replace(/\D/g, "").slice(0, 14);
    if (d.length > 12) return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12);
    if (d.length > 8) return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8);
    if (d.length > 5) return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5);
    if (d.length > 2) return d.slice(0, 2) + "." + d.slice(2);
    return d;
  }
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
  }
  function passwordStrength(v) {
    const s = String(v || "");
    if (!s) return 0;
    let n = 1;
    if (s.length >= 8 && /[a-zA-Z]/.test(s) && /[0-9]/.test(s)) n = 2;
    if (n === 2 && (s.length >= 12 || /[^a-zA-Z0-9]/.test(s))) n = 3;
    return n;
  }
  var STRENGTH_LABEL = [null, "Senha fraca", "Senha m\xE9dia", "Senha forte"];
  function formatBRL(n) {
    const v = Math.round(Number(n) || 0);
    return "R$ " + v.toLocaleString("pt-BR");
  }
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function formatPostDate(isoDate) {
    const [y, m, d] = String(isoDate).split("-").map(Number);
    if (!y || !m || !d) return isoDate;
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }

  // js/screens/shared/Signup.js
  var COMUM_EMAIL = { id: "email", label: "E-mail", question: "Qual \xE9 o seu e-mail?", placeholder: "voce@email.com", icon: "mail", type: "email" };
  var COMUM_SENHA = { id: "senha", label: "Senha", question: "Crie uma senha", help: "Use 8 caracteres ou mais, misturando letras e n\xFAmeros.", placeholder: "Sua senha", isPassword: true };
  var PERFIS = {
    trabalhador: {
      overline: "Cadastro de trabalhador",
      fields: [
        { id: "nome", label: "Nome completo", question: "Como voc\xEA se chama?", help: "Escreva o nome completo, igual ao do seu RG ou CNH.", placeholder: "Jorge Mendes da Silva", icon: "user" },
        { id: "doc", label: "CPF", question: "Qual \xE9 o seu CPF?", help: "Serve para conferir sua identidade. A construtora n\xE3o v\xEA esse n\xFAmero.", placeholder: "000.000.000-00", icon: "id-card", mask: "cpf", mono: true },
        Object.assign({}, COMUM_EMAIL, { help: "\xC9 por aqui que avisamos quando uma construtora escolher voc\xEA." }),
        COMUM_SENHA
      ]
    },
    recrutador: {
      overline: "Cadastro de recrutador",
      fields: [
        { id: "razao", label: "Nome da empresa", question: "Qual \xE9 o nome da empresa?", help: "\xC9 esse nome que aparece no seu perfil e nas vagas que voc\xEA publicar.", placeholder: "Meridiano Constru\xE7\xF5es", icon: "building-2" },
        { id: "doc", label: "CNPJ", question: "Qual \xE9 o CNPJ da empresa?", help: "Conferimos o CNPJ antes de liberar a publica\xE7\xE3o de vagas.", placeholder: "00.000.000/0000-00", icon: "id-card", mask: "cnpj", mono: true },
        Object.assign({}, COMUM_EMAIL, { help: "\xC9 por aqui que avisamos cada novo candidato da sua vaga." }),
        COMUM_SENHA
      ]
    }
  };
  var TAKEN_DOC = ["111.111.111-11", "11.111.111/1111-11"];
  function validateField(field, values, role) {
    const v = String(values[field.id] || "").trim();
    if (field.id === "nome") {
      if (!v) return "Informe o nome completo.";
      if (v.split(/\s+/).length < 2) return "Informe nome e sobrenome.";
      return null;
    }
    if (field.id === "razao") return v.length < 3 ? "Informe o nome da empresa." : null;
    if (field.id === "doc") {
      const digits2 = v.replace(/\D/g, "");
      const need = role === "recrutador" ? 14 : 11;
      if (digits2.length !== need) return role === "recrutador" ? "CNPJ inv\xE1lido. Confira os 14 n\xFAmeros." : "CPF inv\xE1lido. Confira os 11 n\xFAmeros.";
      return null;
    }
    if (field.id === "email") return isValidEmail(v) ? null : "E-mail inv\xE1lido. Confira se tem @ e o dom\xEDnio.";
    if (field.id === "senha") {
      if (v.length < 8) return "Senha curta. Use 8 caracteres ou mais.";
      if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return "Misture letras e n\xFAmeros na senha.";
      return null;
    }
    return null;
  }
  function renderSignup(navigate2, params) {
    const role = params.role === "recrutador" ? "recrutador" : "trabalhador";
    const key = "cadastro-" + role;
    const cfg = PERFIS[role];
    const ui = getUI(key, () => ({ step: 0, values: {}, errors: {}, generalError: false, submitting: false, passwordVisible: false, confirmPassword: "", confirmError: null, accepted: false, acceptError: false }));
    const step = Math.max(0, Math.min(ui.step, cfg.fields.length - 1));
    const field = cfg.fields[step];
    const isLast = step === cfg.fields.length - 1;
    function goBack2() {
      if (step > 0) setUI(key, { step: step - 1, generalError: false });
      else goBack("/escolha-perfil");
    }
    function setValue(v) {
      let value = v;
      if (field.mask === "cpf") value = maskCPF(v);
      if (field.mask === "cnpj") value = maskCNPJ(v);
      setUI(key, (s) => ({ values: Object.assign({}, s.values, { [field.id]: value }), errors: Object.assign({}, s.errors, { [field.id]: null }), generalError: false }));
    }
    function continueStep() {
      const err = validateField(field, ui.values, role);
      if (err) {
        setUI(key, (s) => ({ errors: Object.assign({}, s.errors, { [field.id]: err }) }));
        return;
      }
      if (!isLast) {
        setUI(key, { step: step + 1 });
        return;
      }
      if (ui.confirmPassword !== ui.values.senha) {
        setUI(key, { confirmError: "As senhas n\xE3o s\xE3o iguais. Confira os dois campos." });
        return;
      }
      if (!ui.accepted) {
        setUI(key, { acceptError: true });
        return;
      }
      setUI(key, { submitting: true, acceptError: false });
      setTimeout(() => {
        if (TAKEN_DOC.indexOf(ui.values.doc) >= 0) {
          const docStep = cfg.fields.findIndex((f) => f.id === "doc");
          setUI(key, { submitting: false, step: docStep, generalError: true });
          return;
        }
        setUI(key, { submitting: false });
        setUI("authFlow", { role, email: ui.values.email || "voce@email.com" });
        resetUI(key);
        navigate2("/verificar-email");
      }, 700);
    }
    const strength = passwordStrength(ui.values.senha);
    const strengthColor = strength === 3 ? "bg-success-500" : strength ? "bg-warning-500" : "bg-concrete-200";
    const strengthTextColor = strength === 3 ? "text-success-500" : strength ? "text-warning-500" : "text-concrete-500";
    const header = h(
      "div",
      { class: "sticky top-0 z-10 bg-white border-b border-concrete-200 px-2 pb-3" },
      h(
        "div",
        { class: "flex items-center gap-1.5 min-h-14" },
        IconButton({ icon: "arrow-left", label: "Voltar", onClick: goBack2 }),
        h("span", { class: "flex-1 text-sm font-semibold text-concrete-500" }, `Passo ${step + 1} de ${cfg.fields.length}`)
      ),
      h(
        "div",
        { class: "h-1 mx-2 rounded-full bg-concrete-200 overflow-hidden" },
        h("div", { class: "h-full bg-brand-500 rounded-full transition-all duration-200", style: { width: (step + 1) / cfg.fields.length * 100 + "%" } })
      )
    );
    const generalErrorBox = ui.generalError ? h(
      "div",
      { class: "flex flex-col gap-3.5 p-4 bg-danger-50 border border-danger-500 rounded-card" },
      h(
        "div",
        { class: "flex gap-2.5 items-start" },
        h("span", { class: "shrink-0 mt-0.5" }),
        h(
          "div",
          { class: "flex flex-col gap-1" },
          h("span", { class: "font-semibold text-danger-500" }, role === "recrutador" ? "Esse CNPJ j\xE1 tem conta na Bicos." : "Esse CPF j\xE1 tem conta na Bicos."),
          h("span", { class: "text-sm text-concrete-700" }, "Entre com o e-mail cadastrado ou recupere a senha. Se n\xE3o foi voc\xEA, fale com a gente pelo WhatsApp.")
        )
      ),
      h(
        "div",
        { class: "flex gap-2" },
        Button({ label: "Entrar na conta", variant: "secondary", size: "sm", className: "flex-1", onClick: () => navigate2("/login") }),
        Button({ label: "Recuperar senha", variant: "ghost", size: "sm", className: "flex-1", onClick: () => navigate2("/esqueci-senha") })
      )
    ) : null;
    const questionBlock = h(
      "div",
      { class: "flex flex-col gap-2.5" },
      h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, cfg.overline),
      h("h1", { class: "font-display font-bold text-3xl text-concrete-900" }, field.question),
      h("p", { class: "text-base text-concrete-700" }, field.help)
    );
    let fieldBlock;
    if (field.isPassword) {
      fieldBlock = h(
        "div",
        { class: "flex flex-col gap-5" },
        PasswordInput({
          id: key + "-senha",
          label: field.label,
          placeholder: field.placeholder,
          value: ui.values.senha || "",
          error: ui.errors.senha,
          visible: ui.passwordVisible,
          onToggleVisible: () => setUI(key, { passwordVisible: !ui.passwordVisible }),
          onInput: setValue
        }),
        PasswordInput({
          id: key + "-confirm",
          label: "Confirme a senha",
          placeholder: "Repita a senha",
          value: ui.confirmPassword,
          error: ui.confirmError,
          visible: ui.passwordVisible,
          onToggleVisible: () => setUI(key, { passwordVisible: !ui.passwordVisible }),
          onInput: (v) => setUI(key, { confirmPassword: v, confirmError: null })
        }),
        h(
          "div",
          { class: "flex flex-col gap-5" },
          h(
            "div",
            { class: "flex items-center gap-3" },
            h(
              "span",
              { class: "flex-1 h-1 rounded-full bg-concrete-200 overflow-hidden" },
              h("span", { class: `block h-full rounded-full ${strengthColor} transition-all`, style: { width: strength / 3 * 100 + "%" } })
            ),
            h("span", { class: `text-sm whitespace-nowrap ${strengthTextColor}` }, STRENGTH_LABEL[strength] || "Senha fraca")
          ),
          h(
            "div",
            { class: "flex flex-col gap-1 pt-1 border-t border-concrete-200" },
            Checkbox({ label: "Li e aceito as condi\xE7\xF5es de uso da Bicos", checked: ui.accepted, onChange: (v) => setUI(key, { accepted: v, acceptError: false }) }),
            h(
              "div",
              { class: "flex gap-4 pl-9" },
              h("a", { href: "#", class: "text-sm text-brand-600 underline" }, "Termos de uso"),
              h("a", { href: "#", class: "text-sm text-brand-600 underline" }, "Pol\xEDtica de privacidade")
            ),
            ui.acceptError ? h("span", { class: "flex items-center gap-2 pl-9 text-sm text-danger-500" }, "Aceite as condi\xE7\xF5es para criar sua conta.") : null
          )
        )
      );
    } else {
      fieldBlock = Input({
        id: key + "-" + field.id,
        label: field.label,
        placeholder: field.placeholder,
        icon: field.icon,
        type: field.type || "text",
        value: ui.values[field.id] || "",
        error: ui.errors[field.id],
        mono: Boolean(field.mono),
        inputMode: field.mask ? "numeric" : field.type === "email" ? "email" : "text",
        onInput: setValue,
        autoFocus: true
      });
    }
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-white lg:max-w-app lg:mx-auto lg:shadow-card lg:my-10 lg:rounded-card lg:overflow-hidden" },
      header,
      h(
        "div",
        { class: "flex-1 px-5 sm:px-8 py-8 flex flex-col gap-7 bg-concrete-50" },
        generalErrorBox,
        questionBlock,
        fieldBlock
      ),
      h(
        "div",
        { class: "px-5 sm:px-8 py-3 bg-white shadow-bar" },
        Button({ label: isLast ? "Criar minha conta" : "Continuar", size: "lg", fullWidth: true, loading: ui.submitting, onClick: continueStep })
      )
    );
  }

  // js/components/Card.js
  var TONES = {
    default: "bg-white border border-concrete-200 shadow-card",
    sunken: "bg-concrete-100 border-0",
    brand: "bg-brand-50 border border-brand-200"
  };
  var PADDING = { none: "", sm: "p-3", md: "p-4", lg: "p-5" };
  function Card({ tone = "default", padding = "md", onClick, className = "" }, ...children) {
    const clickable = Boolean(onClick);
    return h(clickable ? "button" : "div", {
      type: clickable ? "button" : null,
      class: cx(
        "rounded-card overflow-hidden text-left w-full",
        TONES[tone] || TONES.default,
        PADDING[padding] ?? PADDING.md,
        clickable ? "transition-transform duration-150 active:scale-[0.98] cursor-pointer" : "",
        className
      ),
      onClick
    }, ...children);
  }

  // js/screens/shared/VerifyEmail.js
  function renderVerifyEmail(navigate2) {
    const flow = getUI("authFlow", { role: "trabalhador", email: "voce@email.com" });
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-concrete-50 lg:max-w-app lg:mx-auto" },
      h(
        "div",
        { class: "flex-1 flex flex-col items-center text-center gap-6 px-6 pt-16 pb-8" },
        h("span", { class: "inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full bg-brand-50" }, Icon("mail-check", { size: 34, color: "var(--brand)" })),
        h(
          "div",
          { class: "flex flex-col gap-2" },
          h("h1", { class: "font-display font-bold text-2xl text-concrete-900" }, "Conta criada. Confirme seu e-mail"),
          h("p", { class: "text-base text-concrete-700" }, "Enviamos um link de confirma\xE7\xE3o para ", h("strong", { class: "text-concrete-900" }, flow.email), ". Abra o link para ativar sua conta.")
        ),
        Card(
          { tone: "sunken", padding: "md", className: "w-full text-left" },
          h(
            "div",
            { class: "flex flex-col gap-3" },
            h("div", { class: "flex gap-2.5 items-center" }, Icon("clock", { size: 20, color: "var(--text-subtle)" }), h("span", { class: "text-sm text-concrete-700" }, "O link vale por 24 horas.")),
            h("div", { class: "flex gap-2.5 items-center" }, Icon("search-x", { size: 20, color: "var(--text-subtle)" }), h("span", { class: "text-sm text-concrete-700" }, "N\xE3o chegou? Confira a caixa de spam."))
          )
        )
      ),
      h(
        "div",
        { class: "px-6 pb-8 flex flex-col gap-2" },
        Button({ label: "Abrir meu e-mail", size: "lg", fullWidth: true, iconLeft: "mail", onClick: () => navigate2("/completar-perfil/" + flow.role) }),
        Button({ label: "Reenviar o link", variant: "ghost", fullWidth: true, onClick: () => {
        } })
      )
    );
  }

  // js/components/Select.js
  var uid4 = 0;
  function Select({ id, label, placeholder = "Selecione", options = [], value = "", onChange: onChange2, error }) {
    const fieldId = id || "select-" + uid4++;
    const wrap = h("div", { class: "flex flex-col gap-1.5 w-full" });
    if (label) wrap.appendChild(h("label", { for: fieldId, class: "text-sm font-semibold text-concrete-900" }, label));
    const row = h("div", {
      class: cx(
        "relative flex items-center min-h-12 px-3 bg-white rounded-control border",
        error ? "border-danger-500" : "border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100"
      )
    });
    const select = h(
      "select",
      {
        id: fieldId,
        "data-focus-id": fieldId,
        class: "flex-1 min-w-0 h-11 bg-transparent outline-none text-base appearance-none pr-6 cursor-pointer",
        onchange: onChange2 ? (e) => onChange2(e.target.value, e) : null
      },
      h("option", { value: "", disabled: true, selected: !value }, placeholder),
      ...options.map((opt) => h("option", { value: opt, selected: opt === value }, opt))
    );
    select.className = cx("flex-1 min-w-0 h-11 bg-transparent outline-none text-base appearance-none pr-6 cursor-pointer", value ? "text-concrete-900" : "text-concrete-400");
    row.appendChild(select);
    row.appendChild(h("span", { class: "pointer-events-none absolute right-3 text-concrete-500" }, Icon("chevron-down", { size: 18 })));
    wrap.appendChild(row);
    if (error) wrap.appendChild(h("span", { class: "flex items-center gap-1.5 text-sm text-danger-500" }, Icon("circle-alert", { size: 14 }), error));
    return wrap;
  }

  // js/components/Tag.js
  function Tag({ label, icon, selected = false, onClick, onRemove, className = "" }) {
    const tag = h("button", {
      type: "button",
      "aria-pressed": onRemove ? null : selected ? "true" : "false",
      class: cx(
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        selected ? "bg-brand-50 border border-brand-500 text-brand-600" : "bg-white border border-concrete-300 text-concrete-700 hover:bg-concrete-50",
        className
      ),
      onClick
    }, icon ? Icon(icon, { size: 16 }) : null, h("span", {}, label));
    if (onRemove) {
      tag.appendChild(h("span", {
        class: "ml-0.5 -mr-1 inline-flex items-center justify-center w-4 h-4",
        onClick: (e) => {
          e.stopPropagation();
          onRemove(e);
        }
      }, Icon("x", { size: 14 })));
    }
    return tag;
  }

  // js/components/PhotoSlot.js
  function PhotoSlot({ shape = "rect", value, onChange: onChange2, placeholder = "Toque para escolher uma foto", className = "", height = "9rem" }) {
    const isCircle = shape === "circle";
    const input = h("input", {
      type: "file",
      accept: "image/*",
      class: "sr-only",
      onchange: (e) => {
        const file = e.target.files && e.target.files[0];
        if (file && onChange2) onChange2(URL.createObjectURL(file));
      }
    });
    return h(
      "label",
      {
        class: cx(
          "relative flex items-center justify-center overflow-hidden cursor-pointer bg-concrete-200 border-2 border-dashed border-concrete-300 hover:border-brand-400 transition-colors",
          isCircle ? "rounded-full" : "rounded-card w-full",
          className
        ),
        style: isCircle ? {} : { height }
      },
      input,
      value ? h("img", { src: value, alt: "", class: "absolute inset-0 w-full h-full object-cover" }) : h("span", { class: "flex flex-col items-center gap-1.5 text-concrete-500 px-3 text-center" }, Icon("camera", { size: isCircle ? 20 : 24 }), h("span", { class: "text-xs font-semibold" }, placeholder))
    );
  }

  // js/screens/shared/CompleteProfile.js
  function renderCompleteProfile(navigate2, params) {
    const role = params.role === "recrutador" ? "recrutador" : "trabalhador";
    return role === "recrutador" ? recruiterFlow(navigate2) : workerFlow(navigate2);
  }
  function shell(step, total, onBack, children, onContinue, label) {
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-white lg:max-w-app lg:mx-auto lg:shadow-card lg:my-10 lg:rounded-card lg:overflow-hidden" },
      h(
        "div",
        { class: "sticky top-0 z-10 bg-white border-b border-concrete-200 px-2 pb-3" },
        h(
          "div",
          { class: "flex items-center gap-1.5 min-h-14" },
          step > 0 ? IconButton({ icon: "arrow-left", label: "Voltar", onClick: onBack }) : h("span", { class: "w-11 h-11" }),
          h("span", { class: "flex-1 text-sm font-semibold text-concrete-500" }, `Passo ${step + 1} de ${total}`)
        ),
        h(
          "div",
          { class: "h-1 mx-2 rounded-full bg-concrete-200 overflow-hidden" },
          h("div", { class: "h-full bg-brand-500 rounded-full transition-all duration-200", style: { width: (step + 1) / total * 100 + "%" } })
        )
      ),
      h("div", { class: "flex-1 px-5 sm:px-8 py-8 flex flex-col gap-7 bg-concrete-50" }, ...children),
      h(
        "div",
        { class: "px-5 sm:px-8 py-3 bg-white shadow-bar" },
        Button({ label, size: "lg", fullWidth: true, onClick: onContinue })
      )
    );
  }
  function heading(overline, title, help) {
    return h(
      "div",
      { class: "flex flex-col gap-2.5" },
      h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, overline),
      h("h1", { class: "font-display font-bold text-3xl text-concrete-900" }, title),
      h("p", { class: "text-base text-concrete-700" }, help)
    );
  }
  function workerFlow(navigate2) {
    const key = "completar-trabalhador";
    const ui = getUI(key, { step: 0, photo: null, cargo: "", regiao: "", especialidades: [], errors: {} });
    if (ui.step === 0) {
      return shell(0, 2, () => navigate2("/verificar-email"), [
        heading("Completar perfil", "Uma foto e o seu cargo", "Isso aparece no seu perfil para as construtoras que virem seu bico."),
        h(
          "div",
          { class: "flex flex-col items-center gap-3" },
          PhotoSlot({ shape: "circle", value: ui.photo, onChange: (v) => setUI(key, { photo: v }), className: "w-24 h-24", placeholder: "Sua foto" }),
          Button({ label: "Pular por enquanto", variant: "ghost", onClick: () => setUI(key, { step: 1 }) })
        ),
        Select({
          label: "Cargo ou especialidade principal",
          placeholder: "Selecione seu cargo",
          options: CARGOS_TRABALHADOR,
          value: ui.cargo,
          error: ui.errors.cargo,
          onChange: (v) => setUI(key, { cargo: v, errors: Object.assign({}, ui.errors, { cargo: null }) })
        })
      ], () => {
        if (!ui.cargo) {
          setUI(key, { errors: { cargo: "Selecione seu cargo ou especialidade principal." } });
          return;
        }
        setUI(key, { step: 1, errors: {} });
      }, "Continuar");
    }
    return shell(1, 2, () => setUI(key, { step: 0 }), [
      heading("Completar perfil", "Onde e no que voc\xEA trabalha", "Usamos para mostrar bicos perto de voc\xEA e do jeito certo para seu of\xEDcio."),
      Select({
        label: "Regi\xE3o de atua\xE7\xE3o",
        placeholder: "Selecione bairro e cidade",
        options: REGIOES_TRABALHADOR,
        value: ui.regiao,
        error: ui.errors.regiao,
        onChange: (v) => setUI(key, { regiao: v, errors: Object.assign({}, ui.errors, { regiao: null }) })
      }),
      h(
        "div",
        { class: "flex flex-col gap-2.5" },
        h("span", { class: "text-sm font-semibold text-concrete-900" }, "Especialidades"),
        h("div", { class: "flex flex-wrap gap-2" }, ...ESPECIALIDADES.map((e) => Tag({
          label: e,
          selected: ui.especialidades.includes(e),
          onClick: () => setUI(key, { especialidades: ui.especialidades.includes(e) ? ui.especialidades.filter((x) => x !== e) : ui.especialidades.concat([e]), errors: Object.assign({}, ui.errors, { especialidades: null }) })
        }))),
        ui.errors.especialidades ? h("span", { class: "text-sm text-danger-500" }, ui.errors.especialidades) : null
      )
    ], () => {
      const errors = {};
      if (!ui.regiao) errors.regiao = "Selecione sua regi\xE3o de atua\xE7\xE3o.";
      if (ui.especialidades.length === 0) errors.especialidades = "Escolha ao menos uma especialidade.";
      if (Object.keys(errors).length) {
        setUI(key, { errors });
        return;
      }
      setRole("trabalhador");
      navigate2("/mural");
    }, "Concluir perfil");
  }
  function recruiterFlow(navigate2) {
    const key = "completar-recrutador";
    const ui = getUI(key, { step: 0, capa: null, logo: null, tipoObra: "", regiao: "", errors: {} });
    if (ui.step === 0) {
      return shell(0, 2, () => navigate2("/verificar-email"), [
        heading("Completar perfil", "Capa e logo da construtora", "Isso aparece no perfil que os candidatos veem antes de se candidatar."),
        h(
          "div",
          { class: "flex flex-col gap-2" },
          h("span", { class: "text-sm font-semibold text-concrete-900" }, "Foto de capa"),
          PhotoSlot({ shape: "rect", value: ui.capa, onChange: (v) => setUI(key, { capa: v }), height: "7.5rem", placeholder: "Capa da construtora" })
        ),
        h(
          "div",
          { class: "flex items-center gap-4" },
          PhotoSlot({ shape: "circle", value: ui.logo, onChange: (v) => setUI(key, { logo: v }), className: "w-[4.5rem] h-[4.5rem] shrink-0", placeholder: "Logo" }),
          h(
            "div",
            { class: "flex flex-col gap-1" },
            h("span", { class: "text-sm font-semibold text-concrete-900" }, "Foto ou logo de perfil"),
            Button({ label: "Pular por enquanto", variant: "ghost", size: "sm", onClick: () => setUI(key, { step: 1 }) })
          )
        )
      ], () => setUI(key, { step: 1 }), "Continuar");
    }
    return shell(1, 2, () => setUI(key, { step: 0 }), [
      heading("Completar perfil", "Sobre a sua obra", "Usamos para destacar o tipo de obra e mostrar suas vagas na regi\xE3o certa."),
      Select({ label: "Tipo de obra", placeholder: "Selecione o tipo de obra", options: TIPOS_OBRA, value: ui.tipoObra, error: ui.errors.tipoObra, onChange: (v) => setUI(key, { tipoObra: v, errors: Object.assign({}, ui.errors, { tipoObra: null }) }) }),
      Select({ label: "Regi\xE3o de atua\xE7\xE3o", placeholder: "Selecione a regi\xE3o", options: REGIOES_RECRUTADOR, value: ui.regiao, error: ui.errors.regiao, onChange: (v) => setUI(key, { regiao: v, errors: Object.assign({}, ui.errors, { regiao: null }) }) })
    ], () => {
      const errors = {};
      if (!ui.tipoObra) errors.tipoObra = "Selecione o tipo de obra.";
      if (!ui.regiao) errors.regiao = "Selecione sua regi\xE3o de atua\xE7\xE3o.";
      if (Object.keys(errors).length) {
        setUI(key, { errors });
        return;
      }
      setRole("recrutador");
      navigate2("/mural");
    }, "Concluir perfil");
  }

  // js/screens/shared/Login.js
  var KEY2 = "login";
  function renderLogin(navigate2) {
    const ui = getUI(KEY2, { identifier: "", password: "", visible: false, role: "trabalhador", submitting: false });
    function submit() {
      setUI(KEY2, { submitting: true });
      setTimeout(() => {
        setRole(ui.role);
        setUI(KEY2, { submitting: false });
        navigate2("/mural");
      }, 500);
    }
    return h(
      "div",
      { class: "min-h-screen bg-white" },
      h(
        "div",
        { class: "max-w-app mx-auto px-6 sm:px-8 pt-14 pb-10 flex flex-col gap-8" },
        h(
          "div",
          { class: "flex flex-col items-center gap-5 text-center" },
          h("span", { class: "inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-500" }, Icon("hammer", { size: 22, color: "#fff" })),
          h("h1", { class: "font-display font-bold text-3xl text-concrete-900" }, "Ol\xE1 de novo")
        ),
        h(
          "div",
          { class: "flex flex-col gap-5" },
          Input({
            id: "login-identifier",
            label: "E-mail, CPF ou CNPJ",
            placeholder: "voce@email.com",
            icon: "mail",
            value: ui.identifier,
            onInput: (v) => setUI(KEY2, { identifier: v })
          }),
          PasswordInput({
            id: "login-password",
            value: ui.password,
            visible: ui.visible,
            onToggleVisible: () => setUI(KEY2, { visible: !ui.visible }),
            onInput: (v) => setUI(KEY2, { password: v })
          }),
          h(
            "div",
            { class: "flex flex-col gap-2" },
            h("span", { class: "text-sm font-semibold text-concrete-900" }, "Entrar como (demonstra\xE7\xE3o)"),
            h(
              "div",
              { class: "flex gap-2" },
              Tag({ label: "Trabalhador", selected: ui.role === "trabalhador", onClick: () => setUI(KEY2, { role: "trabalhador" }) }),
              Tag({ label: "Recrutador", selected: ui.role === "recrutador", onClick: () => setUI(KEY2, { role: "recrutador" }) })
            )
          ),
          Button({ label: "Entrar", size: "lg", fullWidth: true, loading: ui.submitting, onClick: submit }),
          h(
            "div",
            { class: "flex items-center gap-3 py-1" },
            h("span", { class: "flex-1 h-px bg-concrete-200" }),
            h("span", { class: "text-xs text-concrete-500" }, "ou"),
            h("span", { class: "flex-1 h-px bg-concrete-200" })
          ),
          Button({ label: "Continuar com o Google", variant: "secondary", fullWidth: true, iconLeftEl: GoogleIcon({ size: 20 }), onClick: submit }),
          Button({ label: "Continuar com o celular", variant: "secondary", fullWidth: true, iconLeft: "phone-call", onClick: submit })
        ),
        h(
          "div",
          { class: "flex flex-col items-center gap-1" },
          Button({ label: "Esqueci minha senha", variant: "ghost", onClick: () => navigate2("/esqueci-senha") }),
          Button({ label: "Criar minha conta", variant: "ghost", onClick: () => navigate2("/escolha-perfil") })
        )
      )
    );
  }

  // js/screens/shared/ForgotPassword.js
  var KEY3 = "forgot-password";
  function renderForgotPassword(navigate2) {
    const ui = getUI(KEY3, { email: "", error: null, sent: false, submitting: false });
    const content = ui.sent ? h(
      "div",
      { class: "flex-1 flex flex-col items-center text-center gap-5 px-6 pt-16" },
      h("span", { class: "inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full bg-brand-50" }, Icon("mail-check", { size: 34, color: "var(--brand)" })),
      h("h1", { class: "font-display font-bold text-2xl text-concrete-900" }, "Link enviado"),
      h("p", { class: "text-base text-concrete-700" }, "Mandamos um link de redefini\xE7\xE3o para ", h("strong", { class: "text-concrete-900" }, ui.email), ". Abra o link para criar uma senha nova."),
      Button({ label: "J\xE1 abri o link", variant: "secondary", onClick: () => navigate2("/redefinir-senha") })
    ) : h(
      "div",
      { class: "flex-1 flex flex-col gap-7 px-5 sm:px-8 py-8" },
      h(
        "div",
        { class: "flex flex-col gap-2.5" },
        h("h1", { class: "font-display font-bold text-3xl text-concrete-900" }, "Esqueceu sua senha?"),
        h("p", { class: "text-base text-concrete-700" }, "Informe o e-mail da sua conta. Enviamos um link para voc\xEA criar uma senha nova.")
      ),
      Input({ id: "forgot-email", label: "E-mail", placeholder: "voce@email.com", icon: "mail", value: ui.email, error: ui.error, onInput: (v) => setUI(KEY3, { email: v, error: null }) })
    );
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-white lg:max-w-app lg:mx-auto" },
      h(
        "div",
        { class: "flex items-center gap-1.5 min-h-14 px-2 border-b border-concrete-200" },
        IconButton({ icon: "arrow-left", label: "Voltar", onClick: () => goBack("/login") }),
        h("span", { class: "font-display font-semibold text-xl text-concrete-900" }, "Recuperar senha")
      ),
      content,
      !ui.sent ? h(
        "div",
        { class: "px-5 sm:px-8 py-3" },
        Button({
          label: "Enviar link",
          size: "lg",
          fullWidth: true,
          loading: ui.submitting,
          onClick: () => {
            if (!isValidEmail(ui.email)) {
              setUI(KEY3, { error: "E-mail inv\xE1lido. Confira se tem @ e o dom\xEDnio." });
              return;
            }
            setUI(KEY3, { submitting: true });
            setTimeout(() => setUI(KEY3, { submitting: false, sent: true }), 600);
          }
        })
      ) : null
    );
  }

  // js/screens/shared/ResetPassword.js
  var KEY4 = "reset-password";
  function renderResetPassword(navigate2) {
    const ui = getUI(KEY4, { senha: "", confirm: "", visible: false, error: null, done: false, submitting: false });
    const strength = passwordStrength(ui.senha);
    const strengthColor = strength === 3 ? "bg-success-500" : strength ? "bg-warning-500" : "bg-concrete-200";
    if (ui.done) {
      return h(
        "div",
        { class: "min-h-screen flex flex-col items-center justify-center text-center gap-5 px-6 bg-white lg:max-w-app lg:mx-auto" },
        h("span", { class: "inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full bg-success-50" }, Icon("circle-check", { size: 34, color: "var(--green-500)" })),
        h("h1", { class: "font-display font-bold text-2xl text-concrete-900" }, "Senha redefinida"),
        h("p", { class: "text-base text-concrete-700" }, "Use sua nova senha para entrar na sua conta."),
        Button({ label: "Ir para o login", size: "lg", onClick: () => navigate2("/login") })
      );
    }
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-white lg:max-w-app lg:mx-auto" },
      h(
        "div",
        { class: "flex items-center gap-1.5 min-h-14 px-2 border-b border-concrete-200" },
        IconButton({ icon: "arrow-left", label: "Voltar", onClick: () => goBack("/login") }),
        h("span", { class: "font-display font-semibold text-xl text-concrete-900" }, "Criar nova senha")
      ),
      h(
        "div",
        { class: "flex-1 flex flex-col gap-7 px-5 sm:px-8 py-8" },
        h(
          "div",
          { class: "flex flex-col gap-2.5" },
          h("h1", { class: "font-display font-bold text-3xl text-concrete-900" }, "Escolha uma senha nova"),
          h("p", { class: "text-base text-concrete-700" }, "Use 8 caracteres ou mais, misturando letras e n\xFAmeros.")
        ),
        PasswordInput({ id: "reset-senha", value: ui.senha, visible: ui.visible, onToggleVisible: () => setUI(KEY4, { visible: !ui.visible }), onInput: (v) => setUI(KEY4, { senha: v, error: null }) }),
        h(
          "div",
          { class: "flex items-center gap-3" },
          h("span", { class: "flex-1 h-1 rounded-full bg-concrete-200 overflow-hidden" }, h("span", { class: `block h-full rounded-full ${strengthColor}`, style: { width: strength / 3 * 100 + "%" } })),
          h("span", { class: "text-sm text-concrete-500 whitespace-nowrap" }, STRENGTH_LABEL[strength] || "Senha fraca")
        ),
        PasswordInput({ id: "reset-confirm", label: "Confirme a senha nova", value: ui.confirm, visible: ui.visible, onToggleVisible: () => setUI(KEY4, { visible: !ui.visible }), error: ui.error, onInput: (v) => setUI(KEY4, { confirm: v, error: null }) })
      ),
      h(
        "div",
        { class: "px-5 sm:px-8 py-3" },
        Button({
          label: "Salvar nova senha",
          size: "lg",
          fullWidth: true,
          loading: ui.submitting,
          onClick: () => {
            if (ui.senha.length < 8) {
              setUI(KEY4, { error: "Senha curta. Use 8 caracteres ou mais." });
              return;
            }
            if (ui.senha !== ui.confirm) {
              setUI(KEY4, { error: "As senhas n\xE3o s\xE3o iguais. Confira os dois campos." });
              return;
            }
            setUI(KEY4, { submitting: true });
            setTimeout(() => setUI(KEY4, { submitting: false, done: true }), 600);
          }
        })
      )
    );
  }

  // js/components/EmptyState.js
  var TONES2 = {
    default: { iconBg: "bg-concrete-100", iconColor: "var(--text-subtle)" },
    danger: { iconBg: "bg-danger-50", iconColor: "var(--red-500)" },
    offline: { iconBg: "bg-warning-50", iconColor: "var(--amber-500)" }
  };
  function EmptyState({ icon, title, description, actionLabel, onAction, tone = "default", className = "" }) {
    const t = TONES2[tone] || TONES2.default;
    return h(
      "div",
      { class: cx("flex flex-col items-center text-center gap-4 px-6 py-12", className) },
      h("span", { class: cx("inline-flex items-center justify-center w-16 h-16 rounded-full", t.iconBg) }, Icon(icon, { size: 30, color: t.iconColor })),
      h(
        "div",
        { class: "flex flex-col gap-1.5 max-w-xs" },
        h("h3", { class: "text-base font-bold text-concrete-900" }, title),
        description ? h("p", { class: "text-sm text-concrete-500" }, description) : null
      ),
      actionLabel ? Button({ label: actionLabel, variant: "secondary", size: "sm", onClick: onAction }) : null
    );
  }

  // js/screens/shared/Notifications.js
  var WORKER_NOTIFS = [
    { icon: "circle-check", tone: "success", title: "Voc\xEA foi pr\xE9-selecionado", text: "Construtora Meridiano quer falar com voc\xEA sobre Pedreiro de acabamento.", time: "H\xE1 12 min" },
    { icon: "zap", tone: "danger", title: "Bico urgente perto de voc\xEA", text: "Pintor em Mooca, hoje \xE0s 8h. A combinar.", time: "H\xE1 2h" },
    { icon: "star", tone: "accent", title: "Avalie sua \xFAltima di\xE1ria", text: "Obra Canga\xEDba \xB7 Servente de obra, 30 ago.", time: "Ontem" },
    { icon: "file-check", tone: "brand", title: "Candidatura em an\xE1lise", text: "Reforma Serra de Bragan\xE7a est\xE1 avaliando seu perfil.", time: "2 dias atr\xE1s" }
  ];
  var RECRUITER_NOTIFS = [
    { icon: "users", tone: "brand", title: "2 novos candidatos", text: "Pedreiro de acabamento \xB7 Tatuap\xE9 recebeu novas candidaturas.", time: "H\xE1 30 min" },
    { icon: "circle-check", tone: "success", title: "Bico fechado", text: "Todas as vagas de Servente de obra foram preenchidas.", time: "H\xE1 3h" },
    { icon: "star", tone: "accent", title: "Avalie o trabalhador", text: "Marcos Aur\xE9lio concluiu a di\xE1ria em 21 ago.", time: "Ontem" }
  ];
  var TONE_BG = { success: "bg-success-50", danger: "bg-danger-50", accent: "bg-accent-50", brand: "bg-brand-50" };
  var TONE_FG = { success: "var(--green-500)", danger: "var(--red-500)", accent: "var(--teal-500)", brand: "var(--brand)" };
  function renderNotifications(navigate2) {
    const list = getRole() === "recrutador" ? RECRUITER_NOTIFS : WORKER_NOTIFS;
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0" },
      BackBar({ title: "Notifica\xE7\xF5es", onBack: () => goBack("/mural") }),
      list.length === 0 ? EmptyState({ icon: "bell", title: "Nenhuma notifica\xE7\xE3o", description: "Avisamos aqui quando algo importante acontecer." }) : h("div", { class: "flex flex-col px-4 py-2 gap-2" }, ...list.map((n) => h(
        "div",
        { class: "flex gap-3 p-4 bg-white border border-concrete-200 rounded-card" },
        h("span", { class: `shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${TONE_BG[n.tone]}` }, Icon(n.icon, { size: 18, color: TONE_FG[n.tone] })),
        h(
          "div",
          { class: "flex flex-col gap-1 min-w-0" },
          h("span", { class: "font-semibold text-concrete-900" }, n.title),
          h("span", { class: "text-sm text-concrete-600" }, n.text),
          h("span", { class: "text-xs text-concrete-400" }, n.time)
        )
      )))
    );
  }

  // js/screens/shared/Settings.js
  function Row({ icon, label, description, onClick, danger = false }) {
    return h(
      "button",
      {
        type: "button",
        onClick,
        class: "flex items-center gap-3.5 w-full min-h-14 px-4 py-3 bg-white text-left hover:bg-concrete-50 transition-colors"
      },
      h("span", { class: `shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${danger ? "bg-danger-50" : "bg-concrete-100"}` }, Icon(icon, { size: 18, color: danger ? "var(--red-500)" : "var(--gray-600)" })),
      h(
        "span",
        { class: "flex-1 min-w-0 flex flex-col" },
        h("span", { class: `font-semibold ${danger ? "text-danger-500" : "text-concrete-900"}` }, label),
        description ? h("span", { class: "text-sm text-concrete-500" }, description) : null
      ),
      Icon("chevron-right", { size: 18, color: "var(--gray-400)" })
    );
  }
  function Section(title, rowsEl) {
    return h(
      "div",
      { class: "flex flex-col gap-2" },
      title ? h("div", { class: "px-4 text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, title) : null,
      h("div", { class: "flex flex-col divide-y divide-concrete-200 bg-white border border-concrete-200 rounded-card overflow-hidden mx-4 sm:mx-0" }, ...rowsEl)
    );
  }
  function renderSettings(navigate2) {
    const role = getRole();
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-concrete-50 gap-6 pb-8 lg:bg-transparent lg:min-h-0" },
      BackBar({ title: "Configura\xE7\xF5es", onBack: () => goBack(role === "recrutador" ? "/empresa" : "/perfil") }),
      h(
        "div",
        { class: "flex flex-col gap-6 sm:px-0" },
        Section("Conta", [
          Row({ icon: "user", label: "Editar perfil", onClick: () => navigate2(role === "recrutador" ? "/empresa/editar" : "/perfil/editar") }),
          Row({ icon: "lock", label: "Trocar senha", onClick: () => navigate2("/esqueci-senha") })
        ]),
        Section("Prefer\xEAncias", [
          Row({ icon: "bell", label: "Notifica\xE7\xF5es", description: "Bicos urgentes, candidaturas e mensagens", onClick: () => navigate2("/notificacoes") }),
          Row({ icon: "shield-check", label: "Privacidade e dados", description: "Exportar ou excluir sua conta", onClick: () => navigate2("/configuracoes/privacidade") })
        ]),
        Section("Sobre", [
          Row({ icon: "file-check", label: "Termos de uso", onClick: () => {
          } }),
          Row({ icon: "shield-check", label: "Pol\xEDtica de privacidade", onClick: () => {
          } })
        ]),
        Section("", [
          Row({ icon: "log-out", label: "Sair da conta", danger: true, onClick: () => navigate2("/login") })
        ])
      )
    );
  }

  // js/components/Modal.js
  function Dialog({ open, tone = "default", title, description, confirmLabel, onConfirm, cancelLabel = "Cancelar", onCancel }) {
    if (!open) return null;
    return h(
      "div",
      {
        class: "fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-6",
        style: { background: "var(--scrim)" },
        onClick: onCancel
      },
      h(
        "div",
        {
          class: "w-full sm:max-w-sm bg-white rounded-t-sheet sm:rounded-sheet p-5 flex flex-col gap-4 animate-slide-up",
          onClick: (e) => e.stopPropagation()
        },
        h(
          "div",
          { class: "flex flex-col gap-1.5" },
          h("h3", { class: "text-lg font-bold text-concrete-900" }, title),
          description ? h("p", { class: "text-sm text-concrete-600" }, description) : null
        ),
        h(
          "div",
          { class: "flex gap-3 pt-1" },
          Button({ label: cancelLabel, variant: "secondary", className: "flex-1", onClick: onCancel }),
          Button({ label: confirmLabel, variant: tone === "danger" ? "danger" : "primary", className: "flex-1", onClick: onConfirm })
        )
      )
    );
  }
  function Sheet({ open, title, onClose, maxHeight = "85vh" }, ...children) {
    if (!open) return null;
    return h(
      "div",
      {
        class: "fixed inset-0 z-40 flex items-end justify-center lg:items-center lg:p-6",
        style: { background: "var(--scrim)" },
        onClick: onClose
      },
      h(
        "div",
        {
          // A bottom sheet on phones; a centred dialog on tablet/desktop.
          class: "w-full sm:max-w-app lg:max-w-[34rem] bg-white rounded-t-sheet lg:rounded-sheet shadow-sheet p-4 lg:p-6 flex flex-col gap-4 overflow-y-auto animate-slide-up",
          style: { maxHeight },
          onClick: (e) => e.stopPropagation()
        },
        h(
          "div",
          { class: "flex items-center justify-between" },
          h("span", { class: "text-lg font-bold text-concrete-900" }, title),
          h("button", { type: "button", "aria-label": "Fechar", class: "inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-concrete-100", onClick: onClose }, Icon("x", { size: 20 }))
        ),
        ...children
      )
    );
  }

  // js/screens/shared/Privacy.js
  var KEY5 = "privacy";
  function renderPrivacy(navigate2) {
    const ui = getUI(KEY5, { exporting: false, exported: false, confirmDelete: false });
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-concrete-50 gap-5 pb-8 lg:bg-transparent lg:min-h-0" },
      BackBar({ title: "Privacidade e dados", onBack: () => goBack("/configuracoes") }),
      h(
        "div",
        { class: "flex flex-col gap-5 px-4 sm:px-0" },
        h("p", { class: "text-sm text-concrete-600" }, "De acordo com a LGPD, voc\xEA pode baixar uma c\xF3pia de tudo o que a Bicos guarda sobre voc\xEA, ou excluir sua conta e seus dados por completo."),
        Card(
          { padding: "md" },
          h(
            "div",
            { class: "flex flex-col gap-3" },
            h(
              "div",
              { class: "flex gap-3 items-start" },
              Icon("download", { size: 20, color: "var(--text-subtle)" }),
              h(
                "div",
                { class: "flex flex-col gap-1" },
                h("span", { class: "font-semibold text-concrete-900" }, "Exportar meus dados"),
                h("span", { class: "text-sm text-concrete-600" }, "Perfil, candidaturas, avalia\xE7\xF5es e mensagens em um arquivo \xFAnico.")
              )
            ),
            ui.exported ? h("span", { class: "flex items-center gap-2 text-sm text-success-500 font-semibold" }, Icon("circle-check", { size: 16, color: "var(--green-500)" }), "Arquivo enviado para o seu e-mail.") : Button({ label: "Exportar meus dados", variant: "secondary", loading: ui.exporting, onClick: () => {
              setUI(KEY5, { exporting: true });
              setTimeout(() => setUI(KEY5, { exporting: false, exported: true }), 900);
            } })
          )
        ),
        Card(
          { padding: "md", className: "border-danger-100" },
          h(
            "div",
            { class: "flex flex-col gap-3" },
            h(
              "div",
              { class: "flex gap-3 items-start" },
              Icon("triangle-alert", { size: 20, color: "var(--red-500)" }),
              h(
                "div",
                { class: "flex flex-col gap-1" },
                h("span", { class: "font-semibold text-danger-500" }, "Excluir minha conta"),
                h("span", { class: "text-sm text-concrete-600" }, "Remove seu perfil, candidaturas e hist\xF3rico. Essa a\xE7\xE3o n\xE3o pode ser desfeita.")
              )
            ),
            Button({ label: "Excluir minha conta", variant: "danger", onClick: () => setUI(KEY5, { confirmDelete: true }) })
          )
        )
      ),
      Dialog({
        open: ui.confirmDelete,
        tone: "danger",
        title: "Excluir sua conta?",
        description: "Isso apaga seu perfil, candidaturas e hist\xF3rico da Bicos para sempre. N\xE3o d\xE1 para desfazer.",
        confirmLabel: "Sim, excluir conta",
        onConfirm: () => navigate2("/login"),
        cancelLabel: "Cancelar",
        onCancel: () => setUI(KEY5, { confirmDelete: false })
      })
    );
  }

  // js/components/Badge.js
  var TONES3 = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-500",
    warning: "bg-warning-50 text-warning-500",
    danger: "bg-danger-50 text-danger-500",
    accent: "bg-accent-50 text-accent-600",
    neutral: "bg-concrete-100 text-concrete-500",
    inverse: "bg-white/15 text-white"
  };
  function Badge({ label, tone = "neutral", icon, className = "" }) {
    return h("span", {
      class: cx("inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-xs font-bold whitespace-nowrap", TONES3[tone] || TONES3.neutral, className)
    }, icon ? Icon(icon, { size: 14 }) : null, label);
  }

  // js/components/Rating.js
  function Rating({ value = 0, count, showValue = true, editable = false, onChange: onChange2, size = 14 }) {
    const wrap = h("span", { class: "inline-flex items-center gap-1" });
    if (!value && !editable) {
      wrap.appendChild(h("span", { class: "text-sm text-concrete-400" }, "Novo na plataforma"));
      return wrap;
    }
    const stars = h("span", { class: "inline-flex items-center gap-0.5" });
    for (let i = 1; i <= 5; i++) {
      const filled = i <= Math.round(value);
      const star = Icon("star", { size: editable ? 28 : size, color: filled ? "var(--amber-500)" : "var(--gray-300)" });
      if (editable) {
        star.classList.add("cursor-pointer");
        star.addEventListener("click", () => onChange2 && onChange2(i));
      }
      stars.appendChild(star);
    }
    wrap.appendChild(stars);
    if (showValue && !editable) {
      wrap.appendChild(h("span", { class: "text-sm font-semibold text-concrete-900" }, value.toFixed(1).replace(".", ",")));
      if (count != null) wrap.appendChild(h("span", { class: "text-sm text-concrete-500" }, `(${count})`));
    }
    return wrap;
  }

  // js/screens/shared/WorkerProfileScreen.js
  var POSTS_KEY = "worker-posts";
  function renderWorkerProfile(navigate2, params) {
    const isOwn = !params.id;
    const worker = isOwn ? currentWorker() : getWorker(params.id);
    if (!worker) return notFound(navigate2);
    const jobIdRaw = params.jobId;
    const jobForCtx = jobIdRaw ? getJob(jobIdRaw) : null;
    const jobId = jobForCtx && getRole() === "recrutador" && jobForCtx.companyId === currentCompanyId() ? jobIdRaw : null;
    const decision = jobId ? (applicationFor(jobId, worker.id) || {}).status : null;
    const decidedForJob = jobId && (decision === "pre_selecionado" || decision === "nao_selecionado");
    const jobFull = jobId ? isJobClosed(getJob(jobId)) : false;
    const ui = getUI("worker-profile-photo", { photo: null });
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0" },
      h(
        "div",
        { class: "relative" },
        isOwn && ui.photo ? h("img", { src: ui.photo, alt: "", class: "w-full h-52 object-cover lg:rounded-card" }) : h("div", { class: "h-52 bg-concrete-200 lg:rounded-card" }),
        !isOwn ? h("div", { class: "absolute top-2 left-2" }, IconButton({ icon: "arrow-left", label: "Voltar", variant: "solid", onClick: () => goBack(jobId ? "/vaga-gerenciar/" + jobId : "/mural") })) : null,
        h(
          "div",
          { class: "absolute left-4 sm:left-6 -bottom-10 w-24 h-24 rounded-full bg-white p-1 shadow-raised" },
          h(
            "div",
            { class: "relative w-full h-full" },
            h("div", { class: "w-full h-full rounded-full bg-accent-50 text-accent-600 flex items-center justify-center font-bold text-2xl overflow-hidden" }, worker.initials),
            worker.verified ? h("span", { class: "absolute -right-0.5 -bottom-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-500 border-[3px] border-white" }, Icon("check", { size: 14, color: "#fff" })) : null
          )
        )
      ),
      h(
        "div",
        { class: "flex flex-col gap-5 pt-12 px-4 sm:px-6 pb-40 lg:pb-6" },
        h(
          "div",
          { class: "flex items-start justify-between gap-3" },
          h(
            "div",
            { class: "flex flex-col gap-1.5 min-w-0" },
            h("span", { class: "font-display font-bold text-2xl text-concrete-900" }, worker.name),
            h("span", { class: "text-sm text-concrete-700" }, `${worker.role} \xB7 ${worker.region}`),
            h(
              "span",
              { class: "inline-flex items-center gap-1.5 text-sm font-semibold text-concrete-700" },
              Icon("hammer", { size: 15, color: "var(--text-subtle)" }),
              `${worker.jobsDone} ${worker.jobsDone === 1 ? "bico realizado" : "bicos realizados"}`
            ),
            h(
              "div",
              { class: "flex items-center gap-3" },
              Rating({ value: worker.rating, count: worker.jobsDone }),
              !isOwn ? h("button", {
                type: "button",
                class: "inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600",
                onClick: () => navigate2("/avaliacoes/trabalhador/" + worker.id)
              }, "Ver avalia\xE7\xF5es", Icon("chevron-right", { size: 16, color: "var(--text-brand)" })) : null
            )
          ),
          isOwn ? Button({ label: "Editar", variant: "secondary", size: "sm", iconLeft: "pencil", onClick: () => navigate2("/perfil/editar") }) : worker.novo ? Badge({ label: "Novo na plataforma", tone: "accent" }) : worker.verified ? Badge({ label: "Verificado", tone: "success", icon: "shield-check" }) : null
        ),
        h(
          "div",
          { class: "flex flex-col gap-2.5" },
          h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Especialidades"),
          h("div", { class: "flex flex-wrap gap-2" }, ...worker.specialties.map((s) => h("span", { class: "inline-flex items-center h-9 px-3 rounded-full bg-white border border-concrete-300 text-sm font-semibold text-concrete-700" }, s)))
        ),
        !isOwn && worker.facts && worker.facts.length ? Card(
          { padding: "md" },
          h("div", { class: "flex flex-col gap-3.5" }, ...worker.facts.map((f) => h("div", { class: "flex gap-2.5 items-center" }, Icon("circle-check", { size: 18, color: "var(--text-subtle)" }), h("span", { class: "text-sm text-concrete-700" }, f))))
        ) : null,
        postsSection(worker, isOwn),
        !isOwn && jobId ? h("p", { class: "text-sm text-concrete-500" }, "O contato por WhatsApp abre depois que voc\xEA aprovar esse trabalhador para a vaga.") : null
      ),
      !isOwn && jobId ? h(
        "div",
        { class: "sticky bottom-0 px-4 sm:px-6 py-3 bg-white shadow-bar flex flex-col gap-2 lg:static lg:bg-transparent lg:shadow-none lg:pt-0 lg:pb-6" },
        !decidedForJob && !jobFull ? h(
          "div",
          { class: "flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3" },
          Button({
            label: `Aprovar para a vaga \xB7 ${approvedCount(jobId) + 1} de ${getJob(jobId).slots || 1}`,
            size: "lg",
            fullWidth: true,
            iconLeft: "circle-check",
            className: "lg:w-auto lg:px-8",
            onClick: () => {
              decideApplication(jobId, worker.id, "aprovado");
              navigate2(isJobClosed(getJob(jobId)) ? "/fechado/" + jobId : "/vaga-gerenciar/" + jobId);
            }
          }),
          Button({ label: "Recusar candidato", variant: "ghost", fullWidth: true, className: "lg:w-auto", onClick: () => {
            decideApplication(jobId, worker.id, "recusado");
            navigate2("/vaga-gerenciar/" + jobId);
          } })
        ) : decidedForJob ? h(
          "div",
          { class: "flex items-center gap-2.5" },
          Badge({ label: decision === "pre_selecionado" ? "Aprovado" : "Recusado", tone: decision === "pre_selecionado" ? "success" : "danger", icon: decision === "pre_selecionado" ? "circle-check" : "circle-x" }),
          h("span", { class: "flex-1 text-sm text-concrete-500" }, decision === "pre_selecionado" ? "Contato por WhatsApp liberado para os dois lados." : "Avisamos que dessa vez n\xE3o deu certo."),
          Button({ label: "Desfazer", variant: "secondary", size: "sm", onClick: () => {
            decideApplication(jobId, worker.id, null);
          } })
        ) : h("span", { class: "text-center text-xs text-concrete-500" }, "As vagas desse bico j\xE1 foram preenchidas.")
      ) : null
    );
  }
  function postsSection(worker, isOwn) {
    const posts = postsForWorker(worker.id);
    const ui = getUI(POSTS_KEY, { composing: false, mediaUrl: null, mediaType: "image", caption: "", deleteId: null });
    const firstName = worker.name.split(" ")[0];
    return h(
      "div",
      { class: "flex flex-col gap-2.5" },
      h(
        "div",
        { class: "flex items-center justify-between gap-2" },
        h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, isOwn ? "Seus trabalhos" : `Trabalhos de ${firstName}`),
        isOwn ? Button({ label: "Publicar", variant: "ghost", size: "sm", iconLeft: "plus", onClick: () => setUI(POSTS_KEY, { composing: true }) }) : null
      ),
      posts.length === 0 ? EmptyState({
        icon: "camera",
        title: isOwn ? "Mostre o seu trabalho" : "Nenhum post ainda",
        description: isOwn ? "Publique fotos ou v\xEDdeos dos seus bicos para as construtoras verem a qualidade do seu servi\xE7o." : `${firstName} ainda n\xE3o publicou fotos ou v\xEDdeos do trabalho.`,
        actionLabel: isOwn ? "Publicar primeiro post" : null,
        onAction: isOwn ? () => setUI(POSTS_KEY, { composing: true }) : null
      }) : h("div", { class: "flex flex-col gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5" }, ...posts.map((p) => postCard(p, isOwn))),
      isOwn ? composer(worker, ui) : null,
      isOwn ? Dialog({
        open: Boolean(ui.deleteId),
        tone: "danger",
        title: "Excluir esse post?",
        description: "A publica\xE7\xE3o some do seu perfil imediatamente.",
        confirmLabel: "Excluir post",
        onConfirm: () => {
          deleteWorkerPost(ui.deleteId);
          setUI(POSTS_KEY, { deleteId: null });
        },
        cancelLabel: "Cancelar",
        onCancel: () => setUI(POSTS_KEY, { deleteId: null })
      }) : null
    );
  }
  function postCard(post, isOwn) {
    return h(
      "div",
      { class: "flex flex-col rounded-card overflow-hidden border border-concrete-200 bg-white" },
      h(
        "div",
        { class: "relative" },
        post.mediaUrl ? post.mediaType === "video" ? h("video", { src: post.mediaUrl, controls: true, class: "w-full h-72 lg:h-auto lg:aspect-square object-cover bg-concrete-900" }) : h("img", { src: post.mediaUrl, alt: "", class: "w-full h-72 lg:h-auto lg:aspect-square object-cover" }) : h("div", { class: "w-full h-72 lg:h-auto lg:aspect-square bg-concrete-200 flex items-center justify-center" }, Icon("camera", { size: 32, color: "var(--text-subtle)" })),
        post.mediaType === "video" ? h("span", { class: "absolute top-2.5 left-2.5" }, Badge({ label: "V\xEDdeo", tone: "neutral" })) : null,
        isOwn ? h("span", { class: "absolute top-2.5 right-2.5" }, IconButton({ icon: "trash-2", label: "Excluir post", variant: "solid", size: "sm", onClick: () => setUI(POSTS_KEY, { deleteId: post.id }) })) : null
      ),
      h(
        "div",
        { class: "flex flex-col gap-1.5 p-3.5" },
        post.caption ? h("p", { class: "text-sm text-concrete-800 leading-relaxed" }, post.caption) : null,
        h("span", { class: "text-xs text-concrete-400" }, formatPostDate(post.date))
      )
    );
  }
  function composer(worker, ui) {
    const closeAndReset = () => setUI(POSTS_KEY, { composing: false, mediaUrl: null, mediaType: "image", caption: "" });
    const fileInput = h("input", {
      type: "file",
      accept: "image/*,video/*",
      class: "sr-only",
      onchange: (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setUI(POSTS_KEY, { mediaUrl: URL.createObjectURL(file), mediaType: file.type.indexOf("video") === 0 ? "video" : "image" });
      }
    });
    return Sheet(
      { open: ui.composing, title: "Publicar trabalho", onClose: closeAndReset },
      h(
        "label",
        {
          class: "relative flex items-center justify-center overflow-hidden cursor-pointer bg-concrete-100 border-2 border-dashed border-concrete-300 hover:border-brand-400 rounded-card w-full transition-colors",
          style: { height: "12rem" }
        },
        fileInput,
        ui.mediaUrl ? ui.mediaType === "video" ? h("video", { src: ui.mediaUrl, controls: true, class: "absolute inset-0 w-full h-full object-cover" }) : h("img", { src: ui.mediaUrl, alt: "", class: "absolute inset-0 w-full h-full object-cover" }) : h("span", { class: "flex flex-col items-center gap-1.5 text-concrete-500 px-3 text-center" }, Icon("camera", { size: 24 }), h("span", { class: "text-xs font-semibold" }, "Toque para escolher uma foto ou v\xEDdeo"))
      ),
      h(
        "div",
        { class: "flex flex-col gap-1.5 w-full" },
        h("label", { for: "worker-post-caption", class: "text-sm font-semibold text-concrete-900" }, "Descri\xE7\xE3o"),
        h("textarea", {
          id: "worker-post-caption",
          "data-focus-id": "worker-post-caption",
          rows: 3,
          placeholder: "Conte o que foi feito nesse bico...",
          value: ui.caption,
          class: "w-full px-3 py-2.5 bg-white rounded-control border border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none text-base text-concrete-900 placeholder:text-concrete-400 resize-none transition-colors duration-150",
          oninput: (e) => setUI(POSTS_KEY, { caption: e.target.value })
        })
      ),
      Button({
        label: "Publicar",
        size: "lg",
        fullWidth: true,
        disabled: !ui.mediaUrl,
        onClick: () => {
          addWorkerPost(worker.id, { mediaUrl: ui.mediaUrl, mediaType: ui.mediaType, caption: ui.caption.trim() });
          closeAndReset();
        }
      })
    );
  }
  function notFound(navigate2) {
    return h(
      "div",
      { class: "flex flex-col items-center justify-center min-h-screen gap-3" },
      h("p", { class: "text-concrete-500" }, "Trabalhador n\xE3o encontrado."),
      Button({ label: "Voltar ao mural", variant: "secondary", onClick: () => navigate2("/mural") })
    );
  }

  // js/screens/shared/EditWorkerProfile.js
  var KEY6 = "edit-worker-profile";
  var BANNER_KEY = "worker-profile-photo";
  function renderEditWorkerProfile(navigate2) {
    const worker = currentWorker();
    const ui = getUI(KEY6, () => ({ name: worker.name, role: worker.role, region: worker.region, specialties: [...worker.specialties], photo: null }));
    const banner = getUI(BANNER_KEY, { photo: null });
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0" },
      BackBar({ title: "Editar perfil", onBack: () => goBack("/perfil") }),
      h(
        "div",
        { class: "flex-1 flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4" },
        h(
          "div",
          { class: "flex flex-col gap-1.5" },
          h("span", { class: "text-sm font-semibold text-concrete-900" }, "Foto de capa"),
          PhotoSlot({ shape: "rect", height: "9rem", placeholder: "Toque para escolher uma foto de capa", value: banner.photo, onChange: (v) => setUI(BANNER_KEY, { photo: v }) })
        ),
        h(
          "div",
          { class: "flex flex-col items-center gap-2" },
          PhotoSlot({ shape: "circle", value: ui.photo, onChange: (v) => setUI(KEY6, { photo: v }), className: "w-24 h-24", placeholder: "Sua foto" })
        ),
        Input({ id: "edit-worker-name", label: "Nome completo", icon: "user", value: ui.name, onInput: (v) => setUI(KEY6, { name: v }) }),
        Select({ label: "Cargo ou especialidade principal", options: CARGOS_TRABALHADOR, value: ui.role, onChange: (v) => setUI(KEY6, { role: v }) }),
        Select({ label: "Regi\xE3o de atua\xE7\xE3o", options: REGIOES_TRABALHADOR, value: ui.region, onChange: (v) => setUI(KEY6, { region: v }) }),
        h(
          "div",
          { class: "flex flex-col gap-2.5" },
          h("span", { class: "text-sm font-semibold text-concrete-900" }, "Especialidades"),
          h("div", { class: "flex flex-wrap gap-2" }, ...ESPECIALIDADES.map((e) => Tag({
            label: e,
            selected: ui.specialties.includes(e),
            onClick: () => setUI(KEY6, { specialties: ui.specialties.includes(e) ? ui.specialties.filter((x) => x !== e) : ui.specialties.concat([e]) })
          })))
        ),
        h("div", { class: "pt-2 border-t border-concrete-200" }, Button({ label: "Sair da conta", variant: "danger", fullWidth: true, iconLeft: "log-out", onClick: () => navigate2("/login") }))
      ),
      h(
        "div",
        { class: "px-4 sm:px-6 lg:px-0 py-3 bg-white shadow-bar flex gap-3 lg:static lg:bg-transparent lg:shadow-none" },
        Button({ label: "Cancelar", variant: "secondary", className: "flex-1", onClick: () => navigate2("/perfil") }),
        Button({ label: "Salvar altera\xE7\xF5es", className: "flex-[1.4]", onClick: () => {
          Object.assign(worker, { name: ui.name, role: ui.role, region: ui.region, specialties: ui.specialties });
          navigate2("/perfil");
        } })
      )
    );
  }

  // js/components/JobCover.js
  function jobPhotos(job) {
    if (Array.isArray(job.photos)) return job.photos;
    return job.photo ? [job.photo] : [];
  }
  var COVERS = [
    { test: /eletric/i, icon: "plug-zap", from: "#2F4BB5", to: "#0A1A54" },
    { test: /pint/i, icon: "paint-roller", from: "#2AA096", to: "#08514A" },
    { test: /azulej|porcelan|revest/i, icon: "layout-grid", from: "#6E8DF5", to: "#1D3FB8" },
    { test: /encanad|hidr/i, icon: "droplets", from: "#3AA9D1", to: "#0C5F80" },
    { test: /armador|ferr/i, icon: "construction", from: "#5C6672", to: "#161C24" },
    { test: /carpint|marcen/i, icon: "hammer", from: "#C08A4A", to: "#6E4015" },
    { test: /gess/i, icon: "ruler", from: "#8E9DB5", to: "#46546B" },
    { test: /telhad|telhado/i, icon: "house", from: "#E0A24A", to: "#94540F" },
    { test: /mestre/i, icon: "hard-hat", from: "#3F63F0", to: "#0E2472" },
    { test: /servente|ajudante/i, icon: "shovel", from: "#9AA3AE", to: "#3F4852" },
    { test: /pedreiro|alvenaria|reboco|acabamento/i, icon: "brick-wall", from: "#D9774B", to: "#842F12" }
  ];
  var DEFAULT_COVER = { icon: "hard-hat", from: "#1D4BED", to: "#0A1A54" };
  function JobCover({ job, large = false }) {
    const c = COVERS.find((x) => x.test.test(job.role || "")) || DEFAULT_COVER;
    return h(
      "div",
      { class: "absolute inset-0", style: { background: `linear-gradient(145deg, ${c.from}, ${c.to})` } },
      h("div", { class: "absolute inset-0 job-cover-grid" }),
      h("div", { class: "absolute inset-0", style: { background: "radial-gradient(circle at 28% 18%, rgba(255,255,255,0.22), transparent 58%)" } }),
      h("span", { class: "absolute -right-8 -bottom-8 opacity-[0.13] -rotate-12" }, Icon(c.icon, { size: large ? 280 : 168, color: "#fff" })),
      h(
        "div",
        { class: "absolute inset-0 flex items-center justify-center" },
        h("span", {
          class: cx("inline-flex items-center justify-center bg-white/15 ring-1 ring-white/30 shadow-raised", large ? "w-24 h-24 rounded-3xl" : "w-16 h-16 rounded-2xl"),
          style: { backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }
        }, Icon(c.icon, { size: large ? 44 : 30, color: "#fff" }))
      )
    );
  }
  function SaveFlag({ saved, onToggle }) {
    const label = saved ? "Remover dos salvos" : "Salvar vaga";
    return h(
      "button",
      {
        type: "button",
        "aria-label": label,
        "aria-pressed": saved ? "true" : "false",
        title: label,
        class: "absolute top-2 right-2 z-10 inline-flex items-center justify-center w-10 h-10 rounded-full transition-transform active:scale-90 hover:scale-110",
        onClick: (e) => {
          e.stopPropagation();
          onToggle();
        }
      },
      h(
        "span",
        { class: "relative inline-flex w-6 h-6", style: { filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" } },
        Icon("bookmark-solid", { size: 24, color: saved ? "var(--brand)" : "rgba(16,20,24,0.32)", className: "absolute inset-0" }),
        Icon("bookmark", { size: 24, color: "#fff", className: "absolute inset-0" })
      )
    );
  }

  // js/components/PhotoCarousel.js
  var shownPhoto = /* @__PURE__ */ new Map();
  function PhotoCarousel({ job, className = "h-56 sm:h-72 lg:h-[26rem] rounded-card", compact = false }) {
    const photos = jobPhotos(job);
    const n = photos.length;
    const frame = cx("relative w-full overflow-hidden bg-concrete-200", className);
    if (!n) return h("div", { class: frame }, JobCover({ job, large: !compact }));
    const imgClass = cx("w-full h-full object-cover select-none pointer-events-none", compact ? "transition-transform duration-300 group-hover:scale-[1.03]" : "");
    const track = h(
      "div",
      {
        class: cx("flex h-full overflow-x-auto snap-x snap-mandatory overscroll-x-contain no-scrollbar outline-none", n > 1 ? "cursor-grab" : ""),
        tabindex: n > 1 && !compact ? "0" : null,
        "aria-label": "Fotos do bico",
        "aria-roledescription": "carrossel"
      },
      ...photos.map((src, i) => h(
        "div",
        { class: "shrink-0 w-full h-full snap-center snap-always overflow-hidden" },
        h("img", { src, alt: `Foto ${i + 1} de ${n}`, draggable: "false", loading: i === 0 ? "eager" : "lazy", class: imgClass })
      ))
    );
    if (n === 1) return h("div", { class: frame }, track);
    let width = 0;
    const current = () => Math.min(n - 1, shownPhoto.get(job.id) || 0);
    const goTo = (i) => {
      const target = Math.max(0, Math.min(n - 1, i));
      track.scrollTo({ left: target * (width || track.clientWidth), behavior: "smooth" });
    };
    const arrow = (icon, label, dir, side) => h("button", {
      type: "button",
      "aria-label": label,
      title: label,
      class: cx(
        "absolute top-1/2 -translate-y-1/2 z-10 items-center justify-center rounded-full bg-white/90 text-concrete-900 shadow-raised transition hover:bg-white hover:scale-105 disabled:!opacity-0 disabled:pointer-events-none",
        compact ? "hidden lg:inline-flex w-8 h-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" : "inline-flex w-9 h-9",
        side
      ),
      onClick: (e) => {
        e.stopPropagation();
        goTo(current() + dir);
      }
    }, Icon(icon, { size: compact ? 16 : 18 }));
    const prev = arrow("chevron-left", "Foto anterior", -1, compact ? "left-2" : "left-3");
    const next = arrow("chevron-right", "Pr\xF3xima foto", 1, compact ? "right-2" : "right-3");
    const dotSize = compact ? "h-1.5" : "h-1.5";
    const dots = photos.map(() => h("span", { class: dotSize }));
    const counter = compact ? null : h("span", { class: "absolute top-3 right-3 inline-flex items-center h-6 px-2.5 rounded-full bg-black/60 text-white text-xs font-semibold pointer-events-none" });
    const show = (i) => {
      if (counter) counter.textContent = `${i + 1} / ${n}`;
      dots.forEach((d, k) => {
        d.className = cx(dotSize, "rounded-full transition-all duration-200 shadow-[0_0_2px_rgba(0,0,0,0.4)]", k === i ? compact ? "w-1.5 bg-white" : "w-4 bg-white" : "w-1.5 bg-white/55");
      });
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
    };
    track.addEventListener("scroll", () => {
      if (track.clientWidth !== width) {
        width = track.clientWidth;
        track.scrollLeft = current() * width;
        return;
      }
      const i = Math.min(n - 1, Math.max(0, Math.round(track.scrollLeft / (width || 1))));
      shownPhoto.set(job.id, i);
      show(i);
    }, { passive: true });
    let drag = null;
    let dragged = false;
    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, left: track.scrollLeft, from: current() };
      dragged = false;
      track.style.scrollSnapType = "none";
      track.classList.replace("cursor-grab", "cursor-grabbing");
      track.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    track.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) dragged = true;
      track.scrollLeft = drag.left - dx;
    });
    const endDrag = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const threshold = Math.min(60, (width || track.clientWidth) * 0.15);
      const target = drag.from + (dx < -threshold ? 1 : dx > threshold ? -1 : 0);
      drag = null;
      track.classList.replace("cursor-grabbing", "cursor-grab");
      goTo(target);
      const restore = () => {
        track.style.scrollSnapType = "";
      };
      if ("onscrollend" in window) track.addEventListener("scrollend", restore, { once: true });
      setTimeout(restore, 600);
    };
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("click", (e) => {
      if (dragged) {
        e.stopPropagation();
        e.preventDefault();
        dragged = false;
      }
    }, true);
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(current() + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(current() - 1);
      }
    });
    const start = current();
    show(start);
    requestAnimationFrame(() => {
      width = track.clientWidth;
      if (start) track.scrollLeft = start * width;
    });
    return h(
      "div",
      { class: frame },
      track,
      prev,
      next,
      h("div", { class: cx("absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none", compact ? "bottom-2.5 gap-1" : "bottom-3.5 gap-1.5") }, ...dots),
      counter
    );
  }
  function PhotoManager({ photos, onChange: onChange2, max = 6 }) {
    const add = h(
      "label",
      {
        class: "relative w-[6.75rem] sm:w-32 aspect-square flex flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-concrete-300 bg-concrete-25 text-concrete-500 cursor-pointer transition-colors hover:border-brand-400 hover:text-brand-600"
      },
      h("input", {
        type: "file",
        accept: "image/*",
        multiple: true,
        class: "sr-only",
        onchange: (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onChange2(photos.concat(files.map((f) => URL.createObjectURL(f))).slice(0, max));
        }
      }),
      Icon("camera", { size: 22 }),
      h("span", { class: "text-xs font-semibold text-center px-2" }, photos.length ? "Adicionar foto" : "Escolher fotos")
    );
    return h(
      "div",
      { class: "flex flex-wrap justify-center gap-2.5" },
      ...photos.map((src, i) => h(
        "div",
        { class: "relative w-[6.75rem] sm:w-32 aspect-square rounded-card overflow-hidden bg-concrete-200 shadow-card" },
        h("img", { src, alt: `Foto ${i + 1}`, class: "w-full h-full object-cover" }),
        i === 0 ? h("span", { class: "absolute bottom-1.5 left-1.5 px-2 h-5 inline-flex items-center rounded-full bg-black/60 text-white text-[0.625rem] font-bold uppercase tracking-wide" }, "Capa") : null,
        h("button", {
          type: "button",
          "aria-label": `Remover foto ${i + 1}`,
          title: "Remover foto",
          class: "absolute top-1.5 right-1.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-concrete-900 shadow-raised hover:bg-white",
          onClick: () => onChange2(photos.filter((_, k) => k !== i))
        }, Icon("x", { size: 14 }))
      )),
      photos.length < max ? add : null
    );
  }

  // js/utils/jobInfo.js
  var DIAS = {
    // label/hint: job page; short: tiles; pick/pickSub: the three cards in the publish form.
    semana: { label: "Durante a semana", short: "Seg a sex", hint: "De segunda a sexta", pick: "Semana", pickSub: "Seg a sex" },
    fimdesemana: { label: "No fim de semana", short: "S\xE1b e dom", hint: "S\xE1bado e domingo", pick: "Fim de semana", pickSub: "S\xE1b e dom" },
    qualquer: { label: "Qualquer dia", short: "Qualquer dia", hint: "Semana ou fim de semana", pick: "Qualquer dia", pickSub: "Seg a dom" }
  };
  var DIAS_ORDEM = ["semana", "fimdesemana", "qualquer"];
  function diasInfo(job) {
    return DIAS[job.dias] || null;
  }
  function dateText(job) {
    return job.date || "Data a combinar";
  }
  function whenText(job) {
    if (job.date) return job.hours ? `${job.date} \xB7 ${job.hours}` : job.date;
    return job.hours ? `Data a combinar \xB7 ${job.hours}` : "Data e hor\xE1rio a combinar";
  }
  function hoursText(job) {
    return job.hours || "Hor\xE1rio a combinar";
  }

  // js/components/JobTile.js
  var TONE_COLOR = { brand: "var(--text-brand)", success: "var(--green-500)", warning: "var(--amber-500)", danger: "var(--red-500)", accent: "var(--text-brand)", neutral: "var(--gray-500)" };
  function JobTile({ job, company, onClick, badge = null, mine = false, muted = false, saved = false, onToggleSave = null, corner = null }) {
    const bairro = String(job.location || "").split(",")[0];
    const dias = diasInfo(job);
    const where = [bairro, dias && dias.short].filter(Boolean).join(" \xB7 ");
    const when = whenText(job);
    const pill = (children, className = "") => h("span", {
      class: cx("inline-flex items-center gap-1 h-6 sm:h-7 px-2 sm:px-2.5 rounded-full bg-white text-[0.6875rem] sm:text-xs font-semibold shadow-[0_1px_3px_rgba(16,20,24,0.18)] whitespace-nowrap", className || "text-concrete-900")
    }, children);
    const photo = h(
      "div",
      { class: "relative aspect-[20/19] rounded-xl sm:rounded-2xl overflow-hidden bg-concrete-200" },
      // Only the picture is greyed out when muted; badges and the save flag keep their colour.
      // The photos swipe right here on the tile, without opening the job.
      h(
        "div",
        { class: cx("absolute inset-0", muted ? "grayscale opacity-60" : "") },
        PhotoCarousel({ job, compact: true, className: "h-full" })
      ),
      h(
        "div",
        { class: "absolute top-2 left-2 sm:top-3 sm:left-3 right-12 flex flex-wrap gap-1.5 pointer-events-none" },
        badge ? pill([badge.icon ? Icon(badge.icon, { size: 12, color: TONE_COLOR[badge.tone] || TONE_COLOR.neutral }) : null, badge.label]) : null,
        mine ? pill("Sua vaga", "text-brand-600") : null
      ),
      corner ? h("div", { class: "absolute top-2 right-2 z-10", onClick: (e) => e.stopPropagation() }, corner) : onToggleSave ? SaveFlag({ saved, onToggle: onToggleSave }) : null
    );
    const text = h(
      "div",
      { class: "flex flex-col pt-2.5 sm:pt-3 text-[0.8125rem] sm:text-[0.9375rem] leading-[1.35]" },
      h("span", { class: cx("truncate font-semibold sm:text-base", muted ? "text-concrete-500" : "text-concrete-900") }, job.role),
      h("span", { class: "truncate text-concrete-500" }, where),
      h("span", { class: "truncate text-concrete-500" }, when),
      h(
        "span",
        { class: cx("truncate pt-0.5", muted ? "text-concrete-500" : "text-concrete-900") },
        job.pay == null ? h("span", { class: "font-semibold" }, "A combinar") : [h("span", { class: "font-semibold" }, formatBRL(job.pay)), h("span", { class: "text-concrete-500" }, " por di\xE1ria")]
      )
    );
    return h("div", {
      role: "link",
      tabindex: "0",
      "aria-label": [job.role, badge && badge.label, company && company.name, where, when].filter(Boolean).join(", "),
      class: "group min-w-0 cursor-pointer rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-100",
      onClick,
      onkeydown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }
    }, photo, text);
  }
  function TileGrid(tiles) {
    return h("div", { class: "tile-grid" }, ...tiles);
  }

  // js/screens/shared/CompanyProfileScreen.js
  function renderCompanyProfile(navigate2, params) {
    const isOwn = !params.id;
    const company = isOwn ? currentCompany() : getCompany(params.id);
    if (!company) return notFound2(navigate2);
    const ui = getUI("company-profile", { capa: null, logo: null, deleteId: null });
    const openJobs = activeJobs().filter((j) => j.companyId === company.id && !j.closed && !isJobFull(j));
    const postToDelete = openJobs.find((j) => j.id === ui.deleteId);
    const successfulJobs = successfulJobsForCompany(company.id);
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0" },
      h(
        "div",
        { class: "relative" },
        isOwn && ui.capa ? h("img", { src: ui.capa, alt: "", class: "w-full h-48 object-cover lg:rounded-card" }) : h("div", { class: "h-48 bg-concrete-200 lg:rounded-card" }),
        !isOwn ? h("div", { class: "absolute top-2 left-2" }, IconButton({ icon: "arrow-left", label: "Voltar", variant: "solid", onClick: () => goBack("/mural") })) : null,
        h(
          "div",
          { class: "absolute left-4 sm:left-6 -bottom-10 w-24 h-24 rounded-full bg-white p-1 shadow-raised" },
          h(
            "div",
            { class: "w-full h-full rounded-full bg-brand-50 flex items-center justify-center overflow-hidden" },
            isOwn && ui.logo ? h("img", { src: ui.logo, alt: "", class: "w-full h-full object-cover" }) : Icon("building-2", { size: 26, color: "var(--brand)" })
          )
        )
      ),
      h(
        "div",
        { class: "flex flex-col gap-5 pt-12 px-4 sm:px-6 pb-24 lg:pb-6" },
        h(
          "div",
          { class: "flex items-start justify-between gap-3" },
          h(
            "div",
            { class: "flex flex-col gap-1.5 min-w-0" },
            h("span", { class: "font-display font-bold text-2xl text-concrete-900" }, company.name),
            h("span", { class: "text-sm text-concrete-700" }, `${company.tipoObra || "Constru\xE7\xE3o civil"} \xB7 ${company.location}`),
            h(
              "span",
              { class: "inline-flex items-center gap-1.5 text-sm font-semibold text-concrete-700" },
              Icon("circle-check", { size: 15, color: "var(--text-subtle)" }),
              `${successfulJobs} ${successfulJobs === 1 ? "bico conclu\xEDdo" : "bicos conclu\xEDdos"}`
            ),
            h(
              "div",
              { class: "flex items-center gap-3" },
              Rating({ value: company.rating, count: company.reviewCount }),
              !isOwn ? h("button", {
                type: "button",
                class: "inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600",
                onClick: () => navigate2("/avaliacoes/construtora/" + company.id)
              }, "Ver avalia\xE7\xF5es", Icon("chevron-right", { size: 16, color: "var(--text-brand)" })) : null
            )
          ),
          isOwn ? Button({ label: "Editar", variant: "secondary", size: "sm", iconLeft: "pencil", onClick: () => navigate2("/empresa/editar") }) : company.verified ? Badge({ label: "Verificada", tone: "success", icon: "shield-check" }) : null
        ),
        isOwn ? Card(
          { padding: "md" },
          h(
            "div",
            { class: "flex flex-col gap-3.5" },
            h("div", { class: "flex items-center justify-between gap-3" }, h("span", { class: "text-sm text-concrete-500" }, "CNPJ"), h("span", { class: "font-mono text-sm text-concrete-900" }, company.cnpj)),
            h("div", { class: "flex items-center justify-between gap-3" }, h("span", { class: "text-sm text-concrete-500" }, "Tipo de obra"), h("span", { class: "font-semibold text-concrete-900 text-right" }, company.tipoObra)),
            h("div", { class: "flex items-center gap-2 pt-3.5 border-t border-concrete-200" }, Badge({ label: "Verificada", tone: "success", icon: "shield-check" }), h("span", { class: "text-xs text-concrete-500" }, `CNPJ conferido em ${company.verifiedSince}`))
          )
        ) : Card(
          { padding: "md" },
          h(
            "div",
            { class: "flex flex-col gap-3.5" },
            h("div", { class: "flex gap-2.5 items-center" }, Icon("hand-coins", { size: 20, color: "var(--text-subtle)" }), h("span", { class: "text-sm text-concrete-700" }, `${company.paidCount || 0} di\xE1rias pagas pela plataforma`)),
            h("div", { class: "flex gap-2.5 items-center" }, Icon("message-circle", { size: 20, color: "var(--text-subtle)" }), h("span", { class: "text-sm text-concrete-700" }, company.respondTime || "Responde em poucas horas, em m\xE9dia")),
            h("div", { class: "flex gap-2.5 items-center" }, Icon("hammer", { size: 20, color: "var(--text-subtle)" }), h("span", { class: "text-sm text-concrete-700" }, `${openJobs.length} vagas abertas agora`)),
            h("div", { class: "flex gap-2.5 items-center" }, Icon("calendar", { size: 20, color: "var(--text-subtle)" }), h("span", { class: "text-sm text-concrete-700" }, company.sinceLabel || "Na Bicos"))
          )
        ),
        isOwn ? h(
          "div",
          { class: "flex flex-col gap-2.5" },
          h(
            "div",
            { class: "flex items-center justify-between gap-2" },
            h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Seus posts"),
            Button({ label: "Publicar", variant: "ghost", size: "sm", iconLeft: "plus", onClick: () => navigate2("/criar-vaga") })
          ),
          openJobs.length === 0 ? EmptyState({ icon: "hammer", title: "Voc\xEA ainda n\xE3o publicou nenhuma vaga", description: "Publique seu primeiro bico para come\xE7ar a receber candidatos.", actionLabel: "Publicar vaga", onAction: () => navigate2("/criar-vaga") }) : TileGrid(openJobs.map((job) => JobTile({
            job,
            company,
            onClick: () => navigate2("/vaga-gerenciar/" + job.id),
            badge: statusBadge(job),
            corner: IconButton({ icon: "trash-2", label: "Excluir post", variant: "solid", onClick: () => setUI("company-profile", { deleteId: job.id }) })
          })))
        ) : h(
          "div",
          { class: "flex flex-col gap-2.5" },
          h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Vagas publicadas"),
          openJobs.length === 0 ? EmptyState({ icon: "hammer", title: "Nenhuma vaga aberta no momento", description: `${company.name} n\xE3o tem bicos publicados agora. Volte mais tarde para ver novidades.` }) : TileGrid(openJobs.map((job) => JobTile({
            job,
            company,
            onClick: () => navigate2("/vaga/" + job.id),
            saved: getRole() === "trabalhador" && isJobSaved(job.id),
            onToggleSave: getRole() === "trabalhador" ? () => toggleSavedJob(job.id) : null
          })))
        )
      ),
      Dialog({
        open: Boolean(ui.deleteId),
        tone: "danger",
        title: "Excluir esse post?",
        description: "A vaga sai do mural imediatamente. Candidatos j\xE1 enviados n\xE3o s\xE3o avisados.",
        confirmLabel: "Excluir post",
        onConfirm: () => {
          deleteJobPost(ui.deleteId);
          setUI("company-profile", { deleteId: null });
        },
        cancelLabel: "Cancelar",
        onCancel: () => setUI("company-profile", { deleteId: null })
      })
    );
  }
  function statusBadge(job) {
    const pending = pendingCount(job.id);
    const approved = approvedCount(job.id);
    if (isJobClosed(job)) return { label: `Fechado \xB7 ${approved} de ${job.slots || 1}`, tone: "success", icon: "circle-check" };
    if (pending) return { label: `${pending} em an\xE1lise`, tone: "warning", icon: "clock" };
    const total = applicationsForJob(job.id).length;
    if (total) return { label: total === 1 ? "1 candidato" : `${total} candidatos`, tone: "brand", icon: "users" };
    return { label: "Sem candidatos", tone: "neutral", icon: "search-x" };
  }
  function notFound2(navigate2) {
    return h(
      "div",
      { class: "flex flex-col items-center justify-center min-h-screen gap-3" },
      h("p", { class: "text-concrete-500" }, "Construtora n\xE3o encontrada."),
      Button({ label: "Voltar ao mural", variant: "secondary", onClick: () => navigate2("/mural") })
    );
  }

  // js/screens/shared/EditCompanyProfile.js
  var KEY7 = "edit-company-profile";
  var BANNER_KEY2 = "company-profile";
  function renderEditCompanyProfile(navigate2) {
    const company = currentCompany();
    const ui = getUI(KEY7, () => ({ name: company.name, tipoObra: company.tipoObra, location: company.location, whatsapp: company.whatsapp }));
    const banner = getUI(BANNER_KEY2, { capa: null, logo: null, deleteId: null });
    return h(
      "div",
      { class: "min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0" },
      BackBar({ title: "Editar empresa", onBack: () => goBack("/empresa") }),
      h(
        "div",
        { class: "flex-1 flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4" },
        h(
          "div",
          { class: "flex flex-col gap-1.5" },
          h("span", { class: "text-sm font-semibold text-concrete-900" }, "Foto de capa"),
          PhotoSlot({ shape: "rect", height: "9rem", placeholder: "Capa da construtora", value: banner.capa, onChange: (v) => setUI(BANNER_KEY2, { capa: v }) })
        ),
        h(
          "div",
          { class: "flex flex-col items-center gap-2" },
          PhotoSlot({ shape: "circle", value: banner.logo, onChange: (v) => setUI(BANNER_KEY2, { logo: v }), className: "w-24 h-24", placeholder: "Logo" })
        ),
        Input({ id: "edit-company-name", label: "Nome da empresa", icon: "building-2", hint: "\xC9 esse nome que aparece no seu perfil e nas vagas que voc\xEA publicar.", value: ui.name, onInput: (v) => setUI(KEY7, { name: v }) }),
        h(
          "div",
          { class: "flex flex-col gap-1.5 w-full" },
          h("span", { class: "text-sm font-semibold text-concrete-900" }, "CNPJ"),
          h(
            "div",
            { class: "flex items-center gap-2 min-h-12 px-3 bg-concrete-100 rounded-control border border-concrete-200" },
            Icon("lock", { size: 18, color: "var(--text-subtle)" }),
            h("span", { class: "flex-1 min-w-0 font-mono text-base text-concrete-500 truncate" }, company.cnpj)
          ),
          h("span", { class: "text-sm text-concrete-500" }, "O CNPJ \xE9 conferido na Bicos e n\xE3o pode ser alterado. Fale com o suporte se precisar corrigi-lo.")
        ),
        Select({ label: "Tipo de obra", options: TIPOS_OBRA, value: ui.tipoObra, onChange: (v) => setUI(KEY7, { tipoObra: v }) }),
        Input({ id: "edit-company-location", label: "Regi\xE3o onde voc\xEA contrata", icon: "map-pin", value: ui.location, onInput: (v) => setUI(KEY7, { location: v }) }),
        Input({ id: "edit-company-whatsapp", label: "WhatsApp de contato", icon: "phone", value: ui.whatsapp, onInput: (v) => setUI(KEY7, { whatsapp: v }) }),
        h("div", { class: "pt-2 border-t border-concrete-200" }, Button({ label: "Sair da conta", variant: "danger", fullWidth: true, iconLeft: "log-out", onClick: () => navigate2("/login") }))
      ),
      h(
        "div",
        { class: "px-4 sm:px-6 lg:px-0 py-3 bg-white shadow-bar flex gap-3 lg:static lg:bg-transparent lg:shadow-none" },
        Button({ label: "Cancelar", variant: "secondary", className: "flex-1", onClick: () => navigate2("/empresa") }),
        Button({ label: "Salvar altera\xE7\xF5es", className: "flex-[1.4]", onClick: () => {
          Object.assign(company, ui);
          navigate2("/empresa");
        } })
      )
    );
  }

  // js/screens/shared/ReviewsScreen.js
  function renderReviews(navigate2, params) {
    const type = params.type === "construtora" ? "construtora" : "trabalhador";
    const subject = type === "trabalhador" ? getWorker(params.id) : getCompany(params.id);
    if (!subject) return notFound3(navigate2);
    const role = getRole();
    const allowed = type === "trabalhador" ? role === "recrutador" : role === "trabalhador";
    const backTarget = type === "trabalhador" ? "/trabalhador/" + params.id : "/construtora/" + params.id;
    if (!allowed) {
      return h(
        "div",
        { class: "flex flex-col" },
        BackBar({ title: "Avalia\xE7\xF5es", onBack: () => goBack(backTarget) }),
        EmptyState({
          icon: "lock",
          title: "Essas avalia\xE7\xF5es n\xE3o s\xE3o suas para ver",
          description: type === "trabalhador" ? "S\xF3 construtoras podem ver as avalia\xE7\xF5es de um trabalhador." : "S\xF3 trabalhadores podem ver as avalia\xE7\xF5es de uma construtora."
        })
      );
    }
    const reviews = subject.reviews || [];
    const count = type === "trabalhador" ? subject.jobsDone : subject.reviewCount;
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Avalia\xE7\xF5es", onBack: () => goBack(backTarget) }),
      h(
        "div",
        { class: "flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4" },
        h(
          "div",
          { class: "flex flex-col gap-1.5" },
          h("span", { class: "font-display font-bold text-2xl text-concrete-900" }, subject.name),
          Rating({ value: subject.rating, count })
        ),
        reviews.length === 0 ? EmptyState({ icon: "star", title: "Ainda n\xE3o h\xE1 avalia\xE7\xF5es", description: `${subject.name} ainda n\xE3o recebeu nenhuma avalia\xE7\xE3o na plataforma.` }) : h("div", { class: "flex flex-col gap-3" }, ...reviews.map((r) => Card(
          { padding: "md" },
          h(
            "div",
            { class: "flex flex-col gap-2" },
            h("div", { class: "flex items-center justify-between gap-2" }, h("span", { class: "font-semibold text-concrete-900" }, r.company || r.author), Rating({ value: r.value, showValue: false, size: 13 })),
            h("span", { class: "text-sm text-concrete-700" }, r.text),
            h("span", { class: "text-xs text-concrete-400" }, r.date)
          )
        )))
      )
    );
  }
  function notFound3(navigate2) {
    return h(
      "div",
      { class: "flex flex-col items-center justify-center min-h-screen gap-3" },
      h("p", { class: "text-concrete-500" }, "N\xE3o encontrado."),
      Button({ label: "Voltar ao mural", variant: "secondary", onClick: () => navigate2("/mural") })
    );
  }

  // js/data/cidades.js
  var CIDADES_RAW = "S\xE3o Paulo|SP|-23.53|-46.64\nRio de Janeiro|RJ|-22.91|-43.2\nBras\xEDlia|DF|-15.78|-47.93\nFortaleza|CE|-3.72|-38.54\nSalvador|BA|-12.97|-38.5\nBelo Horizonte|MG|-19.91|-43.93\nManaus|AM|-3.12|-60.02\nCuritiba|PR|-25.42|-49.26\nRecife|PE|-8.05|-34.88\nGoi\xE2nia|GO|-16.69|-49.26\nBel\xE9m|PA|-1.46|-48.49\nPorto Alegre|RS|-30.03|-51.21\nGuarulhos|SP|-23.45|-46.53\nCampinas|SP|-22.91|-47.07\nS\xE3o Lu\xEDs|MA|-2.54|-44.28\nMacei\xF3|AL|-9.67|-35.73\nCampo Grande|MS|-20.45|-54.63\nS\xE3o Gon\xE7alo|RJ|-22.83|-43.06\nTeresina|PI|-5.09|-42.8\nJo\xE3o Pessoa|PB|-7.12|-34.86\nDuque de Caxias|RJ|-22.79|-43.3\nNova Igua\xE7u|RJ|-22.76|-43.46\nS\xE3o Bernardo do Campo|SP|-23.69|-46.56\nNatal|RN|-5.79|-35.2\nSanto Andr\xE9|SP|-23.67|-46.54\nSorocaba|SP|-23.5|-47.45\nUberl\xE2ndia|MG|-18.91|-48.27\nOsasco|SP|-23.53|-46.79\nRibeir\xE3o Preto|SP|-21.17|-47.81\nS\xE3o Jos\xE9 dos Campos|SP|-23.19|-45.88\nCuiab\xE1|MT|-15.6|-56.1\nJaboat\xE3o dos Guararapes|PE|-8.11|-35.02\nJoinville|SC|-26.3|-48.85\nFeira de Santana|BA|-12.27|-38.97\nContagem|MG|-19.93|-44.05\nAracaju|SE|-10.91|-37.07\nFlorian\xF3polis|SC|-27.59|-48.55\nLondrina|PR|-23.3|-51.17\nSerra|ES|-20.12|-40.31\nJuiz de Fora|MG|-21.76|-43.34\nAparecida de Goi\xE2nia|GO|-16.82|-49.25\nCampos dos Goytacazes|RJ|-21.76|-41.32\nBelford Roxo|RJ|-22.76|-43.4\nPorto Velho|RO|-8.76|-63.9\nNiter\xF3i|RJ|-22.88|-43.1\nAnanindeua|PA|-1.36|-48.37\nVila Velha|ES|-20.34|-40.29\nS\xE3o Jos\xE9 do Rio Preto|SP|-20.81|-49.38\nMacap\xE1|AP|0.03|-51.07\nBoa Vista|RR|2.82|-60.68\nCaxias do Sul|RS|-29.16|-51.18\nMogi das Cruzes|SP|-23.52|-46.19\nS\xE3o Jo\xE3o de Meriti|RJ|-22.81|-43.37\nJundia\xED|SP|-23.19|-46.9\nCampina Grande|PB|-7.22|-35.87\nPiracicaba|SP|-22.73|-47.65\nMontes Claros|MG|-16.73|-43.86\nBetim|MG|-19.97|-44.2\nMaring\xE1|PR|-23.42|-51.93\nSantos|SP|-23.95|-46.34\nMau\xE1|SP|-23.67|-46.46\nAn\xE1polis|GO|-16.33|-48.95\nPetrolina|PE|-9.39|-40.5\nCaruaru|PE|-8.28|-35.97\nDiadema|SP|-23.68|-46.62\nCarapicu\xEDba|SP|-23.52|-46.84\nVit\xF3ria da Conquista|BA|-14.86|-40.84\nBauru|SP|-22.32|-49.09\nRio Branco|AC|-9.97|-67.82\nBlumenau|SC|-26.92|-49.07\nItaquaquecetuba|SP|-23.48|-46.35\nCaucaia|CE|-3.73|-38.66\nCariacica|ES|-20.26|-40.42\nPonta Grossa|PR|-25.09|-50.17\nPraia Grande|SP|-24.01|-46.41\nCascavel|PR|-24.96|-53.46\nFranca|SP|-20.54|-47.4\nPaulista|PE|-7.93|-34.87\nOlinda|PE|-8.01|-34.85\nSantar\xE9m|PA|-2.44|-54.7\nCanoas|RS|-29.91|-51.19\nUberaba|MG|-19.75|-47.94\nS\xE3o Jos\xE9 dos Pinhais|PR|-25.53|-49.2\nRibeir\xE3o das Neves|MG|-19.76|-44.08\nVit\xF3ria|ES|-20.32|-40.31\nS\xE3o Vicente|SP|-23.96|-46.39\nPelotas|RS|-31.76|-52.34\nBarueri|SP|-23.51|-46.88\nPalmas|TO|-10.24|-48.36\nTaubat\xE9|SP|-23.01|-45.56\nCama\xE7ari|BA|-12.7|-38.33\nSuzano|SP|-23.54|-46.31\nV\xE1rzea Grande|MT|-15.65|-56.13\nParauapebas|PA|-6.07|-49.9\nJuazeiro do Norte|CE|-7.2|-39.31\nLimeira|SP|-22.57|-47.4\nFoz do Igua\xE7u|PR|-25.54|-54.58\nS\xE3o Jos\xE9|SC|-27.61|-48.64\nPetr\xF3polis|RJ|-22.52|-43.19\nGuaruj\xE1|SP|-23.99|-46.26\nItaja\xED|SC|-26.91|-48.67\nSumar\xE9|SP|-22.82|-47.27\nMarab\xE1|PA|-5.38|-49.13\nCotia|SP|-23.6|-46.92\nImperatriz|MA|-5.52|-47.48\nTabo\xE3o da Serra|SP|-23.6|-46.75\nChapec\xF3|SC|-27.1|-52.62\nSanta Maria|RS|-29.69|-53.81\nVolta Redonda|RJ|-22.52|-44.1\nMossor\xF3|RN|-5.18|-37.35\nGravata\xED|RS|-29.94|-50.99\nParnamirim|RN|-5.91|-35.27\nIndaiatuba|SP|-23.08|-47.21\nGovernador Valadares|MG|-18.85|-41.96\nS\xE3o Carlos|SP|-22.02|-47.89\nMaca\xE9|RJ|-22.38|-41.78\nDourados|MS|-22.22|-54.81\nRondon\xF3polis|MT|-16.47|-54.64\nEmbu das Artes|SP|-23.64|-46.86\nS\xE3o Jos\xE9 de Ribamar|MA|-2.55|-44.06\nJuazeiro|BA|-9.42|-40.5\nAraraquara|SP|-21.78|-48.18\nPalho\xE7a|SC|-27.65|-48.67\nMaracana\xFA|CE|-3.87|-38.63\nJacare\xED|SP|-23.3|-45.97\nHortol\xE2ndia|SP|-22.85|-47.21\nAmericana|SP|-22.74|-47.33\nMar\xEDlia|SP|-22.22|-49.95\n\xC1guas Lindas de Goi\xE1s|GO|-15.76|-48.28\nMag\xE9|RJ|-22.66|-43.03\nArapiraca|AL|-9.75|-36.66\nDivin\xF3polis|MG|-20.14|-44.89\nItapevi|SP|-23.55|-46.93\nColombo|PR|-25.29|-49.23\nRio Verde|GO|-17.79|-50.92\nItabora\xED|RJ|-22.76|-42.86\nSete Lagoas|MG|-19.46|-44.24\nCabo Frio|RJ|-22.89|-42.03\nNovo Hamburgo|RS|-29.69|-51.13\nIpatinga|MG|-19.47|-42.55\nPresidente Prudente|SP|-22.12|-51.39\nViam\xE3o|RS|-30.08|-51.02\nSanta Luzia|MG|-19.75|-43.85\nCrici\xFAma|SC|-28.67|-49.37\nS\xE3o Leopoldo|RS|-29.75|-51.15\nSinop|MT|-11.86|-55.51\nLuzi\xE2nia|GO|-16.25|-47.95\nLauro de Freitas|BA|-12.9|-38.32\nValpara\xEDso de Goi\xE1s|GO|-16.07|-47.98\nCabo de Santo Agostinho|PE|-8.28|-35.03\nSobral|CE|-3.69|-40.35\nPasso Fundo|RS|-28.26|-52.41\nMaric\xE1|RJ|-22.94|-42.82\nRio Claro|SP|-22.4|-47.55\nCastanhal|PA|-1.3|-47.92\nAra\xE7atuba|SP|-21.21|-50.44\nNossa Senhora do Socorro|SE|-10.85|-37.12\nNova Friburgo|RJ|-22.29|-42.54\nJaragu\xE1 do Sul|SC|-26.49|-49.07\nRio Grande|RS|-32.03|-52.11\nCachoeiro de Itapemirim|ES|-20.85|-41.12\nItabuna|BA|-14.79|-39.28\nAlvorada|RS|-29.99|-51.08\nGuarapuava|PR|-25.39|-51.46\nSanta B\xE1rbara d'Oeste|SP|-22.76|-47.41\nIlh\xE9us|BA|-14.79|-39.05\nFerraz de Vasconcelos|SP|-23.54|-46.37\nBragan\xE7a Paulista|SP|-22.95|-46.54\nLinhares|ES|-19.39|-40.06\nAragua\xEDna|TO|-7.19|-48.2\nTimon|MA|-5.1|-42.83\nPorto Seguro|BA|-16.44|-39.06\nBarra Mansa|RJ|-22.55|-44.18\nIbirit\xE9|MG|-20.03|-44.06\nAngra dos Reis|RJ|-23.0|-44.32\nMesquita|RJ|-22.8|-43.46\nTeres\xF3polis|RJ|-22.42|-42.98\nItu|SP|-23.25|-47.29\nSenador Canedo|GO|-16.71|-49.09\nS\xE3o Caetano do Sul|SP|-23.62|-46.55\nPindamonhangaba|SP|-22.92|-45.46\nLages|SC|-27.82|-50.33\nAbaetetuba|PA|-1.72|-48.88\nPo\xE7os de Caldas|MG|-21.78|-46.57\nBarreiras|BA|-12.14|-45.0\nFrancisco Morato|SP|-23.28|-46.74\nParna\xEDba|PI|-2.91|-41.78\nJequi\xE9|BA|-13.85|-40.09\nPatos de Minas|MG|-18.57|-46.5\nRio das Ostras|RJ|-22.52|-41.95\nAtibaia|SP|-23.12|-46.56\nFazenda Rio Grande|PR|-25.66|-49.31\nItapetininga|SP|-23.59|-48.05\nSantana de Parna\xEDba|SP|-23.44|-46.92\nCaxias|MA|-4.87|-43.36\nItapecerica da Serra|SP|-23.72|-46.86\nArauc\xE1ria|PR|-25.59|-49.4\nPouso Alegre|MG|-22.23|-45.94\nAlagoinhas|BA|-12.13|-38.42\nSanta Rita|PB|-7.12|-34.98\nToledo|PR|-24.72|-53.74\nMogi Gua\xE7u|SP|-22.37|-46.94\nCamaragibe|PE|-8.02|-34.98\nNil\xF3polis|RJ|-22.81|-43.42\nBrusque|SC|-27.1|-48.91\nTeixeira de Freitas|BA|-17.54|-39.74\nTrindade|GO|-16.65|-49.49\nPa\xE7o do Lumiar|MA|-2.52|-44.1\nGaranhuns|PE|-8.88|-36.5\nBalne\xE1rio Cambori\xFA|SC|-26.99|-48.64\nBotucatu|SP|-22.88|-48.44\nFranco da Rocha|SP|-23.32|-46.73\nParanagu\xE1|PR|-25.52|-48.52\nQueimados|RJ|-22.71|-43.55\nCamet\xE1|PA|-2.24|-49.5\nCampo Largo|PR|-25.45|-49.53\nVit\xF3ria de Santo Ant\xE3o|PE|-8.13|-35.3\nVarginha|MG|-21.56|-45.44\nTr\xEAs Lagoas|MS|-20.78|-51.7\nTe\xF3filo Otoni|MG|-17.86|-41.51\nCaraguatatuba|SP|-23.61|-45.41\nCachoeirinha|RS|-29.95|-51.1\nSalto|SP|-23.2|-47.29\nJi-Paran\xE1|RO|-10.88|-61.93\nBarcarena|PA|-1.51|-48.62\nCrato|CE|-7.22|-39.41\nItapipoca|CE|-3.5|-39.58\nConselheiro Lafaiete|MG|-20.66|-43.78\nAltamira|PA|-3.2|-52.21\nVespasiano|MG|-19.69|-43.92\nSanta Cruz do Sul|RS|-29.72|-52.43\nAraruama|RJ|-22.87|-42.33\nResende|RJ|-22.47|-44.45\nJa\xFA|SP|-22.29|-48.56\nSapucaia do Sul|RS|-29.83|-51.15\nGuarapari|ES|-20.68|-40.51\nAraras|SP|-22.36|-47.38\nItaituba|PA|-4.27|-55.99\nApucarana|PR|-23.55|-51.46\nSabar\xE1|MG|-19.88|-43.83\nS\xE3o Mateus|ES|-18.72|-39.86\nVotorantim|SP|-23.54|-47.44\nBragan\xE7a|PA|-1.06|-46.78\nValinhos|SP|-22.97|-47.0\nSert\xE3ozinho|SP|-21.13|-47.99\nPinhais|PR|-25.44|-49.19\nBarbacena|MG|-21.22|-43.77\nColatina|ES|-19.55|-40.63\nTatu\xED|SP|-23.35|-47.85\nSarandi|PR|-23.44|-51.88\nBento Gon\xE7alves|RS|-29.17|-51.52\nPiraquara|PR|-25.44|-49.06\nItatiba|SP|-23.0|-46.85\nBarretos|SP|-20.55|-48.57\nAlmirante Tamandar\xE9|PR|-25.32|-49.3\nArapongas|PR|-23.42|-51.43\nSorriso|MT|-12.54|-55.72\nS\xE3o Gon\xE7alo do Amarante|RN|-5.79|-35.33\nItagua\xED|RJ|-22.86|-43.78\nAraguari|MG|-18.65|-48.19\nBirigui|SP|-21.29|-50.34\nUmuarama|PR|-23.77|-53.32\nIgarassu|PE|-7.83|-34.9\nCatal\xE3o|GO|-18.17|-47.94\nBag\xE9|RS|-31.33|-54.1\nGuaratinguet\xE1|SP|-22.81|-45.19\nFormosa|GO|-15.54|-47.34\nJandira|SP|-23.53|-46.9\nEun\xE1polis|BA|-16.37|-39.58\nNova Lima|MG|-19.98|-43.85\nUruguaiana|RS|-29.76|-57.09\nSim\xF5es Filho|BA|-12.79|-38.4\nV\xE1rzea Paulista|SP|-23.21|-46.82\nMarituba|PA|-1.36|-48.34\nPaulo Afonso|BA|-9.4|-38.22\nCatanduva|SP|-21.13|-48.98\nRibeir\xE3o Pires|SP|-23.71|-46.41\nSantana|AP|-0.05|-51.17\nArax\xE1|MG|-19.59|-46.94\nItanha\xE9m|SP|-24.17|-46.79\nLu\xEDs Eduardo Magalh\xE3es|BA|-12.1|-45.79\nCod\xF3|MA|-4.46|-43.89\nS\xE3o Louren\xE7o da Mata|PE|-8.01|-35.01\nItabira|MG|-19.62|-43.23\nCambori\xFA|SC|-27.02|-48.65\nPassos|MG|-20.72|-46.61\nTubar\xE3o|SC|-28.47|-49.01\nPaul\xEDnia|SP|-22.75|-47.15\nBreves|PA|-1.68|-50.48\nCubat\xE3o|SP|-23.89|-46.42\nNova Serrana|MG|-19.87|-44.98\nTangar\xE1 da Serra|MT|-14.62|-57.49\nItacoatiara|AM|-3.14|-58.44\nParagominas|PA|-3.0|-47.35\nItumbiara|GO|-18.41|-49.22\nPlanaltina|GO|-15.45|-47.61\nManacapuru|AM|-3.29|-60.62\nJata\xED|GO|-17.88|-51.72\nCamb\xE9|PR|-23.28|-51.28\nLavras|MG|-21.25|-45.0\nS\xE3o Pedro da Aldeia|RJ|-22.84|-42.1\nA\xE7ail\xE2ndia|MA|-4.95|-47.5\nSanto Ant\xF4nio de Jesus|BA|-12.96|-39.26\nVilhena|RO|-12.75|-60.15\nErechim|RS|-27.64|-52.27\nItabaiana|SE|-10.68|-37.43\nAriquemes|RO|-9.91|-63.03\nCoronel Fabriciano|MG|-19.52|-42.63\nMaranguape|CE|-3.89|-38.68\nMuria\xE9|MG|-21.13|-42.37\nPatos|PB|-7.02|-37.27\nBacabal|MA|-4.22|-44.78\nNovo Gama|GO|-16.06|-48.04\nUb\xE1|MG|-21.12|-42.94\nItaperuna|RJ|-21.2|-41.88\nOurinhos|SP|-22.98|-49.87\nCaldas Novas|GO|-17.74|-48.62\nItuiutaba|MG|-18.98|-49.46\nIpojuca|PE|-8.39|-35.06\nPo\xE1|SP|-23.53|-46.35\nBalsas|MA|-7.53|-46.04\nLagarto|SE|-10.91|-37.67\nAssis|SP|-22.66|-50.42\nSanta Cruz do Capibaribe|PE|-7.95|-36.21\nAbreu e Lima|PE|-7.9|-34.9\nCampo Mour\xE3o|PR|-24.05|-52.38\nAracruz|ES|-19.82|-40.28\nIta\xFAna|MG|-20.08|-44.58\nPar\xE1 de Minas|MG|-19.85|-44.61\nIguatu|CE|-6.36|-39.29\nFrancisco Beltr\xE3o|PR|-26.08|-53.05\nJaperi|RJ|-22.64|-43.66\nParintins|AM|-2.64|-56.73\nCidade Ocidental|GO|-16.08|-47.93\nLeme|SP|-22.18|-47.38\nS\xE3o Crist\xF3v\xE3o|SE|-11.01|-37.2\nVotuporanga|SP|-20.42|-49.98\nCa\xE7apava|SP|-23.1|-45.71\nParacatu|MG|-17.23|-46.87\nCruzeiro do Sul|AC|-7.63|-72.68\nSerra Talhada|PE|-7.98|-38.29\nCorumb\xE1|MS|-19.01|-57.65\nPonta Por\xE3|MS|-22.53|-55.72\nCaieiras|SP|-23.36|-46.74\nBarra do Pira\xED|RJ|-22.47|-43.83\nCajamar|SP|-23.36|-46.88\nCacoal|RO|-11.43|-61.46\nMairipor\xE3|SP|-23.32|-46.59\nPato Branco|PR|-26.23|-52.67\nRio Largo|AL|-9.48|-35.84\nManhua\xE7u|MG|-20.26|-42.03\nUbatuba|SP|-23.43|-45.08\nLajeado|RS|-29.46|-51.96\nItajub\xE1|MG|-22.42|-45.46\nAvar\xE9|SP|-23.11|-48.93\nParanava\xED|PR|-23.08|-52.46\nTucuru\xED|PA|-3.77|-49.68\nS\xE3o Jo\xE3o da Boa Vista|SP|-21.97|-46.79\nNavegantes|SC|-26.89|-48.65\nPrimavera do Leste|MT|-15.54|-54.28\nGua\xEDba|RS|-30.11|-51.32\nLucas do Rio Verde|MT|-13.06|-55.9\nMogi Mirim|SP|-22.43|-46.95\nSaquarema|RJ|-22.93|-42.51\nS\xE3o Jo\xE3o del Rei|MG|-21.13|-44.25\nPatroc\xEDnio|MG|-18.94|-46.99\nGuanambi|BA|-14.22|-42.78\nEsmeraldas|MG|-19.76|-44.31\nReden\xE7\xE3o|PA|-8.03|-50.03\nGravat\xE1|PE|-8.21|-35.57\nItapeva|SP|-23.98|-48.88\nC\xE1ceres|MT|-16.08|-57.68\nMoju|PA|-1.89|-48.77\nUna\xED|MG|-16.36|-46.9\nCaratinga|MG|-19.79|-42.13\nAraripina|PE|-7.57|-40.49\nAruj\xE1|SP|-23.4|-46.32\nGurupi|TO|-11.73|-49.07\nValen\xE7a|BA|-13.37|-39.07\nCana\xE3 dos Caraj\xE1s|PA|-6.5|-49.88\nQuixad\xE1|CE|-4.97|-39.02\nSanta In\xEAs|MA|-3.65|-45.38\nPinheiro|MA|-2.52|-45.08\nIju\xED|RS|-28.39|-53.92\nBarra do Corda|MA|-5.5|-45.25\nS\xE3o Bento do Sul|SC|-26.25|-49.38\nLorena|SP|-22.73|-45.12\nSant'Ana do Livramento|RS|-30.88|-55.54\nConc\xF3rdia|SC|-27.23|-52.03\nMaca\xEDba|RN|-5.85|-35.36\nTiangu\xE1|CE|-3.73|-40.99\nJacobina|BA|-11.18|-40.51\nPicos|PI|-7.08|-41.47\nPacatuba|CE|-3.98|-38.62\nQuixeramobim|CE|-5.19|-39.29\nItapema|SC|-27.09|-48.62\nGoiana|PE|-7.56|-35.0\nAquiraz|CE|-3.9|-38.39\nSerop\xE9dica|RJ|-22.75|-43.72\nSerrinha|BA|-11.66|-39.01\nChapadinha|MA|-3.74|-43.35\nCurvelo|MG|-18.75|-44.43\nS\xE3o Sebasti\xE3o|SP|-23.8|-45.41\nTim\xF3teo|MG|-19.58|-42.65\nBelo Jardim|PE|-8.33|-36.43\nBayeux|PB|-7.12|-34.93\nJo\xE3o Monlevade|MG|-19.81|-43.17\nBigua\xE7u|SC|-27.5|-48.66\nCear\xE1-Mirim|RN|-5.64|-35.42\nCarpina|PE|-7.85|-35.25\nCianorte|PR|-23.66|-52.61\nArcoverde|PE|-8.42|-37.06\nTr\xEAs Rios|RJ|-22.12|-43.22\nAlfenas|MG|-21.43|-45.95\nCachoeira do Sul|RS|-30.03|-52.89\nEus\xE9bio|CE|-3.89|-38.46\nGoianira|GO|-16.49|-49.43\nBarbalha|CE|-7.3|-39.3\nS\xE3o Roque|SP|-23.52|-47.14\nLagoa Santa|MG|-19.64|-43.89\nHorizonte|CE|-4.12|-38.47\nMat\xE3o|SP|-21.6|-48.36\nTef\xE9|AM|-3.37|-64.72\nCrate\xFAs|CE|-5.17|-40.65\nCampo Limpo Paulista|SP|-23.21|-46.79\nVi\xE7osa|MG|-20.76|-42.87\nSanta Rosa|RS|-27.87|-54.48\nAracati|CE|-4.56|-37.77\nSanta Izabel do Par\xE1|PA|-1.3|-48.16\nSanto \xC2ngelo|RS|-28.3|-54.27\nVinhedo|SP|-23.03|-46.98\nViana|ES|-20.38|-40.49\nIrec\xEA|BA|-11.3|-41.85\nGaspar|SC|-26.93|-48.95\nTr\xEAs Cora\xE7\xF5es|MG|-21.69|-45.25\nBebedouro|SP|-20.95|-48.48\nEsteio|RS|-29.85|-51.18\nSenhor do Bonfim|BA|-10.46|-40.19\nGoian\xE9sia|GO|-15.31|-49.12\nSapiranga|RS|-29.63|-51.01\nOuro Preto|MG|-20.38|-43.51\nIndaial|SC|-26.9|-49.24\nIbi\xFAna|SP|-23.66|-47.22\nTel\xEAmaco Borba|PR|-24.32|-50.62\nRio do Sul|SC|-27.22|-49.64\nCanind\xE9|CE|-4.35|-39.32\nCascavel|CE|-4.13|-38.24\nLins|SP|-21.67|-49.75\nGraja\xFA|MA|-5.81|-46.15\nArarangu\xE1|SC|-28.94|-49.49\nCruzeiro|SP|-22.57|-44.97\nCa\xE7ador|SC|-26.78|-51.01\nCasa Nova|BA|-9.16|-40.97\nAlenquer|PA|-1.95|-54.74\nRol\xE2ndia|PR|-23.31|-51.37\nCastro|PR|-24.79|-50.01\nPirassununga|SP|-22.0|-47.43\nPacajus|CE|-4.17|-38.47\nCapanema|PA|-1.21|-47.18\nDias d'\xC1vila|BA|-12.62|-38.29\nTail\xE2ndia|PA|-2.95|-48.95\nSanto Ant\xF4nio do Descoberto|GO|-15.94|-48.26\nS\xE3o Sebasti\xE3o do Para\xEDso|MG|-20.92|-46.98\nCampo Formoso|BA|-10.51|-40.32\nMineiros|GO|-17.57|-52.55\nItupeva|SP|-23.15|-47.06\nCandeias|BA|-12.67|-38.55\nRussas|CE|-4.93|-37.97\nBrumado|BA|-14.2|-41.67\nAlegrete|RS|-29.79|-55.79\nItapira|SP|-22.44|-46.82\nBarra do Gar\xE7as|MT|-15.88|-52.26\nPalmeira dos \xCDndios|AL|-9.41|-36.63\nCoari|AM|-4.09|-63.14\nJana\xFAba|MG|-15.8|-43.31\nFernand\xF3polis|SP|-20.28|-50.25\nJaboticabal|SP|-21.25|-48.33\nTabatinga|AM|-4.24|-69.94\nTom\xE9-A\xE7u|PA|-2.41|-48.14\nOriximin\xE1|PA|-1.76|-55.86\nFarroupilha|RS|-29.22|-51.34\nItaitinga|CE|-3.97|-38.53\nConcei\xE7\xE3o do Coit\xE9|BA|-11.56|-39.28\nValen\xE7a|RJ|-22.24|-43.71\nFormiga|MG|-20.46|-45.43\nVen\xE2ncio Aires|RS|-29.61|-52.19\nCabedelo|PB|-6.99|-34.83\nPeru\xEDbe|SP|-24.31|-47.0\nSousa|PB|-6.75|-38.23\nAmparo|SP|-22.71|-46.77\nPorto Nacional|TO|-10.7|-48.41\nIgarap\xE9-Miri|PA|-1.98|-48.96\nMococa|SP|-21.46|-47.0\nAcara\xFA|CE|-2.89|-40.12\nBenevides|PA|-1.36|-48.24\nEmbu-Gua\xE7u|SP|-23.83|-46.81\nBom Jesus da Lapa|BA|-13.25|-43.41\nIranduba|AM|-3.27|-60.19\nItapetinga|BA|-15.25|-40.25\nExtremoz|RN|-5.7|-35.3\nLen\xE7\xF3is Paulista|SP|-22.6|-48.8\nOuricuri|PE|-7.88|-40.08\nItaberaba|BA|-12.52|-40.31\nBarreirinhas|MA|-2.76|-42.82\nPiripiri|PI|-4.27|-41.77\nMonte Mor|SP|-22.95|-47.31\nSurubim|PE|-7.85|-35.75\nCataguases|MG|-21.39|-42.69\nPortel|PA|-1.94|-50.82\nBertioga|SP|-23.85|-46.14\nJanu\xE1ria|MG|-15.48|-44.36\nEst\xE2ncia|SE|-11.27|-37.45\nCristalina|GO|-16.77|-47.61\nCajazeiras|PB|-6.88|-38.56\nMontenegro|RS|-29.68|-51.47\nMau\xE9s|AM|-3.39|-57.71\nCap\xE3o da Canoa|RS|-29.76|-50.03\nVacaria|RS|-28.51|-50.94\nSalgueiro|PE|-8.07|-39.12\nMirassol|SP|-20.82|-49.52\nPesqueira|PE|-8.36|-36.7\nTup\xE3|SP|-21.93|-50.52\nMorada Nova|CE|-5.1|-38.37\nCamocim|CE|-2.9|-40.85\nPedro Leopoldo|MG|-19.63|-44.04\nBezerros|PE|-8.23|-35.8\nMongagu\xE1|SP|-24.08|-46.63\nEuclides da Cunha|BA|-10.51|-39.02\nIc\xF3|CE|-6.4|-38.86\nCampo Bom|RS|-29.67|-51.06\nTau\xE1|CE|-5.99|-40.3\nS\xE3o F\xE9lix do Xingu|PA|-6.64|-51.99\nNova Odessa|SP|-22.78|-47.29\nMariana|MG|-20.38|-43.41\nFloriano|PI|-6.77|-43.02\nMonte Alegre|PA|-2.0|-54.07\nCamaqu\xE3|RS|-30.85|-51.8\nBoituva|SP|-23.29|-47.68\nNovo Repartimento|PA|-4.25|-49.95\nCarazinho|RS|-28.3|-52.79\nI\xE7ara|SC|-28.71|-49.31\nNova Mutum|MT|-13.84|-56.07\nHumait\xE1|AM|-7.51|-63.03\nPen\xE1polis|SP|-21.41|-50.08\nCaic\xF3|RN|-6.45|-37.11\nCruz das Almas|BA|-12.67|-39.1\nAcar\xE1|PA|-1.95|-48.2\nVi\xE7osa do Cear\xE1|CE|-3.57|-41.09\nRolim de Moura|RO|-11.73|-61.77\nDom Eliseu|PA|-4.2|-47.82\nLimoeiro do Norte|CE|-5.14|-38.08\nMarechal Deodoro|AL|-9.71|-35.9\nJaguari\xFAna|SP|-22.7|-46.99\nItapecuru Mirim|MA|-3.4|-44.35\nViseu|PA|-1.19|-46.14\nEscada|PE|-8.36|-35.22\nAlta Floresta|MT|-9.87|-56.09\nIbitinga|SP|-21.76|-48.83\nTrairi|CE|-3.27|-39.27\nItamaraju|BA|-17.04|-39.54\nRegistro|SP|-24.5|-47.84\nAndradina|SP|-20.89|-51.38\nCoroat\xE1|MA|-4.13|-44.12\nS\xE3o Borja|RS|-28.66|-56.0\nFrutal|MG|-20.03|-48.94\nCosm\xF3polis|SP|-22.64|-47.19\nIrati|PR|-25.47|-50.65\nUni\xE3o dos Palmares|AL|-9.16|-36.02\nCruz Alta|RS|-28.64|-53.6\nCapit\xE3o Po\xE7o|PA|-1.75|-47.06\nPenedo|AL|-10.29|-36.58\nS\xE3o Gabriel|RS|-30.33|-54.32\nGuarabira|PB|-6.85|-35.48\nBatatais|SP|-20.89|-47.59\nPaudalho|PE|-7.9|-35.17\nCachoeiras de Macacu|RJ|-22.47|-42.65\nPonte Nova|MG|-20.41|-42.9\nExtrema|MG|-22.85|-46.32\nLimoeiro|PE|-7.87|-35.44\nIpir\xE1|BA|-12.16|-39.74\nRio Bonito|RJ|-22.72|-42.63\nA\xE7u|RN|-5.58|-36.91\nVideira|SC|-27.01|-51.15\nSanta Luzia|MA|-4.07|-45.69\nMarechal C\xE2ndido Rondon|PR|-24.56|-54.06\nTijucas|SC|-27.24|-48.63\nPorto Feliz|SP|-23.21|-47.53\nSanto Amaro|BA|-12.55|-38.71\nS\xE3o Gon\xE7alo do Amarante|CE|-3.61|-38.97\nManicor\xE9|AM|-5.8|-61.29\nMedianeira|PR|-25.3|-54.09\nXinguara|PA|-7.1|-49.94\nPirapora|MG|-17.34|-44.93\nMoreno|PE|-8.11|-35.08\nS\xE3o Gabriel da Cachoeira|AM|-0.12|-67.08\nMafra|SC|-26.12|-49.81\nImbituba|SC|-28.23|-48.67\nTr\xEAs Pontas|MG|-21.37|-45.51\nRondon do Par\xE1|PA|-4.78|-48.07\nCanoinhas|SC|-26.18|-50.4\nOl\xEDmpia|SP|-20.74|-48.91\nBai\xE3o|PA|-2.79|-49.67\nBuriticupu|MA|-4.32|-46.44\nS\xE3o Francisco do Sul|SC|-26.26|-48.63\nUni\xE3o da Vit\xF3ria|PR|-26.23|-51.09\nPalmares|PE|-8.68|-35.59\nTramanda\xED|RS|-29.98|-50.13\nItabirito|MG|-20.25|-43.8\nRibeira do Pombal|BA|-10.84|-38.54\nBeberibe|CE|-4.18|-38.13\nS\xE3o Miguel do Guam\xE1|PA|-1.61|-47.48\nGranja|CE|-3.13|-40.84\nPontes e Lacerda|MT|-15.22|-59.34\nPara\xEDso do Tocantins|TO|-10.18|-48.88\nJaru|RO|-10.43|-62.48\n\xD3bidos|PA|-1.9|-55.52\nCongonhas|MG|-20.5|-43.85\nSanto Est\xEAv\xE3o|BA|-12.43|-39.25\nTut\xF3ia|MA|-2.76|-42.28\nXanxer\xEA|SC|-26.87|-52.4\nLouveira|SP|-23.09|-46.95\nCaetit\xE9|BA|-14.07|-42.49\nSanta Isabel|SP|-23.32|-46.22\nBom Despacho|MG|-19.74|-45.26\nTaquara|RS|-29.65|-50.78\nMorrinhos|GO|-17.73|-49.11\nGuapimirim|RJ|-22.53|-42.99\nPiedade|SP|-23.71|-47.43\nJuruti|PA|-2.16|-56.09\nS\xE3o Francisco|MG|-15.95|-44.86\nBrejo Santo|CE|-7.48|-38.98\nVigia|PA|-0.86|-48.14\nCampo Belo|MG|-20.89|-45.27\nPorto Ferreira|SP|-21.85|-47.49\nLagoa da Prata|MG|-20.02|-45.54\nInhumas|GO|-16.36|-49.5\nBarra|BA|-11.09|-43.15\nParob\xE9|RS|-29.62|-50.83\nBu\xEDque|PE|-8.62|-37.16\nArtur Nogueira|SP|-22.57|-47.17\nSap\xE9|PB|-7.09|-35.23\nS\xE3o Jos\xE9 do Rio Pardo|SP|-21.6|-46.89\nTrememb\xE9|SP|-22.96|-45.55\nS\xE3o Miguel dos Campos|AL|-9.78|-36.1\nIbipor\xE3|PR|-23.27|-51.05\nTaquaritinga|SP|-21.4|-48.51\nViana|MA|-3.2|-44.99\nNavira\xED|MS|-23.06|-54.2\nBarra Velha|SC|-26.64|-48.69\nDelmiro Gouveia|AL|-9.39|-38.0\nTobias Barreto|SE|-11.18|-38.0\nGuaxup\xE9|MG|-21.3|-46.71\nLeopoldina|MG|-21.53|-42.64\nVargem Grande Paulista|SP|-23.6|-47.02\nNova Ven\xE9cia|ES|-18.71|-40.41\nItupiranga|PA|-5.13|-49.34\nBoa Viagem|CE|-5.11|-39.73\nAraquari|SC|-26.38|-48.72\nMairinque|SP|-23.54|-47.19\nCoruripe|AL|-10.13|-36.17\nCampo Novo do Parecis|MT|-13.66|-57.89\nCapivari|SP|-23.0|-47.51\nBrejo da Madre de Deus|PE|-8.15|-36.37\nS\xE3o Bento do Una|PE|-8.53|-36.45\nTucano|BA|-10.96|-38.79\nGuaramirim|SC|-26.47|-49.0\nCangu\xE7u|RS|-31.4|-52.68\nPrudent\xF3polis|PR|-25.21|-50.98\nNova Andradina|MS|-22.24|-53.34\nPo\xE7\xF5es|BA|-14.52|-40.36\nCanela|RS|-29.36|-50.81\nQueimadas|PB|-7.35|-35.9\nCampina Grande do Sul|PR|-25.3|-49.06\nSantiago|RS|-29.19|-54.87\nQuirin\xF3polis|GO|-18.45|-50.45\nAraci|BA|-11.33|-38.96\nPalmas|PR|-26.48|-51.99\nCatu|BA|-12.35|-38.38\nAltos|PI|-5.04|-42.46\nJales|SP|-20.27|-50.55\nS\xE3o Benedito|CE|-4.05|-40.86\nS\xE3o Jos\xE9 de Mipibu|RN|-6.08|-35.24\nS\xE3o Joaquim da Barra|SP|-20.58|-47.86\nMonte Santo|BA|-10.44|-39.33\nBocai\xFAva|MG|-17.11|-43.81\nTimb\xF3|SC|-26.82|-49.27\nSidrol\xE2ndia|MS|-20.93|-54.97\nBarras|PI|-4.24|-42.29\nMuan\xE1|PA|-1.54|-49.22\nMonte Carmelo|MG|-18.73|-47.49\nEst\xE2ncia Velha|RS|-29.65|-51.18\nDiamantina|MG|-18.24|-43.6\nL\xE1brea|AM|-7.26|-64.79\nIgarap\xE9|MG|-20.07|-44.3\nItapaj\xE9|CE|-3.68|-39.59\nCampo Verde|MT|-15.54|-55.16\nSantana do Para\xEDso|MG|-19.37|-42.54\nOs\xF3rio|RS|-29.89|-50.27\nMonte Alto|SP|-21.27|-48.5\nJo\xE3o Pinheiro|MG|-17.74|-46.17\nSeabra|BA|-12.42|-41.77\nPai\xE7andu|PR|-23.46|-52.05\nAquidauana|MS|-20.47|-55.79\nSalin\xF3polis|PA|-0.63|-47.35\nCabre\xFAva|SP|-23.31|-47.14\nCasimiro de Abreu|RJ|-22.48|-42.21\nJu\xEDna|MT|-11.37|-58.75\nS\xE3o Bento|MA|-2.7|-44.83\nMaracaju|MS|-21.61|-55.17\nCampos do Jord\xE3o|SP|-22.73|-45.58\nAugusto Corr\xEAa|PA|-1.05|-46.61\nUni\xE3o|PI|-4.59|-42.86\nSanta Cruz do Rio Pardo|SP|-22.9|-49.64\nS\xE3o Miguel do Oeste|SC|-26.72|-53.52\nParaty|RJ|-23.22|-44.72\nJaguaquara|BA|-13.52|-39.96\nItabera\xED|GO|-16.02|-49.81\nDois Vizinhos|PR|-25.74|-53.06\nMauriti|CE|-7.39|-38.77\nSantana do Ipanema|AL|-9.37|-37.25\nCap\xE3o Bonito|SP|-24.01|-48.35\nS\xE3o Francisco de Itabapoana|RJ|-21.47|-41.11\nTimba\xFAba|PE|-7.5|-35.31\nConcei\xE7\xE3o do Araguaia|PA|-8.26|-49.27\nJardin\xF3polis|SP|-21.02|-47.76\nCampo Maior|PI|-4.82|-42.16\nBreu Branco|PA|-3.77|-49.57\nXique-Xique|BA|-10.82|-42.72\nMamanguape|PB|-6.83|-35.12\nS\xE3o Louren\xE7o|MG|-22.12|-45.05\nTarauac\xE1|AC|-8.16|-70.77\nMarau|RS|-28.45|-52.2\nDracena|SP|-21.48|-51.53\nJaragu\xE1|GO|-15.75|-49.33\nPresidente Dutra|MA|-5.29|-44.49\nCerquilho|SP|-23.17|-47.75\nLivramento de Nossa Senhora|BA|-13.64|-41.84\nPederneiras|SP|-22.35|-48.78\nBom Conselho|PE|-9.17|-36.69\nUruar\xE1|PA|-3.72|-53.74\nAutazes|AM|-3.59|-59.13\nMarata\xEDzes|ES|-21.04|-40.84\nAcopiara|CE|-6.09|-39.45\nLapa|PR|-25.77|-49.72\nLago da Pedra|MA|-4.57|-45.13\nItarema|CE|-2.92|-39.92\nCorn\xE9lio Proc\xF3pio|PR|-23.18|-50.65\nSanto Ant\xF4nio da Platina|PR|-23.3|-50.08\nSerrana|SP|-21.2|-47.6\nSanta Maria de Jetib\xE1|ES|-20.03|-40.74\nPorangatu|GO|-13.44|-49.15\nBarra de S\xE3o Francisco|ES|-18.75|-40.9\nRio Grande da Serra|SP|-23.74|-46.4\nSalto de Pirapora|SP|-23.65|-47.57\nItarar\xE9|SP|-24.11|-49.34\nVera Cruz|BA|-12.96|-38.62\nBarra dos Coqueiros|SE|-10.9|-37.03\nPanambi|RS|-28.28|-53.5\nMata de S\xE3o Jo\xE3o|BA|-12.53|-38.3\nGuaratuba|PR|-25.88|-48.58\nCuru\xE7\xE1|PA|-0.73|-47.85\nMarialva|PR|-23.48|-51.79\nJos\xE9 de Freitas|PI|-4.75|-42.57\nAmontada|CE|-3.36|-39.83\nGuaraciaba do Norte|CE|-4.16|-40.75\nUrua\xE7u|GO|-14.52|-49.14\nSim\xE3o Dias|SE|-10.74|-37.81\nPara\xEDba do Sul|RJ|-22.16|-43.3\nVargem Grande|MA|-3.54|-43.92\nSanto Ant\xF4nio da Patrulha|RS|-29.83|-50.52\nPedreira|SP|-22.74|-46.89\nPorto de Moz|PA|-1.75|-52.24\nLaguna|SC|-28.48|-48.78\nSena Madureira|AC|-9.07|-68.66\nItapemirim|ES|-21.01|-40.83\nToritama|PE|-8.01|-36.06\nS\xE3o Gotardo|MG|-19.31|-46.05\n\xC1guas Belas|PE|-9.11|-37.12\nPacaj\xE1|PA|-3.84|-50.64\nSanto Ant\xF4nio de P\xE1dua|RJ|-21.54|-42.18\nNossa Senhora da Gl\xF3ria|SE|-10.22|-37.42\nMangaratiba|RJ|-22.96|-44.04\nArcos|MG|-20.29|-45.54\nMaca\xFAbas|BA|-13.02|-42.69\nParacambi|RJ|-22.61|-43.71\nGuajar\xE1-Mirim|RO|-10.79|-65.33\nS\xE3o Mateus do Sul|PR|-25.87|-50.38\nTorres|RS|-29.33|-49.73\nS\xE3o Louren\xE7o do Sul|RS|-31.36|-51.97\nSantos Dumont|MG|-21.46|-43.55\nSanta Helena|MA|-2.24|-45.29\nIpu|CE|-4.32|-40.71\nGar\xE7a|SP|-22.21|-49.65\nS\xE3o Sebasti\xE3o do Pass\xE9|BA|-12.51|-38.49\nCurrais Novos|RN|-6.25|-36.51\nTucum\xE3|PA|-6.75|-51.16\nRemanso|BA|-9.62|-42.08\nCoelho Neto|MA|-4.25|-43.01\nSanta Maria da Boa Vista|PE|-8.8|-39.82\nEsperantina|PI|-3.89|-42.23\nAfogados da Ingazeira|PE|-7.74|-37.63\nParana\xEDba|MS|-19.67|-51.19\nArma\xE7\xE3o dos B\xFAzios|RJ|-22.75|-41.88\nSanta Rita do Sapuca\xED|MG|-22.25|-45.7\nAndradas|MG|-22.07|-46.57\nIpia\xFA|BA|-14.12|-39.74\nItabaianinha|SE|-11.27|-37.79\nPedra Branca|CE|-5.45|-39.71\nS\xE3o Gon\xE7alo dos Campos|BA|-12.43|-38.97\nBarreiros|PE|-8.82|-35.18\nMatinhos|PR|-25.82|-48.55\nParagua\xE7u Paulista|SP|-22.41|-50.57\nAlmenara|MG|-16.18|-40.69\nLajedo|PE|-8.66|-36.33\nParacuru|CE|-3.41|-39.03\nCapelinha|MG|-17.69|-42.51\nZ\xE9 Doca|MA|-3.27|-45.66\nColinas|MA|-6.03|-44.25\nAmambai|MS|-23.11|-55.23\nCuritibanos|SC|-27.28|-50.58\nSalinas|MG|-16.18|-42.3\nGramado|RS|-29.37|-50.88\nNova Vi\xE7osa|BA|-17.89|-39.37\nSanta Quit\xE9ria|CE|-4.33|-40.15\nSocorro|SP|-22.59|-46.53\nJacarezinho|PR|-23.16|-49.97\nBoa Esperan\xE7a|MG|-21.09|-45.56\nVargem Grande do Sul|SP|-21.83|-46.89\nS\xE3o Fid\xE9lis|RJ|-21.66|-41.76\nS\xE3o Raimundo Nonato|PI|-9.01|-42.7\nS\xE3o Francisco do Conde|BA|-12.62|-38.68\nBrumadinho|MG|-20.15|-44.2\nEldorado do Sul|RS|-30.08|-51.62\nBenjamin Constant|AM|-4.38|-70.03\nV\xE1rzea Alegre|CE|-6.78|-39.29\nMateus Leme|MG|-19.98|-44.43\nVisconde do Rio Branco|MG|-21.01|-42.84\nOuro Branco|MG|-20.53|-43.7\nEsp\xEDrito Santo do Pinhal|SP|-22.19|-46.75\nOliveira|MG|-20.7|-44.83\nGua\xEDra|SP|-20.32|-48.31\nSanta Maria da Vit\xF3ria|BA|-13.39|-44.2\nAfu\xE1|PA|-0.15|-50.39\nIt\xE1polis|SP|-21.59|-48.81\nRio Brilhante|MS|-21.8|-54.54\nPresidente Epit\xE1cio|SP|-21.77|-52.11\nRio Branco do Sul|PR|-25.19|-49.31\nIturama|MG|-19.73|-50.2\nSento S\xE9|BA|-9.74|-41.88\nAraioses|MA|-2.89|-41.91\nS\xE3o Mateus do Maranh\xE3o|MA|-4.04|-44.47\nRio Negrinho|SC|-26.26|-49.52\nMucuri|BA|-18.08|-39.56\nSantaluz|BA|-11.25|-39.38\nJarinu|SP|-23.1|-46.73\nSarzedo|MG|-20.04|-44.14\nPentecoste|CE|-3.79|-39.27\nEntre Rios|BA|-11.94|-38.09\nS\xE3o Pedro|SP|-22.55|-47.91\nMassap\xEA|CE|-3.52|-40.34\nCaet\xE9|MG|-19.88|-43.67\nRos\xE1rio|MA|-2.93|-44.25\nCansan\xE7\xE3o|BA|-10.66|-39.49\nOeiras|PI|-7.02|-42.13\nJa\xEDba|MG|-15.34|-43.67\nCust\xF3dia|PE|-8.09|-37.64\nSanta Helena de Goi\xE1s|GO|-17.81|-50.6\nCastelo|ES|-20.6|-41.2\nJeremoabo|BA|-10.07|-38.35\nMatozinhos|MG|-19.55|-44.09\nNovo Horizonte|SP|-21.47|-49.22\nUlian\xF3polis|PA|-3.75|-47.49\nBom Jardim|PE|-7.8|-35.58\nS\xE3o Caitano|PE|-8.34|-36.29\nPimenta Bueno|RO|-11.67|-61.2\nBonito|PE|-8.47|-35.73\nSirinha\xE9m|PE|-8.59|-35.11\nOrl\xE2ndia|SP|-20.72|-47.89\nTeot\xF4nio Vilela|AL|-9.92|-36.35\nSanta Cruz|RN|-6.22|-36.02\nPedro II|PI|-4.43|-41.45\nCampos Novos|SC|-27.4|-51.23\nMiss\xE3o Velha|CE|-7.24|-39.14\nTuria\xE7u|MA|-1.66|-45.38\nAgudos|SP|-22.47|-48.99\nMachado|MG|-21.68|-45.92\nBoca do Acre|AM|-8.74|-67.39\nS\xE3o Jo\xE3o da Barra|RJ|-21.64|-41.04\nPrainha|PA|-1.8|-53.48\nTiet\xEA|SP|-23.11|-47.72\nPorteirinha|MG|-15.74|-43.03\nOuro Preto do Oeste|RO|-10.72|-62.26\nGuariba|SP|-21.36|-48.23\nAmargosa|BA|-13.02|-39.6\nBarra do Cho\xE7a|BA|-14.87|-40.58\nSanta Rita|MA|-3.14|-44.32\nAtalaia|AL|-9.51|-36.01\nConfresa|MT|-10.64|-51.57\nMomba\xE7a|CE|-5.74|-39.63\nItuverava|SP|-20.34|-47.79\nAssis Chateaubriand|PR|-24.42|-53.52\nAmarante do Maranh\xE3o|MA|-5.57|-46.75\nMandaguari|PR|-23.54|-51.67\nIpueiras|CE|-4.54|-40.71\nPontal|SP|-21.02|-48.04\nIper\xF3|SP|-23.35|-47.69\nPedreiras|MA|-4.56|-44.6\nDomingos Martins|ES|-20.36|-40.66\nS\xE3o Manuel|SP|-22.73|-48.57\nDom Pedrito|RS|-30.98|-54.67\nPiumhi|MG|-20.48|-45.96\nJos\xE9 Bonif\xE1cio|SP|-21.06|-49.69\nIgarap\xE9-A\xE7u|PA|-1.13|-47.63\nLaranjal do Jari|AP|-0.8|-52.45\nRorain\xF3polis|RR|0.94|-60.44\nFeij\xF3|AC|-8.17|-70.35\nJacund\xE1|PA|-4.45|-49.12\nRos\xE1rio do Sul|RS|-30.25|-54.92\nConcei\xE7\xE3o do Jacu\xEDpe|BA|-12.33|-38.77\nPrado|BA|-17.34|-39.22\nApodi|RN|-5.65|-37.79\nM\xE3e do Rio|PA|-2.06|-47.56\nPil\xE3o Arcado|BA|-10.01|-42.49\nTuntum|MA|-5.25|-44.64\nAlian\xE7a|PE|-7.6|-35.22\nGirau do Ponciano|AL|-9.88|-36.83\nBela Vista de Goi\xE1s|GO|-16.97|-48.95\nIpor\xE1|GO|-16.44|-51.12\nPadre Bernardo|GO|-15.16|-48.28\nRur\xF3polis|PA|-4.1|-54.91\nBom Jesus do Itabapoana|RJ|-21.14|-41.68\nBaturit\xE9|CE|-4.33|-38.88\nNovo Progresso|PA|-7.14|-55.38\nMaragogipe|BA|-12.78|-38.92\nPalotina|PR|-24.29|-53.84\nS\xE3o Joaquim de Bicas|MG|-20.05|-44.27\nPomerode|SC|-26.74|-49.18\nPenha|SC|-26.78|-48.65\nGoiatuba|GO|-18.01|-49.37\nRio Real|BA|-11.48|-37.93\nS\xE3o Jos\xE9 do Belmonte|PE|-7.86|-38.76\nCurralinho|PA|-1.81|-49.8\nItaqui|RS|-29.13|-56.55\nOeiras do Par\xE1|PA|-2.0|-49.86\nItamb\xE9|PE|-7.41|-35.1\nIlhabela|SP|-23.78|-45.36\nPilar|AL|-9.6|-35.95\nAlmeirim|PA|-1.53|-52.58\nJaguaria\xEDva|PR|-24.24|-49.71\nPosse|GO|-14.09|-46.37\nSanta F\xE9 do Sul|SP|-20.21|-50.93\nSerra do Ramalho|BA|-13.57|-43.59\nColinas do Tocantins|TO|-8.06|-48.48\nBodoc\xF3|PE|-7.78|-39.93\nCura\xE7\xE1|BA|-8.98|-39.9\nCharqueadas|RS|-29.96|-51.63\nPetrol\xE2ndia|PE|-9.07|-38.3\nJuara|MT|-11.26|-57.52\nItaporanga d'Ajuda|SE|-10.99|-37.31\nItapo\xE1|SC|-26.12|-48.62\nBra\xE7o do Norte|SC|-28.27|-49.17\nPromiss\xE3o|SP|-21.54|-49.86\nVassouras|RJ|-22.41|-43.67\nS\xE3o Luiz Gonzaga|RS|-28.41|-54.96\nPresidente Venceslau|SP|-21.87|-51.84\nEirunep\xE9|AM|-6.66|-69.87\nAdamantina|SP|-21.68|-51.07\nRio Pardo|RS|-29.99|-52.37\nAnapu|PA|-3.47|-51.2\nGaribaldi|RS|-29.26|-51.54\nNova Cruz|RN|-6.48|-35.43\nIti\xFAba|BA|-10.69|-39.84\nS\xE3o Paulo de Oliven\xE7a|AM|-3.47|-68.96\nCapim Grosso|BA|-11.38|-40.01\nInhambupe|BA|-11.78|-38.35\nBrejo|MA|-3.68|-42.75\nS\xE3o Jo\xE3o Batista|SC|-27.28|-48.85\nS\xE3o Lu\xEDs de Montes Belos|GO|-16.52|-50.37\nPort\xE3o|RS|-29.7|-51.24\nNanuque|MG|-17.85|-40.35\nOuril\xE2ndia do Norte|PA|-6.75|-51.09\nS\xE3o Domingos do Maranh\xE3o|MA|-5.58|-44.38\nMorro do Chap\xE9u|BA|-11.55|-41.16\nRiach\xE3o do Jacu\xEDpe|BA|-11.81|-39.38\nAra\xE7ua\xED|MG|-16.85|-42.06\nBagre|PA|-1.9|-50.2\nJaguaribe|CE|-5.9|-38.62\nBarra Bonita|SP|-22.49|-48.56\nS\xE3o Desid\xE9rio|BA|-12.36|-44.98\nPalmeira|PR|-25.43|-50.01\nBorba|AM|-4.39|-59.59\nJo\xE3o C\xE2mara|RN|-5.54|-35.81\nIgrejinha|RS|-29.57|-50.79\nForquilhinha|SC|-28.75|-49.48\nTouros|RN|-5.2|-35.46\nBela Cruz|CE|-3.05|-40.17\nChapad\xE3o do Sul|MS|-18.79|-52.63\nV\xE1rzea da Palma|MG|-17.59|-44.72\nTaiobeiras|MG|-15.81|-42.23\nJaguarari|BA|-10.26|-40.2\nPitanga|PR|-24.76|-51.76\nMandagua\xE7u|PR|-23.35|-52.09\nXaxim|SC|-26.96|-52.54\nUbajara|CE|-3.85|-40.92\nCanavieiras|BA|-15.67|-38.95\nPalmeiras de Goi\xE1s|GO|-16.8|-49.92\nPitangueiras|SP|-21.01|-48.22\nN\xEDsia Floresta|RN|-6.09|-35.2\nEstreito|MA|-6.56|-47.44\nCravinhos|SP|-21.34|-47.73\nNer\xF3polis|GO|-16.4|-49.22\nS\xE3o Gabriel da Palha|ES|-19.02|-40.54\nSert\xE2nia|PE|-8.07|-37.27\nCorrentina|BA|-13.35|-44.63\nPalmeira das Miss\xF5es|RS|-27.9|-53.31\nItamarandiba|MG|-17.86|-42.86\nEsplanada|BA|-11.79|-37.94\nMachadinho D'Oeste|RO|-9.44|-61.98\nUrbano Santos|MA|-3.21|-43.39\nGurup\xE1|PA|-1.41|-51.63\nParaipaba|CE|-3.44|-39.15\nGaropaba|SC|-28.03|-48.62\nFraiburgo|SC|-27.02|-50.92\nGandu|BA|-13.74|-39.47\nTeut\xF4nia|RS|-29.45|-51.8\nIta\xEDba|PE|-8.95|-37.42\nBom Jardim|MA|-3.54|-45.61\nNiquel\xE2ndia|GO|-14.47|-48.46\nMonteiro|PB|-7.88|-37.12\nPombal|PB|-6.77|-37.8\nS\xE3o Bento|PB|-6.49|-37.45\nRibeir\xE3o|PE|-8.51|-35.37\nAra\xE7oiaba da Serra|SP|-23.5|-47.62\nPeixoto de Azevedo|MT|-10.23|-54.98\nPires do Rio|GO|-17.3|-48.28\nFrederico Westphalen|RS|-27.36|-53.4\nBarreirinha|AM|-2.8|-57.07\nAm\xE9rico Brasiliense|SP|-21.73|-48.11\nPorto Uni\xE3o|SC|-26.25|-51.08\nCanind\xE9 de S\xE3o Francisco|SE|-9.65|-37.79\nPojuca|BA|-12.43|-38.34\nIvaipor\xE3|PR|-24.25|-51.68\nGuanh\xE3es|MG|-18.77|-42.93\nCa\xE7apava do Sul|RS|-30.51|-53.48\nPenalva|MA|-3.28|-45.18\nExu|PE|-7.5|-39.72\nCoxim|MS|-18.5|-54.75\nMat\xF5es|MA|-5.51|-43.2\nItaperu\xE7u|PR|-25.22|-49.35\nBarrinha|SP|-21.19|-48.16\nPresidente Figueiredo|AM|-2.03|-60.02\nAraguatins|TO|-5.65|-48.12\nOuro Fino|MG|-22.28|-46.37\nItapicuru|BA|-11.31|-38.23\nMaragogi|AL|-9.01|-35.23\nEstrela|RS|-29.5|-51.95\nBras\xEDlia de Minas|MG|-16.21|-44.43\nJuatuba|MG|-19.94|-44.35\nTuril\xE2ndia|MA|-2.22|-45.3\nLaranjeiras do Sul|PR|-25.41|-52.41\nIbat\xE9|SP|-21.96|-47.99\nAparecida|SP|-22.85|-45.23\nPontal do Paran\xE1|PR|-25.67|-48.51\nJaguaruana|CE|-4.83|-37.78\nCatende|PE|-8.68|-35.7\nMiguel Alves|PI|-4.17|-42.9\nGua\xEDra|PR|-24.09|-54.26\nAnchieta|ES|-20.8|-40.64\nS\xE3o Miguel Arcanjo|SP|-23.88|-47.99\nAgua\xED|SP|-22.06|-46.97\nParambu|CE|-6.21|-40.69\nTangu\xE1|RJ|-22.74|-42.72\nEspig\xE3o D'Oeste|RO|-11.53|-61.03\nBaixo Guandu|ES|-19.52|-41.01\nArraial do Cabo|RJ|-22.98|-42.03\nCapela|SE|-10.51|-37.06\nCaarap\xF3|MS|-22.64|-54.82\nIrituia|PA|-1.77|-47.45\nItatiaia|RJ|-22.49|-44.57\nS\xE3o Sebasti\xE3o|AL|-9.93|-36.56\nDescalvado|SP|-21.9|-47.62\nGuararema|SP|-23.41|-46.04\nCururupu|MA|-1.81|-44.86\nEsperan\xE7a|PB|-7.02|-35.86\nCampo Alegre|AL|-9.78|-36.35\nS\xE3o Domingos do Capim|PA|-1.69|-47.77\nPindar\xE9-Mirim|MA|-3.61|-45.34\nCachoeira Paulista|SP|-22.67|-45.02\nSapezal|MT|-12.99|-58.76\nS\xE3o Jos\xE9 do Egito|PE|-7.47|-37.27\nCampo Alegre de Lourdes|BA|-9.52|-43.01\nAfonso Cl\xE1udio|ES|-20.08|-41.13\nPomp\xE9u|MG|-19.23|-45.01\nBariri|SP|-22.07|-48.74\nCareiro|AM|-3.77|-60.37\nRio das Pedras|SP|-22.84|-47.6\nC\xEDcero Dantas|BA|-10.59|-38.38\nCatol\xE9 do Rocha|PB|-6.34|-37.75\nCruz|CE|-2.92|-40.18\nBar\xE3o de Cocais|MG|-19.94|-43.48\nTrindade|PE|-7.76|-40.26\nParnarama|MA|-5.67|-43.1\nS\xE3o Gabriel do Oeste|MS|-19.39|-54.55\nNazar\xE9 da Mata|PE|-7.74|-35.22\nLavras da Mangabeira|CE|-6.74|-38.97\nRaposa|MA|-2.43|-44.1\nCarangola|MG|-20.73|-42.03\nSantana do Acara\xFA|CE|-3.46|-40.21\nPau dos Ferros|RN|-6.11|-38.21\nTabuleiro do Norte|CE|-5.24|-38.13\nOsvaldo Cruz|SP|-21.8|-50.88\n\xC1gua Boa|MT|-14.05|-52.16\nLimoeiro do Ajuru|PA|-1.9|-49.39\nRiacho de Santana|BA|-13.61|-42.94\nCol\xEDder|MT|-10.81|-55.46\nNova Russas|CE|-4.71|-40.56\nFlores da Cunha|RS|-29.03|-51.19\nSanta Vit\xF3ria do Palmar|RS|-33.52|-53.37\nRio Negro|PR|-26.09|-49.8\nCl\xE1udio|MG|-20.44|-44.77\nVitorino Freire|MA|-4.28|-45.25\nSanta B\xE1rbara|MG|-19.96|-43.41\nLu\xEDs Correia|PI|-2.88|-41.66\nCampo Magro|PR|-25.37|-49.45\nGuararapes|SP|-21.25|-50.65\nVit\xF3ria do Mearim|MA|-3.45|-44.86\nJoa\xE7aba|SC|-27.17|-51.51\nDois Irm\xE3os|RS|-29.58|-51.09\nS\xE3o Lu\xEDs do Quitunde|AL|-9.32|-35.56\nCabrob\xF3|PE|-8.51|-39.31\nBandeirantes|PR|-23.11|-50.37\nSombrio|SC|-29.11|-49.63\nFloresta|PE|-8.6|-38.57\nCamamu|BA|-13.94|-39.11\nCarlos Barbosa|RS|-29.3|-51.5\nS\xE3o Jos\xE9 da Tapera|AL|-9.56|-37.38\nPorto Belo|SC|-27.16|-48.55\nJaguar\xE9|ES|-18.91|-40.08\nQuedas do Igua\xE7u|PR|-25.45|-52.91\nGua\xE7u\xED|ES|-20.77|-41.67\nEspinosa|MG|-14.92|-42.81\nPaty do Alferes|RJ|-22.43|-43.43\nPedras de Fogo|PB|-7.39|-35.11\nGuarant\xE3 do Norte|MT|-9.96|-54.91\nPocon\xE9|MT|-16.27|-56.63\nAl\xE9m Para\xEDba|MG|-21.88|-42.72\nCarauari|AM|-4.88|-66.91\nQuer\xEAncia|MT|-12.61|-52.18\nCambu\xED|MG|-22.61|-46.06\nSerra Negra|SP|-22.61|-46.7\nSanta Cruz Cabr\xE1lia|BA|-16.28|-39.03\nSoledade|RS|-28.83|-52.51\nBuriti|MA|-3.94|-42.92\nImbituva|PR|-25.23|-50.6\nCanguaretama|RN|-6.37|-35.13\nOiapoque|AP|3.84|-51.83\nMaravilha|SC|-26.77|-53.17\nIpubi|PE|-7.65|-40.15\nAlegre|ES|-20.76|-41.54\nParatinga|BA|-12.69|-43.18\nSanto Ant\xF4nio do I\xE7\xE1|AM|-3.1|-67.95\nBom Jesus|PI|-9.07|-44.36\nBuritis|RO|-10.19|-63.83\nBalne\xE1rio Pi\xE7arras|SC|-26.76|-48.67\nHidrol\xE2ndia|GO|-16.96|-49.23\nCaet\xE9s|PE|-8.78|-36.63\nBiritiba Mirim|SP|-23.57|-46.04\nI\xFAna|ES|-20.35|-41.53\nArari|MA|-3.45|-44.77\nCachoeira|BA|-12.6|-38.96\nTracuateua|PA|-1.08|-46.9\nSantana do Araguaia|PA|-9.33|-50.35\nPinh\xE3o|PR|-25.69|-51.65\nCarinhanha|BA|-14.3|-43.77\nGl\xF3ria do Goit\xE1|PE|-8.01|-35.29\nS\xE3o Miguel do Igua\xE7u|PR|-25.35|-54.24\nPiraju|SP|-23.2|-49.38\nConcei\xE7\xE3o das Alagoas|MG|-19.92|-48.38\nAnaj\xE1s|PA|-1.0|-49.94\nNova Santa Rita|RS|-29.85|-51.28\nMuritiba|BA|-12.63|-38.99\nC\xE2ndido Mota|SP|-22.75|-50.39\nCoromandel|MG|-18.47|-47.19\nSanto Amaro da Imperatriz|SC|-27.69|-48.78\nMelga\xE7o|PA|-1.8|-50.71\nConde|PB|-7.26|-34.9\nIvinhema|MS|-22.3|-53.82\nTr\xEAs Marias|MG|-18.2|-45.25\nIguape|SP|-24.7|-47.55\nCarmo do Parana\xEDba|MG|-18.99|-46.32\nAparecida do Taboado|MS|-20.09|-51.1\nJaciara|MT|-15.95|-54.97\nCandel\xE1ria|RS|-29.67|-52.79\nBom Jardim|RJ|-22.15|-42.43\nPrata|MG|-19.31|-48.93\nPassira|PE|-8.0|-35.58\nPiracuruca|PI|-3.93|-41.71\nItapissuma|PE|-7.77|-34.9\nIguaba Grande|RJ|-22.85|-42.23\nBom Jesus das Selvas|MA|-4.48|-46.86\nRuy Barbosa|BA|-12.28|-40.49\nItabela|BA|-16.57|-39.56\nIrar\xE1|BA|-12.05|-38.76\nItacar\xE9|BA|-14.28|-39.0\nPresidente Tancredo Neves|BA|-13.45|-39.42\nSanta Cruz das Palmeiras|SP|-21.82|-47.25\nIbaiti|PR|-23.85|-50.19\nBarra do Bugres|MT|-15.07|-57.19\nRancharia|SP|-22.23|-50.89\nBady Bassitt|SP|-20.92|-49.44\nMarac\xE1s|BA|-13.44|-40.43\nCocal|PI|-3.47|-41.55\nEldorado do Caraj\xE1s|PA|-6.1|-49.36\nIpixuna do Par\xE1|PA|-2.56|-47.51\nCajati|SP|-24.73|-48.12\nPo\xE7o Redondo|SE|-9.81|-37.68\nSanto Ant\xF4nio do Tau\xE1|PA|-1.15|-48.13\nLagoa Seca|PB|-7.16|-35.85\nTabira|PE|-7.58|-37.54\nConchal|SP|-22.34|-47.17\nMandirituba|PR|-25.78|-49.33\nRio Pardo de Minas|MG|-15.62|-42.54\nNovo Oriente|CE|-5.53|-40.77\nPira\xED|RJ|-22.62|-43.91\nGoioer\xEA|PR|-24.18|-53.02\nConcei\xE7\xE3o da Barra|ES|-18.59|-39.74\nMocajuba|PA|-2.58|-49.5\nSanta Rita de C\xE1ssia|BA|-11.01|-44.53\nParanatinga|MT|-14.43|-54.05\nJo\xE3o Alfredo|PE|-7.87|-35.58\nIbimirim|PE|-8.54|-37.7\nJardim|CE|-7.58|-39.28\nCasa Branca|SP|-21.77|-47.09\nMirand\xF3polis|SP|-21.13|-51.1\nMutum|MG|-19.81|-41.44\nCosta Rica|MS|-18.54|-53.13\nBombinhas|SC|-27.14|-48.51\nNova Mamor\xE9|RO|-10.41|-65.33\nMedicil\xE2ndia|PA|-3.45|-52.89\nSooretama|ES|-19.19|-40.1\nLagoa Vermelha|RS|-28.21|-51.52\nMon\xE7\xE3o|MA|-3.48|-45.25\nMorro Agudo|SP|-20.73|-48.06\nItuporanga|SC|-27.41|-49.6\nPilar do Sul|SP|-23.81|-47.72\nSanto Ant\xF4nio do Monte|MG|-20.09|-45.29\nTriunfo|RS|-29.93|-51.71\nNazar\xE9|BA|-13.02|-39.01\nGoianinha|RN|-6.26|-35.19\nMiracema|RJ|-21.41|-42.19\nBara\xFAna|RN|-5.07|-37.61\nCora\xE7\xE3o de Maria|BA|-12.23|-38.75\n\xC1lvares Machado|SP|-22.08|-51.47\nReden\xE7\xE3o|CE|-4.22|-38.73\nCorrente|PI|-10.43|-45.16\nMacau|RN|-5.11|-36.63\nCanarana|MT|-13.55|-52.27\nConc\xF3rdia do Par\xE1|PA|-1.99|-47.94\nAlex\xE2nia|GO|-16.08|-48.51\nFonte Boa|AM|-2.52|-66.09\nJuta\xED|AM|-2.76|-66.76\nJijoca de Jericoacoara|CE|-2.79|-40.51\nMarapanim|PA|-0.71|-47.7\nMiguel Pereira|RJ|-22.46|-43.48\nTupanatinga|PE|-8.75|-37.34\nNova Olinda do Norte|AM|-3.9|-59.09\nS\xE3o Jos\xE9 da Lapa|MG|-19.7|-43.96\nSacramento|MG|-19.86|-47.45\nBrasil\xE9ia|AC|-10.99|-68.75\nPiren\xF3polis|GO|-15.85|-48.96\nImb\xE9|RS|-29.98|-50.13\nJuquitiba|SP|-23.92|-47.07\nS\xE3o Bernardo|MA|-3.37|-42.42\nCamanducaia|MG|-22.75|-46.15\nParipiranga|BA|-10.69|-37.86\nPitangui|MG|-19.67|-44.9\nInaj\xE1|PE|-8.9|-37.84\nSol\xE2nea|PB|-6.75|-35.66\nBarra da Estiva|BA|-13.62|-41.33\nIbotirama|BA|-12.18|-43.22\nVera Cruz|RS|-29.72|-52.52\nS\xE3o Sebasti\xE3o da Boa Vista|PA|-1.72|-49.52\nMirassol d'Oeste|MT|-15.68|-58.1\nFormosa do Rio Preto|BA|-11.03|-45.19\nIbatiba|ES|-20.23|-41.51\nCariria\xE7u|CE|-7.03|-39.28\nEl\xF3i Mendes|MG|-21.61|-45.57\nQueimadas|BA|-10.97|-39.63\nCap\xE3o do Le\xE3o|RS|-31.76|-52.49\nJaguar\xE3o|RS|-32.56|-53.38\nMantena|MG|-18.78|-40.99\nPorto da Folha|SE|-9.92|-37.28\nTimbiras|MA|-4.26|-43.93\nNovo Cruzeiro|MG|-17.47|-41.88\nPropri\xE1|SE|-10.21|-36.84\nCocalzinho de Goi\xE1s|GO|-15.79|-48.77\nMarco|CE|-3.13|-40.16\nVic\xEAncia|PE|-7.66|-35.31\nNova Esperan\xE7a|PR|-23.18|-52.2\nBrasil Novo|PA|-3.3|-52.53\nBatalha|PI|-4.02|-42.08\nMaracan\xE3|PA|-0.78|-47.45\nSobradinho|BA|-9.45|-40.81\nManari|PE|-8.96|-37.63\nLaranjal Paulista|SP|-23.05|-47.84\nLap\xE3o|BA|-11.39|-41.83\nS\xE3o Joaquim|SC|-28.29|-49.95\n\xC1gua Preta|PE|-8.71|-35.53\nPombos|PE|-8.14|-35.4\nIbirapitanga|BA|-14.16|-39.38\nJacutinga|MG|-22.29|-46.62\nMilagres|CE|-7.3|-38.94\nPiracaia|SP|-23.05|-46.36\nUru\xE7u\xED|PI|-7.24|-44.56\nAracoiaba|CE|-4.37|-38.81\nCampos Gerais|MG|-21.24|-45.76\nAnag\xE9|BA|-14.62|-41.14\nGoian\xE9sia do Par\xE1|PA|-3.84|-49.1\nIgarapava|SP|-20.04|-47.75\nAlagoa Grande|PB|-7.04|-35.62\nGuabiruba|SC|-27.08|-48.98\nNova Prata|RS|-28.78|-51.61\nMina\xE7u|GO|-13.53|-48.22\nTupaciguara|MG|-18.59|-48.7\nJacareacanga|PA|-6.21|-57.75\nAripuan\xE3|MT|-10.17|-59.46\nItapuranga|GO|-15.56|-49.95\nHumberto de Campos|MA|-2.6|-43.46\nS\xE3o Jo\xE3o Nepomuceno|MG|-21.54|-43.01\nMiranda|MS|-20.24|-56.37\nBoa Vista do Ramos|AM|-2.97|-57.59\nC\xE2ndido Sales|BA|-15.5|-41.24\nSanta Helena|PR|-24.86|-54.34\nQuijingue|BA|-10.75|-39.21\nArapoti|PR|-24.15|-49.83\nAlto Alegre do Pindar\xE9|MA|-3.67|-45.84\nBrodowski|SP|-20.98|-47.66\nTr\xEAs Passos|RS|-27.46|-53.93\nIlha Solteira|SP|-20.43|-51.34\nAnajatuba|MA|-3.26|-44.61\nS\xE3o Jos\xE9 do Norte|RS|-32.02|-52.03\nIpameri|GO|-17.72|-48.16\nAimor\xE9s|MG|-19.5|-41.07\nAstorga|PR|-23.23|-51.67\nGuapor\xE9|RS|-28.84|-51.89\nCra\xEDbas|AL|-9.62|-36.77\nLuzil\xE2ndia|PI|-3.47|-42.37\nCora\xE7\xE3o de Jesus|MG|-16.68|-44.36\nPirapozinho|SP|-22.27|-51.5\nArame|MA|-4.88|-46.0\nTanabi|SP|-20.62|-49.66\nS\xE3o Louren\xE7o do Oeste|SC|-26.36|-52.85\nCampos Sales|CE|-7.07|-40.37\nColniza|MT|-9.46|-59.23\nIta\xED|SP|-23.42|-49.09\nUrucurituba|AM|-3.13|-58.15\nTaquari|RS|-29.79|-51.87\nMurici|AL|-9.31|-35.94\nNova Xavantina|MT|-14.68|-52.35\nS\xE3o Jo\xE3o dos Patos|MA|-6.49|-43.7\nJo\xE3o Dourado|BA|-11.35|-41.65\nGuara\xED|TO|-8.84|-48.51\nMoju\xED dos Campos|PA|-2.68|-54.64\nSanta Maria do Par\xE1|PA|-1.35|-47.57\nMara\xFA|BA|-14.1|-39.01\nNepomuceno|MG|-21.23|-45.23\nPonta de Pedras|PA|-1.4|-48.87\nUbirat\xE3|PR|-24.54|-52.99\nSalvaterra|PA|-0.76|-48.51\nIlha de Itamarac\xE1|PE|-7.75|-34.83\nIpixuna|AM|-7.05|-71.69\nAlcoba\xE7a|BA|-17.52|-39.2\nNossa Senhora das Dores|SE|-10.49|-37.2\nGarraf\xE3o do Norte|PA|-1.93|-47.05\nWenceslau Guimar\xE3es|BA|-13.69|-39.48\nSantana|BA|-12.98|-44.05\nTaquaritinga do Norte|PE|-7.89|-36.04\nRio Tinto|PB|-6.8|-35.08\nCastro Alves|BA|-12.76|-39.42\nCachoeira do Arari|PA|-1.01|-48.95\nTr\xEAs de Maio|RS|-27.78|-54.24\nUau\xE1|BA|-9.83|-39.48\nCondado|PE|-7.59|-35.1\nQuatro Barras|PR|-25.37|-49.08\nVenda Nova do Imigrante|ES|-20.33|-41.14\nPiracanjuba|GO|-17.3|-49.02\nRio Preto da Eva|AM|-2.7|-59.69\nIcatu|MA|-2.77|-44.05\nNovo Aripuan\xE3|AM|-5.13|-60.37\nIa\xE7u|BA|-12.77|-40.21\nSoure|PA|-0.73|-48.5\nJo\xE3o Lisboa|MA|-5.44|-47.41\nSanta Terezinha de Itaipu|PR|-25.44|-54.4\nForquilha|CE|-3.8|-40.26\nTamboril|CE|-4.83|-40.32\nCordeir\xF3polis|SP|-22.48|-47.45\nOcara|CE|-4.49|-38.59\nItapor\xE3|MS|-22.08|-54.79\nMiguel Calmon|BA|-11.43|-40.6\nTapejara|RS|-28.07|-52.01\nMartin\xF3polis|SP|-22.15|-51.17\nLimoeiro de Anadia|AL|-9.74|-36.51\nGuai\xFAba|CE|-4.04|-38.64\nValente|BA|-11.41|-39.46\nSenador Pompeu|CE|-5.58|-39.37\nMonte Si\xE3o|MG|-22.43|-46.57\nSatuba|AL|-9.57|-35.82\nCanhotinho|PE|-8.88|-36.2\nPoxor\xE9u|MT|-15.83|-54.42\nPinheiral|RJ|-22.52|-44.0\nItamb\xE9|BA|-15.24|-40.63\nMimoso do Sul|ES|-21.06|-41.36\nBujaru|PA|-1.52|-48.04\nCantanhede|MA|-3.64|-44.38\nPedra Azul|MG|-16.01|-41.29\nBonito|MS|-21.13|-56.48\nCapivari de Baixo|SC|-28.45|-48.96\nBoquim|SE|-11.14|-37.62\nCanarana|BA|-11.69|-41.77\nSanta Rita do Passa Quatro|SP|-21.71|-47.48\nSenador Jos\xE9 Porf\xEDrio|PA|-4.31|-51.58\nSanto Ant\xF4nio do Sudoeste|PR|-26.07|-53.73\nPedro do Ros\xE1rio|MA|-2.97|-45.35\nLagoa Grande|PE|-8.99|-40.28\nTaquarituba|SP|-23.53|-49.24\nS\xE3o Geraldo do Araguaia|PA|-6.39|-48.56\nBom Jesus de Goi\xE1s|GO|-18.22|-49.74\nPindoretama|CE|-4.02|-38.31\nCarutapera|MA|-1.2|-46.01\nParaopeba|MG|-19.27|-44.4\nS\xE3o Sebasti\xE3o do Ca\xED|RS|-29.59|-51.37\nTacaratu|PE|-9.1|-38.15\nS\xE3o Jo\xE3o|PE|-8.88|-36.37\nSanta Luzia do Paru\xE1|MA|-2.51|-45.78\nReserva|PR|-24.65|-50.85\nIrau\xE7uba|CE|-3.75|-39.78\nNova Soure|BA|-11.23|-38.49\nCruzeiro do Oeste|PR|-23.78|-53.08\nApia\xED|SP|-24.51|-48.84\nDois C\xF3rregos|SP|-22.37|-48.38\nEspera Feliz|MG|-20.65|-41.91\nPinheiros|ES|-18.41|-40.22\nIraquara|BA|-12.24|-41.62\nAm\xE9lia Rodrigues|BA|-12.39|-38.76\nAnast\xE1cio|MS|-20.48|-55.81\nBuritis|MG|-15.62|-46.42\nValpara\xEDso|SP|-21.22|-50.87\nItaporanga|PB|-7.3|-38.15\nOrtigueira|PR|-24.21|-50.92\nS\xE3o Jo\xE3o do Para\xEDso|MG|-15.32|-42.02\nIbiapina|CE|-3.92|-40.89\nOrleans|SC|-28.35|-49.3\nAgrestina|PE|-8.46|-35.94\nTamandar\xE9|PE|-8.76|-35.1\nMacaparana|PE|-7.56|-35.44\nJuc\xE1s|CE|-6.52|-39.52\nCarolina|MA|-7.34|-47.46\nUmba\xFAba|SE|-11.38|-37.66\nAreia Branca|RN|-4.95|-37.13\nCarmo do Cajuru|MG|-20.19|-44.77\nAngatuba|SP|-23.49|-48.41\nCodaj\xE1s|AM|-3.83|-62.07\nPorto Franco|MA|-6.34|-47.4\nConcei\xE7\xE3o do Mato Dentro|MG|-19.03|-43.42\nVeran\xF3polis|RS|-28.93|-51.55\nBelo Oriente|MG|-19.22|-42.48\nAlto Alegre do Maranh\xE3o|MA|-4.21|-44.45\nJequitinhonha|MG|-16.44|-41.01\nPorto Calvo|AL|-9.05|-35.4\nJardim|MS|-21.48|-56.15\nBrotas|SP|-22.28|-48.13\nS\xE3o Gon\xE7alo do Sapuca\xED|MG|-21.89|-45.59\nSanta Quit\xE9ria do Maranh\xE3o|MA|-3.49|-42.57\nCarambe\xED|PR|-24.92|-50.1\nIndepend\xEAncia|CE|-5.39|-40.31\nConde|BA|-11.82|-37.61\nIgaci|AL|-9.54|-36.64\nTr\xEAs Coroas|RS|-29.51|-50.77\nS\xE3o Miguel|RN|-6.2|-38.49\nCapinzal|SC|-27.35|-51.61\nVi\xE7osa|AL|-9.37|-36.24\nCaranda\xED|MG|-20.96|-43.81\nJunqueiro|AL|-9.91|-36.48\nMiranda do Norte|MA|-3.56|-44.58\nPereira Barreto|SP|-20.64|-51.11\nCupira|PE|-8.62|-35.95\nMatriz de Camaragibe|AL|-9.15|-35.52\nCandeias do Jamari|RO|-8.79|-63.7\nP\xE3o de A\xE7\xFAcar|AL|-9.74|-37.44\nEncruzilhada do Sul|RS|-30.54|-52.52\nAurora|CE|-6.93|-38.97\nCajuru|SP|-21.27|-47.3\nBataguassu|MS|-21.72|-52.42\nBambu\xED|MG|-20.02|-45.98\nS\xE3o Jo\xE3o da Ponte|MG|-15.93|-44.01\nAurora do Par\xE1|PA|-2.15|-47.57\nGoi\xE1s|GO|-15.93|-50.14\nRibas do Rio Pardo|MS|-20.44|-53.76\nBananeiras|PB|-6.75|-35.62\nTraipu|AL|-9.96|-37.01\nLaranjeiras|SE|-10.8|-37.17\nSiqueira Campos|PR|-23.69|-49.83\nPlanalto|BA|-14.67|-40.47\nCoronel Vivida|PR|-25.98|-52.56\nQuara\xED|RS|-30.38|-56.45\nCorinto|MG|-18.37|-44.45\nPira\xED do Sul|PR|-24.53|-49.94\nLoanda|PR|-22.92|-53.14\nMonte Alegre|RN|-6.07|-35.33\nNova Petr\xF3polis|RS|-29.37|-51.11\nPi\xFAma|ES|-20.83|-40.73\nBuritizeiro|MG|-17.37|-44.96\nPinhalzinho|SC|-26.85|-52.99\nRaul Soares|MG|-20.11|-42.45\nSanta Teresa|ES|-19.94|-40.6\nSanto Ant\xF4nio de Posse|SP|-22.6|-46.92\nMinas Novas|MG|-17.22|-42.59\nCapela do Alto|SP|-23.47|-47.74\nAldeias Altas|MA|-4.63|-43.47\nMazag\xE3o|AP|-0.11|-51.29\nFrancisco S\xE1|MG|-16.48|-43.49\nMorrinhos|CE|-3.23|-40.12\nSanta Rosa de Viterbo|SP|-21.48|-47.36\nPedra|PE|-8.5|-36.94\nItaocara|RJ|-21.67|-42.08\nDom Pedro|MA|-5.04|-44.44\nAlto Alegre|RR|2.99|-61.31\nIvoti|RS|-29.6|-51.15\nItabaiana|PB|-7.33|-35.33\nGovernador Nunes Freire|MA|-2.13|-45.88\nEncantado|RS|-29.24|-51.87\nBarreira|CE|-4.29|-38.64\nIgara\xE7u do Tiet\xEA|SP|-22.51|-48.56\nNova Alvorada do Sul|MS|-21.47|-54.38\nCambar\xE1|PR|-23.04|-50.08\nSarandi|RS|-27.94|-52.92\nPanelas|PE|-8.66|-36.01\nColorado|PR|-22.84|-51.97\nCacul\xE9|BA|-14.5|-42.22\nTocantin\xF3polis|TO|-6.32|-47.42\nFeira Grande|AL|-9.9|-36.68\nSanta Gertrudes|SP|-22.46|-47.53\nAbaet\xE9|MG|-19.16|-45.44\nSilv\xE2nia|GO|-16.66|-48.61\nQuissam\xE3|RJ|-22.1|-41.47\nVertentes|PE|-7.9|-35.97\nPacaraima|RR|4.48|-61.15\nTrizidela do Vale|MA|-4.54|-44.63\nAlhandra|PB|-7.43|-34.91\nPiranhas|AL|-9.62|-37.76\nAreia|PB|-6.96|-35.7\nValen\xE7a do Piau\xED|PI|-6.4|-41.74\nOlindina|BA|-11.35|-38.34\nBuriti Bravo|MA|-5.83|-43.84\nInhapim|MG|-19.55|-42.11\nItai\xF3polis|SC|-26.34|-49.91\nItinga do Maranh\xE3o|MA|-4.45|-47.52\nS\xE3o Jos\xE9 do Vale do Rio Preto|RJ|-22.15|-42.93\nMedeiros Neto|BA|-17.37|-40.22\nSanto Ant\xF4nio|RN|-6.31|-35.47\nAlta Floresta D'Oeste|RO|-11.93|-62.0\nMacarani|BA|-15.56|-40.42\nCaracara\xED|RR|1.83|-61.13\nRiach\xE3o|MA|-7.36|-46.62\nPiraju\xED|SP|-22.0|-49.46\nMonte Apraz\xEDvel|SP|-20.77|-49.72\nSerro|MG|-18.6|-43.37\nDiamantino|MT|-14.4|-56.44\nMuzambinho|MG|-21.37|-46.52\nEcoporanga|ES|-18.37|-40.84\nTeodoro Sampaio|SP|-22.53|-52.17\nBom Jesus dos Perd\xF5es|SP|-23.14|-46.47\nCeres|GO|-15.31|-49.6\nCedro|CE|-6.6|-39.06\nIcapu\xED|CE|-4.71|-37.35\nIbi\xE1|MG|-19.47|-46.55\nMatinha|MA|-3.1|-45.03\nSanta B\xE1rbara do Par\xE1|PA|-1.19|-48.24\nArroio do Meio|RS|-29.4|-51.96\nIracem\xE1polis|SP|-22.58|-47.52\nBeruri|AM|-3.9|-61.36\nCamacan|BA|-15.41|-39.49\nCunha|SP|-23.07|-44.96\nParagua\xE7u|MG|-21.55|-45.74\nGuapia\xE7u|SP|-20.8|-49.22\nLad\xE1rio|MS|-19.01|-57.6\nOrob\xF3|PE|-7.75|-35.6\nSenador Guiomard|AC|-10.15|-67.74\nS\xE3o Francisco de Paula|RS|-29.44|-50.58\nPio XII|MA|-3.89|-45.18\nRiach\xE3o das Neves|BA|-11.75|-44.91\nAra\xE7ariguama|SP|-23.44|-47.06\nS\xE3o Miguel do Guapor\xE9|RO|-11.7|-62.72\nParelhas|RN|-6.68|-36.66\nFeira Nova|PE|-7.95|-35.38\nHerval d'Oeste|SC|-27.19|-51.49\nPo\xE7o Verde|SE|-10.72|-38.18\nCerqueira C\xE9sar|SP|-23.04|-49.17\nAssar\xE9|CE|-6.87|-39.87\nMari|PB|-7.06|-35.32\nUru\xE7uca|BA|-14.6|-39.29\nItuber\xE1|BA|-13.72|-39.15\nS\xE3o Jo\xE3o do Piau\xED|PI|-8.35|-42.26\nIbicara\xED|BA|-14.86|-39.59\nMata Grande|AL|-9.12|-37.73\nIgreja Nova|AL|-10.12|-36.66\nIbirub\xE1|RS|-28.63|-53.1\nAcre\xFAna|GO|-17.4|-50.37\nPerd\xF5es|MG|-21.09|-45.09\nAbadia de Goi\xE1s|GO|-16.76|-49.44\nS\xE3o Miguel do Araguaia|GO|-13.27|-50.16\nSilva Jardim|RJ|-22.66|-42.4\nMatup\xE1|MT|-10.18|-54.95\nCaapor\xE3|PB|-7.51|-34.91\nBastos|SP|-21.92|-50.74\nJandaia do Sul|PR|-23.6|-51.64\nPedro Can\xE1rio|ES|-18.3|-39.96\nSanta Vit\xF3ria|MG|-18.84|-50.12\nItapaci|GO|-14.95|-49.55\nBela Vista|MS|-22.11|-56.53\nIbicoara|BA|-13.41|-41.28\nTeofil\xE2ndia|BA|-11.48|-38.99\nAlagoa Nova|PB|-7.05|-35.76\nSanta B\xE1rbara|BA|-11.95|-38.97\nTanha\xE7u|BA|-14.02|-41.25\nApu\xED|AM|-7.19|-59.9\nConcei\xE7\xE3o de Macabu|RJ|-22.08|-41.87\nPresidente Get\xFAlio|SC|-27.05|-49.62\nIgua\xED|BA|-14.75|-40.09\nRolante|RS|-29.65|-50.58\nMaraca\xE7um\xE9|MA|-2.05|-45.96\nSchroeder|SC|-26.41|-49.07\nLaje|BA|-13.17|-39.42\nPrincesa Isabel|PB|-7.73|-37.99\nQuixer\xE9|CE|-5.07|-37.98\nPalmeir\xE2ndia|MA|-2.64|-44.89\nTamba\xFA|SP|-21.7|-47.27\nPaulistana|PI|-8.13|-41.14\nChopinzinho|PR|-25.85|-52.52\nJaguaruna|SC|-28.61|-49.03\nCassil\xE2ndia|MS|-19.12|-51.73\nS\xE3o Domingos do Araguaia|PA|-5.54|-48.74\nS\xE3o Sep\xE9|RS|-30.16|-53.56\nS\xE3o Marcos|RS|-28.97|-51.07\nMirador|MA|-6.37|-44.37\nConcei\xE7\xE3o da Feira|BA|-12.51|-39.0\nCarmo do Rio Claro|MG|-20.97|-46.11\nF\xE1tima do Sul|MS|-22.38|-54.51\nLajinha|MG|-20.15|-41.62\nChaves|PA|-0.16|-49.99\nRiacho das Almas|PE|-8.14|-35.86\nBoca da Mata|AL|-9.64|-36.21\nS\xE3o Jo\xE3o de Pirabas|PA|-0.78|-47.18\nUrussanga|SC|-28.52|-49.32\nItapecerica|MG|-20.47|-45.13\nCordeiro|RJ|-22.03|-42.36\nDivino|MG|-20.61|-42.14\nCorea\xFA|CE|-3.54|-40.66\nCaxambu|MG|-21.98|-44.93\nS\xE3o Jer\xF4nimo|RS|-29.97|-51.73\nJaboticatubas|MG|-19.51|-43.74\nCaravelas|BA|-17.73|-39.26\nGovernador Mangabeira|BA|-12.6|-39.04\nUruburetama|CE|-3.62|-39.51\nOliveira dos Brejinhos|BA|-12.31|-42.9\nNova Esperan\xE7a do Piri\xE1|PA|-2.27|-46.97\nSanta Luzia do Par\xE1|PA|-1.52|-46.9\nMonte Santo de Minas|MG|-21.19|-46.98\nCh\xE3 Grande|PE|-8.24|-35.46\nNhamund\xE1|AM|-2.21|-56.71\nItambacuri|MG|-18.04|-41.68\nS\xE3o Jos\xE9 da Laje|AL|-9.01|-36.05\nItatira|CE|-4.53|-39.62\nCampestre|MG|-21.71|-46.24\nOlho d'\xC1gua das Flores|AL|-9.54|-37.3\nAltinho|PE|-8.48|-36.06\nCant\xE1|RR|2.61|-60.61\nErv\xE1lia|MG|-20.84|-42.65\nPorto Real|RJ|-22.42|-44.3\nCapanema|PR|-25.67|-53.81\nParais\xF3polis|MG|-22.55|-45.78\nConselheiro Pena|MG|-19.18|-41.47\nParamirim|BA|-13.44|-42.24\nLambari|MG|-21.97|-45.35\nGuap\xF3|GO|-16.83|-49.53\nCurion\xF3polis|PA|-6.1|-49.61\nJunqueir\xF3polis|SP|-21.51|-51.43\nManhumirim|MG|-20.36|-41.96\nPiat\xE3|BA|-13.15|-41.77\nS\xE3o Felipe|BA|-12.84|-39.09\nPeritor\xF3|MA|-4.37|-44.34\nIbirama|SC|-27.05|-49.52\nSalgado|SE|-11.03|-37.48\nChorozinho|CE|-4.29|-38.5\nPotim|SP|-22.83|-45.26\nPaulo Ramos|MA|-4.44|-45.24\nFlores|PE|-7.86|-37.97\nTurmalina|MG|-17.28|-42.73\nBuri|SP|-23.8|-48.6\nTapau\xE1|AM|-5.62|-63.18\nMonte Alegre de Minas|MG|-18.87|-48.88\nCachoeirinha|PE|-8.49|-36.24\nPalmas de Monte Alto|BA|-14.27|-43.16\nRegente Feij\xF3|SP|-22.22|-51.31\nBarroso|MG|-21.19|-43.97\nMutu\xEDpe|BA|-13.23|-39.5\nNova Hartz|RS|-29.58|-50.91\nAquidab\xE3|SE|-10.28|-37.01\nQuiterian\xF3polis|CE|-5.84|-40.7\nBelmonte|BA|-15.86|-38.88\nTr\xEAs Barras|SC|-26.11|-50.32\nPomp\xE9ia|SP|-22.11|-50.18\nMonte Azul|MG|-15.15|-42.87\nCastilho|SP|-20.87|-51.49\nM\xE2ncio Lima|AC|-7.62|-72.9\nVazante|MG|-17.98|-46.91\nMedina|MG|-16.22|-41.47\nRio Verde de Mato Grosso|MS|-18.92|-54.84\nPresidente M\xE9dici|RO|-11.17|-61.9\nC\xE2ndido Mendes|MA|-1.43|-45.72\nS\xE3o Joaquim do Monte|PE|-8.43|-35.8\nSimon\xE9sia|MG|-20.13|-42.01\nVargem Alta|ES|-20.67|-41.02\nRio Formoso|PE|-8.66|-35.15\nLuc\xE9lia|SP|-21.72|-51.02\nTibagi|PR|-24.52|-50.42\nItaparica|BA|-12.89|-38.68\nRio Bananal|ES|-19.27|-40.34\nCris\xF3polis|BA|-11.51|-38.15\nAmp\xE9re|PR|-25.92|-53.47\nCareiro da V\xE1rzea|AM|-3.31|-59.56\nTupanciret\xE3|RS|-29.09|-53.84\nCarira|SE|-10.35|-37.7\nPorto Real do Col\xE9gio|AL|-10.18|-36.84\nEngenheiro Coelho|SP|-22.48|-47.21\nTonantins|AM|-2.87|-67.79\nPauini|AM|-7.71|-66.99\nBuritirama|BA|-10.72|-43.63\nCuit\xE9|PB|-6.48|-36.15\nAraripe|CE|-7.21|-40.14\nRubiataba|GO|-15.16|-49.8\nCara\xFAbas|RN|-5.78|-37.56\nIpanema|MG|-19.8|-41.72\nCafel\xE2ndia|PR|-24.62|-53.32\nOurol\xE2ndia|BA|-10.96|-41.08\nBuriti dos Lopes|PI|-3.18|-41.87\nRealeza|PR|-25.77|-53.53\nMundo Novo|MS|-23.94|-54.28\nRafael Jambeiro|BA|-12.41|-39.5\nItaquira\xED|MS|-23.48|-54.19\nContenda|PR|-25.68|-49.53\nMucaja\xED|RR|2.44|-60.91\nAra\xE7oiaba|PE|-7.78|-35.08\nCantagalo|RJ|-21.98|-42.37\nAndir\xE1|PR|-23.05|-50.23\nGaruva|SC|-26.03|-48.85\nBequim\xE3o|MA|-2.44|-44.78\nOr\xF3s|CE|-6.25|-38.91\nJussara|GO|-15.87|-50.87\nEpitaciol\xE2ndia|AC|-11.02|-68.73\nCocos|BA|-14.18|-44.54\nS\xE3o Vicente Ferrer|MA|-2.89|-44.87\nLagoa de Itaenga|PE|-7.93|-35.29\nParanapanema|SP|-23.39|-48.72\nMontanha|ES|-18.13|-40.37\nTerra Santa|PA|-2.1|-56.49\nBoquira|BA|-12.82|-42.73\nPapanduva|SC|-26.38|-50.14\nNova Granada|SP|-20.53|-49.31\nPalmital|SP|-22.79|-50.22\nNordestina|BA|-10.82|-39.43\nCes\xE1rio Lange|SP|-23.23|-47.95\nVila Rica|MT|-10.01|-51.12\nCastelo do Piau\xED|PI|-5.32|-41.55\nGuaran\xE9sia|MG|-21.3|-46.8\nCanto do Buriti|PI|-8.11|-42.95\nMiguel\xF3polis|SP|-20.18|-48.03\nUrucar\xE1|AM|-2.53|-57.75\nLagoa Formosa|MG|-18.77|-46.4\nPariquera-A\xE7u|SP|-24.71|-47.87\nPindoba\xE7u|BA|-10.74|-40.37\nBarro|CE|-7.17|-38.77\nS\xE3o Jos\xE9 de Piranhas|PB|-7.12|-38.5\n\xC1gua Branca|AL|-9.26|-37.94\nCarna\xEDba|PE|-7.79|-37.79\nCara\xED|MG|-17.19|-41.7\nS\xE3o Jos\xE9 da Coroa Grande|PE|-8.89|-35.15\nBar\xE3o de Graja\xFA|MA|-6.74|-43.03\nMorro da Fuma\xE7a|SC|-28.65|-49.22\nFormoso do Araguaia|TO|-11.8|-49.53\nItatinga|SP|-23.1|-48.62\nChapada dos Guimar\xE3es|MT|-15.46|-55.75\nEncruzilhada|BA|-15.53|-40.91\nTaquarana|AL|-9.65|-36.49\nButi\xE1|RS|-30.12|-51.96\nGuaratinga|BA|-16.58|-39.78\nAfr\xE2nio|PE|-8.51|-41.01\nSeara|SC|-27.16|-52.3\nWenceslau Braz|PR|-23.87|-49.8\nAveiro|PA|-3.61|-55.32\nIbirataia|BA|-14.06|-39.65\nPastos Bons|MA|-6.6|-44.07\nItaobim|MG|-16.56|-41.5\nHorizontina|RS|-27.63|-54.31\nS\xE3o Gabriel|BA|-11.22|-41.88\nMadre de Deus|BA|-12.74|-38.62\nCachoeira do Piri\xE1|PA|-1.76|-46.55\nMatel\xE2ndia|PR|-25.25|-53.99\nVarzel\xE2ndia|MG|-15.7|-44.03\nPresidente Oleg\xE1rio|MG|-18.41|-46.42\nItaju\xEDpe|BA|-14.68|-39.37\nRio Maria|PA|-7.31|-50.04\nXapuri|AC|-10.65|-68.5\nItapororoca|PB|-6.82|-35.24\nS\xE3o Raimundo das Mangabeiras|MA|-7.02|-45.48\nManga|MG|-14.75|-43.94\nAroeiras|PB|-7.54|-35.71\nUba\xEDra|BA|-13.27|-39.67\nBom Jesus do Tocantins|PA|-5.04|-48.6\nPancas|ES|-19.22|-40.85\nMatip\xF3|MG|-20.29|-42.34\nPotirendaba|SP|-21.04|-49.38\nMorretes|PR|-25.47|-48.83\nBelterra|PA|-2.64|-54.94\nBelo Campo|BA|-15.03|-41.27\nReriutaba|CE|-4.14|-40.58\nPorto Grande|AP|0.71|-51.42\nMorros|MA|-2.85|-44.04\nMarechal Floriano|ES|-20.42|-40.67\nGovernador Edison Lob\xE3o|MA|-5.75|-47.36\nParnamirim|PE|-8.09|-39.58\nPedra Preta|MT|-16.62|-54.47\nRibeir\xE3o Branco|SP|-24.22|-48.76\nPirapora do Bom Jesus|SP|-23.4|-47.0\nTai\xF3|SC|-27.12|-49.99\nFund\xE3o|ES|-19.94|-40.41\nS\xE3o Jo\xE3o Batista|MA|-2.95|-44.8\nQuitandinha|PR|-25.87|-49.5\nColina|SP|-20.71|-48.54\nPicu\xED|PB|-6.51|-36.35\nCapoeiras|PE|-8.73|-36.63\n\xC1guas Formosas|MG|-17.08|-40.94\nLagoa da Canoa|AL|-9.83|-36.74\nSanhar\xF3|PE|-8.36|-36.57\nS\xE3o Benedito do Rio Preto|MA|-3.34|-43.53\nMuniz Freire|ES|-20.47|-41.42\nLagoa do Carro|PE|-7.84|-35.31\nSolon\xF3pole|CE|-5.72|-39.01\nCarlos Chagas|MG|-17.7|-40.77\nOur\xE9m|PA|-1.54|-47.11\nBaependi|MG|-21.96|-44.89\nSerrita|PE|-7.94|-39.3\nPontalina|GO|-17.52|-49.45\nPonto Novo|BA|-10.87|-40.13\nSerra Preta|BA|-12.16|-39.33\nGuar\xE1|SP|-20.43|-47.82\nEsperantin\xF3polis|MA|-4.88|-44.69\nConcei\xE7\xE3o|PB|-7.55|-38.5\nAlc\xE2ntara|MA|-2.4|-44.41\nCampo do Brito|SE|-10.74|-37.5\nVarjota|CE|-4.19|-40.47\nMiracema do Tocantins|TO|-9.57|-48.39\nNazar\xE9 Paulista|SP|-23.17|-46.4\nAlpin\xF3polis|MG|-20.86|-46.39\nSapea\xE7u|BA|-12.72|-39.18\nBel\xE9m do S\xE3o Francisco|PE|-8.75|-38.96\nFilad\xE9lfia|BA|-10.74|-40.14\nTerra Roxa|PR|-24.16|-54.1\nAlt\xF4nia|PR|-23.88|-53.9\nBaixa Grande|BA|-11.95|-40.17\nIlhota|SC|-26.9|-48.83\nAreia Branca|SE|-10.76|-37.33\nMiracatu|SP|-24.28|-47.46\nAragar\xE7as|GO|-15.9|-52.24\nFloresta do Araguaia|PA|-7.55|-49.71\nParaibano|MA|-6.43|-43.98\nCairu|BA|-13.49|-39.05\nCarm\xF3polis de Minas|MG|-20.54|-44.63\nTapero\xE1|BA|-13.53|-39.1\nJ\xFAlio de Castilhos|RS|-29.23|-53.68\nRiach\xE3o do Dantas|SE|-11.07|-37.73\nUrucuia|MG|-16.12|-45.74\nPlacas|PA|-3.87|-54.21\nItua\xE7u|BA|-13.81|-41.3\nS\xE3o Jo\xE3o do Rio do Peixe|PB|-6.72|-38.45\nFarias Brito|CE|-6.92|-39.57\nF\xE1tima|BA|-10.62|-38.22\nComodoro|MT|-13.66|-59.78\nTijucas do Sul|PR|-25.93|-49.2\nRem\xEDgio|PB|-6.95|-35.8\nJaguaripe|BA|-13.11|-38.89\nMonte Azul Paulista|SP|-20.91|-48.64\nLuz|MG|-19.79|-45.68\nAmaraji|PE|-8.38|-35.45\nN\xE3o-Me-Toque|RS|-28.45|-52.82\nAnicuns|GO|-16.46|-49.96\nJucurutu|RN|-6.03|-37.01\nSapucaia|RJ|-21.99|-42.91\nOlho d'\xC1gua das Cunh\xE3s|MA|-4.13|-45.12\nGovernador Celso Ramos|SC|-27.32|-48.56\nAbar\xE9|BA|-8.72|-39.12\nItaber\xE1|SP|-23.86|-49.14\n\xC1guas de Lind\xF3ia|SP|-22.47|-46.63\nUna|BA|-15.28|-39.08\nAugustin\xF3polis|TO|-5.47|-47.89\nIng\xE1|PB|-7.28|-35.6\nCampos Belos|GO|-13.04|-46.77\nBoqueir\xE3o|PB|-7.49|-36.13\nFortim|CE|-4.45|-37.8\nBarcelos|AM|-0.98|-62.93\nItanh\xE9m|BA|-17.16|-40.33\nItapi\xFAna|CE|-4.56|-38.93\nCampina Verde|MG|-19.54|-49.49\nHidrol\xE2ndia|CE|-4.41|-40.41\nTerenos|MS|-20.44|-54.86\nElias Fausto|SP|-23.04|-47.37\nTerra Boa|PR|-23.77|-52.45\nFormosa da Serra Negra|MA|-6.44|-46.19\nAntonina|PR|-25.44|-48.72\nPirapemas|MA|-3.72|-44.22\nMairi|BA|-11.71|-40.14\nS\xE3o Lu\xEDs Gonzaga do Maranh\xE3o|MA|-4.39|-44.67\nMassaranduba|SC|-26.61|-49.01\nCanutama|AM|-6.53|-64.4\nCocal do Sul|SC|-28.6|-49.33\n\xC1gua Branca|PI|-5.89|-42.64\nTibau do Sul|RN|-6.19|-35.09\nCarir\xE9|CE|-3.95|-40.48\nCafarnaum|BA|-11.69|-41.47\nMarechal Thaumaturgo|AC|-8.94|-72.8\nAnori|AM|-3.75|-61.66\nPouso Redondo|SC|-27.26|-49.93\nCroat\xE1|CE|-4.4|-40.9\nMendes|RJ|-22.52|-43.73\nPocinhos|PB|-7.07|-36.07\nApicum-A\xE7u|MA|-1.46|-45.09\nMat\xF5es do Norte|MA|-3.62|-44.55\nCamocim de S\xE3o F\xE9lix|PE|-8.36|-35.77\nPerdizes|MG|-19.34|-47.3\nBalne\xE1rio Gaivota|SC|-29.15|-49.58\nEnvira|AM|-7.44|-70.03\nIndiara|GO|-17.14|-49.99\nDian\xF3polis|TO|-11.62|-46.82\nSanto Anast\xE1cio|SP|-21.97|-51.65\nParaibuna|SP|-23.39|-45.66\nRio Claro|RJ|-22.72|-44.14\nPio IX|PI|-6.83|-40.61\nS\xE3o Francisco de Assis|RS|-29.55|-55.13\nCorb\xE9lia|PR|-24.8|-53.3\nPresidente Sarney|MA|-2.59|-45.36\nS\xE3o Miguel do Tapuio|PI|-5.5|-41.32\n\xC1gua Clara|MS|-20.45|-52.88\nRio Pomba|MG|-21.27|-43.17\nArroio Grande|RS|-32.23|-53.09\nUbaitaba|BA|-14.3|-39.32\nPorteiras|CE|-7.52|-39.11\nCip\xF3|BA|-11.1|-38.52\nOtac\xEDlio Costa|SC|-27.48|-50.12\nPe\xE7anha|MG|-18.54|-42.56\nSum\xE9|PB|-7.66|-36.88\nDormentes|PE|-8.44|-40.77\nBorda da Mata|MG|-22.27|-46.17\nPorci\xFAncula|RJ|-20.96|-42.05\nMajor Isidoro|AL|-9.53|-36.99\nCruz do Esp\xEDrito Santo|PB|-7.14|-35.09\nCarnaubal|CE|-4.16|-40.94\nNova Era|MG|-19.76|-43.03\nTanque Novo|BA|-13.55|-42.49\nCapistrano|CE|-4.46|-38.9\nJaic\xF3s|PI|-7.36|-41.14\nCarl\xF3polis|PR|-23.43|-49.72\nBalne\xE1rio Arroio do Silva|SC|-28.98|-49.42\nS\xE3o Domingos do Prata|MG|-19.87|-42.97\nLima Duarte|MG|-21.84|-43.79\nPiratini|RS|-31.45|-53.1\nAbelardo Luz|SC|-26.57|-52.32\nAlto Araguaia|MT|-17.32|-53.22\nUmirim|CE|-3.68|-39.35\nCarmo|RJ|-21.93|-42.6\nAbadi\xE2nia|GO|-16.2|-48.71\nQuipap\xE1|PE|-8.81|-36.01\nSouto Soares|BA|-12.09|-41.64\nS\xE3o Jos\xE9 dos Quatro Marcos|MT|-15.63|-58.18\nMonsenhor Tabosa|CE|-4.79|-40.06\nBalne\xE1rio Rinc\xE3o|SC|-28.83|-49.24\nPiritiba|BA|-11.73|-40.56\nMalacacheta|MG|-17.85|-42.08\nViradouro|SP|-20.87|-48.29\nCorrentes|PE|-9.12|-36.32\nBanabui\xFA|CE|-5.3|-38.91\nBuritama|SP|-21.07|-50.15\nSanto Ant\xF4nio do Amparo|MG|-20.94|-44.92\nTeju\xE7uoca|CE|-3.99|-39.58\nBrasnorte|MT|-12.15|-57.98\nResplendor|MG|-19.32|-41.25\nAlum\xEDnio|SP|-23.53|-47.25\nJaguaretama|CE|-5.61|-38.76\nCoronel Jo\xE3o S\xE1|BA|-10.28|-37.92\n\xC1gua Azul do Norte|PA|-6.79|-50.48\nAmarante|PI|-6.24|-42.84\nCristin\xE1polis|SE|-11.47|-37.76\nVila Bela da Sant\xEDssima Trindade|MT|-15.01|-59.95\nPassagem Franca|MA|-6.18|-43.78\nIpaba|MG|-19.42|-42.41\nArinos|MG|-15.92|-46.1\nCidreira|RS|-30.16|-50.23\nGameleira|PE|-8.58|-35.38\nMata Roma|MA|-3.62|-43.11\nGon\xE7alves Dias|MA|-5.15|-44.3\nPaulino Neves|MA|-2.72|-42.53\nSerra Dourada|BA|-12.76|-43.95\nIati|PE|-9.05|-36.85\nConde\xFAba|BA|-14.9|-41.97\nVenturosa|PE|-8.58|-36.87\nCoaraci|BA|-14.64|-39.56\nS\xE3o Francisco do Guapor\xE9|RO|-12.05|-63.57\nCrix\xE1s|GO|-14.54|-49.97\nJenipapo dos Vieiras|MA|-5.36|-45.64\nPorto Acre|AC|-9.58|-67.55\nJuazeirinho|PB|-7.06|-36.58\nIbitit\xE1|BA|-11.54|-41.97\nBom Sucesso|MG|-21.03|-44.75\nItacarambi|MG|-15.09|-44.09\nItajobi|SP|-21.31|-49.06\nC\xE1ssia|MG|-20.58|-46.92\nItarantim|BA|-15.65|-40.06\nAlto Para\xEDso|RO|-9.71|-63.32\nS\xEDtio Novo|MA|-5.88|-46.7\nPadre Para\xEDso|MG|-17.08|-41.48\nBacabeira|MA|-2.96|-44.32\nRosana|SP|-22.58|-53.06\nSerafina Corr\xEAa|RS|-28.71|-51.94\nRegenera\xE7\xE3o|PI|-6.23|-42.68\nPo\xE7\xE3o de Pedras|MA|-4.75|-44.94\nSantana do Cariri|CE|-7.18|-39.73\nS\xE3o Paulo do Potengi|RN|-5.9|-35.76\nRibeir\xF3polis|SE|-10.54|-37.44\nAraruna|PB|-6.55|-35.75\nPiranga|MG|-20.68|-43.3\nFortuna|MA|-5.73|-44.16\nJoaquim Gomes|AL|-9.13|-35.75\nSalitre|CE|-7.28|-40.45\nPrad\xF3polis|SP|-21.36|-48.07\nPiquet Carneiro|CE|-5.8|-39.42\nCari\xFAs|CE|-6.52|-39.49\nItapiranga|SC|-27.17|-53.72\nBoa Vista do Tupim|BA|-12.65|-40.61\nS\xE3o Caetano de Odivelas|PA|-0.75|-48.02\nSeng\xE9s|PR|-24.11|-49.46\nS\xE3o Jo\xE3o do Soter|MA|-5.11|-43.82\nMadalena|CE|-4.85|-39.57\nCaconde|SP|-21.53|-46.64\nGuapiara|SP|-24.19|-48.53\nAltin\xF3polis|SP|-21.02|-47.37\nMundo Novo|BA|-11.85|-40.47\nJuqui\xE1|SP|-24.31|-47.64\nS\xE3o Sim\xE3o|GO|-19.0|-50.55\nS\xE3o Vicente F\xE9rrer|PE|-7.59|-35.48\nPitimbu|PB|-7.47|-34.82\nItaquitinga|PE|-7.66|-35.1\nMacatuba|SP|-22.5|-48.71\nDemerval Lob\xE3o|PI|-5.36|-42.68\nIbipeba|BA|-11.64|-42.02\nPl\xE1cido de Castro|AC|-10.28|-67.14\nBatalha|AL|-9.67|-37.13\nPianc\xF3|PB|-7.19|-37.93\nSanta Maria das Barreiras|PA|-8.86|-49.72\nOrizona|GO|-17.03|-48.3\nFartura|SP|-23.39|-49.51\nCabaceiras do Paragua\xE7u|BA|-12.53|-39.19\nJussara|BA|-11.04|-41.97\nQuixel\xF4|CE|-6.25|-39.2\nAra\xE7agi|PB|-6.84|-35.37\nIndiaroba|SE|-11.52|-37.52\nSanta Margarida|MG|-20.38|-42.25\nCerejeiras|RO|-13.19|-60.82\nGet\xFAlio Vargas|RS|-27.89|-52.23\nBalne\xE1rio Barra do Sul|SC|-26.46|-48.61\nXangri-l\xE1|RS|-29.81|-50.05\nNova Resende|MG|-21.13|-46.42\nCafel\xE2ndia|SP|-21.8|-49.61\nItoror\xF3|BA|-15.11|-40.07\nCentral|BA|-11.14|-42.11\nSanto Ant\xF4nio de Leverger|MT|-15.86|-56.08\nPo\xE7o Fundo|MG|-21.78|-45.97\nSanta Juliana|MG|-19.31|-47.53\nAlvar\xE3es|AM|-3.23|-64.8\nRaposos|MG|-19.96|-43.81\nSananduva|RS|-27.95|-51.81\nBarra de Santo Ant\xF4nio|AL|-9.4|-35.51\nMangueirinha|PR|-25.94|-52.17\nBel\xE9m|PB|-6.74|-35.52\nM\xE1rio Campos|MG|-20.06|-44.19\nCanudos|BA|-9.9|-39.15\nCajari|MA|-3.33|-45.01\nTremedal|BA|-14.97|-41.41\nUtinga|BA|-12.08|-41.1\nLagoa da Confus\xE3o|TO|-10.79|-49.62\nCaiap\xF4nia|GO|-16.95|-51.81\nMarmeleiro|PR|-26.15|-53.03\nTocantins|MG|-21.18|-43.01\nFaxinal|PR|-24.01|-51.32\nBacuri|MA|-1.7|-45.13\nCajueiro|AL|-9.4|-36.16\nNovo Air\xE3o|AM|-2.64|-60.94\nVit\xF3ria do Xingu|PA|-2.88|-52.01\nFrecheirinha|CE|-3.76|-40.82\nColorado do Oeste|RO|-13.12|-60.55\nS\xE3o Louren\xE7o da Serra|SP|-23.85|-46.94\nCentro Novo do Maranh\xE3o|MA|-2.13|-46.12\nS\xE1tiro Dias|BA|-11.59|-38.59\nNe\xF3polis|SE|-10.32|-36.59\nItatim|BA|-12.71|-39.7\nItirapina|SP|-22.26|-47.82\nJaparatuba|SE|-10.58|-36.94\nBonito|BA|-11.97|-41.26\nNova Brasil\xE2ndia D'Oeste|RO|-11.72|-62.31\nCampanha|MG|-21.84|-45.4\nApor\xE1|BA|-11.66|-38.08\nAgudo|RS|-29.64|-53.25\nCacimba de Dentro|PB|-6.64|-35.78\nJata\xFAba|PE|-7.98|-36.49\nTapejara|PR|-23.73|-52.87\nNormandia|RR|3.89|-59.62\nCerro Azul|PR|-26.09|-52.87\nGiru\xE1|RS|-28.03|-54.35\nTupi Paulista|SP|-21.38|-51.58\nCorreia Pinto|SC|-27.59|-50.36\nCaridade|CE|-4.23|-39.19\nTapiramut\xE1|BA|-11.85|-40.79\nJacupiranga|SP|-24.7|-48.01\nCumaru|PE|-8.01|-35.7\nManaquiri|AM|-3.44|-60.46\nSertan\xF3polis|PR|-23.06|-51.04\nNova Ol\xEDmpia|MT|-14.79|-57.29\nLagoa Nova|RN|-6.09|-36.47\nPia\xE7abu\xE7u|AL|-10.41|-36.43\nUiramut\xE3|RR|4.6|-60.18\nMirangaba|BA|-10.96|-40.57\nConcei\xE7\xE3o do Almeida|BA|-12.78|-39.17\nAmajari|RR|3.65|-61.37\nGl\xF3ria|BA|-9.34|-38.25\nIpor\xE3|PR|-24.01|-53.71\nGuamar\xE9|RN|-5.11|-36.32\nIgapor\xE3|BA|-13.77|-42.72\nNova Olinda|CE|-7.08|-39.67\nMirante do Paranapanema|SP|-22.29|-51.91\nJupi|PE|-8.71|-36.41\nCampina da Lagoa|PR|-24.59|-52.8\nTeol\xE2ndia|BA|-13.59|-39.48\nMaruim|SE|-10.73|-37.09\nFerreiros|PE|-7.45|-35.24\nItariri|SP|-24.28|-47.17\nCol\xF4nia Leopoldina|AL|-8.92|-35.72\nCorup\xE1|SC|-26.42|-49.25\nJaguapit\xE3|PR|-23.11|-51.53\nAtalaia do Norte|AM|-4.37|-70.2\nCujubim|RO|-9.36|-62.58\nS\xE3o Pedro do Sul|RS|-29.62|-54.19\nPereiro|CE|-6.04|-38.46\nMeruoca|CE|-3.54|-40.45\nPassa Quatro|MG|-22.39|-44.97\nUbat\xE3|BA|-14.21|-39.52\nCruz\xEDlia|MG|-21.84|-44.81\nMara\xE3|AM|-1.85|-65.57\nCharqueada|SP|-22.51|-47.78\nMalhada|BA|-14.34|-43.77\nCampin\xE1polis|MT|-14.52|-52.89\nItagib\xE1|BA|-14.28|-39.84\nNobres|MT|-14.72|-56.33\nPalmitos|SC|-27.07|-53.16\nBarrocas|BA|-11.53|-39.08\nS\xE3o F\xE9lix do Coribe|BA|-13.4|-44.18\nUrandi|BA|-14.77|-42.65\nCruz Machado|PR|-26.02|-51.34\nItanhandu|MG|-22.29|-44.94\nSanta Cec\xEDlia|SC|-26.96|-50.43\nPedregulho|SP|-20.25|-47.48\nCanapi|AL|-9.12|-37.6\nHolambra|SP|-22.64|-47.05\nMessias|AL|-9.39|-35.84\nSalto do Lontra|PR|-25.78|-53.31\nSumidouro|RJ|-22.05|-42.68\nEstrela de Alagoas|AL|-9.39|-36.76\nPresidente Dutra|BA|-11.29|-41.98\nPinhalzinho|SP|-22.78|-46.59\nSanto Cristo|RS|-27.83|-54.66\nPiratininga|SP|-22.41|-49.13\nBituruna|PR|-26.16|-51.55\nVian\xF3polis|GO|-16.74|-48.52\nUarini|AM|-3.0|-65.11\nTapurah|MT|-12.7|-56.52\nSalinas da Margarida|BA|-12.87|-38.76\nS\xE3o Jo\xE3o Evangelista|MG|-18.55|-42.77\nBiritinga|BA|-11.61|-38.81\nAm\xE9rica Dourada|BA|-11.44|-41.44\nBonfim|RR|3.36|-59.83\nRodrigues Alves|AC|-7.74|-72.66\nNatividade|RJ|-21.04|-41.97\nTrair\xE3o|PA|-4.57|-55.94\nTururu|CE|-3.58|-39.43\nAndorinha|BA|-10.35|-39.84\nBrasil\xE2ndia de Minas|MG|-17.0|-46.01\nEspumoso|RS|-28.73|-52.85\nUira\xFAna|PB|-6.51|-38.41\nS\xE3o Francisco do Par\xE1|PA|-1.17|-47.79\nSanta Luzia|PB|-6.86|-36.92\nSanta Br\xEDgida|BA|-9.73|-38.12\nBalne\xE1rio Pinhal|RS|-30.24|-50.23\nInhapi|AL|-9.23|-37.75\nSales\xF3polis|SP|-23.53|-45.85\nAlvin\xF3polis|MG|-20.11|-43.05\nConchas|SP|-23.02|-48.01\nDion\xEDsio Cerqueira|SC|-26.26|-53.64\nTarum\xE3|SP|-22.74|-50.58\nRio Parana\xEDba|MG|-19.19|-46.25\nGuare\xED|SP|-23.37|-48.18\nConcei\xE7\xE3o do Lago-A\xE7u|MA|-3.85|-44.89\nPacaembu|SP|-21.56|-51.27\nInhuma|PI|-6.67|-41.7\nItamonte|MG|-22.29|-44.87\nJosel\xE2ndia|MA|-4.99|-44.7\nPanorama|SP|-21.35|-51.86\nNova Ponte|MG|-19.15|-47.68\nRestinga S\xEAca|RS|-29.82|-53.38\nMozarl\xE2ndia|GO|-14.75|-50.57\nCand\xF3i|PR|-25.58|-52.04\nEntre Rios de Minas|MG|-20.67|-44.07\nCumaru do Norte|PA|-7.81|-50.77\nBotelhos|MG|-21.64|-46.39\nTriunfo|PE|-7.83|-38.1\nTeixeira|PB|-7.22|-37.25\nPinda\xED|BA|-14.49|-42.69\nTarumirim|MG|-19.28|-42.01\nC\xE2ndido de Abreu|PR|-24.56|-51.34\nCambuci|RJ|-21.57|-41.92\nLago Verde|MA|-3.95|-44.83\nImba\xFA|PR|-24.45|-50.75\nCapela|AL|-9.41|-36.08\nIbitiara|BA|-12.65|-42.22\nSenador La Rocque|MA|-5.45|-47.3\nRos\xE1rio Oeste|MT|-14.83|-56.42\nRio Piracicaba|MG|-19.93|-43.18\nS\xE3o Jo\xE3o d'Alian\xE7a|GO|-14.7|-47.52\nBarroquinha|CE|-3.02|-41.14\nTabatinga|SP|-21.72|-48.69\nCoremas|PB|-7.01|-37.93\nAntas|BA|-10.39|-38.34\nBela Vista do Para\xEDso|PR|-22.99|-51.19\nJacara\xFA|PB|-6.61|-35.29\nTerra Rica|PR|-22.71|-52.62\nCuru\xE1|PA|-1.89|-55.12\nBuerarema|BA|-14.96|-39.3\nFronteira|MG|-20.27|-49.2\nPuxinan\xE3|PB|-7.15|-35.95\nArroio dos Ratos|RS|-30.09|-51.73\nFrei Paulo|SE|-10.55|-37.53\nTapes|RS|-30.67|-51.4\nJacaraci|BA|-14.85|-42.43\nPedro Afonso|TO|-8.97|-48.17\nAraruna|PR|-23.93|-52.5\nPatroc\xEDnio Paulista|SP|-20.64|-47.28\nCapin\xF3polis|MG|-18.69|-49.57\nPasso de Torres|SC|-29.31|-49.72\nPresidente Kennedy|ES|-21.1|-41.05\nClevel\xE2ndia|PR|-26.4|-52.35\n\xC1gua Fria|BA|-11.86|-38.76\nDavin\xF3polis|MA|-5.55|-47.42\nMira\xEDma|CE|-3.57|-39.97\nRebou\xE7as|PR|-25.62|-50.69\nJita\xFAna|BA|-14.01|-39.9\nTenente Portela|RS|-27.37|-53.76\nSonora|MS|-17.57|-54.76\nCaapiranga|AM|-3.32|-61.22\nAraputanga|MT|-15.46|-58.34\nPresidente Bernardes|SP|-22.01|-51.56\nS\xE3o Pedro da \xC1gua Branca|MA|-5.08|-48.43\nMonte Alegre de Sergipe|SE|-10.03|-37.56\nCapit\xE3o Le\xF4nidas Marques|PR|-25.48|-53.61\nGoian\xE1polis|GO|-16.51|-49.02\nMassaranduba|PB|-7.19|-35.78\nPlanalto|PR|-25.72|-53.76\nBom Jesus do Galho|MG|-19.84|-42.32\nMilh\xE3|CE|-5.67|-39.19\nAcrel\xE2ndia|AC|-9.83|-66.9\nPindorama|SP|-21.19|-48.91\nIpu\xE3|SP|-20.44|-48.01\nSever\xEDnia|SP|-20.81|-48.81\nCoronel Sapucaia|MS|-23.27|-55.53\nManoel Ribas|PR|-24.51|-51.67\nSim\xF5es|PI|-7.59|-40.81\nIrupi|ES|-20.35|-41.64\nIta\xFA de Minas|MG|-20.74|-46.75\nValentim Gentil|SP|-20.42|-50.09\nAstolfo Dutra|MG|-21.32|-42.86\nCaldas|MG|-21.92|-46.38\nLauro M\xFCller|SC|-28.39|-49.4\nSanto Ant\xF4nio dos Lopes|MA|-4.87|-44.37\nMirandiba|PE|-8.12|-38.74\nS\xE3o F\xE9lix do Araguaia|MT|-11.62|-50.67\nNina Rodrigues|MA|-3.47|-43.91\nSanta Maria do Cambuc\xE1|PE|-7.84|-35.89\nMaria da F\xE9|MG|-22.3|-45.38\n\xC1guas Vermelhas|MG|-15.74|-41.46\nIpangua\xE7u|RN|-5.49|-36.85\nLagoa Real|BA|-14.03|-42.13\nCrist\xF3polis|BA|-12.22|-44.42\nMatias Barbosa|MG|-21.87|-43.31\nMartinho Campos|MG|-19.33|-45.24\nMansid\xE3o|BA|-10.72|-44.04\nS\xE3o Jos\xE9 do Cedro|SC|-26.46|-53.5\nRibeira do Amparo|BA|-11.04|-38.42\nItalva|RJ|-21.43|-41.7\nSobradinho|RS|-29.42|-53.03\nAdustina|BA|-10.54|-38.11\nEngenheiro Caldas|MG|-19.21|-42.05\nBraz\xF3polis|MG|-22.47|-45.62\nJatob\xE1|PE|-9.17|-38.26\nTavares|PB|-7.63|-37.87\nCoribe|BA|-13.82|-44.46\nSanta Izabel do Oeste|PR|-25.82|-53.48\nAlagoinha|PE|-8.47|-36.78\nS\xE3o Jos\xE9 do Rio Claro|MT|-13.44|-56.72\nJardim de Piranhas|RN|-6.38|-37.35\nS\xE3o Ludgero|SC|-28.31|-49.18\nAracatu|BA|-14.43|-41.46\nIracema|CE|-5.81|-38.29\nTracunha\xE9m|PE|-7.8|-35.23\nSimpl\xEDcio Mendes|PI|-7.85|-41.91\nMogeiro|PB|-7.29|-35.48\nS\xEDtio do Quinto|BA|-10.35|-38.22\nItaguara|MG|-20.39|-44.49\nPi\xEAn|PR|-26.1|-49.43\nSoledade|PB|-7.06|-36.37\nBorborema|SP|-21.62|-49.07\nCapit\xE3o En\xE9as|MG|-16.33|-43.71\nNova Ipixuna|PA|-4.92|-49.08\nNova Trento|SC|-27.28|-48.93\nSanta Luzia|BA|-15.43|-39.33\nIgarap\xE9 do Meio|MA|-3.66|-45.21\nPrimavera|PE|-8.33|-35.35\nNova Olinda do Maranh\xE3o|MA|-2.84|-45.7\nAlfredo Chaves|ES|-20.64|-40.75\nBarra do Mendes|BA|-11.81|-42.06\nAlto Santo|CE|-5.51|-38.27\nBicas|MG|-21.72|-43.06\nTapero\xE1|PB|-7.21|-36.82\nAbre Campo|MG|-20.3|-42.47\nItagi|BA|-14.16|-40.01\nGuajar\xE1|AM|-7.54|-72.59\nSanta Cruz|PE|-8.24|-40.34\nAcarape|CE|-4.22|-38.71\nNova Bandeirantes|MT|-9.85|-57.81\nLagoa dos Gatos|PE|-8.66|-35.9\nNova Aurora|PR|-24.53|-53.26\nTacaimb\xF3|PE|-8.31|-36.3\nCarapebus|RJ|-22.18|-41.66\nChapad\xE3o do C\xE9u|GO|-18.41|-52.55\nDeod\xE1polis|MS|-22.28|-54.17\nIbipitanga|BA|-12.88|-42.49\nIpiranga|PR|-25.02|-50.58\nSabin\xF3polis|MG|-18.67|-43.08\nUruoca|CE|-3.31|-40.56\nMirinzal|MA|-2.07|-44.78\nRio Bonito do Igua\xE7u|PR|-25.49|-52.53\nJo\xE3o Neiva|ES|-19.76|-40.39\nV\xE1rzea da Ro\xE7a|BA|-11.6|-40.13\nS\xE3o Jo\xE3o do Araguaia|PA|-5.36|-48.79\nManoel Vitorino|BA|-14.15|-40.24\nSanto Amaro do Maranh\xE3o|MA|-2.5|-43.24\nFelixl\xE2ndia|MG|-18.75|-44.9\nFlores de Goi\xE1s|GO|-14.45|-47.04\nAlterosa|MG|-21.25|-46.14\nVila Val\xE9rio|ES|-19.0|-40.38\nJoaquim Pires|PI|-3.5|-42.19\nGovernador Eug\xEAnio Barros|MA|-5.32|-44.25\nIbicu\xED|BA|-14.85|-39.99\nLadainha|MG|-17.63|-41.75\nItaporanga|SP|-23.7|-49.48\nItapetim|PE|-7.37|-37.19\nAreado|MG|-21.36|-46.14\nPedro Alexandre|BA|-10.01|-37.89\nSanta Branca|SP|-23.39|-45.89\nCandeias|MG|-20.77|-45.28\nCarm\xF3polis|SE|-10.64|-36.99\nPapagaios|MG|-19.44|-44.75\nAcajutiba|BA|-11.66|-38.02\nParipueira|AL|-9.46|-35.55\nTaguatinga|TO|-12.4|-46.44\nPedro Velho|RN|-6.44|-35.22\nSanto Augusto|RS|-27.85|-53.78\nSanta Ad\xE9lia|SP|-21.24|-48.81\nMuqui|ES|-20.95|-41.35\nAlto Paran\xE1|PR|-23.13|-52.32\nAngical|BA|-12.01|-44.7\nGra\xE7a|CE|-4.04|-40.75\nRetirol\xE2ndia|BA|-11.48|-39.42\nRio Azul|PR|-25.73|-50.8\nAnadia|AL|-9.68|-36.31\nQuatis|RJ|-22.4|-44.26\nSider\xF3polis|SC|-28.6|-49.43\nMorungaba|SP|-22.88|-46.79\nItaipava do Graja\xFA|MA|-5.14|-45.79\nGurinh\xE9m|PB|-7.12|-35.42\nAlagoinha|PB|-6.95|-35.53\nBaian\xF3polis|BA|-12.3|-44.54\nSerra Branca|PB|-7.48|-36.67\nOroc\xF3|PE|-8.61|-39.6\nBoninal|BA|-12.71|-41.83\nCarmo de Minas|MG|-22.12|-45.13\nSalo\xE1|PE|-8.97|-36.69\nS\xE3o Miguel do Tocantins|TO|-5.56|-47.57\nAiuaba|CE|-6.57|-40.12\nAnapurus|MA|-3.68|-43.1\nIlha Comprida|SP|-24.73|-47.54\nTurvo|PR|-25.04|-51.53\nBrejo do Cruz|PB|-6.34|-37.49\nMaranh\xE3ozinho|MA|-2.24|-45.85\nGuap\xE9|MG|-20.76|-45.92\nNonoai|RS|-27.37|-52.78\nUrup\xEAs|SP|-21.2|-49.29\nMirabela|MG|-16.26|-44.16\nPasso de Camaragibe|AL|-9.25|-35.47\nMontalv\xE2nia|MG|-14.42|-44.37\nJiquiri\xE7\xE1|BA|-13.26|-39.57\nAlexandria|RN|-6.41|-38.01\nFrei Miguelinho|PE|-7.94|-35.91\nS\xE3o Pedro do Piau\xED|PI|-5.92|-42.72\nBoa Esperan\xE7a|ES|-18.54|-40.3\nUpanema|RN|-5.64|-37.26\nItagua\xE7u|ES|-19.8|-40.86\nGr\xE3o Mogol|MG|-16.57|-42.89\nItapu\xED|SP|-22.23|-48.72\nJoa\xEDma|MG|-16.65|-41.02\nCa\xE7u|GO|-18.56|-51.13\nIpecaet\xE1|BA|-12.3|-39.31\nCerro Largo|RS|-28.15|-54.74\nItapagipe|MG|-19.91|-49.38\nBoa Nova|BA|-14.36|-40.21\nNova Veneza|SC|-28.63|-49.51\nSanta Luzia do Itanhy|SE|-11.35|-37.46\nJurema|PE|-8.71|-36.13\nMucambo|CE|-3.9|-40.75\nFeliz|RS|-29.45|-51.3\nBaixa Grande do Ribeiro|PI|-7.85|-45.22\nIbateguara|AL|-8.98|-35.94\nS\xEDtio do Mato|BA|-13.08|-43.47\nMaribondo|AL|-9.58|-36.3\nNova Cana\xE3|BA|-14.79|-40.15\nIguatemi|MS|-23.67|-54.56\nAlto Gar\xE7as|MT|-16.95|-53.53\nItinga|MG|-16.61|-41.77\nSanta Isabel do Rio Negro|AM|-0.41|-65.01\nSaboeiro|CE|-6.53|-39.9\nSanta Tereza do Oeste|PR|-25.05|-53.63\nAtal\xE9ia|MG|-18.04|-41.11\nIpaussu|SP|-23.06|-49.63\nMagalh\xE3es de Almeida|MA|-3.39|-42.21\nBujari|AC|-9.82|-67.95\nCamapu\xE3|MS|-19.53|-54.04\nBarro Alto|BA|-11.76|-41.91\nMira\xED|MG|-21.2|-42.61\nOlinda Nova do Maranh\xE3o|MA|-2.99|-44.99\nPrimeira Cruz|MA|-2.51|-43.42\nMascote|BA|-15.55|-39.3\nS\xE3o Jo\xE3o do Triunfo|PR|-25.68|-50.29\nPedra Branca do Amapari|AP|0.78|-51.95\nUiba\xED|BA|-11.34|-42.14\nBalsa Nova|PR|-25.58|-49.63\nV\xE1rzea Nova|BA|-11.26|-40.94\nSerrol\xE2ndia|BA|-11.41|-40.3\nUruana|GO|-15.5|-49.69\nAuriflama|SP|-20.68|-50.56\nLontras|SC|-27.17|-49.53\nSerra do Mel|RN|-5.18|-37.02\nTartarugalzinho|AP|1.51|-50.91\nSanta Leopoldina|ES|-20.1|-40.53\nSang\xE3o|SC|-28.63|-49.13\nUmburanas|BA|-10.73|-41.32\nCuri\xFAva|PR|-24.04|-50.46\nItatiaiu\xE7u|MG|-20.2|-44.42\nItaet\xE9|BA|-12.98|-40.97\nGuarania\xE7u|PR|-25.1|-52.88\nElesb\xE3o Veloso|PI|-6.2|-42.14\nAlto Long\xE1|PI|-5.26|-42.21\nPara\xEDso do Norte|PR|-23.28|-52.61\nJapoat\xE3|SE|-10.35|-36.8\nAlvorada D'Oeste|RO|-11.35|-62.28\nBrejetuba|ES|-20.14|-41.3\nAr\xEAs|RN|-6.19|-35.16\nMallet|PR|-25.88|-50.82\nP\xE9 de Serra|BA|-11.83|-39.61\nBom Princ\xEDpio|RS|-29.49|-51.35\nPot\xE9|MG|-17.81|-41.79\nMulungu do Morro|BA|-11.96|-41.64\nRio de Contas|BA|-13.59|-41.8\nColares|PA|-0.94|-48.28\nCanelinha|SC|-27.26|-48.77\nTurvo|SC|-28.93|-49.68\nCaldeir\xE3o Grande|BA|-11.02|-40.3\nTangar\xE1|RN|-6.2|-35.8\nItapeva|MG|-22.77|-46.22\nS\xE3o Sim\xE3o|SP|-21.47|-47.55\nMambor\xEA|PR|-24.32|-52.53\nS\xE3o Jo\xE3o das Miss\xF5es|MG|-14.89|-44.09\nAndara\xED|BA|-12.8|-41.33\nCosta Marques|RO|-12.44|-64.23\nIgrapi\xFAna|BA|-13.83|-39.14\nCh\xE3 de Alegria|PE|-8.01|-35.2\nRio do Ant\xF4nio|BA|-14.41|-42.07\nPeabiru|PR|-23.91|-52.34\nRodeio|SC|-26.92|-49.36\nUbaporanga|MG|-19.64|-42.11\nAssa\xED|PR|-23.37|-50.85\nIva\xED|PR|-25.01|-50.86\nCasinhas|PE|-7.74|-35.72\nCotegipe|BA|-12.02|-44.26\nWanderley|BA|-12.11|-43.9\nPalmeirais|PI|-5.97|-43.06\nS\xE3o Benedito do Sul|PE|-8.82|-35.95\nCandiba|BA|-14.41|-42.87\nJoaquim Nabuco|PE|-8.62|-35.53\nQuat\xE1|SP|-22.25|-50.7\nCardoso Moreira|RJ|-21.48|-41.62\nBocai\xFAva do Sul|PR|-25.21|-49.11\nParanhos|MS|-23.89|-55.43\nPi\xE7arra|PA|-6.44|-48.87\nNioaque|MS|-21.14|-55.83\nMonte Belo|MG|-21.33|-46.36\nNova Prata do Igua\xE7u|PR|-25.63|-53.35\nAnt\xF4nio Prado|RS|-28.86|-51.29\nCedral|SP|-20.9|-49.27\nBom Repouso|MG|-22.47|-46.14\nDom Feliciano|RS|-30.7|-52.1\nBuenos Aires|PE|-7.72|-35.32\nIlic\xEDnea|MG|-20.94|-45.83\nBrej\xF5es|BA|-13.1|-39.8\nApuiar\xE9s|CE|-3.95|-39.44\nPalmares do Sul|RS|-30.25|-50.51\nMar de Espanha|MG|-21.87|-43.01\nFl\xF3rida Paulista|SP|-21.61|-51.17\nNova Timboteua|PA|-1.21|-47.39\nGravatal|SC|-28.32|-49.04\nRibeir\xE3o do Pinhal|PR|-23.41|-50.36\nNova Crix\xE1s|GO|-14.1|-50.33\nLagoa Dourada|MG|-20.91|-44.08\nCidel\xE2ndia|MA|-5.17|-47.78\nJoan\xF3polis|SP|-22.93|-46.27\nManten\xF3polis|ES|-18.86|-41.12\nBuritirana|MA|-5.6|-47.01\nPerdig\xE3o|MG|-19.94|-45.08\nCrissiumal|RS|-27.5|-54.1\nBoa Esperan\xE7a do Sul|SP|-21.99|-48.39\nEldorado|SP|-24.53|-48.11\nSerra Azul|SP|-21.31|-47.56\nMontividiu|GO|-17.44|-51.17\nLucena|PB|-6.9|-34.87\nMaril\xE2ndia|ES|-19.41|-40.55\nCampos Altos|MG|-19.69|-46.17\nNova Londrina|PR|-22.76|-52.99\nMiranorte|TO|-9.53|-48.59\nTagua\xED|SP|-23.45|-49.4\nHeli\xF3polis|BA|-10.68|-38.29\nBarra de Santa Rosa|PB|-6.72|-36.07\nCampinorte|GO|-14.31|-49.15\nPo\xE7o das Trincheiras|AL|-9.31|-37.29\nSeringueiras|RO|-11.81|-63.02\nFortaleza dos Nogueiras|MA|-6.96|-46.17\nPresidente J\xE2nio Quadros|BA|-14.69|-41.68\nBonito|PA|-1.37|-47.31\nManoel Urbano|AC|-8.83|-69.27\nChapada Ga\xFAcha|MG|-15.3|-45.61\nSete Barras|SP|-24.38|-47.93\nPilar|PB|-7.26|-35.25\nCampo Alegre|SC|-26.2|-49.27\nPalmital|PR|-24.89|-52.2\nAlto do Rodrigues|RN|-5.28|-36.75\nItapejara d'Oeste|PR|-25.96|-52.82\nRibeir\xE3o Claro|PR|-23.19|-49.76\nGoiatins|TO|-7.71|-47.33\nRio Casca|MG|-20.23|-42.65\nSanta Maria do Sua\xE7u\xED|MG|-18.19|-42.41\nChaval|CE|-3.04|-41.24\nAragoi\xE2nia|GO|-16.91|-49.45\nMaraca\xED|SP|-22.61|-50.67\nIconha|ES|-20.79|-40.81\nParanatama|PE|-8.92|-36.65\nRio Vermelho|MG|-18.29|-43.0\nConcei\xE7\xE3o do Rio Verde|MG|-21.88|-45.09\nDores do Indai\xE1|MG|-19.46|-45.59\nSantana do Matos|RN|-5.95|-36.66\nPorto Murtinho|MS|-21.7|-57.88\nCarnaubeira da Penha|PE|-8.32|-38.75\nMucug\xEA|BA|-13.01|-41.37\nCentro do Guilherme|MA|-2.45|-46.03\nTeixeiras|MG|-20.66|-42.86\nPacatuba|SE|-10.45|-36.65\nItagua\xE7u da Bahia|BA|-11.01|-42.4\nRialma|GO|-15.31|-49.58\nPorto Alegre do Norte|MT|-10.88|-51.64\nEngenheiro Paulo de Frontin|RJ|-22.55|-43.68\nBrejinho|RN|-6.19|-35.36\nJequeri|MG|-20.45|-42.67\nCristais|MG|-20.87|-45.52\nSilves|AM|-2.82|-58.25\nBarra de Guabiraba|PE|-8.42|-35.66\nBom Retiro do Sul|RS|-29.61|-51.95\nItiquira|MT|-17.21|-54.14\n\xC1gua Doce do Norte|ES|-18.55|-40.99\nIapu|MG|-19.44|-42.21\nCruzeiro do Sul|RS|-29.51|-51.99\nPo\xE7o Branco|RN|-5.62|-35.66\nLu\xEDs Ant\xF4nio|SP|-21.55|-47.78\nCambuquira|MG|-21.85|-45.29\nSenador Rui Palmeira|AL|-9.47|-37.46\nCampestre do Maranh\xE3o|MA|-6.17|-47.36\nDuartina|SP|-22.41|-49.41\nPiquete|SP|-22.61|-45.19\nPend\xEAncias|RN|-5.26|-36.71\nCanan\xE9ia|SP|-25.01|-47.93\nArara|PB|-6.83|-35.76\nS\xE3o Gon\xE7alo do Rio Abaixo|MG|-19.82|-43.37\nBarra do Ribeiro|RS|-30.29|-51.3\nConcei\xE7\xE3o do Castelo|ES|-20.36|-41.24\nAnt\xF4nio Carlos|SC|-27.52|-48.77\n\xC1gua Doce do Maranh\xE3o|MA|-2.84|-42.12\nIpaumirim|CE|-6.78|-38.72\nPoranga|CE|-4.75|-40.92\nChavantes|SP|-23.04|-49.71\nNilo Pe\xE7anha|BA|-13.6|-39.11\n\xC1gua Boa|MG|-17.99|-42.38\nP\xE9rola|PR|-23.8|-53.68\nBom Lugar|MA|-4.37|-45.03\nTabocas do Brejo Velho|BA|-12.7|-44.01\nLagoa do Ouro|PE|-9.13|-36.46\nSanta Filomena|PE|-8.17|-40.61\nS\xE3o Francisco do Maranh\xE3o|MA|-6.25|-42.87\nS\xE3o Jo\xE3o do Car\xFA|MA|-3.55|-46.25\nChor\xF3|CE|-4.84|-39.13\nEngenheiro Beltr\xE3o|PR|-23.8|-52.27\nMostardas|RS|-31.11|-50.92\nJoaquim T\xE1vora|PR|-23.5|-49.91\nS\xE3o Sebasti\xE3o do Uatum\xE3|AM|-2.56|-57.87\nDom Bas\xEDlio|BA|-13.76|-41.77\nSeberi|RS|-27.48|-53.4\nPorto|PI|-3.89|-42.7\nIbira\xE7u|ES|-19.84|-40.37\nCachoeira de Minas|MG|-22.35|-45.78\nNova Laranjeiras|PR|-25.31|-52.54\nS\xE3o Jo\xE3o|PR|-25.82|-52.73\nArroio do Tigre|RS|-29.33|-53.1\nBanza\xEA|BA|-10.58|-38.62\nSerra do Salitre|MG|-19.11|-46.7\nS\xE3o Gon\xE7alo do Par\xE1|MG|-19.98|-44.86\nLuiz Alves|SC|-26.72|-48.93\nAreal|RJ|-22.23|-43.11\nAlto Alegre dos Parecis|RO|-12.13|-61.84\nGovernador Dix-Sept Rosado|RN|-5.45|-37.52\nMato Verde|MG|-15.39|-42.86\nLic\xEDnio de Almeida|BA|-14.68|-42.51\nBrotas de Maca\xFAbas|BA|-11.99|-42.63\nPaulista|PB|-6.59|-37.62\nMonte Negro|RO|-10.25|-63.29\nAndrel\xE2ndia|MG|-21.74|-44.31\nImaru\xED|SC|-28.33|-48.82\nIbaretama|CE|-4.8|-38.75\nJardim Alegre|PR|-24.18|-51.69\nItaipul\xE2ndia|PR|-25.14|-54.3\nJer\xF4nimo Monteiro|ES|-20.8|-41.39\nBela Vista do Maranh\xE3o|MA|-3.73|-45.31\nTomar do Geru|SE|-11.37|-37.84\nAxix\xE1|MA|-2.84|-44.06\nParana\xEDta|MT|-9.66|-56.48\nPrudente de Morais|MG|-19.47|-44.16\nJucati|PE|-8.7|-36.49\nIbicuitinga|CE|-4.97|-38.64\nPira\xFAba|MG|-21.28|-43.02\nCaroebe|RR|0.88|-59.7\nJataizinho|PR|-23.26|-50.98\nS\xE3o Bento do Sapuca\xED|SP|-22.68|-45.73\nAngicos|RN|-5.66|-36.61\nUba\xED|MG|-16.29|-44.78\nEd\xE9ia|GO|-17.34|-49.93\nIpaporanga|CE|-4.9|-40.75\nBet\xE2nia|PE|-8.27|-38.03\nItamarati|AM|-6.44|-68.24\nAra\xE7\xE1s|BA|-12.22|-38.2\nIbir\xE1|SP|-21.08|-49.24\nJardim do Serid\xF3|RN|-6.58|-36.77\nPiranhas|GO|-16.43|-51.82\nSanta Cruz da Baixa Verde|PE|-7.81|-38.15\nCaetan\xF3polis|MG|-19.3|-44.42\nTapiratiba|SP|-21.47|-46.74\nVit\xF3ria do Jari|AP|-0.94|-52.42\nIelmo Marinho|RN|-5.82|-35.55\nLoreto|MA|-7.08|-45.15\nBernardino de Campos|SP|-23.02|-49.47\nEstiva|MG|-22.46|-46.02\nAlto Taquari|MT|-17.82|-53.28\nSaubara|BA|-12.74|-38.76\nCachoeira Alta|GO|-18.76|-50.94\nQuatipuru|PA|-0.9|-47.01\nBrasil\xE2ndia|MS|-21.25|-52.04\nAlc\xE2ntaras|CE|-3.59|-40.55\nMontanhas|RN|-6.49|-35.28\nVirgem da Lapa|MG|-16.81|-42.34\nCarmo da Cachoeira|MG|-21.46|-45.22\nSalgado de S\xE3o F\xE9lix|PB|-7.35|-35.43\nNova Cana\xE3 do Norte|MT|-10.56|-55.95\nLagoa Grande do Maranh\xE3o|MA|-4.99|-45.38\nSanta F\xE9|PR|-23.04|-51.81\nMalhador|SE|-10.66|-37.3\nTaipu|RN|-5.63|-35.59\nOuro Branco|AL|-9.16|-37.36\nCidade Ga\xFAcha|PR|-23.38|-52.94\nPalestina|SP|-20.39|-49.43\nXex\xE9u|PE|-8.8|-35.62\nSales Oliveira|SP|-20.77|-47.84\nCapinzal do Norte|MA|-4.72|-44.33\nS\xE3o Jo\xE3o do Manhua\xE7u|MG|-20.39|-42.15\nNossa Senhora do Livramento|MT|-15.77|-56.34\nFlorest\xF3polis|PR|-22.86|-51.39\nJuruaia|MG|-21.25|-46.57\nAgrol\xE2ndia|SC|-27.41|-49.82\nCampo do Meio|MG|-21.11|-45.83\nEldorado|MS|-23.79|-54.28\nJuscimeira|MT|-16.06|-54.89\nPedro de Toledo|SP|-24.28|-47.24\nPresidente Juscelino|MA|-2.92|-44.07\nEstiva Gerbi|SP|-22.27|-46.95\nLaranja da Terra|ES|-19.9|-41.06\nNovo Horizonte|BA|-12.81|-42.17\nCurimat\xE1|PI|-10.03|-44.3\nLebon R\xE9gis|SC|-26.93|-50.69\nSantana do Munda\xFA|AL|-9.17|-36.22\nIuiu|BA|-14.41|-43.56\nLima Campos|MA|-4.52|-44.46\nS\xE3o Tiago|MG|-20.91|-44.51\nResende Costa|MG|-20.92|-44.24\nFaxinal dos Guedes|SC|-26.85|-52.26\nGouveia|MG|-18.45|-43.74\nAmatur\xE1|AM|-3.37|-68.2\nPlanura|MG|-20.14|-48.7\nArarend\xE1|CE|-4.75|-40.83\nFloresta|PR|-23.6|-52.08\nDois Irm\xE3os do Buriti|MS|-20.68|-55.29\nAnt\xF4nio Cardoso|BA|-12.43|-39.12\nTabapu\xE3|SP|-20.96|-49.03\nAnguera|BA|-12.15|-39.25\nPimenteiras|PI|-6.24|-41.41\nGovernador Lindenberg|ES|-19.19|-40.45\nPira\xED do Norte|BA|-13.76|-39.38\nBocaina|SP|-22.14|-48.52\nGuai\xE7ara|SP|-21.62|-49.8\nMortugaba|BA|-15.02|-42.37\nCardoso|SP|-20.08|-49.92\nRio Novo do Sul|ES|-20.86|-40.94\nCal\xE7oene|AP|2.5|-50.95\nFloresta Azul|BA|-14.86|-39.66\nPirapetinga|MG|-21.66|-42.34\nCal\xE7ado|PE|-8.73|-36.34\nS\xEDtio Novo do Tocantins|TO|-5.6|-47.64\nCongonhal|MG|-22.15|-46.04\nAvanhandava|SP|-21.46|-49.95\nMilagres|BA|-12.86|-39.86\nQuilombo|SC|-26.73|-52.72\nCaetanos|BA|-14.33|-40.92\nBom Jesus|RS|-28.67|-50.43\nAratuba|CE|-4.41|-39.05\nBotupor\xE3|BA|-13.38|-42.52\nAperib\xE9|RJ|-21.63|-42.1\nCapela de Santana|RS|-29.7|-51.33\nMissal|PR|-25.09|-54.25\nPacoti|CE|-4.22|-38.92\nArroio do Sal|RS|-29.54|-49.89\nS\xE3o Jos\xE9 do Cal\xE7ado|ES|-21.03|-41.66\nPassa e Fica|RN|-6.43|-35.64\nPinheiro Machado|RS|-31.58|-53.38\nAlto Parna\xEDba|MA|-9.1|-45.93\nMachados|PE|-7.69|-35.51\nS\xE3o Sebasti\xE3o de Lagoa de Ro\xE7a|PB|-7.11|-35.87\nRecreio|MG|-21.53|-42.47\nPrimavera|PA|-0.95|-47.13\nGroa\xEDras|CE|-3.92|-40.39\nCapit\xE3o de Campos|PI|-4.46|-41.94\nDuas Barras|RJ|-22.05|-42.52\nMarcel\xE2ndia|MT|-11.05|-54.44\nAnt\xF4nio Carlos|MG|-21.32|-43.75\nIguaracy|PE|-7.83|-37.51\nIgaratinga|MG|-19.95|-44.71\nAurelino Leal|BA|-14.32|-39.33\nRoncador|PR|-24.6|-52.27\nCerro Cor\xE1|RN|-6.04|-36.35\nPorto Walter|AC|-8.26|-72.75\nMineiros do Tiet\xEA|SP|-22.41|-48.45\nSete Quedas|MS|-23.97|-55.04\nUrup\xE1|RO|-11.13|-62.36\nAng\xE9lica|MS|-22.15|-53.77\nFagundes|PB|-7.34|-35.79\nDivinol\xE2ndia|SP|-21.66|-46.74\nQuebrangulo|AL|-9.32|-36.47\nCacequi|RS|-29.89|-54.82\nS\xE3o Jos\xE9 do Campestre|RN|-6.31|-35.71\nAraguan\xE3|MA|-2.95|-45.66\nMoita Bonita|SE|-10.58|-37.35\nGararu|SE|-9.97|-37.09\nCarmo da Mata|MG|-20.56|-44.87\nSanto Amaro das Brotas|SE|-10.79|-37.06\nMartin\xF3pole|CE|-3.23|-40.69\nGentio do Ouro|BA|-11.43|-42.51\nPorecatu|PR|-22.75|-51.38\nCabo Verde|MG|-21.47|-46.39\nItanhomi|MG|-19.17|-41.86\nS\xE3o Roque do Cana\xE3|ES|-19.74|-40.65\nC\xE9u Azul|PR|-25.15|-53.84\nAnt\xF4nio Gon\xE7alves|BA|-10.58|-40.28\nCunha Por\xE3|SC|-26.89|-53.17\nCoroaci|MG|-18.62|-42.28\nPeri Mirim|MA|-2.58|-44.85\nTr\xEAs Cachoeiras|RS|-29.45|-49.93\nFernando Falc\xE3o|MA|-6.16|-44.9\nConcei\xE7\xE3o dos Ouros|MG|-22.41|-45.8\nRio dos Cedros|SC|-26.74|-49.27\nPatu|RN|-6.11|-37.64\nSair\xE9|PE|-8.33|-35.7\nItiru\xE7u|BA|-13.53|-40.15\nCapim Branco|MG|-19.55|-44.13\nTacuru|MS|-23.64|-55.01\nSerra Caiada|RN|-6.1|-35.71\nLen\xE7\xF3is|BA|-12.56|-41.39\nGilbu\xE9s|PI|-9.83|-45.34\nAlto Para\xEDso de Goi\xE1s|GO|-14.13|-47.51\nBueno Brand\xE3o|MG|-22.44|-46.35\nAfonso Bezerra|RN|-5.49|-36.51\nTr\xEAs Barras do Paran\xE1|PR|-25.42|-53.18\nDelta|MG|-19.97|-47.78\nRoseira|SP|-22.89|-45.31\nAral Moreira|MS|-22.94|-55.63\nAvelino Lopes|PI|-10.13|-43.96\nJacinto|MG|-16.14|-40.3\nS\xE3o F\xE9lix|BA|-12.61|-38.97\nEugen\xF3polis|MG|-21.1|-42.19\nJuru\xE1|AM|-3.48|-66.07\nItamogi|MG|-21.08|-47.05\nPirangi|SP|-21.09|-48.66\nGuaraciaba|SC|-26.6|-53.52\nMulungu|CE|-4.3|-39.0\nUrubici|SC|-28.02|-49.59\nNovo Triunfo|BA|-10.32|-38.4\nPonto dos Volantes|MG|-16.75|-41.5\nD\xE1rio Meira|BA|-14.42|-39.9\nVera Cruz|RN|-6.04|-35.43\nOliven\xE7a|AL|-9.52|-37.2\nAt\xEDlio Viv\xE1cqua|ES|-20.91|-41.2\nMoreira Sales|PR|-24.05|-53.01\nRibeir\xE3o Bonito|SP|-22.07|-48.18\nIramaia|BA|-13.29|-40.96\nCoit\xE9 do N\xF3ia|AL|-9.63|-36.58\nCapela do Alto Alegre|BA|-11.67|-39.83\nCatanduvas|SC|-27.07|-51.66\nBonfin\xF3polis|GO|-16.62|-48.96\nCandiota|RS|-31.55|-53.68\nIbiraci|MG|-20.46|-47.12\nGovernador Newton Bello|MA|-3.43|-45.66\nCapit\xF3lio|MG|-20.62|-46.05\nIgarat\xE1|SP|-23.2|-46.16\nPires Ferreira|CE|-4.24|-40.64\nCapixaba|AC|-10.57|-67.69\nTerra Nova|BA|-12.39|-38.62\nItarana|ES|-19.88|-40.88\nItain\xF3polis|PI|-7.44|-41.47\nNinheira|MG|-15.31|-41.76\nAlfredo Wagner|SC|-27.7|-49.33\nItapiranga|AM|-2.74|-58.03\nJesu\xEDtas|PR|-24.38|-53.38\nEsp\xEDrito Santo|RN|-6.34|-35.31\nBataypor\xE3|MS|-22.29|-53.27\n\xC9rico Cardoso|BA|-13.42|-42.14\nSanta Mariana|PR|-23.15|-50.52\nIracema|RR|2.18|-61.04\nChorroch\xF3|BA|-8.97|-39.1\nAlto Rio Doce|MG|-21.03|-43.41\nBuriti Alegre|GO|-18.14|-49.04\nMonte Alegre do Piau\xED|PI|-9.75|-45.3\nIcara\xED de Minas|MG|-16.21|-44.9\nCenten\xE1rio do Sul|PR|-22.82|-51.6\nUruc\xE2nia|MG|-20.35|-42.74\nPalmeiras|BA|-12.51|-41.58\nPedralva|MG|-22.24|-45.47\nS\xE3o Lu\xEDs do Curu|CE|-3.67|-39.24\nMatias Ol\xEDmpio|PI|-3.71|-42.55\nRodelas|BA|-8.85|-38.78\nS\xE3o Jer\xF4nimo da Serra|PR|-23.72|-50.75\nSanta Terezinha|BA|-12.77|-39.52\nParan\xE3|TO|-12.62|-47.87\nCatunda|CE|-4.64|-40.2\nVargem|SP|-22.89|-46.41\nAcari|RN|-6.43|-36.63\nBarro Alto|GO|-14.97|-48.91\nPorangaba|SP|-23.18|-48.12\nCedro|PE|-7.71|-39.24\nItatuba|PB|-7.38|-35.64\nPorto Firme|MG|-20.66|-43.08\nMoreil\xE2ndia|PE|-7.62|-39.55\nSanta Terezinha de Goi\xE1s|GO|-14.43|-49.71\nTerra Alta|PA|-1.03|-47.9\nIretama|PR|-24.43|-52.1\nTapera|RS|-28.63|-52.86\nNaz\xE1ria|PI|-5.35|-42.82\nBom Jesus do Norte|ES|-21.12|-41.67\nJacinto Machado|SC|-29.0|-49.76\nGl\xF3ria de Dourados|MS|-22.41|-54.23\nPariconha|AL|-9.26|-38.0\nLagoa do Mato|MA|-6.05|-43.53\nMara Rosa|GO|-14.01|-49.18\nMuqu\xE9m do S\xE3o Francisco|BA|-12.06|-43.55\nCristino Castro|PI|-8.82|-44.22\nSaudades|SC|-26.93|-53.0\nBel\xE9m de Maria|PE|-8.62|-35.83\nPo\xE7\xE3o|PE|-8.19|-36.71\nPresidente Vargas|MA|-3.41|-44.02\nInhangapi|PA|-1.43|-47.91\nRio do Pires|BA|-13.12|-42.29\nJaguari|RS|-29.49|-54.7\nAgudos do Sul|PR|-25.99|-49.33\nAren\xE1polis|MT|-14.45|-56.84\nSantana do Maranh\xE3o|MA|-3.11|-42.41\nVera|MT|-12.3|-55.3\nBenedito Novo|SC|-26.78|-49.36\nIbiassuc\xEA|BA|-14.27|-42.26\nMacajuba|BA|-12.13|-40.36\nWanderl\xE2ndia|TO|-6.85|-47.96\nCa\xE9m|BA|-11.07|-40.43\nAxix\xE1 do Tocantins|TO|-5.61|-47.77\nPonte Serrada|SC|-26.87|-52.01\nPara\xFAna|GO|-16.95|-50.45\nCorumb\xE1 de Goi\xE1s|GO|-15.92|-48.81\nParapu\xE3|SP|-21.78|-50.79\nSanta Maria de Itabira|MG|-19.44|-43.11\nCan\xE1polis|MG|-18.72|-49.2\nBofete|SP|-23.11|-48.26\nCacimbinhas|AL|-9.4|-36.99\nConcei\xE7\xE3o da Aparecida|MG|-21.1|-46.2\nFervedouro|MG|-20.73|-42.28\nAnan\xE1s|TO|-6.36|-48.07\nMana\xEDra|PB|-7.7|-38.15\nRio Acima|MG|-20.09|-43.79\nBuriti do Tocantins|TO|-5.31|-48.23\nRio do Fogo|RN|-5.28|-35.38\nGeneral Carneiro|PR|-26.43|-51.32\nSarapu\xED|SP|-23.64|-47.82\nCantagalo|PR|-25.37|-52.12\nUchoa|SP|-20.95|-49.17\nJaguaribara|CE|-5.68|-38.54\nSa\xFAde|BA|-10.94|-40.42\nOuroeste|SP|-20.01|-50.38\nDivis\xF3polis|MG|-15.73|-41.0\nSenhora dos Rem\xE9dios|MG|-21.04|-43.58\nUmarizal|RN|-5.98|-37.82\nPintadas|BA|-11.81|-39.9\nTrajano de Moraes|RJ|-22.06|-42.06\nS\xE3o Vicente do Serid\xF3|PB|-6.85|-36.41\nPotiragu\xE1|BA|-15.59|-39.86\nItap\xE9|BA|-14.89|-39.42\nIacanga|SP|-21.89|-49.03\nRoca Sales|RS|-29.29|-51.87\nCristina|MG|-22.21|-45.27\nCan\xE1polis|BA|-13.07|-44.2\nItapitanga|BA|-14.41|-39.57\nS\xE3o Jo\xE3o do Iva\xED|PR|-23.98|-51.82\nDona In\xEAs|PB|-6.62|-35.62\nS\xE3o Miguel do Gostoso|RN|-5.12|-35.64\nXambio\xE1|TO|-6.41|-48.53\nConstantina|RS|-27.73|-52.99\nQuer\xEAncia do Norte|PR|-23.08|-53.48\nSanta In\xEAs|BA|-13.28|-39.81\nPlanalto|RS|-27.33|-53.06\nCatanduvas|PR|-25.2|-53.15\nMerc\xEAs|MG|-21.2|-43.33\nPescaria Brava|SC|-28.4|-48.89\nS\xE3o Miguel das Matas|BA|-13.04|-39.46\nMatina|BA|-13.91|-42.84\nTenente Ananias|RN|-6.46|-38.18\nCoronel Freitas|SC|-26.91|-52.7\nRubim|MG|-16.38|-40.54\nPedras de Maria da Cruz|MG|-15.6|-44.39\nNova Olinda|TO|-7.63|-48.43\nAngelim|PE|-8.88|-36.29\nTerra Nova do Norte|MT|-10.52|-55.23\nBarbosa Ferraz|PR|-24.03|-52.0\nSanta Maria Madalena|RJ|-21.95|-42.01\nS\xE3o Jos\xE9 do Jacu\xEDpe|BA|-11.41|-39.87\nTerra de Areia|RS|-29.58|-50.06\nVarre-Sai|RJ|-20.93|-41.87\nS\xE3o Rom\xE3o|MG|-16.36|-45.07\nVila Nova dos Mart\xEDrios|MA|-5.19|-48.13\nIrani|SC|-27.03|-51.9\nS\xE3o Domingos|SE|-10.79|-37.57\nFlor\xE2nia|RN|-6.12|-36.82\nGuaraci|SP|-20.5|-48.94\nVitorino|PR|-26.27|-52.78\nItabirinha|MG|-18.57|-41.23\nArvorezinha|RS|-28.87|-52.18\nCaracol|PI|-9.28|-43.33\nJord\xE2nia|MG|-15.9|-40.18\nRibeir\xE3o Cascalheira|MT|-12.94|-51.82\nTamarana|PR|-23.72|-51.1\nMaxaranguape|RN|-5.52|-35.26\nMirante|BA|-14.24|-40.77\nBonito de Minas|MG|-15.32|-44.75\nS\xE3o Geraldo|MG|-20.93|-42.84\nFeliz Natal|MT|-12.38|-54.92\nMonsenhor Gil|PI|-5.56|-42.61\nArraias|TO|-12.93|-46.94\nVirgin\xF3polis|MG|-18.82|-42.7\nCampo Redondo|RN|-6.24|-36.19\nNovo Oriente de Minas|MG|-17.41|-41.22\nImaculada|PB|-7.39|-37.51\nSanta Terezinha|PE|-7.38|-37.48\nS\xE3o Luiz do Paraitinga|SP|-23.22|-45.31\nSanto Ant\xF4nio das Miss\xF5es|RS|-28.51|-55.23\nItaip\xE9|MG|-17.4|-41.67\nAlvorada do Sul|PR|-22.78|-51.23\nGuadalupe|PI|-6.78|-43.56\nItaueira|PI|-7.6|-43.02\nGovernador Archer|MA|-5.02|-44.28\nSerrano do Maranh\xE3o|MA|-1.85|-45.12\nSucupira do Norte|MA|-6.48|-44.19\nCabeceiras do Piau\xED|PI|-4.48|-42.31\nArau\xE1|SE|-11.26|-37.62\nParamoti|CE|-4.09|-39.24\nS\xE3o Carlos|SC|-27.08|-53.0\nIgarap\xE9 Grande|MA|-4.66|-44.86\nSanta Rosa do Sul|SC|-29.13|-49.71\nCentralina|MG|-18.59|-49.2\nSenador Alexandre Costa|MA|-5.25|-44.05\nCedral|MA|-2.0|-44.53\nRiol\xE2ndia|SP|-19.99|-49.68\nDuque Bacelar|MA|-4.15|-42.95\nPantano Grande|RS|-30.19|-52.37\nJaqueira|PE|-8.73|-35.79\nGuimar\xE3es|MA|-2.13|-44.6\nGeneral Salgado|SP|-20.65|-50.36\nArataca|BA|-15.27|-39.42\nBonito de Santa F\xE9|PB|-7.31|-38.51\nS\xE3o Sebasti\xE3o da Grama|SP|-21.7|-46.82\nBela Vista de Minas|MG|-19.83|-43.09\nIrine\xF3polis|SC|-26.24|-50.8\nCort\xEAs|PE|-8.47|-35.55\nGodofredo Viana|MA|-1.4|-45.78\nDores de Campos|MG|-21.11|-44.02\nSalto do Jacu\xED|RS|-29.1|-53.21\nIpupiara|BA|-11.82|-42.62\nFronteiras|PI|-7.08|-40.61\nGetulina|SP|-21.8|-49.93\nCajapi\xF3|MA|-2.87|-44.67\nVarzedo|BA|-12.97|-39.39\nSanto Ant\xF4nio do Jacinto|MG|-16.53|-40.18\nTriunfo|PB|-6.57|-38.6\nBom Jesus|RN|-5.99|-35.58\nUra\xED|PR|-23.2|-50.79\nIaciara|GO|-14.1|-46.63\nNovo Lino|AL|-8.94|-35.66\nParnagu\xE1|PI|-10.22|-44.63\nGrossos|RN|-4.98|-37.16\nFirmin\xF3polis|GO|-16.58|-50.3\nVera Cruz|SP|-22.22|-49.82\nAbaiara|CE|-7.35|-39.04\nCarlinda|MT|-9.95|-55.84\nCara\xEDbas|BA|-14.72|-41.26\nJuripiranga|PB|-7.36|-35.23\nGuiratinga|MT|-16.35|-53.76\nPalm\xE1cia|CE|-4.14|-38.84\nArei\xF3polis|SP|-22.67|-48.67\nS\xE3o Sebasti\xE3o do Maranh\xE3o|MG|-18.09|-42.57\nMurici dos Portelas|PI|-3.32|-42.09\nMonda\xED|SC|-27.1|-53.4\nChupinguaia|RO|-12.56|-60.89\nS\xE3o Tom\xE9|RN|-5.96|-36.08\nMauril\xE2ndia|GO|-17.97|-50.34\n\xC1guia Branca|ES|-18.98|-40.74\nPorto Xavier|RS|-27.91|-55.14\nManduri|SP|-23.01|-49.32\nGuia Lopes da Laguna|MS|-21.46|-56.11\nAramari|BA|-12.09|-38.5\nBananal|SP|-22.68|-44.33\nLajes|RN|-5.69|-36.25\nBeneditinos|PI|-5.46|-42.36\nS\xE3o Jo\xE3o do Para\xEDso|MA|-6.46|-47.06\nPorto Esperidi\xE3o|MT|-15.86|-58.46\nCampo Grande|RN|-5.86|-37.31\nVale do Sol|RS|-29.6|-52.68\nPrimeiro de Maio|PR|-22.85|-51.03\nJuruena|MT|-10.32|-58.36\nCambira|PR|-23.59|-51.58\nApi\xFAna|SC|-27.04|-49.39\nCachoeira Grande|MA|-2.93|-44.05\nCotrigua\xE7u|MT|-9.86|-58.42\nRibeir\xE3o do Largo|BA|-15.45|-40.74\nCarnaubais|RN|-5.34|-36.83\nBom Jesus da Serra|BA|-14.37|-40.51\nIbitirama|ES|-20.55|-41.67\nCarmo do Rio Verde|GO|-15.35|-49.71\nSetubinha|MG|-17.6|-42.16\nAnam\xE3|AM|-3.57|-61.4\nRonda Alta|RS|-27.78|-52.81\nS\xE3o Jo\xE3o da Baliza|RR|0.95|-59.91\nNeves Paulista|SP|-20.84|-49.64\nCampos de J\xFAlio|MT|-13.72|-59.29\nLav\xEDnia|SP|-21.16|-51.04\nRedentora|RS|-27.66|-53.64\nJucuru\xE7u|BA|-16.85|-40.16\nNhandeara|SP|-20.69|-50.04\nMariluz|PR|-24.01|-53.14\nBarrac\xE3o|PR|-26.25|-53.63\nB\xE1lsamo|SP|-20.73|-49.59\nGuaraciaba|MG|-20.57|-43.01\nDois Riachos|AL|-9.38|-37.1\nTabapor\xE3|MT|-11.3|-56.83\nJord\xE3o|AC|-9.19|-71.95\nNova Veneza|GO|-16.37|-49.32\nPaulo Lopes|SC|-27.96|-48.69\nSanta Maria do Oeste|PR|-24.94|-51.87\nNova Bassano|RS|-28.73|-51.71\nWagner|BA|-12.28|-41.17\nCampo Er\xEA|SC|-26.39|-53.09\nNova Floresta|PB|-6.45|-36.21\nQuixabeira|BA|-11.4|-40.12\nBranquinha|AL|-9.23|-36.02\nAlto Piquiri|PR|-24.02|-53.44\nDumont|SP|-21.23|-47.98\nChapada do Norte|MG|-17.09|-42.54\nNova Ubirat\xE3|MT|-12.98|-55.26\nVentania|PR|-24.25|-50.24\nIpor\xE3 do Oeste|SC|-26.99|-53.54\nPureza|RN|-5.46|-35.56\nChapada|RS|-28.06|-53.07\nFlexeiras|AL|-9.27|-35.71\nBa\xEDa da Trai\xE7\xE3o|PB|-6.69|-34.94\nCavalcante|GO|-13.8|-47.46\nAnt\xF4nio Jo\xE3o|MS|-22.19|-55.95\nFontoura Xavier|RS|-28.98|-52.34\nMaravilha|AL|-9.23|-37.35\nPalhano|CE|-4.74|-37.97\nCasca|RS|-28.56|-51.98\nEstrela d'Oeste|SP|-20.29|-50.4\nMau\xE1 da Serra|PR|-23.9|-51.23\nLago do Junco|MA|-4.61|-45.05\nPalmares Paulista|SP|-21.09|-48.8\nMirante da Serra|RO|-11.03|-62.67\nAn\xEDsio de Abreu|PI|-9.19|-43.05\nBerilo|MG|-16.96|-42.46\nAra\xFAjos|MG|-19.94|-45.17\nCarneirinho|MG|-19.7|-50.69\nDouradina|PR|-23.38|-53.29\nIpiranga do Piau\xED|PI|-6.82|-41.74\nSigefredo Pacheco|PI|-4.92|-41.73\nGuatamb\xFA|SC|-27.13|-52.79\nJequi\xE1 da Praia|AL|-10.01|-36.01\nFerros|MG|-19.23|-43.02\nCristais Paulista|SP|-20.4|-47.42\nJaborandi|BA|-13.61|-44.43\nS\xE3o Jorge d'Oeste|PR|-25.71|-52.92\nSebasti\xE3o Laranjeiras|BA|-14.57|-42.94\n\xC1gua Branca|PB|-7.51|-37.64\nIn\xE1cio Martins|PR|-25.57|-51.08\nPraia Norte|TO|-5.39|-47.81\nParanacity|PR|-22.93|-52.15\nTeixeira Soares|PR|-25.37|-50.46\nMarca\xE7\xE3o|PB|-6.77|-35.01\nPau Brasil|BA|-15.46|-39.65\nNossa Senhora Aparecida|SE|-10.39|-37.45\nMata Verde|MG|-15.69|-40.74\nTreze T\xEDlias|SC|-27.0|-51.41\nS\xE3o Sebasti\xE3o do Oeste|MG|-20.28|-45.01\nIlha Grande|PI|-2.86|-41.82\nPetrolina de Goi\xE1s|GO|-16.1|-49.34\nPiranguinho|MG|-22.39|-45.53\nPorto de Pedras|AL|-9.16|-35.3\nSab\xE1udia|PR|-23.32|-51.55\nJanda\xEDra|BA|-11.56|-37.79\nRos\xE1rio do Catete|SE|-10.69|-37.04\nCorumba\xEDba|GO|-18.14|-48.56\nTorrinha|SP|-22.42|-48.17\nVerdejante|PE|-7.92|-38.97\nMarcion\xEDlio Souza|BA|-13.01|-40.53\nItapebi|BA|-15.96|-39.53\nNova Europa|SP|-21.78|-48.57\nJaparatinga|AL|-9.09|-35.26\nS\xE3o Domingos|GO|-13.62|-46.74\nBarros Cassal|RS|-29.09|-52.58\nJapur\xE1|AM|-1.88|-66.93\nBrej\xE3o|PE|-9.03|-36.57\nMorada Nova de Minas|MG|-18.6|-45.36\nPirpirituba|PB|-6.78|-35.49\nGa\xFAcha do Norte|MT|-13.24|-53.08\nJapur\xE1|PR|-23.47|-52.56\nPeixe|TO|-12.03|-48.54\nJuru|PB|-7.53|-37.81\nAnt\xF4nio Dias|MG|-19.65|-42.87\nPrados|MG|-21.06|-44.08\nEntre-Iju\xEDs|RS|-28.37|-54.27\nBrejo de Areia|MA|-4.33|-45.58\nBrejol\xE2ndia|BA|-12.48|-43.97\nPenaforte|CE|-7.82|-39.07\nCachoeira de Paje\xFA|MG|-15.97|-41.49\nS\xE3o Domingos|SC|-26.55|-52.53\nArceburgo|MG|-21.36|-46.94\nCachoeira dos \xCDndios|PB|-6.91|-38.68\nRin\xF3polis|SP|-21.73|-50.72\nCerro Grande do Sul|RS|-30.59|-51.74\nDom Inoc\xEAncio|PI|-9.01|-41.97\nMaraial|PE|-8.79|-35.83\nVila Pav\xE3o|ES|-18.61|-40.61\nHercul\xE2ndia|SP|-22.0|-50.39\nMontes Altos|MA|-5.83|-47.07\nLamar\xE3o|BA|-11.77|-38.89\nCl\xE1udia|MT|-11.51|-54.88\nIbirapu\xE3|BA|-17.68|-40.11\nArmaz\xE9m|SC|-28.24|-49.02\nIpui\xFAna|MG|-22.1|-46.19\nS\xE3o Jo\xE3o do Sul|SC|-29.22|-49.81\nUmbuzeiro|PB|-7.69|-35.66\nLu\xEDs Gomes|RN|-6.41|-38.39\nRio das Flores|RJ|-22.17|-43.59\nSantana do Manhua\xE7u|MG|-20.1|-41.93\nRondon|PR|-23.41|-52.77\nLagoa Grande|MG|-17.83|-46.52\nTerra Nova|PE|-8.22|-39.38\nItapu\xE3 do Oeste|RO|-9.2|-63.18\nSalto Grande|SP|-22.89|-49.98\nMonte Carlo|SC|-27.22|-50.98\nCajobi|SP|-20.88|-48.81\nCarneiros|AL|-9.48|-37.38\nS\xE3o Francisco do Brej\xE3o|MA|-5.13|-47.39\nLimeira do Oeste|MG|-19.55|-50.58\nCoqueiral|MG|-21.19|-45.44\nVicentin\xF3polis|GO|-17.73|-49.8\nDeputado Irapuan Pinheiro|CE|-5.91|-39.26\nBuen\xF3polis|MG|-17.87|-44.18\nRodeiro|MG|-21.2|-42.86\nFaro|PA|-2.17|-56.74\nVirg\xEDnia|MG|-22.33|-45.1\nColm\xE9ia|TO|-8.72|-48.76\nIcara\xEDma|PR|-23.39|-53.62\nRafard|SP|-23.01|-47.53\nPirip\xE1|BA|-14.94|-41.72\nTasso Fragoso|MA|-8.47|-45.75\nAlvorada|TO|-12.48|-49.12\nCaputira|MG|-20.17|-42.27\nLeopoldo de Bulh\xF5es|GO|-16.62|-48.74\nBa\xEDa Formosa|RN|-6.37|-35.0\nCatarina|CE|-6.12|-39.87\nCaturama|BA|-13.32|-42.29\nRinc\xE3o|SP|-21.59|-48.07\nCampo Novo de Rond\xF4nia|RO|-10.57|-63.63\nQueluz|SP|-22.53|-44.78\nArapor\xE3|MG|-18.44|-49.18\nMilagres do Maranh\xE3o|MA|-3.57|-42.61\nS\xE3o Domingos do Norte|ES|-19.15|-40.63\nComendador Levy Gasparian|RJ|-22.04|-43.21\nSanta Isabel do Iva\xED|PR|-23.0|-53.2\nSantan\xF3polis|BA|-12.03|-38.87\nMontes Claros de Goi\xE1s|GO|-16.01|-51.4\nCosmorama|SP|-20.48|-49.78\nPereiras|SP|-23.08|-47.97\nBelo Vale|MG|-20.41|-44.03\nMaiquinique|BA|-15.62|-40.26\nAratu\xEDpe|BA|-13.07|-39.0\nCampos Lindos|TO|-7.99|-46.86\nDobrada|SP|-21.52|-48.39\nMalhada de Pedras|BA|-14.38|-41.88\nUr\xE2nia|SP|-20.25|-50.65\nPalmeira d'Oeste|SP|-20.41|-50.76\nPiedade de Caratinga|MG|-19.76|-42.08\nCalif\xF3rnia|PR|-23.66|-51.36\nLontra|MG|-15.9|-44.31\nLago dos Rodrigues|MA|-4.61|-44.98\nMiradouro|MG|-20.89|-42.35\nNatividade|TO|-11.7|-47.72\nQueimada Nova|PI|-8.57|-41.41\nNatuba|PB|-7.64|-35.56\nCampo Florido|MG|-19.76|-48.57\nA\xE7ucena|MG|-19.07|-42.54\nMonte Alegre do Sul|SP|-22.68|-46.68\nMatias Cardoso|MG|-14.86|-43.91\nMulungu|PB|-7.03|-35.46\nBodoquena|MS|-20.54|-56.71\nGuimar\xE2nia|MG|-18.84|-46.79\nRiacho dos Machados|MG|-16.01|-43.05\nPotengi|CE|-7.09|-40.02\nRiachuelo|SE|-10.73|-37.2\nDelfin\xF3polis|MG|-20.35|-46.85\nJanu\xE1rio Cicco|RN|-6.17|-35.62\nSanta Cruz de Monte Castelo|PR|-22.96|-53.29\nCatu\xEDpe|RS|-28.26|-54.01\nAraric\xE1|RS|-29.62|-50.93\nOriz\xE2nia|MG|-20.51|-42.2\nMarcol\xE2ndia|PI|-7.44|-40.66\nSatubinha|MA|-4.05|-45.25\nPimenta|MG|-20.48|-45.8\nMartins Soares|MG|-20.25|-41.88\nRiacho dos Cavalos|PB|-6.44|-37.65\nSanta B\xE1rbara do Leste|MG|-19.98|-42.15\nInoc\xEAncia|MS|-19.73|-51.93\nMaril\xE2ndia do Sul|PR|-23.74|-51.31\nPaula C\xE2ndido|MG|-20.88|-42.98\nBel\xE1gua|MA|-3.15|-43.51\nNossa Senhora dos Rem\xE9dios|PI|-3.98|-42.62\nAscurra|SC|-26.95|-49.38\nPassa Tempo|MG|-20.65|-44.49\nSelv\xEDria|MS|-20.36|-51.42\nS\xE3o Jos\xE9 do Cerrito|SC|-27.66|-50.57\nS\xE3o Miguel dos Milagres|AL|-9.26|-35.38\nPraia Grande|SC|-29.19|-49.95\nApiac\xE1s|MT|-9.54|-57.46\nS\xE3o Domingos|BA|-11.46|-39.53\nPeixe-Boi|PA|-1.19|-47.32\nSinimbu|RS|-29.54|-52.53\nBrasileira|PI|-4.13|-41.79\nRio Novo|MG|-21.46|-43.12\nIpiranga do Norte|MT|-12.24|-56.15\nLagoa Salgada|RN|-6.12|-35.47\nTombos|MG|-20.91|-42.02\nDescanso|SC|-26.83|-53.5\nMataraca|PB|-6.6|-35.05\nAssis Brasil|AC|-10.93|-69.57\nSobrado|PB|-7.14|-35.24\nCardeal da Silva|BA|-11.95|-37.95\nNova Campina|SP|-24.12|-48.9\nAlvorada do Norte|GO|-14.48|-46.49\nAlto Jequitib\xE1|MG|-20.42|-41.97\nLaurentino|SC|-27.22|-49.73\nCarbonita|MG|-17.53|-43.01\nSanto Ant\xF4nio do Aracangu\xE1|SP|-20.93|-50.5\nNova Santa Rosa|PR|-24.47|-53.96\nCampo Limpo de Goi\xE1s|GO|-16.3|-49.09\nFrancisco Alves|PR|-24.07|-53.85\nAruan\xE3|GO|-14.92|-51.08\nMonsenhor Paulo|MG|-21.76|-45.54\nReden\xE7\xE3o do Gurgu\xE9ia|PI|-9.48|-44.58\nSanta Rita de Caldas|MG|-22.03|-46.34\nMora\xFAjo|CE|-3.46|-40.68\nTuparendi|RS|-27.76|-54.48\nPrat\xE1polis|MG|-20.74|-46.86\nTomazina|PR|-23.78|-49.95\nOlho d'\xC1gua do Casado|AL|-9.5|-37.83\nS\xE3o Pedro do Iva\xED|PR|-23.86|-51.86\nIlha das Flores|SE|-10.44|-36.55\nS\xE3o Jo\xE3o do Arraial|PI|-3.82|-42.45\nMamba\xED|GO|-14.48|-46.12\nNova Monte Verde|MT|-10.0|-57.53\nFlorestal|MG|-19.89|-44.43\nItaquara|BA|-13.45|-39.94\nLagoa Alegre|PI|-4.52|-42.63\nTheobroma|RO|-10.25|-62.35\nCongonhinhas|PR|-23.55|-50.56\nJapor\xE3|MS|-23.89|-54.41\nAmap\xE1|AP|2.05|-50.8\nMagalh\xE3es Barata|PA|-0.8|-47.6\nPocrane|MG|-19.62|-41.63\nQuatigu\xE1|PR|-23.57|-49.92\nBom Retiro|SC|-27.8|-49.49\nMartins|RN|-6.08|-37.91\nNazareno|MG|-21.22|-44.61\nSaltinho|SP|-22.84|-47.68\nGado Bravo|PB|-7.58|-35.79\nJaponvar|MG|-15.99|-44.28\nVista Alegre do Alto|SP|-21.17|-48.63\nNova Gl\xF3ria|GO|-15.14|-49.57\nPains|MG|-20.37|-45.66\nFrancisco Santos|PI|-6.99|-41.13\nNaz\xE1rio|GO|-16.58|-49.88\nMaracaj\xE1|SC|-28.85|-49.46\nBandeirantes|MS|-19.93|-54.36\nGovernador Jorge Teixeira|RO|-10.61|-62.74\nTerez\xF3polis de Goi\xE1s|GO|-16.39|-49.08\nAnita Garibaldi|SC|-27.69|-51.13\nSanta Cruz de Minas|MG|-21.12|-44.22\nV\xE1rzea do Po\xE7o|BA|-11.53|-40.31\nDesterro|PB|-7.29|-37.09\nIaras|SP|-22.87|-49.16\nCezarina|GO|-16.97|-49.78\nFrei Inoc\xEAncio|MG|-18.56|-41.91\nCarna\xFAba dos Dantas|RN|-6.55|-36.59\nArealva|SP|-22.03|-48.91\nCampo Grande|AL|-9.96|-36.79\nNova F\xE1tima|BA|-11.6|-39.63\nSanta B\xE1rbara do Sul|RS|-28.37|-53.25\nTuparetama|PE|-7.6|-37.32\nAparecida|PB|-6.78|-38.08\nItanhang\xE1|MT|-12.23|-56.65\nS\xE3o Vicente do Sul|RS|-29.69|-54.68\nPaulic\xE9ia|SP|-21.32|-51.83\nBarra de Santana|PB|-7.52|-35.99\nCajueiro da Praia|PI|-2.93|-41.34\nReduto|MG|-20.24|-41.98\nCruzeta|RN|-6.41|-36.78\nAragua\xE7u|TO|-12.93|-49.82\nPlanaltino|BA|-13.26|-40.37\nCoronel Murta|MG|-16.61|-42.18\nFeira Nova do Maranh\xE3o|MA|-6.97|-46.68\nSerran\xF3polis|GO|-18.31|-51.96\nS\xE3o Domingos do Azeit\xE3o|MA|-6.81|-44.65\nMadeiro|PI|-3.49|-42.5\nTiros|MG|-19.0|-45.96\nItobi|SP|-21.73|-46.97\nMorpar\xE1|BA|-11.56|-43.28\nVale do Anari|RO|-9.86|-62.19\nAraponga|MG|-20.67|-42.52\nTup\xE3ssi|PR|-24.59|-53.51\nColuna|MG|-18.23|-42.84\nVera Cruz do Oeste|PR|-25.06|-53.88\nGuajeru|BA|-14.55|-41.94\nDourado|SP|-22.1|-48.32\nPaverama|RS|-29.55|-51.73\nS\xE3o Jos\xE9 da Barra|MG|-20.72|-46.31\nTangar\xE1|SC|-27.1|-51.25\nPav\xE3o|MG|-17.43|-41.0\nDelfim Moreira|MG|-22.5|-45.28\nIpua\xE7u|SC|-26.64|-52.46\nItapirapu\xE3|GO|-15.82|-50.61\nFigueira|PR|-23.85|-50.4\nBarra de S\xE3o Miguel|AL|-9.84|-35.91\nLagoa de Dentro|PB|-6.67|-35.37\nTapira\xED|SP|-23.96|-47.51\nIpumirim|SC|-27.08|-52.13\nJati|CE|-7.68|-39.0\nSanta Cec\xEDlia|PB|-7.74|-35.88\nFormoso|MG|-14.94|-46.24\nJuarez T\xE1vora|PB|-7.17|-35.57\nSanclerl\xE2ndia|GO|-16.2|-50.31\nMarcelino Vieira|RN|-6.28|-38.16\nVer\xEA|PR|-25.88|-52.91\nNova Itarana|BA|-13.02|-40.07\nRio do Oeste|SC|-27.2|-49.8\nEl\xEDsio Medrado|BA|-12.94|-39.52\nTuneiras do Oeste|PR|-23.86|-52.88\nSanto Ant\xF4nio de Goi\xE1s|GO|-16.48|-49.31\nDurand\xE9|MG|-20.21|-41.8\nS\xE3o Sebasti\xE3o da Amoreira|PR|-23.47|-50.76\nMuribeca|SE|-10.43|-36.96\nTiradentes|MG|-21.11|-44.17\nJa\xE7an\xE3|RN|-6.42|-36.2\nPalmitinho|RS|-27.36|-53.56\nBrejinho|PE|-7.35|-37.29\nBrejo Grande|SE|-10.43|-36.46\nBoa Vista da Aparecida|PR|-25.43|-53.41\nPirambu|SE|-10.72|-36.85\nSanta Terezinha|SC|-26.78|-50.01\nS\xE3o Sebasti\xE3o do Alto|RJ|-21.96|-42.13\nTanquinho|BA|-11.97|-39.1\nIc\xE9m|SP|-20.34|-49.19\nSiriri|SE|-10.6|-37.11\nSenador Firmino|MG|-20.92|-43.09\nNovo Horizonte do Oeste|RO|-11.7|-62.0\nCorumbiara|RO|-12.96|-60.89\nTerra Roxa|SP|-20.79|-48.33\nCamutanga|PE|-7.41|-35.27\nS\xE3o Jo\xE3o Batista do Gl\xF3ria|MG|-20.64|-46.51\nJaci|SP|-20.88|-49.58\nDesterro de Entre Rios|MG|-20.66|-44.33\nCandeal|BA|-11.8|-39.12\nMunhoz|MG|-22.61|-46.36\nOuri\xE7angas|BA|-12.02|-38.62\nGuamiranga|PR|-25.19|-50.8\nBom Jesus do Araguaia|MT|-12.17|-51.5\nOuro Verde|SP|-21.49|-51.7\nJuranda|PR|-24.42|-52.84\nDom Aquino|MT|-15.81|-54.92\nS\xE3o Rafael|RN|-5.8|-36.88\nEuclides da Cunha Paulista|SP|-22.55|-52.59\nJauru|MT|-15.33|-58.87\nPonte Alta do Tocantins|TO|-10.75|-47.53\nIsa\xEDas Coelho|PI|-7.74|-41.67\nPortalegre|RN|-6.02|-37.99\nGlorinha|RS|-29.88|-50.77\nAngel\xE2ndia|MG|-17.73|-42.26\nS\xE3o Luiz|RR|1.01|-60.04\nCubati|PB|-6.87|-36.36\nSanta Luzia D'Oeste|RO|-11.91|-61.78\nAmetista do Sul|RS|-27.36|-53.18\nRegin\xF3polis|SP|-21.89|-49.23\nBorraz\xF3polis|PR|-23.94|-51.59\nMoema|MG|-19.84|-45.41\nSerrania|MG|-21.54|-46.04\nCampo Alegre de Goi\xE1s|GO|-17.64|-47.78\nGuiricema|MG|-21.01|-42.72\nTocant\xEDnia|TO|-9.56|-48.37\nItai\xE7aba|CE|-4.67|-37.83\nSerra Negra do Norte|RN|-6.66|-37.4\nTacima|PB|-6.49|-35.64\nTrindade do Sul|RS|-27.52|-52.9\nFilad\xE9lfia|TO|-7.33|-47.5\nBoa Vista do Gurupi|MA|-1.78|-46.3\nVertente do L\xE9rio|PE|-7.77|-35.85\nBom Jardim de Goi\xE1s|GO|-16.21|-52.17\nFormosa do Oeste|PR|-24.3|-53.31\nCachoeira Dourada|GO|-18.49|-49.48\nMonsenhor Hip\xF3lito|PI|-6.99|-41.03\nAlto Rio Novo|ES|-19.06|-41.02\nConfins|MG|-19.63|-43.99\nCordeiros|BA|-15.04|-41.93\nMonte Castelo|SC|-26.46|-50.23\nGeneral C\xE2mara|RS|-29.9|-51.76\nIep\xEA|SP|-22.66|-51.08\nSanta Terezinha|MT|-10.47|-50.51\nVerdel\xE2ndia|MG|-15.58|-43.61\nGuarani|MG|-21.36|-43.03\nJeric\xF3|PB|-6.55|-37.8\nBonfim|MG|-20.33|-44.24\nPalma Sola|SC|-26.35|-53.28\nCampo do Tenente|PR|-25.98|-49.68\nCabeceiras|GO|-15.8|-46.93\nAnauril\xE2ndia|MS|-22.19|-52.72\nLajedo do Tabocal|BA|-13.47|-40.22\nNova Reden\xE7\xE3o|BA|-12.81|-41.07\nCampo Largo do Piau\xED|PI|-3.8|-42.64\nJacu\xED|MG|-21.01|-46.74\nOuvidor|GO|-18.23|-47.84\nS\xE3o Jos\xE9 da Bela Vista|SP|-20.59|-47.64\nCurral de Dentro|MG|-15.93|-41.86\nMinas do Le\xE3o|RS|-30.13|-52.04\nSalete|SC|-26.98|-50.0\nRiachuelo|RN|-5.82|-35.82\nBaba\xE7ul\xE2ndia|TO|-7.21|-47.76\nItau\xE7u|GO|-16.2|-49.61\nTreze de Maio|SC|-28.55|-49.16\nPedro Os\xF3rio|RS|-31.86|-52.82\nS\xE3o Mamede|PB|-6.92|-37.1\nSanta Cruz do Arari|PA|-0.66|-49.18\nToledo|MG|-22.74|-46.37\nAriranha|SP|-21.19|-48.79\nIra\xED|RS|-27.2|-53.25\nArneiroz|CE|-6.32|-40.17\nInimutaba|MG|-18.73|-44.36\nRibamar Fiquene|MA|-5.93|-47.39\nPedra Bonita|MG|-20.52|-42.33\nPerobal|PR|-23.89|-53.41\nTrombudo Central|SC|-27.3|-49.79\nLagoa de Pedras|RN|-6.15|-35.43\nAssun\xE7\xE3o do Piau\xED|PI|-5.87|-41.04\nBaldim|MG|-19.28|-43.96\nJatob\xE1|MA|-5.82|-44.22\nMaquin\xE9|RS|-29.68|-50.21\nLaje do Muria\xE9|RJ|-21.21|-42.13\nMacaubal|SP|-20.8|-49.97\nTarrafas|CE|-6.68|-39.75\nRibeir\xE3o Grande|SP|-24.1|-48.37\nNuporanga|SP|-20.73|-47.74\nJussiape|BA|-13.52|-41.59\nCara\xE1|RS|-29.79|-50.43\nSericita|MG|-20.47|-42.48\nItaj\xE1|RN|-5.64|-36.87\nSenador S\xE1|CE|-3.35|-40.47\nSantana do S\xE3o Francisco|SE|-10.29|-36.61\nGuarani das Miss\xF5es|RS|-28.15|-54.56\nMajor Vieira|SC|-26.37|-50.33\nInconfidentes|MG|-22.31|-46.33\nCordisburgo|MG|-19.12|-44.32\nSanta F\xE9 do Araguaia|TO|-7.16|-48.72\nMaravilhas|MG|-19.51|-44.68\nAlto Paraguai|MT|-14.51|-56.48\nTimb\xF3 Grande|SC|-26.61|-50.66\nBuriti dos Montes|PI|-5.31|-41.09\nS\xE3o Gon\xE7alo do Abaet\xE9|MG|-18.33|-45.83\nCacimbas|PB|-7.21|-37.06\nAntonina do Norte|CE|-6.77|-39.99\nJaraguari|MS|-20.14|-54.4\nGuatapar\xE1|SP|-21.49|-48.04\nIra\xED de Minas|MG|-18.98|-47.46\nBilac|SP|-21.4|-50.47\nSud Mennucci|SP|-20.69|-50.92\n\xC1guas da Prata|SP|-21.93|-46.72\nApiac\xE1|ES|-21.15|-41.57\n\xC1guas de Santa B\xE1rbara|SP|-22.88|-49.24\nCristal|RS|-31.0|-52.04\nGuara\xE7a\xED|SP|-21.03|-51.21\nMuniz Ferreira|BA|-13.01|-39.11\nMarilena|PR|-22.73|-53.04\nCapim|PB|-6.92|-35.17\nGuaraque\xE7aba|PR|-25.31|-48.32\nPontal do Araguaia|MT|-15.93|-52.33\nMacurur\xE9|BA|-9.16|-39.05\nPardinho|SP|-23.08|-48.37\nAreial|PB|-7.05|-35.93\nC\xF4nego Marinho|MG|-15.29|-44.42\nCristal\xE2ndia do Piau\xED|PI|-10.64|-45.19\nJangada|MT|-15.23|-56.49\nPium|TO|-10.44|-49.19\nAba\xEDra|BA|-13.25|-41.66\nLassance|MG|-17.89|-44.57\nNazarezinho|PB|-6.91|-38.32\nCastanheira|MT|-11.13|-58.61\nPaulo de Faria|SP|-20.03|-49.4\nEsperantina|TO|-5.37|-48.54\nAmap\xE1 do Maranh\xE3o|MA|-1.68|-46.0\nIt\xE1|SC|-27.29|-52.32\nS\xE3o Roque de Minas|MG|-20.25|-46.36\nLu\xEDs Domingues|MA|-1.27|-45.87\nPara\xED|RS|-28.6|-51.79\nIjaci|MG|-21.17|-44.92\nParanaiguara|GO|-18.91|-50.65\nPedrinhas|SE|-11.19|-37.68\nPau D'Arco|PA|-1.6|-46.93\nLavrinhas|SP|-22.57|-44.9\nMonteir\xF3polis|AL|-9.6|-37.25\nDivin\xF3polis do Tocantins|TO|-9.8|-49.22\nIbirajuba|PE|-8.58|-36.18\nS\xE3o Pedro do Turvo|SP|-22.75|-49.74\nCampo Belo do Sul|SC|-27.9|-50.76\nBar\xE3o de Cotegipe|RS|-27.62|-52.38\nS\xE3o Jos\xE9 de Ub\xE1|RJ|-21.37|-41.95\nSanto Ant\xF4nio do Pinhal|SP|-22.83|-45.66\nS\xE3o Miguel de Taipu|PB|-7.25|-35.2\nVarj\xE3o de Minas|MG|-18.37|-46.03\nAugusto Pestana|RS|-28.52|-53.99\nJ\xF3ia|RS|-28.64|-54.11\nCoimbra|MG|-20.85|-42.8\nLavras do Sul|RS|-30.81|-53.89\nGuidoval|MG|-21.16|-42.79\nTeodoro Sampaio|BA|-12.29|-38.63\nDoutor Severiano|RN|-6.08|-38.38\nQuintana|SP|-22.07|-50.31\nDirceu Arcoverde|PI|-9.34|-42.43\nS\xE3o Jos\xE9 da Lagoa Tapada|PB|-6.94|-38.16\nCatuji|MG|-17.3|-41.53\nJovi\xE2nia|GO|-17.8|-49.62\nImb\xE9 de Minas|MG|-19.6|-41.97\nAurora|SC|-27.31|-49.63\nLuisburgo|MG|-20.45|-42.1\nNovo S\xE3o Joaquim|MT|-14.91|-53.02\nAlfredo Vasconcelos|MG|-21.15|-43.77\nAlpestre|RS|-27.25|-53.03\nAbati\xE1|PR|-23.3|-50.31\nLajeado Novo|MA|-6.19|-47.03\nClaro dos Po\xE7\xF5es|MG|-17.08|-44.21\nPint\xF3polis|MG|-16.06|-45.14\nCentral do Maranh\xE3o|MA|-2.2|-44.83\nMaetinga|BA|-14.66|-41.49\nGranito|PE|-7.71|-39.62\nSanta Rosa do Purus|AC|-9.45|-70.49\nGovernador Luiz Rocha|MA|-5.48|-44.08\nS\xE3o Miguel das Miss\xF5es|RS|-28.56|-54.56\n\xC1guas Mornas|SC|-27.7|-48.82\nItamari|BA|-13.78|-39.68\nFerreira Gomes|AP|0.86|-51.18\nSalvador do Sul|RS|-29.44|-51.51\nTaquariva\xED|SP|-23.92|-48.69\nFaina|GO|-15.45|-50.36\nSanta Rita do Pardo|MS|-21.3|-52.83\nLind\xF3ia|SP|-22.52|-46.65\nNatividade da Serra|SP|-23.37|-45.45\nMaraj\xE1 do Sena|MA|-4.63|-45.45\nAraguapaz|GO|-15.09|-50.63\nSanta L\xFAcia|SP|-21.68|-48.09\nBoa Hora|PI|-4.41|-42.14\nNova F\xE1tima|PR|-23.43|-50.57\nBar\xE3o de Melga\xE7o|MT|-16.21|-55.96\nEsp\xEDrito Santo do Dourado|MG|-22.05|-45.95\nS\xE3o Pedro dos Ferros|MG|-20.17|-42.53\nBoa Vista do Buric\xE1|RS|-27.67|-54.11\nMeleiro|SC|-28.82|-49.64\nSantana da Boa Vista|RS|-30.87|-53.11\nIrapuru|SP|-21.57|-51.35\nIpigu\xE1|SP|-20.66|-49.38\nS\xE3o Tom\xE9 das Letras|MG|-21.72|-44.98\nPalmeirina|PE|-9.01|-36.32\nPalmeir\xF3polis|TO|-13.04|-48.4\nOuro Verde do Oeste|PR|-24.79|-53.9\nApuarema|BA|-13.85|-39.75\nCatigu\xE1|SP|-21.05|-49.06\nS\xE3o Jo\xE3o do Oriente|MG|-19.34|-42.16\nS\xE3o Jos\xE9 dos Bas\xEDlios|MA|-5.05|-44.58\nClementina|SP|-21.56|-50.45\nSanta Clara do Sul|RS|-29.47|-52.08\nArandu|SP|-23.14|-49.05\nNova Lacerda|MT|-14.47|-59.6\nCol\xF4nia do Piau\xED|PI|-7.23|-42.18\nJuti|MS|-22.86|-54.61\nSanta Luzia do Norte|AL|-9.6|-35.82\nPalestina do Par\xE1|PA|-5.74|-48.32\nCarea\xE7u|MG|-22.04|-45.7\nOuro|SC|-27.34|-51.62\nTr\xEAs Fronteiras|SP|-20.23|-50.89\nFrancisco Badar\xF3|MG|-16.99|-42.36\nCasserengue|PB|-6.78|-35.82\nAnt\xF4nio Olinto|PR|-25.98|-50.2\nMacambira|SE|-10.66|-37.54\nLivramento|PB|-7.37|-36.95\nLaguna Carap\xE3|MS|-22.54|-55.15\nSantana de Pirapama|MG|-19.0|-44.04\nIpe\xFAna|SP|-22.44|-47.72\nAlpercata|MG|-18.97|-41.97\nJunco do Serid\xF3|PB|-6.99|-36.72\nMariz\xF3polis|PB|-6.83|-38.35\nPetrol\xE2ndia|SC|-27.53|-49.69\nAngical do Piau\xED|PI|-6.09|-42.74\nBom Jardim de Minas|MG|-21.95|-44.19\nPedra Lavrada|PB|-6.75|-36.48\nS\xE3o Jos\xE9 do Ouro|RS|-27.77|-51.6\nTuiuti|SP|-22.82|-46.69\nSerra Redonda|PB|-7.19|-35.68\nAltaneira|CE|-7.0|-39.74\nPil\xF5es|PB|-6.87|-35.61\nSanta Rita de Minas|MG|-19.88|-42.14\nBrejo Grande do Araguaia|PA|-5.7|-48.41\nUmari|CE|-6.64|-38.7\nItacaj\xE1|TO|-8.39|-47.77\nMontezuma|MG|-15.17|-42.49\nRenascen\xE7a|PR|-26.16|-52.97\nSanto Ant\xF4nio da Alegria|SP|-21.09|-47.15\nIrapu\xE3|SP|-21.28|-49.42\nGeneral Sampaio|CE|-4.04|-39.45\nS\xE3o Vicente de Minas|MG|-21.7|-44.44\nManoel Viana|RS|-29.59|-55.48\nPedro Gomes|MS|-18.1|-54.55\nPiracema|MG|-20.51|-44.48\nDores do Rio Preto|ES|-20.69|-41.84\nEstrela do Sul|MG|-18.74|-47.7\nBarra do Turvo|SP|-24.76|-48.5\nErval Seco|RS|-27.54|-53.5\nCuitegi|PB|-6.89|-35.52\nNova Alian\xE7a|SP|-21.02|-49.5\nConquista|MG|-19.93|-47.55\nAlagoinha do Piau\xED|PI|-7.0|-40.93\nItumirim|MG|-21.32|-44.87\nSerra dos Aimor\xE9s|MG|-17.79|-40.25\nTerezinha|PE|-9.06|-36.63\nNova Tebas|PR|-24.44|-51.95\nFaxinal do Soturno|RS|-29.58|-53.45\nAjuricaba|RS|-28.23|-53.78\nS\xE3o Tom\xE1s de Aquino|MG|-20.78|-47.1\nSanta Filomena do Maranh\xE3o|MA|-5.5|-44.56\nRodeio Bonito|RS|-27.47|-53.17\nRiachinho|MG|-16.23|-45.99\nIbiraiaras|RS|-28.37|-51.64\nMarip\xE1|PR|-24.42|-53.83\nDoverl\xE2ndia|GO|-16.72|-52.32\nCabeceira Grande|MG|-16.03|-47.09\nCampestre|AL|-8.85|-35.57\nCol\xF4mbia|SP|-20.18|-48.69\nVale do Para\xEDso|RO|-10.45|-62.14\nIvat\xE9|PR|-23.41|-53.37\nJussara|PR|-23.62|-52.47\nIguatama|MG|-20.18|-45.71\nPouso Alto|MG|-22.2|-44.97\nSapopema|PR|-23.91|-50.58\nS\xE3o Sebasti\xE3o da Bela Vista|MG|-22.16|-45.75\nTai\xFAva|SP|-21.12|-48.45\nGuaira\xE7\xE1|PR|-22.93|-52.69\nLagoa d'Anta|RN|-6.39|-35.59\nSantana da Vargem|MG|-21.24|-45.5\nQuixaba|PE|-7.71|-37.84\nJanda\xEDra|RN|-5.35|-36.13\nBoqueir\xE3o do Piau\xED|PI|-4.48|-42.12\nNova Porteirinha|MG|-15.8|-43.29\nPedra Bela|SP|-22.79|-46.45\nNova Cantu|PR|-24.67|-52.57\nS\xE3o Jos\xE9 do Piau\xED|PI|-6.87|-41.47\nBarro Duro|PI|-5.82|-42.51\nAnt\xF4nio Martins|RN|-6.21|-37.88\nSanto Ant\xF4nio do Retiro|MG|-15.34|-42.62\nS\xE3o Carlos do Iva\xED|PR|-23.32|-52.48\nMatur\xE9ia|PB|-7.26|-37.35\nNazar\xE9 do Piau\xED|PI|-6.97|-42.68\nNova Ibi\xE1|BA|-13.81|-39.62\nRoque Gonzales|RS|-28.13|-55.03\nPaulo Jacinto|AL|-9.37|-36.37\nS\xE3o Jorge do Patroc\xEDnio|PR|-23.76|-53.88\nDion\xEDsio|MG|-19.84|-42.77\nGuarda-Mor|MG|-17.77|-47.1\nCai\xE7ara|PB|-6.62|-35.46\nMilton Brand\xE3o|PI|-4.68|-41.42\nPinhal\xE3o|PR|-23.8|-50.05\nDenise|MT|-14.73|-57.06\nBom Sucesso|PR|-23.71|-51.77\nPonto Belo|ES|-18.13|-40.55\nLuiziana|PR|-24.29|-52.27\nSales|SP|-21.34|-49.49\nRio do Campo|SC|-26.95|-50.14\nTarabai|SP|-22.3|-51.56\nCondado|PB|-6.9|-37.61\nCapetinga|MG|-20.62|-47.06\nPara\xEDso do Sul|RS|-29.67|-53.14\nPeriquito|MG|-19.16|-42.23\nLagamar|MG|-18.18|-46.81\nAratiba|RS|-27.4|-52.3\nSantana dos Garrotes|PB|-7.38|-37.98\nJambeiro|SP|-23.25|-45.69\nSerrinha|RN|-6.28|-35.5\nRoteiro|AL|-9.84|-35.98\nBet\xE2nia do Piau\xED|PI|-8.14|-40.8\nCocal dos Alves|PI|-3.62|-41.44\nBoa Vista|PB|-7.26|-36.24\nCanitar|SP|-23.0|-49.78\n\xC1gua Doce|SC|-27.0|-51.55\nDivinol\xE2ndia de Minas|MG|-18.8|-42.61\nFelisburgo|MG|-16.63|-40.76\nSanta Albertina|SP|-20.03|-50.73\nIndepend\xEAncia|RS|-27.84|-54.19\nS\xE3o Br\xE1s|AL|-10.11|-36.85\nMachacalis|MG|-17.07|-40.72\nAltamira do Maranh\xE3o|MA|-4.17|-45.47\nMorro do Chap\xE9u do Piau\xED|PI|-3.73|-42.3\nDivisa Alegre|MG|-15.72|-41.35\nNova Uni\xE3o|RO|-10.91|-62.56\nComercinho|MG|-16.3|-41.79\nCondor|RS|-28.21|-53.49\nMonte Alegre de Goi\xE1s|GO|-13.26|-46.89\nGuarant\xE3|SP|-21.89|-49.59\nS\xE3o Vicente|RN|-6.22|-36.68\nFormigueiro|RS|-30.0|-53.5\nMinistro Andreazza|RO|-11.2|-61.52\nDoutor Camargo|PR|-23.56|-52.22\nSenador Amaral|MG|-22.59|-46.18\nAgron\xF4mica|SC|-27.27|-49.71\nS\xE3o Francisco de Goi\xE1s|GO|-15.93|-49.26\nMari\xF3polis|PR|-26.36|-52.55\nVicentina|MS|-22.41|-54.44\nBar\xE3o|RS|-29.37|-51.49\nCocalinho|MT|-14.39|-51.0\nReserva do Igua\xE7u|PR|-25.83|-52.03\nCambar\xE1 do Sul|RS|-29.05|-50.15\nItagimirim|BA|-16.08|-39.61\nS\xE3o Crist\xF3v\xE3o do Sul|SC|-27.27|-50.44\nAlto Horizonte|GO|-14.2|-49.34\nRestinga|SP|-20.61|-47.48\nSanta Maria do Herval|RS|-29.49|-50.99\nAlmas|TO|-11.57|-47.18\nCai\xE7ara do Norte|RN|-5.07|-36.07\nJeceaba|MG|-20.53|-43.99\nFelipe Guerra|RN|-5.59|-37.69\nGoioxim|PR|-25.19|-51.99\nSapuca\xED-Mirim|MG|-22.74|-45.74\nPadre Marcos|PI|-7.35|-40.9\nS\xE3o Jo\xE3o do Oeste|SC|-27.1|-53.6\nInha\xFAma|MG|-19.49|-44.39\nSanto In\xE1cio|PR|-22.7|-51.8\nIbirarema|SP|-22.82|-50.07\nLagoa de S\xE3o Francisco|PI|-4.38|-41.6\nNaque|MG|-19.23|-42.33\nCaibi|SC|-27.07|-53.25\nCuit\xE9 de Mamanguape|PB|-6.91|-35.25\nIchu|BA|-11.74|-39.19\nLindolfo Collor|RS|-29.59|-51.21\nMendon\xE7a|SP|-21.18|-49.58\nC\xE2ndido God\xF3i|RS|-27.95|-54.75\nTaciba|SP|-22.39|-51.29\nDiamante|PB|-7.42|-38.26\nJos\xE9 Boiteux|SC|-26.96|-49.63\nS\xE3o Sebasti\xE3o do Anta|MG|-19.51|-41.98\nPaulo Frontin|PR|-26.05|-50.83\nG\xE1lia|SP|-22.29|-49.55\nSaudade do Igua\xE7u|PR|-25.69|-52.62\nDom Expedito Lopes|PI|-6.95|-41.64\nS\xE3o Miguel do Anta|MG|-20.71|-42.72\nChu\xED|RS|-33.69|-53.46\nNossa Senhora de Lourdes|SE|-10.08|-37.06\nGr\xE3o-Par\xE1|SC|-28.18|-49.23\nPedr\xE3o|BA|-12.15|-38.65\nFernandes Pinheiro|PR|-25.41|-50.55\nRio das Antas|SC|-26.89|-51.07\nCristal\xE2ndia|TO|-10.6|-49.19\nAiuruoca|MG|-21.97|-44.6\nErer\xE9|CE|-6.03|-38.35\nJequita\xED|MG|-17.23|-44.44\nAlambari|SP|-23.55|-47.9\nEngenheiro Navarro|MG|-17.28|-43.95\nNovo Mundo|MT|-9.96|-55.2\nJandaia|GO|-17.05|-50.15\nFeira Nova|SE|-10.26|-37.31\nSantar\xE9m Novo|PA|-0.93|-47.39\nDois Irm\xE3os do Tocantins|TO|-9.26|-49.06\nPacuj\xE1|CE|-3.98|-40.7\nSilvian\xF3polis|MG|-22.03|-45.84\nSussuapara|PI|-7.04|-41.38\nAbadia dos Dourados|MG|-18.48|-47.39\nIbema|PR|-25.12|-53.01\nPalm\xF3polis|MG|-16.74|-40.43\nC\xF3rrego Fundo|MG|-20.45|-45.56\nSilveiras|SP|-22.66|-44.85\nIndaiabira|MG|-15.49|-42.2\nCamala\xFA|PB|-7.88|-36.82\nAcau\xE3|PI|-8.22|-41.08\nLuisl\xE2ndia|MG|-16.11|-44.59\nPirangu\xE7u|MG|-22.52|-45.49\nAdrian\xF3polis|PR|-24.66|-48.99\nGeneral Carneiro|MT|-15.71|-52.76\nPedro Avelino|RN|-5.52|-36.39\nIndian\xF3polis|MG|-19.03|-47.92\nSanta B\xE1rbara de Goi\xE1s|GO|-16.57|-49.7\nTunas do Paran\xE1|PR|-24.97|-49.09\nAfonso Cunha|MA|-4.14|-43.33\nHerval|RS|-32.02|-53.39\nCol\xF4nia do Gurgu\xE9ia|PI|-8.18|-43.79\nEchapor\xE3|SP|-22.43|-50.2\nChal\xE9|MG|-20.05|-41.69\nEncanto|RN|-6.11|-38.3\nMalta|PB|-6.9|-37.52\nS\xE3o Jos\xE9 do Jacuri|MG|-18.28|-42.67\nS\xE3o Francisco de Paula|MG|-20.7|-44.98\nJaborandi|SP|-20.69|-48.41\nHeliodora|MG|-22.06|-45.55\nAbel Figueiredo|PA|-4.95|-48.39\nSanta Ernestina|SP|-21.46|-48.4\nBel\xE9m do Brejo do Cruz|PB|-6.19|-37.53\nVidal Ramos|SC|-27.39|-49.36\nDona Euz\xE9bia|MG|-21.32|-42.81\nGalil\xE9ia|MG|-19.0|-41.54\nSanto Ant\xF4nio do Jardim|SP|-22.11|-46.68\nBoa Ventura de S\xE3o Roque|PR|-24.87|-51.63\nItueta|MG|-19.4|-41.17\nSamba\xEDba|MA|-7.13|-45.35\nS\xE3o Jos\xE9 do Xingu|MT|-10.8|-52.75\nIrajuba|BA|-13.26|-40.08\nS\xE3o Jo\xE3o da Serra|PI|-5.51|-41.89\nItamb\xE9|PR|-23.66|-51.99\nVale Real|RS|-29.39|-51.26\nAlecrim|RS|-27.66|-54.76\nPara\xEDso|SP|-21.02|-48.78\nP\xE9rola d'Oeste|PR|-25.83|-53.74\nCoronel Bicaco|RS|-27.72|-53.7\nCentral de Minas|MG|-18.76|-41.31\nSapucaia|PA|-6.94|-49.68\nCampo Grande do Piau\xED|PI|-7.13|-41.03\nSanta Filomena|PI|-9.11|-45.91\nBoqueir\xE3o do Le\xE3o|RS|-29.3|-52.43\nMundo Novo|GO|-13.77|-50.28\nIacri|SP|-21.86|-50.69\nMercedes|PR|-24.45|-54.16\nBandeira do Sul|MG|-21.73|-46.38\nRibeiro Gon\xE7alves|PI|-7.56|-45.24\nOriente|SP|-22.15|-50.1\nS\xE3o Pedro de Alc\xE2ntara|SC|-27.57|-48.8\nIbia\xED|MG|-16.86|-44.9\nMorro Redondo|RS|-31.59|-52.63\nMorro Reuter|RS|-29.54|-51.08\nImbuia|SC|-27.49|-49.42\nGra\xE7a Aranha|MA|-5.41|-44.34\nNovo Oriente do Piau\xED|PI|-6.45|-41.93\nOrindi\xFAva|SP|-20.19|-49.35\nVereda|BA|-17.22|-40.1\nPasso do Sobrado|RS|-29.75|-52.27\nTenente Laurentino Cruz|RN|-6.14|-36.71\nEn\xE9as Marques|PR|-25.94|-53.17\nMontadas|PB|-7.09|-35.96\nPiratuba|SC|-27.42|-51.77\nJequitib\xE1|MG|-19.23|-44.03\nS\xE3o Jos\xE9 dos Ramos|PB|-7.25|-35.37\nS\xE3o Jo\xE3o do Sabugi|RN|-6.71|-37.2\nS\xE3o Juli\xE3o|PI|-7.08|-40.82\nCaatiba|BA|-14.97|-40.41\nPotiretama|CE|-5.71|-38.16\nSalto da Divisa|MG|-16.01|-39.94\nItarum\xE3|GO|-18.76|-51.35\nBarra de S\xE3o Miguel|PB|-7.75|-36.32\n\xC1guas de Chapec\xF3|SC|-27.08|-52.98\nItaju do Col\xF4nia|BA|-15.14|-39.73\nBonfim do Piau\xED|PI|-9.16|-42.89\nNova Uni\xE3o|MG|-19.69|-43.58\nHulha Negra|RS|-31.41|-53.87\nSegredo|RS|-29.35|-52.98\nItaubal|AP|0.6|-50.7\nDarcin\xF3polis|TO|-6.72|-47.76\nPorto Rico do Maranh\xE3o|MA|-1.86|-44.58\nCampina do Monte Alegre|SP|-23.59|-48.48\nMamonas|MG|-15.05|-42.95\nAnta Gorda|RS|-28.97|-52.01\nFernando Prestes|SP|-21.27|-48.69\nItanagra|BA|-12.26|-38.04\nInaciol\xE2ndia|GO|-18.49|-49.99\nJenipapo de Minas|MG|-17.08|-42.26\nOlho d'\xC1gua|PB|-7.22|-37.74\nSanta Helena de Minas|MG|-16.97|-40.67\nJussari|BA|-15.19|-39.49\nVila Prop\xEDcio|GO|-15.45|-48.88\nSenador El\xF3i de Souza|RN|-6.03|-35.7\nSanta Helena|PB|-6.72|-38.64\nS\xE3o Jos\xE9 da Boa Vista|PR|-23.91|-49.66\nAraguacema|TO|-8.81|-49.56\nLaranjal|MG|-21.37|-42.47\nAlto Capara\xF3|MG|-20.43|-41.87\nSanta Cruz|PB|-6.52|-38.06\nPato Bragado|PR|-24.63|-54.23\nS\xE3o Bento do Tocantins|TO|-6.03|-47.9\nDivisa Nova|MG|-21.51|-46.19\nCh\xE3 Preta|AL|-9.26|-36.3\nCampina das Miss\xF5es|RS|-27.99|-54.84\nS\xE3o Pedro dos Crentes|MA|-6.82|-46.53\nBernardo do Mearim|MA|-4.63|-44.76\nSert\xE3o Santana|RS|-30.46|-51.6\nSanta Rita do Itueto|MG|-19.36|-41.38\nNova Ol\xEDmpia|PR|-23.47|-53.09\nAm\xE9rico de Campos|SP|-20.3|-49.74\nBossoroca|RS|-28.73|-54.9\nBar\xE3o do Triunfo|RS|-30.39|-51.74\nJos\xE9 da Penha|RN|-6.31|-38.28\nNarandiba|SP|-22.41|-51.53\nAnchieta|SC|-26.54|-53.33\nTumiritinga|MG|-18.98|-41.65\nLuzerna|SC|-27.13|-51.47\nS\xE3o Paulo das Miss\xF5es|RS|-28.02|-54.94\nCaldas Brand\xE3o|PB|-7.1|-35.33\nBela Vista do Toldo|SC|-26.27|-50.47\nJuven\xEDlia|MG|-14.27|-44.16\nBarro Preto|BA|-14.79|-39.48\nPedro R\xE9gis|PB|-6.63|-35.3\nSanto Ant\xF4nio de Lisboa|PI|-6.99|-41.23\nMaria Helena|PR|-23.62|-53.21\nAlto Boa Vista|MT|-11.67|-51.39\nCerrito|RS|-31.84|-52.8\nGraccho Cardoso|SE|-10.23|-37.2\nTanque d'Arca|AL|-9.53|-36.44\nBarra do Rocha|BA|-14.2|-39.6\nNova Olinda|PB|-7.47|-38.04\nBelo Monte|AL|-9.82|-37.28\nNortel\xE2ndia|MT|-14.45|-56.79\nS\xE3o Pedro|RN|-5.91|-35.63\nBoa Esperan\xE7a do Norte|MT|-13.51|-55.15\nSanta Cruz do Piau\xED|PI|-7.18|-41.76\nMachadinho|RS|-27.57|-51.67\nSerra de S\xE3o Bento|RN|-6.42|-35.7\nS\xE3o Francisco de Sales|MG|-19.86|-49.77\nItirapu\xE3|SP|-20.64|-47.22\nOuro Verde de Minas|MG|-18.07|-41.27\nRio Grande do Piau\xED|PI|-7.78|-43.14\nFazenda Nova|GO|-16.18|-50.78\nPara\xEDso das \xC1guas|MS|-19.02|-53.01\nXambr\xEA|PR|-23.74|-53.49\nFeira da Mata|BA|-14.2|-44.27\nPranchita|PR|-26.02|-53.74\nGuaramiranga|CE|-4.26|-38.93\nBaixio|CE|-6.72|-38.71\nItambarac\xE1|PR|-23.02|-50.41\nBrejo dos Santos|PB|-6.37|-37.83\nPirajuba|MG|-19.91|-48.7\nJani\xF3polis|PR|-24.14|-52.78\nTapira|PR|-23.32|-53.07\nAlcantil|PB|-7.74|-36.05\nBotumirim|MG|-16.87|-43.01\nBom Princ\xEDpio do Piau\xED|PI|-3.2|-41.64\nVargem Alegre|MG|-19.6|-42.29\nBrit\xE2nia|GO|-15.24|-51.16\nSanta Carmem|MT|-11.91|-55.23\nS\xE3o Domingos das Dores|MG|-19.52|-42.01\nBom Jesus do Amparo|MG|-19.71|-43.48\nNova Esperan\xE7a do Sudoeste|PR|-25.9|-53.26\nGaurama|RS|-27.59|-52.09\nDouradina|MS|-22.04|-54.62\nAnhembi|SP|-22.79|-48.13\nSanta Rita do Araguaia|GO|-17.33|-53.2\nS\xE3o Raimundo do Doca Bezerra|MA|-5.11|-45.07\nPinh\xE3o|SE|-10.57|-37.72\nPatroc\xEDnio do Muria\xE9|MG|-21.15|-42.21\nTibau|RN|-4.84|-37.26\nItaverava|MG|-20.68|-43.61\nRio Manso|MG|-20.27|-44.31\nDoutor Ulysses|PR|-24.57|-49.42\nLumin\xE1rias|MG|-21.51|-44.9\nTaia\xE7u|SP|-21.14|-48.51\nSoledade de Minas|MG|-22.06|-45.05\nFrei Gaspar|MG|-18.07|-41.43\nS\xE3o Pedro do Igua\xE7u|PR|-24.94|-53.85\nIgaracy|PB|-7.17|-38.15\nBarra Longa|MG|-20.29|-43.04\nBertol\xEDnia|PI|-7.63|-43.95\nIbiara|PB|-7.48|-38.41\nS\xE3o Francisco de Assis do Piau\xED|PI|-8.24|-41.69\nItaara|RS|-29.6|-53.77\nJacobina do Piau\xED|PI|-7.93|-41.21\nCatas Altas|MG|-20.07|-43.41\nPaula Freitas|PR|-26.21|-50.93\nBotuver\xE1|SC|-27.2|-49.07\nNova Maring\xE1|MT|-13.01|-57.09\nPorto dos Ga\xFAchos|MT|-11.53|-57.41\nPoloni|SP|-20.78|-49.83\nCoqueiro Seco|AL|-9.64|-35.8\nPalma|MG|-21.37|-42.31\nIguara\xE7u|PR|-23.19|-51.83\nEsta\xE7\xE3o|RS|-27.91|-52.26\nS\xE3o Jo\xE3o do Jaguaribe|CE|-5.28|-38.27\nCaxing\xF3|PI|-3.42|-41.9\nRafael Fernandes|RN|-6.19|-38.22\nNova Palma|RS|-29.47|-53.47\nCrucil\xE2ndia|MG|-20.39|-44.33\nMonte do Carmo|TO|-10.76|-48.11\nCabixi|RO|-13.49|-60.55\nJaboti|PR|-23.74|-50.07\nSantana do Riacho|MG|-19.17|-43.72\nSertaneja|PR|-23.04|-50.83\nMucurici|ES|-18.1|-40.52\nSantana do Itarar\xE9|PR|-23.76|-49.63\nTucunduva|RS|-27.66|-54.44\nDatas|MG|-18.45|-43.66\nSimol\xE2ndia|GO|-14.46|-46.48\nTufil\xE2ndia|MA|-3.67|-45.62\nPiacatu|SP|-21.59|-50.6\nSert\xE3o|RS|-27.98|-52.26\nRiversul|SP|-23.83|-49.43\nBarbosa|SP|-21.27|-49.95\nPai Pedro|MG|-15.53|-43.07\nSeveriano Melo|RN|-5.78|-37.96\nMendes Pimentel|MG|-18.66|-41.41\nGuaimb\xEA|SP|-21.91|-49.9\nS\xE3o Jo\xE3o da Fronteira|PI|-3.96|-41.26\nS\xE3o Jo\xE3o do Caiu\xE1|PR|-22.85|-52.34\nGeminiano|PI|-7.15|-41.34\nCaldeir\xE3o Grande do Piau\xED|PI|-7.33|-40.64\nMacuco|RJ|-21.98|-42.25\nBonfin\xF3polis de Minas|MG|-16.57|-45.98\nBenedito Leite|MA|-7.21|-44.56\nCaiu\xE1|SP|-21.83|-52.0\nS\xE3o Felipe D'Oeste|RO|-11.9|-61.5\nS\xE3o Martinho|RS|-27.71|-53.97\nConcei\xE7\xE3o do Par\xE1|MG|-19.75|-44.89\nCara\xFAbas do Piau\xED|PI|-3.48|-41.84\nSenhora de Oliveira|MG|-20.8|-43.34\nJoca Marques|PI|-3.48|-42.43\nCipot\xE2nea|MG|-20.9|-43.36\nCaturit\xE9|PB|-7.42|-36.03\nCouto Magalh\xE3es|TO|-8.28|-49.25\nPil\xF5ezinhos|PB|-6.84|-35.53\nCabaceiras|PB|-7.49|-36.29\nAramina|SP|-20.09|-47.79\nHarmonia|RS|-29.55|-51.42\nBocaina de Minas|MG|-22.17|-44.4\nOlhos-d'\xC1gua|MG|-17.4|-43.57\nGrandes Rios|PR|-24.15|-51.51\nLaranjal|PR|-24.89|-52.47\nVitor Meireles|SC|-26.88|-49.83\nCoroados|SP|-21.35|-50.29\nTimb\xE9 do Sul|SC|-28.83|-49.84\nJ\xFAlio Borges|PI|-10.32|-44.24\nIp\xEA|RS|-28.82|-51.29\nNova Erechim|SC|-26.9|-52.91\nArapoema|TO|-7.65|-49.06\nAngelina|SC|-27.57|-48.99\nCaiana|MG|-20.7|-41.93\nRos\xE1rio do Iva\xED|PR|-24.27|-51.27\nS\xE3o Jos\xE9 do Goiabal|MG|-19.92|-42.7\nGongogi|BA|-14.32|-39.47\nS\xE3o Jo\xE3o do Manteninha|MG|-18.72|-41.16\nSalgadinho|PE|-7.93|-35.65\nBra\xFAna|SP|-21.5|-50.32\nAlvorada do Gurgu\xE9ia|PI|-8.42|-43.78\nCedro de S\xE3o Jo\xE3o|SE|-10.25|-36.89\nPicada Caf\xE9|RS|-29.45|-51.14\nEquador|RN|-6.94|-36.72\nRubelita|MG|-16.41|-42.26\nUbarana|SP|-21.16|-49.72\nRochedo|MS|-19.96|-54.88\nIta\xFA|RN|-5.84|-37.99\nRio Espera|MG|-20.86|-43.47\nNossa Senhora de Nazar\xE9|PI|-4.63|-42.17\nS\xE3o Jos\xE9 da Vit\xF3ria|BA|-15.08|-39.34\nCoronel Domingos Soares|PR|-26.23|-52.04\nPatos do Piau\xED|PI|-7.67|-41.24\nFartura do Piau\xED|PI|-9.48|-42.79\nSentinela do Sul|RS|-30.61|-51.59\nProgresso|RS|-29.24|-52.32\nLago\xE3o|RS|-29.23|-52.8\nJacu\xEDpe|AL|-8.84|-35.46\nSanta Luz|PI|-8.95|-44.13\nCurral de Cima|PB|-6.72|-35.26\nAroazes|PI|-6.11|-41.78\nDivino de S\xE3o Louren\xE7o|ES|-20.62|-41.69\nCampinas do Sul|RS|-27.72|-52.62\nV\xE1rzea|RN|-6.35|-35.37\nSolid\xE3o|PE|-7.59|-37.64\nAmaral Ferrador|RS|-30.88|-52.25\nBacurituba|MA|-2.71|-44.73\nMadre de Deus de Minas|MG|-21.48|-44.33\nS\xE3o Francisco do Piau\xED|PI|-7.25|-42.54\nDom Silv\xE9rio|MG|-20.16|-42.96\nCalumbi|PE|-7.94|-38.15\nCatura\xED|GO|-16.44|-49.49\nPorto do Mangue|RN|-5.05|-36.79\nIbertioga|MG|-21.43|-43.96\nCana Verde|MG|-21.02|-45.18\nFigueir\xF3polis|TO|-12.13|-49.17\nSert\xE3ozinho|PB|-6.75|-35.44\nAragominas|TO|-7.16|-48.53\nJesu\xE2nia|MG|-21.99|-45.29\nTavares|RS|-31.28|-51.09\nS\xE3o Jos\xE9 do Divino|PI|-3.81|-41.83\nManoel Em\xEDdio|PI|-8.01|-43.88\nMoeda|MG|-20.34|-44.05\nLandri Sales|PI|-7.26|-43.94\nJuazeiro do Piau\xED|PI|-5.17|-41.7\nSanta Maria da Serra|SP|-22.57|-48.16\nAlmadina|BA|-14.71|-39.64\nEntre Folhas|MG|-19.62|-42.23\nUbirajara|SP|-22.53|-49.66\nJunco do Maranh\xE3o|MA|-1.84|-46.09\nS\xE3o Tom\xE9|PR|-23.53|-52.59\nPrat\xE2nia|SP|-22.81|-48.66\nAmericano do Brasil|GO|-16.25|-49.98\nSilvan\xF3polis|TO|-11.15|-48.17\nCris\xF3lita|MG|-17.24|-40.92\nBarra do Chap\xE9u|SP|-24.47|-49.02\nFel\xEDcio dos Santos|MG|-18.08|-43.24\nBoa Ventura|PB|-7.41|-38.21\nS\xE3o Nicolau|RS|-28.18|-55.27\nVeredinha|MG|-17.4|-42.73\nGonzaga|MG|-18.82|-42.48\nRio Preto|MG|-22.09|-43.83\nCoronel Ezequiel|RN|-6.37|-36.22\nGuaraciama|MG|-17.01|-43.67\nSelbach|RS|-28.63|-52.95\nJapi|RN|-6.47|-35.93\nLindoeste|PR|-25.26|-53.57\nSalto do Itarar\xE9|PR|-23.61|-49.64\nIta\xFAba|MT|-11.06|-55.28\nIndiana|SP|-22.17|-51.26\nPiedade dos Gerais|MG|-20.47|-44.22\nAlian\xE7a do Tocantins|TO|-11.31|-48.94\nCordilheira Alta|SC|-26.98|-52.61\nDores do Turvo|MG|-20.98|-43.18\nCurral Novo do Piau\xED|PI|-7.83|-40.9\nTiradentes do Sul|RS|-27.4|-54.08\nLagoinha|SP|-23.08|-45.19\nSabino|SP|-21.46|-49.58\nV\xE1rzea Branca|PI|-9.24|-42.97\nJacar\xE9 dos Homens|AL|-9.64|-37.21\nCaridade do Piau\xED|PI|-7.73|-40.98\nTupandi|RS|-29.48|-51.42\nLagoa do Barro do Piau\xED|PI|-8.48|-41.53\nTurvel\xE2ndia|GO|-17.85|-50.3\nS\xE3o Jorge do Iva\xED|PR|-23.43|-52.29\nMassap\xEA do Piau\xED|PI|-7.47|-41.11\nSerran\xF3polis do Igua\xE7u|PR|-25.38|-54.05\nItaguatins|TO|-5.77|-47.49\nGurinhat\xE3|MG|-19.21|-49.79\nNova Colinas|MA|-7.12|-46.26\nS\xE3o Pedro do Sua\xE7u\xED|MG|-18.36|-42.6\nDami\xE3o|PB|-6.63|-35.91\nSardo\xE1|MG|-18.78|-42.36\nSobr\xE1lia|MG|-19.23|-42.1\nDiamante do Norte|PR|-22.66|-52.86\nCapara\xF3|MG|-20.53|-41.91\nErval Velho|SC|-27.27|-51.44\nCrist\xE1lia|MG|-16.72|-42.86\nCongo|PB|-7.79|-36.66\nRit\xE1polis|MG|-21.03|-44.32\nItaguari|GO|-15.92|-49.61\nDores de Guanh\xE3es|MG|-19.05|-42.93\nIbiracatu|MG|-15.66|-44.17\nAparecida do Rio Negro|TO|-9.94|-47.96\nLogradouro|PB|-6.61|-35.44\nOrat\xF3rios|MG|-20.43|-42.8\nNova Ara\xE7\xE1|RS|-28.65|-51.75\nTurvol\xE2ndia|MG|-21.87|-45.79\nCaracol|MS|-22.01|-57.03\nSantana de Mangueira|PB|-7.55|-38.32\nOuro Branco|RN|-6.7|-36.94\nBrochier|RS|-29.55|-51.59\nSucupira do Riach\xE3o|MA|-6.41|-43.55\nTun\xE1polis|SC|-26.97|-53.64\nConcei\xE7\xE3o do Canind\xE9|PI|-7.88|-41.59\nRondinha|RS|-27.83|-52.91\nDom Joaquim|MG|-18.96|-43.25\nDescoberto|MG|-21.46|-42.96\nJaramataia|AL|-9.66|-37.0\nCanas|SP|-22.7|-45.05\nCampo Novo|RS|-27.68|-53.81\nJapira|PR|-23.81|-50.14\nQuinta do Sol|PR|-23.85|-52.13\nVermelho Novo|MG|-20.04|-42.27\nPalmeira do Piau\xED|PI|-8.73|-44.25\nSanta F\xE9 de Goi\xE1s|GO|-15.77|-51.1\nCocal de Telha|PI|-4.56|-41.96\nPadre Carvalho|MG|-16.36|-42.51\nRio Fortuna|SC|-28.12|-49.11\nPequizeiro|TO|-8.59|-48.93\nCaseara|TO|-9.28|-49.95\nErval Grande|RS|-27.39|-52.57\nAguiar|PB|-7.09|-38.17\nFrancisc\xF3polis|MG|-17.96|-42.01\nLagoa do Piau\xED|PI|-5.42|-42.64\nAgricol\xE2ndia|PI|-5.8|-42.67\nBara\xFAna|PB|-6.63|-36.26\nCampos Novos Paulista|SP|-22.6|-50.0\nSerra do Navio|AP|0.9|-52.0\nMato Leit\xE3o|RS|-29.53|-52.13\nSanta Maria|RN|-5.84|-35.69\nFirmino Alves|BA|-14.98|-39.93\nRiach\xE3o do Po\xE7o|PB|-7.14|-35.29\nTamboara|PR|-23.2|-52.47\nS\xE3o Gon\xE7alo do Piau\xED|PI|-5.99|-42.71\nMesquita|MG|-19.22|-42.61\n\xC1gua Fria de Goi\xE1s|GO|-14.98|-47.78\nCurrais|PI|-9.01|-44.41\nNova Esperan\xE7a do Sul|RS|-29.41|-54.83\nIngazeira|PE|-7.67|-37.46\nS\xE3o Pedro da Uni\xE3o|MG|-21.13|-46.61\nCurvel\xE2ndia|MT|-15.61|-57.91\nDom Cavati|MG|-19.37|-42.11\nVieir\xF3polis|PB|-6.51|-38.26\nS\xE3o Jos\xE9 de Caiana|PB|-7.25|-38.3\nCampinas do Piau\xED|PI|-7.66|-41.88\nGoiandira|GO|-18.14|-48.09\nS\xE3o Jo\xE3o da Lagoa|MG|-16.85|-44.35\nGranjeiro|CE|-6.88|-39.21\nBar\xE3o do Monte Alto|MG|-21.24|-42.24\nLajes Pintadas|RN|-6.15|-36.12\nAcorizal|MT|-15.19|-56.36\nParazinho|RN|-5.22|-35.84\nOnda Verde|SP|-20.6|-49.29\nS\xE3o Luiz do Norte|GO|-14.86|-49.33\nMinador do Negr\xE3o|AL|-9.31|-36.87\nFunil\xE2ndia|MG|-19.37|-44.06\nCai\xE7ara|RS|-27.28|-53.43\nLupion\xF3polis|PR|-22.75|-51.66\nRos\xE1rio da Limeira|MG|-20.98|-42.51\nCongonhas do Norte|MG|-18.8|-43.68\nGon\xE7alves|MG|-22.65|-45.86\nRio Negro|MS|-19.45|-54.99\nBarrac\xE3o|RS|-27.67|-51.46\nBento Fernandes|RN|-5.7|-35.81\nRiach\xE3o do Bacamarte|PB|-7.25|-35.67\nCombinado|TO|-12.79|-46.54\nPalmeirante|TO|-7.85|-47.92\n\xC1lvaro de Carvalho|SP|-22.08|-49.72\nFoz do Jord\xE3o|PR|-25.74|-52.12\nGuaruj\xE1 do Sul|SC|-26.39|-53.53\nCorguinho|MS|-19.82|-54.83\nBarrol\xE2ndia|TO|-9.83|-48.73\nSalmour\xE3o|SP|-21.63|-50.86\nEspig\xE3o Alto do Igua\xE7u|PR|-25.42|-52.83\nNipo\xE3|SP|-20.91|-49.78\nLunardelli|PR|-24.08|-51.74\nPingo-d'\xC1gua|MG|-19.73|-42.41\nMarcos Parente|PI|-7.12|-43.89\nGuapirama|PR|-23.52|-50.04\nPalmeiras do Tocantins|TO|-6.62|-47.55\nS\xE3o Francisco do Gl\xF3ria|MG|-20.79|-42.27\nGameleiras|MG|-15.08|-43.12\nNova Independ\xEAncia|SP|-21.1|-51.49\nPresidente Bernardes|MG|-20.77|-43.19\nViadutos|RS|-27.57|-52.02\nS\xE3o Bento Abade|MG|-21.58|-45.07\nLiberato Salzano|RS|-27.6|-53.08\nCana\xE3|MG|-20.69|-42.62\nBorac\xE9ia|SP|-22.19|-48.78\nItaguaru|GO|-15.76|-49.64\nGoianorte|TO|-8.77|-48.93\nTr\xEAs Palmeiras|RS|-27.61|-52.84\nRiqueza|SC|-27.07|-53.33\nS\xE3o Jo\xE3o do Itaperi\xFA|SC|-26.62|-48.77\nSanta Rita de Jacutinga|MG|-22.15|-44.1\nPatis|MG|-16.08|-44.08\nAricanduva|MG|-17.87|-42.55\nBel\xE9m|AL|-9.57|-36.49\nCaldazinha|GO|-16.71|-49.0\nItabi|SE|-10.12|-37.11\nJandu\xEDs|RN|-6.01|-37.4\nBandeira|MG|-15.88|-40.56\nSerrinha dos Pintos|RN|-6.11|-37.95\nGavi\xE3o Peixoto|SP|-21.84|-48.5\nFlora\xED|PR|-23.32|-52.3\nNat\xE9rcia|MG|-22.12|-45.51\nHon\xF3rio Serpa|PR|-26.14|-52.38\nAlmino Afonso|RN|-6.15|-37.76\nNovo Horizonte do Sul|MS|-22.67|-53.86\nSanta Rosa do Tocantins|TO|-11.45|-48.12\nMarli\xE9ria|MG|-19.71|-42.73\nCaibat\xE9|RS|-28.29|-54.65\nMarian\xF3polis do Tocantins|TO|-9.79|-49.66\nCatuti|MG|-15.36|-42.96\nClaraval|MG|-20.4|-47.28\nMirassol\xE2ndia|SP|-20.62|-49.46\nMata|RS|-29.56|-54.46\nMarumbi|PR|-23.71|-51.64\nSanta Maria do Salto|MG|-16.25|-40.15\nRibeir\xE3o do Sul|SP|-22.79|-49.93\nBrejinho de Nazar\xE9|TO|-11.01|-48.57\nHumait\xE1|RS|-27.57|-53.97\nEntre Rios do Oeste|PR|-24.7|-54.24\nMatinhas|PB|-7.12|-35.77\nSerraria|PB|-6.82|-35.63\nCaxambu do Sul|SC|-27.16|-52.88\nS\xEDtio Novo|RN|-6.11|-35.91\nBraganey|PR|-24.82|-53.12\nLiberdade|MG|-22.03|-44.32\nGuaraci|PR|-22.97|-51.65\nVicente Dutra|RS|-27.16|-53.4\nLuizi\xE2nia|SP|-21.67|-50.33\nS\xE3o Jos\xE9 do Serid\xF3|RN|-6.44|-36.87\nSanta Cruz do Escalvado|MG|-20.24|-42.82\nVargem Grande do Rio Pardo|MG|-15.4|-42.31\nCutias|AP|0.97|-50.8\nMeridiano|SP|-20.36|-50.18\nBom Sucesso|PB|-6.44|-37.92\nCristiano Otoni|MG|-20.83|-43.82\nRio Sono|TO|-9.35|-47.89\nPresidente M\xE9dici|MA|-2.39|-45.82\nRibeir\xE3o Corrente|SP|-20.46|-47.59\nAlegrete do Piau\xED|PI|-7.24|-40.86\nLobato|PR|-23.01|-51.95\nJapara\xEDba|MG|-20.14|-45.5\nCampo Alegre do Fidalgo|PI|-8.38|-41.83\nS\xE3o Jos\xE9 da Varginha|MG|-19.7|-44.56\nAnal\xE2ndia|SP|-22.13|-47.66\nPiedade do Rio Grande|MG|-21.47|-44.19\nCacique Doble|RS|-27.77|-51.66\nMu\xE7um|RS|-29.16|-51.87\nAmapor\xE3|PR|-23.09|-52.79\nRomel\xE2ndia|SC|-26.68|-53.32\nChuvisca|RS|-30.75|-51.97\nBom Jesus da Penha|MG|-21.01|-46.52\nNazar\xE9|TO|-6.38|-47.66\nNova Itaberaba|SC|-26.94|-52.81\nQuatro Pontes|PR|-24.58|-53.98\nS\xE3o Miguel do Passa Quatro|GO|-17.06|-48.66\nBarra do Ouro|TO|-7.7|-47.68\nKalor\xE9|PR|-23.82|-51.67\nSanta Rosa do Piau\xED|PI|-6.8|-42.28\nSanta Cruz da Vit\xF3ria|BA|-14.96|-39.81\nFormoso|GO|-13.65|-48.88\nLambari D'Oeste|MT|-15.32|-58.0\nAlcin\xF3polis|MS|-18.33|-53.7\nRio do Prado|MG|-16.61|-40.57\nRessaquinha|MG|-21.06|-43.76\nPinheirinho do Vale|RS|-27.21|-53.61\nReden\xE7\xE3o da Serra|SP|-23.26|-45.54\nCapit\xE3o Andrade|MG|-19.07|-41.86\nMoss\xE2medes|GO|-16.12|-50.21\nIpira|SC|-27.4|-51.78\nMarab\xE1 Paulista|SP|-22.11|-51.96\nIbia\xE7\xE1|RS|-28.06|-51.86\nNovorizonte|MG|-16.02|-42.4\nDom Macedo Costa|BA|-12.9|-39.19\nJerumenha|PI|-7.09|-43.5\nLind\xF3ia do Sul|SC|-27.05|-52.07\nPindorama do Tocantins|TO|-11.13|-47.57\nVargem Bonita|SC|-27.01|-51.74\nBoa Esperan\xE7a|PR|-24.25|-52.79\nSebasti\xE3o Leal|PI|-7.57|-44.06\nAiquara|BA|-14.13|-39.89\nCafezal do Sul|PR|-23.9|-53.51\nS\xE3o Roberto|MA|-5.02|-45.0\nNova Nazar\xE9|MT|-13.95|-51.8\nAlfredo Marcondes|SP|-21.95|-51.41\nAmparo do Serra|MG|-20.51|-42.8\nRiozinho|RS|-29.64|-50.45\nAugusto de Lima|MG|-18.1|-44.27\nFortaleza dos Valos|RS|-28.8|-53.22\nTaba\xED|RS|-29.64|-51.68\nJatob\xE1 do Piau\xED|PI|-4.77|-41.82\nLagoa do S\xEDtio|PI|-6.51|-41.57\nCatingueira|PB|-7.12|-37.61\nCurralinhos|PI|-5.61|-42.84\nS\xE3o Jos\xE9 do Hort\xEAncio|RS|-29.53|-51.24\nS\xE3o Val\xE9rio|TO|-11.97|-48.24\nFrancisco Ayres|PI|-6.63|-42.69\nFrancisco Dumont|MG|-17.31|-44.23\nS\xE3o Jo\xE3o da Urtiga|RS|-27.82|-51.83\nBert\xF3polis|MG|-17.06|-40.58\nNova Guarita|MT|-10.31|-55.41\nIndian\xF3polis|PR|-23.48|-52.7\nCruzeiro do Sul|PR|-22.96|-52.16\nFruta de Leite|MG|-16.12|-42.53\nDoutor Maur\xEDcio Cardoso|RS|-27.51|-54.36\nItaguaj\xE9|PR|-22.62|-51.97\nTeixeir\xF3polis|RO|-10.91|-62.24\nV\xE1rzea Grande|PI|-6.55|-42.25\nArraial|PI|-6.65|-42.54\nVila Maria|RS|-28.54|-52.15\nDiamante D'Oeste|PR|-24.94|-54.11\nWitmarsum|SC|-26.93|-49.79\nFlores do Piau\xED|PI|-7.79|-42.92\nAguanil|MG|-20.94|-45.39\nAdolfo|SP|-21.23|-49.65\nArabut\xE3|SC|-27.16|-52.14\nAva\xED|SP|-22.15|-49.34\nCarvalhos|MG|-22.0|-44.46\nConcei\xE7\xE3o de Ipanema|MG|-19.93|-41.69\nAguiarn\xF3polis|TO|-6.55|-47.47\nNova Santa Helena|MT|-10.87|-55.19\nJurema|PI|-9.22|-43.13\nMiragua\xED|RS|-27.5|-53.69\nContendas do Sincor\xE1|BA|-13.75|-41.05\nSerran\xF3polis de Minas|MG|-15.82|-42.87\nS\xE3o Louren\xE7o do Piau\xED|PI|-9.16|-42.55\nSalto Veloso|SC|-26.9|-51.4\nSanta Teresinha|PB|-7.08|-37.44\nCravol\xE2ndia|BA|-13.35|-39.8\nItacuruba|PE|-8.82|-38.7\nMarquinho|PR|-25.11|-52.25\nS\xE3o F\xE9lix de Balsas|MA|-7.08|-44.81\nS\xE3o Bentinho|PB|-6.89|-37.72\nGavi\xE3o|BA|-11.47|-39.78\nLagoa|PB|-6.59|-37.91\nApor\xE9|GO|-18.96|-51.92\nF\xEAnix|PR|-23.91|-51.98\nMa\xE7ambar\xE1|RS|-29.14|-56.07\nDivin\xE9sia|MG|-20.99|-43.0\nFrancin\xF3polis|PI|-6.39|-42.26\nVirgol\xE2ndia|MG|-18.47|-42.31\nS\xE3o Jo\xE3o da Ponta|PA|-0.86|-47.92\nJo\xE3o Ramalho|SP|-22.25|-50.77\nNovais|SP|-20.99|-48.91\nC\xF3rrego do Bom Jesus|MG|-22.63|-46.02\nJabor\xE1|SC|-27.18|-51.73\nBuritizal|SP|-20.19|-47.71\nMorro Cabe\xE7a no Tempo|PI|-9.72|-43.91\nS\xE3o Braz do Piau\xED|PI|-9.06|-43.01\nCanabrava do Norte|MT|-11.06|-51.82\nPlanalto|SP|-21.03|-49.93\nTurv\xE2nia|GO|-16.61|-50.14\nBra\xFAnas|MG|-19.06|-42.71\nPareci Novo|RS|-29.64|-51.4\nVolta Grande|MG|-21.77|-42.54\nRio Branco|MT|-15.25|-58.13\nMonte Formoso|MG|-16.87|-41.25\nDivina Pastora|SE|-10.68|-37.15\nDona Emma|SC|-26.98|-49.73\nS\xE3o Jo\xE3o da Varjota|PI|-6.94|-41.89\nMonte Horebe|PB|-7.2|-38.58\nEliseu Martins|PI|-8.1|-43.67\nItapirapu\xE3 Paulista|SP|-24.57|-49.17\nOcau\xE7u|SP|-22.44|-49.92\nPorto Lucena|RS|-27.86|-55.01\nMessias Targino|RN|-6.07|-37.52\nNova Iorque|MA|-6.73|-44.05\nPalestina|AL|-9.67|-37.34\nDivin\xF3polis de Goi\xE1s|GO|-13.29|-46.4\nFazenda Vilanova|RS|-29.59|-51.82\nPaulistas|MG|-18.43|-42.86\nDavid Canabarro|RS|-28.38|-51.85\nCapela Nova|MG|-20.92|-43.62\nSampaio|TO|-5.35|-47.88\nPara\xEDso|SC|-26.62|-53.67\nTaquara\xE7u de Minas|MG|-19.67|-43.69\nPonte Alta|SC|-27.48|-50.38\nFronteira dos Vales|MG|-16.89|-40.92\nAssun\xE7\xE3o|PB|-7.07|-36.73\nMarcelino Ramos|RS|-27.47|-51.91\nOlho d'\xC1gua Grande|AL|-10.06|-36.81\nNovo Barreiro|RS|-27.91|-53.11\nSanta Cruz da Concei\xE7\xE3o|SP|-22.14|-47.45\nParecis|RO|-12.18|-61.6\nItutinga|MG|-21.3|-44.66\nLeme do Prado|MG|-17.08|-42.69\nCabr\xE1lia Paulista|SP|-22.46|-49.34\nAlvorada de Minas|MG|-18.73|-43.36\nNova Palmeira|PB|-6.67|-36.42\nS\xE3o Jo\xE3o da Canabrava|PI|-6.81|-41.34\nS\xE3o Jo\xE3o do Tigre|PB|-8.08|-36.85\nPedras Grandes|SC|-28.43|-49.19\nSanto Ant\xF4nio do Grama|MG|-20.32|-42.6\nCouto de Magalh\xE3es de Minas|MG|-18.07|-43.46\nJos\xE9 Raydan|MG|-18.22|-42.49\nRodolfo Fernandes|RN|-5.78|-38.06\nS\xE3o Jo\xE3o do Cariri|PB|-7.38|-36.53\nGuaribas|PI|-9.39|-43.69\nFlor da Serra do Sul|PR|-26.25|-53.31\nBarra do Quara\xED|RS|-30.2|-57.55\nMarilac|MG|-18.51|-42.08\nS\xE3o Francisco do Oeste|RN|-5.97|-38.15\nGouvel\xE2ndia|GO|-18.62|-50.08\nNova Santa B\xE1rbara|PR|-23.59|-50.76\nBernardo Say\xE3o|TO|-7.87|-48.89\nMonte Castelo|SP|-21.3|-51.57\nDuer\xE9|TO|-11.34|-49.27\nPresidente Castelo Branco|PR|-23.28|-52.15\nJ\xFAlio Mesquita|SP|-22.01|-49.79\nAraguan\xE3|TO|-6.58|-48.64\nCoronel Jo\xE3o Pessoa|RN|-6.25|-38.44\nBr\xE1s Pires|MG|-20.84|-43.24\nCorumbata\xED|SP|-22.22|-47.62\nS\xE3o Jos\xE9 dos Ausentes|RS|-28.75|-50.07\nCacaul\xE2ndia|RO|-10.35|-62.9\nCoronel Jos\xE9 Dias|PI|-8.81|-42.52\nBannach|PA|-7.35|-50.4\nS\xE3o Jos\xE9 do Sabugi|PB|-6.76|-36.8\nPonte Alta do Bom Jesus|TO|-12.09|-46.48\nRamil\xE2ndia|PR|-25.12|-54.02\nSanto Ant\xF4nio da Barra|GO|-17.56|-50.63\nItaj\xE1|GO|-19.07|-51.55\nPorteir\xE3o|GO|-17.81|-50.17\nCoronel Macedo|SP|-23.63|-49.31\nBerizal|MG|-15.61|-41.74\nJampruca|MG|-18.46|-41.81\nPequi|MG|-19.63|-44.66\nGuzol\xE2ndia|SP|-20.65|-50.66\nZort\xE9a|SC|-27.45|-51.55\nBra\xE7o do Trombudo|SC|-27.36|-49.88\nPaineiras|MG|-18.9|-45.53\nS\xE3o Jos\xE9 do Alegre|MG|-22.32|-45.53\nAcegu\xE1|RS|-31.87|-54.16\nMaximiliano de Almeida|RS|-27.63|-51.8\nS\xE3o Pedro da Cipa|MT|-16.01|-54.92\nCoivaras|PI|-5.09|-42.21\nPedra do Indai\xE1|MG|-20.26|-45.21\nJoan\xE9sia|MG|-19.17|-42.68\nSantana do Jacar\xE9|MG|-20.9|-45.13\nIl\xF3polis|RS|-28.93|-52.13\nRiacho de Santana|RN|-6.25|-38.31\nSanta B\xE1rbara do Tug\xFArio|MG|-21.24|-43.56\nSanto Ant\xF4nio do Leste|MT|-14.8|-53.61\nRiacho Frio|PI|-10.12|-44.95\nTorixor\xE9u|MT|-16.2|-52.56\nJardim do Mulato|PI|-6.1|-42.63\nFrutuoso Gomes|RN|-6.16|-37.84\nLafaiete Coutinho|BA|-13.65|-40.21\nItacambira|MG|-17.06|-43.31\nBela Vista do Piau\xED|PI|-7.99|-41.87\nPassagem Franca do Piau\xED|PI|-5.86|-42.44\nRibeir\xE3o Vermelho|MG|-21.19|-45.06\nArambar\xE9|RS|-30.91|-51.5\nTapira|MG|-19.92|-46.83\nEsp\xEDrito Santo do Turvo|SP|-22.69|-49.43\nGoian\xE1|MG|-21.54|-43.2\nCir\xEDaco|RS|-28.34|-51.87\nMonteiro Lobato|SP|-22.95|-45.84\nSenador Georgino Avelino|RN|-6.16|-35.13\nBom Jesus do Tocantins|TO|-8.96|-48.16\nBrazabrantes|GO|-16.43|-49.39\nPontalinda|SP|-20.44|-50.53\nWall Ferraz|PI|-7.23|-41.91\nCajuri|MG|-20.79|-42.79\nColinas do Sul|GO|-14.15|-48.08\nBorborema|PB|-6.8|-35.62\nPopulina|SP|-19.95|-50.54\nS\xE3o Sebasti\xE3o do Tocantins|TO|-5.26|-48.2\nTaquaral de Goi\xE1s|GO|-16.05|-49.6\nRifaina|SP|-20.08|-47.43\nPaes Landim|PI|-7.77|-42.25\nJundi\xE1|AL|-8.93|-35.57\nCariri do Tocantins|TO|-11.89|-49.16\nSocorro do Piau\xED|PI|-7.87|-42.49\nCarrancas|MG|-21.49|-44.64\nS\xE3o Br\xE1s do Sua\xE7u\xED|MG|-20.62|-43.95\nBugre|MG|-19.42|-42.26\nModelo|SC|-26.77|-53.04\nSantana do Piau\xED|PI|-6.95|-41.52\nGlic\xE9rio|SP|-21.38|-50.21\nDivino das Laranjeiras|MG|-18.78|-41.48\nVila Boa|GO|-15.04|-47.05\nNova Santa Rita|PI|-8.1|-42.05\nCruzeiro do Igua\xE7u|PR|-25.62|-53.13\nDomingos Mour\xE3o|PI|-4.25|-41.27\nQuarto Centen\xE1rio|PR|-24.28|-53.08\nPo\xE7o de Jos\xE9 de Moura|PB|-6.56|-38.51\nPlanaltina do Paran\xE1|PR|-23.01|-52.92\nBela Vista da Caroba|PR|-25.88|-53.67\nTejup\xE1|SP|-23.34|-49.37\nAnhumas|SP|-22.29|-51.39\nBocaina|PI|-6.94|-41.32\nNovo Acordo|TO|-9.97|-47.68\nParanapu\xE3|SP|-20.1|-50.59\nIndiapor\xE3|SP|-19.98|-50.29\nAparecida d'Oeste|SP|-20.45|-50.88\nOuro Verde de Goi\xE1s|GO|-16.22|-49.19\nBarcelona|RN|-5.94|-35.92\nRibeira do Piau\xED|PI|-7.69|-42.71\nEdealina|GO|-17.42|-49.66\nBarra D'Alc\xE2ntara|PI|-6.52|-42.11\nTabuleiro|MG|-21.36|-43.24\nGuarani de Goi\xE1s|GO|-13.94|-46.49\nSalgado Filho|PR|-26.18|-53.36\nMajor Sales|RN|-6.4|-38.32\nIporanga|SP|-24.58|-48.6\nCapivari do Sul|RS|-30.14|-50.52\nBom Jesus do Sul|PR|-26.2|-53.6\nPorto Amazonas|PR|-25.54|-49.89\nCapit\xE3o Gerv\xE1sio Oliveira|PI|-8.5|-41.81\nMotuca|SP|-21.51|-48.15\nMedeiros|MG|-19.99|-46.22\nCara\xFAbas|PB|-7.72|-36.49\nMaced\xF4nia|SP|-20.14|-50.2\nMunhoz de Melo|PR|-23.15|-51.77\nPau D'Arco|TO|-7.54|-49.37\nS\xE3o Jos\xE9 de Espinharas|PB|-6.84|-37.32\nPiedade de Ponte Nova|MG|-20.24|-42.74\nMarques de Souza|RS|-29.33|-52.1\nS\xE3o Jo\xE3o do Pacu\xED|MG|-16.54|-44.51\nSanta Rosa de Lima|SE|-10.64|-37.19\nParan\xE1|RN|-6.48|-38.31\nPracu\xFAba|AP|1.75|-50.79\nAtalaia|PR|-23.15|-52.06\nSanta Efig\xEAnia de Minas|MG|-18.82|-42.44\nFeliz Deserto|AL|-10.29|-36.3\nRio Quente|GO|-17.77|-48.77\nPrata|PB|-7.69|-37.08\nS\xE3o Jos\xE9 das Palmeiras|PR|-24.84|-54.06\nCantagalo|MG|-18.52|-42.62\nRiachinho|TO|-6.44|-48.14\nPassa Sete|RS|-29.46|-52.96\nFlor\xEDnea|SP|-22.87|-50.68\nSenador Modestino Gon\xE7alves|MG|-17.95|-43.22\nAraguaiana|MT|-15.73|-51.83\nMariana Pimentel|RS|-30.35|-51.58\nLup\xE9rcio|SP|-22.41|-49.82\nMatrinch\xE3|GO|-15.43|-50.75\nQuinze de Novembro|RS|-28.75|-53.1\n\xC1gua Santa|RS|-28.17|-52.03\nItapura|SP|-20.64|-51.51\nJeriquara|SP|-20.31|-47.59\nCrom\xEDnia|GO|-17.29|-49.38\nAcaiaca|MG|-20.36|-43.14\nRubin\xE9ia|SP|-20.18|-51.01\nCampo Bonito|PR|-25.03|-52.99\nPassos Maia|SC|-26.78|-52.06\nBom Jardim da Serra|SC|-28.34|-49.64\nLajed\xE3o|BA|-17.61|-40.34\nChiapetta|RS|-27.92|-53.94\nLidian\xF3polis|PR|-24.11|-51.65\nEwbank da C\xE2mara|MG|-21.55|-43.51\nAlvarenga|MG|-19.42|-41.73\nMirav\xE2nia|MG|-14.73|-44.41\nIraceminha|SC|-26.82|-53.28\nPau D'Arco do Piau\xED|PI|-5.26|-42.39\n\xC1lvares Florence|SP|-20.32|-49.91\nBalbinos|SP|-21.9|-49.36\nSanto Ant\xF4nio do Itamb\xE9|MG|-18.46|-43.3\nBrejo do Piau\xED|PI|-8.2|-42.82\nJos\xE9 Gon\xE7alves de Minas|MG|-16.91|-42.6\nPalmin\xF3polis|GO|-16.79|-50.17\nCuparaque|MG|-18.96|-41.1\nCampina do Sim\xE3o|PR|-25.08|-51.82\nMaterl\xE2ndia|MG|-18.47|-43.06\nConcei\xE7\xE3o do Tocantins|TO|-12.22|-47.3\nPo\xE7o Dantas|PB|-6.4|-38.49\nVila Nova do Sul|RS|-30.35|-53.88\nCotipor\xE3|RS|-28.99|-51.7\nSant\xF3polis do Aguape\xED|SP|-21.64|-50.5\nTreviso|SC|-28.51|-49.46\nSanta Cruz de Salinas|MG|-16.1|-41.74\nDamian\xF3polis|GO|-14.56|-46.18\nMatutina|MG|-19.22|-45.97\nConquista D'Oeste|MT|-14.54|-59.54\nUni\xE3o do Sul|MT|-11.53|-54.36\nSandol\xE2ndia|TO|-12.54|-49.92\nSanto Ant\xF4nio do Aventureiro|MG|-21.76|-42.81\nTocos do Moji|MG|-22.37|-46.1\nRian\xE1polis|GO|-15.45|-49.51\nS\xE3o Bento do Trair\xED|RN|-6.34|-36.09\nS\xE3o Jos\xE9 do Barreiro|SP|-22.64|-44.58\nCampestre de Goi\xE1s|GO|-16.76|-49.7\nAlto Alegre|SP|-21.58|-50.17\nPaquet\xE1|PI|-7.1|-41.7\nCumbe|SE|-10.35|-37.18\nJoaquim Fel\xEDcio|MG|-17.76|-44.16\nJundi\xE1|RN|-6.27|-35.35\nBrasil\xE2ndia do Sul|PR|-24.2|-53.53\nPinhal Grande|RS|-29.34|-53.32\nCerro Branco|RS|-29.66|-52.94\nPedra Branca|PB|-7.42|-38.07\nCanhoba|SE|-10.14|-36.98\nS\xE3o Jos\xE9 da Safira|MG|-18.32|-42.14\nJaboticaba|RS|-27.63|-53.28\nRio Branco do Iva\xED|PR|-24.32|-51.32\nAra\xE7u|GO|-16.36|-49.68\nIbiquera|BA|-12.64|-40.93\nMombuca|SP|-22.93|-47.56\nPresidente Alves|SP|-22.1|-49.44\nVirmond|PR|-25.38|-52.2\nCampos Verdes|GO|-14.24|-49.65\nUni\xE3o de Minas|MG|-19.53|-50.34\nPeju\xE7ara|RS|-28.43|-53.66\nPrado Ferreira|PR|-23.04|-51.44\nSantana do Deserto|MG|-21.95|-43.16\nMinduri|MG|-21.68|-44.61\nPutinga|RS|-29.0|-52.16\nSerra Azul de Minas|MG|-18.36|-43.17\nIpia\xE7u|MG|-18.69|-49.94\nCampo Azul|MG|-16.5|-44.81\nJuramento|MG|-16.85|-43.59\nPonto Chique|MG|-16.63|-45.06\nNova Brasil\xE2ndia|MT|-14.96|-54.97\nIbirapuit\xE3|RS|-28.62|-52.52\nIbarama|RS|-29.42|-53.13\nCachoeira da Prata|MG|-19.52|-44.45\nVieiras|MG|-20.87|-42.24\nSarutai\xE1|SP|-23.27|-49.48\nVista Serrana|PB|-6.73|-37.57\nCorumbata\xED do Sul|PR|-24.1|-52.12\nVarj\xE3o|GO|-17.05|-49.63\nRio Crespo|RO|-9.7|-62.9\nDom Bosco|MG|-16.65|-46.26\nAnit\xE1polis|SC|-27.9|-49.13\nCampina\xE7u|GO|-13.79|-48.57\nFigueir\xE3o|MS|-18.68|-53.64\nJaquirana|RS|-28.88|-50.36\nProfessor Jamil|GO|-17.25|-49.24\nMurutinga do Sul|SP|-20.99|-51.28\nMontividiu do Norte|GO|-13.35|-48.69\nTaboc\xE3o|TO|-9.06|-48.52\nVila Flores|RS|-28.86|-51.55\nTaquarussu|MS|-22.49|-53.35\nOlho d'\xC1gua do Borges|RN|-5.95|-37.7\nPedra Grande|RN|-5.15|-35.88\nTunas|RS|-29.1|-52.95\nNova Maril\xE2ndia|MT|-14.36|-56.97\nDoutor Pedrinho|SC|-26.72|-49.48\nCaiabu|SP|-22.01|-51.24\nNova M\xF3dica|MG|-18.44|-41.5\nVarge\xE3o|SC|-26.86|-52.15\nLe\xF3polis|PR|-23.08|-50.75\nItaju|SP|-21.99|-48.81\nItamarati de Minas|MG|-21.42|-42.81\nAlegria|RS|-27.83|-54.06\nNovo Planalto|GO|-13.24|-49.51\nUruta\xED|GO|-17.47|-48.2\nPavussu|PI|-7.96|-43.23\nSandovalina|SP|-22.46|-51.76\nCampos Borges|RS|-28.89|-53.0\nPratinha|MG|-19.74|-46.38\nItapiratins|TO|-8.38|-48.11\nPaim Filho|RS|-27.71|-51.76\nSanto In\xE1cio do Piau\xED|PI|-7.42|-41.91\nBernardino Batista|PB|-6.45|-38.55\nOlivedos|PB|-6.98|-36.24\nMalhada dos Bois|SE|-10.34|-36.93\nIn\xFAbia Paulista|SP|-21.77|-50.96\nCristian\xF3polis|GO|-17.2|-48.7\nNossa Senhora das Gra\xE7as|PR|-22.91|-51.8\nSalto do C\xE9u|MT|-15.13|-58.13\nPara\xFA|RN|-5.77|-37.1\nNatal\xE2ndia|MG|-16.5|-46.49\nBocaina do Sul|SC|-27.75|-49.94\nSanta L\xFAcia|PR|-25.41|-53.56\nArroio Trinta|SC|-26.93|-51.34\nNovo Cabrais|RS|-29.73|-52.95\nBar\xE3o de Antonina|SP|-23.63|-49.56\nPinheiro Preto|SC|-27.05|-51.22\nS\xE3o Pedro da Serra|RS|-29.42|-51.51\nAreias|SP|-22.58|-44.7\nCruzeiro da Fortaleza|MG|-18.94|-46.67\nLagoa do Tocantins|TO|-10.37|-47.54\nLajedinho|BA|-12.35|-40.9\nBom Sucesso de Itarar\xE9|SP|-24.32|-49.15\nIta\xFAna do Sul|PR|-22.73|-52.89\nS\xE3o Fernando|RN|-6.38|-37.19\nSaltinho|SC|-26.6|-53.06\nCoronel Xavier Chaves|MG|-21.03|-44.22\nM\xE3e d'\xC1gua|PB|-7.25|-37.43\nJate\xED|MS|-22.48|-54.31\nXavantina|SC|-27.07|-52.34\nDiogo de Vasconcelos|MG|-20.49|-43.2\nConcei\xE7\xE3o da Barra de Minas|MG|-21.13|-44.47\nLucr\xE9cia|RN|-6.11|-37.81\nArapu\xE3|PR|-24.31|-51.79\nCatol\xE2ndia|BA|-12.31|-44.86\nMarip\xE1 de Minas|MG|-21.7|-42.95\nNovo Brasil|GO|-16.03|-50.71\nGameleira de Goi\xE1s|GO|-16.49|-48.65\nEntre Rios|SC|-26.72|-52.56\nLajeado|TO|-9.75|-48.36\nPescador|MG|-18.36|-41.6\nJosen\xF3polis|MG|-16.54|-42.52\nBandeirantes do Tocantins|TO|-7.76|-48.58\nHugo Napole\xE3o|PI|-5.99|-42.56\nSantana de Cataguases|MG|-21.29|-42.55\nNova Roma do Sul|RS|-28.99|-51.41\nSanta Isabel|GO|-15.3|-49.43\nMutun\xF3polis|GO|-13.73|-49.27\nSanta Rita do Trivelato|MT|-13.81|-55.27\nSanta F\xE9 de Minas|MG|-16.69|-45.41\nMari\xE1polis|SP|-21.8|-51.18\nS\xE3o Martinho|SC|-28.16|-48.99\nCalmon|SC|-26.59|-51.09\nRondol\xE2ndia|MT|-10.84|-61.47\nBel\xE9m do Piau\xED|PI|-7.37|-40.97\nPorto Vit\xF3ria|PR|-26.17|-51.23\nTaparuba|MG|-19.76|-41.61\nF\xE1tima|TO|-10.76|-48.91\nMuricil\xE2ndia|TO|-7.15|-48.61\nSulina|PR|-25.71|-52.73\nItaoca|SP|-24.64|-48.84\nAltamira do Paran\xE1|PR|-24.8|-52.71\nSantana dos Montes|MG|-20.79|-43.69\nTuru\xE7u|RS|-31.42|-52.17\nSanta Rosa da Serra|MG|-19.52|-45.96\nRancho Queimado|SC|-27.67|-49.02\nS\xE3o Jos\xE9 do Divino|MG|-18.48|-41.39\nFrei Lagonegro|MG|-18.18|-42.76\nVer\xEDssimo|MG|-19.67|-48.31\nHidrolina|GO|-14.73|-49.46\nQuadra|SP|-23.3|-48.05\nTriunfo Potiguar|RN|-5.85|-37.18\nSoss\xEAgo|PB|-6.77|-36.25\nConselheiro Mairinck|PR|-23.62|-50.17\nRancho Alegre|PR|-23.07|-50.91\nPresidente Juscelino|MG|-18.64|-44.06\nS\xE3o Miguel do Aleixo|SE|-10.38|-37.38\nAltair|SP|-20.52|-49.06\nSuzan\xE1polis|SP|-20.5|-51.03\nSeveriano de Almeida|RS|-27.44|-52.12\nS\xE3o Jos\xE9 dos Cordeiros|PB|-7.39|-36.81\nPequeri|MG|-21.83|-43.11\n\xC1urea|RS|-27.69|-52.05\nRecursol\xE2ndia|TO|-8.72|-47.24\nFortaleza de Minas|MG|-20.85|-46.71\nCastanheiras|RO|-11.43|-61.95\nSanta Cruz dos Milagres|PI|-5.81|-41.95\nS\xE3o Bento do Norte|RN|-5.09|-35.96\nIbiti\xFAra de Minas|MG|-22.06|-46.44\nPonga\xED|SP|-21.74|-49.36\nSalgadinho|PB|-7.1|-36.85\nRomaria|MG|-18.88|-47.58\nCarvalh\xF3polis|MG|-21.77|-45.84\nAurora do Tocantins|TO|-12.71|-46.41\nMarapoama|SP|-21.26|-49.13\nJari|RS|-29.29|-54.22\nCanavieira|PI|-7.69|-43.72\nJacutinga|RS|-27.73|-52.54\nPedrin\xF3polis|MG|-19.22|-47.46\nJa\xFA do Tocantins|TO|-12.65|-48.59\nTelha|SE|-10.21|-36.88\nNova Rosal\xE2ndia|TO|-10.57|-48.91\nS\xE3o Sebasti\xE3o do Umbuzeiro|PB|-8.15|-37.01\nLeoberto Leal|SC|-27.51|-49.28\nJundia\xED do Sul|PR|-23.44|-50.25\nPorto Rico|PR|-22.77|-53.27\nSerra Alta|SC|-26.72|-53.04\nBias Fortes|MG|-21.6|-43.76\nPedra do Anta|MG|-20.6|-42.71\nQueiroz|SP|-21.8|-50.24\nUruana de Minas|MG|-16.06|-46.24\nSanta M\xF4nica|PR|-23.11|-53.11\nCai\xE7ara do Rio do Vento|RN|-5.77|-35.99\nDuas Estradas|PB|-6.68|-35.42\nSanta Am\xE9lia|PR|-23.27|-50.43\nTio Hugo|RS|-28.57|-52.6\nSanta Cec\xEDlia do Pav\xE3o|PR|-23.52|-50.78\n\xC2ngulo|PR|-23.19|-51.92\nGurj\xE3o|PB|-7.25|-36.49\nGramado Xavier|RS|-29.27|-52.58\nPont\xE3o|RS|-28.06|-52.68\nCacimba de Areia|PB|-7.12|-37.16\nCarrasco Bonito|TO|-5.31|-48.03\nHeitora\xED|GO|-15.72|-49.83\nFernando de Noronha|PE|-3.84|-32.41\nS\xE3o Jos\xE9 do Bonfim|PB|-7.16|-37.3\nBarreiras do Piau\xED|PI|-9.93|-45.47\nSanta Rita de Ibitipoca|MG|-21.57|-43.92\nS\xE3o Francisco|SE|-10.34|-36.89\nPlanalto da Serra|MT|-14.65|-54.78\nS\xE3o Jos\xE9 de Princesa|PB|-7.74|-38.09\nBraga|RS|-27.62|-53.74\nS\xE3o Valentim|RS|-27.56|-52.52\nColorado|RS|-28.53|-52.99\nLastro|PB|-6.51|-38.17\nVit\xF3ria das Miss\xF5es|RS|-28.35|-54.5\nMarmel\xF3polis|MG|-22.45|-45.16\nCampestre da Serra|RS|-28.79|-51.09\nBaliza|GO|-16.2|-52.54\nVila Flor|RN|-6.31|-35.07\nCerro Negro|SC|-27.79|-50.87\nS\xE3o Jos\xE9 do Peixe|PI|-7.49|-42.57\nIbicar\xE9|SC|-27.09|-51.37\nEsperan\xE7a do Sul|RS|-27.36|-53.99\nBelmiro Braga|MG|-21.94|-43.41\nBon\xF3polis|GO|-13.63|-49.81\nPiquerobi|SP|-21.87|-51.73\nNova Am\xE9rica da Colina|PR|-23.33|-50.72\nVera Mendes|PI|-7.6|-41.47\nLeandro Ferreira|MG|-19.72|-45.03\nPrimavera de Rond\xF4nia|RO|-11.83|-61.32\nAmaralina|GO|-13.92|-49.3\nNovo Horizonte do Norte|MT|-11.41|-57.35\nAtalanta|SC|-27.42|-49.78\nBandeirante|SC|-26.77|-53.64\nEsmeralda|RS|-28.05|-51.19\nSanta In\xEAs|PB|-7.62|-38.55\nMajor Gercino|SC|-27.42|-48.95\nRuy Barbosa|RN|-5.89|-35.93\nMonte Alegre dos Campos|RS|-28.68|-50.78\nMato Rico|PR|-24.7|-52.15\nBom Sucesso do Sul|PR|-26.07|-52.84\nS\xE3o F\xE9lix de Minas|MG|-18.6|-41.49\nPonte Alta do Norte|SC|-27.16|-50.47\nItatiba do Sul|RS|-27.38|-52.45\nNovo Machado|RS|-27.58|-54.5\nS\xE3o Sebasti\xE3o da Vargem Alegre|MG|-19.75|-43.37\nAuril\xE2ndia|GO|-16.68|-50.46\nLagoa dos Patos|MG|-16.98|-44.58\nCordisl\xE2ndia|MG|-21.79|-45.7\nAnt\xF4nio Almeida|PI|-7.21|-44.19\nPassagem|RN|-6.27|-35.37\nQuartel Geral|MG|-19.27|-45.56\nBarra do Guarita|RS|-27.19|-53.71\nFaria Lemos|MG|-20.81|-42.02\nFortuna de Minas|MG|-19.56|-44.45\nNova Alvorada|RS|-28.68|-52.16\nNovo Itacolomi|PR|-23.76|-51.51\nWestf\xE1lia|RS|-29.43|-51.76\nSanta B\xE1rbara do Monte Verde|MG|-21.96|-43.7\nEstrela do Norte|GO|-13.87|-49.07\nRio Bom|PR|-23.76|-51.41\nLamim|MG|-20.79|-43.47\nVale Verde|RS|-29.79|-52.19\nMagda|SP|-20.64|-50.23\nSebasti\xE3o Barros|PI|-10.82|-44.83\nMira Estrela|SP|-19.98|-50.14\nMar Vermelho|AL|-9.45|-36.39\nGast\xE3o Vidigal|SP|-20.79|-50.19\nMampituba|RS|-29.21|-49.93\nS\xE3o Geraldo da Piedade|MG|-18.84|-42.29\nCh\xE1cara|MG|-21.67|-43.22\nOurizona|PR|-23.41|-52.2\nTaquaru\xE7u do Sul|RS|-27.4|-53.47\nPortel\xE2ndia|GO|-17.36|-52.68\nSebastian\xF3polis do Sul|SP|-20.65|-49.92\nElisi\xE1rio|SP|-21.17|-49.11\nCap\xE3o do Cip\xF3|RS|-28.93|-54.56\nDom Vi\xE7oso|MG|-22.25|-45.16\nJaguara\xE7u|MG|-19.65|-42.75\nChapada da Natividade|TO|-11.62|-47.75\nS\xE3o Francisco|PB|-6.61|-38.1\nSanta Tereza de Goi\xE1s|GO|-13.71|-49.01\nMauril\xE2ndia do Tocantins|TO|-5.95|-47.51\nGalv\xE3o|SC|-26.45|-52.69\nPresidente Lucena|RS|-29.52|-51.18\nPresidente Kubitschek|MG|-18.62|-43.56\nMorro do Pilar|MG|-19.22|-43.38\nRibeira|SP|-24.65|-49.0\nS\xE3o Geraldo do Baixio|MG|-18.91|-41.36\nDois Lajeados|RS|-28.98|-51.84\nSerra da Raiz|PB|-6.69|-35.44\nImigrante|RS|-29.35|-51.77\nDiamante do Sul|PR|-25.04|-52.68\nAlto Feliz|RS|-29.39|-51.31\nAlgod\xE3o de Janda\xEDra|PB|-6.89|-36.01\nS\xE3o Pedro do Buti\xE1|RS|-28.12|-54.89\nPitangueiras|PR|-23.23|-51.59\nPorto Estrela|MT|-15.32|-57.22\nBuritin\xF3polis|GO|-14.48|-46.41\nNova Candel\xE1ria|RS|-27.61|-54.11\nCajazeiras do Piau\xED|PI|-6.8|-42.39\nDona Francisca|RS|-29.62|-53.36\nMorrinhos do Sul|RS|-29.36|-49.93\nJumirim|SP|-23.09|-47.79\nNova Bel\xE9m|MG|-18.49|-41.11\nCatas Altas da Noruega|MG|-20.69|-43.49\nErebango|RS|-27.85|-52.3\nGeneral Maynard|SE|-10.68|-36.98\nEstrela Velha|RS|-29.17|-53.16\nPalestina de Goi\xE1s|GO|-16.74|-51.53\nNova Br\xE9scia|RS|-29.22|-52.03\nS\xE3o Gon\xE7alo do Rio Preto|MG|-18.0|-43.39\nErnestina|RS|-28.5|-52.58\nMorro Grande|SC|-28.8|-49.72\nPrata do Piau\xED|PI|-5.67|-42.2\nGuarar\xE1|MG|-21.73|-43.03\nNova Igua\xE7u de Goi\xE1s|GO|-14.29|-49.39\nSim\xE3o Pereira|MG|-21.96|-43.31\nTen\xF3rio|PB|-6.94|-36.63\nPlanalto Alegre|SC|-27.07|-52.87\nTrombas|GO|-13.51|-48.74\nPrincesa|SC|-26.44|-53.6\nSanto Expedito|SP|-21.85|-51.39\nAlto Para\xEDso|PR|-26.11|-52.75\nSenhora do Porto|MG|-18.89|-43.08\nCaseiros|RS|-28.26|-51.69\nEmilian\xF3polis|SP|-21.83|-51.48\nCamargo|RS|-28.59|-52.2\nDesterro do Melo|MG|-21.14|-43.52\nPorto Barreiro|PR|-25.55|-52.41\nFigueir\xF3polis D'Oeste|MT|-15.44|-58.74\nSerra Grande|PB|-7.21|-38.36\nPlatina|SP|-22.64|-50.21\nChapad\xE3o do Lageado|SC|-27.59|-49.55\nMathias Lobato|MG|-18.59|-41.92\nAparecida do Rio Doce|GO|-18.29|-51.15\nLagoinha do Piau\xED|PI|-5.83|-42.62\nPeritiba|SC|-27.38|-51.9\nTamboril do Piau\xED|PI|-8.41|-42.92\nPinhal|RS|-27.51|-53.21\nItacurubi|RS|-28.79|-55.24\nEmas|PB|-7.1|-37.72\nFernando Pedroza|RN|-5.69|-36.53\nJo\xE3o Costa|PI|-8.51|-42.43\nPaje\xFA do Piau\xED|PI|-7.86|-42.82\nParisi|SP|-20.3|-50.02\n\xC1gua Nova|RN|-6.2|-38.29\nAlbertina|MG|-22.2|-46.61\nS\xE3o Gon\xE7alo do Gurgu\xE9ia|PI|-10.03|-45.31\nOn\xE7a de Pitangui|MG|-19.73|-44.81\nNova Roma|GO|-13.74|-46.87\nSanta Mercedes|SP|-21.35|-51.76\nPresidente Kennedy|TO|-8.54|-48.51\nS\xE3o Jo\xE3o da Mata|MG|-21.93|-45.93\nRafael Godeiro|RN|-6.07|-37.72\nVenha-Ver|RN|-6.32|-38.49\nSanta Cruz de Goi\xE1s|GO|-17.32|-48.48\nOuro Velho|PB|-7.62|-37.15\n\xC1guas Frias|SC|-26.88|-52.86\nPerol\xE2ndia|GO|-17.53|-52.06\nArantina|MG|-21.91|-44.26\nCapit\xE3o|RS|-29.27|-51.99\nFarol|PR|-24.1|-52.62\nAvelin\xF3polis|GO|-16.47|-49.76\nPil\xF5es|RN|-6.26|-38.05\nGlaucil\xE2ndia|MG|-16.85|-43.69\nFrancisco Macedo|PI|-7.33|-40.79\nS\xE3o Bonif\xE1cio|SC|-27.9|-48.93\nS\xEDtio d'Abadia|GO|-14.8|-46.25\nS\xE3o Jorge|RS|-28.5|-51.71\nTr\xEAs Ranchos|GO|-18.35|-47.78\nVila Nova do Piau\xED|PI|-7.13|-40.93\nAnahy|PR|-24.64|-53.13\nIpiranga de Goi\xE1s|GO|-15.17|-49.67\nIomer\xEA|SC|-27.0|-51.24\nPorto Alegre do Tocantins|TO|-11.62|-47.06\nC\xE2ndido Rodrigues|SP|-21.33|-48.63\nC\xF3rrego Danta|MG|-19.82|-45.9\nSalvador das Miss\xF5es|RS|-28.12|-54.84\nCumari|GO|-18.26|-48.15\nLizarda|TO|-9.59|-46.67\nRiach\xE3o|PB|-6.54|-35.66\nCarana\xEDba|MG|-20.87|-43.74\nMarzag\xE3o|GO|-17.98|-48.64\nJaupaci|GO|-16.18|-50.95\nMuitos Cap\xF5es|RS|-28.31|-51.18\nTesouro|MT|-16.08|-53.56\n\xC1guas de S\xE3o Pedro|SP|-22.6|-47.87\nMateiros|TO|-10.55|-46.42\nAlvinl\xE2ndia|SP|-22.44|-49.76\nPedra Dourada|MG|-20.83|-42.15\nFrei Martinho|PB|-6.4|-36.45\nGodoy Moreira|PR|-24.17|-51.92\nS\xE3o Martinho da Serra|RS|-29.54|-53.86\nSanta Tereza do Tocantins|TO|-10.27|-47.8\nAmorin\xF3polis|GO|-16.62|-51.09\nAren\xF3polis|GO|-16.38|-51.56\nSanta Cruz do Xingu|MT|-10.15|-52.4\nAngico|TO|-6.39|-47.86\nC\xF3rrego Novo|MG|-19.84|-42.4\nSul Brasil|SC|-26.74|-52.96\nBom Jesus|SC|-26.73|-52.39\nCoronel Barros|RS|-28.39|-54.07\nVale de S\xE3o Domingos|MT|-15.29|-59.07\nNovo Santo Ant\xF4nio|PI|-5.29|-41.93\nCampan\xE1rio|MG|-18.24|-41.74\nS\xE3o F\xE9lix do Piau\xED|PI|-5.93|-42.12\nGl\xF3ria D'Oeste|MT|-15.77|-58.31\nBarra do Jacar\xE9|PR|-23.12|-50.18\nCastel\xE2ndia|GO|-18.09|-50.2\nCruzmaltina|PR|-24.01|-51.46\nChiador|MG|-22.0|-43.06\nRio dos \xCDndios|RS|-27.3|-52.84\nCelso Ramos|SC|-27.63|-51.34\nS\xE3o Miguel do Fidalgo|PI|-7.6|-42.37\nC\xE1ssia dos Coqueiros|SP|-21.28|-47.16\nGoiabeira|MG|-18.98|-41.22\nDilermando de Aguiar|RS|-29.71|-54.21\nPedran\xF3polis|SP|-20.25|-50.11\nPiau|MG|-21.51|-43.31\nCamacho|MG|-20.63|-45.16\nRio dos Bois|TO|-9.34|-48.52\nS\xE3o Jos\xE9 do Mantimento|MG|-20.01|-41.75\nVista Ga\xFAcha|RS|-27.29|-53.7\nConcei\xE7\xE3o das Pedras|MG|-22.16|-45.46\nPedrinhas Paulista|SP|-22.82|-50.79\nVictor Graeff|RS|-28.56|-52.75\nSanta Rosa de Goi\xE1s|GO|-16.08|-49.5\nAlagoa|MG|-22.17|-44.64\nNova Luzit\xE2nia|SP|-20.86|-50.26\nBoa Vista do Sul|RS|-29.35|-51.67\nMorma\xE7o|RS|-28.7|-52.7\nFernandes Tourinho|MG|-19.15|-42.08\nGabriel Monteiro|SP|-21.53|-50.56\nTr\xEAs Forquilhas|RS|-29.54|-50.07\nLuzin\xF3polis|TO|-6.18|-47.86\nPedra Mole|SE|-10.61|-37.69\nS\xE3o Domingos do Sul|RS|-28.53|-51.89\nPinhal de S\xE3o Bento|PR|-26.03|-53.48\nComendador Gomes|MG|-19.7|-49.08\nBorebi|SP|-22.57|-48.97\nBuriti de Goi\xE1s|GO|-16.18|-50.43\nCharrua|RS|-27.95|-52.02\nUirapuru|GO|-14.28|-49.92\nSanta Rita d'Oeste|SP|-20.14|-50.84\nSantana do Serid\xF3|RN|-6.77|-36.73\nDerrubadas|RS|-27.26|-53.86\nUni\xE3o do Oeste|SC|-26.76|-52.85\nManfrin\xF3polis|PR|-26.14|-53.31\nCoronel Pacheco|MG|-21.59|-43.26\nMatos Costa|SC|-26.47|-51.15\nPindoba|AL|-9.47|-36.29\nPinto Bandeira|RS|-29.1|-51.45\nAroeiras do Itaim|PI|-7.25|-41.53\nCenten\xE1rio|RS|-27.76|-52.0\nV\xE1rzea|PB|-6.76|-36.99\nZacarias|SP|-21.05|-50.06\nCajazeirinhas|PB|-6.96|-37.8\nFrancisco Dantas|RN|-6.07|-38.12\nDamol\xE2ndia|GO|-16.25|-49.36\nFormosa do Sul|SC|-26.65|-52.79\nCascalho Rico|MG|-18.58|-47.87\nEstrela do Norte|SP|-22.49|-51.66\nUrupema|SC|-27.96|-49.87\nSede Nova|RS|-27.64|-53.95\nFloreal|SP|-20.68|-50.15\nCristal do Sul|RS|-27.45|-53.24\nUmburatiba|MG|-17.25|-40.58\nRubi\xE1cea|SP|-21.3|-50.73\nIbituruna|MG|-21.15|-44.75\nRibeir\xE3ozinho|MT|-16.49|-52.69\nIvol\xE2ndia|GO|-16.6|-50.79\nOlho D'\xC1gua do Piau\xED|PI|-5.84|-42.56\nEntre Rios do Sul|RS|-27.53|-52.73\nS\xE3o Pedro do Paran\xE1|PR|-22.82|-53.22\nSenador Salgado Filho|RS|-28.02|-54.55\nGarruchos|RS|-28.19|-55.64\nRiacho da Cruz|RN|-5.93|-37.95\nCoxilha|RS|-28.13|-52.3\nSanta Maria do Tocantins|TO|-8.8|-47.79\nS\xE3o Jos\xE9 do Povo|MT|-16.45|-54.25\nArgirita|MG|-21.61|-42.83\nS\xE3o Bernardino|SC|-26.47|-52.97\nJupi\xE1|SC|-26.39|-52.73\nBelmonte|SC|-26.84|-53.58\nEstrela do Indai\xE1|MG|-19.52|-45.79\nFl\xF3rida|PR|-23.08|-51.95\nVista Alegre|RS|-27.37|-53.49\nSanto Andr\xE9|PB|-7.22|-36.62\nS\xE3o Jo\xE3o do Pol\xEAsine|RS|-29.62|-53.44\nLut\xE9cia|SP|-22.34|-50.39\nNantes|SP|-22.62|-51.24\nItati|RS|-29.5|-50.1\nSanta Clara d'Oeste|SP|-20.09|-50.95\nCarm\xE9sia|MG|-19.09|-43.14\nSanto Hip\xF3lito|MG|-18.3|-44.22\nS\xE3o Domingos do Cariri|PB|-7.63|-36.44\nIvatuba|PR|-23.62|-52.22\nEug\xEAnio de Castro|RS|-28.53|-54.15\nAbreul\xE2ndia|TO|-9.62|-49.15\nFama|MG|-21.41|-45.83\nArapu\xE1|MG|-19.03|-46.15\nLajeado do Bugre|RS|-27.69|-53.18\nNovo Horizonte|SC|-26.44|-52.83\nSanta Margarida do Sul|RS|-30.34|-54.08\nTeresina de Goi\xE1s|GO|-13.78|-47.27\nPalmeira|SC|-27.58|-50.16\nArroio do Padre|RS|-31.44|-52.42\nTaquaral|SP|-21.07|-48.41\nCafeara|PR|-22.79|-51.71\nBento de Abreu|SP|-21.27|-50.81\nCap\xE3o Alto|SC|-27.94|-50.51\nTr\xEAs Arroios|RS|-27.5|-52.14\nInga\xED|MG|-21.4|-44.92\nLagoa de Velhos|RN|-6.01|-35.87\nMairipotaba|GO|-17.3|-49.49\nAbdon Batista|SC|-27.61|-51.02\nMimoso de Goi\xE1s|GO|-15.05|-48.16\nS\xE3o Domingos|PB|-6.8|-37.95\nArvoredo|SC|-27.07|-52.45\nRancho Alegre D'Oeste|PR|-24.31|-52.96\nS\xE3o Francisco|SP|-20.36|-50.7\nS\xE3o Jo\xE3o das Duas Pontes|SP|-20.39|-50.38\nFagundes Varela|RS|-28.88|-51.7\nSaldanha Marinho|RS|-28.39|-53.1\nOl\xEDmpio Noronha|MG|-22.07|-45.27\nDom Pedro de Alc\xE2ntara|RS|-29.36|-49.85\nLuciara|MT|-11.22|-50.67\nVargem|SC|-27.49|-50.97\nMato Castelhano|RS|-28.28|-52.19\nSanta Rita do Novo Destino|GO|-15.14|-49.12\nMonte Belo do Sul|RS|-29.16|-51.63\nJoca Claudino|PB|-6.48|-38.48\nBrejo Alegre|SP|-21.17|-50.19\nHerveiras|RS|-29.46|-52.66\nToropi|RS|-29.48|-54.22\nS\xE3o Val\xE9rio do Sul|RS|-27.79|-53.94\nPracinha|SP|-21.85|-51.09\nMato Grosso|PB|-6.54|-37.73\nPassagem|PB|-7.13|-37.04\nFaxinalzinho|RS|-27.42|-52.68\nBarra Funda|RS|-27.92|-53.04\nMirim Doce|SC|-27.2|-50.08\nQuevedos|RS|-29.35|-54.08\nRio Doce|MG|-20.24|-42.9\nDezesseis de Novembro|RS|-28.22|-55.06\nTigrinhos|SC|-26.69|-53.15\n\xD3leo|SP|-22.94|-49.34\nSanta Terezinha do Progresso|SC|-26.62|-53.2\nSagrada Fam\xEDlia|RS|-27.71|-53.14\nSagres|SP|-21.88|-50.96\nMarat\xE1|RS|-29.55|-51.56\nMonte Santo do Tocantins|TO|-10.01|-48.99\nPedro Laurentino|PI|-8.07|-42.28\nIsrael\xE2ndia|GO|-16.31|-50.91\nMorro Agudo de Goi\xE1s|GO|-15.32|-50.06\nTalism\xE3|TO|-12.79|-49.09\nOscar Bressane|SP|-22.31|-50.28\nPedra Preta|RN|-5.57|-36.11\nJardim de Angicos|RN|-5.65|-35.97\nTimburi|SP|-23.21|-49.61\nInaj\xE1|PR|-22.75|-52.2\nSanta Helena|SC|-26.94|-53.62\nColinas|RS|-29.39|-51.86\nSanto Ant\xF4nio do Caiu\xE1|PR|-22.74|-52.34\nS\xE3o Jos\xE9 do Inhacor\xE1|RS|-27.73|-54.13\nItapor\xE3 do Tocantins|TO|-8.57|-48.69\nSanta Terezinha do Tocantins|TO|-6.44|-47.67\nS\xE3o Jos\xE9 do Sul|RS|-29.54|-51.48\nC\xF3rrego do Ouro|GO|-16.29|-50.55\nForquetinha|RS|-29.38|-52.1\nFrei Rog\xE9rio|SC|-27.18|-50.81\nBrun\xF3polis|SC|-27.31|-50.87\nPanam\xE1|GO|-18.18|-49.35\nRio Rufino|SC|-27.86|-49.78\nCerro Grande|RS|-27.61|-53.17\nMorro da Gar\xE7a|MG|-18.54|-44.6\nTimba\xFAba dos Batistas|RN|-6.46|-37.27\nLucian\xF3polis|SP|-22.43|-49.52\nBoa Esperan\xE7a do Igua\xE7u|PR|-25.63|-53.21\nSem-Peixe|MG|-20.1|-42.85\nSanto Afonso|MT|-14.49|-57.01\nPontes Gestal|SP|-20.17|-49.71\nTaboleiro Grande|RN|-5.92|-38.04\nNacip Raydan|MG|-18.45|-42.25\nSilveir\xE2nia|MG|-21.16|-43.21\nS\xE3o Jos\xE9 das Miss\xF5es|RS|-27.78|-53.12\nBiquinhas|MG|-18.78|-45.5\nSanto Expedito do Sul|RS|-27.91|-51.64\nNova P\xE1dua|RS|-29.03|-51.31\nS\xE3o Sebasti\xE3o do Rio Verde|MG|-22.22|-44.98\nPorto Alegre do Piau\xED|PI|-6.96|-44.18\nNova Am\xE9rica|GO|-15.02|-49.9\nWenceslau Braz|MG|-22.54|-45.36\nRochedo de Minas|MG|-21.63|-43.02\nCarrapateira|PB|-7.03|-38.34\nBod\xF3|RN|-5.98|-36.42\nS\xE3o Salvador do Tocantins|TO|-12.75|-48.24\nArape\xED|SP|-22.67|-44.44\nErmo|SC|-28.99|-49.64\nFloresta do Piau\xED|PI|-7.47|-41.79\nParanapoema|PR|-22.64|-52.09\nAriranha do Iva\xED|PR|-24.39|-51.58\nEmba\xFAba|SP|-20.98|-48.83\nPresidente Nereu|SC|-27.28|-49.39\nMonte das Gameleiras|RN|-6.44|-35.78\nCachoeira Dourada|MG|-18.52|-49.5\nSenador Cortes|MG|-21.8|-42.94\nRolador|RS|-28.26|-54.82\nAmparo|PB|-7.55|-37.06\nBom Jesus|PB|-6.82|-38.65\nIracema do Oeste|PR|-24.43|-53.35\nZabel\xEA|PB|-8.08|-37.11\nTanque do Piau\xED|PI|-6.6|-42.28\nCurral Velho|PB|-7.53|-38.2\nBoa Vista do Incra|RS|-28.82|-53.39\nPassa Vinte|MG|-22.21|-44.23\nPimenteiras do Oeste|RO|-13.48|-61.05\nS\xE3o Vendelino|RS|-29.37|-51.37\nJuarina|TO|-8.12|-49.06\nLacerd\xF3polis|SC|-27.26|-51.56\nPinhal da Serra|RS|-27.88|-51.17\nSanta Rita do Tocantins|TO|-10.86|-48.92\nS\xE3o Miguel da Baixa Grande|PI|-5.86|-42.19\nS\xE3o Jo\xE3o do Pau d'Alho|SP|-21.27|-51.67\nLagoa Bonita do Sul|RS|-29.49|-53.02\nAdel\xE2ndia|GO|-16.41|-50.17\nS\xE3o Luis do Piau\xED|PI|-6.82|-41.32\nBoa Vista do Cadeado|RS|-28.58|-53.81\nPalmelo|GO|-17.33|-48.43\nCasa Grande|MG|-20.79|-43.93\nPirap\xF3|RS|-28.04|-55.2\nS\xE3o Valentim do Sul|RS|-29.05|-51.77\nDolcin\xF3polis|SP|-20.12|-50.51\nPilar de Goi\xE1s|GO|-14.76|-49.58\nNovo Jardim|TO|-11.83|-46.63\nCoqueiros do Sul|RS|-28.12|-52.78\nMirador|PR|-23.25|-52.78\nCarmol\xE2ndia|TO|-7.03|-48.4\nBom Jesus do Oeste|SC|-26.69|-53.1\nPiraqu\xEA|TO|-6.77|-48.3\nPo\xE7o das Antas|RS|-29.45|-51.67\nPugmil|TO|-10.42|-48.9\nAra\xE7a\xED|MG|-19.2|-44.25\nMarema|SC|-26.8|-52.63\nPainel|SC|-27.92|-50.1\nGuaporema|PR|-23.34|-52.78\nVargem Bonita|MG|-20.33|-46.37\nAmparo do S\xE3o Francisco|SE|-10.13|-36.94\nS\xE3o Patr\xEDcio|GO|-15.35|-49.82\nNova Ramada|RS|-28.07|-53.7\nBozano|RS|-28.37|-53.77\nOuro Verde|SC|-26.69|-52.31\nTravesseiro|RS|-29.3|-52.05\nEstrela Dalva|MG|-21.74|-42.46\nNova Guataporanga|SP|-21.33|-51.64\nPaulo Bento|RS|-27.71|-52.42\nMonjolos|MG|-18.32|-44.12\nNovo Tiradentes|RS|-27.56|-53.18\nS\xE3o Manoel do Paran\xE1|PR|-23.39|-52.65\nPorto Mau\xE1|RS|-27.58|-54.67\nIndiava\xED|MT|-15.49|-58.58\nSantana do Garamb\xE9u|MG|-21.6|-44.1\n\xC1gua Comprida|MG|-20.06|-48.11\nGuara\xEDta|GO|-15.61|-50.03\nSanto Ant\xF4nio dos Milagres|PI|-6.05|-42.71\nItamb\xE9 do Mato Dentro|MG|-19.42|-43.32\nSanta Cruz da Esperan\xE7a|SP|-21.3|-47.43\nGalinhos|RN|-5.09|-36.28\nIguatu|PR|-24.72|-53.08\nPaulist\xE2nia|SP|-22.58|-49.4\nGuarinos|GO|-14.73|-49.7\nSenador Jos\xE9 Bento|MG|-22.16|-46.18\nSanto Ant\xF4nio do Planalto|RS|-28.4|-52.7\nSanto Ant\xF4nio do Palma|RS|-28.5|-52.03\nBom Progresso|RS|-27.54|-53.87\nDois Irm\xE3os das Miss\xF5es|RS|-27.66|-53.53\nNova Aurora|GO|-18.06|-48.26\nSanta Rosa de Lima|SC|-28.03|-49.13\nCruz\xE1lia|SP|-22.74|-50.79\nVila L\xE2ngaro|RS|-28.11|-52.14\nBenjamin Constant do Sul|RS|-27.51|-52.6\nJes\xFApolis|GO|-15.95|-49.37\nCenten\xE1rio|TO|-8.96|-47.33\nUniflor|PR|-23.09|-52.16\nPedras Altas|RS|-31.74|-53.58\nIrati|SC|-26.65|-52.9\nPonte Branca|MT|-16.76|-52.84\nAracitaba|MG|-21.34|-43.37\nTaipas do Tocantins|TO|-12.19|-46.98\nIpueira|RN|-6.81|-37.2\nArco-\xCDris|SP|-21.77|-50.47\nNova Boa Vista|RS|-27.99|-52.98\nS\xE9rio|RS|-29.39|-52.27\nSanto Ant\xF4nio do Para\xEDso|PR|-23.5|-50.65\nJo\xE3o Dias|RN|-6.27|-37.79\nProt\xE1sio Alves|RS|-28.76|-51.48\nJacuizinho|RS|-29.04|-53.07\nRiacho de Santo Ant\xF4nio|PB|-7.68|-36.16\nIbiam|SC|-27.18|-51.24\nOliveira Fortes|MG|-21.34|-43.45\nSilveira Martins|RS|-29.65|-53.59\nTorre de Pedra|SP|-23.25|-48.2\nNova Cana\xE3 Paulista|SP|-20.38|-50.95\nGramado dos Loureiros|RS|-27.44|-52.91\nInhacor\xE1|RS|-27.88|-54.02\nUnistalda|RS|-29.04|-55.15\nVanini|RS|-28.48|-51.84\nNovo Santo Ant\xF4nio|MT|-12.29|-50.97\nRibeir\xE3o dos \xCDndios|SP|-21.84|-51.61\nSerranos|MG|-21.89|-44.51\nAreia de Bara\xFAnas|PB|-7.12|-36.94\nCunhata\xED|SC|-26.97|-53.09\nUbiretama|RS|-28.04|-54.69\nTupirama|TO|-8.97|-48.19\nReserva do Caba\xE7al|MT|-15.07|-58.46\nMiraselva|PR|-22.97|-51.48\nBrasil\xE2ndia do Tocantins|TO|-8.39|-48.48\nAlmirante Tamandar\xE9 do Sul|RS|-28.11|-52.91\nPaial|SC|-27.25|-52.5\nGuarani d'Oeste|SP|-20.07|-50.34\nCoronel Martins|SC|-26.51|-52.67\nDiorama|GO|-16.23|-51.25\nMes\xF3polis|SP|-19.97|-50.63\nOlaria|MG|-21.86|-43.94\nCachoeirinha|TO|-6.12|-47.92\nNicolau Vergueiro|RS|-28.53|-52.47\nAlo\xE2ndia|GO|-17.73|-49.48\nBoa Vista das Miss\xF5es|RS|-27.67|-53.31\nItapuca|RS|-28.78|-52.17\nIvor\xE1|RS|-29.52|-53.58\nLourdes|SP|-20.97|-50.23\nMon\xE7\xF5es|SP|-20.85|-50.1\nSerra Nova Dourada|MT|-12.09|-51.4\nS\xE3o Jos\xE9 do Herval|RS|-29.05|-52.3\nDoutor Ricardo|RS|-29.08|-52.0\nVi\xE7osa|RN|-5.98|-37.95\nS\xE3o F\xE9lix do Tocantins|TO|-10.16|-46.66\nDavin\xF3polis|GO|-18.15|-47.56\nCoxixola|PB|-7.62|-36.61\nTupiratins|TO|-8.39|-48.13\nMariano Moro|RS|-27.36|-52.15\nS\xE3o Jo\xE3o de Iracema|SP|-20.51|-50.36\nSete de Setembro|RS|-28.14|-54.46\nAsp\xE1sia|SP|-20.16|-50.73\nDouradoquara|MG|-18.43|-47.6\nFlor do Sert\xE3o|SC|-26.78|-53.35\nSeritinga|MG|-21.91|-44.52\nMarin\xF3polis|SP|-20.44|-50.83\nPedro Teixeira|MG|-21.71|-43.74\nSanto Ant\xF4nio do Rio Abaixo|MG|-19.24|-43.26\nEsperan\xE7a Nova|PR|-23.72|-53.81\nVespasiano Corr\xEAa|RS|-29.07|-51.86\nAlto Bela Vista|SC|-27.43|-51.9\n\xC1gua Limpa|GO|-18.08|-48.76\nAlto Alegre|RS|-28.78|-52.99\nTuri\xFAba|SP|-20.94|-50.11\nMato Queimado|RS|-28.25|-54.62\nVit\xF3ria Brasil|SP|-20.2|-50.49\nRio da Concei\xE7\xE3o|TO|-11.39|-46.88\nRelvado|RS|-29.12|-52.08\nNovo Alegre|TO|-12.92|-46.57\nS\xE3o Jo\xE3o da Para\xFAna|GO|-16.81|-50.41\nJardin\xF3polis|SC|-26.72|-52.86\nQuixaba|PB|-7.02|-37.15\nMacieira|SC|-26.86|-51.37\nQueluzito|MG|-20.74|-43.89\nLajeado Grande|SC|-26.86|-52.56\nS\xE3o Pedro das Miss\xF5es|RS|-27.77|-53.25\nGentil|RS|-28.43|-52.03\nLagoa dos Tr\xEAs Cantos|RS|-28.57|-52.86\nS\xE3o Miguel da Boa Vista|SC|-26.69|-53.25\nPouso Novo|RS|-29.17|-52.21\nCap\xE3o Bonito do Sul|RS|-28.13|-51.4\nMuliterno|RS|-28.33|-51.77\nS\xE3o Jos\xE9 do Brejo do Cruz|PB|-6.21|-37.36\nIpiranga do Sul|RS|-27.94|-52.43\nParari|PB|-7.31|-36.65\nSanta In\xEAs|PR|-22.64|-51.9\nSantiago do Sul|SC|-26.64|-52.68\nTrabiju|SP|-22.04|-48.33\nBarra do Rio Azul|RS|-27.41|-52.41\nLinha Nova|RS|-29.47|-51.2\nSanta Cec\xEDlia do Sul|RS|-28.16|-51.93\nPresidente Castello Branco|SC|-27.22|-51.81\nSantana da Ponte Pensa|SP|-20.25|-50.8\nTapira\xED|MG|-19.89|-46.02\nFern\xE3o|SP|-22.36|-49.52\nSanta Salete|SP|-20.24|-50.69\nFloriano Peixoto|RS|-27.86|-52.08\nMoipor\xE1|GO|-16.54|-50.74\nCanudos do Vale|RS|-29.33|-52.24\nNovo Xingu|RS|-27.75|-53.06\nLavandeira|TO|-12.78|-46.51\nTurmalina|SP|-20.05|-50.48\nCruzaltense|RS|-27.67|-52.65\nBarra Bonita|SC|-26.65|-53.44\nDirce Reis|SP|-20.46|-50.61\nCoronel Pilar|RS|-29.27|-51.68\nUni\xE3o Paulista|SP|-20.89|-49.9\nIpueiras|TO|-11.23|-48.46\nVista Alegre do Prata|RS|-28.81|-51.79\nPassab\xE9m|MG|-19.35|-43.14\nPonte Preta|RS|-27.66|-52.48\nSucupira|TO|-11.99|-48.97\nPorto Vera Cruz|RS|-27.74|-54.9\nQuatro Irm\xE3os|RS|-27.83|-52.44\nChapada de Areia|TO|-10.14|-49.14\nConsola\xE7\xE3o|MG|-22.55|-45.93\nAnt\xF4nio Prado de Minas|MG|-21.02|-42.11\nMontauri|RS|-28.65|-52.08\nSanta Tereza|RS|-29.17|-51.74\nDores\xF3polis|MG|-20.29|-45.9\nPaiva|MG|-21.29|-43.41\nCrix\xE1s do Tocantins|TO|-11.1|-48.92\nFlora Rica|SP|-21.67|-51.38\nGuabiju|RS|-28.54|-51.69\nLagoa Santa|GO|-19.18|-51.4\nGrupiara|MG|-18.5|-47.73\nUru|SP|-21.79|-49.28\nCachoeira de Goi\xE1s|GO|-16.66|-50.65\nTupanci do Sul|RS|-27.92|-51.54\nCarlos Gomes|RS|-27.72|-51.91\nMiguel Le\xE3o|PI|-5.68|-42.74\nJardim Olinda|PR|-22.55|-52.05\nNova Alian\xE7a do Iva\xED|PR|-23.18|-52.6\nEngenho Velho|RS|-27.71|-52.91\nCoqueiro Baixo|RS|-29.18|-52.09\nS\xE3o Sebasti\xE3o do Rio Preto|MG|-19.3|-43.18\nOliveira de F\xE1tima|TO|-10.71|-48.91\nUni\xE3o da Serra|RS|-28.78|-52.02\nAndr\xE9 da Rocha|RS|-28.63|-51.58\nCedro do Abaet\xE9|MG|-19.15|-45.71\nNova Castilho|SP|-20.76|-50.35\nAraguainha|MT|-16.86|-53.03\nBor\xE1|SP|-22.27|-50.54\nAnhanguera|GO|-18.33|-48.22\nSerra da Saudade|MG|-19.44|-45.8";

  // js/utils/cidades.js
  var cache = null;
  var fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function all() {
    if (!cache) {
      cache = CIDADES_RAW.split("\n").map((line) => {
        const [name, uf, lat, lon] = line.split("|");
        return { name, uf, lat: Number(lat), lon: Number(lon), label: `${name}, ${uf}`, key: fold(`${name} ${uf}`) };
      });
    }
    return cache;
  }
  function popularCities(limit = 8) {
    return all().slice(0, limit);
  }
  function searchCities(query, limit = 8) {
    const q = fold(query.replace(/,/g, " ")).replace(/\s+/g, " ").trim();
    if (!q) return popularCities(limit);
    const starts = [], word = [], any = [];
    for (const c of all()) {
      if (c.key.startsWith(q)) starts.push(c);
      else if (c.key.includes(" " + q)) word.push(c);
      else if (c.key.includes(q)) any.push(c);
      if (starts.length >= limit) break;
    }
    return starts.concat(word, any).slice(0, limit);
  }
  function nearestCity(lat, lon) {
    const rad = Math.PI / 180;
    let best = null, bestD = Infinity;
    for (const c of all()) {
      const dLat = (c.lat - lat) * rad;
      const dLon = (c.lon - lon) * rad * Math.cos(lat * rad);
      const d = dLat * dLat + dLon * dLon;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  // js/screens/worker/Feed.js
  var KEY8 = "feed";
  function openJob(navigate2, role, job) {
    return () => navigate2(role === "recrutador" && isMine(job) ? "/vaga-gerenciar/" + job.id : "/vaga/" + job.id);
  }
  function km(distance) {
    return parseFloat(String(distance || "0").replace(",", ".")) || 0;
  }
  function payNum(job) {
    return job.pay == null ? -1 : job.pay;
  }
  function soon(job) {
    return job.date === "Hoje" ? 0 : job.date === "Amanh\xE3" ? 1 : job.date ? 2 : 3;
  }
  function matchesQuando(job, quando) {
    if (!quando) return true;
    if (quando === "Durante a semana") return job.dias === "semana" || job.dias === "qualquer";
    if (quando === "Fim de semana") return job.dias === "fimdesemana" || job.dias === "qualquer";
    return job.date === quando;
  }
  function orderJobs(jobs, role, sort = "perto") {
    const rank = (j) => role === "recrutador" && isMine(j) ? 0 : j.urgent ? 1 : 2;
    const by = sort === "valor" ? (a, b) => payNum(b) - payNum(a) : sort === "cedo" ? (a, b) => soon(a) - soon(b) || km(a.distance) - km(b.distance) : (a, b) => km(a.distance) - km(b.distance);
    return jobs.slice().sort((a, b) => rank(a) - rank(b) || by(a, b));
  }
  function tileFor(navigate2, role, job) {
    return JobTile({
      job,
      company: getCompany(job.companyId),
      onClick: openJob(navigate2, role, job),
      mine: role === "recrutador" && isMine(job),
      saved: isJobSaved(job.id),
      onToggleSave: role === "trabalhador" ? () => toggleSavedJob(job.id) : null
    });
  }
  function tileGrid(navigate2, role, jobs) {
    return h("div", { class: "tile-grid" }, ...jobs.map((j) => tileFor(navigate2, role, j)));
  }
  var DEFAULT_CITY = "S\xE3o Paulo, SP";
  var jobCity = (job) => job.city || DEFAULT_CITY;
  var NO_FILTERS = { tipo: null, dist: "Toda a cidade", quando: null, location: DEFAULT_CITY };
  var SORTS = [{ id: "perto", label: "Mais perto" }, { id: "valor", label: "Maior valor" }, { id: "cedo", label: "Mais cedo" }];
  function renderFeed(navigate2) {
    const role = getRole();
    const ui = getUI(KEY8, { search: "", location: DEFAULT_CITY, filtersOpen: false, pickerOpen: false, cityQuery: "", geo: null, tipo: null, dist: "Toda a cidade", quando: null, sort: "perto", notifyUrgent: true });
    const open = activeJobs().filter((j) => !isJobClosed(j));
    const filtered = open.filter((j) => passesFilters(j, ui));
    return h(
      "div",
      {},
      mobileFeed(navigate2, role, ui, open, filtered),
      desktopFeed(navigate2, role, ui, open, filtered),
      // One filter panel for both layouts: a bottom sheet on phones, a dialog on desktop.
      filtersSheet(ui, open, filtered.length),
      cityPicker(ui)
    );
  }
  function passesFilters(j, ui) {
    return jobCity(j) === ui.location && (!ui.tipo || j.role === ui.tipo) && (ui.dist === "Toda a cidade" || km(j.distance) <= parseInt(ui.dist.replace(/\D/g, ""), 10)) && matchesQuando(j, ui.quando);
  }
  function activeFilters(ui) {
    return [
      ui.location !== DEFAULT_CITY ? { label: ui.location, icon: "map-pin", remove: () => setUI(KEY8, { location: DEFAULT_CITY }) } : null,
      ui.tipo ? { label: ui.tipo, icon: "hard-hat", remove: () => setUI(KEY8, { tipo: null }) } : null,
      ui.dist !== "Toda a cidade" ? { label: ui.dist, icon: "map-pin", remove: () => setUI(KEY8, { dist: "Toda a cidade" }) } : null,
      ui.quando ? { label: ui.quando, icon: "calendar", remove: () => setUI(KEY8, { quando: null }) } : null
    ].filter(Boolean);
  }
  function filtersSheet(ui, open, count) {
    const set = (patch) => setUI(KEY8, patch);
    return Sheet(
      { open: ui.filtersOpen, title: "Filtros", onClose: () => set({ filtersOpen: false }) },
      h(
        "div",
        { class: "flex flex-col gap-2.5" },
        h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Onde voc\xEA quer trabalhar"),
        h(
          "button",
          {
            type: "button",
            "aria-haspopup": "dialog",
            class: "flex items-center gap-3 w-full p-3 rounded-card border border-concrete-300 bg-white text-left transition-colors hover:bg-concrete-50 hover:border-concrete-400",
            onClick: () => set({ pickerOpen: true, cityQuery: "", geo: null })
          },
          h("span", { class: "inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0" }, Icon("map-pin", { size: 20, color: "var(--brand)" })),
          h(
            "span",
            { class: "flex-1 min-w-0 flex flex-col" },
            h("span", { class: "text-xs text-concrete-500" }, "Cidade"),
            h("span", { class: "font-semibold text-concrete-900 truncate" }, ui.location)
          ),
          h("span", { class: "inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600 shrink-0" }, "Escolher", Icon("chevron-right", { size: 16, color: "var(--text-brand)" }))
        )
      ),
      // The phone has these as a segmented control on the mural itself.
      h(
        "div",
        { class: "hidden lg:flex flex-col gap-2.5" },
        h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Ordenar por"),
        h("div", { class: "flex flex-wrap gap-2" }, ...SORTS.map((o) => Tag({ label: o.label, selected: ui.sort === o.id, onClick: () => set({ sort: o.id }) })))
      ),
      filterGroup("Tipo de servi\xE7o", TIPOS_SERVICO, ui.tipo, (v) => set({ tipo: ui.tipo === v ? null : v })),
      filterGroup("Dist\xE2ncia do centro de " + ui.location.split(",")[0], ["5", "10", "20", "Toda a cidade"].map((d) => d === "Toda a cidade" ? d : `At\xE9 ${d} km`), ui.dist, (v) => set({ dist: v })),
      filterGroup("Quando", ["Hoje", "Amanh\xE3", "Durante a semana", "Fim de semana"], ui.quando, (v) => set({ quando: ui.quando === v ? null : v })),
      h(
        "div",
        { class: "flex flex-col gap-1 pt-1 border-t border-concrete-200" },
        Switch({ label: "Avisar quando aparecer bico novo", description: "Chega uma notifica\xE7\xE3o quando surgir vaga com esses filtros perto de voc\xEA.", checked: ui.notifyUrgent, onChange: (v) => set({ notifyUrgent: v }) })
      ),
      h(
        "div",
        { class: "flex gap-3 pt-1" },
        Button({ label: "Limpar", variant: "secondary", className: "flex-1", onClick: () => set(NO_FILTERS) }),
        Button({ label: `Ver ${count === 1 ? "1 vaga" : count + " vagas"}`, className: "flex-[1.4]", onClick: () => set({ filtersOpen: false }) })
      )
    );
  }
  function cityPicker(ui) {
    const set = (patch) => setUI(KEY8, patch);
    const choose = (label) => set({ location: label, pickerOpen: false, cityQuery: "", geo: null });
    const useMyLocation = () => {
      if (!navigator.geolocation) {
        set({ geo: "error" });
        return;
      }
      set({ geo: "loading" });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = nearestCity(pos.coords.latitude, pos.coords.longitude);
          if (c) choose(c.label);
          else set({ geo: "error" });
        },
        (err) => set({ geo: err && err.code === 1 ? "denied" : "error" }),
        { enableHighAccuracy: false, timeout: 1e4, maximumAge: 6e5 }
      );
    };
    const q = ui.cityQuery.trim();
    const results = ui.pickerOpen ? searchCities(q, 8) : [];
    const geoMsg = ui.geo === "denied" ? "Seu navegador n\xE3o liberou a localiza\xE7\xE3o. Digite a cidade abaixo." : ui.geo === "error" ? "N\xE3o conseguimos achar sua localiza\xE7\xE3o agora. Digite a cidade abaixo." : null;
    return Sheet(
      { open: ui.pickerOpen, title: "Onde voc\xEA quer trabalhar", onClose: () => set({ pickerOpen: false, geo: null }) },
      Button({ label: ui.geo === "loading" ? "Buscando sua localiza\xE7\xE3o\u2026" : "Usar minha localiza\xE7\xE3o", variant: "secondary", fullWidth: true, iconLeft: "locate-fixed", loading: ui.geo === "loading", onClick: useMyLocation }),
      geoMsg ? h("span", { class: "flex items-start gap-2 text-sm text-concrete-700 -mt-1" }, Icon("circle-alert", { size: 16, color: "var(--amber-500)" }), geoMsg) : null,
      h(
        "div",
        { class: "flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-concrete-400" },
        h("span", { class: "flex-1 h-px bg-concrete-200" }),
        "ou",
        h("span", { class: "flex-1 h-px bg-concrete-200" })
      ),
      Input({ id: "city-search", placeholder: "Digite o nome da cidade", icon: "search", value: ui.cityQuery, autoFocus: true, onInput: (v) => set({ cityQuery: v }) }),
      h(
        "div",
        { class: "flex flex-col gap-1" },
        h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500 pb-1" }, q ? "Cidades encontradas" : "Cidades mais procuradas"),
        results.length ? h("div", { class: "flex flex-col", role: "listbox", "aria-label": "Cidades" }, ...results.map((c) => {
          const active = c.label === ui.location;
          return h(
            "button",
            {
              type: "button",
              role: "option",
              "aria-selected": active ? "true" : "false",
              class: cx("flex items-center gap-3 min-h-12 px-2 -mx-2 rounded-control text-left transition-colors hover:bg-concrete-50", active ? "text-brand-600" : "text-concrete-900"),
              onClick: () => choose(c.label)
            },
            Icon("map-pin", { size: 18, color: active ? "var(--brand)" : "var(--text-subtle)" }),
            h("span", { class: "flex-1 min-w-0 truncate" }, h("span", { class: "font-semibold" }, c.name), h("span", { class: "text-concrete-500" }, " \xB7 " + c.uf)),
            active ? Icon("check", { size: 18, color: "var(--brand)" }) : null
          );
        })) : h("span", { class: "py-3 text-sm text-concrete-500" }, `Nenhuma cidade com \u201C${q}\u201D. Confira a grafia.`)
      )
    );
  }
  function mobileFeed(navigate2, role, ui, openJobs, filtered) {
    const q = ui.search.trim().toLowerCase();
    const searching = q.length > 0;
    const matches = (j) => !q || (j.role + " " + getCompany(j.companyId).name + " " + j.location).toLowerCase().includes(q);
    const ordered = orderJobs(filtered, role, ui.sort);
    const jobResults = searching ? openJobs.filter(matches) : [];
    const companyResults = searching ? allCompanies().filter((c) => (c.name + " " + c.location).toLowerCase().includes(q)) : [];
    const workerResults = searching ? allWorkers().filter((w) => (w.name + " " + w.role + " " + w.region).toLowerCase().includes(q)) : [];
    const noResults = searching && jobResults.length === 0 && companyResults.length === 0 && workerResults.length === 0;
    const activeChips = activeFilters(ui);
    const activeCount = activeChips.length;
    const header = h(
      "div",
      { class: "sticky top-0 z-20 flex flex-col gap-2 px-4 pt-2 pb-3.5 bg-white border-b border-concrete-200" },
      h(
        "div",
        { class: "flex items-center justify-between gap-2 min-h-12" },
        h("h1", { class: "inline-flex", "aria-label": "Bicos" }, Logo({ compact: true })),
        NotificationBell({ count: role === "recrutador" ? 3 : 2, onClick: () => navigate2("/notificacoes") })
      ),
      SearchPill({ id: "feed-search", role, ui, compact: true })
    );
    const searchResults = h(
      "div",
      { class: "flex flex-col gap-5" },
      jobResults.length ? h(
        "div",
        { class: "flex flex-col gap-3" },
        h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Vagas"),
        tileGrid(navigate2, role, orderJobs(jobResults, role))
      ) : null,
      companyResults.length ? h(
        "div",
        { class: "flex flex-col gap-2" },
        h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Construtoras"),
        ...companyResults.map((c) => Card(
          { padding: "md", onClick: () => navigate2("/construtora/" + c.id) },
          h(
            "div",
            { class: "flex items-center gap-3" },
            h("span", { class: "inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0" }, Icon("building-2", { size: 20, color: "var(--brand)" })),
            h(
              "div",
              { class: "flex-1 min-w-0 flex flex-col" },
              h("span", { class: "font-semibold text-concrete-900 truncate" }, c.name),
              h("span", { class: "text-sm text-concrete-500 truncate" }, c.location)
            ),
            Rating({ value: c.rating, count: c.reviewCount })
          )
        ))
      ) : null,
      workerResults.length ? h(
        "div",
        { class: "flex flex-col gap-2" },
        h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Trabalhadores"),
        ...workerResults.map((w) => Card(
          { padding: "md" },
          h(
            "div",
            { class: "flex items-center gap-3" },
            h("span", { class: "inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0" }, w.initials),
            h(
              "div",
              { class: "flex-1 min-w-0 flex flex-col" },
              h("span", { class: "font-semibold text-concrete-900 truncate" }, w.name),
              h("span", { class: "text-sm text-concrete-500 truncate" }, `${w.role} \xB7 ${w.region}`)
            ),
            Rating({ value: w.rating, count: w.jobsDone })
          )
        ))
      ) : null,
      noResults ? EmptyState({ icon: "search-x", title: "Nenhum resultado para essa busca", description: "Confira a grafia ou tente um termo mais curto.", actionLabel: "Limpar busca", onAction: () => setUI(KEY8, { search: "" }) }) : null
    );
    const browseResults = h(
      "div",
      { class: "flex flex-col gap-4" },
      h(
        "div",
        { class: "flex flex-wrap items-center gap-2" },
        Tag({ label: activeCount ? `Filtros \xB7 ${activeCount}` : "Filtros", icon: "sliders-horizontal", onClick: () => setUI(KEY8, { filtersOpen: true }) }),
        ...activeChips.map((c) => Tag({ label: c.label, icon: c.icon, selected: true, onRemove: c.remove }))
      ),
      h("div", { class: "flex bg-concrete-100 rounded-full p-1 gap-1" }, ...SORTS.map((o) => h("button", {
        type: "button",
        class: `flex-1 h-10 rounded-full text-sm font-bold transition-colors ${ui.sort === o.id ? "bg-white text-brand-600 shadow-card" : "text-concrete-500"}`,
        onClick: () => setUI(KEY8, { sort: o.id })
      }, o.label))),
      ordered.length ? tileGrid(navigate2, role, ordered) : noJobsState(ui)
    );
    return h(
      "div",
      { class: "flex flex-col lg:hidden" },
      header,
      h("div", { class: "px-4 pt-4 pb-6" }, h("div", { class: "mural-frame flex flex-col gap-5" }, searching ? searchResults : browseResults))
    );
  }
  function desktopFeed(navigate2, role, ui, open, filtered) {
    const q = ui.search.trim().toLowerCase();
    const chips = activeFilters(ui);
    const browse = h(
      "div",
      { class: "flex flex-col gap-6" },
      chips.length ? h(
        "div",
        { class: "flex flex-wrap items-center gap-2" },
        h("span", { class: "mr-1 text-concrete-500" }, filtered.length === 1 ? "1 vaga com" : `${filtered.length} vagas com`),
        ...chips.map((c) => Tag({ label: c.label, icon: c.icon, selected: true, onRemove: c.remove })),
        Button({ label: "Limpar filtros", variant: "ghost", size: "sm", onClick: () => setUI(KEY8, NO_FILTERS) })
      ) : null,
      filtered.length ? tileGrid(navigate2, role, orderJobs(filtered, role, ui.sort)) : noJobsState(ui)
    );
    const body = q ? desktopSearchResults(navigate2, role, ui, open) : browse;
    const count = chips.length;
    const filterButton = h(
      "button",
      {
        type: "button",
        "aria-haspopup": "dialog",
        class: cx(
          "relative shrink-0 inline-flex items-center gap-2.5 h-[4.25rem] px-6 rounded-full bg-white border shadow-float font-semibold text-concrete-900 transition hover:border-concrete-300 hover:shadow-raised",
          count ? "border-brand-500" : "border-concrete-200"
        ),
        onClick: () => setUI(KEY8, { filtersOpen: true })
      },
      Icon("sliders-horizontal", { size: 20 }),
      "Filtros",
      count ? h("span", { class: "inline-flex items-center justify-center min-w-[1.375rem] h-[1.375rem] px-1.5 rounded-full bg-brand-500 text-white text-xs font-bold" }, String(count)) : null
    );
    return h(
      "div",
      { class: "hidden lg:block min-h-[calc(100vh-5rem)] bg-white" },
      h(
        "div",
        { class: "page-x pt-1 pb-8 border-b border-concrete-200" },
        h(
          "div",
          { class: "max-w-[60rem] mx-auto flex items-center gap-3" },
          h("div", { class: "flex-1 min-w-0" }, SearchPill({ id: "feed-search-desktop", role, ui })),
          filterButton
        )
      ),
      h("div", { class: "page-x pt-8 pb-20" }, h("div", { class: "mural-frame" }, body))
    );
  }
  function SearchPill({ id, role, ui, compact = false }) {
    const input = h("input", {
      id,
      "data-focus-id": id,
      type: "search",
      autocomplete: "off",
      spellcheck: "false",
      enterkeyhint: "search",
      "aria-label": "Buscar bicos",
      placeholder: role === "recrutador" ? "Buscar vaga, construtora ou trabalhador" : "Buscar por servi\xE7o, bairro ou construtora",
      value: ui.search,
      class: cx("w-full min-w-0 bg-transparent outline-none text-concrete-900 placeholder:text-concrete-500 [&::-webkit-search-cancel-button]:hidden", compact ? "text-[0.9375rem]" : "text-base"),
      oninput: (e) => setUI(KEY8, { search: e.target.value }),
      onkeydown: (e) => {
        if (e.key === "Escape") setUI(KEY8, { search: "" });
        if (e.key === "Enter") e.target.blur();
      }
    });
    return h(
      "div",
      {
        role: "search",
        class: cx(
          "flex items-center rounded-full bg-white border border-concrete-200 shadow-float transition focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100",
          compact ? "gap-3 h-14 pl-1.5 pr-2" : "gap-4 h-[4.25rem] pl-2 pr-3"
        )
      },
      h("button", {
        type: "button",
        "aria-label": "Buscar",
        title: "Buscar",
        class: cx("shrink-0 inline-flex items-center justify-center rounded-full bg-brand-500 shadow-raised transition hover:bg-brand-600 active:scale-95", compact ? "w-11 h-11" : "w-[3.25rem] h-[3.25rem]"),
        onClick: () => {
          const el = document.getElementById(id);
          if (el) el.focus();
        }
      }, Icon("search", { size: compact ? 20 : 22, color: "#fff" })),
      h("div", { class: "flex-1 min-w-0 flex items-center" }, input),
      ui.search ? h("button", {
        type: "button",
        "aria-label": "Limpar busca",
        title: "Limpar busca",
        class: "shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-concrete-500 transition-colors hover:bg-concrete-100 hover:text-concrete-900",
        onClick: () => setUI(KEY8, { search: "" })
      }, Icon("x", { size: 18 })) : null
    );
  }
  function desktopSearchResults(navigate2, role, ui, open) {
    const q = ui.search.trim().toLowerCase();
    const jobs = open.filter((j) => (j.role + " " + getCompany(j.companyId).name + " " + j.location).toLowerCase().includes(q));
    const companies = allCompanies().filter((c) => (c.name + " " + c.location).toLowerCase().includes(q));
    const workers = allWorkers().filter((w) => (w.name + " " + w.role + " " + w.region).toLowerCase().includes(q));
    const parts = [
      jobs.length ? jobs.length === 1 ? "1 vaga" : `${jobs.length} vagas` : null,
      companies.length ? companies.length === 1 ? "1 construtora" : `${companies.length} construtoras` : null,
      workers.length ? workers.length === 1 ? "1 trabalhador" : `${workers.length} trabalhadores` : null
    ].filter(Boolean);
    const heading2 = h(
      "div",
      { class: "flex items-baseline gap-3 flex-wrap" },
      h("h1", { class: "text-[1.75rem] font-semibold leading-tight text-concrete-900" }, `Resultados para \u201C${ui.search.trim()}\u201D`),
      parts.length ? h("span", { class: "text-concrete-500" }, parts.join(" \xB7 ")) : null
    );
    if (!parts.length) {
      return h(
        "div",
        { class: "flex flex-col gap-4" },
        heading2,
        EmptyState({ icon: "search-x", title: "Nenhum resultado para essa busca", description: "Confira a grafia ou tente um termo mais curto, como o nome do servi\xE7o ou do bairro.", actionLabel: "Limpar busca", onAction: () => setUI(KEY8, { search: "" }) })
      );
    }
    const group = (title, content) => h("section", { class: "flex flex-col gap-4" }, h("h2", { class: "text-[1.375rem] font-semibold text-concrete-900" }, title), content);
    const personGrid = (children) => h("div", { class: "grid gap-4 grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]" }, ...children);
    const personCard = ({ avatar, name, meta, rating, onClick }) => h(
      onClick ? "button" : "div",
      {
        type: onClick ? "button" : null,
        onClick,
        class: cx("flex items-center gap-4 p-4 rounded-2xl border border-concrete-200 bg-white text-left", onClick ? "transition hover:shadow-raised hover:border-concrete-300" : "")
      },
      avatar,
      h(
        "div",
        { class: "flex-1 min-w-0 flex flex-col gap-0.5" },
        h("span", { class: "font-semibold text-concrete-900 truncate" }, name),
        h("span", { class: "text-sm text-concrete-500 truncate" }, meta),
        rating
      )
    );
    return h(
      "div",
      { class: "flex flex-col gap-12" },
      heading2,
      jobs.length ? group("Vagas", tileGrid(navigate2, role, orderJobs(jobs, role))) : null,
      companies.length ? group("Construtoras", personGrid(companies.map((c) => personCard({
        avatar: h("span", { class: "inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 shrink-0" }, Icon("building-2", { size: 22, color: "var(--brand)" })),
        name: c.name,
        meta: c.location,
        rating: Rating({ value: c.rating, count: c.reviewCount }),
        onClick: () => navigate2("/construtora/" + c.id)
      })))) : null,
      workers.length ? group("Trabalhadores", personGrid(workers.map((w) => personCard({
        avatar: h("span", { class: "inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-50 text-accent-600 font-bold shrink-0" }, w.initials),
        name: w.name,
        meta: `${w.role} \xB7 ${w.region}`,
        rating: Rating({ value: w.rating, count: w.jobsDone }),
        onClick: role === "recrutador" ? () => navigate2("/trabalhador/" + w.id) : null
      })))) : null
    );
  }
  function noJobsState(ui) {
    if (ui.location !== DEFAULT_CITY) {
      return EmptyState({ icon: "map-pin", title: `Ainda n\xE3o tem bico em ${ui.location.split(",")[0]}`, description: "Assim que uma construtora publicar uma vaga nessa cidade, ela aparece aqui.", actionLabel: `Ver bicos em ${DEFAULT_CITY.split(",")[0]}`, onAction: () => setUI(KEY8, { location: DEFAULT_CITY }) });
    }
    return EmptyState({ icon: "search-x", title: "Nenhuma vaga com esse filtro", description: "Tire um filtro ou aumente a dist\xE2ncia para ver mais bicos.", actionLabel: "Limpar filtros", onAction: () => setUI(KEY8, NO_FILTERS) });
  }
  function filterGroup(title, options, active, onSelect) {
    return h(
      "div",
      { class: "flex flex-col gap-2.5" },
      h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, title),
      h("div", { class: "flex flex-wrap gap-2" }, ...options.map((o) => Tag({ label: o, selected: active === o, onClick: () => onSelect(o) })))
    );
  }

  // js/screens/worker/JobDetail.js
  var KEY9 = "job-detail";
  function renderJobDetail(navigate2, params) {
    const job = getJob(params.id);
    if (!job) return notFound4(navigate2);
    const company = getCompany(job.companyId);
    const role = getRole();
    const worker = currentWorker();
    const application = role === "trabalhador" ? applicationFor(job.id, worker.id) : null;
    const canCancel = application && (application.status === "enviada" || application.status === "em_analise");
    const ui = getUI(KEY9, { confirmCancel: false });
    const actions = () => role === "trabalhador" ? [
      application ? canCancel ? Button({ label: "Cancelar candidatura", size: "lg", fullWidth: true, variant: "secondary", onClick: () => setUI(KEY9, { confirmCancel: true }) }) : Button({ label: "Ver minhas candidaturas", size: "lg", fullWidth: true, variant: "secondary", onClick: () => navigate2("/minhas-candidaturas") }) : Button({ label: "Quero esse bico", size: "lg", fullWidth: true, onClick: () => navigate2("/confirmar/" + job.id) }),
      !application ? h("span", { class: "text-center text-xs text-concrete-500" }, "Voc\xEA n\xE3o paga nada para se candidatar") : null
    ] : [];
    const summary = h(
      "aside",
      { class: "hidden lg:block lg:sticky lg:top-28" },
      h(
        "div",
        { class: "flex flex-col gap-5 p-6 bg-white rounded-2xl border border-concrete-200 shadow-float" },
        h(
          "div",
          { class: "flex flex-col gap-1" },
          h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-brand-600" }, "Di\xE1ria"),
          h(
            "div",
            { class: "flex items-baseline gap-2" },
            h("span", { class: "font-mono font-bold text-3xl text-concrete-900" }, job.pay == null ? "A combinar" : formatBRL(job.pay)),
            job.pay == null ? null : h("span", { class: "text-concrete-500" }, "por dia")
          )
        ),
        h(
          "div",
          { class: "flex flex-col rounded-xl border border-concrete-200 divide-y divide-concrete-200" },
          summaryRow("calendar", "Quando", whenText(job)),
          diasInfo(job) ? summaryRow("calendar-days", "Dias", diasInfo(job).label) : null,
          summaryRow("clock", "Dura\xE7\xE3o", job.duration),
          summaryRow("map-pin", "Onde", `${job.location} \xB7 ${job.distance}`)
        ),
        ...actions(),
        h("div", { class: "flex items-start gap-2 text-sm text-concrete-500" }, Icon("hand-coins", { size: 18, color: "var(--text-subtle)" }), h("span", {}, "Pagamento em PIX no fim da di\xE1ria, combinado direto com a construtora."))
      )
    );
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Detalhe da vaga", onBack: () => goBack("/mural") }),
      h(
        "div",
        { class: "flex flex-col gap-4 px-4 sm:px-0 py-4 pb-28 lg:pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-10" },
        h(
          "div",
          { class: "flex flex-col gap-4 lg:gap-6" },
          Card(
            { padding: "none" },
            h(
              "div",
              { class: "relative" },
              PhotoCarousel({ job, className: "h-60 sm:h-80 lg:h-[26rem] rounded-t-card" }),
              h(
                "div",
                { class: "absolute z-10 left-4 -bottom-6 w-[3.75rem] h-[3.75rem] rounded-full bg-white p-0.5 shadow-raised" },
                h("div", { class: "w-full h-full rounded-full bg-brand-50 flex items-center justify-center" }, Icon("building-2", { size: 24, color: "var(--brand)" }))
              )
            ),
            h(
              "div",
              { class: "flex items-end justify-between gap-3 pt-9 pb-4 px-4" },
              h(
                "div",
                { class: "flex flex-col gap-1 min-w-0" },
                h("span", { class: "font-semibold text-concrete-900 truncate" }, company.name),
                Rating({ value: company.rating, count: company.reviewCount })
              ),
              Button({ label: "Ver perfil", variant: "secondary", size: "sm", iconLeft: "building-2", onClick: () => navigate2("/construtora/" + company.id) })
            )
          ),
          h(
            "div",
            { class: "flex flex-col gap-1.5" },
            h("h1", { class: "font-display font-bold text-2xl text-concrete-900" }, job.role),
            job.description ? h("p", { class: "text-sm text-concrete-700 leading-relaxed" }, job.description) : null
          ),
          Card(
            { tone: "brand", padding: "md", className: "lg:hidden" },
            h(
              "div",
              { class: "flex flex-col gap-4" },
              h(
                "div",
                { class: "flex items-end justify-between gap-3" },
                h(
                  "div",
                  { class: "flex flex-col gap-0.5" },
                  h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-brand-600" }, "Di\xE1ria"),
                  h("span", { class: "font-mono font-bold text-4xl text-concrete-900" }, job.pay == null ? "A combinar" : formatBRL(job.pay))
                ),
                h("span", { class: "text-sm text-concrete-700 text-right" }, "Pago no fim", h("br"), "da di\xE1ria")
              ),
              h("div", { class: "flex items-center gap-2 pt-4 border-t border-brand-200" }, Icon("calendar", { size: 20, color: "var(--text-brand)" }), h("span", { class: "font-display font-semibold text-lg text-concrete-900" }, whenText(job)))
            )
          ),
          section("Onde e como", Card(
            { padding: "md" },
            h(
              "div",
              { class: "flex flex-col gap-3.5" },
              infoRow("map-pin", job.address, `${job.location} \xB7 ${job.distance} de voc\xEA`),
              diasInfo(job) ? infoRow("calendar-days", diasInfo(job).label, diasInfo(job).hint) : null,
              infoRow("clock", hoursText(job), job.duration),
              infoRow("hand-coins", "Pagamento em PIX no fim da di\xE1ria", "Combinado direto com a construtora")
            )
          )),
          section("O que precisa levar", Card(
            { padding: "md" },
            h("div", { class: "flex flex-col gap-3" }, ...job.requirements.map((r) => h("div", { class: "flex gap-2.5 items-center" }, Icon("circle-check", { size: 20, color: "var(--green-500)" }), h("span", { class: "text-concrete-700" }, r))))
          ))
        ),
        summary
      ),
      role === "trabalhador" ? h("div", { class: "sticky bottom-0 px-4 sm:px-0 py-3 bg-white shadow-bar flex flex-col gap-1.5 lg:hidden" }, ...actions()) : null,
      Dialog({
        open: ui.confirmCancel,
        tone: "danger",
        title: "Cancelar essa candidatura?",
        description: "Voc\xEA sai da lista de candidatos dessa vaga. Se quiser, pode se candidatar de novo depois.",
        confirmLabel: "Cancelar candidatura",
        onConfirm: () => {
          cancelApplication(job.id, worker.id);
          setUI(KEY9, { confirmCancel: false });
          navigate2("/minhas-candidaturas");
        },
        cancelLabel: "Voltar",
        onCancel: () => setUI(KEY9, { confirmCancel: false })
      })
    );
  }
  function summaryRow(icon, label, value) {
    return h(
      "div",
      { class: "flex items-center gap-3 px-4 py-3" },
      Icon(icon, { size: 18, color: "var(--text-subtle)" }),
      h(
        "div",
        { class: "flex flex-col min-w-0" },
        h("span", { class: "text-xs font-bold uppercase tracking-[0.06em] text-concrete-500" }, label),
        h("span", { class: "text-sm font-semibold text-concrete-900 truncate" }, value)
      )
    );
  }
  function section(title, content) {
    return h("div", { class: "flex flex-col gap-2" }, h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, title), content);
  }
  function infoRow(icon, main, sub) {
    return h(
      "div",
      { class: "flex gap-3 items-start" },
      Icon(icon, { size: 20, color: "var(--text-subtle)" }),
      h("div", { class: "flex flex-col" }, h("span", { class: "font-semibold text-concrete-900" }, main), h("span", { class: "text-sm text-concrete-500" }, sub))
    );
  }
  function notFound4(navigate2) {
    return h(
      "div",
      { class: "flex flex-col items-center justify-center min-h-screen gap-3" },
      h("p", { class: "text-concrete-500" }, "Vaga n\xE3o encontrada ou encerrada."),
      Button({ label: "Voltar ao mural", variant: "secondary", onClick: () => navigate2("/mural") })
    );
  }

  // js/screens/worker/ConfirmApplication.js
  var KEY10 = "confirm-application";
  function renderConfirmApplication(navigate2, params) {
    const job = getJob(params.id);
    if (!job) return h("div", { class: "p-6 text-concrete-500" }, "Vaga n\xE3o encontrada.");
    const company = getCompany(job.companyId);
    const worker = currentWorker();
    const ui = getUI(KEY10, { submitting: false });
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Confirmar candidatura", onBack: () => goBack("/vaga/" + job.id) }),
      h(
        "div",
        { class: "flex flex-col gap-4 px-4 sm:px-0 py-4" },
        h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Confira antes de enviar"),
        Card(
          { padding: "md" },
          h(
            "div",
            { class: "flex flex-col gap-4" },
            h(
              "div",
              { class: "flex flex-col gap-0.5" },
              h("span", { class: "font-display font-semibold text-xl text-concrete-900" }, job.role),
              h("span", { class: "text-sm text-concrete-700" }, company.name)
            ),
            h(
              "div",
              { class: "flex gap-3" },
              h("div", { class: "flex-1 bg-concrete-100 rounded-control p-3 flex flex-col gap-0.5" }, h("span", { class: "text-xs text-concrete-500" }, "Di\xE1ria"), h("span", { class: "font-mono font-bold text-2xl text-concrete-900" }, job.pay == null ? "A combinar" : formatBRL(job.pay))),
              h("div", { class: "flex-1 bg-concrete-100 rounded-control p-3 flex flex-col gap-0.5" }, h("span", { class: "text-xs text-concrete-500" }, "Data"), h("span", { class: "font-semibold text-concrete-900" }, dateText(job)))
            ),
            h(
              "div",
              { class: "flex items-center gap-2.5 pt-4 border-t border-concrete-200" },
              h("span", { class: "inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0" }, worker.initials),
              h("div", { class: "flex flex-col" }, h("span", { class: "font-semibold text-concrete-900" }, worker.name), h("span", { class: "text-sm text-concrete-500" }, `${worker.role} \xB7 ${worker.rating}`))
            )
          )
        ),
        h("span", { class: "text-sm text-concrete-500" }, "A construtora vai ver seu perfil, suas especialidades e suas avalia\xE7\xF5es. O contato por WhatsApp s\xF3 abre se ela te escolher.")
      ),
      h(
        "div",
        { class: "px-4 sm:px-0 py-3 flex flex-col gap-2" },
        Button({
          label: "Sim, quero esse bico",
          size: "lg",
          fullWidth: true,
          loading: ui.submitting,
          onClick: () => {
            setUI(KEY10, { submitting: true });
            setTimeout(() => {
              setUI(KEY10, { submitting: false });
              applyToJob(job.id, worker.id);
              navigate2("/enviado/" + job.id);
            }, 600);
          }
        }),
        Button({ label: "Voltar para a vaga", variant: "ghost", fullWidth: true, onClick: () => navigate2("/vaga/" + job.id) })
      )
    );
  }

  // js/screens/worker/ApplicationSent.js
  function renderApplicationSent(navigate2, params) {
    const job = getJob(params.id);
    if (!job) return h("div", { class: "p-6 text-concrete-500" }, "Vaga n\xE3o encontrada.");
    const company = getCompany(job.companyId);
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Bicos", onBack: () => goBack("/mural") }),
      h(
        "div",
        { class: "flex flex-col items-center text-center gap-5 px-6 pt-10 pb-8 lg:max-w-app lg:mx-auto" },
        h("span", { class: "inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full bg-success-50" }, Icon("circle-check", { size: 34, color: "var(--green-500)" })),
        h(
          "div",
          { class: "flex flex-col gap-2" },
          h("h1", { class: "font-display font-bold text-2xl text-concrete-900" }, "Candidatura enviada"),
          h("p", { class: "text-base text-concrete-700" }, "A construtora recebeu seu perfil. Avisamos quando voc\xEA avan\xE7ar de etapa.")
        ),
        Card(
          { tone: "sunken", padding: "md", className: "w-full" },
          h(
            "div",
            { class: "flex items-center justify-between gap-3" },
            h("div", { class: "flex flex-col gap-0.5 min-w-0" }, h("span", { class: "font-semibold text-concrete-900" }, job.role), h("span", { class: "text-sm text-concrete-500" }, `${company.name} \xB7 ${dateText(job)}`)),
            h("span", { class: "font-mono font-bold text-xl text-concrete-900" }, job.pay == null ? "A combinar" : formatBRL(job.pay))
          )
        ),
        h(
          "div",
          { class: "w-full flex flex-col gap-2 pt-2" },
          Button({ label: "Ver minhas candidaturas", fullWidth: true, onClick: () => navigate2("/minhas-candidaturas") }),
          Button({ label: "Voltar ao mural", variant: "ghost", fullWidth: true, onClick: () => navigate2("/mural") })
        )
      )
    );
  }

  // js/components/WhatsAppButton.js
  var SIZES3 = {
    sm: "h-9 px-3.5 gap-1.5 text-sm",
    lg: "h-14 px-5 gap-2 text-base"
  };
  function WhatsAppButton({ href, size = "sm", fullWidth = false, label = "Falar no WhatsApp", shortLabel = "WhatsApp", round = false }) {
    if (round) {
      return h("a", {
        href: href || "#",
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": label,
        title: label,
        class: "inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#128C4A] text-white shadow-raised ring-2 ring-white transition hover:bg-[#0E7A3F] hover:scale-105 active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-[#128C4A]/30",
        onClick: (e) => {
          e.stopPropagation();
          if (!href) e.preventDefault();
        }
      }, Icon("message-circle", { size: 19, color: "#fff" }));
    }
    return h(
      "a",
      {
        href: href || "#",
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": label,
        class: cx(
          "inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold text-white bg-[#128C4A] shadow-card transition-colors hover:bg-[#0E7A3F] active:scale-[0.98] outline-none focus-visible:ring-4 focus-visible:ring-[#128C4A]/25",
          SIZES3[size] || SIZES3.sm,
          fullWidth ? "w-full" : ""
        ),
        onClick: (e) => {
          e.stopPropagation();
          if (!href) e.preventDefault();
        }
      },
      Icon("message-circle", { size: size === "lg" ? 20 : 16, color: "#fff" }),
      // Small buttons sit in narrow phone tiles: the short label there, the full one from sm up.
      size === "sm" ? [h("span", { class: "sm:hidden" }, shortLabel), h("span", { class: "hidden sm:inline" }, label)] : label
    );
  }

  // js/utils/whatsapp.js
  function whatsappUrl(phone, text) {
    const digits2 = String(phone || "").replace(/\D/g, "");
    if (!digits2) return null;
    const number = digits2.startsWith("55") ? digits2 : "55" + digits2;
    return `https://wa.me/${number}` + (text ? `?text=${encodeURIComponent(text)}` : "");
  }
  function workerToCompanyUrl(company, job) {
    return whatsappUrl(company.whatsapp, `Ol\xE1, ${company.name}! Sou da Bicos e fui escolhido para a vaga de ${job.role} (${job.id}). Podemos combinar os detalhes?`);
  }

  // js/utils/applicationStatus.js
  function statusInfo(status, jobId) {
    switch (status) {
      case "enviada":
      case "em_analise":
        return { label: "Em an\xE1lise", tone: "warning", icon: "clock", hint: "Ver a vaga", to: "/vaga/" + jobId };
      case "pre_selecionado":
        return { label: "Pr\xE9-selecionado", tone: "brand", icon: "message-circle", hint: "Falar no WhatsApp", to: "/selecionado/" + jobId };
      case "contratado":
        return { label: "Contratado", tone: "success", icon: "circle-check", hint: "Falar no WhatsApp", to: "/selecionado/" + jobId };
      case "concluida":
        return { label: "Di\xE1ria conclu\xEDda", tone: "accent", icon: "star", hint: "Avaliar a obra", to: "/avaliar/" + jobId };
      case "avaliada":
        return { label: "Avalia\xE7\xE3o enviada", tone: "neutral", icon: "circle-check", hint: "Ver o bico", to: "/vaga/" + jobId };
      case "nao_selecionado":
        return { label: "N\xE3o foi essa vez", tone: "danger", icon: "circle-x", hint: "Ver a vaga", to: "/vaga/" + jobId };
      default:
        return { label: status, tone: "neutral", icon: "circle", hint: "Ver a vaga", to: "/vaga/" + jobId };
    }
  }
  var IN_PROGRESS = /* @__PURE__ */ new Set(["enviada", "em_analise", "pre_selecionado", "contratado"]);
  var CLOSED = /* @__PURE__ */ new Set(["concluida", "avaliada", "nao_selecionado"]);

  // js/screens/worker/MyApplications.js
  function renderMyApplications(navigate2) {
    const worker = currentWorker();
    const apps = applicationsForWorker(worker.id);
    const inProgress = apps.filter((a) => IN_PROGRESS.has(a.status));
    const closed = apps.filter((a) => CLOSED.has(a.status));
    const savedCount = savedJobs().length;
    function appCard(app, muted) {
      const job = getJob(app.jobId);
      if (!job) return null;
      const company = getCompany(job.companyId);
      const info = statusInfo(app.status, job.id);
      return JobTile({
        job,
        company,
        muted,
        onClick: () => navigate2(info.to),
        badge: { label: info.label, icon: info.icon, tone: muted ? "neutral" : info.tone },
        // Picked for the job: the WhatsApp chat with the company is open.
        corner: app.status === "pre_selecionado" || app.status === "contratado" ? WhatsAppButton({ href: workerToCompanyUrl(company, job), round: true }) : null
      });
    }
    return h(
      "div",
      { class: "flex flex-col" },
      h(
        "div",
        { class: "sticky top-0 z-20 flex items-center justify-between min-h-14 px-4 sm:px-0 bg-white border-b border-concrete-200 lg:static lg:bg-transparent lg:border-0 lg:pb-2" },
        h("h1", { class: "font-display font-semibold text-xl lg:text-[1.75rem] text-concrete-900" }, "Minhas candidaturas"),
        h("span", { class: "text-sm text-concrete-500" }, apps.length === 1 ? "1 no total" : `${apps.length} no total`)
      ),
      h(
        "div",
        { class: "flex flex-col gap-3 px-4 sm:px-0 py-4" },
        Card(
          { padding: "sm", onClick: () => navigate2("/vagas-salvas") },
          h(
            "div",
            { class: "flex items-center gap-3" },
            h("span", { class: "inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0" }, Icon("bookmark", { size: 20, color: "var(--brand)" })),
            h(
              "div",
              { class: "flex-1 min-w-0 flex flex-col" },
              h("span", { class: "font-semibold text-concrete-900" }, "Vagas salvas"),
              h("span", { class: "text-sm text-concrete-500" }, savedCount === 0 ? "Nenhum bico guardado" : savedCount === 1 ? "1 bico guardado" : `${savedCount} bicos guardados`)
            ),
            Icon("chevron-right", { size: 20, color: "var(--gray-400)" })
          )
        ),
        apps.length === 0 ? EmptyState({ icon: "file-check", title: "Voc\xEA ainda n\xE3o se candidatou", description: "Escolha um bico no mural e toque em quero esse bico. Fica tudo registrado aqui.", actionLabel: "Ver o mural", onAction: () => navigate2("/mural") }) : h(
          "div",
          { class: "flex flex-col gap-8 pt-2" },
          inProgress.length ? h(
            "div",
            { class: "flex flex-col gap-4" },
            h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Em andamento"),
            TileGrid(inProgress.map((a) => appCard(a, false)))
          ) : null,
          closed.length ? h(
            "div",
            { class: "flex flex-col gap-4" },
            h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Encerradas"),
            TileGrid(closed.map((a) => appCard(a, true)))
          ) : null
        )
      )
    );
  }

  // js/screens/worker/SavedJobs.js
  function renderSavedJobs(navigate2) {
    const jobs = savedJobs();
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Vagas salvas", onBack: () => goBack("/minhas-candidaturas") }),
      h(
        "div",
        { class: "flex flex-col gap-3 px-4 sm:px-0 py-4" },
        jobs.length === 0 ? EmptyState({ icon: "bookmark", title: "Voc\xEA ainda n\xE3o salvou nenhum bico", description: "No mural, toque na bandeirinha de um bico para guard\xE1-lo aqui e decidir depois.", actionLabel: "Ver o mural", onAction: () => navigate2("/mural") }) : TileGrid(jobs.map((job) => {
          const closed = isJobClosed(job);
          return JobTile({
            job,
            company: getCompany(job.companyId),
            onClick: () => navigate2("/vaga/" + job.id),
            muted: closed,
            badge: closed ? { label: "Vaga encerrada", icon: "circle-x", tone: "neutral" } : null,
            saved: true,
            onToggleSave: () => toggleSavedJob(job.id)
          });
        }))
      )
    );
  }

  // js/screens/worker/Selected.js
  function renderSelected(navigate2, params) {
    const job = getJob(params.id);
    if (!job) return h("div", { class: "p-6 text-concrete-500" }, "Vaga n\xE3o encontrada.");
    const company = getCompany(job.companyId);
    const hired = applicationFor(job.id, currentWorkerId());
    const title = hired && hired.status === "contratado" ? `Voc\xEA foi contratado pela ${company.name}` : `A ${company.name} quer falar com voc\xEA`;
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Voc\xEA avan\xE7ou", onBack: () => goBack("/minhas-candidaturas") }),
      h(
        "div",
        { class: "bg-brand-500 text-white px-4 sm:px-6 py-7 flex flex-col gap-3 lg:rounded-card" },
        Badge({ label: hired && hired.status === "contratado" ? "Contratado" : "Pr\xE9-selecionado", tone: "inverse", icon: "circle-check" }),
        h("h1", { class: "font-display font-bold text-3xl leading-tight text-white" }, title),
        h("p", { class: "text-white/85" }, `${job.role} \xB7 ${dateText(job)}`)
      ),
      h(
        "div",
        { class: "flex flex-col gap-4 px-4 sm:px-0 py-4" },
        Card(
          { padding: "md" },
          h(
            "div",
            { class: "flex flex-col gap-4" },
            h(
              "div",
              { class: "flex items-center gap-3" },
              h("span", { class: "inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 shrink-0" }, Icon("building-2", { size: 24, color: "var(--brand)" })),
              h("div", { class: "flex flex-col gap-0.5" }, h("span", { class: "font-semibold text-concrete-900" }, company.name), h("span", { class: "text-sm text-concrete-500" }, company.tipoObra || "Constru\xE7\xE3o civil"))
            ),
            WhatsAppButton({ href: workerToCompanyUrl(company, job), size: "lg", fullWidth: true }),
            h("span", { class: "text-sm text-concrete-700" }, "Combine ponto de encontro, hor\xE1rio e pagamento direto com a construtora. A Bicos n\xE3o cobra taxa e n\xE3o entra na negocia\xE7\xE3o.")
          )
        ),
        Card(
          { tone: "sunken", padding: "md" },
          h(
            "div",
            { class: "flex flex-col gap-3" },
            kv("Di\xE1ria combinada", job.pay == null ? "A combinar" : formatBRL(job.pay)),
            kv("Local", job.location),
            kv("Contato liberado", "Hoje \xB7 9h10")
          )
        ),
        Button({ label: "Ver a vaga de novo", variant: "secondary", fullWidth: true, onClick: () => navigate2("/vaga/" + job.id) })
      )
    );
  }
  function kv(label, value) {
    return h("div", { class: "flex items-center justify-between gap-3" }, h("span", { class: "text-sm text-concrete-500" }, label), h("span", { class: "font-mono font-bold text-concrete-900" }, value));
  }

  // js/screens/worker/RateJob.js
  var KEY11 = "rate-job";
  var OPTIONS = [
    { id: "pagou", label: "Pagou no dia", icon: "hand-coins" },
    { id: "epi", label: "EPI no local", icon: "hard-hat" },
    { id: "horario", label: "Hor\xE1rio combinado", icon: "clock" },
    { id: "equipe", label: "Equipe respeitosa", icon: "users" }
  ];
  function renderRateJob(navigate2, params) {
    const job = getJob(params.id);
    if (!job) return h("div", { class: "p-6 text-concrete-500" }, "Vaga n\xE3o encontrada.");
    const company = getCompany(job.companyId);
    const ui = getUI(KEY11, { rating: 5, selected: ["pagou"], comment: "" });
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Avaliar a di\xE1ria", onBack: () => goBack("/minhas-candidaturas") }),
      h(
        "div",
        { class: "flex flex-col gap-5 px-4 sm:px-0 py-4" },
        h(
          "div",
          { class: "flex flex-col gap-1" },
          h("h1", { class: "font-display font-bold text-2xl text-concrete-900" }, "Como foi a di\xE1ria?"),
          h("span", { class: "text-sm text-concrete-500" }, `${job.role} \xB7 ${company.name} \xB7 ${dateText(job)}`)
        ),
        Card(
          { padding: "md" },
          h(
            "div",
            { class: "flex flex-col items-center gap-3" },
            h("span", { class: "font-semibold text-concrete-900" }, "Sua nota para a construtora"),
            Rating({ value: ui.rating, editable: true, onChange: (v) => setUI(KEY11, { rating: v }) })
          )
        ),
        h(
          "div",
          { class: "flex flex-col gap-2.5" },
          h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "O que aconteceu"),
          h("div", { class: "flex flex-wrap gap-2" }, ...OPTIONS.map((o) => Tag({
            label: o.label,
            icon: o.icon,
            selected: ui.selected.includes(o.id),
            onClick: () => setUI(KEY11, { selected: ui.selected.includes(o.id) ? ui.selected.filter((x) => x !== o.id) : ui.selected.concat([o.id]) })
          })))
        ),
        Input({
          id: "rate-comment",
          label: "Quer escrever algo? (opcional)",
          placeholder: "Ex.: obra organizada, pagamento em PIX no fim do dia",
          hint: "Sua avalia\xE7\xE3o aparece no perfil da construtora.",
          value: ui.comment,
          onInput: (v) => setUI(KEY11, { comment: v })
        }),
        h("div", { class: "pt-1" }, Button({
          label: "Enviar avalia\xE7\xE3o",
          size: "lg",
          fullWidth: true,
          onClick: () => {
            markReviewed(job.id, currentWorkerId());
            navigate2("/minhas-candidaturas");
          }
        }))
      )
    );
  }

  // js/screens/recruiter/CreateJob.js
  var KEY12 = "create-job";
  function nextJobId() {
    return "BC-" + (5100 + Math.floor(Math.random() * 800));
  }
  function digits(v, max) {
    return String(v).replace(/\D/g, "").slice(0, max);
  }
  function renderCreateJob(navigate2) {
    const ui = getUI(KEY12, {
      step: 1,
      fotos: [],
      tipo: "",
      local: "",
      dias: null,
      data: "",
      periodoInicio: "",
      periodoFim: "",
      diarias: "1",
      vagas: "1",
      valor: "",
      negociavel: false,
      requisitos: ["Botina e capacete pr\xF3prios"],
      detalhe: "",
      errors: {},
      publishing: false
    });
    const clearError = (field) => Object.assign({}, ui.errors, { [field]: null });
    const hasHours = Boolean(ui.periodoInicio && ui.periodoFim);
    function validateStep1() {
      const errors = {};
      if (!ui.tipo.trim()) errors.tipo = "Escreva o tipo de servi\xE7o da vaga.";
      if (!ui.local.trim()) errors.local = "Informe o endere\xE7o da obra.";
      if (!ui.dias) errors.dias = "Escolha em que dias o bico pode acontecer.";
      if (Boolean(ui.periodoInicio) !== Boolean(ui.periodoFim)) errors.periodo = "Preencha o in\xEDcio e o fim, ou deixe os dois em branco.";
      if (!ui.diarias || Number(ui.diarias) < 1) errors.diarias = "Informe quantas di\xE1rias.";
      if (!ui.vagas || Number(ui.vagas) < 1) errors.vagas = "Informe quantas pessoas a vaga precisa.";
      return errors;
    }
    function validateStep2() {
      const errors = {};
      if (!ui.negociavel) {
        const n = parseInt(ui.valor, 10);
        if (!ui.valor.trim()) errors.valor = "Informe o valor da di\xE1ria, ou marque como a combinar.";
        else if (!n || n < 80) errors.valor = "Informe um valor de R$ 80 ou mais.";
      }
      if (!ui.detalhe.trim()) errors.detalhe = "Descreva o servi\xE7o da vaga.";
      return errors;
    }
    function advance() {
      if (ui.step === 1) {
        const errors2 = validateStep1();
        if (Object.keys(errors2).length) {
          setUI(KEY12, { errors: errors2 });
          return;
        }
        setUI(KEY12, { step: 2, errors: {} });
        return;
      }
      const errors = validateStep2();
      if (Object.keys(errors).length) {
        setUI(KEY12, { errors });
        return;
      }
      setUI(KEY12, { publishing: true });
      setTimeout(() => {
        const id = nextJobId();
        const hours = hasHours ? `${ui.periodoInicio}h\u2013${ui.periodoFim}h` : null;
        const date = ui.data.trim() || null;
        const diariasNum = Number(ui.diarias) || 1;
        createJob({
          id,
          companyId: currentCompanyId(),
          role: ui.tipo.trim(),
          pay: ui.negociavel ? null : parseInt(ui.valor, 10),
          location: "Tatuap\xE9, SP",
          address: ui.local,
          distance: "0 km",
          date,
          hours,
          dias: ui.dias,
          duration: diariasNum === 1 ? "1 di\xE1ria" : `${diariasNum} di\xE1rias`,
          slots: Number(ui.vagas) || 1,
          requirements: ui.requisitos,
          description: ui.detalhe.trim(),
          photos: ui.fotos
        });
        setUI(KEY12, { publishing: false });
        resetUI(KEY12);
        navigate2("/vaga-publicada/" + id);
      }, 700);
    }
    const step1 = h(
      "div",
      { class: "flex flex-col gap-6" },
      h(
        "div",
        { class: "flex flex-col items-center gap-2.5 text-center" },
        h("span", { class: "text-sm font-semibold text-concrete-900" }, "Fotos da vaga (opcional)"),
        PhotoManager({ photos: ui.fotos, onChange: (fotos) => setUI(KEY12, { fotos }) }),
        h("span", { class: "max-w-[22rem] text-sm text-concrete-500" }, "At\xE9 6 fotos do canteiro. A primeira vira a capa do bico no mural.")
      ),
      Input({
        id: "create-job-tipo",
        label: "Tipo de servi\xE7o",
        placeholder: "Ex.: Pedreiro de acabamento",
        icon: "hammer",
        value: ui.tipo,
        error: ui.errors.tipo,
        onInput: (v) => setUI(KEY12, { tipo: v, errors: Object.assign({}, ui.errors, { tipo: null }) })
      }),
      Input({ id: "create-job-local", label: "Endere\xE7o da obra", placeholder: "Rua, n\xFAmero e bairro", icon: "map-pin", value: ui.local, error: ui.errors.local, onInput: (v) => setUI(KEY12, { local: v, errors: Object.assign({}, ui.errors, { local: null }) }) }),
      h(
        "div",
        { class: "flex flex-col gap-2", role: "radiogroup", "aria-labelledby": "create-job-dias-label" },
        h("span", { id: "create-job-dias-label", class: "text-sm font-semibold text-concrete-900" }, "Em que dias pode ser?"),
        h("div", { class: "grid grid-cols-3 gap-2 max-w-[27rem]" }, ...DIAS_ORDEM.map((id) => diasOption(id, ui.dias === id, () => setUI(KEY12, { dias: id, errors: clearError("dias") })))),
        ui.errors.dias ? h("span", { class: "flex items-center gap-1.5 text-sm text-danger-500" }, Icon("circle-alert", { size: 14 }), ui.errors.dias) : null
      ),
      // Short answers get short fields, side by side where they fit.
      h(
        "div",
        { class: "flex flex-wrap items-start gap-x-6 gap-y-6" },
        h("div", { class: "w-[12.5rem]" }, Input({
          id: "create-job-data",
          label: "Data (opcional)",
          placeholder: "Ex.: 12 set",
          icon: "calendar",
          value: ui.data,
          hint: "Em branco: data a combinar.",
          onInput: (v) => setUI(KEY12, { data: v })
        })),
        h(
          "div",
          { class: "flex flex-col gap-1.5" },
          h("span", { class: "text-sm font-semibold text-concrete-900" }, "Hor\xE1rio (opcional)"),
          h(
            "div",
            { class: "flex items-center gap-2" },
            h("div", { class: "w-[6.5rem]" }, Input({ id: "create-job-periodo-inicio", placeholder: "7", suffix: "h", inputMode: "numeric", value: ui.periodoInicio, invalid: Boolean(ui.errors.periodo), onInput: (v) => setUI(KEY12, { periodoInicio: digits(v, 2), errors: clearError("periodo") }) })),
            h("span", { class: "text-sm text-concrete-500" }, "\xE0s"),
            h("div", { class: "w-[6.5rem]" }, Input({ id: "create-job-periodo-fim", placeholder: "17", suffix: "h", inputMode: "numeric", value: ui.periodoFim, invalid: Boolean(ui.errors.periodo), onInput: (v) => setUI(KEY12, { periodoFim: digits(v, 2), errors: clearError("periodo") }) }))
          ),
          ui.errors.periodo ? h("span", { class: "max-w-[15rem] text-sm text-danger-500" }, ui.errors.periodo) : h("span", { class: "text-sm text-concrete-500" }, "Em branco: hor\xE1rio a combinar.")
        )
      ),
      h(
        "div",
        { class: "flex flex-col gap-1.5" },
        h(
          "div",
          { class: "grid grid-cols-2 gap-3 max-w-[20rem]" },
          Input({
            id: "create-job-diarias",
            label: "Di\xE1rias",
            placeholder: "1",
            suffix: "di\xE1ria(s)",
            inputMode: "numeric",
            value: ui.diarias,
            invalid: Boolean(ui.errors.diarias),
            onInput: (v) => setUI(KEY12, { diarias: digits(v, 2), errors: clearError("diarias") })
          }),
          Input({
            id: "create-job-vagas",
            label: "Pessoas",
            placeholder: "1",
            suffix: "pessoa(s)",
            inputMode: "numeric",
            value: ui.vagas,
            invalid: Boolean(ui.errors.vagas),
            onInput: (v) => setUI(KEY12, { vagas: digits(v, 2), errors: clearError("vagas") })
          })
        ),
        ui.errors.diarias || ui.errors.vagas ? h("span", { class: "flex items-center gap-1.5 text-sm text-danger-500" }, Icon("circle-alert", { size: 14 }), ui.errors.diarias || ui.errors.vagas) : h("span", { class: "text-sm text-concrete-500" }, "Quantos dias o bico dura e quantos trabalhadores voc\xEA precisa.")
      )
    );
    const step2 = h(
      "div",
      { class: "flex flex-col gap-6" },
      h(
        "div",
        { class: "flex flex-col items-start gap-2" },
        ui.negociavel ? null : h("div", { class: "w-full max-w-[15rem]" }, Input({
          id: "create-job-valor",
          label: "Valor da di\xE1ria",
          placeholder: "220",
          suffix: "reais",
          inputMode: "numeric",
          value: ui.negociavel ? "" : ui.valor,
          error: ui.errors.valor,
          hint: ui.errors.valor || ui.negociavel ? null : "O trabalhador v\xEA esse valor no mural. M\xEDnimo de R$ 80.",
          onInput: (v) => setUI(KEY12, { valor: digits(v, 5), errors: Object.assign({}, ui.errors, { valor: null }) })
        })),
        ui.negociavel ? null : Button({ label: "Deixar valor a combinar", variant: "ghost", size: "sm", iconLeft: "handshake", onClick: () => setUI(KEY12, { negociavel: true, valor: "", errors: Object.assign({}, ui.errors, { valor: null }) }) }),
        ui.negociavel ? h("span", { class: "text-sm font-semibold text-concrete-900" }, "Valor da di\xE1ria") : null,
        ui.negociavel ? h(
          "div",
          { class: "w-full flex items-center gap-2 p-3 rounded-control bg-brand-50 border border-brand-200" },
          Icon("handshake", { size: 18, color: "var(--text-brand)" }),
          h("span", { class: "flex-1 text-sm text-brand-600" }, 'O trabalhador v\xEA "A combinar" no lugar do valor, e negocia direto com voc\xEA.'),
          Button({ label: "Definir um valor", variant: "ghost", size: "sm", onClick: () => setUI(KEY12, { negociavel: false }) })
        ) : null
      ),
      h(
        "div",
        { class: "flex flex-col gap-2.5" },
        h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "O que o trabalhador precisa levar"),
        h("div", { class: "flex flex-wrap gap-2" }, ...REQUISITOS_OPCOES.map((r) => Tag({ label: r, selected: ui.requisitos.includes(r), onClick: () => setUI(KEY12, { requisitos: ui.requisitos.includes(r) ? ui.requisitos.filter((x) => x !== r) : ui.requisitos.concat([r]) }) })))
      ),
      h(
        "div",
        { class: "flex flex-col gap-1.5 w-full" },
        h("label", { for: "create-job-detalhe", class: "text-sm font-semibold text-concrete-900" }, "Descri\xE7\xE3o do bico"),
        h("textarea", {
          id: "create-job-detalhe",
          "data-focus-id": "create-job-detalhe",
          rows: 3,
          placeholder: "Ex.: reboco de duas paredes internas, argamassa e areia j\xE1 est\xE3o no local.",
          value: ui.detalhe,
          class: cx(
            "w-full px-3 py-2.5 bg-white rounded-control border outline-none text-base text-concrete-900 placeholder:text-concrete-400 resize-none transition-colors duration-150",
            ui.errors.detalhe ? "border-danger-500" : "border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          ),
          oninput: (e) => setUI(KEY12, { detalhe: e.target.value, errors: Object.assign({}, ui.errors, { detalhe: null }) })
        }),
        ui.errors.detalhe ? h("span", { class: "flex items-center gap-1.5 text-sm text-danger-500" }, Icon("circle-alert", { size: 14 }), ui.errors.detalhe) : h("span", { class: "text-sm text-concrete-500" }, "Quanto mais claro, menos desencontro no canteiro. Essa descri\xE7\xE3o aparece para quem ver o bico.")
      ),
      h(
        "div",
        { class: "flex flex-col items-center gap-3 pt-5 border-t border-concrete-200 text-center" },
        h("span", { class: "font-semibold text-concrete-900" }, "Como vai aparecer no mural"),
        h(
          "div",
          { class: "w-[13rem] max-w-full text-left", "aria-hidden": "true" },
          JobTile({
            job: {
              id: "previa",
              role: ui.tipo.trim() || "Tipo de servi\xE7o",
              location: "Tatuap\xE9, SP",
              dias: ui.dias,
              date: ui.data.trim() || null,
              hours: hasHours ? `${ui.periodoInicio}h\u2013${ui.periodoFim}h` : null,
              pay: ui.negociavel || !ui.valor ? null : parseInt(ui.valor, 10),
              photos: ui.fotos
            },
            company: getCompany(currentCompanyId()),
            onClick: () => {
            }
          })
        )
      )
    );
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Publicar vaga", onBack: () => ui.step === 2 ? setUI(KEY12, { step: 1 }) : goBack("/mural") }),
      h(
        "div",
        { class: "flex items-center gap-2 px-4 sm:px-0 pt-3" },
        stepDot(1, ui.step >= 1),
        h("span", { class: "text-sm text-concrete-500" }, "Servi\xE7o, local e dias"),
        h("span", { class: "flex-1 h-px bg-concrete-200" }),
        stepDot(2, ui.step >= 2),
        h("span", { class: "text-sm text-concrete-500" }, "Valor e requisitos")
      ),
      h("div", { class: "px-4 sm:px-0 py-5" }, ui.step === 1 ? step1 : step2),
      h(
        "div",
        { class: "px-4 sm:px-0 py-3 flex flex-col gap-1.5" },
        Button({ label: ui.step === 1 ? "Continuar" : "Publicar vaga", size: "lg", fullWidth: true, loading: ui.publishing, onClick: advance }),
        h("span", { class: "text-center text-xs text-concrete-500" }, "Publicar \xE9 gr\xE1tis. Voc\xEA paga s\xF3 se impulsionar.")
      )
    );
  }
  function diasOption(id, checked, onSelect) {
    const d = DIAS[id];
    return h(
      "button",
      {
        type: "button",
        role: "radio",
        "aria-checked": checked ? "true" : "false",
        "aria-label": `${d.label}: ${d.hint}`,
        class: cx(
          "relative flex flex-col items-center justify-center gap-0.5 min-h-[4.5rem] px-2 py-2.5 rounded-card border text-center transition-colors",
          checked ? "bg-brand-50 border-brand-500 ring-1 ring-brand-500" : "bg-white border-concrete-300 hover:bg-concrete-50"
        ),
        onClick: onSelect
      },
      checked ? h("span", { class: "absolute top-1.5 right-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-500" }, Icon("check", { size: 11, color: "#fff" })) : null,
      h("span", { class: cx("text-sm font-bold leading-tight", checked ? "text-brand-600" : "text-concrete-900") }, d.pick),
      h("span", { class: "text-xs text-concrete-500" }, d.pickSub)
    );
  }
  function stepDot(n, active) {
    return h("span", { class: `inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${active ? "bg-brand-500 text-white" : "bg-concrete-100 text-concrete-500"}` }, String(n));
  }

  // js/screens/recruiter/JobPublished.js
  function renderJobPublished(navigate2, params) {
    const job = getJob(params.id);
    if (!job) return h("div", { class: "p-6 text-concrete-500" }, "Vaga n\xE3o encontrada.");
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Vaga publicada", onBack: () => goBack("/mural") }),
      h(
        "div",
        { class: "flex flex-col items-center text-center gap-5 px-6 pt-10 pb-8 lg:max-w-app lg:mx-auto" },
        h("span", { class: "inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full bg-success-50" }, Icon("circle-check", { size: 34, color: "var(--green-500)" })),
        h(
          "div",
          { class: "flex flex-col gap-2" },
          h("h1", { class: "font-display font-bold text-2xl text-concrete-900" }, "Vaga publicada"),
          h("p", { class: "text-base text-concrete-700" }, "Ela j\xE1 est\xE1 no mural de quem trabalha perto da obra. Avisamos quando chegar o primeiro candidato.")
        ),
        Card(
          { tone: "sunken", padding: "md", className: "w-full" },
          h(
            "div",
            { class: "flex items-center justify-between gap-3" },
            h("div", { class: "flex flex-col gap-0.5 min-w-0" }, h("span", { class: "font-semibold text-concrete-900" }, job.role), h("span", { class: "text-sm text-concrete-500" }, `${job.address} \xB7 ${dateText(job)}`)),
            h("span", { class: "font-mono font-bold text-xl text-concrete-900" }, job.pay == null ? "A combinar" : formatBRL(job.pay))
          )
        ),
        h(
          "div",
          { class: "w-full flex flex-col gap-2 pt-2" },
          Button({ label: "Impulsionar essa vaga", iconLeft: "zap", fullWidth: true, onClick: () => navigate2("/impulsionar/" + job.id) }),
          Button({ label: "Voltar ao in\xEDcio", variant: "ghost", fullWidth: true, onClick: () => navigate2("/mural") })
        )
      )
    );
  }

  // js/components/CandidateRow.js
  function CandidateRow({ worker, summary, distance, isNew, decision, onClick, onApprove, onReject }) {
    const decided = decision === "aprovado" || decision === "recusado";
    return h(
      "div",
      {
        class: cx("flex items-center gap-3 p-4 border-b border-concrete-200 last:border-0 cursor-pointer hover:bg-concrete-50", decision === "recusado" ? "opacity-60" : ""),
        onClick
      },
      h("span", {
        class: "inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0"
      }, worker.initials),
      h(
        "div",
        { class: "flex-1 min-w-0 flex flex-col gap-1" },
        h(
          "div",
          { class: "flex items-center gap-2" },
          h("span", { class: "font-semibold text-concrete-900 truncate" }, worker.name),
          isNew ? h("span", { class: "shrink-0 px-2 py-0.5 rounded-full bg-accent-50 text-accent-600 text-[0.6875rem] font-bold" }, "Novo") : null
        ),
        h(
          "div",
          { class: "flex items-center gap-2 text-sm text-concrete-500" },
          h("span", { class: "truncate" }, summary),
          h("span", {}, "\xB7"),
          h("span", { class: "shrink-0" }, distance)
        ),
        !isNew ? Rating({ value: worker.rating, count: worker.jobsDone, size: 12 }) : null
      ),
      decided ? h("span", {
        class: cx(
          "shrink-0 px-2.5 h-6 inline-flex items-center rounded-full text-xs font-bold",
          decision === "aprovado" ? "bg-success-50 text-success-500" : "bg-danger-50 text-danger-500"
        )
      }, decision === "aprovado" ? "Aprovado" : "Recusado") : h(
        "div",
        { class: "flex items-center gap-1 shrink-0", onClick: (e) => e.stopPropagation() },
        onReject ? IconButton({ icon: "x", label: "Recusar candidato", variant: "ghost", size: "sm", onClick: onReject }) : null,
        onApprove ? IconButton({ icon: "check", label: "Aprovar candidato", variant: "brand", size: "sm", onClick: onApprove }) : null
      )
    );
  }

  // js/screens/recruiter/JobManage.js
  var KEY13 = "job-manage";
  function renderJobManage(navigate2, params) {
    const job = getJob(params.id);
    if (!job) return h("div", { class: "p-6 text-concrete-500" }, "Vaga n\xE3o encontrada.");
    if (job.companyId !== currentCompanyId()) {
      return h(
        "div",
        { class: "flex flex-col" },
        BackBar({ title: "Sua vaga", onBack: () => goBack("/mural") }),
        EmptyState({
          icon: "lock",
          title: "Essa vaga n\xE3o \xE9 sua",
          description: "S\xF3 a construtora que publicou o bico pode ver os candidatos e a quantidade de vagas."
        })
      );
    }
    const ui = getUI(KEY13, { confirmClose: false });
    const applications = applicationsForJob(job.id);
    const slots = job.slots || 1;
    const approved = approvedCount(job.id);
    const pending = pendingCount(job.id);
    const closed = isJobClosed(job);
    const status = jobStatus(job, approved, pending);
    const payCard = (className) => Card(
      { tone: "brand", padding: "md", className },
      h(
        "div",
        { class: "flex flex-col gap-4" },
        h(
          "div",
          { class: "flex items-end justify-between gap-3" },
          h("div", { class: "flex flex-col gap-0.5" }, h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-brand-600" }, "Di\xE1ria que voc\xEA ofereceu"), h("span", { class: "font-mono font-bold text-4xl text-concrete-900" }, job.pay == null ? "A combinar" : formatBRL(job.pay))),
          h("span", { class: "text-sm text-concrete-700 text-right" }, "Pago no fim", h("br"), "da di\xE1ria")
        ),
        h("div", { class: "flex items-center gap-2 pt-4 border-t border-brand-200" }, Icon("calendar", { size: 20, color: "var(--text-brand)" }), h("span", { class: "font-display font-semibold text-lg text-concrete-900" }, whenText(job)))
      )
    );
    const slotsCard = (className) => Card(
      { padding: "md", className },
      h(
        "div",
        { class: "flex flex-col gap-3" },
        h(
          "div",
          { class: "flex items-baseline justify-between gap-3" },
          h("span", { class: "font-semibold text-concrete-900" }, `${approved} de ${slots} ${slots === 1 ? "vaga preenchida" : "vagas preenchidas"}`),
          h("span", { class: "font-mono text-sm text-concrete-500" }, `${slots} no total`)
        ),
        h("div", { class: "flex gap-1.5" }, ...Array.from({ length: slots }).map((_, i) => h("span", { class: `flex-1 h-2 rounded-full ${i < approved ? "bg-brand-500" : "bg-concrete-200"}` }))),
        h("span", { class: `text-sm ${closed ? "text-success-500" : "text-concrete-500"}` }, closed ? "Bico fechado. A vaga saiu do mural e n\xE3o recebe mais candidatura." : "Aprove candidatos at\xE9 preencher todas as vagas. A\xED o bico fecha sozinho.")
      )
    );
    const actions = () => [
      Button({ label: "Editar vaga", variant: "secondary", iconLeft: "pencil", className: "flex-1", onClick: () => {
      } }),
      Button({ label: "Encerrar vaga", variant: "ghost", className: "flex-1", onClick: () => setUI(KEY13, { confirmClose: true }) })
    ];
    const side = h(
      "aside",
      { class: "hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-28" },
      payCard(),
      slotsCard(),
      !closed ? h("div", { class: "flex gap-3" }, ...actions()) : null
    );
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Sua vaga", onBack: () => goBack("/mural") }),
      h(
        "div",
        { class: "flex flex-col gap-4 px-4 sm:px-0 py-4 pb-28 lg:pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10" },
        h(
          "div",
          { class: "flex flex-col gap-4 lg:gap-6" },
          h(
            "div",
            { class: "flex flex-col gap-1.5" },
            h("span", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Fotos da vaga"),
            PhotoManager({ photos: jobPhotos(job), onChange: (photos) => updateJob(job.id, { photos }) }),
            h("span", { class: "text-xs text-concrete-500" }, "At\xE9 6 fotos. A primeira \xE9 a capa do bico no mural.")
          ),
          h(
            "div",
            { class: "flex flex-col gap-1.5" },
            h("div", { class: "flex items-center gap-2" }, Badge(status), h("span", { class: "font-mono text-xs text-concrete-500" }, job.id)),
            h("h1", { class: "font-display font-bold text-2xl text-concrete-900" }, job.role),
            job.description ? h("p", { class: "text-sm text-concrete-700 leading-relaxed" }, job.description) : null
          ),
          payCard("lg:hidden"),
          slotsCard("lg:hidden"),
          h(
            "div",
            { class: "flex flex-col gap-2" },
            h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Onde e como"),
            Card(
              { padding: "md" },
              h(
                "div",
                { class: "flex flex-col gap-3.5" },
                infoRow2("map-pin", job.address, job.location),
                diasInfo(job) ? infoRow2("calendar-days", diasInfo(job).label, diasInfo(job).hint) : null,
                infoRow2("clock", hoursText(job), job.duration),
                infoRow2("hand-coins", "Pagamento em PIX no fim da di\xE1ria", "Combinado direto com o trabalhador")
              )
            )
          ),
          h(
            "div",
            { class: "flex flex-col gap-2" },
            h(
              "div",
              { class: "flex items-center justify-between gap-2" },
              h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, applications.length === 1 ? "1 candidato" : `${applications.length} candidatos`),
              pending ? h("span", { class: "text-xs text-brand-600" }, `${pending} ${pending === 1 ? "novo" : "novos"}`) : null
            ),
            applications.length ? h("div", { class: "bg-white border border-concrete-200 rounded-card shadow-card overflow-hidden" }, ...applications.map((a) => {
              const worker = getWorker(a.workerId);
              const decision = a.status === "pre_selecionado" || a.status === "contratado" ? "aprovado" : a.status === "nao_selecionado" ? "recusado" : null;
              return CandidateRow({
                worker,
                summary: worker.role + " \xB7 " + worker.region,
                distance: worker.distance,
                isNew: worker.novo,
                decision,
                onClick: () => navigate2(`/trabalhador/${worker.id}/${job.id}`),
                onApprove: !decision && !closed ? (e) => {
                  e.stopPropagation();
                  decideApplication(job.id, worker.id, "aprovado");
                  if (isJobClosed(job)) navigate2("/fechado/" + job.id);
                } : null,
                onReject: !decision && !closed ? (e) => {
                  e.stopPropagation();
                  decideApplication(job.id, worker.id, "recusado");
                } : null
              });
            })) : EmptyState({ icon: "users", title: "Nenhum candidato ainda", description: "Vagas com valor acima da m\xE9dia da regi\xE3o costumam receber candidato no mesmo dia. Voc\xEA tamb\xE9m pode impulsionar.", actionLabel: "Impulsionar vaga", onAction: () => navigate2("/impulsionar/" + job.id) })
          )
        ),
        side
      ),
      !closed ? h("div", { class: "sticky bottom-0 px-4 sm:px-0 py-3 bg-white shadow-bar flex gap-3 lg:hidden" }, ...actions()) : null,
      Dialog({
        open: ui.confirmClose,
        tone: "danger",
        title: "Encerrar essa vaga?",
        description: "A vaga sai do mural imediatamente e para de receber candidaturas. Isso n\xE3o pode ser desfeito.",
        confirmLabel: "Encerrar vaga",
        onConfirm: () => {
          closeJob(job.id);
          setUI(KEY13, { confirmClose: false });
          navigate2("/mural");
        },
        cancelLabel: "Cancelar",
        onCancel: () => setUI(KEY13, { confirmClose: false })
      })
    );
  }
  function jobStatus(job, approved, pending) {
    if (job.closed && job.semContratacao) return { label: "Encerrada sem contrata\xE7\xE3o", tone: "danger", icon: "circle-x" };
    if (isJobClosed(job)) return { label: `Bico fechado \xB7 ${approved} de ${job.slots || 1}`, tone: "success", icon: "circle-check" };
    if (pending) return { label: pending === 1 ? "1 aguardando an\xE1lise" : `${pending} aguardando an\xE1lise`, tone: "warning", icon: "clock" };
    const total = applicationsForJob(job.id).length;
    if (total) return { label: total === 1 ? "1 candidato" : `${total} candidatos`, tone: "brand", icon: "users" };
    return { label: "Sem candidatos ainda", tone: "neutral", icon: "search-x" };
  }
  function infoRow2(icon, main, sub) {
    return h(
      "div",
      { class: "flex gap-3 items-start" },
      Icon(icon, { size: 20, color: "var(--text-subtle)" }),
      h("div", { class: "flex flex-col" }, h("span", { class: "font-semibold text-concrete-900" }, main), h("span", { class: "text-sm text-concrete-500" }, sub))
    );
  }

  // js/screens/recruiter/JobClosed.js
  function renderJobClosed(navigate2, params) {
    const job = getJob(params.id);
    const team = job ? applicationsForJob(job.id).filter((a) => a.status === "pre_selecionado" || a.status === "contratado").map((a) => getWorker(a.workerId)) : [];
    if (!job || team.length === 0) {
      return h(
        "div",
        { class: "flex flex-col items-center justify-center min-h-screen gap-3" },
        h("p", { class: "text-concrete-500" }, "Esse bico ainda n\xE3o foi fechado."),
        Button({ label: "Voltar ao in\xEDcio", variant: "secondary", onClick: () => navigate2("/mural") })
      );
    }
    const title = team.length === 1 ? `${team[0].name} est\xE1 contratado` : `${team.length} trabalhadores contratados`;
    const total = (job.pay || 0) * Math.max(team.length, 1);
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Bico fechado", onBack: () => goBack("/mural") }),
      h(
        "div",
        { class: "bg-brand-500 text-white px-4 sm:px-6 py-7 flex flex-col gap-3 lg:rounded-card" },
        Badge({ label: "Bico fechado", tone: "inverse", icon: "circle-check" }),
        h("h1", { class: "font-display font-bold text-3xl leading-tight text-white" }, title),
        h("p", { class: "text-white/85" }, `${job.role} \xB7 ${dateText(job)}`)
      ),
      h(
        "div",
        { class: "flex flex-col gap-4 px-4 sm:px-0 py-4" },
        Card(
          { tone: "sunken", padding: "sm" },
          h(
            "div",
            { class: "flex items-center gap-3" },
            Icon("circle-check", { size: 20, color: "var(--green-500)" }),
            h("span", { class: "flex-1 text-sm text-concrete-700" }, "A vaga saiu do mural. Quem n\xE3o foi aprovado recebeu o aviso de que o bico foi fechado.")
          )
        ),
        h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Equipe contratada"),
        h("div", { class: "flex flex-col gap-3" }, ...team.map((worker) => Card(
          { padding: "md" },
          h(
            "div",
            { class: "flex flex-col gap-3.5" },
            h(
              "div",
              { class: "flex items-center gap-3" },
              h("span", { class: "inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-50 text-accent-600 font-bold shrink-0" }, worker.initials),
              h("div", { class: "flex-1 min-w-0 flex flex-col" }, h("span", { class: "font-semibold text-concrete-900" }, worker.name), h("span", { class: "text-sm text-concrete-500" }, `${worker.role} \xB7 ${worker.region}`))
            ),
            Button({ label: "Falar no WhatsApp", variant: "accent", fullWidth: true, iconLeft: "message-circle", onClick: () => {
            } })
          )
        ))),
        Card(
          { tone: "sunken", padding: "md" },
          h(
            "div",
            { class: "flex flex-col gap-3" },
            kv2("Di\xE1ria combinada", job.pay == null ? "A combinar" : formatBRL(job.pay)),
            kv2("Local", job.location),
            kv2("Total do bico", formatBRL(total))
          )
        ),
        Button({ label: "Voltar ao in\xEDcio", variant: "secondary", fullWidth: true, onClick: () => navigate2("/mural") })
      )
    );
  }
  function kv2(label, value) {
    return h("div", { class: "flex items-center justify-between gap-3" }, h("span", { class: "text-sm text-concrete-500" }, label), h("span", { class: "font-mono font-bold text-concrete-900" }, value));
  }

  // js/screens/recruiter/BoostJob.js
  var KEY14 = "boost-job";
  var PLANS = [
    { id: "24h", label: "Topo do mural por 24h", desc: "Aparece antes das outras vagas da regi\xE3o.", price: "R$ 12" },
    { id: "3d", label: "Topo do mural por 3 dias", desc: "Para vaga com data mais distante.", price: "R$ 28" },
    { id: "whats", label: "24h + aviso por WhatsApp", desc: "Avisamos quem tem o perfil da vaga por perto.", price: "R$ 39" }
  ];
  function renderBoostJob(navigate2, params) {
    const job = getJob(params.id);
    if (!job) return h("div", { class: "p-6 text-concrete-500" }, "Vaga n\xE3o encontrada.");
    const ui = getUI(KEY14, { plan: "24h" });
    const chosen = PLANS.find((p) => p.id === ui.plan);
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Impulsionar vaga", onBack: () => goBack("/vaga-gerenciar/" + job.id) }),
      h(
        "div",
        { class: "flex flex-col gap-5 px-4 sm:px-0 py-4" },
        h(
          "div",
          { class: "flex flex-col gap-1" },
          h("h1", { class: "font-display font-bold text-2xl text-concrete-900" }, "Sua vaga no topo do mural"),
          h("span", { class: "text-sm text-concrete-700" }, `${job.role} \xB7 ${job.location}`)
        ),
        Card(
          { padding: "md" },
          h(
            "div",
            { class: "flex flex-col gap-3.5" },
            fact("zap", "A vaga aparece no bloco de cima do mural, antes das outras da mesma regi\xE3o.", "var(--brand)"),
            fact("users", "Vagas impulsionadas na regi\xE3o recebem em m\xE9dia 4 candidatos a mais.", "var(--text-subtle)"),
            fact("triangle-alert", "Impulsionar n\xE3o garante candidato. Se ningu\xE9m se candidatar, devolvemos o valor em 3 dias.", "var(--amber-500)")
          )
        ),
        h(
          "div",
          { class: "flex flex-col gap-2.5" },
          h("div", { class: "text-xs font-bold tracking-[0.08em] uppercase text-concrete-500" }, "Por quanto tempo"),
          h("div", { class: "flex flex-col gap-2" }, ...PLANS.map((p) => {
            const active = ui.plan === p.id;
            return h(
              "button",
              {
                type: "button",
                onClick: () => setUI(KEY14, { plan: p.id }),
                class: `flex items-center gap-3 w-full min-h-[4.5rem] px-4 py-3.5 rounded-card border transition-colors text-left ${active ? "bg-brand-50 border-brand-500" : "bg-white border-concrete-300 shadow-card"}`
              },
              h("span", { class: `shrink-0 w-5 h-5 rounded-full border-2 ${active ? "border-brand-500 bg-brand-500" : "border-concrete-400"}` }),
              h(
                "span",
                { class: "flex-1 min-w-0 flex flex-col gap-0.5" },
                h("span", { class: `font-semibold ${active ? "text-brand-600" : "text-concrete-900"}` }, p.label),
                h("span", { class: "text-sm text-concrete-500" }, p.desc)
              ),
              h("span", { class: "font-mono font-bold text-lg text-concrete-900" }, p.price)
            );
          }))
        ),
        h("span", { class: "text-sm text-concrete-500" }, "Cobran\xE7a \xFAnica no cart\xE3o cadastrado. Sem renova\xE7\xE3o autom\xE1tica. O trabalhador nunca paga nada.")
      ),
      h(
        "div",
        { class: "px-4 sm:px-0 py-3 flex flex-col gap-2" },
        Button({ label: `Impulsionar por ${chosen.price}`, size: "lg", fullWidth: true, onClick: () => {
          job.boosted = true;
          job.urgent = true;
          navigate2("/vaga-gerenciar/" + job.id);
        } }),
        Button({ label: "Agora n\xE3o", variant: "ghost", fullWidth: true, onClick: () => navigate2("/vaga-gerenciar/" + job.id) })
      )
    );
  }
  function fact(icon, text, color) {
    return h("div", { class: "flex gap-2.5 items-start" }, Icon(icon, { size: 20, color }), h("span", { class: "text-sm text-concrete-700" }, text));
  }

  // js/screens/recruiter/History.js
  var STATUS = {
    concluida: { label: "Avaliar o trabalhador", tone: "accent", icon: "star", hint: "Avaliar" },
    avaliada: { label: "Di\xE1ria conclu\xEDda", tone: "success", icon: "circle-check", hint: "Ver o bico" },
    contratado: { label: "Di\xE1ria conclu\xEDda", tone: "success", icon: "circle-check", hint: "Ver o bico" }
  };
  function renderHistory(navigate2) {
    const companyId = currentCompanyId();
    const items = allJobs().filter((j) => j.companyId === companyId && j.closed).flatMap((job) => applicationsForJob(job.id).filter((a) => STATUS[a.status]).map((a) => ({ job, app: a, worker: getWorker(a.workerId) }))).filter((x) => x.worker);
    return h(
      "div",
      { class: "flex flex-col" },
      BackBar({ title: "Bicos fechados", onBack: () => goBack("/empresa") }),
      h(
        "div",
        { class: "flex flex-col gap-3 px-4 sm:px-0 py-4" },
        items.length === 0 ? EmptyState({ icon: "file-check", title: "Nenhuma vaga encerrada", description: "Quando voc\xEA fechar ou encerrar um bico, ele fica guardado aqui.", actionLabel: "Ver vagas abertas", onAction: () => navigate2("/mural") }) : h("div", { class: "flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5" }, ...items.map(({ job, app, worker }) => {
          const s = STATUS[app.status];
          return Card(
            { padding: "sm", onClick: () => navigate2("/vaga-gerenciar/" + job.id) },
            h(
              "div",
              { class: "flex flex-col gap-3" },
              h(
                "div",
                { class: "flex items-center gap-3" },
                h("span", { class: "inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0" }, worker.initials),
                h("div", { class: "flex-1 min-w-0 flex flex-col" }, h("span", { class: "font-semibold text-concrete-900 truncate" }, worker.name), h("span", { class: "text-sm text-concrete-500 truncate" }, `${job.role} \xB7 ${dateText(job)}`)),
                h("span", { class: "font-mono font-bold text-lg text-concrete-900 shrink-0" }, job.pay == null ? "A combinar" : formatBRL(job.pay))
              ),
              h(
                "div",
                { class: "flex items-center justify-between gap-2 pt-3 border-t border-concrete-200" },
                Badge({ label: s.label, tone: s.tone, icon: s.icon }),
                h("span", { class: "inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600" }, s.hint, Icon("chevron-right", { size: 16, color: "var(--text-brand)" }))
              )
            )
          );
        }))
      )
    );
  }

  // js/main.js
  route("/splash", () => renderSplash(navigate));
  route("/escolha-perfil", () => renderChooseProfile(navigate));
  route("/cadastro/:role", (p) => renderSignup(navigate, p));
  route("/verificar-email", () => renderVerifyEmail(navigate));
  route("/completar-perfil/:role", (p) => renderCompleteProfile(navigate, p));
  route("/login", () => renderLogin(navigate));
  route("/esqueci-senha", () => renderForgotPassword(navigate));
  route("/redefinir-senha", () => renderResetPassword(navigate));
  route("/notificacoes", () => renderNotifications(navigate));
  route("/configuracoes", () => renderSettings(navigate));
  route("/configuracoes/privacidade", () => renderPrivacy(navigate));
  route("/mural", () => renderFeed(navigate));
  route("/vaga/:id", (p) => renderJobDetail(navigate, p));
  route("/confirmar/:id", (p) => renderConfirmApplication(navigate, p));
  route("/enviado/:id", (p) => renderApplicationSent(navigate, p));
  route("/minhas-candidaturas", () => renderMyApplications(navigate));
  route("/vagas-salvas", () => renderSavedJobs(navigate));
  route("/selecionado/:id", (p) => renderSelected(navigate, p));
  route("/avaliar/:id", (p) => renderRateJob(navigate, p));
  route("/perfil", () => renderWorkerProfile(navigate, {}));
  route("/perfil/editar", () => renderEditWorkerProfile(navigate));
  route("/trabalhador/:id", (p) => renderWorkerProfile(navigate, p));
  route("/trabalhador/:id/:jobId", (p) => renderWorkerProfile(navigate, p));
  route("/empresa", () => renderCompanyProfile(navigate, {}));
  route("/empresa/editar", () => renderEditCompanyProfile(navigate));
  route("/construtora/:id", (p) => renderCompanyProfile(navigate, p));
  route("/avaliacoes/:type/:id", (p) => renderReviews(navigate, p));
  route("/criar-vaga", () => renderCreateJob(navigate));
  route("/vaga-publicada/:id", (p) => renderJobPublished(navigate, p));
  route("/vaga-gerenciar/:id", (p) => renderJobManage(navigate, p));
  route("/fechado/:id", (p) => renderJobClosed(navigate, p));
  route("/impulsionar/:id", (p) => renderBoostJob(navigate, p));
  route("/historico", () => renderHistory(navigate));
  var AUTH_FLOW = /* @__PURE__ */ new Set(["/splash", "/escolha-perfil", "/verificar-email", "/login", "/esqueci-senha", "/redefinir-senha"]);
  var TAB_ROOTS = { trabalhador: /* @__PURE__ */ new Set(["/mural", "/minhas-candidaturas", "/perfil"]), recrutador: /* @__PURE__ */ new Set(["/mural", "/criar-vaga", "/empresa"]) };
  function isAuthFlow(path) {
    if (AUTH_FLOW.has(path)) return true;
    return path.startsWith("/cadastro/") || path.startsWith("/completar-perfil/");
  }
  var NARROW_SCREENS = /* @__PURE__ */ new Set([
    "/criar-vaga",
    "/perfil/editar",
    "/empresa/editar",
    "/configuracoes",
    "/configuracoes/privacidade",
    "/notificacoes",
    "/confirmar/:id",
    "/enviado/:id",
    "/avaliar/:id",
    "/selecionado/:id",
    "/vaga-publicada/:id",
    "/impulsionar/:id",
    "/fechado/:id",
    "/avaliacoes/:type/:id"
  ]);
  var appEl = document.getElementById("app");
  function build(m, path) {
    const content = m.handler(m.params);
    if (isAuthFlow(path)) {
      return content;
    }
    const role = getRole();
    const activeId = tabIdForPath(path, role);
    const isMural = path === "/mural";
    const showMobileNav = TAB_ROOTS[role] && TAB_ROOTS[role].has(path);
    const nav = AppNav({
      role,
      active: activeId,
      navigate,
      showMobilePill: showMobileNav,
      notifications: role === "recrutador" ? 3 : 2,
      account: accountSummary(role)
    });
    const shell2 = document.createElement("div");
    shell2.className = cx("lg:flex lg:flex-col lg:min-h-screen", isMural ? "bg-white" : "");
    shell2.appendChild(nav);
    const main = document.createElement("main");
    main.className = cx(
      "flex-1 min-w-0",
      showMobileNav ? "pb-28 lg:pb-0" : "",
      isMural ? "bg-white min-h-screen" : cx("lg:w-full lg:mx-auto lg:px-8 lg:pt-8 lg:pb-16", NARROW_SCREENS.has(m.pattern) ? "lg:max-w-[40rem]" : "lg:max-w-panel")
    );
    main.appendChild(content);
    shell2.appendChild(main);
    return shell2;
  }
  function accountSummary(role) {
    if (role === "recrutador") {
      const company = currentCompany();
      return { name: company.name, photo: getUI("company-profile", { capa: null, logo: null, deleteId: null }).logo };
    }
    const worker = currentWorker();
    return { name: worker.name, initials: worker.initials };
  }
  function tabIdForPath(path, role) {
    if (role === "trabalhador") {
      if (path === "/mural") return "mural";
      if (path === "/minhas-candidaturas") return "minhas-candidaturas";
      if (path === "/perfil") return "perfil";
    } else {
      if (path === "/mural") return "mural";
      if (path === "/criar-vaga") return "criar-vaga";
      if (path === "/empresa") return "empresa";
    }
    return null;
  }
  function notFoundScreen() {
    const div = document.createElement("div");
    div.className = "flex flex-col items-center justify-center min-h-screen gap-3 text-center px-6";
    div.innerHTML = '<h1 class="font-display font-bold text-2xl text-concrete-900">P\xE1gina n\xE3o encontrada</h1><p class="text-concrete-500">Volte para o in\xEDcio.</p>';
    return div;
  }
  var lastRender = null;
  function render(m, path) {
    if (path === void 0) {
      if (!lastRender) return;
      ({ m, path } = lastRender);
    } else {
      lastRender = { m, path };
    }
    if (path === "/") {
      navigate("/splash", { replace: true });
      return;
    }
    if (!m) {
      mount(appEl, notFoundScreen());
      return;
    }
    const captured = captureFocus();
    mount(appEl, build(m, path));
    applyFocus(captured);
  }
  onRouteChange((m, path) => {
    window.scrollTo(0, 0);
    getUI("app-nav", { menuOpen: false }).menuOpen = false;
    render(m, path);
  });
  function captureFocus() {
    const active = document.activeElement;
    if (!active || !appEl.contains(active)) return null;
    const id = active.getAttribute("data-focus-id");
    if (!id) return null;
    return { id, start: active.selectionStart, end: active.selectionEnd };
  }
  function applyFocus(captured) {
    if (!captured) return;
    const el = appEl.querySelector(`[data-focus-id="${cssEscape(captured.id)}"]`);
    if (!el) return;
    el.focus();
    if (typeof captured.start === "number" && el.setSelectionRange) {
      try {
        el.setSelectionRange(captured.start, captured.end);
      } catch (e) {
      }
    }
  }
  function cssEscape(s) {
    return String(s).replace(/["\\]/g, "\\$&");
  }
  subscribe(render);
  startRouter();
})();
