# Como criar o projeto Supabase da NivoTech

Passo a passo para sair do zero até ter o site funcionando de verdade com o
Supabase. É tudo feito pelo navegador, no painel do Supabase — nada de
linha de comando. Quando terminar, me manda de volta os dois valores
pedidos no passo 7 que eu termino a configuração do lado do código.

## 1. Criar a conta e o projeto

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (pode ser com
   o mesmo e-mail da empresa).
2. Clique em **New Project**.
3. Nome do projeto: `nivotech` (ou o que preferir).
4. **Região: escolha "South America (São Paulo)"** — mantém os dados dos
   usuários no Brasil, o que ajuda diretamente na conformidade com a LGPD.
5. Defina uma senha forte de banco de dados e guarde-a num gerenciador de
   senhas — você não vai precisar dela no dia a dia, mas é a chave mestra
   do banco.
6. Clique em **Create new project** e aguarde alguns minutos.

## 2. Gerar a chave de criptografia do CPF/CNPJ

1. No painel do projeto, vá em **SQL Editor**.
2. Rode este comando sozinho primeiro:
   ```sql
   select encode(gen_random_bytes(32), 'hex');
   ```
3. Copie o valor que aparecer (uma sequência longa de letras e números).
4. Abra o arquivo `supabase/001_schema_seguranca_lgpd.sql` (está aqui do lado
   deste guia, na pasta do projeto) e substitua o texto
   `TROQUE_POR_UMA_CHAVE_FORTE_GERADA_COM_gen_random_bytes` por esse valor
   copiado.
5. **Guarde esse valor também num gerenciador de senhas**, fora do
   Supabase. Se um dia precisar recriar o projeto, você vai precisar dele
   de novo para decifrar os CPFs/CNPJs já salvos.

## 3. Rodar o schema

1. Ainda no **SQL Editor**, clique em **New query**.
2. Cole o conteúdo inteiro do arquivo `supabase/001_schema_seguranca_lgpd.sql`
   (já com a chave trocada no passo anterior).
3. Clique em **Run**.
4. Deve aparecer "Success. No rows returned". Se aparecer algum erro, me
   manda a mensagem exata que eu ajusto o script.

   > Esse arquivo é seguro de rodar mais de uma vez (idempotente) — se você
   > já tinha rodado uma versão anterior dele, pode rodar este de novo sem
   > medo, ele só corrige o que precisa.

## 4. Ativar login por e-mail e por Google

1. Vá em **Authentication → Providers**.
2. **Email**: já vem ativado por padrão. Em **Authentication → Settings**,
   decida se quer manter "Confirm email" ligado (pede confirmação por
   e-mail, igual ao Firebase) ou desligado (a conta já nasce ativa) — o
   código do site já sabe lidar com os dois casos.
3. **Google**: clique em Google, ative, e siga o link da própria tela para
   criar as credenciais OAuth no Google Cloud Console (as credenciais do
   Firebase não são reaproveitáveis aqui — precisa gerar novas).
4. Em **Authentication → URL Configuration**, defina a **Site URL** como o
   endereço onde o site vai ficar publicado (por exemplo,
   `https://nivotech.com.br` ou, enquanto ainda está testando localmente,
   a pasta `views/` aberta no navegador). Isso afeta para onde os links de
   confirmação de e-mail e de redefinição de senha apontam.

## 5. Configurar o envio de e-mail de verdade (SMTP) — **faça isto se não estiver recebendo e-mail nenhum**

**Diagnóstico rápido antes de mexer em qualquer coisa:** vá em
**Authentication → Logs** (ou **Logs & Reports**) e procure pelas tentativas
de envio mais recentes. Se aparecer algo como `rate limit exceeded` ou
`email rate limit`, é exatamente isto:

Por padrão, o Supabase manda e-mail de confirmação/redefinição usando um
serviço de teste **compartilhado entre todos os projetos gratuitos do
mundo** — com um limite muito baixo (poucos e-mails por hora) e o próprio
Supabase avisa que ele **não é feito para produção**. Depois dos vários
cadastros de teste que fizemos hoje para validar as correções, essa cota
provavelmente já estourou — por isso nem confirmação, nem redefinição de
senha, chegam mais, para ninguém, até a cota resetar sozinha (por hora).

A solução definitiva — e obrigatória antes de ter usuários de verdade — é
configurar um provedor de e-mail próprio (SMTP). Passo a passo com o
**Resend** (grátis para começar, rápido de configurar):

1. Crie uma conta em [resend.com](https://resend.com), de preferência com o
   e-mail da empresa.
2. **Para testar HOJE, sem precisar de domínio nenhum:** o Resend deixa
   mandar e-mail de teste (usando o remetente `onboarding@resend.dev`) para
   o e-mail com que você se cadastrou no Resend. Ou seja: para validar o
   fluxo agora, cadastre-se na NivoTech usando esse MESMO e-mail.
   - Para os usuários **reais** da NivoTech receberem, vai ser preciso
     verificar um domínio de verdade (ex.: `nivotech.com.br`) — isso é
     exigido por qualquer provedor sério de e-mail transacional, é assim
     que eles evitam spam. Quando tiver esse domínio à mão (e acesso ao
     DNS dele), me avisa que eu te passo o passo de verificação (uns
     registros TXT/CNAME para adicionar).
3. No Resend: **API Keys → Create API Key** (nome sugerido:
   `nivotech-supabase`, permissão "Sending access" já basta).
4. No Supabase: **Authentication → Settings**, role até **SMTP Settings**
   (pode aparecer como "Custom SMTP"), ative, e preencha:
   - **Sender email:** `onboarding@resend.dev` (troque pelo seu, ex.
     `contato@nivotech.com.br`, assim que o domínio estiver verificado)
   - **Sender name:** `NivoTech`
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** a API Key copiada no passo 3
5. Salve e teste de novo o cadastro e o "Esqueci minha senha".

   > Se sua empresa já usa outro provedor de e-mail transacional
   > (SendGrid, Postmark, Brevo, Amazon SES), pode usar o SMTP dele em vez
   > do Resend — me diga qual e eu ajusto os campos.

## 6. Agendar as duas rotinas automáticas (cron)

1. Vá em **Database → Cron Jobs** (pode pedir para habilitar a extensão
   `pg_cron` na primeira vez — aceite).
2. Crie o primeiro job:
   - Nome: `expirar-vagas-diario`
   - Agendamento: `0 3 * * *` (todo dia às 3h da manhã, horário do servidor)
   - Comando SQL: `select public.expirar_vagas_vencidas();`
3. Crie o segundo job (importante — sem ele, cadastros abandonados com
   e-mail ou CPF/CNPJ errado ficam presos para sempre em vez de liberar
   sozinhos):
   - Nome: `limpar-cadastros-nao-confirmados`
   - Agendamento: `*/30 * * * *` (a cada 30 minutos)
   - Comando SQL: `select public.limpar_cadastros_nao_confirmados();`
   - Isso é só a rede de segurança para quem abandona o cadastro e nunca
     volta a tentar — na maioria dos casos (a própria pessoa tentando de
     novo com o dado certo) o site já libera o cadastro fantasma na hora,
     sem precisar esperar o cron.

## 7. Pegar as chaves que o site vai usar

1. Vá em **Project Settings → API**.
2. Copie dois valores:
   - **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
   - **anon public** key (uma chave longa — é pública por natureza, como a
     configuração que já ficava exposta no antigo `firebaseConfig.js`)
3. **Nunca me envie nem cole em lugar nenhum a `service_role` key** — essa
   sim é secreta, tem poder total sobre o banco, ignora toda regra de
   segurança, e não é usada pelo site.
4. Me mande de volta a **Project URL** e a **anon public key**. Com isso eu
   troco os dois placeholders (`COLE_AQUI_...`) em
   `config/supabaseConfig.js` e o site passa a funcionar de verdade.

## 8. Testar

Depois que eu atualizar o `config/supabaseConfig.js`:

1. Abra `index.html` no navegador (duplo clique já funciona).
2. Escolha "Sou Trabalhador" ou "Sou Construtora" e cadastre uma conta de
   teste — confira se o e-mail de confirmação chega (olhe a caixa de SPAM).
3. Faça login e veja se o mural de vagas abre normalmente.
4. Se algo der erro, me manda a mensagem exata que aparece (ou um print) que
   eu identifico e corrijo.
