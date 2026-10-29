# Agenda de Condicionais — Brunsfeld

Substitui a lista diária de condicionais feita no Excel e conferida no papel com grifa-texto.

## Como funciona

1. **Expedição** abre a lista do dia e lança os números (6 dígitos + Enter, ou cola uma coluna do Excel). Ao terminar, clica em **Enviar para conferência**.
2. **Financeiro** abre a lista e confere com a pilha física na mão:
   - `Espaço` grifa a condicional atual e pula para a próxima
   - `Backspace` desfaz a última marcação
   - `↑` `↓` navegam sem marcar
   - segurar o Espaço não marca várias de uma vez (de propósito)
3. **Assinar conferência**: o que ficou sem grifo vira **não recebida** (observação obrigatória). A lista fica travada com o nome e a hora de quem assinou.
4. A qualquer momento depois do envio, o financeiro marca cada condicional como **Paga** ou **Cancelada**.
5. **Buscar** mostra o histórico completo de qualquer número e responde "quem viu por último".

## Regras

| Situação da lista | Expedição | Financeiro | Admin |
|---|---|---|---|
| Em preenchimento | lança, corrige, remove, envia | só vê | tudo |
| Enviada | corrige com motivo, **só até a conferência começar** | confere, corrige com motivo, paga/cancela, assina | tudo |
| Assinada | só vê | paga/cancela, reabre com motivo | tudo |

- Tudo fica no histórico (quem, quando, o que mudou, motivo), gravado por gatilhos do próprio banco.
- Nada é apagado: "remover" só tira da lista; usuários são desativados, nunca excluídos.
- Um número de condicional só pode estar em uma lista.

## Estrutura

```
supabase/migrations/001_estrutura.sql   banco: tabelas, regras, histórico, permissões
supabase/functions/usuarios/index.ts    função de servidor: criar usuário / redefinir senha
src/lib/api.ts                          todas as chamadas ao Supabase
src/lib/permissoes.ts                   o que cada papel vê na tela (o banco é quem decide)
src/pages/Lista.tsx                     tela da lista: lançamento + conferência pelo teclado
src/pages/                              Listas, Buscar, Em aberto, Usuários, Login
```

- **Supabase**: projeto "Brunsfeld Condicionais" (região São Paulo)
- **Login**: usuário + senha. Por baixo é um e-mail interno `usuario@login.brunsfeld.local` (nenhum e-mail é enviado). O domínio está em `src/lib/config.ts` e na função `usuarios` e precisa ser igual nos dois.

## Primeiro acesso

Com o banco vazio, o site mostra a tela **Primeiro acesso** para criar o administrador. Ela some assim que existe o primeiro usuário. Depois disso, os outros usuários são criados em **Usuários**.

## Rodar no computador

```bash
npm install
npm run dev
```

## Publicar (Netlify)

O `netlify.toml` já está configurado: comando `npm run build`, pasta `dist`, redirecionamento das rotas.

## Backup

O plano gratuito do Supabase não faz backup automático. Antes de abandonar o papel, ative o plano pago ou exporte os dados com frequência.
