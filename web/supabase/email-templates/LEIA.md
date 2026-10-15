# E-mails do Authentication (L04)

Os 4 e-mails que o Supabase Auth manda, em português e com a cara da Bicos. Aplicados com
`node scripts/configurar-auth.mjs` (veja o cabeçalho do script) — ou colados à mão em Authentication › Emails.

| Arquivo                | Template no Supabase | Assunto                                      |
| ---------------------- | -------------------- | -------------------------------------------- |
| `confirmacao.html`     | Confirm signup       | Confirme seu e-mail na Bicos                 |
| `redefinir-senha.html` | Reset password       | Criar uma senha nova na Bicos                |
| `troca-de-email.html`  | Change email address | Confirme o novo e-mail da sua conta na Bicos |
| `link-de-acesso.html`  | Magic link           | Seu link para entrar na Bicos                |

Regras para entregar na caixa de entrada: só HTML com estilos na linha, **sem imagens nem scripts de fora**,
um link (o `{{ .ConfirmationURL }}` do Auth) repetido em texto, remetente de domínio autenticado
(`nao-responda@nivotech.com.br`, SPF/DKIM/DMARC — `docs/CHECKLIST-LANCAMENTO.md` › L04). O teste
`src/__tests__/emailTemplates.test.ts` confere isso.
