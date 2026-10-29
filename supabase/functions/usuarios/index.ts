// Função de servidor "usuarios" — Agenda de Condicionais
// Cria usuários (login por nome de usuário + senha) e redefine senhas.
// Só administradores podem usar, exceto "primeiro_acesso", que funciona
// uma única vez, enquanto o sistema ainda não tem nenhum usuário.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Precisa ser igual a DOMINIO_LOGIN em src/lib/config.ts
const DOMINIO_LOGIN = "login.brunsfeld.local";
const PAPEIS = ["expedicao", "financeiro", "admin"] as const;
type Papel = (typeof PAPEIS)[number];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function chaveServico(): string {
  const legado = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legado) return legado;
  const novas = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (novas) {
    const obj = JSON.parse(novas) as Record<string, string>;
    const chave = obj.default ?? Object.values(obj)[0];
    if (chave) return chave;
  }
  throw new Error("Chave de serviço não configurada.");
}

class ErroValidacao extends Error {}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function validarUsuario(valor: unknown): string {
  const usuario = texto(valor).toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
    throw new ErroValidacao(
      "Usuário inválido: use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado (sem espaços nem acentos).",
    );
  }
  return usuario;
}

function validarNome(valor: unknown): string {
  const nome = texto(valor);
  if (nome.length < 2 || nome.length > 80) throw new ErroValidacao("Informe o nome (2 a 80 caracteres).");
  return nome;
}

function validarSenha(valor: unknown): string {
  const senha = typeof valor === "string" ? valor : "";
  if (senha.length < 6) throw new ErroValidacao("A senha precisa ter pelo menos 6 caracteres.");
  return senha;
}

function validarPapel(valor: unknown): Papel {
  if (typeof valor === "string" && (PAPEIS as readonly string[]).includes(valor)) return valor as Papel;
  throw new ErroValidacao("Papel inválido.");
}

async function criarUsuario(
  admin: SupabaseClient,
  dados: { usuario: string; nome: string; senha: string; papel: Papel },
  criadoPor: string | null,
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${dados.usuario}@${DOMINIO_LOGIN}`,
    password: dados.senha,
    email_confirm: true,
    user_metadata: { usuario: dados.usuario, nome: dados.nome },
  });
  if (error || !data.user) {
    const msg = error?.message ?? "";
    if (/already|registered|exists/i.test(msg)) throw new ErroValidacao("Esse nome de usuário já existe.");
    if (/password/i.test(msg)) throw new ErroValidacao("Senha recusada: escolha uma senha mais forte.");
    throw new Error(msg || "Não foi possível criar o usuário.");
  }

  const { data: perfil, error: erroPerfil } = await admin.rpc("criar_perfil", {
    p_id: data.user.id,
    p_usuario: dados.usuario,
    p_nome: dados.nome,
    p_papel: dados.papel,
    p_criado_por: criadoPor,
  });
  if (erroPerfil) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(erroPerfil.message);
  }
  return perfil;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta(405, { erro: "Método não permitido." });

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { erro: "Requisição inválida." });
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, chaveServico(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const acao = texto(corpo.acao);

    // ---- Primeiro acesso: cria o administrador inicial (uma única vez) ----
    if (acao === "primeiro_acesso") {
      const { count, error } = await admin.from("perfis").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      if ((count ?? 0) > 0) return resposta(403, { erro: "O sistema já foi configurado. Entre com seu usuário." });
      const perfil = await criarUsuario(
        admin,
        {
          usuario: validarUsuario(corpo.usuario),
          nome: validarNome(corpo.nome),
          senha: validarSenha(corpo.senha),
          papel: "admin",
        },
        null,
      );
      return resposta(200, { perfil });
    }

    // ---- Demais ações: somente administrador logado ----
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: sessao, error: erroSessao } = await admin.auth.getUser(token);
    if (erroSessao || !sessao.user) return resposta(401, { erro: "Sessão expirada. Entre novamente." });

    const { data: chamador } = await admin
      .from("perfis")
      .select("id, papel, ativo")
      .eq("id", sessao.user.id)
      .maybeSingle();
    if (!chamador || !chamador.ativo || chamador.papel !== "admin") {
      return resposta(403, { erro: "Apenas administradores podem gerenciar usuários." });
    }

    if (acao === "criar") {
      const perfil = await criarUsuario(
        admin,
        {
          usuario: validarUsuario(corpo.usuario),
          nome: validarNome(corpo.nome),
          senha: validarSenha(corpo.senha),
          papel: validarPapel(corpo.papel),
        },
        chamador.id,
      );
      return resposta(200, { perfil });
    }

    if (acao === "redefinir_senha") {
      const id = texto(corpo.id);
      const senha = validarSenha(corpo.senha);
      const { data: alvo } = await admin.from("perfis").select("id").eq("id", id).maybeSingle();
      if (!alvo) return resposta(404, { erro: "Usuário não encontrado." });
      const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
      if (error) throw new Error(error.message);
      await admin.rpc("registrar_evento_usuario", {
        p_perfil_id: id,
        p_acao: "redefiniu_senha",
        p_por: chamador.id,
      });
      return resposta(200, { ok: true });
    }

    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    if (e instanceof ErroValidacao) return resposta(400, { erro: e.message });
    console.error(e);
    return resposta(500, { erro: e instanceof Error ? e.message : "Erro inesperado." });
  }
});
