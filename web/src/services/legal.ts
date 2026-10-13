// The terms of use and the privacy policy: their text, version and date. The text is a draft for legal
// review (shown as such). Backend: serve the current version from a table, so accepting it can be
// stored against the version that was shown.

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

export const TERMS: LegalDocument = {
  title: 'Termos de uso',
  version: '1.0',
  updatedAt: '2026-10-08',
  sections: [
    {
      title: '1. O que a Bicos faz',
      body: [
        'A Bicos aproxima construtoras e obras que precisam de gente para diárias e trabalhadores da construção civil que procuram bico.',
        'A Bicos não contrata ninguém, não é empregadora e não entra na negociação. O combinado de horário, valor e pagamento é entre a construtora e o trabalhador.'
      ]
    },
    {
      title: '2. Sua conta',
      body: [
        'Cada conta é de uma pessoa ou empresa e de um lado só: trabalhador ou construtora.',
        'Você é responsável pelos dados que informa (CPF, CNPJ, WhatsApp, e-mail) e por manter sua senha em segredo.',
        'Para usar a Bicos como trabalhador, você precisa ter 18 anos ou mais.'
      ]
    },
    {
      title: '3. Vagas e candidaturas',
      body: [
        'A construtora publica vagas reais, com valor, local e datas verdadeiros, e avisa os candidatos quando algo muda.',
        'O trabalhador se candidata só a vagas que pode cumprir e avisa pela Bicos se não puder ir.',
        'O contato por WhatsApp é liberado para os dois lados quando a construtora aprova o candidato.'
      ]
    },
    {
      title: '4. Pagamentos',
      body: [
        'Para o trabalhador, a Bicos é sempre grátis. Publicar vaga também é grátis.',
        'A construtora paga só se quiser impulsionar uma vaga, por PIX ou cartão, sem renovação automática.',
        'O pagamento da diária é feito direto pela construtora ao trabalhador, como combinado entre eles.'
      ]
    },
    {
      title: '5. Avaliações e conduta',
      body: [
        'Depois da diária, cada lado pode avaliar o outro uma vez. A avaliação deve ser verdadeira e respeitosa.',
        'Não é permitido publicar conteúdo falso, ofensivo ou discriminatório, nem usar a Bicos para outro fim.',
        'Contas que descumprirem estes termos podem ser suspensas.'
      ]
    },
    {
      title: '6. Encerrar a conta',
      body: [
        'Você pode excluir sua conta a qualquer momento em Configurações › Privacidade e dados.',
        'Diárias já combinadas devem ser resolvidas antes (ou a desistência confirmada).'
      ]
    }
  ]
};

export const PRIVACY: LegalDocument = {
  title: 'Política de privacidade',
  version: '1.0',
  updatedAt: '2026-10-08',
  sections: [
    {
      title: '1. Dados que coletamos',
      body: [
        'Cadastro: nome ou razão social, CPF ou CNPJ, e-mail, WhatsApp e senha (guardada de forma protegida).',
        'Perfil: ofício, cidade, especialidades, fotos e posts que você publica.',
        'Uso: vagas, candidaturas, avaliações e, se você permitir, sua localização para mostrar bicos perto.'
      ]
    },
    {
      title: '2. Para que usamos',
      body: [
        'Mostrar vagas perto de você, ligar construtoras e trabalhadores e manter a segurança da plataforma.',
        'Seu WhatsApp só aparece para o outro lado quando a construtora aprova a candidatura.',
        'Contar, sem identificar ninguém, quantos cadastros, vagas e contratações acontecem por dia, e registrar erros técnicos (sem nome, e-mail, documento ou telefone) para corrigir falhas.',
        'Não vendemos seus dados.'
      ]
    },
    {
      title: '3. Com quem compartilhamos',
      body: [
        'Com a outra parte da diária, só o necessário (perfil e, depois da aprovação, o WhatsApp).',
        'Com fornecedores que operam o serviço (hospedagem, envio de mensagens e pagamentos), sob contrato.'
      ]
    },
    {
      title: '4. Seus direitos (LGPD)',
      body: [
        'Você pode ver, corrigir, exportar e excluir seus dados em Configurações › Privacidade e dados.',
        'Pode também pedir informações sobre o uso dos seus dados falando com o suporte.'
      ]
    },
    {
      title: '5. Por quanto tempo guardamos',
      body: [
        'Enquanto sua conta existir. Ao excluir, apagamos seus dados, exceto o que a lei obriga a guardar por um tempo (por exemplo, registros de pagamento).'
      ]
    }
  ]
};

/** The version the sign-up records as accepted (terms and policy are accepted together). */
export const TERMS_VERSION = TERMS.version;
