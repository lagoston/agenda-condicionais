import { useState, type FormEvent, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { KeyRound, LogOut, Search } from "lucide-react";
import { alterarMinhaSenha, sair } from "../lib/api";
import { usePerfil } from "../lib/auth";
import { ROTULO_PAPEL } from "../lib/formatos";
import { useAvisos } from "./Avisos";
import { useDialogo } from "./Dialogo";

export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-white/10 ring-1 ring-white/20">
        <span className="absolute inset-x-0 top-0 h-1 bg-vermelho" />
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="#FFE54D"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="leading-tight">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${claro ? "text-white/60" : "text-zinc-500"}`}
        >
          Brunsfeld
        </p>
        <p className={`text-base font-semibold ${claro ? "text-white" : "text-marinho"}`}>Agenda de Condicionais</p>
      </div>
    </div>
  );
}

function ItemMenu({ para, children }: { para: string; children: ReactNode }) {
  return (
    <NavLink
      to={para}
      end={para === "/"}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? "bg-white text-marinho" : "text-white/80 hover:bg-white/10 hover:text-white"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const perfil = usePerfil();
  const navegar = useNavigate();
  const { limpar, avisar } = useAvisos();
  const { pedir } = useDialogo();
  const [busca, setBusca] = useState("");

  async function trocarSenha() {
    const r = await pedir({
      titulo: "Alterar minha senha",
      descricao: (
        <>
          Usuário: <b className="numero">{perfil.usuario}</b>
        </>
      ),
      campos: [
        { nome: "atual", rotulo: "Senha atual", tipo: "senha", obrigatorio: true, autoComplete: "current-password" },
        {
          nome: "nova",
          rotulo: "Nova senha",
          tipo: "senha",
          obrigatorio: true,
          minimo: 6,
          ajuda: "Pelo menos 6 caracteres.",
        },
        { nome: "repetir", rotulo: "Repita a nova senha", tipo: "senha", obrigatorio: true, igualAoCampo: "nova" },
      ],
      confirmar: "Alterar senha",
    });
    if (!r) return;
    try {
      await alterarMinhaSenha(perfil.usuario, r.atual, r.nova);
      avisar("Senha alterada. Use a nova senha no próximo acesso.", "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  function buscar(e: FormEvent) {
    e.preventDefault();
    const termo = busca.replace(/\D/g, "");
    if (termo.length < 3) return;
    navegar(`/buscar?n=${termo}`);
    setBusca("");
    (document.activeElement as HTMLElement | null)?.blur();
  }

  return (
    <div className="min-h-screen">
      <header className="bg-marinho text-white print:hidden">
        <div className="h-1 bg-vermelho" />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Marca claro />
          <nav className="flex flex-wrap items-center gap-1">
            <ItemMenu para="/">Listas</ItemMenu>
            <ItemMenu para="/em-aberto">Em aberto</ItemMenu>
            <ItemMenu para="/buscar">Buscar</ItemMenu>
            {perfil.papel === "admin" && <ItemMenu para="/usuarios">Usuários</ItemMenu>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <form onSubmit={buscar} className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="Nº da condicional"
                aria-label="Buscar número da condicional"
                className="numero h-9 w-44 rounded-md border border-white/15 bg-white/10 pl-8 pr-2 text-sm text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-white/50 focus:border-white/40 focus:outline-none"
              />
            </form>
            <button
              type="button"
              onClick={() => void trocarSenha()}
              title="Alterar minha senha"
              className="group flex items-center gap-2 rounded-md px-2 py-1 text-right leading-tight hover:bg-white/10"
            >
              <span>
                <span className="block text-sm font-medium">{perfil.nome}</span>
                <span className="block text-xs text-white/60">{ROTULO_PAPEL[perfil.papel]}</span>
              </span>
              <KeyRound className="h-4 w-4 text-white/40 group-hover:text-white" />
            </button>
            <button
              type="button"
              onClick={() => {
                limpar();
                navegar("/");
                void sair();
              }}
              className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}

/** Moldura das telas de entrada (login / primeiro acesso) */
export function TelaEntrada({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-marinho">
      <div className="h-1 bg-vermelho" />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <Marca claro />
          </div>
          <div className="rounded-xl bg-white p-6 shadow-2xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
