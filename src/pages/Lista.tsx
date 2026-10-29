import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Signature,
  Trash2,
  X,
} from "lucide-react";
import { useAvisos } from "../components/Avisos";
import { useDialogo } from "../components/Dialogo";
import { EntradaNumeros } from "../components/EntradaNumeros";
import { FolhaImpressao, type ModeloImpressao } from "../components/FolhaImpressao";
import { PainelHistorico, type PedidoHistorico } from "../components/Historico";
import { TabelaCondicionais, TabelaRemovidas, type Temporario } from "../components/TabelaCondicionais";
import { Botao, Carregando, MensagemErro, SeloModalidade, SeloStatusLista, Vazio } from "../components/ui";
import {
  abrirLista,
  adicionarCondicionais,
  assinarConferencia,
  buscarListaPorData,
  editarNumero,
  enviarLista,
  historicoDaLista,
  historicoDeRegistros,
  listarCondicionais,
  marcarConferencia,
  reabrirConferencia,
  removerCondicional,
  resetarLista,
} from "../lib/api";
import { usePerfil } from "../lib/auth";
import {
  caminhoLista,
  diaDaSemana,
  formatarData,
  formatarDataHora,
  hojeISO,
  ROTULO_MODALIDADE,
  somarDias,
} from "../lib/formatos";
import {
  exigeMotivo,
  podeAbrirLista,
  podeAlterarSituacao,
  podeAssinar,
  podeConferir,
  podeEditarItens,
  podeEnviar,
  podeReabrir,
} from "../lib/permissoes";
import type { Condicional, ListaResumo, Modalidade, ResultadoLancamento, Situacao } from "../lib/tipos";
import { useAoFocar } from "../lib/useAoFocar";
import { useSituacao } from "../lib/useSituacao";

function Contador({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: "vermelho" | "verde" }) {
  const cor = destaque === "vermelho" ? "text-vermelho" : destaque === "verde" ? "text-emerald-700" : "text-marinho";
  return (
    <div className="cartao min-w-[7.5rem] flex-1 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{rotulo}</p>
      <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${cor}`}>{valor}</p>
    </div>
  );
}

function Tecla({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded border border-zinc-300 border-b-2 bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-zinc-700">
      {children}
    </kbd>
  );
}

export default function Lista() {
  const { modalidade: modalidadeUrl = "", data = "" } = useParams();
  const modalidade: Modalidade = modalidadeUrl === "balcao" ? "balcao" : "entrega";
  const outraModalidade: Modalidade = modalidade === "balcao" ? "entrega" : "balcao";
  const ehBalcao = modalidade === "balcao";
  const perfil = usePerfil();
  const { avisar } = useAvisos();
  const { pedir, aberto: dialogoAberto } = useDialogo();
  const alterarSituacao = useSituacao();
  const hoje = hojeISO();
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data) && (modalidadeUrl === "entrega" || modalidadeUrl === "balcao");

  const [lista, setLista] = useState<ListaResumo | null | undefined>(undefined);
  const [itens, setItens] = useState<Condicional[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [temporarios, setTemporarios] = useState<Temporario[]>([]);
  const [falhas, setFalhas] = useState<ResultadoLancamento[]>([]);
  const [destaque, setDestaque] = useState<string | null>(null);
  const [mostrarRemovidas, setMostrarRemovidas] = useState(false);
  const [mostrarEntradaExtra, setMostrarEntradaExtra] = useState(false);
  const [historico, setHistorico] = useState<PedidoHistorico | null>(null);
  const [salvando, setSalvando] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [modeloImpressao, setModeloImpressao] = useState<ModeloImpressao>("em_branco");

  const cursorRef = useRef(0);
  const ativosRef = useRef<Condicional[]>([]);
  const pilhaRef = useRef<string[]>([]); // condicionais marcadas pelo teclado (para desfazer)
  const filasRef = useRef(new Map<string, Promise<void>>());
  const versoesRef = useRef(new Map<string, number>());
  const filaLancamentoRef = useRef<Promise<void>>(Promise.resolve());
  const linhasRef = useRef(new Map<string, HTMLTableRowElement>());
  const cursorIniciadoRef = useRef<string | null>(null);
  const mutacoesRef = useRef(0);
  const listaIdRef = useRef<string | null>(null);
  const bloqueioRef = useRef({ dialogo: false, historico: false, salvando: 0, temporarios: 0 });

  listaIdRef.current = lista?.id ?? null;
  bloqueioRef.current = {
    dialogo: dialogoAberto,
    historico: historico !== null,
    salvando,
    temporarios: temporarios.length,
  };

  // ------------------------------------------------------------------ Carregamento
  const recarregarItens = useCallback(async (listaId: string) => {
    setItens(await listarCondicionais(listaId));
  }, []);

  const recarregar = useCallback(
    async (silencioso = false) => {
      if (!dataValida) return;
      const marca = mutacoesRef.current;
      try {
        const l = await buscarListaPorData(data, modalidade);
        const novos = l ? await listarCondicionais(l.id) : [];
        // Se o usuário mexeu em algo enquanto carregava, não sobrescreve a tela
        if (silencioso && marca !== mutacoesRef.current) return;
        setLista(l);
        setItens(novos);
        setErro(null);
      } catch (e) {
        if (!silencioso) setErro((e as Error).message);
      }
    },
    [data, modalidade, dataValida],
  );

  useEffect(() => {
    setLista(undefined);
    setItens([]);
    setErro(null);
    setFalhas([]);
    pilhaRef.current = [];
    cursorIniciadoRef.current = null;
    void recarregar();
  }, [recarregar]);

  // ------------------------------------------------------------------ Estado derivado
  const ativos = useMemo(() => itens.filter((c) => !c.removida), [itens]);
  const removidas = useMemo(() => itens.filter((c) => c.removida), [itens]);
  ativosRef.current = ativos;
  const existentes = useMemo(() => new Map(ativos.map((c, i) => [c.numero, i + 1])), [ativos]);

  const conferenciaIniciada = ativos.some((c) => c.conferencia !== "pendente");
  const modoConferencia = !!lista && podeConferir(perfil.papel, lista);
  const editavel = !!lista && podeEditarItens(perfil.papel, lista, conferenciaIniciada);
  const situacaoEditavel = !!lista && podeAlterarSituacao(lista);
  const motivoObrigatorio = !!lista && exigeMotivo(lista);
  const cursorSeguro = Math.min(cursor, Math.max(ativos.length - 1, 0));

  const contagem = useMemo(
    () => ({
      total: ativos.length,
      conferidas: ativos.filter((c) => c.conferencia === "conferida").length,
      pendentes: ativos.filter((c) => c.conferencia === "pendente").length,
      naoRecebidas: ativos.filter((c) => c.conferencia === "nao_recebida").length,
      pagas: ativos.filter((c) => c.situacao === "paga").length,
      canceladas: ativos.filter((c) => c.situacao === "cancelada").length,
      emAberto: ativos.filter((c) => c.situacao === "em_aberto").length,
    }),
    [ativos],
  );

  // Atualiza sozinho quando a janela volta ao foco (e a cada 30s fora da conferência),
  // mas nunca no meio de uma marcação, lançamento ou janela aberta.
  useAoFocar(
    () => {
      const b = bloqueioRef.current;
      if (b.dialogo || b.historico || b.salvando > 0 || b.temporarios > 0) return;
      void recarregar(true);
    },
    modoConferencia ? 0 : 30_000,
  );

  // ------------------------------------------------------------------ Cursor da conferência
  const irPara = useCallback((indice: number) => {
    cursorRef.current = indice;
    setCursor(indice);
  }, []);

  useEffect(() => {
    if (!modoConferencia || !lista || ativos.length === 0) return;
    if (cursorIniciadoRef.current === lista.id) return;
    cursorIniciadoRef.current = lista.id;
    const primeiraPendente = ativos.findIndex((c) => c.conferencia === "pendente");
    irPara(primeiraPendente >= 0 ? primeiraPendente : 0);
  }, [modoConferencia, lista, ativos, irPara]);

  const idAtual = modoConferencia ? ativos[cursorSeguro]?.id : undefined;
  useEffect(() => {
    if (idAtual) linhasRef.current.get(idAtual)?.scrollIntoView({ block: "nearest" });
  }, [idAtual]);

  // Rola até a condicional recém-lançada e apaga o destaque depois
  useEffect(() => {
    if (!destaque) return;
    const c = ativosRef.current.find((x) => x.numero === destaque);
    if (c) linhasRef.current.get(c.id)?.scrollIntoView({ block: "nearest" });
    const t = window.setTimeout(() => setDestaque(null), 1700);
    return () => window.clearTimeout(t);
  }, [destaque]);

  const registrarLinha = useCallback((id: string, el: HTMLTableRowElement | null) => {
    if (el) linhasRef.current.set(id, el);
    else linhasRef.current.delete(id);
  }, []);

  // ------------------------------------------------------------------ Marcação (grifo)
  const marcar = useCallback(
    (id: string, conferida: boolean) => {
      mutacoesRef.current++;
      const versao = (versoesRef.current.get(id) ?? 0) + 1;
      versoesRef.current.set(id, versao);

      // Atualiza a tela na hora; o banco confirma em seguida
      setItens((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                conferencia: conferida ? "conferida" : "pendente",
                conferida_por: conferida ? perfil.id : null,
                conferida_por_nome: conferida ? perfil.nome : null,
                conferida_em: conferida ? new Date().toISOString() : null,
              }
            : c,
        ),
      );
      setSalvando((n) => n + 1);

      // Fila por condicional: garante que "marcar" e "desmarcar" cheguem ao banco na ordem certa
      const anterior = filasRef.current.get(id) ?? Promise.resolve();
      const atual = anterior.then(async () => {
        try {
          const linha = await marcarConferencia(id, conferida);
          if (versoesRef.current.get(id) === versao) {
            setItens((prev) =>
              prev.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      conferencia: linha.conferencia,
                      conferida_por: linha.conferida_por,
                      conferida_em: linha.conferida_em,
                    }
                  : c,
              ),
            );
          }
        } catch (e) {
          avisar(`Não foi possível salvar a marcação: ${(e as Error).message}`, "erro");
          if (listaIdRef.current) void recarregarItens(listaIdRef.current).catch(() => undefined);
        } finally {
          setSalvando((n) => n - 1);
        }
      });
      filasRef.current.set(id, atual);
    },
    [perfil.id, perfil.nome, avisar, recarregarItens],
  );

  // Teclado: Espaço = conferir e avançar · Backspace = desfazer · ↑ ↓ = navegar
  useEffect(() => {
    if (!modoConferencia) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const b = bloqueioRef.current;
      if (b.dialogo || b.historico) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) || alvo.isContentEditable)) return;
      if (![" ", "Backspace", "ArrowDown", "ArrowUp"].includes(e.key)) return;

      e.preventDefault();
      if (alvo instanceof HTMLButtonElement || alvo instanceof HTMLAnchorElement) alvo.blur();

      const linhas = ativosRef.current;
      if (linhas.length === 0) return;
      const i = Math.min(cursorRef.current, linhas.length - 1);

      if (e.key === " ") {
        if (e.repeat) return; // segurar a tecla não marca várias de uma vez
        const atual = linhas[i];
        if (atual.conferencia !== "conferida") {
          marcar(atual.id, true);
          pilhaRef.current.push(atual.id);
        }
        irPara(Math.min(i + 1, linhas.length - 1));
      } else if (e.key === "Backspace") {
        const id = pilhaRef.current.pop();
        if (!id) return;
        const j = linhas.findIndex((c) => c.id === id);
        if (j < 0) return;
        marcar(id, false);
        irPara(j);
      } else if (e.key === "ArrowDown") {
        irPara(Math.min(i + 1, linhas.length - 1));
      } else {
        irPara(Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [modoConferencia, marcar, irPara]);

  const alternarConferencia = useCallback(
    (c: Condicional, indice: number) => {
      const marcarAgora = c.conferencia !== "conferida";
      marcar(c.id, marcarAgora);
      if (marcarAgora) pilhaRef.current.push(c.id);
      else pilhaRef.current = pilhaRef.current.filter((id) => id !== c.id);
      irPara(indice);
    },
    [marcar, irPara],
  );

  // ------------------------------------------------------------------ Ações
  async function abrir() {
    setAbrindo(true);
    try {
      await abrirLista(data, modalidade);
      await recarregar();
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setAbrindo(false);
    }
  }

  async function lancar(numeros: string[]) {
    if (!lista) return;
    let motivo: string | undefined;
    if (motivoObrigatorio) {
      const r = await pedir({
        titulo: numeros.length === 1 ? `Lançar ${numeros[0]}` : `Lançar ${numeros.length} números`,
        descricao: "A lista já foi enviada para conferência. Informe o motivo deste lançamento.",
        campos: [{ nome: "motivo", rotulo: "Motivo", tipo: "textarea", obrigatorio: true, minimo: 3 }],
        confirmar: "Lançar",
      });
      if (!r) return;
      motivo = r.motivo;
    }

    mutacoesRef.current++;
    const temps = numeros.map((numero, i) => ({ chave: `${Date.now()}-${i}-${numero}`, numero }));
    setTemporarios((t) => [...t, ...temps]);
    setFalhas([]);
    const listaId = lista.id;

    filaLancamentoRef.current = filaLancamentoRef.current.then(async () => {
      try {
        const resultado = await adicionarCondicionais(listaId, numeros, motivo);
        await recarregarItens(listaId);
        mutacoesRef.current++;
        const ok = resultado.filter((r) => r.adicionada);
        const recusados = resultado.filter((r) => !r.adicionada);
        if (ok.length) setDestaque(ok[ok.length - 1].numero);
        if (numeros.length === 1 && recusados.length === 1) {
          avisar(`${recusados[0].numero} não foi lançada: ${recusados[0].erro}`, "erro");
        } else if (recusados.length) {
          setFalhas((f) => [...f, ...recusados]);
        }
        if (numeros.length > 1) {
          avisar(`${ok.length} de ${numeros.length} números lançados.`, recusados.length ? "info" : "sucesso");
        }
      } catch (e) {
        avisar(
          `Não foi possível lançar ${numeros.length === 1 ? numeros[0] : "os números"}: ${(e as Error).message}`,
          "erro",
        );
      } finally {
        setTemporarios((t) => t.filter((x) => !temps.includes(x)));
      }
    });
  }

  async function editar(c: Condicional) {
    const r = await pedir({
      titulo: `Corrigir o número ${c.numero}`,
      descricao:
        c.conferencia === "conferida" && !ehBalcao
          ? "Atenção: a conferência desta condicional será desmarcada para ser feita de novo."
          : undefined,
      campos: [
        { nome: "numero", rotulo: "Número correto", tipo: "numero6", obrigatorio: true, valorInicial: c.numero },
        ...(motivoObrigatorio
          ? [{ nome: "motivo", rotulo: "Motivo da correção", tipo: "textarea" as const, obrigatorio: true, minimo: 3 }]
          : []),
      ],
      confirmar: "Salvar correção",
    });
    if (!r || !lista) return;
    if (r.numero === c.numero) return;
    if (existentes.has(r.numero)) {
      avisar(`${r.numero} já está nesta lista (linha ${existentes.get(r.numero)}).`, "erro");
      return;
    }
    try {
      mutacoesRef.current++;
      await editarNumero(c.id, r.numero, r.motivo);
      pilhaRef.current = pilhaRef.current.filter((id) => id !== c.id);
      await recarregarItens(lista.id);
      avisar(`Número corrigido: ${c.numero} → ${r.numero}.`, "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  async function remover(c: Condicional) {
    const r = await pedir({
      titulo: `Remover ${c.numero} da lista?`,
      descricao: "Ela sai da lista, mas continua registrada no histórico (quem removeu, quando e por quê).",
      campos: [
        motivoObrigatorio
          ? { nome: "motivo", rotulo: "Motivo", tipo: "textarea", obrigatorio: true, minimo: 3 }
          : { nome: "motivo", rotulo: "Motivo (opcional)", tipo: "texto" },
      ],
      confirmar: "Remover",
      perigo: true,
    });
    if (!r || !lista) return;
    try {
      mutacoesRef.current++;
      await removerCondicional(c.id, r.motivo || undefined);
      pilhaRef.current = pilhaRef.current.filter((id) => id !== c.id);
      await recarregarItens(lista.id);
      avisar(`${c.numero} removida da lista.`, "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  async function situacao(c: Condicional, s: Situacao) {
    const linha = await alterarSituacao(c, s);
    if (!linha) return;
    mutacoesRef.current++;
    setItens((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? {
              ...x,
              situacao: linha.situacao,
              situacao_em: linha.situacao_em,
              situacao_por: linha.situacao_por,
              situacao_por_nome: perfil.nome,
            }
          : x,
      ),
    );
  }

  async function enviar() {
    if (!lista) return;
    const r = await pedir({
      titulo: "Enviar para conferência?",
      descricao: (
        <>
          Você vai enviar <b>{contagem.total}</b> condicionais da lista de <b>{formatarData(lista.data)}</b>. Depois de
          enviada, qualquer correção precisa de motivo, e só pode ser feita por você até a conferência começar.
        </>
      ),
      confirmar: "Enviar lista",
    });
    if (!r) return;
    setOcupado(true);
    try {
      await enviarLista(lista.id);
      avisar("Lista enviada para conferência.", "sucesso");
      await recarregar();
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setOcupado(false);
    }
  }

  async function assinar() {
    if (!lista) return;
    if (salvando > 0 || temporarios.length > 0) {
      avisar("Aguarde terminar de salvar as marcações.", "info");
      return;
    }
    const pendentes = ativos.filter((c) => c.conferencia === "pendente");
    const r = ehBalcao
      ? await pedir({
          titulo: "Fechar e assinar a lista do balcão?",
          descricao: (
            <>
              As <b>{contagem.total}</b> condicionais lançadas já foram conferidas no lançamento. Depois de fechada, a
              lista só muda se for reaberta (com motivo).
            </>
          ),
          campos: [{ nome: "observacao", rotulo: "Observação (opcional)", tipo: "textarea" }],
          confirmar: `Fechar e assinar como ${perfil.nome}`,
        })
      : await pedir({
          titulo: "Assinar conferência",
          descricao:
            pendentes.length === 0 ? (
              <>
                Todas as <b>{contagem.total}</b> condicionais foram conferidas.
              </>
            ) : (
              <>
                <b className="text-vermelho-700">{pendentes.length}</b> sem conferência vão ficar registradas como{" "}
                <b className="text-vermelho-700">NÃO RECEBIDAS</b>:
                <span className="numero mt-2 block rounded-md bg-vermelho-50 px-3 py-2 text-vermelho-700">
                  {pendentes.map((c) => c.numero).join("  ")}
                </span>
              </>
            ),
          campos: [
            pendentes.length > 0
              ? {
                  nome: "observacao",
                  rotulo: "Observação (obrigatória)",
                  tipo: "textarea",
                  obrigatorio: true,
                  minimo: 3,
                }
              : { nome: "observacao", rotulo: "Observação (opcional)", tipo: "textarea" },
          ],
          confirmar: `Assinar como ${perfil.nome}`,
          perigo: pendentes.length > 0,
        });
    if (!r) return;
    setOcupado(true);
    try {
      await assinarConferencia(lista.id, r.observacao || undefined);
      pilhaRef.current = [];
      avisar(ehBalcao ? "Lista do balcão fechada e assinada." : "Conferência assinada.", "sucesso");
      await recarregar();
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setOcupado(false);
    }
  }

  async function reabrir() {
    if (!lista) return;
    const r = await pedir({
      titulo: ehBalcao ? "Reabrir a lista do balcão?" : "Reabrir a conferência?",
      descricao: ehBalcao
        ? "A assinatura sai e a lista volta para lançamento, podendo ser corrigida. Tudo fica no histórico."
        : "A assinatura sai e a lista volta para conferência. As que estavam como “não recebidas” voltam a pendente. Tudo fica no histórico.",
      campos: [{ nome: "motivo", rotulo: "Motivo", tipo: "textarea", obrigatorio: true, minimo: 3 }],
      confirmar: "Reabrir",
      perigo: true,
    });
    if (!r) return;
    setOcupado(true);
    try {
      await reabrirConferencia(lista.id, r.motivo);
      cursorIniciadoRef.current = null;
      avisar(ehBalcao ? "Lista do balcão reaberta." : "Conferência reaberta.", "sucesso");
      await recarregar();
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setOcupado(false);
    }
  }

  async function imprimir() {
    if (!lista) return;
    const r = await pedir({
      titulo: "Imprimir lista",
      descricao: "A folha sai em A4, só com os números (sem menus nem botões).",
      campos: [
        {
          nome: "modelo",
          rotulo: "O que imprimir",
          tipo: "select",
          opcoes: [
            { valor: "em_branco", rotulo: "Folha para conferência manual (caixas em branco)" },
            { valor: "registrada", rotulo: "Cópia da conferência registrada no sistema" },
          ],
          valorInicial: lista.status === "conferida" ? "registrada" : "em_branco",
        },
      ],
      confirmar: "Imprimir",
    });
    if (!r) return;
    setModeloImpressao(r.modelo as ModeloImpressao);
    // Espera a folha ser montada com o modelo escolhido antes de abrir a impressão
    window.setTimeout(() => window.print(), 100);
  }

  async function resetar() {
    if (!lista) return;
    const r = await pedir({
      titulo: `Resetar a lista de ${ROTULO_MODALIDADE[lista.modalidade]} de ${formatarData(lista.data)}?`,
      descricao: (
        <>
          Use só para <b>listas de teste</b>. Apaga de vez as <b>{itens.length}</b> condicionais, as marcações e o
          histórico desta lista, como se ela nunca tivesse existido. Fica registrado apenas que você resetou.{" "}
          <b className="text-vermelho-700">Não dá para desfazer.</b>
        </>
      ),
      campos: [
        {
          nome: "motivo",
          rotulo: "Motivo",
          tipo: "texto",
          obrigatorio: true,
          minimo: 3,
          placeholder: "Ex.: teste do sistema",
        },
        {
          nome: "confirmacao",
          rotulo: "Digite RESETAR para confirmar",
          tipo: "texto",
          obrigatorio: true,
          igualA: "RESETAR",
        },
      ],
      confirmar: "Resetar lista",
      perigo: true,
    });
    if (!r) return;
    setOcupado(true);
    try {
      mutacoesRef.current++;
      const apagadas = await resetarLista(lista.id, r.motivo);
      pilhaRef.current = [];
      cursorIniciadoRef.current = null;
      avisar(`Lista resetada: ${apagadas} condicional(is) apagada(s).`, "sucesso");
      await recarregar();
    } catch (e) {
      avisar((e as Error).message, "erro");
    } finally {
      setOcupado(false);
    }
  }

  const fecharHistorico = useCallback(() => setHistorico(null), []);

  // ------------------------------------------------------------------ Tela
  const navegacaoDias = (
    <div className="flex items-center gap-1">
      <Link
        to={caminhoLista(modalidade, somarDias(data, -1))}
        className="rounded-md p-2 text-zinc-500 hover:bg-white hover:text-marinho"
        title="Dia anterior"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      {data < hoje ? (
        <Link
          to={caminhoLista(modalidade, somarDias(data, 1))}
          className="rounded-md p-2 text-zinc-500 hover:bg-white hover:text-marinho"
          title="Próximo dia"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      ) : (
        <span className="p-2 text-zinc-300">
          <ChevronRight className="h-5 w-5" />
        </span>
      )}
    </div>
  );

  if (!dataValida) return <MensagemErro texto="Data inválida." />;
  if (lista === undefined)
    return erro ? <MensagemErro texto={erro} aoTentar={() => void recarregar()} /> : <Carregando />;

  const titulo = (
    <div className="flex items-center gap-2">
      {navegacaoDias}
      <div>
        <div className="flex items-center gap-2">
          <SeloModalidade modalidade={modalidade} />
          <span className="text-sm text-zinc-500">{diaDaSemana(data)}</span>
        </div>
        <h1 className="mt-0.5 text-2xl font-semibold text-marinho">Lista de {formatarData(data)}</h1>
      </div>
      <Link
        to={caminhoLista(outraModalidade, data)}
        className="ml-2 hidden self-end rounded-md px-2 py-1 text-sm text-marinho underline-offset-2 hover:underline sm:inline"
      >
        Ver {ROTULO_MODALIDADE[outraModalidade]} deste dia →
      </Link>
    </div>
  );

  if (lista === null) {
    return (
      <div className="space-y-6">
        {titulo}
        <Vazio titulo={`Nenhuma lista de ${ROTULO_MODALIDADE[modalidade]} lançada em ${formatarData(data)}.`}>
          {podeAbrirLista(perfil.papel, modalidade) && data <= hoje ? (
            <Botao className="mt-3" onClick={() => void abrir()} carregando={abrindo}>
              <Plus className="h-4 w-4" />
              Começar a lista de {ROTULO_MODALIDADE[modalidade]} deste dia
            </Botao>
          ) : (
            <p>
              {ehBalcao
                ? "As listas de balcão são lançadas pelo financeiro."
                : "As listas de entregas são lançadas pela expedição."}
            </p>
          )}
        </Vazio>
      </div>
    );
  }

  const atual = ativos[cursorSeguro];
  const progresso = contagem.total
    ? Math.round(((contagem.conferidas + contagem.naoRecebidas) / contagem.total) * 100)
    : 0;

  return (
    <>
      <div className="space-y-5 print:hidden">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            {titulo}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[5.5rem] text-sm text-zinc-500">
              <SeloStatusLista status={lista.status} modalidade={lista.modalidade} />
              <span>
                Lançada por <b className="font-medium text-zinc-700">{lista.criada_por_nome}</b>
              </span>
              {lista.enviada_em && (
                <span>
                  · enviada por <b className="font-medium text-zinc-700">{lista.enviada_por_nome}</b> em{" "}
                  {formatarDataHora(lista.enviada_em)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao
              variante="secundario"
              onClick={() =>
                setHistorico({
                  titulo: `${ROTULO_MODALIDADE[lista.modalidade]} · ${formatarData(lista.data)}`,
                  carregar: () => historicoDaLista(lista.id),
                })
              }
            >
              <History className="h-4 w-4" />
              Histórico da lista
            </Botao>
            <Botao variante="secundario" onClick={() => void imprimir()} disabled={ativos.length === 0}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Botao>
            {ehBalcao && podeAssinar(perfil.papel, lista) && (
              <Botao
                onClick={() => void assinar()}
                carregando={ocupado}
                disabled={contagem.total === 0 || temporarios.length > 0}
              >
                <Signature className="h-4 w-4" />
                Fechar e assinar lista
              </Botao>
            )}
            {podeEnviar(perfil.papel, lista) && (
              <Botao
                onClick={() => void enviar()}
                carregando={ocupado}
                disabled={contagem.total === 0 || temporarios.length > 0}
              >
                <Send className="h-4 w-4" />
                Enviar para conferência
              </Botao>
            )}
            {podeReabrir(perfil.papel, lista) && (
              <Botao variante="secundario" onClick={() => void reabrir()} carregando={ocupado}>
                <RotateCcw className="h-4 w-4" />
                {ehBalcao ? "Reabrir lista" : "Reabrir conferência"}
              </Botao>
            )}
          </div>
        </div>

        {/* Contadores */}
        <div className="flex flex-wrap gap-3">
          <Contador rotulo="Condicionais" valor={contagem.total} />
          {!ehBalcao && lista.status !== "rascunho" && (
            <Contador
              rotulo="Conferidas"
              valor={contagem.conferidas}
              destaque={contagem.conferidas === contagem.total && contagem.total > 0 ? "verde" : undefined}
            />
          )}
          {contagem.naoRecebidas > 0 && (
            <Contador rotulo="Não recebidas" valor={contagem.naoRecebidas} destaque="vermelho" />
          )}
          {(ehBalcao || lista.status !== "rascunho") && (
            <>
              <Contador rotulo="Em aberto" valor={contagem.emAberto} />
              <Contador rotulo="Pagas" valor={contagem.pagas} />
              <Contador rotulo="Canceladas" valor={contagem.canceladas} />
            </>
          )}
        </div>

        {/* Avisos por situação da lista */}
        {lista.status === "rascunho" && !editavel && (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
            {ehBalcao
              ? "O financeiro está lançando esta lista do balcão. Cada condicional lançada já está conferida."
              : "A expedição ainda está preenchendo esta lista. Ela fica disponível para conferência quando for enviada."}
          </div>
        )}

        {ehBalcao && lista.status === "rascunho" && editavel && (
          <div className="rounded-lg border border-marinho/15 bg-white px-4 py-3 text-sm text-zinc-600">
            No balcão, cada número que você lança <b>já fica conferido por você</b>. Ao terminar o dia, clique em{" "}
            <b>Fechar e assinar lista</b>.
          </div>
        )}

        {lista.status === "enviada" && perfil.papel === "expedicao" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {editavel
              ? "Lista enviada. Você ainda pode corrigir (com motivo) até o financeiro começar a conferência."
              : "A conferência já começou. Para corrigir algo, fale com o financeiro."}
          </div>
        )}

        {lista.status === "conferida" && (
          <div className="cartao flex flex-wrap items-center gap-4 border-emerald-200 bg-emerald-50/40 px-5 py-4">
            <Signature className="h-8 w-8 text-emerald-700" />
            <div className="flex-1">
              <p className="text-sm text-zinc-600">
                {ehBalcao ? "Fechada e assinada por" : "Conferido e assinado por"}
              </p>
              <p className="text-lg font-semibold text-marinho">
                {lista.conferida_por_nome}{" "}
                <span className="font-normal text-zinc-500">· {formatarDataHora(lista.conferida_em)}</span>
              </p>
              {lista.observacao_conferencia && (
                <p className="mt-1 text-sm italic text-zinc-600">“{lista.observacao_conferencia}”</p>
              )}
            </div>
          </div>
        )}

        {/* Lançamento */}
        {editavel && lista.status === "rascunho" && (
          <div className="sticky top-0 z-20 -mx-4 bg-papel/95 px-4 py-3 backdrop-blur">
            <EntradaNumeros aoAdicionar={(n) => void lancar(n)} existentes={existentes} />
          </div>
        )}

        {editavel && lista.status === "enviada" && (
          <div>
            {mostrarEntradaExtra ? (
              <div className="cartao space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-marinho">Lançar condicional que ficou de fora</p>
                  <button
                    type="button"
                    onClick={() => setMostrarEntradaExtra(false)}
                    className="text-zinc-400 hover:text-zinc-700"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <EntradaNumeros
                  aoAdicionar={(n) => void lancar(n)}
                  existentes={existentes}
                  dica="A lista já foi enviada: o sistema vai pedir o motivo."
                />
              </div>
            ) : (
              <Botao variante="fantasma" tamanho="sm" onClick={() => setMostrarEntradaExtra(true)}>
                <Plus className="h-4 w-4" />
                Lançar condicional que ficou de fora
              </Botao>
            )}
          </div>
        )}

        {falhas.length > 0 && (
          <div className="cartao border-vermelho/30 p-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium text-vermelho-700">{falhas.length} número(s) não foram lançados:</p>
              <button
                type="button"
                onClick={() => setFalhas([])}
                className="text-zinc-400 hover:text-zinc-700"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {falhas.map((f, i) => (
                <li key={`${f.numero}-${i}`}>
                  <span className="numero font-medium">{f.numero || "(vazio)"}</span>{" "}
                  <span className="text-zinc-600">— {f.erro}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {modoConferencia && (
          <div className="rounded-lg border border-marinho/15 bg-white px-4 py-3 text-sm text-zinc-600">
            Pegue as condicionais na ordem da pilha e aperte <Tecla>Espaço</Tecla> para cada uma que estiver na sua mão:
            ela fica grifada e o sistema pula para a próxima. Errou? <Tecla>Backspace</Tecla> desfaz a última.
          </div>
        )}

        {/* Tabela */}
        <TabelaCondicionais
          itens={ativos}
          temporarios={temporarios}
          modoConferencia={modoConferencia}
          cursor={cursorSeguro}
          editavel={editavel}
          situacaoEditavel={situacaoEditavel}
          ocultarStatus={!ehBalcao && lista.status === "rascunho"}
          destaque={destaque}
          aoFocarLinha={irPara}
          aoAlternarConferencia={alternarConferencia}
          aoEditar={(c) => void editar(c)}
          aoRemover={(c) => void remover(c)}
          aoSituacao={(c, s) => void situacao(c, s)}
          aoHistorico={(c) =>
            setHistorico({ titulo: `Condicional ${c.numero}`, carregar: () => historicoDeRegistros([c.id]) })
          }
          registrarLinha={registrarLinha}
        />

        {removidas.length > 0 && (
          <div className="space-y-2">
            <Botao variante="fantasma" tamanho="sm" onClick={() => setMostrarRemovidas((v) => !v)}>
              {mostrarRemovidas ? "Esconder" : "Mostrar"} removidas ({removidas.length})
            </Botao>
            {mostrarRemovidas && (
              <TabelaRemovidas
                itens={removidas}
                aoHistorico={(c) =>
                  setHistorico({ titulo: `Condicional ${c.numero}`, carregar: () => historicoDeRegistros([c.id]) })
                }
              />
            )}
          </div>
        )}

        {/* Barra fixa da conferência */}
        {modoConferencia && ativos.length > 0 && (
          <div className="sticky bottom-0 z-20 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(20,29,62,0.06)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xs uppercase tracking-wider text-zinc-500">Linha {cursorSeguro + 1}</span>
                <span
                  className={`numero text-2xl font-semibold ${atual?.conferencia === "conferida" ? "grifo" : ""} text-marinho`}
                >
                  {atual?.numero}
                </span>
              </div>
              <div className="min-w-[10rem] flex-1">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>
                    {contagem.conferidas} de {contagem.total} conferidas
                  </span>
                  <span>{progresso}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div className="h-full rounded-full bg-grifo transition-all" style={{ width: `${progresso}%` }} />
                </div>
              </div>
              <div className="hidden items-center gap-1.5 text-xs text-zinc-500 lg:flex">
                <Tecla>Espaço</Tecla> conferir · <Tecla>⌫</Tecla> desfazer · <Tecla>↑</Tecla>
                <Tecla>↓</Tecla> navegar
              </div>
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                {salvando > 0 ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> salvando…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> tudo salvo
                  </>
                )}
              </span>
              <Botao onClick={() => void assinar()} carregando={ocupado} disabled={salvando > 0}>
                <Signature className="h-4 w-4" />
                Assinar conferência
              </Botao>
            </div>
          </div>
        )}

        {perfil.papel === "admin" && (
          <div className="flex justify-end border-t border-dashed border-zinc-300 pt-4">
            <Botao
              variante="fantasma"
              tamanho="sm"
              onClick={() => void resetar()}
              carregando={ocupado}
              className="text-vermelho-700 hover:bg-vermelho-50"
            >
              <Trash2 className="h-4 w-4" />
              Resetar lista (dados de teste)
            </Botao>
          </div>
        )}

        {historico && <PainelHistorico pedido={historico} aoFechar={fecharHistorico} />}
      </div>
      <FolhaImpressao lista={lista} itens={ativos} modelo={modeloImpressao} impressoPor={perfil.nome} />
    </>
  );
}
