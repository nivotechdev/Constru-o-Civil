# Tela de detalhes da vaga

_Started 2026-09-10 22:52 UTC_

---

## User

Continuing from "Redesign de cards de emprego".

## Assistant

We were refining the Bicos worker-side job marketplace prototype — specifically redesigning job cards across all screens to be more unified, clean, and sophisticated. The goal was to standardize card sizing, spacing, and visual hierarchy while adding support for negotiable-value jobs ("A combinar").

Decisions made:

- Removed company logo circles from all cards (mural, candidacies, salvos list).
- Enlarged job image area slightly for more visual weight.
- Unified card height and internal spacing proportionally across mural (featured + list) and candidacy screens.
- Added negotiable-value variant: jobs without fixed pricing now show "A combinar" in a minimal single-line format, exactly matching the height/width of fixed-price cards.
- Redesigned value badges: fixed price in solid azure block (96×64px), negotiable in outlined box with handshake icon (same footprint), closed jobs in muted gray.
- Candidacy cards (emAndamento/encerradas) now match mural card proportions exactly — same photo height, padding, and badge system.

Current state: All job cards (mural featured, mural list, emAndamento, encerradas, salvos) are now identical in size and proportion. Value badges are visually distinct and attention-grabbing while maintaining consistency. Negotiable and fixed-price jobs sit side-by-side without visual hierarchy difference. Salvos screen shows saved jobs with availability status.

Open next steps: Recruiter-side flow, then common screens (signup, login, password reset, notifications, settings).

Project files: `Bicos - Fluxo do Trabalhador.dc.html`, `image-slot.js`, `support.js`.

## User

Melhore a tela de detalhes da vaga, Deixe ela mais completa e simples mais enfase na empresa que criou a vaga e coloque ela no topo da tela faça como se fosse o perfil onde tem o banner e a logo da marca e do lado do titulo "o nome da marca na direita exatamente como o perfil tem o botão de editar adicione um botão de ver o perfil que mostrara o perfil da marca com mais detalhes e ele deve ser exatamente igual a construção da tela do perfil do candidato só que para o recrutador". faça tudo isso da melhor forma possível de forma bonita, cleans sofisticada.

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

Read the full "vaga" screen section and header/AppBar setup to plan the redesign.

_[tool: read_file]_

_[tool: grep]_

Good, all needed helpers exist. Now applying the edits.

_[tool: str_replace_edit]_

Now rebuild the `isConstrutora` screen header to mirror `isPerfil`'s construction.

_[tool: str_replace_edit]_

Now close the added wrapper divs at the end of that section.

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Feito. Tela de detalhes da vaga agora abre com um cabeçalho de perfil da construtora (capa, logo, nome, avaliação e botão "Ver perfil"), removi a seção "Quem contrata" duplicada mais abaixo, e a tela de perfil da construtora foi reconstruída com a mesma estrutura da tela de perfil do pedreiro (capa 180px, avatar sobreposto, cabeçalho com selo "Verificada" no lugar do botão editar).

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

Corrigido — o botão "Ver perfil" agora não encolhe e fica em uma linha.

## User

no detalhe da vaga remova o codigo da vaga, e na mesma tela ajuste a logo para ela ficar entre a imagem no fundo e a parte branca exatamente como nos perfis

## Assistant

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Removi o código da vaga e ajustei a logo para sobrepor a linha entre a foto de fundo e a área branca, igual aos perfis.

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Corrigido: nome da empresa agora trunca com ellipsis e o botão fica em wrapper próprio com largura fixa, sem quebrar linha.

