import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { CornerDownLeft } from "lucide-react";

interface Props {
  /** Números já validados localmente (1 digitado ou vários colados) */
  aoAdicionar: (numeros: string[]) => void;
  /** número -> linha em que já aparece nesta lista */
  existentes: Map<string, number>;
  autoFoco?: boolean;
  dica?: string;
}

/** Campo de lançamento: digita 6 dígitos + Enter, ou cola uma coluna do Excel */
export function EntradaNumeros({ aoAdicionar, existentes, autoFoco = true, dica }: Props) {
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [tremor, setTremor] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFoco) ref.current?.focus();
  }, [autoFoco]);

  function falhar(mensagem: string) {
    setErro(mensagem);
    setTremor((t) => t + 1);
  }

  function confirmar(e: FormEvent) {
    e.preventDefault();
    const numero = valor.trim();
    if (!numero) return;
    if (!/^\d{6}$/.test(numero)) return falhar("O número precisa ter exatamente 6 dígitos.");
    const linha = existentes.get(numero);
    if (linha) return falhar(`${numero} já está nesta lista (linha ${linha}).`);
    aoAdicionar([numero]);
    setValor("");
    setErro(null);
  }

  function aoColar(e: ClipboardEvent<HTMLInputElement>) {
    // "306.785" (formato de milhar do Excel) vira "306785"
    const texto = e.clipboardData.getData("text").replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2");
    const numeros = texto.match(/\d+/g) ?? [];
    if (numeros.length <= 1) return; // um número só: cola normalmente no campo
    e.preventDefault();
    aoAdicionar(numeros);
    setValor("");
    setErro(null);
  }

  return (
    <form onSubmit={confirmar}>
      <div key={tremor} className={`flex items-stretch gap-2 ${tremor ? "tremer" : ""}`}>
        <input
          ref={ref}
          value={valor}
          onChange={(e) => {
            setValor(e.target.value.replace(/\D/g, "").slice(0, 6));
            setErro(null);
          }}
          onPaste={aoColar}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Número da condicional"
          aria-label="Número da condicional"
          className={`numero h-14 w-full rounded-lg border-2 bg-white px-4 text-2xl text-marinho shadow-sm placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-zinc-400 focus:outline-none focus:ring-4 ${
            erro
              ? "border-vermelho focus:ring-vermelho/15"
              : "border-marinho/30 focus:border-marinho focus:ring-marinho/10"
          }`}
        />
        <button
          type="submit"
          className="inline-flex h-14 shrink-0 items-center gap-2 rounded-lg bg-marinho px-5 font-medium text-white hover:bg-marinho-700"
        >
          <CornerDownLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Lançar</span>
        </button>
      </div>
      <p className={`mt-1.5 text-sm ${erro ? "text-vermelho-700" : "text-zinc-500"}`}>
        {erro ?? dica ?? "Digite os 6 dígitos e tecle Enter. Também dá para colar uma coluna inteira do Excel."}
      </p>
    </form>
  );
}
