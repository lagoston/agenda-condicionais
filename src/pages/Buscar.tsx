import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, ShieldCheck, ShieldAlert } from "lucide-react";
import { LinhaDoTempo } from "../components/Historico";
import { Botao, Carregando, MensagemErro, SeloConferencia, SeloSituacao, Vazio } from "../components/ui";
import { buscarCondicionais, historicoDeRegistros } from "../lib/api";
import { formatarData, formatarDataHora } from "../lib/formatos";
import type { Condicional, EventoHistorico } from "../lib/tipos";

/** Responde à pergunta "quem viu essa condicional por último?" */
function ResumoCustodia({ c }: { c: Condicional }) {
  let icone = <ShieldCheck className="h-6 w-6 text-emerald-600" />;
  let texto: ReactNode;

  if (c.removida) {
    icone = <ShieldAlert className="h-6 w-6 text-zinc-500" />;
    texto = (
      <>
        Removida da lista por <b>{c.removida_por_nome}</b> em {formatarDataHora(c.removida_em)}
        {c.motivo_remocao ? <> — “{c.motivo_remocao}”</> : null}.
      </>
    );
  } else if (c.conferencia === "conferida") {
    texto = (
      <>
        Último a ver: <b>{c.conferida_por_nome}</b>, que conferiu (grifou) em {formatarDataHora(c.conferida_em)}.
      </>
    );
  } else if (c.conferencia === "nao_recebida") {
    icone = <ShieldAlert className="h-6 w-6 text-vermelho" />;
    texto = (
      <>
        <b className="text-vermelho-700">Não recebida</b> na conferência de <b>{c.conferida_por_nome}</b> (
        {formatarDataHora(c.conferida_em)}). Último registro antes disso: lançada por <b>{c.criada_por_nome}</b>.
      </>
    );
  } else if (c.lista_status === "rascunho") {
    icone = <ShieldAlert className="h-6 w-6 text-amber-500" />;
    texto = (
      <>
        Ainda em lançamento: lançada por <b>{c.criada_por_nome}</b> em {formatarDataHora(c.criada_em)}.
      </>
    );
  } else {
    icone = <ShieldAlert className="h-6 w-6 text-amber-500" />;
    texto = (
      <>
        Aguardando conferência. Último registro: lançada por <b>{c.criada_por_nome}</b>.
      </>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
      {icone}
      <p className="pt-0.5">{texto}</p>
    </div>
  );
}

function CartaoCondicional({ c, eventos }: { c: Condicional; eventos: EventoHistorico[] | null }) {
  return (
    <div className="cartao space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className={`numero text-3xl font-semibold ${
              c.removida
                ? "text-zinc-400 line-through"
                : c.conferencia === "conferida"
                  ? "grifo text-marinho"
                  : "text-marinho"
            }`}
          >
            {c.numero}
          </p>
          <Link to={`/lista/${c.lista_data}`} className="text-sm text-marinho underline-offset-2 hover:underline">
            Lista de {formatarData(c.lista_data)}
          </Link>
        </div>
        <div className="flex gap-2">
          <SeloConferencia status={c.conferencia} />
          <SeloSituacao situacao={c.situacao} />
        </div>
      </div>
      <ResumoCustodia c={c} />
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Histórico completo</p>
        {eventos ? <LinhaDoTempo eventos={eventos} /> : <Carregando />}
      </div>
    </div>
  );
}

export default function Buscar() {
  const [params, setParams] = useSearchParams();
  const termoUrl = params.get("n") ?? "";
  const [termo, setTermo] = useState(termoUrl);
  const [resultados, setResultados] = useState<Condicional[] | null>(null);
  const [eventos, setEventos] = useState<Record<string, EventoHistorico[]>>({});
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => setTermo(termoUrl), [termoUrl]);

  useEffect(() => {
    if (!/^\d{3,6}$/.test(termoUrl)) {
      setResultados(null);
      return;
    }
    let ativo = true;
    setBuscando(true);
    setErro(null);
    setSelecionada(null);
    buscarCondicionais(termoUrl)
      .then(async (r) => {
        if (!ativo) return;
        setResultados(r);
        // Carrega o histórico direto quando há poucos resultados
        if (r.length > 0 && r.length <= 5) {
          const evs = await historicoDeRegistros(r.map((c) => c.id));
          if (!ativo) return;
          const porId: Record<string, EventoHistorico[]> = {};
          for (const ev of evs) (porId[ev.entidade_id] ??= []).push(ev);
          setEventos(porId);
        }
      })
      .catch((e: Error) => ativo && setErro(e.message))
      .finally(() => ativo && setBuscando(false));
    return () => {
      ativo = false;
    };
  }, [termoUrl]);

  async function selecionar(c: Condicional) {
    setSelecionada(c.id);
    if (!eventos[c.id]) {
      try {
        const evs = await historicoDeRegistros([c.id]);
        setEventos((e) => ({ ...e, [c.id]: evs }));
      } catch (e) {
        setErro((e as Error).message);
      }
    }
  }

  function buscar(e: FormEvent) {
    e.preventDefault();
    if (/^\d{3,6}$/.test(termo)) setParams({ n: termo });
  }

  const poucos = resultados !== null && resultados.length <= 5;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-marinho">Buscar condicional</h1>
      <form onSubmit={buscar} className="flex max-w-lg gap-2">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoFocus
          placeholder="Número (ou começo do número)"
          className="numero h-12 w-full rounded-lg border-2 border-marinho/30 bg-white px-4 text-xl text-marinho placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-zinc-400 focus:border-marinho focus:outline-none"
        />
        <Botao type="submit" tamanho="lg" disabled={!/^\d{3,6}$/.test(termo)}>
          <Search className="h-5 w-5" />
          Buscar
        </Botao>
      </form>
      <p className="-mt-4 text-sm text-zinc-500">
        Digite os 6 dígitos para ver o histórico completo, ou pelo menos 3 para listar parecidas.
      </p>

      {erro && <MensagemErro texto={erro} />}
      {buscando && <Carregando texto="Buscando…" />}

      {!buscando && resultados !== null && resultados.length === 0 && (
        <Vazio titulo={`Nenhuma condicional encontrada com “${termoUrl}”.`}>
          Confira o número. Se ela nunca foi lançada em nenhuma lista, não aparece aqui.
        </Vazio>
      )}

      {!buscando && resultados && poucos && (
        <div className="space-y-4">
          {resultados.map((c) => (
            <CartaoCondicional key={c.id} c={c} eventos={eventos[c.id] ?? null} />
          ))}
        </div>
      )}

      {!buscando && resultados && !poucos && (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <div className="cartao max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto">
            {resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void selecionar(c)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-marinho-50 ${
                  selecionada === c.id ? "bg-marinho-50" : ""
                }`}
              >
                <span className={`numero font-medium ${c.removida ? "text-zinc-400 line-through" : "text-marinho"}`}>
                  {c.numero}
                </span>
                <span className="text-xs text-zinc-500">{formatarData(c.lista_data)}</span>
              </button>
            ))}
          </div>
          <div>
            {selecionada ? (
              <CartaoCondicional
                c={resultados.find((c) => c.id === selecionada)!}
                eventos={eventos[selecionada] ?? null}
              />
            ) : (
              <Vazio titulo={`${resultados.length} resultados`}>Escolha uma condicional à esquerda.</Vazio>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
