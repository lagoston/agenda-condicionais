// Espelho das regras do banco, só para mostrar/esconder botões.
// Quem decide de verdade é o banco (as funções recusam o que não pode).
//
//  Entregas: expedição lança e envia → financeiro confere com a barra de espaço e assina.
//  Balcão:   financeiro lança e cada número já entra conferido → no fim, fecha e assina.
//  Paga / Cancelada: qualquer usuário (expedição, financeiro, admin), sempre registrado.
import type { Modalidade, Papel, StatusLista } from "./tipos";

interface ListaInfo {
  modalidade: Modalidade;
  status: StatusLista;
}

const financeiroOuAdmin = (papel: Papel) => papel === "financeiro" || papel === "admin";

/** Entregas: expedição · Balcão: financeiro · Admin: as duas */
export function podeAbrirLista(papel: Papel, modalidade: Modalidade): boolean {
  if (papel === "admin") return true;
  return modalidade === "entrega" ? papel === "expedicao" : papel === "financeiro";
}

export const modalidadesQuePodeAbrir = (papel: Papel): Modalidade[] =>
  (["entrega", "balcao"] as Modalidade[]).filter((m) => podeAbrirLista(papel, m));

export const podeEnviar = (papel: Papel, l: ListaInfo) =>
  l.modalidade === "entrega" && l.status === "rascunho" && (papel === "expedicao" || papel === "admin");

/** Conferência com a barra de espaço: só Entregas enviadas */
export const podeConferir = (papel: Papel, l: ListaInfo) =>
  l.modalidade === "entrega" && l.status === "enviada" && financeiroOuAdmin(papel);

/** Assinar a conferência (Entregas enviadas) ou fechar o Balcão */
export const podeAssinar = (papel: Papel, l: ListaInfo) =>
  financeiroOuAdmin(papel) && (l.modalidade === "entrega" ? l.status === "enviada" : l.status === "rascunho");

/** Paga / Cancelada: todos os papéis; nas Entregas, depois que a lista foi enviada */
export const podeAlterarSituacao = (l: ListaInfo) => l.modalidade === "balcao" || l.status !== "rascunho";

export const podeReabrir = (papel: Papel, l: ListaInfo) => l.status === "conferida" && financeiroOuAdmin(papel);

export function podeEditarItens(papel: Papel, l: ListaInfo, conferenciaIniciada: boolean): boolean {
  if (l.modalidade === "balcao") return papel !== "expedicao" && l.status === "rascunho";
  if (l.status === "rascunho") return papel !== "financeiro";
  if (l.status === "enviada") return papel !== "expedicao" || !conferenciaIniciada;
  return false;
}

/** Nas Entregas, depois do envio, toda alteração exige motivo */
export const exigeMotivo = (l: ListaInfo) => l.modalidade === "entrega" && l.status !== "rascunho";

export const ehFinanceiro = financeiroOuAdmin;
