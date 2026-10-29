import { useEffect, useRef } from "react";

/** Executa a função quando a janela volta ao foco e a cada intervalo (se informado) */
export function useAoFocar(funcao: () => void, intervaloMs = 0) {
  const ref = useRef(funcao);
  ref.current = funcao;

  useEffect(() => {
    const executar = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    window.addEventListener("focus", executar);
    document.addEventListener("visibilitychange", executar);
    const timer = intervaloMs > 0 ? window.setInterval(executar, intervaloMs) : undefined;
    return () => {
      window.removeEventListener("focus", executar);
      document.removeEventListener("visibilitychange", executar);
      if (timer) window.clearInterval(timer);
    };
  }, [intervaloMs]);
}
