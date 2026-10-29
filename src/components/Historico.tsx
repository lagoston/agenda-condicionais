import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { descreverEvento, formatarDataHora } from "../lib/formatos";
import type { EventoHistorico } from "../lib/tipos";
import { Carregando, MensagemErro } from "./ui";

const DESTAQUE: Record<string, string> = {
  conferiu: "bg-grifo",
  assinou: "bg-emerald-500",
  nao_recebida: "bg-vermelho",
  removeu: "bg-vermelho",
  editou_numero: "bg-amber-500",
  desmarcou: "bg-amber-500",
  reabriu_conferencia: "bg-amber-500",
  marcou_paga: "bg-emerald-500",
  marcou_cancelada: "bg-zinc-500",
};

/** Lista de eventos em ordem cronológica */
export function LinhaDoTempo({ eventos }: { eventos: EventoHistorico[] }) {
  if (eventos.length === 0) return <p className="text-sm text-zinc-500">Nenhum registro.</p>;
  return (
    <ol className="relative space-y-4 border-l border-zinc-200 pl-5">
      {eventos.map((ev) => (
        <li key={ev.id} className="relative">
          <span
            className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${DESTAQUE[ev.acao] ?? "bg-marinho"}`}
          />
          <p className="text-xs text-zinc-500">{formatarDataHora(ev.em)}</p>
          <p className="text-sm text-zinc-800">
            <span className="font-semibold text-marinho">{ev.usuario_nome}</span> {descreverEvento(ev)}
          </p>
          {ev.motivo && <p className="mt-0.5 text-sm italic text-zinc-600">“{ev.motivo}”</p>}
        </li>
      ))}
    </ol>
  );
}

export interface PedidoHistorico {
  titulo: string;
  carregar: () => Promise<EventoHistorico[]>;
}

/** Painel lateral com o histórico de uma lista ou condicional */
export function PainelHistorico({ pedido, aoFechar }: { pedido: PedidoHistorico; aoFechar: () => void }) {
  const [eventos, setEventos] = useState<EventoHistorico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setEventos(null);
    pedido
      .carregar()
      .then((e) => ativo && setEventos(e))
      .catch((e: Error) => ativo && setErro(e.message));
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      ativo = false;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [pedido, aoFechar]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-marinho-900/30">
      <div className="absolute inset-0" onClick={aoFechar} aria-hidden />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Histórico</p>
            <h2 className="text-lg font-semibold text-marinho">{pedido.titulo}</h2>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {erro ? <MensagemErro texto={erro} /> : eventos ? <LinhaDoTempo eventos={eventos} /> : <Carregando />}
        </div>
      </aside>
    </div>
  );
}
