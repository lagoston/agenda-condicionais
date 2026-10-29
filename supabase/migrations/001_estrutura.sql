-- =====================================================================
-- Agenda de Condicionais — Brunsfeld Auto Peças e Serviços
-- Migração 001: estrutura, permissões, histórico e regras de negócio
--
-- Princípios:
--   * Ninguém escreve direto nas tabelas: toda alteração passa pelas
--     funções (RPC) abaixo, que aplicam as regras de cada papel.
--   * Todo INSERT/UPDATE gera uma linha em public.historico via gatilho.
--   * Nada é apagado: listas, condicionais e histórico não aceitam DELETE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.papel_usuario as enum ('expedicao', 'financeiro', 'admin');
create type public.status_lista as enum ('rascunho', 'enviada', 'conferida');
create type public.status_conferencia as enum ('pendente', 'conferida', 'nao_recebida');
create type public.situacao_condicional as enum ('em_aberto', 'paga', 'cancelada');

-- Funções internas ficam num schema que não é exposto pela API
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table public.perfis (
  id         uuid primary key references auth.users (id),
  usuario    text not null unique check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  nome       text not null check (length(btrim(nome)) between 2 and 80),
  papel      public.papel_usuario not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table public.listas (
  id                      uuid primary key default gen_random_uuid(),
  data                    date not null unique,
  status                  public.status_lista not null default 'rascunho',
  criada_por              uuid not null references public.perfis (id),
  criada_em               timestamptz not null default now(),
  enviada_por             uuid references public.perfis (id),
  enviada_em              timestamptz,
  conferida_por           uuid references public.perfis (id),
  conferida_em            timestamptz,
  observacao_conferencia  text
);

create table public.condicionais (
  id              uuid primary key default gen_random_uuid(),
  lista_id        uuid not null references public.listas (id),
  numero          text not null check (numero ~ '^[0-9]{6}$'),
  posicao         integer not null,
  conferencia     public.status_conferencia not null default 'pendente',
  conferida_por   uuid references public.perfis (id),
  conferida_em    timestamptz,
  situacao        public.situacao_condicional not null default 'em_aberto',
  situacao_por    uuid references public.perfis (id),
  situacao_em     timestamptz,
  removida        boolean not null default false,
  removida_por    uuid references public.perfis (id),
  removida_em     timestamptz,
  motivo_remocao  text,
  criada_por      uuid not null references public.perfis (id),
  criada_em       timestamptz not null default now()
);

-- Um número de condicional só pode estar ativo em uma lista
create unique index condicionais_numero_ativo_uk on public.condicionais (numero) where not removida;
create index condicionais_lista_idx on public.condicionais (lista_id, posicao);
create index condicionais_em_aberto_idx on public.condicionais (situacao) where not removida;

create table public.historico (
  id            bigint generated always as identity primary key,
  em            timestamptz not null default now(),
  usuario_id    uuid,
  usuario_nome  text not null,
  entidade      text not null,          -- 'lista' | 'condicional' | 'usuario'
  entidade_id   uuid not null,
  lista_id      uuid,
  numero        text,
  acao          text not null,
  alteracoes    jsonb,                  -- INSERT: linha completa | UPDATE: {campo: [antes, depois]}
  motivo        text
);
create index historico_entidade_idx on public.historico (entidade_id, em);
create index historico_lista_idx on public.historico (lista_id, em);
create index historico_numero_idx on public.historico (numero);

-- ---------------------------------------------------------------------
-- Funções internas (schema private)
-- ---------------------------------------------------------------------

-- Papel do usuário logado (null se não tiver perfil ou estiver inativo)
create function private.papel_atual()
returns public.papel_usuario
language sql stable security definer set search_path = ''
as $$
  select p.papel from public.perfis p where p.id = auth.uid() and p.ativo
$$;

-- Garante que o usuário logado tem um dos papéis informados
create function private.exigir_papel(variadic p_papeis public.papel_usuario[])
returns public.papel_usuario
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_papel public.papel_usuario := private.papel_atual();
begin
  if v_papel is null then
    raise exception 'Acesso negado: usuário inativo ou sem perfil.' using errcode = '42501';
  end if;
  if not (v_papel = any (p_papeis)) then
    raise exception 'Seu perfil não tem permissão para esta ação.' using errcode = '42501';
  end if;
  return v_papel;
end
$$;

-- Exige um motivo preenchido (mínimo 3 caracteres)
create function private.exigir_motivo(p_motivo text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_motivo is null or length(v_motivo) < 3 then
    raise exception 'Informe o motivo da alteração.';
  end if;
  return v_motivo;
end
$$;

-- Define a ação e o motivo que o gatilho de histórico vai registrar
create function private.definir_contexto(p_acao text, p_motivo text default null)
returns void
language plpgsql volatile set search_path = ''
as $$
begin
  perform set_config('app.acao', coalesce(p_acao, ''), true);
  perform set_config('app.motivo', coalesce(p_motivo, ''), true);
end
$$;

-- Bloqueia a lista para alteração (serializa edições concorrentes)
create function private.travar_lista(p_lista_id uuid)
returns public.listas
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_lista public.listas;
begin
  select * into v_lista from public.listas l where l.id = p_lista_id for update;
  if not found then
    raise exception 'Lista não encontrada.';
  end if;
  return v_lista;
end
$$;

-- Regras para lançar / corrigir / remover condicionais de uma lista.
-- Retorna o motivo normalizado (obrigatório depois que a lista foi enviada).
create function private.validar_edicao_itens(p_lista public.listas, p_motivo text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_papel public.papel_usuario := private.exigir_papel('expedicao', 'financeiro', 'admin');
begin
  if p_lista.status = 'rascunho' then
    if v_papel = 'financeiro' then
      raise exception 'Esta lista ainda está sendo preenchida pela expedição.';
    end if;
    return nullif(btrim(coalesce(p_motivo, '')), '');
  elsif p_lista.status = 'enviada' then
    if v_papel = 'expedicao' and exists (
      select 1 from public.condicionais c
       where c.lista_id = p_lista.id and not c.removida and c.conferencia <> 'pendente'
    ) then
      raise exception 'A conferência desta lista já começou. Peça ao financeiro para fazer a alteração.';
    end if;
    return private.exigir_motivo(p_motivo);
  else
    raise exception 'Lista já conferida e assinada. Reabra a conferência para alterar.';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Histórico automático
-- ---------------------------------------------------------------------
create function private.registrar_historico()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_antes       jsonb;
  v_depois      jsonb := to_jsonb(new);
  v_alteracoes  jsonb;
  v_acao        text := nullif(current_setting('app.acao', true), '');
  v_motivo      text := nullif(current_setting('app.motivo', true), '');
  v_usuario     uuid := coalesce(auth.uid(), nullif(current_setting('app.usuario_id', true), '')::uuid);
  v_nome        text;
  v_entidade    text;
  v_lista       uuid;
  v_numero      text;
begin
  if tg_op = 'UPDATE' then
    v_antes := to_jsonb(old);
    select jsonb_object_agg(d.key, jsonb_build_array(v_antes -> d.key, d.value))
      into v_alteracoes
      from jsonb_each(v_depois) d
     where d.value is distinct from (v_antes -> d.key);
    if v_alteracoes is null then
      return new;  -- nada mudou
    end if;
  else
    v_alteracoes := v_depois;
  end if;

  if tg_table_name = 'listas' then
    v_entidade := 'lista';
    v_lista := new.id;
  elsif tg_table_name = 'condicionais' then
    v_entidade := 'condicional';
    v_lista := new.lista_id;
    v_numero := new.numero;
  else
    v_entidade := 'usuario';
  end if;

  if v_usuario is not null then
    select p.nome into v_nome from public.perfis p where p.id = v_usuario;
  end if;

  insert into public.historico
    (usuario_id, usuario_nome, entidade, entidade_id, lista_id, numero, acao, alteracoes, motivo)
  values
    (v_usuario, coalesce(v_nome, 'Sistema'), v_entidade, new.id, v_lista, v_numero,
     coalesce(v_acao, case tg_op when 'INSERT' then 'criou' else 'alterou' end),
     v_alteracoes, v_motivo);

  return new;
end
$$;

create trigger listas_historico
  after insert or update on public.listas
  for each row execute function private.registrar_historico();

create trigger condicionais_historico
  after insert or update on public.condicionais
  for each row execute function private.registrar_historico();

create trigger perfis_historico
  after insert or update on public.perfis
  for each row execute function private.registrar_historico();

-- Nada pode ser apagado
create function private.impedir_exclusao()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'Exclusão não permitida (%): o histórico deve ser preservado.', tg_table_name;
end
$$;

create trigger listas_sem_exclusao
  before delete on public.listas
  for each row execute function private.impedir_exclusao();

create trigger condicionais_sem_exclusao
  before delete on public.condicionais
  for each row execute function private.impedir_exclusao();

create trigger historico_imutavel
  before update or delete on public.historico
  for each row execute function private.impedir_exclusao();

create trigger historico_sem_truncate
  before truncate on public.historico
  for each statement execute function private.impedir_exclusao();

-- ---------------------------------------------------------------------
-- Segurança: leitura para usuários ativos, escrita só via funções
-- ---------------------------------------------------------------------
alter table public.perfis       enable row level security;
alter table public.listas       enable row level security;
alter table public.condicionais enable row level security;
alter table public.historico    enable row level security;

create policy "leitura: usuarios ativos ou o proprio perfil" on public.perfis
  for select to authenticated
  using (id = (select auth.uid()) or (select private.papel_atual()) is not null);

create policy "leitura: usuarios ativos" on public.listas
  for select to authenticated
  using ((select private.papel_atual()) is not null);

create policy "leitura: usuarios ativos" on public.condicionais
  for select to authenticated
  using ((select private.papel_atual()) is not null);

create policy "leitura: usuarios ativos" on public.historico
  for select to authenticated
  using ((select private.papel_atual()) is not null);

revoke all on public.perfis, public.listas, public.condicionais, public.historico from anon, authenticated;
grant select on public.perfis, public.listas, public.condicionais, public.historico to authenticated;

-- ---------------------------------------------------------------------
-- Views de leitura (respeitam o RLS de quem consulta)
-- ---------------------------------------------------------------------
create view public.listas_resumo with (security_invoker = true) as
select
  l.id, l.data, l.status,
  l.criada_por, l.criada_em, l.enviada_por, l.enviada_em,
  l.conferida_por, l.conferida_em, l.observacao_conferencia,
  pc.nome as criada_por_nome,
  pe.nome as enviada_por_nome,
  pf.nome as conferida_por_nome,
  (count(c.id) filter (where not c.removida))::int                                     as total,
  (count(c.id) filter (where not c.removida and c.conferencia = 'conferida'))::int     as conferidas,
  (count(c.id) filter (where not c.removida and c.conferencia = 'nao_recebida'))::int  as nao_recebidas,
  (count(c.id) filter (where not c.removida and c.situacao = 'paga'))::int             as pagas,
  (count(c.id) filter (where not c.removida and c.situacao = 'cancelada'))::int        as canceladas,
  (count(c.id) filter (where not c.removida and c.situacao = 'em_aberto'))::int        as em_aberto
from public.listas l
left join public.perfis pc on pc.id = l.criada_por
left join public.perfis pe on pe.id = l.enviada_por
left join public.perfis pf on pf.id = l.conferida_por
left join public.condicionais c on c.lista_id = l.id
group by l.id, pc.nome, pe.nome, pf.nome;

create view public.condicionais_detalhe with (security_invoker = true) as
select
  c.id, c.lista_id, c.numero, c.posicao,
  c.conferencia, c.conferida_por, c.conferida_em,
  c.situacao, c.situacao_por, c.situacao_em,
  c.removida, c.removida_por, c.removida_em, c.motivo_remocao,
  c.criada_por, c.criada_em,
  l.data   as lista_data,
  l.status as lista_status,
  pcr.nome as criada_por_nome,
  pco.nome as conferida_por_nome,
  ps.nome  as situacao_por_nome,
  pr.nome  as removida_por_nome
from public.condicionais c
join public.listas l on l.id = c.lista_id
left join public.perfis pcr on pcr.id = c.criada_por
left join public.perfis pco on pco.id = c.conferida_por
left join public.perfis ps  on ps.id  = c.situacao_por
left join public.perfis pr  on pr.id  = c.removida_por;

revoke all on public.listas_resumo, public.condicionais_detalhe from anon, authenticated;
grant select on public.listas_resumo, public.condicionais_detalhe to authenticated;

-- ---------------------------------------------------------------------
-- Funções da aplicação (RPC)
-- ---------------------------------------------------------------------

-- Diz se já existe algum usuário (para a tela de primeiro acesso)
create function public.sistema_configurado()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfis)
$$;

-- Abre (ou retorna, se já existir) a lista de uma data
create function public.abrir_lista(p_data date)
returns public.listas
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista public.listas;
begin
  perform private.exigir_papel('expedicao', 'admin');
  if p_data is null then
    raise exception 'Informe a data da lista.';
  end if;
  if p_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Não é possível abrir lista para uma data futura.';
  end if;

  perform private.definir_contexto('abriu_lista');
  insert into public.listas (data, criada_por)
  values (p_data, auth.uid())
  on conflict (data) do nothing
  returning * into v_lista;

  if v_lista.id is null then
    select * into v_lista from public.listas l where l.data = p_data;
  end if;
  return v_lista;
end
$$;

-- Lança um ou mais números numa lista (aceita colagem de uma coluna do Excel).
-- Retorna o resultado de cada número; os inválidos são ignorados com o motivo.
create function public.adicionar_condicionais(p_lista_id uuid, p_numeros text[], p_motivo text default null)
returns table (numero text, adicionada boolean, erro text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_lista      public.listas;
  v_motivo     text;
  v_num        text;
  v_pos        integer;
  v_lista_dup  uuid;
  v_data_dup   date;
  v_vistos     text[] := '{}';
begin
  v_lista := private.travar_lista(p_lista_id);
  v_motivo := private.validar_edicao_itens(v_lista, p_motivo);

  if p_numeros is null or cardinality(p_numeros) = 0 then
    raise exception 'Nenhum número informado.';
  end if;
  if cardinality(p_numeros) > 300 then
    raise exception 'Envie no máximo 300 números por vez.';
  end if;

  select coalesce(max(c.posicao), 0) into v_pos
    from public.condicionais c where c.lista_id = p_lista_id;

  foreach v_num in array p_numeros loop
    v_num := btrim(coalesce(v_num, ''));
    numero := v_num;

    if v_num !~ '^[0-9]{6}$' then
      adicionada := false; erro := 'Número inválido: use 6 dígitos.';
      return next; continue;
    end if;

    if v_num = any (v_vistos) then
      adicionada := false; erro := 'Repetido na mesma colagem.';
      return next; continue;
    end if;

    v_lista_dup := null;
    select c.lista_id, l.data into v_lista_dup, v_data_dup
      from public.condicionais c
      join public.listas l on l.id = c.lista_id
     where c.numero = v_num and not c.removida;

    if v_lista_dup is not null then
      adicionada := false;
      erro := case when v_lista_dup = p_lista_id
                   then 'Já está nesta lista.'
                   else 'Já está na lista de ' || to_char(v_data_dup, 'DD/MM/YYYY') || '.'
              end;
      return next; continue;
    end if;

    v_pos := v_pos + 1;
    perform private.definir_contexto('lancou', v_motivo);
    insert into public.condicionais (lista_id, numero, posicao, criada_por)
    values (p_lista_id, v_num, v_pos, auth.uid());

    v_vistos := v_vistos || v_num;
    adicionada := true; erro := null;
    return next;
  end loop;
end
$$;

-- Corrige o número de uma condicional (zera a conferência dela)
create function public.editar_numero(p_condicional_id uuid, p_numero text, p_motivo text default null)
returns public.condicionais
language plpgsql security definer set search_path = ''
as $$
declare
  v_cond    public.condicionais;
  v_lista   public.listas;
  v_motivo  text;
  v_num     text := btrim(coalesce(p_numero, ''));
  v_data    date;
begin
  select * into v_cond from public.condicionais c where c.id = p_condicional_id;
  if not found then
    raise exception 'Condicional não encontrada.';
  end if;
  v_lista := private.travar_lista(v_cond.lista_id);
  select * into v_cond from public.condicionais c where c.id = p_condicional_id for update;

  if v_cond.removida then
    raise exception 'Esta condicional foi removida da lista.';
  end if;
  v_motivo := private.validar_edicao_itens(v_lista, p_motivo);

  if v_num !~ '^[0-9]{6}$' then
    raise exception 'Número inválido: use 6 dígitos.';
  end if;
  if v_num = v_cond.numero then
    return v_cond;
  end if;

  select l.data into v_data
    from public.condicionais c
    join public.listas l on l.id = c.lista_id
   where c.numero = v_num and not c.removida and c.id <> p_condicional_id;
  if found then
    raise exception 'O número % já está na lista de %.', v_num, to_char(v_data, 'DD/MM/YYYY');
  end if;

  perform private.definir_contexto('editou_numero', v_motivo);
  update public.condicionais c
     set numero = v_num, conferencia = 'pendente', conferida_por = null, conferida_em = null
   where c.id = p_condicional_id
  returning * into v_cond;
  return v_cond;
end
$$;

-- Remove uma condicional da lista (não apaga: marca como removida)
create function public.remover_condicional(p_condicional_id uuid, p_motivo text default null)
returns public.condicionais
language plpgsql security definer set search_path = ''
as $$
declare
  v_cond    public.condicionais;
  v_lista   public.listas;
  v_motivo  text;
begin
  select * into v_cond from public.condicionais c where c.id = p_condicional_id;
  if not found then
    raise exception 'Condicional não encontrada.';
  end if;
  v_lista := private.travar_lista(v_cond.lista_id);
  select * into v_cond from public.condicionais c where c.id = p_condicional_id for update;

  if v_cond.removida then
    return v_cond;
  end if;
  v_motivo := private.validar_edicao_itens(v_lista, p_motivo);

  perform private.definir_contexto('removeu', v_motivo);
  update public.condicionais c
     set removida = true, removida_por = auth.uid(), removida_em = now(), motivo_remocao = v_motivo
   where c.id = p_condicional_id
  returning * into v_cond;
  return v_cond;
end
$$;

-- Expedição envia a lista para conferência
create function public.enviar_lista(p_lista_id uuid)
returns public.listas
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista public.listas;
begin
  perform private.exigir_papel('expedicao', 'admin');
  v_lista := private.travar_lista(p_lista_id);

  if v_lista.status <> 'rascunho' then
    raise exception 'Esta lista já foi enviada para conferência.';
  end if;
  if not exists (select 1 from public.condicionais c where c.lista_id = p_lista_id and not c.removida) then
    raise exception 'A lista está vazia.';
  end if;

  perform private.definir_contexto('enviou_lista');
  update public.listas l
     set status = 'enviada', enviada_por = auth.uid(), enviada_em = now()
   where l.id = p_lista_id
  returning * into v_lista;
  return v_lista;
end
$$;

-- Conferente marca (grifa) ou desmarca uma condicional
create function public.marcar_conferencia(p_condicional_id uuid, p_conferida boolean)
returns public.condicionais
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista_id  uuid;
  v_status    public.status_lista;
  v_cond      public.condicionais;
begin
  perform private.exigir_papel('financeiro', 'admin');

  select c.lista_id into v_lista_id from public.condicionais c where c.id = p_condicional_id;
  if v_lista_id is null then
    raise exception 'Condicional não encontrada.';
  end if;

  select l.status into v_status from public.listas l where l.id = v_lista_id for share;
  if v_status <> 'enviada' then
    raise exception 'A conferência só pode ser feita em listas enviadas e ainda não assinadas.';
  end if;

  select * into v_cond from public.condicionais c where c.id = p_condicional_id for update;
  if v_cond.removida then
    raise exception 'Esta condicional foi removida da lista.';
  end if;

  if coalesce(p_conferida, false) then
    if v_cond.conferencia = 'conferida' then
      return v_cond;
    end if;
    perform private.definir_contexto('conferiu');
    update public.condicionais c
       set conferencia = 'conferida', conferida_por = auth.uid(), conferida_em = now()
     where c.id = p_condicional_id
    returning * into v_cond;
  else
    if v_cond.conferencia = 'pendente' then
      return v_cond;
    end if;
    perform private.definir_contexto('desmarcou');
    update public.condicionais c
       set conferencia = 'pendente', conferida_por = null, conferida_em = null
     where c.id = p_condicional_id
    returning * into v_cond;
  end if;
  return v_cond;
end
$$;

-- Conferente assina a lista. Pendentes viram "não recebidas" (observação obrigatória).
create function public.assinar_conferencia(p_lista_id uuid, p_observacao text default null)
returns public.listas
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista      public.listas;
  v_obs        text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_total      integer;
  v_pendentes  integer;
begin
  perform private.exigir_papel('financeiro', 'admin');
  v_lista := private.travar_lista(p_lista_id);

  if v_lista.status <> 'enviada' then
    raise exception 'Só é possível assinar uma lista enviada e ainda não assinada.';
  end if;

  select count(*), count(*) filter (where c.conferencia = 'pendente')
    into v_total, v_pendentes
    from public.condicionais c
   where c.lista_id = p_lista_id and not c.removida;

  if v_total = 0 then
    raise exception 'A lista está vazia.';
  end if;
  if v_pendentes > 0 and (v_obs is null or length(v_obs) < 3) then
    raise exception 'Há % condicional(is) sem conferência. Escreva uma observação para assinar — ela(s) ficará(ão) como "não recebida".', v_pendentes;
  end if;

  if v_pendentes > 0 then
    perform private.definir_contexto('nao_recebida', v_obs);
    update public.condicionais c
       set conferencia = 'nao_recebida', conferida_por = auth.uid(), conferida_em = now()
     where c.lista_id = p_lista_id and not c.removida and c.conferencia = 'pendente';
  end if;

  perform private.definir_contexto('assinou', v_obs);
  update public.listas l
     set status = 'conferida', conferida_por = auth.uid(), conferida_em = now(), observacao_conferencia = v_obs
   where l.id = p_lista_id
  returning * into v_lista;
  return v_lista;
end
$$;

-- Reabre uma lista assinada (motivo obrigatório). "Não recebidas" voltam a pendente.
create function public.reabrir_conferencia(p_lista_id uuid, p_motivo text)
returns public.listas
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista   public.listas;
  v_motivo  text;
begin
  perform private.exigir_papel('financeiro', 'admin');
  v_motivo := private.exigir_motivo(p_motivo);
  v_lista := private.travar_lista(p_lista_id);

  if v_lista.status <> 'conferida' then
    raise exception 'Só é possível reabrir uma lista já assinada.';
  end if;

  perform private.definir_contexto('voltou_pendente', v_motivo);
  update public.condicionais c
     set conferencia = 'pendente', conferida_por = null, conferida_em = null
   where c.lista_id = p_lista_id and not c.removida and c.conferencia = 'nao_recebida';

  perform private.definir_contexto('reabriu_conferencia', v_motivo);
  update public.listas l
     set status = 'enviada', conferida_por = null, conferida_em = null, observacao_conferencia = null
   where l.id = p_lista_id
  returning * into v_lista;
  return v_lista;
end
$$;

-- Marca uma condicional como paga, cancelada ou de volta a "em aberto"
create function public.definir_situacao(
  p_condicional_id uuid,
  p_situacao public.situacao_condicional,
  p_motivo text default null
)
returns public.condicionais
language plpgsql security definer set search_path = ''
as $$
declare
  v_cond    public.condicionais;
  v_status  public.status_lista;
  v_motivo  text;
begin
  perform private.exigir_papel('financeiro', 'admin');
  if p_situacao is null then
    raise exception 'Informe a situação.';
  end if;

  select * into v_cond from public.condicionais c where c.id = p_condicional_id for update;
  if not found then
    raise exception 'Condicional não encontrada.';
  end if;
  if v_cond.removida then
    raise exception 'Esta condicional foi removida da lista.';
  end if;

  select l.status into v_status from public.listas l where l.id = v_cond.lista_id;
  if v_status = 'rascunho' then
    raise exception 'A lista ainda não foi enviada pela expedição.';
  end if;

  if v_cond.situacao = p_situacao then
    return v_cond;
  end if;

  -- Desfazer (sair de paga/cancelada) exige motivo
  if v_cond.situacao <> 'em_aberto' then
    v_motivo := private.exigir_motivo(p_motivo);
  else
    v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');
  end if;

  perform private.definir_contexto(
    case p_situacao
      when 'paga' then 'marcou_paga'
      when 'cancelada' then 'marcou_cancelada'
      else 'voltou_em_aberto'
    end,
    v_motivo
  );
  update public.condicionais c
     set situacao = p_situacao, situacao_por = auth.uid(), situacao_em = now()
   where c.id = p_condicional_id
  returning * into v_cond;
  return v_cond;
end
$$;

-- Admin altera nome, papel ou ativa/desativa um usuário
create function public.atualizar_usuario(p_id uuid, p_nome text, p_papel public.papel_usuario, p_ativo boolean)
returns public.perfis
language plpgsql security definer set search_path = ''
as $$
declare
  v_perfil public.perfis;
  v_nome   text := btrim(coalesce(p_nome, ''));
begin
  perform private.exigir_papel('admin');
  if p_id = auth.uid() and (p_papel <> 'admin' or not p_ativo) then
    raise exception 'Você não pode remover o seu próprio acesso de administrador.';
  end if;
  if length(v_nome) < 2 then
    raise exception 'Informe o nome.';
  end if;

  perform private.definir_contexto('alterou_usuario');
  update public.perfis p
     set nome = v_nome, papel = p_papel, ativo = coalesce(p_ativo, true)
   where p.id = p_id
  returning * into v_perfil;
  if v_perfil.id is null then
    raise exception 'Usuário não encontrado.';
  end if;
  return v_perfil;
end
$$;

-- Usadas apenas pela função de servidor "usuarios" (chave de serviço)
create function public.criar_perfil(
  p_id uuid, p_usuario text, p_nome text, p_papel public.papel_usuario, p_criado_por uuid
)
returns public.perfis
language plpgsql security definer set search_path = ''
as $$
declare
  v_perfil public.perfis;
begin
  perform set_config('app.usuario_id', coalesce(p_criado_por, p_id)::text, true);
  perform private.definir_contexto('criou_usuario');
  insert into public.perfis (id, usuario, nome, papel)
  values (p_id, lower(btrim(p_usuario)), btrim(p_nome), p_papel)
  returning * into v_perfil;
  return v_perfil;
end
$$;

create function public.registrar_evento_usuario(p_perfil_id uuid, p_acao text, p_por uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.historico (usuario_id, usuario_nome, entidade, entidade_id, acao)
  select p_por, coalesce((select p.nome from public.perfis p where p.id = p_por), 'Sistema'),
         'usuario', p_perfil_id, p_acao;
end
$$;

-- ---------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public  from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function private.papel_atual() to authenticated;  -- usada nas políticas de leitura

grant execute on function public.sistema_configurado() to anon, authenticated;
grant execute on function
  public.abrir_lista(date),
  public.adicionar_condicionais(uuid, text[], text),
  public.editar_numero(uuid, text, text),
  public.remover_condicional(uuid, text),
  public.enviar_lista(uuid),
  public.marcar_conferencia(uuid, boolean),
  public.assinar_conferencia(uuid, text),
  public.reabrir_conferencia(uuid, text),
  public.definir_situacao(uuid, public.situacao_condicional, text),
  public.atualizar_usuario(uuid, text, public.papel_usuario, boolean)
to authenticated;

grant execute on function
  public.criar_perfil(uuid, text, text, public.papel_usuario, uuid),
  public.registrar_evento_usuario(uuid, text, uuid)
to service_role;
