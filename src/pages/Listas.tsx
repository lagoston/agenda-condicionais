import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarPlus, ClipboardCheck, Plus } from "lucide-react";
import { useAvisos } from "../components/Avisos";
import { Botao, Carregando, MensagemErro, SeloStatusLista, Vazio } from "../components/ui";
import { abrirLista, listarListas } from "../lib/api";
import { usePerfil } from "../lib/auth";
import { diaDaSemana, formatarData, formatarHora, hojeISO } from "../lib/formatos";
import { ehFinanceiro, podeAbrirLista } from "../lib/permissoes";
import type { ListaResumo } from "../lib/tipos";
import { useAoFocar } from "../lib/useAoFocar";

function LinhaLista({ l }: { l: ListaResumo }) {
  const conferenciaFeita = l.status === "conferida";
  return (
    <Link
      to={`/lista/${l.data}`}
      className="grid grid-cols-1 gap-x-6 gap-y-1 px-4 py-3 transition-colors hover:bg-marinho-50/60 sm:grid-cols-[9rem_1fr_auto] sm:items-center"
    >
      <div>
        <p className="font-semibold text-marinho">{formatarData(l.data)}</p>
        <p className="text-xs text-zinc-500">{diaDaSemana(l.data)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
        <SeloStatusLista status={l.status} />
        <span>
          <b className="font-semibold text-zinc-800">{l.total}</b> condicionais
        </span>
        {l.status !== "rascunho" && (
          <span>
            {l.conferidas}/{l.total} conferidas
            {l.nao_recebidas > 0 && (
              <b className="ml-1 font-semibold text-vermelho-700">· {l.nao_recebidas} não recebida(s)</b>
            )}
          </span>
        )}
        {l.status !== "rascunho" && (
          <span className="text-zinc-500">
            Pagas: {l.pagas} · Canceladas: {l.canceladas} · Em aberto: {l.em_aberto}
          </span>
        )}
      </div>
      <div className="text-xs text-zinc-500 sm:text-right">
        <p>Lançada por {l.criada_por_nome}</p>
        {conferenciaFeita && (
          <p>
            Conferida por <b className="font-medium text-zinc-700">{l.conferida_por_nome}</b> às{" "}
            {formatarHora(l.conferida_em)}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function Listas() {
  const perfil = usePerfil();
  const navegar = useNavigate();
  const { avisar } = useAvisos();
  const [listas, setListas] = useState<ListaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const hoje = hojeISO();
  const [outraData, setOutraData] = useState(hoje);

  const carregar = useCallback(async () => {
    try {
      setListas(await listarListas(120));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);
  useAoFocar(() => void carregar(), 30_000);

  async function abrir(data: string) {
    if (!data) return;
    setAbrindo(true);
    try {
      await abrirLista(data);
      navegar(`/lista/${data}`);
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setAbrindo(false);
    }
  }

  if (erro && !listas) return <MensagemErro texto={erro} aoTentar={() => void carregar()} />;
  if (!listas) return <Carregando />;

  const listaHoje = listas.find((l) => l.data === hoje);
  const aguardando = listas.filter((l) => l.status === "enviada");
  const podeAbrir = podeAbrirLista(perfil.papel);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">
          {diaDaSemana(hoje)}, {formatarData(hoje)}
        </p>
        <h1 className="text-2xl font-semibold text-marinho">Listas de condicionais</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Hoje */}
        <div className="cartao flex flex-col justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Hoje</p>
            {listaHoje ? (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <p className="text-lg font-semibold text-marinho">{listaHoje.total} condicionais</p>
                <SeloStatusLista status={listaHoje.status} />
              </div>
            ) : (
              <p className="mt-1 text-lg font-semibold text-zinc-400">Lista ainda não começou</p>
            )}
          </div>
          {listaHoje ? (
            <Botao onClick={() => navegar(`/lista/${hoje}`)} className="self-start">
              Abrir lista de hoje
              <ArrowRight className="h-4 w-4" />
            </Botao>
          ) : podeAbrir ? (
            <Botao onClick={() => void abrir(hoje)} carregando={abrindo} className="self-start" tamanho="lg">
              <Plus className="h-5 w-5" />
              Começar a lista de hoje
            </Botao>
          ) : (
            <p className="text-sm text-zinc-500">A expedição ainda não lançou a lista de hoje.</p>
          )}
        </div>

        {/* Aguardando conferência / outra data */}
        {ehFinanceiro(perfil.papel) ? (
          <div className="cartao p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Aguardando conferência</p>
            {aguardando.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                <ClipboardCheck className="h-4 w-4 text-emerald-600" /> Nenhuma lista esperando por você.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {aguardando.map((l) => (
                  <li key={l.id}>
                    <Link
                      to={`/lista/${l.data}`}
                      className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-sm ring-1 ring-amber-200 hover:bg-amber-100"
                    >
                      <span>
                        <b className="font-semibold text-marinho">{formatarData(l.data)}</b>{" "}
                        <span className="text-zinc-500">({diaDaSemana(l.data)})</span>
                      </span>
                      <span className="text-zinc-700">
                        {l.conferidas}/{l.total} conferidas <ArrowRight className="ml-1 inline h-4 w-4" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {podeAbrir && (
          <div className="cartao p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Lançar outra data</p>
            <div className="mt-2 flex gap-2">
              <input
                type="date"
                value={outraData}
                max={hoje}
                onChange={(e) => setOutraData(e.target.value)}
                className="campo"
                aria-label="Data da lista"
              />
              <Botao variante="secundario" onClick={() => void abrir(outraData)} carregando={abrindo}>
                <CalendarPlus className="h-4 w-4" />
                Abrir
              </Botao>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">Se a lista dessa data já existir, ela é aberta.</p>
          </div>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Últimas listas</h2>
        {listas.length === 0 ? (
          <Vazio titulo="Nenhuma lista lançada ainda." />
        ) : (
          <div className="cartao divide-y divide-zinc-100 overflow-hidden">
            {listas.map((l) => (
              <LinhaLista key={l.id} l={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
