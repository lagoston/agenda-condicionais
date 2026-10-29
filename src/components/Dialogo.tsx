// Janela de confirmação / formulário reutilizável.
// Uso: const { pedir } = useDialogo();
//      const r = await pedir({ titulo, campos: [...] });  // null se cancelar
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Botao } from "./ui";

export interface CampoDialogo {
  nome: string;
  rotulo: string;
  tipo?: "texto" | "textarea" | "senha" | "numero6" | "select";
  obrigatorio?: boolean;
  minimo?: number;
  valorInicial?: string;
  ajuda?: string;
  placeholder?: string;
  opcoes?: { valor: string; rotulo: string }[];
}

export interface OpcoesDialogo {
  titulo: string;
  descricao?: ReactNode;
  campos?: CampoDialogo[];
  confirmar?: string;
  cancelar?: string;
  perigo?: boolean;
}

export type RespostaDialogo = Record<string, string> | null;

interface DialogoContexto {
  pedir: (opcoes: OpcoesDialogo) => Promise<RespostaDialogo>;
  aberto: boolean;
}

const Contexto = createContext<DialogoContexto | null>(null);

interface Pedido {
  opcoes: OpcoesDialogo;
  resolver: (r: RespostaDialogo) => void;
}

export function DialogoProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const pedir = useCallback(
    (opcoes: OpcoesDialogo) =>
      new Promise<RespostaDialogo>((resolver) => {
        setPedido({ opcoes, resolver });
      }),
    [],
  );

  const responder = (r: RespostaDialogo) => {
    pedido?.resolver(r);
    setPedido(null);
  };

  return (
    <Contexto.Provider value={{ pedir, aberto: pedido !== null }}>
      {children}
      {pedido && <JanelaDialogo key={pedido.opcoes.titulo} opcoes={pedido.opcoes} aoResponder={responder} />}
    </Contexto.Provider>
  );
}

function validar(campo: CampoDialogo, valor: string): string | null {
  const v = valor.trim();
  if (campo.obrigatorio && !v) return "Preencha este campo.";
  if (campo.tipo === "numero6" && v && !/^\d{6}$/.test(v)) return "Use exatamente 6 dígitos.";
  if (campo.minimo && v && v.length < campo.minimo) return `Escreva pelo menos ${campo.minimo} caracteres.`;
  return null;
}

function JanelaDialogo({ opcoes, aoResponder }: { opcoes: OpcoesDialogo; aoResponder: (r: RespostaDialogo) => void }) {
  const campos = opcoes.campos ?? [];
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.nome, c.valorInicial ?? c.opcoes?.[0]?.valor ?? ""])),
  );
  const [erros, setErros] = useState<Record<string, string | null>>({});
  const primeiroRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const confirmarRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (primeiroRef.current) {
      primeiroRef.current.focus();
      if (primeiroRef.current instanceof HTMLInputElement) primeiroRef.current.select();
    } else {
      confirmarRef.current?.focus();
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        aoResponder(null);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoResponder]);

  function enviar(e?: FormEvent) {
    e?.preventDefault();
    const novosErros: Record<string, string | null> = {};
    let ok = true;
    for (const c of campos) {
      const erro = validar(c, valores[c.nome] ?? "");
      novosErros[c.nome] = erro;
      if (erro) ok = false;
    }
    setErros(novosErros);
    if (!ok) return;
    aoResponder(Object.fromEntries(campos.map((c) => [c.nome, (valores[c.nome] ?? "").trim()])));
  }

  const alterar = (nome: string, valor: string) => {
    setValores((v) => ({ ...v, [nome]: valor }));
    setErros((er) => ({ ...er, [nome]: null }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-marinho-900/50 p-4 sm:items-center">
      <div className="absolute inset-0" onClick={() => aoResponder(null)} aria-hidden />
      <form
        onSubmit={enviar}
        role="dialog"
        aria-modal="true"
        aria-label={opcoes.titulo}
        className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className={`h-1 ${opcoes.perigo ? "bg-vermelho" : "bg-marinho"}`} />
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-marinho">{opcoes.titulo}</h2>
          {opcoes.descricao && <div className="text-sm leading-relaxed text-zinc-600">{opcoes.descricao}</div>}

          {campos.map((c, i) => {
            const comum = {
              id: `campo-${c.nome}`,
              value: valores[c.nome] ?? "",
              placeholder: c.placeholder,
            };
            const definirRef = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => {
              if (i === 0) primeiroRef.current = el;
            };
            return (
              <div key={c.nome}>
                <label htmlFor={comum.id} className="rotulo">
                  {c.rotulo}
                </label>
                {c.tipo === "textarea" ? (
                  <textarea
                    {...comum}
                    ref={definirRef}
                    rows={3}
                    className="campo resize-none"
                    onChange={(e) => alterar(c.nome, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar();
                    }}
                  />
                ) : c.tipo === "select" ? (
                  <select
                    {...comum}
                    ref={definirRef}
                    className="campo"
                    onChange={(e) => alterar(c.nome, e.target.value)}
                  >
                    {c.opcoes?.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...comum}
                    ref={definirRef}
                    type={c.tipo === "senha" ? "password" : "text"}
                    inputMode={c.tipo === "numero6" ? "numeric" : undefined}
                    maxLength={c.tipo === "numero6" ? 6 : undefined}
                    autoComplete={c.tipo === "senha" ? "new-password" : "off"}
                    className={`campo ${c.tipo === "numero6" ? "numero text-lg" : ""}`}
                    onChange={(e) =>
                      alterar(c.nome, c.tipo === "numero6" ? e.target.value.replace(/\D/g, "") : e.target.value)
                    }
                  />
                )}
                {erros[c.nome] ? (
                  <p className="mt-1 text-xs text-vermelho-700">{erros[c.nome]}</p>
                ) : (
                  c.ajuda && <p className="mt-1 text-xs text-zinc-500">{c.ajuda}</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-5 py-3">
          <Botao variante="fantasma" onClick={() => aoResponder(null)}>
            {opcoes.cancelar ?? "Cancelar"}
          </Botao>
          <Botao ref={confirmarRef} type="submit" variante={opcoes.perigo ? "perigo" : "primario"}>
            {opcoes.confirmar ?? "Confirmar"}
          </Botao>
        </div>
      </form>
    </div>
  );
}

export function useDialogo(): DialogoContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useDialogo fora do DialogoProvider");
  return ctx;
}
