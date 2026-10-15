# Migrations pendentes (só com o "pode" do responsável)

Arquivos aqui **não** são aplicados por nada (nem CI, nem `APLICAR-TUDO.sql`, nem staging). Cada um espera uma
decisão. Para aplicar: backup, mover para `../migrations/`, `node scripts/aplicar-tudo.mjs`, `npm run gen:types`,
staging, conferir, produção.

| Arquivo                                       | O que faz                                                                                                                                                                                                                                               | Antes de aplicar                                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20261015000900_lanc07_apagar_app_antigo.sql` | Apaga as 7 tabelas do app antigo, o gatilho que ainda copia cada cadastro para `profiles` e as funções antigas; tira o ramo "app antigo" das funções de documento. **Mantém** a chave `nivotech_documento_key` (cifra os documentos das contas atuais). | Backup; `./scripts/exportar-app-antigo.sh` e guardar o arquivo fora do repositório; ao mover, apagar `supabase/tests/z08_app_antigo.sql` (testa o app antigo, que deixa de existir). |

Conferido localmente: com este arquivo aplicado, os outros testes SQL passam (`node supabase/tests/run.mjs --with
supabase/pendentes/<arquivo> supabase/tests/[a-z]*.sql`, como `supabase_admin` — o `x13` acusa um falso alarme
nesse modo porque os privilégios padrão são do papel `postgres`).
