# Telas de cadastro: Trabalhador e Recrutador

_Started 2026-09-11 11:15 UTC_

---

## User

Criar as telas de cadastro — Trabalhador e Recrutador

Use o design system e os padrões visuais já validados nas telas do Candidato e do Recrutador como base absoluta e obrigatória — mesma paleta, tipografia, espaçamento, estilo de input, botão e card. Nenhum elemento novo de estilo deve ser inventado aqui.

Objetivo estético: sofisticado, minimalista e profissional — o oposto de formulário burocrático. Pense em cadastro de app bancário premium ou do Duolingo: poucos campos visíveis por vez, respiro generoso entre elementos, hierarquia tipográfica clara guiando o olho, zero ruído visual. Simples não é pobre — é um formulário que parece caro de ter sido feito.

Duas variações, mesma estrutura visual:

Cadastro do Trabalhador — campos: nome completo, CPF, e-mail, confirmação de e-mail, senha
Cadastro do Recrutador — campos: nome completo do responsável, CNPJ, e-mail, confirmação de e-mail, senha (se fizer sentido no seu domínio de negócio, considere também razão social/nome fantasia)

As duas telas devem ser visualmente idênticas em estrutura — só o rótulo do documento muda (CPF vs. CNPJ) e a máscara de formatação junto. A pessoa que vir as duas lado a lado deve reconhecer instantaneamente que é o mesmo formulário do mesmo app, adaptado.

Comportamentos que o design precisa contemplar (não são só decoração, são requisitos reais do produto):

Campo de documento (CPF/CNPJ) com máscara aplicada enquanto a pessoa digita (000.000.000-00 / 00.000.000/0000-00)
Campo de confirmação de e-mail — obrigatório, existe para reduzir erro de digitação que trava o cadastro depois
Mensagem de erro específica abaixo de cada campo individualmente (nome, documento, e-mail, confirmação, senha), nunca um erro genérico único no topo do formulário
Botão de mostrar/ocultar senha
Indicador de força da senha, discreto, sem parecer agressivo
Checkbox de aceite dos termos de uso e política de privacidade, com os links visíveis mas não competindo visualmente com o botão principal
Estado de carregamento no botão de enviar (spinner substituindo o texto, sem mover o layout)
Estado de erro geral do formulário (ex: documento já cadastrado) — mensagem clara e com próximo passo sugerido, nunca um erro técnico cru
Estado de sucesso, levando à tela de verificação de e-mail já existente no fluxo

Hierarquia visual: o botão de ação principal (Cadastrar) deve ser o elemento de maior peso visual da tela. Campos obrigatórios não precisam de asterisco poluindo — se todos são obrigatórios, isso pode ficar implícito ou numa única linha de instrução no topo do formulário.

Consistência de fluxo: a transição entre "Cadastro do Trabalhador" e "Cadastro do Recrutador" deve acontecer a partir da tela de "Escolha de perfil" já existente — mantenha essa ponte visual coerente com o que já foi aprovado.

Ao final, coloque as duas telas lado a lado numa seção de comparação para confirmar visualmente que parecem gêmeas, com apenas os dados do formulário mudando.

## Assistant



## Assistant

I'll start by reading the existing screens to match their patterns exactly.

_[tool: read_file]_

_[tool: list_files]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

Li as duas telas existentes e o design system. Antes de construir, cinco decisões que mudam a estrutura:

_[tool: ask_user]_

Aguardando suas respostas para começar.

## User

Answered — estrutura: Um campo por vez, estilo Duolingo, com barra de progresso; razao_social: Sim — razão social junto do CNPJ (6 campos); arquivo: Dentro dos fluxos existentes (Trabalhador e Recrutador), ligadas ao login; estados: Campos vazios (repouso), Erros por campo, Erro geral (documento já cadastrado), Botão carregando, Sucesso → verificação de e-mail, Senha visível + força; forca_senha: Barra fina de 3 níveis

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

Agora vou inserir o fluxo nos dois arquivos.

_[tool: run_script]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: ready_for_verification]_

Cadastro entregue nos dois fluxos, um campo por vez com barra de progresso.

**Ponte:** login → "Criar minha conta" → escolha de perfil (pedreiro / construtora) → cadastro. A escolha define os campos: 5 passos no trabalhador (nome, CPF, e-mail, confirmação, senha), 6 no recrutador (responsável, razão social, CNPJ, e-mail, confirmação, senha). O mesmo par de telas existe nos dois arquivos, então dá para atravessar de um lado ao outro pela tela de escolha.

**Comportamentos:** máscara de CPF/CNPJ em Space Mono enquanto digita, erro específico abaixo de cada campo, mostrar/ocultar senha, barra fina de 3 níveis, aceite com os dois links em 14px abaixo do checkbox, botão de 56px com spinner no lugar do texto, e sucesso levando à verificação de e-mail.

**Dois tweaks novos** (painel de Tweaks): `perfilCadastro` para pré-visualizar a variação gêmea dentro do mesmo arquivo, e `erroDocumentoJaCadastrado` para ver o erro geral — ele devolve a pessoa ao passo do documento com "Entrar na conta" e "Recuperar senha".

A seção de comparação lado a lado ficou no arquivo do Trabalhador, no fim do canvas, junto com os seis estados. Se quiser ela também no arquivo do Recrutador, eu duplico.

## User

faça o campo de senha com esse olho no canto direito do input de senha e quando clicar nele ele deve abrir e ficar como na imagem roxa faça isso da melhor e mais profissional forma possível

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

Agora vou trocar o botão "Mostrar/Ocultar senha" por um ícone de olho dentro do próprio input, à direita, nos dois arquivos.

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: multi_screenshot]_

O olho agora está dentro do campo de senha, à direita, alternando entre oculto e visível. Icon-slot placeholders aparecem cinza aqui na renderização (Lucide carrega via CDN no ambiente real).

_[tool: ready_for_verification]_

Ícone de olho movido para dentro do campo de senha, à direita, com toggle mostrar/ocultar — aplicado nos dois arquivos (Trabalhador e Recrutador).

## User

remova o icone de cadeado nos inputs de senha e deixe o olho levemente maior, e remova a tela de Digita o e-mail de novo.

## Assistant

_[tool: grep]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

Etapa "confirme o e-mail" removida (agora 4 passos), cadeado tirado do campo de senha, e o olho maior à direita.

_[tool: ready_for_verification]_

Feito nos dois arquivos (Trabalhador e Recrutador): cadeado removido, olho maior, e etapa de confirmação de e-mail eliminada.

## User

Ajuste os inputs da tela de login, o da senha faça exatamente igual os inputs do de cadastro, e o do email mostre para os usuários que não só aceita email, mas tambem cnpj e cpf

## Assistant

_[tool: grep]_

_[tool: grep]_

Só o arquivo do Trabalhador tem tela de login. Vou ajustar lá.

_[tool: read_file]_

_[tool: str_replace_edit]_

Agora adiciono o estado e os valores do logic class.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: screenshot]_

Login ajustado: campo de senha idêntico ao do cadastro (olho maior, sem cadeado), e o campo de e-mail agora indica que também aceita CPF/CNPJ, com uma dica abaixo.

_[tool: ready_for_verification]_

Feito.

## User

Criar etapa de "completar perfil" — Trabalhador e Recrutador

Use o design system já aprovado neste projeto (cores, tipografia, estilo de input, botão, card). Esta é uma nova etapa do fluxo de cadastro: acontece depois da verificação de e-mail e antes da pessoa entrar no app pela primeira vez. Objetivo: coletar os dados que já aparecem nas telas de perfil já criadas, mas que hoje não têm nenhum formulário coletando.

Trabalhador — campos a adicionar:

Foto de perfil (upload ou tirar foto na hora, com opção de pular por enquanto)
Cargo/especialidade principal — vira o subtítulo do perfil (ex: "Pedreiro de acabamento"); campo de seleção com opções pré-definidas do setor, não texto livre, para manter consistência entre todos os perfis
Região de atuação — bairro/zona + cidade/UF (ex: "Tatuapé, SP")
Especialidades — seleção múltipla por tags clicáveis (ex: Acabamento, Alvenaria, Reboco, Assentamento, Pintura, Elétrica, Hidráulica), permitindo adicionar mais de uma

Recrutador — campos a adicionar:

Foto de capa da construtora (upload, com opção de pular por enquanto)
Foto/logo de perfil
Nome fantasia — se for diferente da razão social já coletada no cadastro
Tipo de obra — campo de seleção com opções pré-definidas (ex: Residencial, Comercial, Reforma, Residencial e reforma, Industrial), pois isso já aparece como destaque visual no perfil (o "Tipo de obra: Residencial e reforma" que aparece com fundo destacado)
Região de atuação — zona + cidade/UF (ex: "Zona Leste, SP")

Requisitos de design:

Estrutura em etapas curtas (uma ou duas telas), com barra de progresso simples no topo — nunca um formulário único longo e intimidador
Campos de seleção (cargo, tipo de obra) devem ser dropdown ou chips clicáveis, nunca texto livre — isso mantém os dados padronizados para busca e filtro no mural depois
Tags de especialidade com estado selecionado/não selecionado visualmente óbvio, mesmo padrão de chip/badge já usado nas telas de perfil existentes
Botão de "pular por enquanto" para foto (mas não para os campos de texto/seleção, que são essenciais para o perfil funcionar no mural de busca)
Ao final, leva direto para a tela principal do app (mural para o trabalhador, painel para o recrutador)

Mantenha consistência total com as telas de perfil que já existem — os campos coletados aqui devem alimentar exatamente os espaços visuais já desenhados (subtítulo, badges de especialidade, tipo de obra em destaque).

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: grep]_

Confirmado, o replaceText não achou o texto (indentação diferente). Corrijo diretamente com str_replace_edit.

_[tool: str_replace_edit]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: screenshot]_

_[tool: show_html]_

_[tool: multi_screenshot]_

Funciona corretamente. Vou continuar o teste até o passo 2 e checar o Select de região.

_[tool: multi_screenshot]_

Fluxo do trabalhador validado ponta a ponta: seleção, erro, e chegada ao mural. Agora aplico o mesmo padrão no arquivo do Recrutador.

_[tool: run_script]_

_[tool: grep]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: screenshot]_

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: multi_screenshot]_

Etapa 1 renderiza corretamente. Vou continuar para checar etapa 2 e o botão final.

_[tool: multi_screenshot]_

Fluxo do Recrutador validado: erro por campo funcionando e conclusão leva ao painel. Removendo o botão de teste temporário.

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Etapa de "completar perfil" criada nos dois fluxos, entre a verificação de e-mail e a entrada no app.

**Trabalhador** (2 passos): foto de perfil (com "pular por enquanto") + cargo/especialidade principal (Select), depois região de atuação (Select) + especialidades (tags multi-seleção, mínimo 1).

**Recrutador** (2 passos): foto de capa + logo (ambas puláveis), depois nome fantasia (opcional, placeholder mostra a razão social já digitada no cadastro), tipo de obra (Select) e região de atuação (Select).

Barra de progresso fina no topo, mesmo padrão do cadastro. Campos de seleção usam o componente Select do design system (nunca texto livre) e erro específico por campo. Ao concluir, cai direto no mural (trabalhador) ou painel (recrutador).

Observação: os dados coletados aqui não estão amarrados às telas de perfil já existentes (que usam conteúdo fixo tipo "Jorge Mendes"/"Construtora Meridiano") — são visualmente consistentes (mesmos badges, chips e formato de região), mas cada tela roda seu próprio estado de protótipo. Se quiser que os valores digitados aqui reflitam nas telas de perfil, aviso para fazer esse encadeamento.

## User

nas telas de cadastro de criar senha adicione outro input de confirmação de senha da melhor forma possível.

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

Agora aplico a mesma edição nos dois arquivos (estrutura idêntica).

_[tool: run_script]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: multi_screenshot]_

Campo de confirmação de senha adicionado, mesmo estilo do campo de senha, com erro específico quando as senhas não coincidem. Aplicado nos dois arquivos (Trabalhador e Recrutador).

_[tool: ready_for_verification]_

Feito nos dois arquivos.

