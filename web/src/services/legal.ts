// The terms of use, the privacy policy and the consent for the identity check: their text, version and date.
// This file is the source; /legal/*.md is generated from it (src/__tests__/legal.test.ts keeps them equal).
//
// L07 (lançamento): what is between {{…}} is filled in by the company (CHECKLIST-LANCAMENTO.md); the "draft
// for legal review" notice disappears only when LEGAL_REVIEWED becomes true, after the lawyer signs off.
// Changing TERMS.version makes every account accept again on its next visit (services/guards.ts).

export interface LegalSection {
  title: string;
  body: string[];
}

export interface LegalDocument {
  title: string;
  version: string;
  /** ISO date of this version. */
  updatedAt: string;
  sections: LegalSection[];
}

/** True only after the company's lawyer reviewed the texts below (turns off the "rascunho" notice). */
export const LEGAL_REVIEWED = false;

export const TERMS: LegalDocument = {
  title: 'Termos de uso',
  version: '2.0',
  updatedAt: '2026-10-15',
  sections: [
    {
      title: '1. Quem somos',
      body: [
        'A Bicos é um serviço da {{RAZAO_SOCIAL}} ("NivoTech"), CNPJ {{CNPJ}}, com sede em {{ENDERECO}}.',
        'Ao criar uma conta você aceita estes termos e a Política de privacidade. Se não concordar, não use a Bicos.'
      ]
    },
    {
      title: '2. O que a Bicos faz',
      body: [
        'A Bicos aproxima empresas e pessoas que precisam de alguém para um serviço ou uma diária e trabalhadores que procuram bico.',
        'A Bicos não contrata ninguém, não é empregadora e não entra na negociação. O combinado de horário, valor e pagamento é entre quem contrata e o trabalhador, que respondem por ele.'
      ]
    },
    {
      title: '3. Sua conta',
      body: [
        'Cada conta é de uma pessoa ou empresa e de um lado só: trabalhador ou quem contrata (conta de empresa).',
        'Você é responsável pelos dados que informa (CPF, CNPJ, WhatsApp, e-mail) e por manter sua senha em segredo.',
        'Para usar a Bicos você precisa ter 18 anos ou mais.'
      ]
    },
    {
      title: '4. Vagas e candidaturas',
      body: [
        'Quem contrata publica vagas reais, com valor, local e datas verdadeiros, e avisa os candidatos quando algo muda.',
        'O trabalhador se candidata só a vagas que pode cumprir e avisa pela Bicos se não puder ir.',
        'O contato por WhatsApp é liberado para os dois lados quando a empresa aprova o candidato. O endereço do serviço aparece na vaga para quem tem conta, com o mapa.'
      ]
    },
    {
      title: '5. Verificação',
      body: [
        'A empresa pode ser conferida pelo CNPJ na Receita Federal. O trabalhador pode pedir o selo "Verificado" enviando uma selfie e a foto do documento, com consentimento próprio (veja a Política de privacidade).',
        'O selo indica que conferimos os documentos, não garante o trabalho de ninguém.'
      ]
    },
    {
      title: '6. Pagamentos',
      body: [
        'Para o trabalhador, a Bicos é sempre grátis. Publicar vaga também é grátis.',
        'Quem contrata paga só se quiser impulsionar uma vaga, por PIX ou cartão (Mercado Pago), sem renovação automática.',
        'O pagamento da diária é feito direto por quem contrata ao trabalhador, como combinado entre eles.'
      ]
    },
    {
      title: '7. Avaliações, denúncias e conduta',
      body: [
        'Depois da diária, cada lado pode avaliar o outro uma vez. A avaliação deve ser verdadeira e respeitosa.',
        'Não é permitido publicar conteúdo falso, ofensivo ou discriminatório, pedir dinheiro adiantado, oferecer trabalho perigoso ou ilegal, nem usar a Bicos para outro fim.',
        'Qualquer pessoa pode denunciar uma vaga, um perfil, uma avaliação ou um post. A equipe analisa e pode ocultar conteúdo ou suspender a conta, registrando o motivo. Quem discordar pode falar com o suporte.'
      ]
    },
    {
      title: '8. Encerrar a conta',
      body: [
        'Você pode excluir sua conta a qualquer momento em Configurações › Privacidade e dados.',
        'Diárias já combinadas devem ser resolvidas antes (ou a desistência confirmada).'
      ]
    },
    {
      title: '9. Mudanças e foro',
      body: [
        'Quando estes termos mudarem, avisamos no app e pedimos um novo aceite antes de continuar.',
        'Fica eleito o foro de {{CIDADE_FORO}}, sem prejuízo do direito do consumidor de usar o foro do seu domicílio.'
      ]
    }
  ]
};

export const PRIVACY: LegalDocument = {
  title: 'Política de privacidade',
  version: '2.0',
  updatedAt: '2026-10-15',
  sections: [
    {
      title: '1. Quem cuida dos seus dados',
      body: [
        'O controlador dos dados é a {{RAZAO_SOCIAL}} ("NivoTech"), CNPJ {{CNPJ}}, {{ENDERECO}}.',
        'Encarregado pelo tratamento de dados (DPO): {{DPO_NOME}}. Canal só para assuntos de dados pessoais: {{DPO_EMAIL}}. Respondemos em até 15 dias.'
      ]
    },
    {
      title: '2. Dados que coletamos',
      body: [
        'Cadastro: nome ou razão social, CPF ou CNPJ (guardado cifrado), e-mail, WhatsApp, senha (guardada de forma irreversível), data e versão do aceite destes textos. Se entrar com o Google: nome, e-mail e foto da conta Google.',
        'Perfil: cidade, experiência, texto de apresentação, fotos de perfil e capa, portfólio. Empresa: nome, logo, cidade, CNPJ e o que a Receita Federal informa sobre ele.',
        'Vagas: endereço do serviço, datas, horário, valor, fotos e requisitos.',
        'Uso: candidaturas e o histórico de cada uma, presença confirmada, diárias concluídas, avaliações, vagas salvas, convites, alertas de vaga, notificações, denúncias e bloqueios.',
        'Pagamentos do impulso: valor, plano e situação do pagamento. Os dados do cartão vão direto para o Mercado Pago; não ficam com a gente.',
        'Endereço: CEP, rua, bairro e cidade (sem o número da casa), para mostrar a distância até cada bico e abrir o mural na sua cidade. Fica só com você: no perfil aparece só a cidade, e as empresas veem só um ponto aproximado (cerca de 1 km).',
        'Localização do aparelho: só se você tocar em "Usar minha localização" no mural, para mostrar os bicos perto de onde você está. Não guardamos o seu caminho.',
        'Dados técnicos: endereço IP nas tentativas de login (para barrar robôs), registro do aparelho para notificações (se você ligar) e relatórios de erro sem nome, e-mail, documento ou telefone.'
      ]
    },
    {
      title: '3. Selfie e foto do documento (dado sensível)',
      body: [
        'São pedidas só a quem quer o selo "Verificado", com consentimento próprio e destacado na tela de verificação (LGPD, art. 11, I). A foto do rosto é dado biométrico, um dado pessoal sensível.',
        'Finalidade: conferir que você é quem diz ser e evitar fraude. Não usamos para mais nada.',
        'Quem vê: só as pessoas da equipe de verificação da Bicos, e cada decisão fica registrada com quem decidiu e quando. As fotos ficam em área privada, sem endereço público.',
        'Prazo: apagadas 30 dias depois da decisão (aprovada ou recusada). Você pode retirar o consentimento a qualquer momento pelo {{DPO_EMAIL}}; o selo sai junto.'
      ]
    },
    {
      title: '4. Para que usamos e com qual base legal',
      body: [
        'Para prestar o serviço que você pediu (LGPD, art. 7º, V): criar e manter a conta, mostrar vagas, ligar empresas e trabalhadores, liberar o WhatsApp depois da aprovação, mostrar o endereço e o mapa do serviço na vaga, avaliações e avisos.',
        'Para a segurança de todos (legítimo interesse, art. 7º, IX): captcha, limite de tentativas, denúncias, bloqueios, moderação e verificação da empresa pelo CNPJ (dado público).',
        'Para cumprir a lei (art. 7º, II): registros de pagamento e de acesso pelo tempo que a lei exigir.',
        'Com o seu consentimento (art. 7º, I e art. 11, I): selfie e documento, notificações no celular e localização do aparelho.',
        'Para entender o uso sem identificar ninguém: contamos cadastros, vagas e contratações por dia, só em números totais. Não vendemos seus dados e não usamos para publicidade.'
      ]
    },
    {
      title: '5. Com quem compartilhamos',
      body: [
        'Com a outra parte da diária, só o necessário: o perfil e, depois da aprovação, o WhatsApp. O endereço do serviço que a empresa publica fica visível na vaga para quem tem conta.',
        'Com empresas que operam o serviço para nós (operadores), sob contrato e só para isso: Supabase (banco de dados, arquivos e login; servidores em São Paulo, empresa nos EUA), Cloudflare (hospedagem do site e captcha; rede mundial), Mercado Pago (pagamentos; Brasil), Twilio (código por WhatsApp ou SMS; EUA), Sentry (relatórios de erro sem dados pessoais; EUA), Brevo (envio de e-mails; França) e Google (login, se você escolher; EUA). A consulta do CNPJ usa a BrasilAPI (dados públicos da Receita). Para achar um endereço, o que você digita (CEP, rua, bairro, cidade) é consultado na BrasilAPI e no ViaCEP (Correios) e no OpenStreetMap (Nominatim e Photon), sem o seu nome nem a sua conta.',
        'Alguns desses operadores ficam fora do Brasil. A transferência segue o art. 33 da LGPD ({{BASE_TRANSFERENCIA_INTERNACIONAL}}).',
        'Com autoridades, quando a lei ou uma ordem judicial exigir.'
      ]
    },
    {
      title: '6. Por quanto tempo guardamos',
      body: [
        'Conta, perfil, vagas, candidaturas e avaliações: enquanto a conta existir. Ao excluir a conta, apagamos na hora seus dados, arquivos, vagas, candidaturas e as avaliações que você fez e recebeu.',
        'Cadastro que nunca confirmou o e-mail: 7 dias. Tentativas de login com IP e códigos do WhatsApp: 1 dia. Selfie e documento: 30 dias depois da decisão.',
        'Pagamentos: {{PRAZO_PAGAMENTOS}}, por obrigação fiscal. Registros de acesso: {{PRAZO_REGISTROS_ACESSO}} (Marco Civil da Internet, art. 15). Registro das decisões da equipe (moderação e verificação): {{PRAZO_AUDITORIA}}. Relatórios de erro: 30 dias.'
      ]
    },
    {
      title: '7. Seus direitos',
      body: [
        'Você pode, a qualquer momento: saber se tratamos seus dados, ver e baixar uma cópia (Configurações › Privacidade e dados › Exportar), corrigir, pedir anonimização ou eliminação, saber com quem compartilhamos, retirar consentimentos e excluir a conta.',
        'Pelo app ou pelo {{DPO_EMAIL}}. Se não ficar satisfeito, pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).'
      ]
    },
    {
      title: '8. Segurança',
      body: [
        'CPF e CNPJ ficam cifrados; ninguém vê o WhatsApp, o endereço ou o documento de outra pessoa sem a regra do serviço permitir; a equipe só acessa o necessário e cada decisão fica registrada.',
        'Se houver um incidente que possa causar risco a você, avisamos você e a ANPD.'
      ]
    },
    {
      title: '9. No seu aparelho',
      body: [
        'O app guarda no navegador a sua sessão e preferências (cidade, filtros) para abrir rápido e funcionar com internet ruim. Não usamos cookies de publicidade nem rastreadores de terceiros.'
      ]
    },
    {
      title: '10. Mudanças nesta política',
      body: [
        'Quando esta política mudar, avisamos no app e pedimos um novo aceite antes de continuar. A versão e a data ficam no topo.'
      ]
    }
  ]
};

/**
 * The consent shown — highlighted, apart from the terms — on the identity check screen (LGPD art. 11, I). Its
 * version is stored with each submission (identity_submissions.consent_version).
 */
export const IDENTITY_CONSENT = {
  version: '1.0',
  title: 'Uso da sua selfie e do documento',
  points: [
    'Para que serve: só para conferir que você é você e dar o selo "Verificado".',
    'Quem vê: só a equipe de verificação da Bicos. Ninguém mais, nem as empresas.',
    'Por quanto tempo: apagamos as fotos 30 dias depois da decisão.',
    'Você pode desistir quando quiser, pela Ajuda ou pelo e-mail de privacidade.'
  ],
  checkbox: 'Concordo que a Bicos use minha selfie e a foto do meu documento só para verificar minha identidade.'
};

/** The version the sign-up records as accepted (terms and policy are accepted together). */
export const TERMS_VERSION = TERMS.version;

/** The document as Markdown — the text of /legal/*.md (kept equal by src/__tests__/legal.test.ts). */
export function legalMarkdown(doc: LegalDocument): string {
  const [y, m, d] = doc.updatedAt.split('-');
  return [
    `# ${doc.title}`,
    '',
    `**Versão ${doc.version} · atualizada em ${d}/${m}/${y}**`,
    '',
    ...(LEGAL_REVIEWED
      ? []
      : [
          '> **Rascunho para revisão jurídica.** Gerado de `web/src/services/legal.ts` — edite lá, não aqui. Os',
          '> campos `{{...}}` são preenchidos pela empresa (ver `web/docs/CHECKLIST-LANCAMENTO.md`).',
          ''
        ]),
    ...doc.sections.flatMap((s) => [`## ${s.title}`, '', ...s.body.flatMap((p) => [p, ''])])
  ].join('\n');
}
