// Traduz erros do Supabase Auth/Postgres para mensagens em PT-BR.
//
// Portado quase sem mudanças de utils/erros.js do front antigo (NivoTech):
// decide sempre pelo campo `code` (estável e documentado no Auth), nunca pelo
// texto da mensagem — comparar por texto já causou um bug real em produção
// (mensagem muda, comparação silenciosamente para de bater).
const MSG_DOCUMENTO_EM_USO =
  'Não foi possível concluir o cadastro: este CPF/CNPJ já está associado a uma conta ' +
  'confirmada em nossa plataforma. Se você já tem uma conta, tente fazer login ou usar ' +
  '"Esqueci minha senha". Se não foi você, confira o documento digitado.';

export function traduzirErroSupabase(error) {
  const codigo = error?.code || '';
  const mensagem = error?.message || '';

  switch (codigo) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos. Verifique os dados.';
    case 'user_already_exists':
      return 'Este e-mail já está cadastrado em nossa plataforma.';
    case 'weak_password':
      return 'Sua senha deve ter no mínimo 8 caracteres.';
    case 'email_address_invalid':
      return 'Formato de e-mail inválido. Verifique o que digitou.';
    case 'email_not_confirmed':
      return 'E-mail não verificado. Acesse sua caixa de entrada e clique no link de ativação enviado.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'user_banned':
      return 'Esta conta foi desativada pelo suporte da Bicos.';
    case 'session_not_found':
    case 'refresh_token_not_found':
      return 'Sua sessão expirou. Faça login novamente.';
    // Ver histórico no front antigo: "unexpected_failure"/"database_error_saving_new_user"
    // é o que o Auth devolve quando o gatilho que grava o profile falha DEPOIS do
    // e-mail já ter passado na checagem de duplicidade — na prática, quase sempre
    // o CPF/CNPJ informado já pertence a outra conta (documento é único na plataforma).
    case 'unexpected_failure':
    case 'database_error_saving_new_user':
      return MSG_DOCUMENTO_EM_USO;
    // Códigos abaixo são do Postgres/PostgREST (insert/update/delete em vagas,
    // candidaturas, profiles etc.), mesma lógica de comparar por código estável.
    case '42501':
      return 'Você não tem permissão para realizar esta ação com esta conta.';
    case '23505':
      return 'Este registro já existe — a ação não precisa ser repetida.';
    case '23503':
      return 'Não foi possível concluir: um dado relacionado não foi encontrado.';
    case 'PGRST301':
    case 'PGRST302':
      return 'Sua sessão expirou. Faça login novamente.';
    default:
      if (/failed to fetch|network/i.test(mensagem)) {
        return 'Falha na conexão de rede. Verifique sua internet.';
      }
      if (/database error saving new user/i.test(mensagem)) {
        return MSG_DOCUMENTO_EM_USO;
      }
      return 'Ocorreu um erro ao processar. Tente novamente em instantes.';
  }
}

export function emailNaoConfirmado(error) {
  return error?.code === 'email_not_confirmed';
}

export function emailDuplicado(error) {
  return error?.code === 'user_already_exists';
}

export function documentoDuplicado(error) {
  const codigo = error?.code || '';
  const mensagem = error?.message || '';
  return codigo === 'unexpected_failure'
    || codigo === 'database_error_saving_new_user'
    || /database error saving new user/i.test(mensagem);
}
