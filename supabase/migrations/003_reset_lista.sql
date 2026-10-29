-- =====================================================================
-- Migração 003: reset de lista (somente administrador)
--
-- Para limpar listas de TESTE: apaga a lista, suas condicionais e o
-- histórico dela, como se nunca tivesse existido. Fica só um registro
-- de auditoria dizendo quem resetou, quando, por quê e o que foi apagado.
--
-- As travas de exclusão continuam valendo para todo o resto: só esta
-- função consegue liberar a exclusão, e só dentro da própria transação.
-- =====================================================================

-- A trava de exclusão passa a aceitar uma liberação local, usada só pelo reset
create or replace function private.impedir_exclusao()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('app.reset_autorizado', true) = 'sim' then
    return old;
  end if;
  raise exception 'Exclusão não permitida (%): o histórico deve ser preservado.', tg_table_name;
end
$$;

create function public.resetar_lista(p_lista_id uuid, p_motivo text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista    public.listas;
  v_motivo   text;
  v_qtd      integer;
  v_numeros  text;
  v_nome     text;
begin
  perform private.exigir_papel('admin');
  v_motivo := private.exigir_motivo(p_motivo);
  v_lista := private.travar_lista(p_lista_id);

  select count(*), string_agg(c.numero, ', ' order by c.posicao)
    into v_qtd, v_numeros
    from public.condicionais c
   where c.lista_id = p_lista_id;

  -- Libera a exclusão só durante esta transação
  perform set_config('app.reset_autorizado', 'sim', true);
  delete from public.historico h where h.lista_id = p_lista_id;
  delete from public.condicionais c where c.lista_id = p_lista_id;
  delete from public.listas l where l.id = p_lista_id;
  perform set_config('app.reset_autorizado', '', true);

  -- Registro de auditoria (não fica ligado a nenhuma lista)
  select p.nome into v_nome from public.perfis p where p.id = auth.uid();
  insert into public.historico (usuario_id, usuario_nome, entidade, entidade_id, lista_id, acao, alteracoes, motivo)
  values (
    auth.uid(), coalesce(v_nome, 'Sistema'), 'lista', p_lista_id, null, 'resetou_lista',
    jsonb_build_object(
      'data', v_lista.data,
      'modalidade', v_lista.modalidade,
      'status', v_lista.status,
      'condicionais_apagadas', v_qtd,
      'numeros', v_numeros
    ),
    v_motivo
  );

  return v_qtd;
end
$$;

revoke execute on function public.resetar_lista(uuid, text) from public, anon;
grant execute on function public.resetar_lista(uuid, text) to authenticated;
