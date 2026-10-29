// Espelho das regras do banco, só para mostrar/esconder botões.
// Quem decide de verdade é o banco (as funções recusam o que não pode).
import type { Papel, StatusLista } from "./tipos";

export const podeAbrirLista = (papel: Papel) => papel === "expedicao" || papel === "admin";

export const podeEnviar = (papel: Papel, status: StatusLista) =>
  status === "rascunho" && (papel === "expedicao" || papel === "admin");

export const podeConferir = (papel: Papel, status: StatusLista) =>
  status === "enviada" && (papel === "financeiro" || papel === "admin");

export const podeAlterarSituacao = (papel: Papel, status: StatusLista) =>
  status !== "rascunho" && (papel === "financeiro" || papel === "admin");

export const podeReabrir = (papel: Papel, status: StatusLista) =>
  status === "conferida" && (papel === "financeiro" || papel === "admin");

export function podeEditarItens(papel: Papel, status: StatusLista, conferenciaIniciada: boolean): boolean {
  if (status === "rascunho") return papel !== "financeiro";
  if (status === "enviada") return papel !== "expedicao" || !conferenciaIniciada;
  return false;
}

/** Depois que a lista é enviada, toda alteração exige motivo */
export const exigeMotivo = (status: StatusLista) => status !== "rascunho";

export const ehFinanceiro = (papel: Papel) => papel === "financeiro" || papel === "admin";
