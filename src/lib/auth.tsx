import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { carregarPerfil } from "./api";
import { supabase } from "./supabase";
import type { Perfil } from "./tipos";

interface AuthContexto {
  carregando: boolean;
  sessao: Session | null;
  perfil: Perfil | null;
  erroPerfil: string | null;
  recarregarPerfil: () => Promise<void>;
}

const Contexto = createContext<AuthContexto | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [iniciado, setIniciado] = useState(false);
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [perfilDe, setPerfilDe] = useState<string | null>(null);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);
  const usuarioId = sessao?.user.id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setIniciado(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => setSessao(novaSessao));
    return () => data.subscription.unsubscribe();
  }, []);

  const recarregarPerfil = useCallback(async () => {
    if (!usuarioId) {
      setPerfil(null);
      setPerfilDe(null);
      return;
    }
    try {
      setPerfil(await carregarPerfil(usuarioId));
      setErroPerfil(null);
    } catch (e) {
      setPerfil(null);
      setErroPerfil((e as Error).message);
    } finally {
      setPerfilDe(usuarioId);
    }
  }, [usuarioId]);

  useEffect(() => {
    void recarregarPerfil();
  }, [recarregarPerfil]);

  const carregando = !iniciado || (usuarioId !== null && perfilDe !== usuarioId);

  return (
    <Contexto.Provider value={{ carregando, sessao, perfil, erroPerfil, recarregarPerfil }}>
      {children}
    </Contexto.Provider>
  );
}

export function useAuth(): AuthContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}

/** Perfil garantido (use só dentro das telas que exigem login) */
export function usePerfil(): Perfil {
  const { perfil } = useAuth();
  if (!perfil) throw new Error("Perfil não carregado");
  return perfil;
}
