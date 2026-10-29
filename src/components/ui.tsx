import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2, Store, Truck } from "lucide-react";
import { ROTULO_CONFERENCIA, ROTULO_MODALIDADE, ROTULO_SITUACAO, rotuloStatusLista } from "../lib/formatos";
import type { Modalidade, Situacao, StatusConferencia, StatusLista } from "../lib/tipos";

type Variante = "primario" | "secundario" | "perigo" | "fantasma" | "sucesso";
type Tamanho = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marinho text-white hover:bg-marinho-700 disabled:bg-marinho/40",
  secundario:
    "bg-white text-marinho border border-zinc-300 hover:border-marinho/40 hover:bg-marinho-50 disabled:opacity-50",
  perigo: "bg-vermelho text-white hover:bg-vermelho-700 disabled:opacity-50",
  fantasma: "text-marinho hover:bg-marinho-50 disabled:opacity-40",
  sucesso: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  {
    variante = "primario",
    tamanho = "md",
    carregando = false,
    className = "",
    children,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || carregando}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-marinho/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${className}`}
      {...props}
    >
      {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

type Cor = "cinza" | "azul" | "verde" | "vermelho" | "amarelo" | "marinho";

const CORES: Record<Cor, string> = {
  cinza: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  azul: "bg-sky-50 text-sky-800 ring-sky-200",
  verde: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  vermelho: "bg-vermelho-50 text-vermelho-700 ring-vermelho-100",
  amarelo: "bg-amber-50 text-amber-800 ring-amber-200",
  marinho: "bg-marinho-50 text-marinho ring-marinho-100",
};

export function Selo({ cor, children, className = "" }: { cor: Cor; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CORES[cor]} ${className}`}
    >
      {children}
    </span>
  );
}

const COR_STATUS_LISTA: Record<StatusLista, Cor> = { rascunho: "cinza", enviada: "amarelo", conferida: "verde" };
const COR_CONFERENCIA: Record<StatusConferencia, Cor> = {
  pendente: "cinza",
  conferida: "amarelo",
  nao_recebida: "vermelho",
};
const COR_SITUACAO: Record<Situacao, Cor> = { em_aberto: "azul", paga: "verde", cancelada: "cinza" };

export const SeloStatusLista = ({ status, modalidade }: { status: StatusLista; modalidade: Modalidade }) => (
  <Selo cor={modalidade === "balcao" && status === "rascunho" ? "azul" : COR_STATUS_LISTA[status]}>
    {rotuloStatusLista(status, modalidade)}
  </Selo>
);

/** Etiqueta da modalidade: Entregas (caminhão) ou Balcão (loja) */
export function SeloModalidade({ modalidade, grande = false }: { modalidade: Modalidade; grande?: boolean }) {
  const Icone = modalidade === "entrega" ? Truck : Store;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-semibold ${
        modalidade === "entrega" ? "bg-marinho text-white" : "bg-vermelho text-white"
      } ${grande ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
    >
      <Icone className={grande ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {ROTULO_MODALIDADE[modalidade]}
    </span>
  );
}
export const SeloConferencia = ({ status }: { status: StatusConferencia }) => (
  <Selo cor={COR_CONFERENCIA[status]}>{ROTULO_CONFERENCIA[status]}</Selo>
);
export const SeloSituacao = ({ situacao }: { situacao: Situacao }) => (
  <Selo cor={COR_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</Selo>
);

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      {texto}
    </div>
  );
}

export function MensagemErro({ texto, aoTentar }: { texto: string; aoTentar?: () => void }) {
  return (
    <div className="cartao flex flex-col items-start gap-3 border-vermelho/30 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-vermelho-700">{texto}</p>
      {aoTentar && (
        <Botao variante="secundario" tamanho="sm" onClick={aoTentar}>
          Tentar de novo
        </Botao>
      )}
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="cartao flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-medium text-zinc-800">{titulo}</p>
      {children && <div className="text-sm text-zinc-500">{children}</div>}
    </div>
  );
}
