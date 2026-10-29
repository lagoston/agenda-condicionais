-- =====================================================================
-- Migração 005: o que é "em aberto"
--
-- Uma condicional está FINALIZADA quando foi conferida (grifada),
-- paga ou cancelada. Só fica EM ABERTO a que não teve nenhuma dessas.
-- (Não recebida ou ainda pendente de conferência = em aberto.)
-- =====================================================================

-- Resumo das listas: "em_aberto" muda de regra e entra "finalizadas" no fim
create or replace view public.listas_resumo with (security_invoker = true) as
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
  (count(c.id) filter (where not c.removida and c.situacao = 'em_aberto'
                         and c.conferencia <> 'conferida'))::int                       as em_aberto,
  (count(c.id) filter (where not c.removida and (c.situacao <> 'em_aberto'
                         or c.conferencia = 'conferida')))::int                        as finalizadas
from public.listas l
left join public.perfis pc on pc.id = l.criada_por
left join public.perfis pe on pe.id = l.enviada_por
left join public.perfis pf on pf.id = l.conferida_por
left join public.condicionais c on c.lista_id = l.id
group by l.id, pc.nome, pe.nome, pf.nome;

-- Detalhe: coluna "em_aberto" calculada no fim
create or replace view public.condicionais_detalhe with (security_invoker = true) as
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
  pr.nome  as removida_por_nome,
  (not c.removida and c.situacao = 'em_aberto' and c.conferencia <> 'conferida') as em_aberto
from public.condicionais c
join public.listas l on l.id = c.lista_id
left join public.perfis pcr on pcr.id = c.criada_por
left join public.perfis pco on pco.id = c.conferida_por
left join public.perfis ps  on ps.id  = c.situacao_por
left join public.perfis pr  on pr.id  = c.removida_por;
