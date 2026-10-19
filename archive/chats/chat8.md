# Chat

_Started 2026-09-14 19:00 UTC_

---

## User

Continuing from "Mural de vagas e feed".

## Assistant

Estamos desenvolvendo uma plataforma de vagas (Bicos) com dois fluxos — trabalhador e recrutador — compartilhando o mesmo feed de vagas. 

A estrutura atual:
- Feed geral unificado (Início): mostra vagas de todas as construtoras com busca agregada (vagas, construtoras, trabalhadores); cards seguem o padrão do site (foto, cargo, valor, data/local, status).
- Navegação: Trabalhador tem Início/Explorar/Perfil; Recrutador tem Início/Publicar/Perfil.
- Perfil da construtora: agora com banner + avatar sobreposto (estilo Facebook), 5 estrelas no topo, e seção "Seus posts" listando as próprias vagas publicadas com opções editar e deletar.
- Perfil do trabalhador: mantém avaliações.
- Busca: campo único no topo, resultados agrupados; agora rola junto com o conteúdo e some ao descer (não fica fixa).

Decisões principais:
- Posts = vagas publicadas; Instagram-like: cada construtora edita suas vagas no próprio perfil, mas o feed mostra todas.
- Delete ficou funcional.
- Removida a aba "Minhas vagas" separada — gestão ocorre via cards no perfil.

Próximos passos em aberto: nenhum indicado — o fluxo visual está fechado conforme solicitado.

Arquivos envolvidos:
- Bicos - Fluxo do Recrutador.dc.html
- Bicos - Fluxo do Trabalhador.dc.html
- Bicos Design System (design system)

