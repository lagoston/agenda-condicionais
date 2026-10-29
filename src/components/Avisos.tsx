import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type TipoAviso = "sucesso" | "erro" | "info";
interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
}

interface AvisosContexto {
  avisar: (texto: string, tipo?: TipoAviso) => void;
  limpar: () => void;
}

const Contexto = createContext<AvisosContexto | null>(null);
let proximoId = 1;

const ESTILO: Record<TipoAviso, string> = {
  sucesso: "border-emerald-200 bg-white text-emerald-900",
  erro: "border-vermelho/40 bg-white text-vermelho-700",
  info: "border-marinho/20 bg-white text-marinho",
};

const ICONE: Record<TipoAviso, ReactNode> = {
  sucesso: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />,
  erro: <AlertTriangle className="h-5 w-5 shrink-0 text-vermelho" />,
  info: <Info className="h-5 w-5 shrink-0 text-marinho" />,
};

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const fechar = useCallback((id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

  const avisar = useCallback(
    (texto: string, tipo: TipoAviso = "info") => {
      const id = proximoId++;
      setAvisos((lista) => [...lista.slice(-3), { id, texto, tipo }]);
      window.setTimeout(() => fechar(id), tipo === "erro" ? 8000 : 4000);
    },
    [fechar],
  );

  const limpar = useCallback(() => setAvisos([]), []);

  return (
    <Contexto.Provider value={{ avisar, limpar }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[60] print:hidden flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === "erro" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${ESTILO[a.tipo]}`}
          >
            {ICONE[a.tipo]}
            <p className="flex-1 leading-snug">{a.texto}</p>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => fechar(a.id)}
              className="text-zinc-400 hover:text-zinc-700"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos(): AvisosContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAvisos fora do AvisosProvider");
  return ctx;
}
