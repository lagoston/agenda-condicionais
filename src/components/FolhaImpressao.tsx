// Folha A4 da lista, que só aparece na impressão.
//  - "em_branco":  caixas vazias para conferir à mão, com linhas de assinatura
//  - "registrada": cópia do que está no sistema (marcações, situação e assinatura)
import { diaDaSemana, formatarData, formatarDataHora, ROTULO_MODALIDADE, rotuloStatusLista } from "../lib/formatos";
import type { Condicional, ListaResumo } from "../lib/tipos";

export type ModeloImpressao = "em_branco" | "registrada";

function Caixa({ c, modelo }: { c: Condicional; modelo: ModeloImpressao }) {
  const base = "flex h-5 w-5 shrink-0 items-center justify-center border-2 border-black text-[11px] font-bold";
  if (modelo === "em_branco") return <span className={base} />;
  if (c.conferencia === "conferida") return <span className={base}>✓</span>;
  if (c.conferencia === "nao_recebida") return <span className={`${base} w-7`}>NR</span>;
  return <span className={base} />;
}

export function FolhaImpressao({
  lista,
  itens,
  modelo,
  impressoPor,
}: {
  lista: ListaResumo;
  itens: Condicional[];
  modelo: ModeloImpressao;
  impressoPor: string;
}) {
  const colunas = itens.length > 44 ? 3 : itens.length > 22 ? 2 : 1;
  const ehBalcao = lista.modalidade === "balcao";

  return (
    <div className="hidden text-black print:block">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">
            Brunsfeld Auto Peças · Agenda de Condicionais
          </p>
          <h1 className="text-xl font-bold">
            Lista de {ROTULO_MODALIDADE[lista.modalidade]} — {formatarData(lista.data)}{" "}
            <span className="text-base font-normal">({diaDaSemana(lista.data)})</span>
          </h1>
        </div>
        <div className="text-right text-[11px]">
          <p className="font-semibold">
            {modelo === "em_branco" ? "Conferência manual" : "Cópia da conferência registrada"}
          </p>
          <p>Situação no sistema: {rotuloStatusLista(lista.status, lista.modalidade)}</p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-6 text-[11px]">
        <span>
          Lançada por <b>{lista.criada_por_nome}</b>
          {lista.enviada_em && <> · enviada em {formatarDataHora(lista.enviada_em)}</>}
        </span>
        <span>
          Total: <b>{itens.length}</b> condicionais
        </span>
      </div>

      {/* Números */}
      <div className="mt-3" style={{ columnCount: colunas, columnGap: "8mm" }}>
        {itens.map((c, i) => (
          <div
            key={c.id}
            className="flex items-center gap-2 border-b border-zinc-400 py-[5px]"
            style={{ breakInside: "avoid" }}
          >
            <span className="w-6 text-right text-[10px] tabular-nums">{i + 1}</span>
            <span className="numero flex-1 text-base font-semibold">{c.numero}</span>
            {modelo === "registrada" && c.situacao !== "em_aberto" && (
              <span className="text-[10px] font-semibold uppercase">{c.situacao === "paga" ? "Paga" : "Canc."}</span>
            )}
            <Caixa c={c} modelo={modelo} />
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div className="mt-6 text-[12px]" style={{ breakInside: "avoid" }}>
        {modelo === "em_branco" ? (
          <>
            <p className="mb-5">Faltas / observações:</p>
            <div className="mb-5 border-b border-black" />
            <div className="grid grid-cols-3 gap-6 pt-6">
              <div className="border-t border-black pt-1">Conferente (nome)</div>
              <div className="border-t border-black pt-1">Assinatura</div>
              <div className="border-t border-black pt-1">Data e hora</div>
            </div>
          </>
        ) : lista.status === "conferida" ? (
          <p>
            {ehBalcao ? "Fechada e assinada" : "Conferido e assinado"} no sistema por <b>{lista.conferida_por_nome}</b>{" "}
            em {formatarDataHora(lista.conferida_em)}.
            {lista.observacao_conferencia && <> Observação: “{lista.observacao_conferencia}”.</>}
          </p>
        ) : (
          <p>Conferência ainda não assinada no sistema.</p>
        )}
        {modelo === "registrada" && (
          <p className="mt-1 text-[10px]">✓ = conferida · NR = não recebida · caixa vazia = pendente</p>
        )}
        <p className="mt-4 text-[10px] text-zinc-600">
          Impresso por {impressoPor} em {formatarDataHora(new Date().toISOString())}
        </p>
      </div>
    </div>
  );
}
