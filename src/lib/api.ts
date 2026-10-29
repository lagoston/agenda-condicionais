// Todas as chamadas ao Supabase ficam aqui.
import { DOMINIO_LOGIN } from "./config";
import { supabase } from "./supabase";
import type {
  Condicional,
  CondicionalBase,
  EventoHistorico,
  ListaResumo,
  Papel,
  Perfil,
  ResultadoLancamento,
  Situacao,
} from "./tipos";

export function traduzirErro(mensagem: string): string {
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(mensagem))
    return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  if (/JWT expired|invalid JWT|refresh token/i.test(mensagem)) return "Sua sessão expirou. Entre novamente.";
  if (/Invalid login credentials/i.test(mensagem)) return "Usuário ou senha incorretos.";
  if (/permission denied/i.test(mensagem)) return "Você não tem permissão para esta ação.";
  if (/condicionais_numero_ativo_uk|duplicate key/i.test(mensagem)) return "Esse número já está em uma lista.";
  return mensagem;
}

type Resposta = { data: unknown; error: { message: string } | null };

function verificar<T>(r: Resposta): T {
  if (r.error) throw new Error(traduzirErro(r.error.message));
  return r.data as T;
}

async function rpc<T>(funcao: string, args?: Record<string, unknown>): Promise<T> {
  return verificar<T>(await supabase.rpc(funcao, args));
}

// ---------------------------------------------------------------- Sessão
export async function entrar(usuario: string, senha: string): Promise<void> {
  const email = `${usuario.trim().toLowerCase()}@${DOMINIO_LOGIN}`;
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(traduzirErro(error.message));
}

export async function sair(): Promise<void> {
  await supabase.auth.signOut();
}

export async function sistemaConfigurado(): Promise<boolean> {
  return Boolean(await rpc<boolean>("sistema_configurado"));
}

export async function carregarPerfil(id: string): Promise<Perfil | null> {
  return verificar<Perfil | null>(await supabase.from("perfis").select("*").eq("id", id).maybeSingle());
}

// ---------------------------------------------------------------- Usuários
async function funcaoUsuarios<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("usuarios", { body: corpo });
  if (error) {
    let msg = error.message;
    const contexto = (error as { context?: unknown }).context;
    if (contexto instanceof Response) {
      try {
        const json = (await contexto.json()) as { erro?: string };
        if (json.erro) msg = json.erro;
      } catch {
        /* resposta sem JSON */
      }
    }
    throw new Error(traduzirErro(msg));
  }
  return data as T;
}

export const primeiroAcesso = (dados: { nome: string; usuario: string; senha: string }) =>
  funcaoUsuarios<{ perfil: Perfil }>({ acao: "primeiro_acesso", ...dados });

export const criarUsuario = (dados: { nome: string; usuario: string; senha: string; papel: Papel }) =>
  funcaoUsuarios<{ perfil: Perfil }>({ acao: "criar", ...dados });

export const redefinirSenha = (id: string, senha: string) =>
  funcaoUsuarios<{ ok: boolean }>({ acao: "redefinir_senha", id, senha });

export async function listarUsuarios(): Promise<Perfil[]> {
  return verificar<Perfil[]>(await supabase.from("perfis").select("*").order("nome"));
}

export const atualizarUsuario = (id: string, nome: string, papel: Papel, ativo: boolean) =>
  rpc<Perfil>("atualizar_usuario", { p_id: id, p_nome: nome, p_papel: papel, p_ativo: ativo });

// ---------------------------------------------------------------- Listas
export async function listarListas(limite = 120): Promise<ListaResumo[]> {
  return verificar<ListaResumo[]>(
    await supabase.from("listas_resumo").select("*").order("data", { ascending: false }).limit(limite),
  );
}

export async function buscarListaPorData(data: string): Promise<ListaResumo | null> {
  return verificar<ListaResumo | null>(await supabase.from("listas_resumo").select("*").eq("data", data).maybeSingle());
}

export const abrirLista = (data: string) => rpc<ListaResumo>("abrir_lista", { p_data: data });

export const enviarLista = (listaId: string) => rpc<unknown>("enviar_lista", { p_lista_id: listaId });

export const assinarConferencia = (listaId: string, observacao?: string) =>
  rpc<unknown>("assinar_conferencia", { p_lista_id: listaId, p_observacao: observacao ?? null });

export const reabrirConferencia = (listaId: string, motivo: string) =>
  rpc<unknown>("reabrir_conferencia", { p_lista_id: listaId, p_motivo: motivo });

// ---------------------------------------------------------------- Condicionais
export async function listarCondicionais(listaId: string): Promise<Condicional[]> {
  return verificar<Condicional[]>(
    await supabase.from("condicionais_detalhe").select("*").eq("lista_id", listaId).order("posicao"),
  );
}

export const adicionarCondicionais = (listaId: string, numeros: string[], motivo?: string) =>
  rpc<ResultadoLancamento[]>("adicionar_condicionais", {
    p_lista_id: listaId,
    p_numeros: numeros,
    p_motivo: motivo ?? null,
  });

export const editarNumero = (id: string, numero: string, motivo?: string) =>
  rpc<CondicionalBase>("editar_numero", { p_condicional_id: id, p_numero: numero, p_motivo: motivo ?? null });

export const removerCondicional = (id: string, motivo?: string) =>
  rpc<CondicionalBase>("remover_condicional", { p_condicional_id: id, p_motivo: motivo ?? null });

export const marcarConferencia = (id: string, conferida: boolean) =>
  rpc<CondicionalBase>("marcar_conferencia", { p_condicional_id: id, p_conferida: conferida });

export const definirSituacao = (id: string, situacao: Situacao, motivo?: string) =>
  rpc<CondicionalBase>("definir_situacao", {
    p_condicional_id: id,
    p_situacao: situacao,
    p_motivo: motivo ?? null,
  });

/** Busca por número (completo ou início do número) */
export async function buscarCondicionais(termo: string): Promise<Condicional[]> {
  let consulta = supabase.from("condicionais_detalhe").select("*");
  consulta = termo.length === 6 ? consulta.eq("numero", termo) : consulta.like("numero", `${termo}%`);
  return verificar<Condicional[]>(await consulta.order("lista_data", { ascending: false }).order("numero").limit(100));
}

/** Todas as condicionais em aberto de listas já enviadas (paginado de 1000 em 1000) */
export async function listarEmAberto(): Promise<Condicional[]> {
  const pagina = 1000;
  const todas: Condicional[] = [];
  for (let inicio = 0; ; inicio += pagina) {
    const parte = verificar<Condicional[]>(
      await supabase
        .from("condicionais_detalhe")
        .select("*")
        .eq("situacao", "em_aberto")
        .eq("removida", false)
        .neq("lista_status", "rascunho")
        .order("lista_data", { ascending: true })
        .order("posicao", { ascending: true })
        .range(inicio, inicio + pagina - 1),
    );
    todas.push(...parte);
    if (parte.length < pagina) break;
  }
  return todas;
}

// ---------------------------------------------------------------- Histórico
export async function historicoDaLista(listaId: string): Promise<EventoHistorico[]> {
  return verificar<EventoHistorico[]>(
    await supabase.from("historico").select("*").eq("lista_id", listaId).order("id", { ascending: true }),
  );
}

export async function historicoDeRegistros(ids: string[]): Promise<EventoHistorico[]> {
  if (ids.length === 0) return [];
  return verificar<EventoHistorico[]>(
    await supabase.from("historico").select("*").in("entidade_id", ids).order("id", { ascending: true }),
  );
}
