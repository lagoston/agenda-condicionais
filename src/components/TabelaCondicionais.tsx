import { Check, History, Loader2, Pencil, Trash2 } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { formatarDataHora, formatarHora } from "../lib/formatos";
import type { Condicional, Situacao } from "../lib/tipos";
import { BotoesSituacao } from "./BotoesSituacao";
import { SeloConferencia, SeloSituacao } from "./ui";

export interface Temporario {
  chave: string;
  numero: string;
}

interface Props {
  itens: Condicional[];
  temporarios: Temporario[];
  modoConferencia: boolean;
  cursor: number;
  editavel: boolean;
  situacaoEditavel: boolean;
  /** Lista em preenchimento: esconde as colunas de conferência e situação */
  ocultarStatus?: boolean;
  destaque: string | null;
  aoFocarLinha: (indice: number) => void;
  aoAlternarConferencia: (c: Condicional, indice: number) => void;
  aoEditar: (c: Condicional) => void;
  aoRemover: (c: Condicional) => void;
  aoSituacao: (c: Condicional, s: Situacao) => void;
  aoHistorico: (c: Condicional) => void;
  registrarLinha: (id: string, el: HTMLTableRowElement | null) => void;
}

/** Botão de ícone que não "rouba" o foco (para não atrapalhar a barra de espaço) */
function BotaoIcone({
  titulo,
  onClick,
  children,
  perigo = false,
}: {
  titulo: string;
  onClick: () => void;
  children: ReactNode;
  perigo?: boolean;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      title={titulo}
      aria-label={titulo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded-md p-1.5 text-zinc-400 transition-colors ${
        perigo ? "hover:bg-vermelho-50 hover:text-vermelho" : "hover:bg-marinho-50 hover:text-marinho"
      }`}
    >
      {children}
    </button>
  );
}

export function TabelaCondicionais({
  itens,
  temporarios,
  modoConferencia,
  cursor,
  editavel,
  situacaoEditavel,
  ocultarStatus = false,
  destaque,
  aoFocarLinha,
  aoAlternarConferencia,
  aoEditar,
  aoRemover,
  aoSituacao,
  aoHistorico,
  registrarLinha,
}: Props) {
  if (itens.length === 0 && temporarios.length === 0) {
    return (
      <div className="cartao px-6 py-10 text-center text-sm text-zinc-500">Nenhuma condicional lançada ainda.</div>
    );
  }

  return (
    <div className="cartao overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <th className="w-14 py-2.5 pl-4 pr-2 text-right">#</th>
            <th className="py-2.5 pr-4">Número</th>
            {!ocultarStatus && (
              <>
                <th className="py-2.5 pr-4">Conferência</th>
                <th className="py-2.5 pr-4">Situação</th>
              </>
            )}
            <th className="w-28 py-2.5 pr-3" />
          </tr>
        </thead>
        <tbody>
          {itens.map((c, i) => {
            const focada = modoConferencia && i === cursor;
            return (
              <tr
                key={c.id}
                ref={(el) => registrarLinha(c.id, el)}
                onClick={() => modoConferencia && aoFocarLinha(i)}
                className={`scroll-mb-28 scroll-mt-24 border-b border-zinc-100 last:border-0 ${
                  focada ? "bg-marinho-50" : "hover:bg-zinc-50/70"
                } ${c.numero === destaque ? "linha-nova" : ""} ${modoConferencia ? "cursor-pointer" : ""}`}
              >
                <td
                  className={`py-2.5 pl-4 pr-2 text-right text-xs tabular-nums ${
                    focada ? "font-bold text-marinho shadow-[inset_4px_0_0_#141D3E]" : "text-zinc-400"
                  }`}
                >
                  {i + 1}
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className={`numero text-lg font-medium ${
                      c.conferencia === "conferida"
                        ? "grifo text-marinho-900"
                        : c.conferencia === "nao_recebida"
                          ? "text-vermelho-700"
                          : "text-marinho"
                    }`}
                  >
                    {c.numero}
                  </span>
                </td>
                {!ocultarStatus && (
                  <>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        {modoConferencia ? (
                          <button
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.stopPropagation();
                              aoAlternarConferencia(c, i);
                            }}
                            aria-label={
                              c.conferencia === "conferida" ? `Desmarcar ${c.numero}` : `Conferir ${c.numero}`
                            }
                            className={`flex h-7 w-7 items-center justify-center rounded-md border-2 transition-colors ${
                              c.conferencia === "conferida"
                                ? "border-amber-400 bg-grifo text-marinho"
                                : "border-zinc-300 bg-white hover:border-marinho"
                            }`}
                          >
                            {c.conferencia === "conferida" && <Check className="h-4 w-4" strokeWidth={3} />}
                          </button>
                        ) : c.conferencia === "pendente" && c.situacao !== "em_aberto" ? (
                          <span className="text-xs text-zinc-400" title="Já está paga/cancelada: não precisa conferir">
                            — não precisa
                          </span>
                        ) : (
                          <SeloConferencia status={c.conferencia} />
                        )}
                        {c.conferencia !== "pendente" && c.conferida_em && (
                          <span className="text-xs text-zinc-500" title={formatarDataHora(c.conferida_em)}>
                            {c.conferida_por_nome} · {formatarHora(c.conferida_em)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Conferida já finaliza: mostra o selo em vez dos botões Paga/Cancelada */}
                        {situacaoEditavel && !(c.conferencia === "conferida" && c.situacao === "em_aberto") ? (
                          <BotoesSituacao situacao={c.situacao} aoEscolher={(s) => aoSituacao(c, s)} />
                        ) : (
                          <SeloSituacao c={c} />
                        )}
                        {c.situacao !== "em_aberto" && c.situacao_em && (
                          <span className="text-xs text-zinc-500" title={formatarDataHora(c.situacao_em)}>
                            {c.situacao_por_nome}
                          </span>
                        )}
                      </div>
                    </td>
                  </>
                )}
                <td className="py-2.5 pr-3">
                  <div className="flex justify-end gap-0.5">
                    <BotaoIcone titulo="Histórico desta condicional" onClick={() => aoHistorico(c)}>
                      <History className="h-4 w-4" />
                    </BotaoIcone>
                    {editavel && (
                      <>
                        <BotaoIcone titulo="Corrigir número" onClick={() => aoEditar(c)}>
                          <Pencil className="h-4 w-4" />
                        </BotaoIcone>
                        <BotaoIcone titulo="Remover da lista" perigo onClick={() => aoRemover(c)}>
                          <Trash2 className="h-4 w-4" />
                        </BotaoIcone>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {temporarios.map((t, j) => (
            <tr key={t.chave} className="border-b border-zinc-100 bg-zinc-50/60 last:border-0">
              <td className="py-2.5 pl-4 pr-2 text-right text-xs tabular-nums text-zinc-300">{itens.length + j + 1}</td>
              <td className="py-2.5 pr-4">
                <span className="numero text-lg text-zinc-400">{t.numero}</span>
              </td>
              <td colSpan={ocultarStatus ? 1 : 3} className="py-2.5 pr-4 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> salvando…
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Condicionais removidas (riscadas, com quem removeu e o motivo) */
export function TabelaRemovidas({
  itens,
  aoHistorico,
}: {
  itens: Condicional[];
  aoHistorico: (c: Condicional) => void;
}) {
  return (
    <div className="cartao overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <tbody>
          {itens.map((c) => (
            <tr key={c.id} className="border-b border-zinc-100 last:border-0">
              <td className="py-2 pl-4 pr-4">
                <span className="numero text-zinc-400 line-through">{c.numero}</span>
              </td>
              <td className="py-2 pr-4 text-zinc-600">
                Removida por <b className="font-medium">{c.removida_por_nome}</b> em {formatarDataHora(c.removida_em)}
              </td>
              <td className="py-2 pr-4 italic text-zinc-500">
                {c.motivo_remocao ? `“${c.motivo_remocao}”` : "sem motivo"}
              </td>
              <td className="py-2 pr-3 text-right">
                <BotaoIcone titulo="Histórico" onClick={() => aoHistorico(c)}>
                  <History className="h-4 w-4" />
                </BotaoIcone>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
