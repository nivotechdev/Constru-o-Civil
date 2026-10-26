// X31: confirmar o e-mail de um login que nunca foi confirmado, quando o Google acabou de provar que o e-mail é da
// pessoa (U64). Antes só o e-mail era confirmado e a senha que estava no login continuava valendo: quem começou um
// cadastro com o e-mail de outra pessoa (e nunca confirmou) passava a entrar na conta dela depois que ela entrasse
// pelo Google. Agora a senha antiga é trocada por uma aleatória que ninguém conhece; a pessoa entra pelo Google ou
// cria uma senha nova em "Esqueci a senha".
// Sem Deno aqui: os testes do app (Vitest) importam este arquivo.

/** Uma senha que ninguém conhece: 32 bytes aleatórios em hexadecimal (64 caracteres, abaixo do limite de 72). */
export function unknowablePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type UpdateUser = (id: string, attributes: { email_confirm: true; password: string }) => Promise<{ error: unknown }>;

/** Confirma o e-mail do login e tira dele a senha antiga. `false` quando o Auth recusa. */
export async function confirmProvenEmail(updateUser: UpdateUser, userId: string): Promise<boolean> {
  const { error } = await updateUser(userId, { email_confirm: true, password: unknowablePassword() });
  return !error;
}
