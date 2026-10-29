import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, CalendarPlus, ClipboardCheck, Plus } from "lucide-react";
import { useAvisos } from "../components/Avisos";
import { Botao, Carregando, MensagemErro, SeloModalidade, SeloStatusLista, Vazio } from "../components/ui";
import { abrirLista, listarListas } from "../lib/api";
import { usePerfil } from "../lib/auth";
import { caminhoLista, diaDaSemana, formatarData, formatarHora, hojeISO, ROTULO_MODALIDADE } from "../lib/formatos";
import { ehFinanceiro, modalidadesQuePodeAbrir, podeAbrirLista } from "../lib/permissoes";
import type { ListaResumo, Modalidade, Papel } from "../lib/tipos";
import { useAoFocar } from "../lib/useAoFocar";

function LinhaLista({ l }: { l: ListaResumo }) {
  const ehBalcao = l.modalidade === "balcao";
  const mostrarSituacao = ehBalcao || l.status !== "rascunho";
  return (
    <Link
      to={caminhoLista(l.modalidade, l.data)}
      className="grid grid-cols-1 gap-x-6 gap-y-1 px-4 py-3 transition-colors hover:bg-marinho-50/60 sm:grid-cols-[13rem_1fr_auto] sm:items-center"
    >
      <div className="flex items-center gap-3">
        <SeloModalidade modalidade={l.modalidade} />
        <div>
          <p className="font-semibold text-marinho">{formatarData(l.data)}</p>
          <p className="text-xs text-zinc-500">{diaDaSemana(l.data)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
        <SeloStatusLista status={l.status} modalidade={l.modalidade} />
        <span>
          <b className="font-semibold text-zinc-800">{l.total}</b> condicionais
        </span>
        {!ehBalcao && l.status !== "rascunho" && (
          <span>
            {l.conferidas}/{l.total} conferidas
            {l.nao_recebidas > 0 && (
              <b className="ml-1 font-semibold text-vermelho-700">· {l.nao_recebidas} não recebida(s)</b>
            )}
          </span>
        )}
        {mostrarSituacao && (
          <span className="text-zinc-500">
            Pagas: {l.pagas} · Canceladas: {l.canceladas} · Em aberto: {l.em_aberto}
          </span>
        )}
      </div>
      <div className="text-xs text-zinc-500 sm:text-right">
        <p>Lançada por {l.criada_por_nome}</p>
        {l.status === "conferida" && (
          <p>
            {ehBalcao ? "Fechada" : "Conferida"} por <b className="font-medium text-zinc-700">{l.conferida_por_nome}</b>{" "}
            às {formatarHora(l.conferida_em)}
          </p>
        )}
      </div>
    </Link>
  );
}

function CartaoHoje({
  modalidade,
  lista,
  papel,
  abrindo,
  aoAbrir,
}: {
  modalidade: Modalidade;
  lista: ListaResumo | undefined;
  papel: Papel;
  abrindo: boolean;
  aoAbrir: () => void;
}) {
  const navegar = useNavigate();
  const hoje = hojeISO();
  return (
    <div className="cartao flex flex-col justify-between gap-4 p-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SeloModalidade modalidade={modalidade} grande />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Hoje</span>
        </div>
        {lista ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg font-semibold text-marinho">{lista.total} condicionais</p>
            <SeloStatusLista status={lista.status} modalidade={lista.modalidade} />
          </div>
        ) : (
          <p className="text-lg font-semibold text-zinc-400">Lista ainda não começou</p>
        )}
      </div>
      {lista ? (
        <Botao onClick={() => navegar(caminhoLista(modalidade, hoje))} className="self-start">
          Abrir lista de {ROTULO_MODALIDADE[modalidade]}
          <ArrowRight className="h-4 w-4" />
        </Botao>
      ) : podeAbrirLista(papel, modalidade) ? (
        <Botao onClick={aoAbrir} carregando={abrindo} className="self-start" tamanho="lg">
          <Plus className="h-5 w-5" />
          Começar lista de {ROTULO_MODALIDADE[modalidade]}
        </Botao>
      ) : (
        <p className="text-sm text-zinc-500">
          {modalidade === "entrega"
            ? "A expedição ainda não lançou a lista de entregas de hoje."
            : "O financeiro ainda não lançou a lista do balcão de hoje."}
        </p>
      )}
    </div>
  );
}

type Filtro = "todas" | Modalidade;

export default function Listas() {
  const perfil = usePerfil();
  const navegar = useNavigate();
  const { avisar } = useAvisos();
  const [listas, setListas] = useState<ListaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<Modalidade | "outra" | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const hoje = hojeISO();
  const modalidadesPermitidas = modalidadesQuePodeAbrir(perfil.papel);
  const [outraData, setOutraData] = useState(hoje);
  const [outraModalidade, setOutraModalidade] = useState<Modalidade>(modalidadesPermitidas[0] ?? "entrega");

  const carregar = useCallback(async () => {
    try {
      setListas(await listarListas(200));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);
  useAoFocar(() => void carregar(), 30_000);

  async function abrir(data: string, modalidade: Modalidade, origem: Modalidade | "outra") {
    if (!data) return;
    setAbrindo(origem);
    try {
      await abrirLista(data, modalidade);
      navegar(caminhoLista(modalidade, data));
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setAbrindo(null);
    }
  }

  // Pendências: listas que precisam de atenção de quem está logado
  const pendencias = useMemo(() => {
    if (!listas) return [];
    return listas.filter((l) => {
      if (l.modalidade === "entrega" && l.status === "enviada") return ehFinanceiro(perfil.papel);
      if (l.modalidade === "entrega" && l.status === "rascunho" && l.data < hoje)
        return perfil.papel === "expedicao" || perfil.papel === "admin";
      if (l.modalidade === "balcao" && l.status === "rascunho" && l.data < hoje) return ehFinanceiro(perfil.papel);
      return false;
    });
  }, [listas, perfil.papel, hoje]);

  if (erro && !listas) return <MensagemErro texto={erro} aoTentar={() => void carregar()} />;
  if (!listas) return <Carregando />;

  const deHoje = (m: Modalidade) => listas.find((l) => l.data === hoje && l.modalidade === m);
  const filtradas = filtro === "todas" ? listas : listas.filter((l) => l.modalidade === filtro);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">
          {diaDaSemana(hoje)}, {formatarData(hoje)}
        </p>
        <h1 className="text-2xl font-semibold text-marinho">Listas de condicionais</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(["entrega", "balcao"] as Modalidade[]).map((m) => (
          <CartaoHoje
            key={m}
            modalidade={m}
            lista={deHoje(m)}
            papel={perfil.papel}
            abrindo={abrindo === m}
            aoAbrir={() => void abrir(hoje, m, m)}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="cartao p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Precisa da sua atenção</p>
          {pendencias.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
              <ClipboardCheck className="h-4 w-4 text-emerald-600" /> Nada pendente para você.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {pendencias.map((l) => (
                <li key={l.id}>
                  <Link
                    to={caminhoLista(l.modalidade, l.data)}
                    className="flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm ring-1 ring-amber-200 hover:bg-amber-100"
                  >
                    <span className="flex items-center gap-2">
                      <SeloModalidade modalidade={l.modalidade} />
                      <b className="font-semibold text-marinho">{formatarData(l.data)}</b>
                    </span>
                    <span className="flex items-center gap-1 text-zinc-700">
                      {l.modalidade === "entrega" && l.status === "enviada" && (
                        <>
                          Conferir ({l.conferidas}/{l.total})
                        </>
                      )}
                      {l.modalidade === "entrega" && l.status === "rascunho" && (
                        <>
                          <AlertCircle className="h-4 w-4 text-amber-600" /> Não foi enviada
                        </>
                      )}
                      {l.modalidade === "balcao" && (
                        <>
                          <AlertCircle className="h-4 w-4 text-amber-600" /> Não foi fechada
                        </>
                      )}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {modalidadesPermitidas.length > 0 && (
          <div className="cartao p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Lançar outra data</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {modalidadesPermitidas.length > 1 && (
                <select
                  value={outraModalidade}
                  onChange={(e) => setOutraModalidade(e.target.value as Modalidade)}
                  className="campo w-auto"
                  aria-label="Modalidade"
                >
                  {modalidadesPermitidas.map((m) => (
                    <option key={m} value={m}>
                      {ROTULO_MODALIDADE[m]}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="date"
                value={outraData}
                max={hoje}
                onChange={(e) => setOutraData(e.target.value)}
                className="campo w-auto flex-1"
                aria-label="Data da lista"
              />
              <Botao
                variante="secundario"
                onClick={() => void abrir(outraData, outraModalidade, "outra")}
                carregando={abrindo === "outra"}
              >
                <CalendarPlus className="h-4 w-4" />
                Abrir
              </Botao>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              {modalidadesPermitidas.length === 1
                ? `Lista de ${ROTULO_MODALIDADE[modalidadesPermitidas[0]]}. Se já existir nessa data, ela é aberta.`
                : "Se a lista dessa data já existir, ela é aberta."}
            </p>
          </div>
        )}
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Últimas listas</h2>
          <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 bg-white text-sm">
            {(["todas", "entrega", "balcao"] as Filtro[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  filtro === f ? "bg-marinho text-white" : "text-zinc-600 hover:bg-marinho-50"
                } ${f !== "todas" ? "border-l border-zinc-300" : ""}`}
              >
                {f === "todas" ? "Todas" : ROTULO_MODALIDADE[f]}
              </button>
            ))}
          </div>
        </div>
        {filtradas.length === 0 ? (
          <Vazio titulo="Nenhuma lista lançada ainda." />
        ) : (
          <div className="cartao divide-y divide-zinc-100 overflow-hidden">
            {filtradas.map((l) => (
              <LinhaLista key={l.id} l={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
