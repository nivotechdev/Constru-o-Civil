# B2 — comandos (resumo)

- `node $SCRATCH/serve.mjs $SCRATCH/dist-demo 4182` (servidor do demo; `out/B2/run.sh` sobe se estiver parado).
- `node out/B2/tour1.cjs m|d` — varredura de 87 rotas com a sessão da empresa (recarrega cada rota): saídas `tour1-m.json`, `tour1-d.json`, `tour1-m.txt`, `tour1-d.txt`; 0 erro de console, 0 exceção, 0 requisição falha em 174 visitas.
- `f1/f2/f3b.cjs` formulário de vaga (vazio, foco, matriz de campos); `f4.cjs` fotos + offline + publicar; `f5/f6.cjs` candidatos e contratação; `f7.cjs` avaliar + impulsionar PIX; `f8.cjs` editar/excluir/republicar/cartão; `f9/f10/f11.cjs` cadastro e onboarding de empresa nova; `f12/f13.cjs` visitante, offline, modo falha, configurações; `f14/f15.cjs` voltar do navegador, excluir conta, desktop; `f16-f18.cjs` vaga vista pela empresa, convidar, denunciar/bloquear.
- Medição: `lib.cjs` `measure()` (alvos < 48 px, overflow, texto cortado).
- Nenhum arquivo do repositório foi alterado; nada fora de `$SCRATCH`.
