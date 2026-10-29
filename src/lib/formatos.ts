import { FUSO } from "./config";
import type { EventoHistorico, Modalidade, Papel, Situacao, StatusConferencia, StatusLista } from "./tipos";

/** Data de hoje no fuso de São Paulo, no formato AAAA-MM-DD */
export function hojeISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
}

function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.split("-").map(Number);
  return [a, m, d];
}

/** "2026-10-29" -> "29/10/2026" (sem passar por fuso horário) */
export function formatarData(iso: string): string {
  const [a, m, d] = partes(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
}

/** "2026-10-29" -> "Quinta-feira" */
export function diaDaSemana(iso: string): string {
  const [a, m, d] = partes(iso);
  const dia = new Date(a, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long" });
  return dia.charAt(0).toUpperCase() + dia.slice(1);
}

/** Soma dias a uma data AAAA-MM-DD */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = partes(iso);
  const data = new Date(Date.UTC(a, m - 1, d + dias));
  return data.toISOString().slice(0, 10);
}

/** Dias corridos entre duas datas AAAA-MM-DD */
export function diasEntre(inicio: string, fim: string): number {
  const [a1, m1, d1] = partes(inicio);
  const [a2, m2, d2] = partes(fim);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

export function formatarHora(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
}

/** Data (dd/mm/aaaa) de um momento, no fuso de São Paulo */
export function formatarDataDoMomento(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("pt-BR", { timeZone: FUSO });
}

export function formatarDataHora(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const data = d.toLocaleDateString("pt-BR", { timeZone: FUSO });
  return `${data} às ${formatarHora(ts)}`;
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  expedicao: "Expedição",
  financeiro: "Financeiro",
  admin: "Administrador",
};

export const ROTULO_STATUS_LISTA: Record<StatusLista, string> = {
  rascunho: "Em preenchimento",
  enviada: "Aguardando conferência",
  conferida: "Conferida e assinada",
};

export const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  entrega: "Entregas",
  balcao: "Balcão",
};

/** No Balcão não existe "enviada": é "em lançamento" até ser fechada */
export function rotuloStatusLista(status: StatusLista, modalidade: Modalidade): string {
  if (modalidade === "balcao") return status === "conferida" ? "Fechada e assinada" : "Em lançamento";
  return ROTULO_STATUS_LISTA[status];
}

/** Endereço da tela de uma lista */
export const caminhoLista = (modalidade: Modalidade, data: string) => `/lista/${modalidade}/${data}`;

export const ROTULO_CONFERENCIA: Record<StatusConferencia, string> = {
  pendente: "Pendente",
  conferida: "Conferida",
  nao_recebida: "Não recebida",
};

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  em_aberto: "Em aberto",
  paga: "Paga",
  cancelada: "Cancelada",
};

function de(ev: EventoHistorico, campo: string): [string, string] | null {
  const v = ev.alteracoes?.[campo];
  if (Array.isArray(v) && v.length === 2) return [String(v[0] ?? ""), String(v[1] ?? "")];
  return null;
}

/** Texto amigável de um evento do histórico */
export function descreverEvento(ev: EventoHistorico): string {
  const n = ev.numero ?? "";
  switch (ev.acao) {
    case "abriu_lista":
      return "abriu a lista";
    case "enviou_lista":
      return "enviou a lista para conferência";
    case "assinou":
      return "assinou a conferência";
    case "reabriu_conferencia":
      return "reabriu a conferência";
    case "lancou":
      return `lançou a condicional ${n}`;
    case "lancou_conferida":
      return `lançou e conferiu ${n} (balcão)`;
    case "editou_numero": {
      const mudanca = de(ev, "numero");
      return mudanca ? `corrigiu o número ${mudanca[0]} → ${mudanca[1]}` : `corrigiu o número ${n}`;
    }
    case "removeu":
      return `removeu ${n} da lista`;
    case "conferiu":
      return `conferiu (grifou) ${n}`;
    case "desmarcou":
      return `desmarcou a conferência de ${n}`;
    case "nao_recebida":
      return `registrou ${n} como NÃO RECEBIDA`;
    case "voltou_pendente":
      return `${n} voltou para pendente (reabertura)`;
    case "marcou_paga":
      return `marcou ${n} como paga`;
    case "marcou_cancelada":
      return `marcou ${n} como cancelada`;
    case "voltou_em_aberto":
      return `voltou ${n} para "em aberto"`;
    case "criou_usuario":
      return "criou o usuário";
    case "alterou_usuario":
      return "alterou o usuário";
    case "redefiniu_senha":
      return "redefiniu a senha";
    default:
      return ev.acao;
  }
}
