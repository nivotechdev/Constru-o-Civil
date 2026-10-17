# Arquivo — o que veio antes do app atual

Nada aqui roda em produção nem é publicado. Fica para consulta e para os testes de paridade.

| Pasta / arquivo     | O que é                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `app/`              | O **app legado** (HTML + JavaScript, `bundle.js` de 487 KB), desligado no Z08. Referência da migração para React: `web/src/__tests__/utils.parity.test.ts` compara as funções de formatação com as dele e `web/scripts/parity/` (à mão: `npm run parity`) compara as telas pixel a pixel. |
| `chats/`            | Transcrições das conversas de design com o Claude Design (o "handoff bundle" que começou o projeto).  |
| `project/`          | Os protótipos HTML dessas conversas (fluxo do trabalhador e do recrutador) e o sistema de design.     |
| `SETUP-SUPABASE.md` | O guia de banco do app legado. **Desatualizado** — o atual é `web/docs/SUPABASE.md`.                  |

As migrations do app legado não estão aqui: continuam necessárias para montar um banco do zero e ficam em
`web/supabase/legado/`.
