# Teste de volume do mural (L13)

Meta: com **2.000 vagas e 20.000 candidaturas**, o mural (`feed_jobs`) responde com **p95 abaixo de 300 ms**.

## Como rodar

```bash
cd web
DB_URL='postgresql://postgres.<ref-do-staging>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' \
  ./scripts/volume/rodar.sh
```

`rodar.sh` recusa a produção, popula (`popular.sql`), mede (`medir.sql`) e **apaga tudo no fim**
(`apagar.sql`, que confere que não sobrou nada e desfaz se sobrar), mesmo se a medição falhar.

- **Dados** (todos sintéticos, marcados): 50 construtoras e 2.000 trabalhadores (`volume+<n>@bicos.invalid`, criados
  pelo mesmo gatilho do cadastro do app), 2.000 vagas (descrição começando com `[volume]`; 70% em São Paulo, 10%
  em Guarulhos, Osasco e Santo André; datas de 5 dias atrás a 30 dias à frente, 20% "a combinar", 10% urgentes,
  2% impulsionadas) e 20.000 candidaturas (10 por vaga; contratado em 1 de cada 3 vagas, pré-selecionado em 1 de
  cada 10). Passam pelos mesmos gatilhos do app (limite de candidaturas, avisos).
- **Medida**: 6 cenários × 50 chamadas, como um trabalhador logado, com o ponto de origem variando; tempo de
  execução no banco (sem a rede até o celular).

## Resultado

Postgres local igual ao do Supabase (`supabase/postgres:17.6.1.011`, Docker, 4 CPUs), 16/10/2026:

| Cenário                                 | p50 antes | p95 antes | p50 depois | **p95 depois** |
| --------------------------------------- | --------: | --------: | ---------: | -------------: |
| 1. cidade, mais perto (padrão)          |    142 ms |    183 ms |      34 ms |      **57 ms** |
| 2. raio de 30 km                        |    144 ms |    196 ms |      38 ms |      **67 ms** |
| 3. busca "pedreiro" em todas as cidades |    211 ms |    275 ms |      92 ms |     **133 ms** |
| 4. ofício + "Hoje"                      |     25 ms |     37 ms |       9 ms |      **14 ms** |
| 5. maior valor                          |    127 ms |    167 ms |      30 ms |      **49 ms** |
| 6. segunda página                       |    140 ms |    201 ms |      35 ms |      **62 ms** |

"Antes" já passava na meta, mas com pouca folga para a instância menor do staging/produção (plano Free: instância Nano, CPU
compartilhada). O gargalo (pelo `explain analyze`): `job_is_open(j)` chamada para cada vaga da cidade, ~50 µs por
linha — ela e as duas funções que chama têm `search_path` fixo, e o Postgres não "abre" função com `SET` dentro da
consulta. A migration `20261016000400_lanc13_mural_volume` guarda o último dia da vaga numa coluna calculada
(`jobs.last_day`, com índice parcial das vagas abertas por cidade), o mural compara com o "hoje" calculado uma vez
e normaliza o texto da busca uma vez só. O teste `supabase/tests/lanc13_mural_volume.sql` confere, vaga a vaga, que
o mural continua com a mesma regra de `job_is_open`.

## No staging — **ação do responsável**

O staging (`setyxomsbfrkneqqfoam`) ainda não tem o banco montado (precisa dos segredos do L02 — ver
`docs/CHECKLIST-LANCAMENTO.md`). Depois dele, rodar o comando acima com a conexão do staging e anexar a tabela aqui.
Se o p95 do staging passar de 300 ms, os próximos passos são: tirar a chamada de `job_holding` por linha (contagem
num `left join` agrupado) e guardar o texto da busca numa coluna atualizada por gatilho.

## Achado (resolvido no R04)

Apagar uma conta direto no Auth (painel › Authentication › Users › Delete) apagava a `accounts`, mas deixava o perfil
de trabalhador/construtora para trás (nome, foto e nota visíveis). Desde o R04, um gatilho em `auth.users` roda a
mesma limpeza da exclusão pelo app (`anonymize_account`). O `apagar.sql` continua apagando os perfis sintéticos à
parte, porque no teste de volume eles não precisam ficar nem anonimizados.
