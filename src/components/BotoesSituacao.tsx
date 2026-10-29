import { Ban, Check } from "lucide-react";
import type { Situacao } from "../lib/tipos";

/** Dois botões lado a lado: Paga / Cancelada. O ativo fica destacado. */
export function BotoesSituacao({
  situacao,
  aoEscolher,
  desabilitado = false,
}: {
  situacao: Situacao;
  aoEscolher: (s: Situacao) => void;
  desabilitado?: boolean;
}) {
  const base =
    "inline-flex h-7 items-center gap-1 px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 bg-white">
      <button
        type="button"
        tabIndex={-1}
        disabled={desabilitado}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => aoEscolher("paga")}
        title={situacao === "paga" ? "Clique para voltar a em aberto" : "Marcar como paga"}
        className={`${base} ${situacao === "paga" ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-800"}`}
      >
        <Check className="h-3.5 w-3.5" />
        Paga
      </button>
      <button
        type="button"
        tabIndex={-1}
        disabled={desabilitado}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => aoEscolher("cancelada")}
        title={situacao === "cancelada" ? "Clique para voltar a em aberto" : "Marcar como cancelada"}
        className={`${base} border-l border-zinc-300 ${situacao === "cancelada" ? "bg-zinc-700 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
      >
        <Ban className="h-3.5 w-3.5" />
        Cancelada
      </button>
    </div>
  );
}
