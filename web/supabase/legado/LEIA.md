# Migrations do app antigo (000–012)

Esquema do app legado (HTML + JS, retirado do repositório na limpeza de 26/10/2026; está no histórico do Git), desligado no Z08: tabelas `profiles`, `vagas`,
`candidaturas`, `avaliacoes`, `vagas_salvas`, `publicacoes_trabalhador` e `consentimentos`, com RLS e sem política
(fechadas). **Não editar.** Continuam necessárias para montar um banco do zero na mesma ordem da produção: as
migrations do app (`../migrations/`) ainda dependem delas (`profiles`, a chave do Vault, o gatilho de cadastro).

Quem usa: `supabase/tests/local/setup.sh` (testes SQL e CI) e `scripts/staging/aplicar-banco.sh` (staging).
Elas saem de vez com `supabase/pendentes/…_lanc07_apagar_app_antigo.sql` — só com autorização, depois do export.
