// Endereço e chave PÚBLICA do Supabase. A chave "publishable" é feita para
// ficar no navegador: quem protege os dados são as regras do banco (RLS e
// funções), não o segredo desta chave.
export const SUPABASE_URL = "https://tuksydbtldozcldyaxtq.supabase.co";
export const SUPABASE_CHAVE_PUBLICA = "sb_publishable_ikZuN8QptgYWeHXEypWi3Q_5vqvIzu_";

// Os funcionários entram com "usuário + senha". Por baixo, o Supabase usa um
// e-mail interno nesse domínio (nenhum e-mail é enviado).
// Precisa ser igual a DOMINIO_LOGIN em supabase/functions/usuarios/index.ts
export const DOMINIO_LOGIN = "login.brunsfeld.local";

export const FUSO = "America/Sao_Paulo";
