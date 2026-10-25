# Vendas da Maria

Painel web para a Maria anotar, achar e corrigir as vendas da loja, trazer a planilha antiga e baixar tudo de volta em Excel. Construído a partir do [PRD 001](PRDs/001-Gerenciador-de-vendas.md).

Stack: Next.js 16 (App Router), React 19, TypeScript, Prisma 7, Supabase (PostgreSQL e Auth), Zod, Tailwind CSS 4, shadcn/ui, ExcelJS e Vitest.

## Como rodar

1. **Crie um projeto no Supabase.**
2. **Desligue o cadastro público:** Authentication > Sign In / Providers > desmarque "Allow new users to sign up".
3. **Crie a conta da Maria:** Authentication > Users > Add user (e-mail e senha).
4. **Ajuste as URLs:** em Authentication > URL Configuration, coloque a URL do site (ex.: `http://localhost:3000` ou a da Vercel) em Site URL e em Redirect URLs. O link de "Esqueci a senha" precisa disso.
5. **Configure as variáveis** (`APP_URL` é o endereço do site, usado no link de "Esqueci a senha"):
   ```bash
   cp .env.example .env.local   # e preencha com os dados do Supabase
   ```
6. **Instale e crie a tabela:**
   ```bash
   npm install
   npm run db:migrate           # cria a tabela "vendas" e liga o RLS
   npm run dev
   ```

Use `prisma migrate deploy` (o `npm run db:migrate`) e não `migrate dev`: a migração cita `auth.uid()`, que não existe no banco-sombra usado pelo `migrate dev`.

## Testes

```bash
npm test
```

Os testes cobrem o importador e as regras de valor, data e pagamento (`src/lib/*.test.ts`).

## Onde está cada coisa

| Arquivo | O que faz |
| --- | --- |
| `src/lib/venda.ts` | Campos da venda, validação (Zod) com mensagens em português, dinheiro em centavos |
| `src/lib/importador.ts` | Função pura que lê as linhas da planilha e separa em vendas, "Para conferir" e compras de estoque |
| `src/app/actions.ts` | Ações do servidor: salvar, apagar/desfazer, "Já pagou", ler e salvar a importação |
| `src/app/planilha/route.ts` | "Baixar planilha" (.xlsx) |
| `src/app/page.tsx` | Painel: resumo, busca, atalhos e lista |
| `src/components/` | Telas do painel, formulário da venda e importação |
| `src/proxy.ts` | Renova a sessão e manda quem não entrou para o login |
| `prisma/` | Schema e migração (com Row Level Security) |

## Segurança

- O Prisma conecta direto no PostgreSQL e **não passa pelo RLS**. Por isso toda consulta filtra por `dono_id`, lido da sessão verificada no servidor (`donoId()` em `src/lib/supabase/server.ts`). O RLS fica ligado como segunda barreira.
- Apagar só marca `apagada_em`, o que permite o "Desfazer".
- Na importação, o texto original de cada linha fica guardado em `texto_original`.

## Deploy na Vercel

1. Importe o repositório em vercel.com/new e, antes de tocar em **Deploy**, preencha as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `DATABASE_URL` (a do pooler, porta 6543)
   - `APP_URL` é opcional: sem ela, o link de "Esqueci a senha" usa o endereço de produção da Vercel. Preencha só se usar domínio próprio.
   `DIRECT_URL` não é necessária lá: serve só para rodar migrações no seu computador.
2. No Supabase, em Authentication > URL Configuration, coloque o endereço do site em Site URL e em Redirect URLs.

O `postinstall` gera o Prisma Client no build. O `vercel.json` fixa a região em São Francisco (sfo1), perto do banco no Supabase (us-west-2).
