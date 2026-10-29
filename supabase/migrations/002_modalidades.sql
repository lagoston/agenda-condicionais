-- =====================================================================
-- Migração 002: modalidades Entregas / Balcão
--
--  * Cada dia pode ter uma lista de Entregas e uma de Balcão.
--  * Entregas: lançada pela expedição, enviada e conferida pelo financeiro.
--  * Balcão: lançada pelo financeiro e JÁ CONFERIDA no lançamento;
--    no fim, o financeiro fecha e assina a lista.
--  * Expedição também pode marcar Paga / Cancelada (fica no histórico).
-- =====================================================================

create type public.modalidade_lista as enum ('entrega', 'balcao');

-- Listas existentes viram "entrega" (foram lançadas pela expedição)
alter table public.listas add column modalidade public.modalidade_lista not null default 'entrega';
alter table public.listas alter column modalidade drop default;
alter table public.listas drop constraint listas_data_key;
alter table public.listas add constraint listas_data_modalidade_key unique (data, modalidade);

-- ---------------------------------------------------------------------
-- Views com a modalidade
-- ---------------------------------------------------------------------
drop view public.listas_resumo;
drop view public.condicionais_detalhe;

create view public.listas_resumo with (security_invoker = true) as
select
  l.id, l.data, l.modalidade, l.status,
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
  l.data       as lista_data,
  l.modalidade as lista_modalidade,
  l.status     as lista_status,
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
-- Regras de edição por modalidade
-- ---------------------------------------------------------------------
create or replace function private.validar_edicao_itens(p_lista public.listas, p_motivo text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_papel public.papel_usuario := private.exigir_papel('expedicao', 'financeiro', 'admin');
begin
  -- Balcão: só financeiro/admin, e só enquanto a lista não foi fechada
  if p_lista.modalidade = 'balcao' then
    if v_papel = 'expedicao' then
      raise exception 'As listas de balcão são lançadas pelo financeiro.';
    end if;
    if p_lista.status = 'rascunho' then
      return nullif(btrim(coalesce(p_motivo, '')), '');
    end if;
    raise exception 'Lista do balcão já fechada e assinada. Reabra para alterar.';
  end if;

  -- Entregas
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
-- Abrir lista: Entregas = expedição · Balcão = financeiro · admin = ambas
-- ---------------------------------------------------------------------
drop function public.abrir_lista(date);

create function public.abrir_lista(p_data date, p_modalidade public.modalidade_lista)
returns public.listas
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista public.listas;
  v_papel public.papel_usuario;
begin
  v_papel := private.exigir_papel('expedicao', 'financeiro', 'admin');
  if p_modalidade is null then
    raise exception 'Informe a modalidade (Entregas ou Balcão).';
  end if;
  if p_modalidade = 'entrega' and v_papel = 'financeiro' then
    raise exception 'As listas de entregas são lançadas pela expedição.';
  end if;
  if p_modalidade = 'balcao' and v_papel = 'expedicao' then
    raise exception 'As listas de balcão são lançadas pelo financeiro.';
  end if;
  if p_data is null then
    raise exception 'Informe a data da lista.';
  end if;
  if p_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Não é possível abrir lista para uma data futura.';
  end if;

  perform private.definir_contexto('abriu_lista');
  insert into public.listas (data, modalidade, criada_por)
  values (p_data, p_modalidade, auth.uid())
  on conflict (data, modalidade) do nothing
  returning * into v_lista;

  if v_lista.id is null then
    select * into v_lista from public.listas l where l.data = p_data and l.modalidade = p_modalidade;
  end if;
  return v_lista;
end
$$;

-- ---------------------------------------------------------------------
-- Lançamento: no Balcão já entra conferida por quem lançou
-- ---------------------------------------------------------------------
create or replace function public.adicionar_condicionais(p_lista_id uuid, p_numeros text[], p_motivo text default null)
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
  v_mod_dup    public.modalidade_lista;
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
    select c.lista_id, l.data, l.modalidade into v_lista_dup, v_data_dup, v_mod_dup
      from public.condicionais c
      join public.listas l on l.id = c.lista_id
     where c.numero = v_num and not c.removida;

    if v_lista_dup is not null then
      adicionada := false;
      erro := case when v_lista_dup = p_lista_id
                   then 'Já está nesta lista.'
                   else 'Já está na lista de ' || case v_mod_dup when 'balcao' then 'Balcão' else 'Entregas' end
                        || ' de ' || to_char(v_data_dup, 'DD/MM/YYYY') || '.'
              end;
      return next; continue;
    end if;

    v_pos := v_pos + 1;
    if v_lista.modalidade = 'balcao' then
      perform private.definir_contexto('lancou_conferida', v_motivo);
      insert into public.condicionais (lista_id, numero, posicao, criada_por, conferencia, conferida_por, conferida_em)
      values (p_lista_id, v_num, v_pos, auth.uid(), 'conferida', auth.uid(), now());
    else
      perform private.definir_contexto('lancou', v_motivo);
      insert into public.condicionais (lista_id, numero, posicao, criada_por)
      values (p_lista_id, v_num, v_pos, auth.uid());
    end if;

    v_vistos := v_vistos || v_num;
    adicionada := true; erro := null;
    return next;
  end loop;
end
$$;

-- Correção de número: no Balcão continua conferida (por quem corrigiu)
create or replace function public.editar_numero(p_condicional_id uuid, p_numero text, p_motivo text default null)
returns public.condicionais
language plpgsql security definer set search_path = ''
as $$
declare
  v_cond    public.condicionais;
  v_lista   public.listas;
  v_motivo  text;
  v_num     text := btrim(coalesce(p_numero, ''));
  v_data    date;
  v_mod     public.modalidade_lista;
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

  select l.data, l.modalidade into v_data, v_mod
    from public.condicionais c
    join public.listas l on l.id = c.lista_id
   where c.numero = v_num and not c.removida and c.id <> p_condicional_id;
  if found then
    raise exception 'O número % já está na lista de % de %.', v_num,
      case v_mod when 'balcao' then 'Balcão' else 'Entregas' end, to_char(v_data, 'DD/MM/YYYY');
  end if;

  perform private.definir_contexto('editou_numero', v_motivo);
  if v_lista.modalidade = 'balcao' then
    update public.condicionais c
       set numero = v_num, conferencia = 'conferida', conferida_por = auth.uid(), conferida_em = now()
     where c.id = p_condicional_id
    returning * into v_cond;
  else
    update public.condicionais c
       set numero = v_num, conferencia = 'pendente', conferida_por = null, conferida_em = null
     where c.id = p_condicional_id
    returning * into v_cond;
  end if;
  return v_cond;
end
$$;

-- Envio para conferência: só Entregas
create or replace function public.enviar_lista(p_lista_id uuid)
returns public.listas
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista public.listas;
begin
  perform private.exigir_papel('expedicao', 'admin');
  v_lista := private.travar_lista(p_lista_id);

  if v_lista.modalidade = 'balcao' then
    raise exception 'Listas de balcão não são enviadas: elas já são conferidas no lançamento.';
  end if;
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

-- Marcação (grifo): só Entregas enviadas
create or replace function public.marcar_conferencia(p_condicional_id uuid, p_conferida boolean)
returns public.condicionais
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista_id    uuid;
  v_status      public.status_lista;
  v_modalidade  public.modalidade_lista;
  v_cond        public.condicionais;
begin
  perform private.exigir_papel('financeiro', 'admin');

  select c.lista_id into v_lista_id from public.condicionais c where c.id = p_condicional_id;
  if v_lista_id is null then
    raise exception 'Condicional não encontrada.';
  end if;

  select l.status, l.modalidade into v_status, v_modalidade
    from public.listas l where l.id = v_lista_id for share;
  if v_modalidade = 'balcao' then
    raise exception 'No balcão a condicional já fica conferida no lançamento.';
  end if;
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

-- Assinatura: Entregas (depois de enviada) ou fechamento do Balcão
create or replace function public.assinar_conferencia(p_lista_id uuid, p_observacao text default null)
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

  if v_lista.modalidade = 'entrega' and v_lista.status <> 'enviada' then
    raise exception 'Só é possível assinar uma lista de entregas enviada e ainda não assinada.';
  end if;
  if v_lista.modalidade = 'balcao' and v_lista.status <> 'rascunho' then
    raise exception 'Esta lista do balcão já está fechada e assinada.';
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

-- Reabertura: Entregas voltam a "enviada"; Balcão volta a "em lançamento"
create or replace function public.reabrir_conferencia(p_lista_id uuid, p_motivo text)
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
     set status = case when v_lista.modalidade = 'balcao' then 'rascunho'::public.status_lista
                       else 'enviada'::public.status_lista end,
         conferida_por = null, conferida_em = null, observacao_conferencia = null
   where l.id = p_lista_id
  returning * into v_lista;
  return v_lista;
end
$$;

-- Paga / Cancelada: agora também a expedição (tudo fica no histórico)
create or replace function public.definir_situacao(
  p_condicional_id uuid,
  p_situacao public.situacao_condicional,
  p_motivo text default null
)
returns public.condicionais
language plpgsql security definer set search_path = ''
as $$
declare
  v_cond    public.condicionais;
  v_motivo  text;
begin
  perform private.exigir_papel('expedicao', 'financeiro', 'admin');
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

-- ---------------------------------------------------------------------
-- Permissões da nova função
-- ---------------------------------------------------------------------
revoke execute on function public.abrir_lista(date, public.modalidade_lista) from public, anon;
grant execute on function public.abrir_lista(date, public.modalidade_lista) to authenticated;
