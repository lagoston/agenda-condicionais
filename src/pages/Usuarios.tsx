import { useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, UserPlus } from "lucide-react";
import { useAvisos } from "../components/Avisos";
import { useDialogo } from "../components/Dialogo";
import { Botao, Carregando, MensagemErro, Selo } from "../components/ui";
import { atualizarUsuario, criarUsuario, listarUsuarios, redefinirSenha } from "../lib/api";
import { usePerfil } from "../lib/auth";
import { formatarDataDoMomento, ROTULO_PAPEL } from "../lib/formatos";
import type { Papel, Perfil } from "../lib/tipos";

const OPCOES_PAPEL = [
  { valor: "expedicao", rotulo: "Expedição — lança Entregas, marca paga/cancelada" },
  { valor: "financeiro", rotulo: "Financeiro — lança Balcão, confere Entregas, paga/cancela" },
  { valor: "admin", rotulo: "Administrador — tudo + usuários" },
];

export default function Usuarios() {
  const eu = usePerfil();
  const { pedir } = useDialogo();
  const { avisar } = useAvisos();
  const [usuarios, setUsuarios] = useState<Perfil[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setUsuarios(await listarUsuarios());
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function novo() {
    const r = await pedir({
      titulo: "Novo usuário",
      descricao: "Cada pessoa precisa do seu próprio usuário: é assim que o sistema registra quem fez o quê.",
      campos: [
        { nome: "nome", rotulo: "Nome", obrigatorio: true, minimo: 2, placeholder: "Ex.: João Silva" },
        {
          nome: "usuario",
          rotulo: "Usuário (para entrar)",
          obrigatorio: true,
          minimo: 3,
          placeholder: "Ex.: joao",
          ajuda: "Letras minúsculas, números, ponto ou hífen. Sem espaços nem acentos.",
        },
        { nome: "senha", rotulo: "Senha inicial", tipo: "senha", obrigatorio: true, minimo: 6 },
        { nome: "papel", rotulo: "Função", tipo: "select", opcoes: OPCOES_PAPEL, valorInicial: "expedicao" },
      ],
      confirmar: "Criar usuário",
    });
    if (!r) return;
    try {
      await criarUsuario({
        nome: r.nome,
        usuario: r.usuario.toLowerCase(),
        senha: r.senha,
        papel: r.papel as Papel,
      });
      avisar(`Usuário ${r.usuario.toLowerCase()} criado.`, "sucesso");
      await carregar();
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  async function editar(u: Perfil) {
    const r = await pedir({
      titulo: `Editar ${u.nome}`,
      campos: [
        { nome: "nome", rotulo: "Nome", obrigatorio: true, minimo: 2, valorInicial: u.nome },
        { nome: "papel", rotulo: "Função", tipo: "select", opcoes: OPCOES_PAPEL, valorInicial: u.papel },
        {
          nome: "ativo",
          rotulo: "Acesso",
          tipo: "select",
          opcoes: [
            { valor: "sim", rotulo: "Ativo — pode entrar" },
            { valor: "nao", rotulo: "Desativado — não consegue entrar" },
          ],
          valorInicial: u.ativo ? "sim" : "nao",
        },
      ],
      confirmar: "Salvar",
    });
    if (!r) return;
    try {
      await atualizarUsuario(u.id, r.nome, r.papel as Papel, r.ativo === "sim");
      avisar("Usuário atualizado.", "sucesso");
      await carregar();
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  async function senha(u: Perfil) {
    const r = await pedir({
      titulo: `Nova senha para ${u.nome}`,
      campos: [{ nome: "senha", rotulo: "Nova senha", tipo: "senha", obrigatorio: true, minimo: 6 }],
      confirmar: "Redefinir senha",
    });
    if (!r) return;
    try {
      await redefinirSenha(u.id, r.senha);
      avisar(`Senha de ${u.nome} redefinida.`, "sucesso");
    } catch (e) {
      avisar((e as Error).message, "erro");
    }
  }

  if (erro && !usuarios) return <MensagemErro texto={erro} aoTentar={() => void carregar()} />;
  if (!usuarios) return <Carregando />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-marinho">Usuários</h1>
          <p className="text-sm text-zinc-500">
            Ninguém é apagado: desative quem saiu da empresa para manter o histórico.
          </p>
        </div>
        <Botao onClick={() => void novo()}>
          <UserPlus className="h-4 w-4" />
          Novo usuário
        </Botao>
      </div>

      <div className="cartao overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-2.5 pl-4 pr-4">Nome</th>
              <th className="py-2.5 pr-4">Usuário</th>
              <th className="py-2.5 pr-4">Função</th>
              <th className="py-2.5 pr-4">Acesso</th>
              <th className="py-2.5 pr-4">Desde</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={`border-b border-zinc-100 last:border-0 ${u.ativo ? "" : "text-zinc-400"}`}>
                <td className="py-2.5 pl-4 pr-4 font-medium">
                  {u.nome} {u.id === eu.id && <span className="text-xs font-normal text-zinc-400">(você)</span>}
                </td>
                <td className="numero py-2.5 pr-4">{u.usuario}</td>
                <td className="py-2.5 pr-4">{ROTULO_PAPEL[u.papel]}</td>
                <td className="py-2.5 pr-4">
                  {u.ativo ? <Selo cor="verde">Ativo</Selo> : <Selo cor="cinza">Desativado</Selo>}
                </td>
                <td className="py-2.5 pr-4">{formatarDataDoMomento(u.criado_em)}</td>
                <td className="py-2.5 pr-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => void editar(u)}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-marinho-50 hover:text-marinho"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Redefinir senha"
                      onClick={() => void senha(u)}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-marinho-50 hover:text-marinho"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
