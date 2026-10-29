import { useState, type FormEvent } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { TelaEntrada } from "../components/Layout";
import { Botao } from "../components/ui";
import { entrar, primeiroAcesso, sair } from "../lib/api";
import { useAuth } from "../lib/auth";

function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return <p className="rounded-md bg-vermelho-50 px-3 py-2 text-sm text-vermelho-700">{texto}</p>;
}

export function Login() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(usuario, senha);
    } catch (err) {
      setErro((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <TelaEntrada>
      <form onSubmit={enviar} className="space-y-4">
        <h1 className="text-lg font-semibold text-marinho">Entrar</h1>
        <div>
          <label htmlFor="usuario" className="rotulo">
            Usuário
          </label>
          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ""))}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
            className="campo"
          />
        </div>
        <div>
          <label htmlFor="senha" className="rotulo">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
            className="campo"
          />
        </div>
        <Erro texto={erro} />
        <Botao type="submit" className="w-full" carregando={enviando}>
          <LogIn className="h-4 w-4" />
          Entrar
        </Botao>
        <p className="text-center text-xs text-zinc-500">Esqueceu a senha? Peça ao administrador para redefinir.</p>
      </form>
    </TelaEntrada>
  );
}

export function PrimeiroAcesso({ aoConcluir }: { aoConcluir: () => void }) {
  const [nome, setNome] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== confirmacao) return setErro("As senhas não conferem.");
    setEnviando(true);
    try {
      await primeiroAcesso({ nome: nome.trim(), usuario, senha });
      await entrar(usuario, senha);
      aoConcluir();
    } catch (err) {
      setErro((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <TelaEntrada>
      <form onSubmit={enviar} className="space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <h1 className="text-lg font-semibold text-marinho">Primeiro acesso</h1>
            <p className="text-sm text-zinc-500">
              Crie o usuário administrador. Esta tela aparece só uma vez; depois, os outros usuários são criados por
              você dentro do sistema.
            </p>
          </div>
        </div>
        <div>
          <label htmlFor="nome" className="rotulo">
            Seu nome
          </label>
          <input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoFocus
            className="campo"
          />
        </div>
        <div>
          <label htmlFor="usuario" className="rotulo">
            Usuário
          </label>
          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
            required
            minLength={3}
            autoCapitalize="none"
            placeholder="ex.: bruno"
            className="campo"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="senha" className="rotulo">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="new-password"
              className="campo"
            />
          </div>
          <div>
            <label htmlFor="confirmacao" className="rotulo">
              Repita a senha
            </label>
            <input
              id="confirmacao"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
              autoComplete="new-password"
              className="campo"
            />
          </div>
        </div>
        <Erro texto={erro} />
        <Botao type="submit" className="w-full" carregando={enviando}>
          Criar administrador e entrar
        </Botao>
      </form>
    </TelaEntrada>
  );
}

export function SemAcesso() {
  const { perfil, erroPerfil } = useAuth();
  return (
    <TelaEntrada>
      <div className="space-y-4 text-center">
        <h1 className="text-lg font-semibold text-marinho">Sem acesso</h1>
        <p className="text-sm text-zinc-600">
          {erroPerfil
            ? `Não foi possível carregar seu perfil: ${erroPerfil}`
            : perfil && !perfil.ativo
              ? "Seu usuário está desativado. Fale com o administrador."
              : "Seu usuário não tem perfil neste sistema. Fale com o administrador."}
        </p>
        <Botao variante="secundario" onClick={() => void sair()} className="w-full">
          Sair
        </Botao>
      </div>
    </TelaEntrada>
  );
}
