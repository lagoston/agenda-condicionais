-- =====================================================================
-- Migração 006: ao assinar, só vira "não recebida" o que está EM ABERTO
-- (não grifada E sem pagamento/cancelamento). Pagas e canceladas já
-- estão finalizadas e não exigem observação.
-- =====================================================================

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

  select count(*),
         count(*) filter (where c.conferencia = 'pendente' and c.situacao = 'em_aberto')
    into v_total, v_pendentes
    from public.condicionais c
   where c.lista_id = p_lista_id and not c.removida;

  if v_total = 0 then
    raise exception 'A lista está vazia.';
  end if;
  if v_pendentes > 0 and (v_obs is null or length(v_obs) < 3) then
    raise exception 'Há % condicional(is) em aberto sem conferência. Escreva uma observação para assinar — ela(s) ficará(ão) como "não recebida".', v_pendentes;
  end if;

  if v_pendentes > 0 then
    perform private.definir_contexto('nao_recebida', v_obs);
    update public.condicionais c
       set conferencia = 'nao_recebida', conferida_por = auth.uid(), conferida_em = now()
     where c.lista_id = p_lista_id and not c.removida
       and c.conferencia = 'pendente' and c.situacao = 'em_aberto';
  end if;

  perform private.definir_contexto('assinou', v_obs);
  update public.listas l
     set status = 'conferida', conferida_por = auth.uid(), conferida_em = now(), observacao_conferencia = v_obs
   where l.id = p_lista_id
  returning * into v_lista;
  return v_lista;
end
$$;
