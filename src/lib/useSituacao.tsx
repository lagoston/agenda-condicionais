import { useCallback } from "react";
import { useAvisos } from "../components/Avisos";
import { useDialogo } from "../components/Dialogo";
import { definirSituacao } from "./api";
import { ROTULO_SITUACAO } from "./formatos";
import type { Condicional, CondicionalBase, Situacao } from "./tipos";

/**
 * Regras de tela para marcar Paga / Cancelada / Em aberto:
 *  - Paga: um clique.
 *  - Cancelada: pede uma observação opcional.
 *  - Clicar de novo na situação atual (ou trocar entre paga/cancelada): exige motivo.
 * Devolve a linha atualizada, ou null se o usuário desistiu / deu erro.
 */
export function useSituacao() {
  const { pedir } = useDialogo();
  const { avisar } = useAvisos();

  return useCallback(
    async (c: Condicional, escolhida: Situacao): Promise<CondicionalBase | null> => {
      const alvo: Situacao = c.situacao === escolhida ? "em_aberto" : escolhida;
      let motivo: string | undefined;

      if (c.situacao !== "em_aberto") {
        const r = await pedir({
          titulo:
            alvo === "em_aberto"
              ? `Voltar ${c.numero} para "em aberto"?`
              : `Mudar ${c.numero} para "${ROTULO_SITUACAO[alvo]}"?`,
          descricao: `Hoje ela está como "${ROTULO_SITUACAO[c.situacao]}". Essa alteração fica registrada no histórico.`,
          campos: [{ nome: "motivo", rotulo: "Motivo", tipo: "textarea", obrigatorio: true, minimo: 3 }],
          confirmar: "Confirmar",
        });
        if (!r) return null;
        motivo = r.motivo;
      } else if (alvo === "cancelada") {
        const r = await pedir({
          titulo: `Cancelar a condicional ${c.numero}?`,
          campos: [{ nome: "motivo", rotulo: "Observação (opcional)", tipo: "texto" }],
          confirmar: "Marcar como cancelada",
          perigo: true,
        });
        if (!r) return null;
        motivo = r.motivo || undefined;
      }

      try {
        const linha = await definirSituacao(c.id, alvo, motivo);
        avisar(`${c.numero}: ${ROTULO_SITUACAO[alvo].toLowerCase()}.`, "sucesso");
        return linha;
      } catch (e) {
        avisar((e as Error).message, "erro");
        return null;
      }
    },
    [pedir, avisar],
  );
}
