export type Papel = "expedicao" | "financeiro" | "admin";
export type StatusLista = "rascunho" | "enviada" | "conferida";
export type StatusConferencia = "pendente" | "conferida" | "nao_recebida";
export type Situacao = "em_aberto" | "paga" | "cancelada";
export type Modalidade = "entrega" | "balcao";

export interface Perfil {
  id: string;
  usuario: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  criado_em: string;
}

export interface ListaResumo {
  id: string;
  data: string; // AAAA-MM-DD
  modalidade: Modalidade;
  status: StatusLista;
  criada_por: string;
  criada_em: string;
  enviada_por: string | null;
  enviada_em: string | null;
  conferida_por: string | null;
  conferida_em: string | null;
  observacao_conferencia: string | null;
  criada_por_nome: string | null;
  enviada_por_nome: string | null;
  conferida_por_nome: string | null;
  total: number;
  conferidas: number;
  nao_recebidas: number;
  pagas: number;
  canceladas: number;
  em_aberto: number;
  finalizadas: number;
}

export interface Condicional {
  id: string;
  lista_id: string;
  numero: string;
  posicao: number;
  conferencia: StatusConferencia;
  conferida_por: string | null;
  conferida_em: string | null;
  situacao: Situacao;
  situacao_por: string | null;
  situacao_em: string | null;
  removida: boolean;
  removida_por: string | null;
  removida_em: string | null;
  motivo_remocao: string | null;
  criada_por: string;
  criada_em: string;
  lista_data: string;
  lista_modalidade: Modalidade;
  lista_status: StatusLista;
  criada_por_nome: string | null;
  conferida_por_nome: string | null;
  situacao_por_nome: string | null;
  removida_por_nome: string | null;
  /** Não conferida, não paga e não cancelada */
  em_aberto: boolean;
}

/** Linha "crua" devolvida pelas funções do banco (sem nomes nem dados da lista) */
export type CondicionalBase = Omit<
  Condicional,
  | "lista_data"
  | "lista_modalidade"
  | "lista_status"
  | "criada_por_nome"
  | "conferida_por_nome"
  | "situacao_por_nome"
  | "removida_por_nome"
  | "em_aberto"
>;

export interface ResultadoLancamento {
  numero: string;
  adicionada: boolean;
  erro: string | null;
}

export interface EventoHistorico {
  id: number;
  em: string;
  usuario_id: string | null;
  usuario_nome: string;
  entidade: "lista" | "condicional" | "usuario";
  entidade_id: string;
  lista_id: string | null;
  numero: string | null;
  acao: string;
  alteracoes: Record<string, unknown> | null;
  motivo: string | null;
}
