-- =====================================================================
-- Migração 004: registro de troca da própria senha
-- A troca em si é feita pelo Supabase Auth (o app confere a senha atual
-- antes); aqui só fica registrado no histórico quem trocou e quando.
-- =====================================================================

create function public.registrar_troca_de_senha()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.exigir_papel('expedicao', 'financeiro', 'admin');
  insert into public.historico (usuario_id, usuario_nome, entidade, entidade_id, acao)
  select p.id, p.nome, 'usuario', p.id, 'alterou_propria_senha'
    from public.perfis p
   where p.id = auth.uid();
end
$$;

revoke execute on function public.registrar_troca_de_senha() from public, anon;
grant execute on function public.registrar_troca_de_senha() to authenticated;
