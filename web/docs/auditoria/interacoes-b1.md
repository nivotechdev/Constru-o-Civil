# B1 — Inventário de interações (resumo; detalhe em `$SCRATCH/out/B1/*_run*.txt`, `coverage.tsv` e 339 prints)

Transcrito pelo consolidador a partir do relatório final do agente B1. Ambiente: build de demonstração, 360×800 e 1280×800, Chromium.

## Visitante (360 e 1280)

- splash, escolha de perfil, cadastro (6 passos), login, esqueci/redefinir senha, entrar-celular, termos, privacidade, ajuda, conta-excluída, `/v/…`, 404 e `/vaga/` sem id: todas ok (exceto B1-003 e B1-011). Rotas privadas vão ao `/login` e voltam ao link depois de entrar.
- Validações testadas e corretas: nome (vazio, 1 palavra), CPF (vazio, inválido, 111.111.111-11, já existente, colado com espaços, máscara), e-mail (vazio, inválido, já existe), WhatsApp (sem DDD, fixo, já usado), código (curto, 000000), senha (curta, só letras, só números), 18 anos e termos, e-mail com espaços e maiúsculas no login, CPF no login.

## Trabalhador novo

- e-mail por código → endereço (CEP) → fotos → mural vazio, candidaturas vazias, notificações vazias, perfil "Novo na plataforma", verificar identidade (envio ok no demo), configurações.

## Trabalhador completo (Jorge)

- mural (busca, 5 km/10 km/Hoje/R$ 300, combinação sem resultado, Limpar, alerta de bico, offline), detalhe (3 estados), candidatura (offline, duplo clique, duplicada, vaga encerrada), selecionado, minhas candidaturas, vagas salvas, perfil (editar com limite de 80, publicar e excluir post), avaliações, configurações (tema escuro; senha, e-mail, WhatsApp com validação; avisos; privacidade; ajuda), sair, excluir conta (checkbox + modal + senha errada + offline + duplo clique + voltar).

## Estados

- Erro (`?falhar=1`) em 21 telas: todas com "Não conseguimos carregar" e "Tentar de novo".
- PWA com service worker ativo: recarregar offline abre o app com "Sem internet" por tela e volta sozinho. Manifest: standalone, ícones 192/512 e maskable, sem `shortcuts`.
- Teclado simulado (viewport 360×330): nenhum campo coberto.

## Não verificável e por quê

- `/admin`, conta suspensa, sessão expirada: o demo não tem.
- E-mail e SMS reais, WhatsApp real, captcha, pagamento/PIX, Storage real, Firebase/Google: o demo simula.
- Mapa e rota da vaga: ficam em "Carregando o mapa…" (mosaicos externos não carregam no contêiner).
- Instalação PWA (`beforeinstallprompt`) em headless; exportar dados LGPD: no demo não há retorno visível.
- Armadilhas do demo (não são defeito): Vagas salvas (4) aparecem na conta nova; mural vazio para conta em Caxias (as vagas do demo estão em SP); recarregar zera os dados do demo.
