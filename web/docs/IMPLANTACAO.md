# Implantação na produção (R09)

Projeto **`ppnxdajiihsjaojxokzh`**. Cada passo que muda a produção só roda depois do **"pode"** do responsável para
**aquele** passo; a IA mostra o comando/SQL exato antes e cola a prova depois. Ordem obrigatória — não pular.
Horário: fora das 4h17–4h45 (limpezas) e das 21h (lembrete de presença); de preferência num dia útil de manhã.

Legenda: 🔁 tem volta · ⛔ **não tem volta** (só restaurando o backup do passo 1).

## 1. Pré-requisitos (responsável confirma) ⛔ sem eles, nada começa

- [ ] **Plano Pro** ativo na organização (backup diário + PITR opcional; leaked password protection).
- [ ] **Backup manual** feito agora e guardado **fora do repositório** (cofre/drive da empresa):
      Painel › Database › Backups › "Download" **ou**
      `pg_dump "postgresql://postgres.ppnxdajiihsjaojxokzh:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" -Fc -f bicos-AAAAMMDD.dump`
      (ou `scripts/exportar-app-antigo.sh` para as tabelas do app antigo).
- [ ] Segredos prontos (passo 3), dados da empresa nos textos legais (R01) e o staging verde (R08: E2E 13/13,
      advisors, volume, teste manual).

**Conferir**: o arquivo do backup existe, tem tamanho > 0, e `pg_restore -l bicos-AAAAMMDD.dump | head` lista as tabelas.

## 2. Histórico de migrations 🔁

`supabase/APLICAR.md` › "Histórico de migrations": `supabase link --project-ref ppnxdajiihsjaojxokzh`, os dois
`supabase migration repair` (reverted/applied) e `supabase migration list`. Mexe **só** na tabela
`supabase_migrations.schema_migrations`, nunca no esquema.

**Conferir**: `DB_URL=<conexão da produção> ./scripts/staging/conferir-migrations.sh` → falta exatamente o que vai
entrar no passo 4 (`lanc06` … `u06`) e não sobra nada.
**Desfazer**: `repair` ao contrário com as mesmas versões (ou restaurar só a tabela de histórico do backup).

## 3. Segredos das funções 🔁 (antes de republicar qualquer função)

Edge Functions › Secrets (ou `npx supabase secrets set --project-ref ppnxdajiihsjaojxokzh --env-file …`):

| Segredo                 | Valor                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `APP_ORIGIN`            | `https://bicos.nivotech.com.br` (R02: só as 5 funções do navegador exigem)            |
| `TURNSTILE_SECRET`      | a secret key do Turnstile de **produção**                                             |
| `SENTRY_DSN`, `RELEASE` | DSN do projeto Sentry; `RELEASE` = commit publicado (o deploy do front usa o mesmo)   |
| `CLEANUP_SECRET`        | o **mesmo** valor de `bicos_cleanup_secret` do Vault (Integrations › Vault › revelar) |

**Conferir**: `npx supabase secrets list --project-ref ppnxdajiihsjaojxokzh` mostra os nomes (sem valores).
**Desfazer**: `secrets unset <NOME>` ou voltar o valor anterior.

## 4. Migrations novas, uma por vez 🔁/⛔

Na ordem de `supabase/APLICAR.md`, **#39 a #48** (`lanc06`, `lanc07`, `habilitar_pg_net` (já está lá — só confere),
`lanc09`, `lanc10`, `lanc12`, `lanc13`, `r03`, `r04`, `u01`, `u06`), cada uma com a consulta de conferência dela logo depois.
**`lanc10_link_publico` só junto com o passo 7** (o front antigo chama a RPC com outro parâmetro).

| Migration | Desfazer                                                                                                                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lanc06`  | 🔁 `drop` das tabelas/funções novas listadas no topo do arquivo; as colunas novas podem ficar (nulas)                                                                                                                              |
| `lanc07`  | ⛔ parcial: `terms_acceptances` recebe as cópias de `consentimentos` (a origem fica intacta); `submit_identity` muda de assinatura → restaurar                                                                                     |
| `lanc09`  | 🔁 `drop extension pg_net; create extension pg_net;` (volta para o `public`)                                                                                                                                                       |
| `lanc10`  | 🔁 recriar `public_job_card(p_job_id)` da F09; a coluna `public_slug` pode ficar                                                                                                                                                   |
| `lanc12`  | 🔁 `select cron.unschedule('bicos-vigiar-cron');` e `drop` das funções/tabela novas                                                                                                                                                |
| `lanc13`  | 🔁 recriar `feed_jobs` da X01 (+ X13); `drop index jobs_feed_city_idx`; a coluna `last_day` pode ficar                                                                                                                             |
| `r03`     | ⛔ o valor de enum `cancelado_pela_equipe` não sai (inofensivo); funções: recriar as versões anteriores (L06/Z01/rules)                                                                                                            |
| `r04`     | 🔁 `drop trigger on_auth_user_deleted on auth.users;` e recriar `delete_my_account` da Z01                                                                                                                                         |
| `u01`     | 🔁 só com o front novo (passo 7); desfazer: recriar `job_from_draft` (W08), `job_extras_from_draft` (L18), `notify_job_alerts` (Y28), `report_target_info` (lanc06); `oficio_id` só volta a `not null` se nenhuma vaga estiver sem |
| `u06`     | 🔁 só com o front novo (passo 7); desfazer: recriar `close_job` (rules) e o `delete_job` da Z01                                                                                                                                    |

**Conferir no fim**: `conferir-migrations.sh` contra a produção = igual aos arquivos; `get_advisors` (security e
performance) igual ao "Esperado" de `docs/ADVISORS.md`; `select * from public.cron_health();` sem falha.

## 5. Republicar as 8 funções 🔁

`SUPABASE_ACCESS_TOKEN=… STAGING_REF=ppnxdajiihsjaojxokzh CONFIRMO_PRODUCAO=sim ./scripts/staging/publicar-funcoes.sh`
(as 3 servidor-a-servidor com `--no-verify-jwt`).

**Conferir** (uma chamada cada, resposta esperada):

| Função                                                                 | Chamada                                               | Esperado                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| `entrar-com-documento`                                                 | POST sem captcha                                      | 4xx "não conseguimos confirmar…" (Turnstile) |
| `excluir-conta`, `codigo-whatsapp`, `verificar-cnpj`, `criar-cobranca` | POST sem token                                        | 401                                          |
| `webhook-pagamento`                                                    | POST `{}`                                             | 503 `pagamento-desligado` (MP desligado)     |
| `enviar-push`                                                          | POST sem segredo                                      | 401 `segredo`                                |
| `limpar-arquivos`                                                      | `select public.call_storage_cleanup();` e ver os logs | 200 (com `CLEANUP_SECRET` certo)             |

Preflight (`OPTIONS`) de `https://bicos.nivotech.com.br` nas 5 do navegador devolve
`Access-Control-Allow-Origin: https://bicos.nivotech.com.br`.
**Desfazer**: Edge Functions › função › Deployments › voltar a versão anterior (ou publicar do commit anterior).

## 6. Auth 🔁

`SUPABASE_ACCESS_TOKEN=… PROJECT_REF=ppnxdajiihsjaojxokzh CONFIRMO_PRODUCAO=sim node scripts/configurar-auth.mjs`
(primeiro com `--mostrar`): SMTP da Brevo, os 4 templates, Site URL `https://bicos.nivotech.com.br`, Redirect URLs,
captcha (Turnstile). Depois, no painel: Rate Limits (e-mails por hora) e "Leaked password protection".

**Conferir**: cadastro de teste recebe o e-mail na **caixa de entrada** do Gmail e do Outlook, com o remetente
`nao-responda@nivotech.com.br`, e o link volta para o domínio.
**Desfazer**: `configurar-auth.mjs` com os valores anteriores (o `--mostrar` antes de aplicar imprime o estado atual).

## 7. Front no Cloudflare Pages (a partir do `master`, depois do R11) 🔁

Pages ligado ao repositório: diretório `web`, build `npm run build`, saída `dist`, Node 22, variáveis de produção
(`.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`, `VITE_TURNSTILE_SITE_KEY`,
`VITE_SENTRY_DSN`, `VITE_SUPORTE_WHATSAPP`; `SENTRY_*` para os source maps). Domínio `bicos.nivotech.com.br` em
Custom domains. (Alternativa sem Git: `CONFIRMO_PRODUCAO=sim npm run deploy:producao`.) Aplicar a `lanc10` logo antes
deste deploy.

**Conferir**: o site abre no domínio com HTTPS; o JS publicado contém `ppnxdajiihsjaojxokzh.supabase.co` (nunca a
demonstração — armadilha 1); `/v/<slug>` de uma vaga de teste abre sem login.
**Desfazer**: Pages › Deployments › "Rollback to this deployment" no anterior (instantâneo).

## 8. Equipe 🔁

SQL Editor: `select public.add_staff_member('<email>', 'admin');` para cada e-mail indicado pelo responsável.
**Conferir**: a pessoa entra e vê Configurações › "Área da equipe" › `/admin`.
**Desfazer**: `select public.remove_staff_member('<email>');`

## 9. Avisos do vigia (L12) 🔁

SQL Editor: `select vault.create_secret('<DSN do Sentry>', 'bicos_sentry_dsn');` e
`select vault.create_secret('<ping URL do healthchecks.io>', 'bicos_heartbeat_url');` (`docs/SUPABASE.md` › 5.1).
**Conferir**: uma hora depois, o check do healthchecks.io verde.
**Desfazer**: apagar os dois segredos em Integrations › Vault.

## 10. E2E uma vez na produção 🔁

Com contas de teste `+e2e` (apagadas no fim pela `excluir-conta`): `E2E_SUPABASE_URL=https://ppnxdajiihsjaojxokzh.supabase.co
… npm run e2e` contra o site publicado. Precisa, só durante o teste, de `http://localhost:4173` nas Redirect URLs e
no `APP_ORIGIN` — **tirar logo depois**.

**Conferir que nada sobrou**:
`select count(*) from auth.users where email like '%+e2e-%';` → 0;
`select count(*) from public.accounts a left join auth.users u on u.id = a.id where u.id is null;` → 0;
Storage: nenhuma pasta das contas de teste (`limpeza.ts` lista os ids).

## 11. Conferência final

- https://securityheaders.com/?q=bicos.nivotech.com.br → nota **A**.
- Lighthouse (celular) do endereço publicado sem regressão em relação ao CI.
- Erro forçado: no site publicado, logado com uma conta de teste, abrir o console do navegador e rodar
  `setTimeout(() => { throw new Error('teste Bicos') })` → o evento aparece no Sentry **sem dado pessoal** (sem
  e-mail, CPF, telefone; a rota sem ids).
- Uma pessoa da equipe abre o `/admin`.

## O que não tem volta

- Restaurar o backup (passo 1) desfaz **tudo** o que aconteceu depois dele, inclusive cadastros reais — por isso a
  janela entre o backup e o fim do passo 7 deve ser curta.
- O valor de enum `cancelado_pela_equipe` (r03) e as cópias em `terms_acceptances` (lanc07) não saem sem restaurar.
- E-mails mandados aos usuários durante os testes.
- A migration que apaga o app antigo (`supabase/pendentes/`) **não faz parte deste roteiro**: só se o responsável
  pedir, depois do export (`scripts/exportar-app-antigo.sh`).
