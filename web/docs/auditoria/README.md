# Anexos da auditoria AUD

Material de apoio de `web/docs/AUDITORIA-COMPLETA.md`. Tudo foi produzido na rodada AUD (somente leitura).

| Arquivo / pasta                                                         | O que é                                                                                                                           |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `por-agente/<ID>-achados-originais.md`                                  | achados exatamente como cada agente os registrou (IDs originais, ex.: `D5-003`); o campo `Origem` de cada AUD aponta para eles    |
| `por-agente/<ID>-comandos.md`                                           | comandos e consultas rodados por cada agente, com saída resumida                                                                  |
| `cobertura-por-agente/<ID>.tsv`                                         | arquivos/objetos cobertos por cada agente (como foram lidos, achados que os citam)                                                |
| `cobertura-arquivos.md`                                                 | todos os 586 arquivos versionados × quem leu × como × achados                                                                     |
| `cobertura-banco-funcoes.tsv`                                           | as 176 funções de `public` (ACL, `search_path`, resultado) — agente D2                                                            |
| `cobertura-rotas-b1.tsv`, `cobertura-rotas-b2.tsv`                      | rota × perfil × tamanho de tela, no navegador (demo)                                                                              |
| `interacoes-b1.md`, `interacoes-b2.md`                                  | inventário de interações (visitante/trabalhador; empresa)                                                                         |
| `rotas.md`                                                              | as 55 rotas, com guarda e moldura                                                                                                 |
| `lgpd-tabela.md`                                                        | dado coletado → finalidade → base legal → prazo → quem acessa → onde é apagado; o que sobra após excluir; o que a exportação traz |
| `maquina-de-status.md`, `paridade-demo-real.md`                         | transições do app × banco e demo × real, função a função                                                                          |
| `matriz-testes.md` (+ `teste-*.tsv`)                                    | cobertura de testes por área crítica; RPCs e tabelas sem teste                                                                    |
| `vocabulario.md`, `caminho-ate-o-valor.md`, `comparacao-referencias.md` | UX e produto (termos, toques, referências)                                                                                        |
| `medicoes.md`, `lighthouse-resumo.tsv`                                  | bundle, Lighthouse, orçamentos                                                                                                    |

Prints, vídeos e scripts de reprodução ficaram fora do Git (ambiente da auditoria). Os caminhos `out/<agente>/…` que aparecem nos achados são dessa pasta temporária; o passo a passo e o resultado de cada prova estão escritos no próprio achado.
