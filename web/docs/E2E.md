# E2E — os fluxos de ponta a ponta num backend de verdade (L03)

Gerado por `e2e/relatorio.ts` · execução `mvaytrcg` · 16/10/2026, 09:51:26

**Ambiente**: Supabase local completo (`supabase start`: Postgres 17, Auth/GoTrue, PostgREST, Storage, Kong) com todas as migrations do repositório e as Edge Functions rodando no Deno — o staging ainda não existe (L02 espera o "pode"). Sem Realtime (não sobe neste ambiente) e com Turnstile de teste.

**Resultado**: 13 testes passaram, 0 falharam.

Como rodar: `e2e/LEIA.md`. Cada fluxo cria as próprias contas (e-mail `+e2e-<execução>`) e todas são apagadas no fim
pelo mesmo caminho do app (`excluir-conta`).

## 1. Cadastro do trabalhador → confirmação de e-mail → completar perfil

- cadastro senha e aceites

  <img src="e2e-prints/01-f1-cadastro-senha-e-aceites.jpg" alt="cadastro senha e aceites" width="240">

- confirme seu e-mail

  <img src="e2e-prints/02-f1-confirme-seu-e-mail.jpg" alt="confirme seu e-mail" width="240">

- completar perfil oficio

  <img src="e2e-prints/03-f1-completar-perfil-oficio.jpg" alt="completar perfil oficio" width="240">

- completar perfil especialidade

  <img src="e2e-prints/04-f1-completar-perfil-especialidade.jpg" alt="completar perfil especialidade" width="240">

- mural do trabalhador

  <img src="e2e-prints/05-f1-mural-do-trabalhador.jpg" alt="mural do trabalhador" width="240">

## 2. Cadastro da construtora → vaga com foto → mural (cidade e raio)

- construtora completa o perfil

  <img src="e2e-prints/06-f2-construtora-completa-o-perfil.jpg" alt="construtora completa o perfil" width="240">

- publicar vaga passo 1

  <img src="e2e-prints/07-f2-publicar-vaga-passo-1.jpg" alt="publicar vaga passo 1" width="240">

- publicar vaga passo 2

  <img src="e2e-prints/08-f2-publicar-vaga-passo-2.jpg" alt="publicar vaga passo 2" width="240">

- vaga publicada

  <img src="e2e-prints/09-f2-vaga-publicada.jpg" alt="vaga publicada" width="240">

- mural por cidade mostra a vaga

  <img src="e2e-prints/10-f2-mural-por-cidade-mostra-a-vaga.jpg" alt="mural por cidade mostra a vaga" width="240">

## 3. Candidatura → aprovação → WhatsApp liberado para os dois → recusa e desfazer

- detalhe da vaga

  <img src="e2e-prints/11-f3-detalhe-da-vaga.jpg" alt="detalhe da vaga" width="240">

- candidatura enviada

  <img src="e2e-prints/12-f3-candidatura-enviada.jpg" alt="candidatura enviada" width="240">

- construtora ve os candidatos

  <img src="e2e-prints/13-f3-construtora-ve-os-candidatos.jpg" alt="construtora ve os candidatos" width="240">

- aprovado whatsapp liberado para a construtora

  <img src="e2e-prints/14-f3-aprovado-whatsapp-liberado-para-a-constr.jpg" alt="aprovado whatsapp liberado para a construtora" width="240">

- recusa desfeita

  <img src="e2e-prints/15-f3-recusa-desfeita.jpg" alt="recusa desfeita" width="240">

- whatsapp liberado para o trabalhador

  <img src="e2e-prints/16-f3-whatsapp-liberado-para-o-trabalhador.jpg" alt="whatsapp liberado para o trabalhador" width="240">

## 4. Presença → diária concluída → avaliação dos dois lados → notas nos perfis

- construtora confirma a contratacao

  <img src="e2e-prints/17-f4-construtora-confirma-a-contratacao.jpg" alt="construtora confirma a contratacao" width="240">

- trabalhador confirma presenca

  <img src="e2e-prints/18-f4-trabalhador-confirma-presenca.jpg" alt="trabalhador confirma presenca" width="240">

- trabalhador avaliou a construtora

  <img src="e2e-prints/19-f4-trabalhador-avaliou-a-construtora.jpg" alt="trabalhador avaliou a construtora" width="240">

- construtora avaliou o trabalhador

  <img src="e2e-prints/20-f4-construtora-avaliou-o-trabalhador.jpg" alt="construtora avaliou o trabalhador" width="240">

- nota no perfil do trabalhador

  <img src="e2e-prints/21-f4-nota-no-perfil-do-trabalhador.jpg" alt="nota no perfil do trabalhador" width="240">

- nota no perfil da construtora

  <img src="e2e-prints/22-f4-nota-no-perfil-da-construtora.jpg" alt="nota no perfil da construtora" width="240">

## 5. Denúncia e bloqueio → exportar dados → excluir conta (Auth e Storage)

- denuncia

  <img src="e2e-prints/23-f5-denuncia.jpg" alt="denuncia" width="240">

- bloqueio

  <img src="e2e-prints/24-f5-bloqueio.jpg" alt="bloqueio" width="240">

- exportar dados

  <img src="e2e-prints/25-f5-exportar-dados.jpg" alt="exportar dados" width="240">

- confirmar exclusao

  <img src="e2e-prints/26-f5-confirmar-exclusao.jpg" alt="confirmar exclusao" width="240">

- conta excluida

  <img src="e2e-prints/27-f5-conta-excluida.jpg" alt="conta excluida" width="240">

## 6. Login por CPF/CNPJ → limite de tentativas (429) → recuperação de senha

- entrou com cpf

  <img src="e2e-prints/28-f6-entrou-com-cpf.jpg" alt="entrou com cpf" width="240">

- entrou com cnpj

  <img src="e2e-prints/29-f6-entrou-com-cnpj.jpg" alt="entrou com cnpj" width="240">

- link de recuperacao enviado

  <img src="e2e-prints/30-f6-link-de-recuperacao-enviado.jpg" alt="link de recuperacao enviado" width="240">

- senha nova salva

  <img src="e2e-prints/31-f6-senha-nova-salva.jpg" alt="senha nova salva" width="240">

## 7. Área da equipe (L06): identidade, construtora, denúncia, suspensão e registro

- admin recusado para conta comum

  <img src="e2e-prints/32-f7-admin-recusado-para-conta-comum.jpg" alt="admin recusado para conta comum" width="240">

- consentimento da selfie

  <img src="e2e-prints/33-f7-consentimento-da-selfie.jpg" alt="consentimento da selfie" width="240">

- fila de identidades

  <img src="e2e-prints/34-f7-fila-de-identidades.jpg" alt="fila de identidades" width="240">

- fila de construtoras

  <img src="e2e-prints/35-f7-fila-de-construtoras.jpg" alt="fila de construtoras" width="240">

- fila de denuncias

  <img src="e2e-prints/36-f7-fila-de-denuncias.jpg" alt="fila de denuncias" width="240">

- conta suspensa nao entra

  <img src="e2e-prints/37-f7-conta-suspensa-nao-entra.jpg" alt="conta suspensa nao entra" width="240">

- registro de auditoria

  <img src="e2e-prints/38-f7-registro-de-auditoria.jpg" alt="registro de auditoria" width="240">
