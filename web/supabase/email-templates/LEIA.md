# E-mails do Authentication (L04)

Os 4 e-mails que o Supabase Auth manda, em português e com a cara da Bicos. Aplicados com
`node scripts/configurar-auth.mjs` (veja o cabeçalho do script) — ou colados à mão em Authentication › Emails.

| Arquivo                | Template no Supabase | Assunto                                      |
| ---------------------- | -------------------- | -------------------------------------------- |
| `confirmacao.html`     | Confirm signup       | Seu código de confirmação da Bicos           |
| `redefinir-senha.html` | Reset password       | Criar uma senha nova na Bicos                |
| `troca-de-email.html`  | Change email address | Confirme o novo e-mail da sua conta na Bicos |
| `link-de-acesso.html`  | Magic link           | Seu código de segurança da Bicos             |

O de cadastro (U11) traz o **código de 6 números** (`{{ .Token }}`, que o app pede em "Confirme seu e-mail"): grande,
selecionável com um toque, e também na prévia do e-mail (aparece na notificação do celular); o link de um toque fica
como alternativa. O de segurança (U16, template "Magic link") traz só o código, sem link: é o que confirma a
exclusão de uma conta sem senha (feita com o Google) ou de quem esqueceu a senha. Os outros dois continuam com link.

Regras para entregar na caixa de entrada: só HTML com estilos na linha, **sem imagens nem scripts de fora**,
o link do Auth (`{{ .ConfirmationURL }}`), remetente de domínio autenticado
(`nao-responda@nivotech.com.br`, SPF/DKIM/DMARC — `docs/CHECKLIST-LANCAMENTO.md` › L04). O teste
`src/__tests__/emailTemplates.test.ts` confere isso.
