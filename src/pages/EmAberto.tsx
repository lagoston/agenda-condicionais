import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { History } from "lucide-react";
import { BotoesSituacao } from "../components/BotoesSituacao";
import { PainelHistorico, type PedidoHistorico } from "../components/Historico";
import { Carregando, MensagemErro, SeloConferencia, SeloModalidade, Vazio } from "../components/ui";
import { historicoDeRegistros, listarEmAberto } from "../lib/api";
import { caminhoLista, diasEntre, formatarData, hojeISO } from "../lib/formatos";
import type { Condicional, Situacao } from "../lib/tipos";
import { useSituacao } from "../lib/useSituacao";

function corDias(dias: number): string {
  if (dias >= 30) return "text-vermelho-700 font-semibold";
  if (dias >= 15) return "text-amber-700 font-medium";
  return "text-zinc-600";
}

export default function EmAberto() {
  const alterarSituacao = useSituacao();
  const [itens, setItens] = useState<Condicional[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [historico, setHistorico] = useState<PedidoHistorico | null>(null);
  const hoje = hojeISO();

  const carregar = useCallback(async () => {
    try {
      setItens(await listarEmAberto());
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => (itens ?? []).filter((c) => !filtro || c.numero.includes(filtro)), [itens, filtro]);

  async function situacao(c: Condicional, s: Situacao) {
    const linha = await alterarSituacao(c, s);
    if (linha && linha.situacao !== "em_aberto") {
      setItens((lista) => (lista ?? []).filter((x) => x.id !== c.id));
    }
  }

  const fecharHistorico = useCallback(() => setHistorico(null), []);

  if (erro && !itens) return <MensagemErro texto={erro} aoTentar={() => void carregar()} />;
  if (!itens) return <Carregando />;

  const maisAntiga = itens[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-marinho">Condicionais em aberto</h1>
          <p className="text-sm text-zinc-500">
            <b className="text-zinc-800">{itens.length}</b> não conferidas, nem pagas, nem canceladas
            {maisAntiga && (
              <>
                {" "}
                · a mais antiga é de {formatarData(maisAntiga.lista_data)} ({diasEntre(maisAntiga.lista_data, hoje)}{" "}
                dias)
              </>
            )}
          </p>
        </div>
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="Filtrar por número"
          className="campo numero w-56"
        />
      </div>

      {filtrados.length === 0 ? (
        <Vazio
          titulo={itens.length === 0 ? "Nenhuma condicional em aberto." : "Nenhuma condicional com esse número."}
        />
      ) : (
        <div className="cartao overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="py-2.5 pl-4 pr-4">Número</th>
                <th className="py-2.5 pr-4">Lista</th>
                <th className="py-2.5 pr-4">Dias</th>
                <th className="py-2.5 pr-4">Conferência</th>
                <th className="py-2.5 pr-4">Situação</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const dias = diasEntre(c.lista_data, hoje);
                return (
                  <tr key={c.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/70">
                    <td className="py-2.5 pl-4 pr-4">
                      <span
                        className={`numero text-lg font-medium text-marinho ${c.conferencia === "conferida" ? "grifo" : ""}`}
                      >
                        {c.numero}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-sm">
                      <Link
                        to={caminhoLista(c.lista_modalidade, c.lista_data)}
                        className="inline-flex items-center gap-2 text-marinho underline-offset-2 hover:underline"
                      >
                        <SeloModalidade modalidade={c.lista_modalidade} />
                        {formatarData(c.lista_data)}
                      </Link>
                    </td>
                    <td className={`py-2.5 pr-4 text-sm tabular-nums ${corDias(dias)}`}>{dias}</td>
                    <td className="py-2.5 pr-4">
                      <SeloConferencia status={c.conferencia} />
                    </td>
                    <td className="py-2.5 pr-4">
                      <BotoesSituacao situacao={c.situacao} aoEscolher={(s) => void situacao(c, s)} />
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <button
                        type="button"
                        title="Histórico"
                        aria-label="Histórico"
                        onClick={() =>
                          setHistorico({
                            titulo: `Condicional ${c.numero}`,
                            carregar: () => historicoDeRegistros([c.id]),
                          })
                        }
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-marinho-50 hover:text-marinho"
                      >
                        <History className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {historico && <PainelHistorico pedido={historico} aoFechar={fecharHistorico} />}
    </div>
  );
}
