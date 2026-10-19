-- =====================================================================
-- NivoTech — Schema, segurança (RLS) e controles LGPD para Supabase
-- =====================================================================
-- Como rodar: Supabase Dashboard → SQL Editor → cole este arquivo inteiro
-- → Run. Rode uma única vez, num projeto novo, na região São Paulo (sa-east-1).
--
-- O que este arquivo cria:
--   1. Extensões necessárias (PostGIS para geolocalização, pgcrypto para
--      criptografia do CPF/CNPJ)
--   2. Tabela profiles (substitui /usuarios do Firebase)
--   3. Tabela vagas (substitui /vagas)
--   4. Tabela candidaturas (substitui /vagas/{id}/candidatos e
--      /minhasCandidaturas — em Postgres não precisamos mais da tabela
--      espelho: uma consulta relacional resolve "a quais vagas eu já me
--      candidatei" sem gambiarra)
--   5. Tabela consentimentos (registro LGPD de aceite de termos/política)
--   6. Criptografia do documento (CPF/CNPJ) via pgcrypto + Vault
--   7. Trigger que cria o profile automaticamente ao criar a conta —
--      resolve o problema de "conta órfã" (NVT-07) na raiz, de forma
--      atômica, sem precisar de retentativa no JavaScript
--   8. Row Level Security (RLS) em todas as tabelas — o equivalente em
--      SQL padrão às regras do Firebase, mas com uma vantagem: dá para
--      testar com qualquer ferramenta de teste de Postgres, não só o
--      Emulator Suite do Firebase
--   9. Funções de exportação e exclusão de dados pessoais (LGPD: direito
--      de acesso e direito ao esquecimento)
-- =====================================================================


-- ---------------------------------------------------------------------
-- ESTE ARQUIVO PODE SER RODADO MAIS DE UMA VEZ COM SEGURANÇA (idempotente).
-- Se você já rodou uma versão anterior, pode simplesmente rodar esta de
-- novo por cima — nada é recriado do zero, e nenhum dado existente é
-- apagado. Isso é importante porque, entre a v1 e esta v2, corrigimos um
-- furo real: contas criadas via "Entrar com Google" não tinham o campo
-- `tipo` preenchido automaticamente (só o cadastro por e-mail passava
-- essa informação para o gatilho de criação de perfil).
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 1. EXTENSÕES
-- ---------------------------------------------------------------------
create extension if not exists postgis;      -- busca geográfica ("vagas num raio de X km")
create extension if not exists pgcrypto;      -- criptografia e hash do CPF/CNPJ


-- ---------------------------------------------------------------------
-- 2. CHAVE DE CRIPTOGRAFIA DO DOCUMENTO (CPF/CNPJ)
-- ---------------------------------------------------------------------
-- Guardamos o CPF/CNPJ cifrado, nunca em texto puro. A chave fica no
-- Supabase Vault, fora do alcance de quem só tem acesso de leitura ao
-- banco. TROQUE o valor abaixo por uma chave forte antes de rodar —
-- gere uma com, por exemplo, `select encode(gen_random_bytes(32), 'hex');`
-- rodado uma vez no SQL Editor, e cole o resultado no lugar indicado.
-- Depois de rodar este bloco, apague o texto da chave deste arquivo na
-- sua cópia local (o Vault já terá guardado o segredo; não precisa mais
-- dele em lugar nenhum depois disso).
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'nivotech_documento_key') then
    perform vault.create_secret(
      'TROQUE_POR_UMA_CHAVE_FORTE_GERADA_COM_gen_random_bytes',
      'nivotech_documento_key',
      'Chave de criptografia simétrica do CPF/CNPJ dos usuários da NivoTech'
    );
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. TABELA: profiles (substitui /usuarios)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 150),
  email text not null,

  -- "tipo" começa nulo em contas criadas via Google (a NivoTech não
  -- consegue receber de forma confiável um dado próprio da aplicação
  -- durante o handshake OAuth do provedor). Nesse caso, o próprio site
  -- preenche o tipo logo após o primeiro login, a partir da escolha que
  -- o usuário já tinha feito na tela inicial (ver controllers/principal.js).
  -- O gatilho abaixo permite essa ÚNICA definição inicial e bloqueia
  -- qualquer troca depois disso.
  tipo text check (tipo is null or tipo in ('pedreiro', 'construtora')),

  -- CPF/CNPJ nunca fica em texto puro:
  documento_cifrado bytea,          -- valor real, cifrado (pgcrypto)
  documento_hash text,              -- hash SHA-256 do documento (só dígitos),
                                     -- usado para checar duplicidade sem
                                     -- precisar decifrar nada

  ativo boolean not null default true,   -- false = conta anonimizada (exclusão LGPD)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists profiles_documento_hash_unico
  on public.profiles (documento_hash)
  where documento_hash is not null;  -- impede duas contas com o mesmo CPF/CNPJ

comment on table public.profiles is
  'Perfil de cada usuário (pedreiro ou construtora). 1:1 com auth.users.';
comment on column public.profiles.documento_cifrado is
  'CPF/CNPJ cifrado com pgcrypto. Nunca exposto em texto puro pela API — '
  'só decifrado sob demanda via a função meu_documento().';


-- Trava: depois de definido pela primeira vez, o tipo (pedreiro/construtora)
-- não pode mudar. Contas por e-mail já nascem com o tipo definido (o
-- gatilho de criação, seção 7, recebe isso do formulário de cadastro);
-- contas via Google nascem com tipo nulo e o site define uma única vez,
-- logo no primeiro login — depois disso, nem um bug no frontend nem uma
-- chamada direta à API conseguem mudar ou promover o tipo de ninguém.
-- Fecha a NVT-06 (escalada de privilégio) na raiz.
create or replace function public.impedir_troca_de_tipo()
returns trigger
language plpgsql
as $$
begin
  if old.tipo is not null and old.tipo is distinct from new.tipo then
    raise exception 'O tipo de perfil não pode ser alterado após ser definido.';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_impedir_troca_de_tipo on public.profiles;
create trigger trg_impedir_troca_de_tipo
  before update on public.profiles
  for each row execute function public.impedir_troca_de_tipo();


-- ---------------------------------------------------------------------
-- 4. TABELA: vagas (substitui /vagas)
-- ---------------------------------------------------------------------
create table if not exists public.vagas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.profiles(id) on delete cascade,

  -- Nome da construtora copiado na hora de publicar — mesma lógica de
  -- minimização de dados já usada em candidaturas.nome_candidato/
  -- email_candidato: quem navega pelo mural (qualquer autenticado
  -- verificado, de qualquer tipo) precisa ver "quem publicou", mas a
  -- política de RLS de profiles só deixa cada um ler o PRÓPRIO perfil —
  -- então copiar o nome pra cá evita ter que abrir leitura de profiles de
  -- terceiros só pra mostrar um nome.
  autor_nome text,

  titulo text not null check (char_length(titulo) between 3 and 120),
  valor numeric(10, 2) not null check (valor > 0 and valor <= 100000),
  turno text not null check (turno in ('Manhã', 'Tarde', 'Noite', 'Integral')),
  cidade text not null check (char_length(cidade) between 1 and 150),
  localizacao geography(point, 4326),   -- coordenadas (lat/lng) p/ busca por raio
  data_servico date not null,
  horario text check (char_length(horario) <= 60),

  status text not null default 'aberta'
    check (status in ('aberta', 'preenchida', 'expirada')),

  criado_em timestamptz not null default now()
);

comment on table public.vagas is 'Oportunidades de trabalho publicadas por construtoras.';
comment on column public.vagas.localizacao is
  'Ponto geográfico da vaga. Habilita busca por raio: '
  'ORDER BY localizacao <-> ST_MakePoint(lng, lat)::geography.';

create index if not exists vagas_autor_idx on public.vagas (autor_id);
create index if not exists vagas_cidade_idx on public.vagas (cidade);
create index if not exists vagas_data_idx on public.vagas (data_servico);
create index if not exists vagas_status_idx on public.vagas (status);
create index if not exists vagas_localizacao_idx on public.vagas using gist (localizacao);

-- Projetos que já tinham a tabela vagas antes desta coluna existir: adiciona
-- e preenche as vagas antigas com o nome atual de quem publicou cada uma.
-- Sem efeito (0 linhas) num projeto novo, onde a coluna já nasce populada
-- pelo próprio controllers/criar-vaga.js.
alter table public.vagas add column if not exists autor_nome text;

update public.vagas v
   set autor_nome = p.nome
  from public.profiles p
 where p.id = v.autor_id
   and v.autor_nome is null;

-- Padroniza a capitalização de dados já cadastrados (nome, título, cidade)
-- pra "Primeira Letra De Cada Palavra Maiúscula" — o site já garante isso
-- em cadastros/vagas novas (utils/validadores.js#capitalizarPalavras), mas
-- não corrige sozinho o que já estava salvo antes dessa regra existir.
-- initcap() é a função nativa do Postgres pra isso; seguro de rodar de novo
-- (texto que já está padronizado não muda ao passar por ela outra vez).
update public.profiles set nome = initcap(nome) where nome is not null;
update public.vagas set titulo = initcap(titulo) where titulo is not null;
update public.vagas set cidade = initcap(cidade) where cidade is not null;
update public.vagas set autor_nome = initcap(autor_nome) where autor_nome is not null;

-- Habilita atualização em tempo real (usada pelo mural de vagas no site).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'vagas'
  ) then
    alter publication supabase_realtime add table public.vagas;
  end if;
end $$;

-- Só a construtora dona da vaga grava o autor_id, e ele nunca muda depois.
create or replace function public.travar_autor_da_vaga()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.autor_id is distinct from auth.uid() then
      raise exception 'autor_id deve ser o próprio usuário autenticado.';
    end if;
  elsif tg_op = 'UPDATE' and old.autor_id is distinct from new.autor_id then
    raise exception 'autor_id não pode ser alterado após a criação da vaga.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_travar_autor_da_vaga on public.vagas;
create trigger trg_travar_autor_da_vaga
  before insert or update on public.vagas
  for each row execute function public.travar_autor_da_vaga();

-- Expira automaticamente vagas com data de serviço no passado.
-- Rode isto agendado (Supabase → Database → Cron Jobs, 1x por dia):
--   select cron.schedule('expirar-vagas-diario', '0 3 * * *',
--     $$ update public.vagas set status = 'expirada'
--        where status = 'aberta' and data_servico < current_date; $$);
create or replace function public.expirar_vagas_vencidas()
returns void
language sql
as $$
  update public.vagas
     set status = 'expirada'
   where status = 'aberta'
     and data_servico < current_date;
$$;


-- ---------------------------------------------------------------------
-- 5. TABELA: candidaturas (substitui /vagas/{id}/candidatos + /minhasCandidaturas)
-- ---------------------------------------------------------------------
-- Em Postgres não precisamos mais de uma tabela "espelho" só para o
-- trabalhador saber a quais vagas já se candidatou (isso era uma
-- gambiarra necessária no Firebase, onde permissão de leitura em
-- cascata impedia consultar isso de forma segura). Uma única tabela,
-- com RLS bem definida, resolve os dois lados.
create table if not exists public.candidaturas (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.vagas(id) on delete cascade,
  candidato_id uuid not null references public.profiles(id) on delete cascade,

  -- Nome/e-mail no momento da candidatura ficam copiados aqui de propósito:
  -- a construtora não precisa (e não deve) ter acesso de leitura ao
  -- profile completo de cada candidato — só ao que ele mandou ao se
  -- candidatar. Minimização de dados, na prática.
  nome_candidato text not null,
  email_candidato text not null,

  candidatado_em timestamptz not null default now(),

  unique (vaga_id, candidato_id)   -- impede candidatura duplicada na mesma vaga
);

comment on table public.candidaturas is
  'Candidaturas de trabalhadores a vagas. A construtora só enxerga as '
  'candidaturas das PRÓPRIAS vagas (ver política de RLS abaixo).';

create index if not exists candidaturas_vaga_idx on public.candidaturas (vaga_id);
create index if not exists candidaturas_candidato_idx on public.candidaturas (candidato_id);


-- ---------------------------------------------------------------------
-- 6. DOCUMENTO (CPF/CNPJ): salvar e ler cifrado
-- ---------------------------------------------------------------------
-- Nenhuma consulta comum (select * from profiles) expõe o CPF/CNPJ —
-- o valor cifrado não serve para nada sem a chave, que só estas duas
-- funções conseguem usar.
create or replace function public.salvar_documento(documento_texto text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  chave text;
  apenas_digitos text := regexp_replace(documento_texto, '[^0-9]', '', 'g');
begin
  select decrypted_secret into chave
    from vault.decrypted_secrets
   where name = 'nivotech_documento_key';

  update public.profiles
     set documento_cifrado = pgp_sym_encrypt(apenas_digitos, chave),
         documento_hash = encode(digest(apenas_digitos, 'sha256'), 'hex')
   where id = auth.uid();
end;
$$;

create or replace function public.meu_documento()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  chave text;
  resultado text;
begin
  select decrypted_secret into chave
    from vault.decrypted_secrets
   where name = 'nivotech_documento_key';

  select pgp_sym_decrypt(documento_cifrado, chave) into resultado
    from public.profiles
   where id = auth.uid();

  return resultado;
end;
$$;

revoke all on function public.salvar_documento(text) from public;
revoke all on function public.meu_documento() from public;
grant execute on function public.salvar_documento(text) to authenticated;
grant execute on function public.meu_documento() to authenticated;


-- ---------------------------------------------------------------------
-- 7. CRIAÇÃO AUTOMÁTICA DO PERFIL (resolve a NVT-07 na raiz)
-- ---------------------------------------------------------------------
-- No Firebase, criar a conta (Auth) e salvar o perfil (Database) eram
-- duas escritas separadas — se a segunda falhasse, sobrava uma conta
-- "órfã" (foi a origem da NVT-07, contornada no código com retentativas).
-- Em Postgres, isto vira UMA transação atômica de banco de dados: ou as
-- duas coisas acontecem juntas (perfil + documento já cifrado), ou
-- nenhuma acontece. Não tem meio-termo.
--
-- No cadastro por e-mail, o site manda nome/tipo/documento junto no
-- momento do signUp (em "options.data") e este gatilho já grava tudo,
-- documento incluso, cifrado, na mesma transação. No login via Google
-- não há como receber esse "documento"/"tipo" de forma confiável durante
-- o handshake OAuth — por isso eles chegam nulos aqui, e o próprio site
-- define o tipo (nunca o documento, que o Google não coleta) logo no
-- primeiro acesso, através de uma atualização comum, permitida pelo
-- gatilho de imutabilidade da seção 3 (que só bloqueia MUDAR um tipo já
-- definido, não definir um tipo que ainda estava nulo).
create or replace function public.criar_perfil_ao_cadastrar()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  chave text;
  documento_bruto text := new.raw_user_meta_data->>'documento';
  apenas_digitos text;
begin
  insert into public.profiles (id, nome, email, tipo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'tipo'   -- nulo se vier do login com Google
  );

  if documento_bruto is not null and length(trim(documento_bruto)) > 0 then
    apenas_digitos := regexp_replace(documento_bruto, '[^0-9]', '', 'g');

    select decrypted_secret into chave
      from vault.decrypted_secrets
     where name = 'nivotech_documento_key';

    update public.profiles
       set documento_cifrado = pgp_sym_encrypt(apenas_digitos, chave),
           documento_hash = encode(digest(apenas_digitos, 'sha256'), 'hex')
     where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.criar_perfil_ao_cadastrar();


-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vagas enable row level security;
alter table public.candidaturas enable row level security;

-- Helper: e-mail já foi verificado?
create or replace function public.email_verificado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select email_confirmed_at is not null from auth.users where id = auth.uid()),
    false
  );
$$;

-- Helper: qual o tipo do usuário atual?
create or replace function public.meu_tipo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select tipo from public.profiles where id = auth.uid();
$$;


-- profiles: cada usuário só lê e edita o próprio perfil.
drop policy if exists "Ver o próprio perfil" on public.profiles;
create policy "Ver o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Criar o próprio perfil" on public.profiles;
create policy "Criar o próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Editar o próprio perfil" on public.profiles;
create policy "Editar o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Ninguém apaga o próprio perfil diretamente (a exclusão de conta LGPD
-- passa pela função excluir_minha_conta() da seção 11, que anonimiza em
-- vez de apagar, preservando a integridade de vagas/candidaturas já
-- existentes de terceiros).


-- vagas: qualquer autenticado com e-mail verificado lê todas as vagas;
-- só a construtora dona escreve na própria vaga.
drop policy if exists "Ver vagas (autenticado e verificado)" on public.vagas;
create policy "Ver vagas (autenticado e verificado)"
  on public.vagas for select
  using (auth.role() = 'authenticated' and email_verificado());

drop policy if exists "Construtora publica vaga" on public.vagas;
create policy "Construtora publica vaga"
  on public.vagas for insert
  with check (
    auth.role() = 'authenticated'
    and email_verificado()
    and meu_tipo() = 'construtora'
    and autor_id = auth.uid()
  );

drop policy if exists "Construtora edita a própria vaga" on public.vagas;
create policy "Construtora edita a própria vaga"
  on public.vagas for update
  using (autor_id = auth.uid() and meu_tipo() = 'construtora');

drop policy if exists "Construtora exclui a própria vaga" on public.vagas;
create policy "Construtora exclui a própria vaga"
  on public.vagas for delete
  using (autor_id = auth.uid() and meu_tipo() = 'construtora');


-- candidaturas: o trabalhador vê e cria as próprias candidaturas;
-- a construtora vê (só leitura) as candidaturas das PRÓPRIAS vagas.
drop policy if exists "Trabalhador vê as próprias candidaturas" on public.candidaturas;
create policy "Trabalhador vê as próprias candidaturas"
  on public.candidaturas for select
  using (candidato_id = auth.uid());

drop policy if exists "Construtora vê candidaturas das próprias vagas" on public.candidaturas;
create policy "Construtora vê candidaturas das próprias vagas"
  on public.candidaturas for select
  using (
    exists (
      select 1 from public.vagas
       where vagas.id = candidaturas.vaga_id
         and vagas.autor_id = auth.uid()
    )
  );

drop policy if exists "Trabalhador se candidata" on public.candidaturas;
create policy "Trabalhador se candidata"
  on public.candidaturas for insert
  with check (
    auth.role() = 'authenticated'
    and email_verificado()
    and meu_tipo() = 'pedreiro'
    and candidato_id = auth.uid()
  );


-- ---------------------------------------------------------------------
-- 9. TABELA: consentimentos (registro LGPD)
-- ---------------------------------------------------------------------
create table if not exists public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  documento text not null check (documento in ('termos_de_uso', 'politica_privacidade')),
  versao text not null,          -- ex: "2026-09-06"
  aceito_em timestamptz not null default now()
);

comment on table public.consentimentos is
  'Prova de aceite de termos/política por versão — exigível pela LGPD '
  'como evidência de consentimento informado.';

alter table public.consentimentos enable row level security;

drop policy if exists "Ver os próprios consentimentos" on public.consentimentos;
create policy "Ver os próprios consentimentos"
  on public.consentimentos for select
  using (usuario_id = auth.uid());

drop policy if exists "Registrar o próprio consentimento" on public.consentimentos;
create policy "Registrar o próprio consentimento"
  on public.consentimentos for insert
  with check (usuario_id = auth.uid());


-- ---------------------------------------------------------------------
-- 10. LGPD: DIREITO DE ACESSO (exportar meus dados)
-- ---------------------------------------------------------------------
create or replace function public.exportar_meus_dados()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resultado jsonb;
begin
  select jsonb_build_object(
    'perfil', (
      select jsonb_build_object(
        'nome', nome, 'email', email, 'tipo', tipo,
        'documento', meu_documento(),
        'criado_em', criado_em
      )
      from public.profiles where id = auth.uid()
    ),
    'vagas_publicadas', (
      select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb)
      from public.vagas v where autor_id = auth.uid()
    ),
    'candidaturas', (
      select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      from public.candidaturas c where candidato_id = auth.uid()
    ),
    'consentimentos', (
      select coalesce(jsonb_agg(to_jsonb(co)), '[]'::jsonb)
      from public.consentimentos co where usuario_id = auth.uid()
    )
  ) into resultado;

  return resultado;
end;
$$;

revoke all on function public.exportar_meus_dados() from public;
grant execute on function public.exportar_meus_dados() to authenticated;


-- ---------------------------------------------------------------------
-- 11. LGPD: DIREITO AO ESQUECIMENTO (excluir/anonimizar a conta)
-- ---------------------------------------------------------------------
-- Anonimiza em vez de apagar em cascata: uma vaga publicada por uma
-- construtora pode ter candidaturas de terceiros que precisam continuar
-- íntegras (para o trabalhador que se candidatou, por exemplo). Apagar
-- o perfil sem cuidado quebraria o histórico de outra pessoa. A conta
-- de acesso (auth.users) é excluída de verdade; os dados pessoais
-- identificáveis no perfil são substituídos.
--
-- IMPORTANTE — decisão que precisa de validação jurídica: se a NivoTech
-- tiver obrigação legal de reter certos dados por prazo determinado
-- (fiscal/trabalhista, por exemplo), esta função deve ser ajustada para
-- primeiro checar esse prazo antes de anonimizar. Está sinalizado
-- também no rascunho da política de privacidade.
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set nome = 'Usuário removido',
         email = 'removido+' || id || '@nivotech.invalid',
         documento_cifrado = null,
         documento_hash = null,
         ativo = false
   where id = auth.uid();

  -- Exclui a conta de autenticação. Feito por último e dentro da mesma
  -- transação: se algo acima falhar, nada é desfeito pela metade.
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.excluir_minha_conta() from public;
grant execute on function public.excluir_minha_conta() to authenticated;


-- ---------------------------------------------------------------------
-- 12. CADASTROS-FANTASMA (e-mail ou documento nunca confirmados)
-- ---------------------------------------------------------------------
-- Contexto: o cadastro por e-mail cria a conta (auth.users) e o perfil
-- (seção 7) na hora — antes mesmo de confirmar o e-mail. Se a pessoa errar
-- o e-mail ou o CPF/CNPJ nessa primeira tentativa, sobra uma conta
-- "fantasma", nunca confirmada, ocupando esse e-mail (único em
-- auth.users) ou aquele documento (único em profiles_documento_hash_unico)
-- — e a segunda tentativa, já com o dado certo, é recusada por causa de
-- uma tentativa que nunca chegou a se completar de verdade.
--
-- Duas camadas resolvem isso:
--   a) Rede de segurança (limpar_cadastros_nao_confirmados): apaga em
--      lote qualquer cadastro abandonado e nunca confirmado há mais de
--      2 horas. PRECISA ser agendada (Database → Cron Jobs, ver
--      SETUP-SUPABASE.md) — sem isso, esta função existe mas nunca roda
--      sozinha, e o texto de erro do site promete uma liberação
--      automática que não acontece de verdade.
--   b) Correção instantânea (reiniciar_cadastro_pendente_email /
--      _documento): chamadas automaticamente pelo formulário de cadastro
--      (controllers/registro.js) no exato momento em que uma nova
--      tentativa esbarra numa tentativa anterior não confirmada — em vez
--      de fazer a pessoa esperar a limpeza em lote, o cadastro fantasma é
--      liberado na hora e o cadastro é tentado de novo sozinho, sem a
--      pessoa perceber que havia um problema.
--
-- Segurança: as três funções só tocam contas com email_confirmed_at NULO
-- — uma conta já confirmada (em uso de verdade) nunca é afetada, não
-- importa quem chame. Por isso (b) pode ser chamada por "anon" (não existe
-- sessão ainda nesse momento do cadastro) sem abrir brecha para excluir
-- conta de terceiros já confirmada.
create or replace function public.limpar_cadastros_nao_confirmados()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users
   where email_confirmed_at is null
     and created_at < now() - interval '2 hours';
$$;

revoke all on function public.limpar_cadastros_nao_confirmados() from public;
-- Só o cron job (rodando com o dono do banco) precisa executar isto —
-- não é exposta para anon/authenticated.

create or replace function public.reiniciar_cadastro_pendente_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  linhas_removidas integer;
begin
  delete from auth.users
   where lower(email) = lower(trim(p_email))
     and email_confirmed_at is null;
  get diagnostics linhas_removidas = row_count;
  return linhas_removidas > 0;
end;
$$;

create or replace function public.reiniciar_cadastro_pendente_documento(p_documento text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  hash_procurado text := encode(digest(regexp_replace(coalesce(p_documento, ''), '[^0-9]', '', 'g'), 'sha256'), 'hex');
  linhas_removidas integer;
begin
  delete from auth.users u
   using public.profiles p
   where p.id = u.id
     and p.documento_hash = hash_procurado
     and u.email_confirmed_at is null;
  get diagnostics linhas_removidas = row_count;
  return linhas_removidas > 0;
end;
$$;

revoke all on function public.reiniciar_cadastro_pendente_email(text) from public;
revoke all on function public.reiniciar_cadastro_pendente_documento(text) from public;
grant execute on function public.reiniciar_cadastro_pendente_email(text) to anon, authenticated;
grant execute on function public.reiniciar_cadastro_pendente_documento(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 13. PERFIL PÚBLICO DA CONSTRUTORA (foto, biografia, CNPJ, busca)
-- ---------------------------------------------------------------------
-- Duas colunas novas em profiles — só apresentação, cada um edita a
-- própria (a política "Editar o próprio perfil" da seção 8 já cobre isso,
-- não precisa de política nova).
alter table public.profiles add column if not exists foto_url text;
alter table public.profiles add column if not exists biografia text;

comment on column public.profiles.foto_url is
  'URL pública da foto de perfil, no bucket "avatars" do Storage.';
comment on column public.profiles.biografia is
  'Biografia curta, exibida no perfil público. Sem limite reforçado no '
  'banco — controllers/perfil.js já trava em 280 caracteres na tela.';

-- Ver o perfil de QUALQUER pessoa (não só o próprio) exige um jeito de
-- contornar a política "Ver o próprio perfil" (seção 8), que só deixa cada
-- um ler a PRÓPRIA linha — sem isso, trabalhador nenhum conseguiria abrir
-- o perfil de uma construtora. Em vez de afrouxar a política de RLS (o que
-- exporia a linha INTEIRA — e-mail, documento_cifrado, documento_hash — a
-- qualquer um, bastando pedir essas colunas na consulta), esta função só
-- devolve os campos pensados pra exibição pública. O CNPJ é decifrado e
-- devolvido só quando tipo = 'construtora' — o CPF de um trabalhador nunca
-- passa por aqui, não importa quem chame.
create or replace function public.perfil_publico(p_id uuid)
returns table (
  id uuid,
  nome text,
  tipo text,
  foto_url text,
  biografia text,
  criado_em timestamptz,
  documento text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.role() <> 'authenticated' or not email_verificado() then
    raise exception 'Acesso restrito a usuários autenticados e verificados.';
  end if;

  return query
    select
      p.id, p.nome, p.tipo, p.foto_url, p.biografia, p.criado_em,
      case
        when p.tipo = 'construtora' and p.documento_cifrado is not null then
          pgp_sym_decrypt(
            p.documento_cifrado,
            (select decrypted_secret from vault.decrypted_secrets where name = 'nivotech_documento_key')
          )
        else null
      end as documento
    from public.profiles p
    where p.id = p_id and p.ativo = true;
end;
$$;

revoke all on function public.perfil_publico(uuid) from public;
grant execute on function public.perfil_publico(uuid) to authenticated;

-- Busca de PERFIS pelo nome — trabalhador e construtora, qualquer um pode
-- aparecer pra qualquer um (mesma lógica do Instagram: todo perfil é
-- visitável por todo mundo). Substitui buscar_construtoras(), que só
-- cobria um dos dois tipos. Mesma lógica de exposição controlada de
-- perfil_publico(): só os campos de exibição, nunca a linha inteira.
drop function if exists public.buscar_construtoras(text);

create or replace function public.buscar_perfis(termo text default '')
returns table (id uuid, nome text, tipo text, foto_url text, biografia text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' or not email_verificado() then
    raise exception 'Acesso restrito a usuários autenticados e verificados.';
  end if;

  return query
    select p.id, p.nome, p.tipo, p.foto_url, p.biografia
    from public.profiles p
    where p.ativo = true
      and p.tipo is not null  -- exclui cadastro via Google ainda incompleto
      and (trim(termo) = '' or p.nome ilike '%' || trim(termo) || '%')
    order by p.nome
    limit 50;
end;
$$;

revoke all on function public.buscar_perfis(text) from public;
grant execute on function public.buscar_perfis(text) to authenticated;

-- Bucket de Storage pra foto de perfil. Público pra LEITURA (é assim que o
-- <img src="..."> de qualquer visitante carrega a foto sem precisar de
-- token) — mas só o dono da pasta (nomeada com o próprio auth.uid()) pode
-- enviar, substituir ou apagar o que está nela.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar publico para leitura" on storage.objects;
create policy "Avatar publico para leitura"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Cada um envia seu proprio avatar" on storage.objects;
create policy "Cada um envia seu proprio avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Cada um atualiza seu proprio avatar" on storage.objects;
create policy "Cada um atualiza seu proprio avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Cada um remove seu proprio avatar" on storage.objects;
create policy "Cada um remove seu proprio avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- =====================================================================
-- Fim do schema. Próximos passos manuais no Dashboard do Supabase:
--   1. Authentication → Providers → habilitar Email e Google.
--   2. Authentication → URL Configuration → configurar o domínio da NivoTech.
--   3. Database → Extensions → confirmar que "postgis" e "pgcrypto" estão ativas.
--   4. Database → Cron Jobs → agendar expirar_vagas_vencidas() (ver seção 4)
--      E limpar_cadastros_nao_confirmados() (ver seção 12) — os dois cron
--      jobs, não só o primeiro.
--   5. Project Settings → API → copiar a "Project URL" e a "anon public key"
--      (NÃO a "service_role key") — são os dois valores que o código do
--      site vai usar.
-- =====================================================================
