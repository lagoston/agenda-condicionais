# Agenda de Condicionais — Brunsfeld

Substitui a lista diária de condicionais feita no Excel e conferida no papel com grifa-texto.

Site: https://brunsfeld-condicionais.netlify.app

## Duas modalidades por dia

| | **Entregas** | **Balcão** |
|---|---|---|
| Quem lança | Expedição | Financeiro |
| Conferência | Financeiro confere depois, com a barra de espaço | Já sai conferida no lançamento (por quem lançou) |
| Fim do dia | Financeiro assina a conferência | Financeiro fecha e assina a lista |
| Endereço | `/lista/entrega/AAAA-MM-DD` | `/lista/balcao/AAAA-MM-DD` |

Cada dia pode ter uma lista de cada modalidade, guardadas separadamente. Um mesmo número de condicional só pode estar em uma lista (de qualquer modalidade).

## Como funciona

**Entregas**
1. A expedição abre a lista do dia e lança os números (6 dígitos + Enter, ou cola uma coluna do Excel). Ao terminar, clica em **Enviar para conferência**.
2. O financeiro abre a lista e confere com a pilha física na mão:
   - `Espaço` grifa a condicional atual e pula para a próxima
   - `Backspace` desfaz a última marcação
   - `↑` `↓` navegam sem marcar
   - segurar o Espaço não marca várias de uma vez (de propósito)
3. **Assinar conferência**: o que ficou sem grifo vira **não recebida** (observação obrigatória).

**Balcão**
1. O financeiro abre a lista do balcão e lança os números: cada um já entra conferido no nome dele.
2. No fim do dia, **Fechar e assinar lista**.

**Paga / Cancelada**: qualquer usuário (expedição, financeiro ou administrador) marca, e fica registrado quem marcou. Desfazer exige motivo.

**Buscar** mostra o histórico completo de qualquer número e responde "quem viu por último".

**Imprimir** (qualquer usuário, botão no topo da lista): folha A4 só com os números, em dois modelos:
- *Folha para conferência manual*: caixas em branco + linhas de conferente, assinatura e data/hora;
- *Cópia da conferência registrada*: ✓ conferida, NR não recebida, Paga/Canc., e quem assinou no sistema.

**Resetar lista (dados de teste)** — só administrador, no rodapé da lista: apaga a lista daquele dia e modalidade (condicionais, marcações e histórico dela), como se nunca tivesse existido. Pede motivo e a palavra RESETAR. Fica apenas um registro de auditoria (`historico.acao = 'resetou_lista'`) com quem, quando, motivo e os números apagados. Não dá para desfazer.

## Regras

| | Expedição | Financeiro | Admin |
|---|---|---|---|
| Abrir lista | só Entregas | só Balcão | as duas |
| Entregas em preenchimento | lança, corrige, remove, envia | só vê | tudo |
| Entregas enviadas | corrige com motivo **até a conferência começar** | confere, corrige com motivo, assina | tudo |
| Balcão em lançamento | só vê | lança, corrige, remove, fecha | tudo |
| Lista assinada / fechada | só vê | reabre com motivo | tudo |
| Paga / Cancelada | sim | sim | sim |

- Tudo fica no histórico (quem, quando, o que mudou, motivo), gravado por gatilhos do próprio banco.
- Nada é apagado: "remover" só tira da lista; usuários são desativados, nunca excluídos. A única exceção é o reset de lista de teste, exclusivo do administrador e registrado.

## Estrutura

```
supabase/migrations/001_estrutura.sql   banco: tabelas, regras, histórico, permissões
supabase/migrations/002_modalidades.sql Entregas / Balcão e novas permissões
supabase/migrations/003_reset_lista.sql reset de lista de teste (só administrador)
supabase/functions/usuarios/index.ts    função de servidor: criar usuário / redefinir senha
src/lib/api.ts                          todas as chamadas ao Supabase
src/lib/permissoes.ts                   o que cada papel vê na tela (o banco é quem decide)
src/pages/Lista.tsx                     tela da lista: lançamento + conferência pelo teclado
src/pages/                              Listas, Buscar, Em aberto, Usuários, Login
```

- **Supabase**: projeto "Brunsfeld Condicionais" (região São Paulo)
- **Login**: usuário + senha. Por baixo é um e-mail interno `usuario@login.brunsfeld.local` (nenhum e-mail é enviado). O domínio está em `src/lib/config.ts` e na função `usuarios` e precisa ser igual nos dois.
- **Netlify**: publica sozinho a cada envio para a branch `main`.

## Rodar no computador

```bash
npm install
npm run dev
```

## Backup

O plano gratuito do Supabase não faz backup automático. Antes de abandonar o papel, ative o plano pago ou exporte os dados com frequência.
