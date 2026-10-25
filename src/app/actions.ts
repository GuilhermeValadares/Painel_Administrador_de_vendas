"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { importar, type ResultadoImportacao } from "@/lib/importador";
import { donoId } from "@/lib/supabase/server";
import { errosPorCampo, hoje, type VendaValida, vendaSchema } from "@/lib/venda";

// Toda ação relê a dona da sessão e filtra por ela: o Prisma não passa pelo RLS do Supabase.

export type Resposta = { erros?: Record<string, string>; erro?: string };

const id = z.uuid();
const paraBanco = ({ data, ...v }: VendaValida) => ({ ...v, data: new Date(data + "T00:00:00Z") });

export async function salvarVenda(entrada: unknown, vendaId?: string): Promise<Resposta> {
  const dono = await donoId();
  const r = vendaSchema.safeParse(entrada);
  if (!r.success) return { erros: errosPorCampo(r.error) };
  if (vendaId) {
    const { count } = await db.venda.updateMany({
      where: { id: id.parse(vendaId), donoId: dono, apagadaEm: null },
      data: paraBanco(r.data),
    });
    if (!count) return { erro: "Não achei essa venda. Ela pode ter sido apagada." };
  } else {
    await db.venda.create({ data: { ...paraBanco(r.data), donoId: dono } });
  }
  revalidatePath("/");
  return {};
}

export async function apagarVenda(vendaId: string) {
  const dono = await donoId();
  await db.venda.updateMany({ where: { id: id.parse(vendaId), donoId: dono }, data: { apagadaEm: new Date() } });
  revalidatePath("/");
}

export async function desfazerApagar(vendaId: string) {
  const dono = await donoId();
  await db.venda.updateMany({ where: { id: id.parse(vendaId), donoId: dono }, data: { apagadaEm: null } });
  revalidatePath("/");
}

/** "Já pagou": troca só o pagamento, passando pela mesma validação do formulário. */
export async function marcarPago(vendaId: string, pagamento: unknown): Promise<Resposta> {
  const dono = await donoId();
  const venda = await db.venda.findFirst({ where: { id: id.parse(vendaId), donoId: dono, apagadaEm: null } });
  if (!venda) return { erro: "Não achei essa venda." };
  const r = vendaSchema.safeParse({
    ...venda,
    data: venda.data.toISOString().slice(0, 10),
    cliente: venda.cliente ?? undefined,
    rastreio: venda.rastreio ?? undefined,
    observacao: venda.observacao ?? undefined,
    ...(pagamento as object),
  });
  if (!r.success) return { erros: errosPorCampo(r.error) };
  if (r.data.pagamento === "PENDENTE") return { erros: { pagamento: "Escolha como ela pagou" } };
  await db.venda.update({
    where: { id: venda.id },
    data: { pagamento: r.data.pagamento, cartao: r.data.cartao, parcelas: r.data.parcelas },
  });
  revalidatePath("/");
  return {};
}

const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const MAX_LINHAS = 5000;
const MAX_COLUNAS = 30;

function texto(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v !== "object") return String(v);
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("result" in v) return texto(v.result as ExcelJS.CellValue);
  if ("text" in v) return String(v.text);
  return "";
}

/** Lê a planilha e devolve o que o importador entendeu. Ainda não salva nada. */
export async function lerPlanilha(form: FormData): Promise<ResultadoImportacao | { erro: string }> {
  await donoId();
  const arquivo = form.get("planilha");
  if (!(arquivo instanceof File) || !arquivo.name.toLowerCase().endsWith(".xlsx"))
    return { erro: "Escolha um arquivo do Excel (que termina em .xlsx)" };
  if (arquivo.size > TAMANHO_MAXIMO) return { erro: "Esse arquivo é grande demais (máximo 5 MB)" };

  const livro = new ExcelJS.Workbook();
  try {
    await livro.xlsx.load(await arquivo.arrayBuffer());
  } catch {
    return { erro: "Não consegui abrir esse arquivo. Ele é mesmo uma planilha do Excel?" };
  }
  const aba = livro.worksheets[0];
  if (!aba) return { erro: "A planilha está vazia" };
  if (aba.rowCount > MAX_LINHAS || aba.columnCount > MAX_COLUNAS)
    return { erro: `A planilha é grande demais (máximo ${MAX_LINHAS} linhas e ${MAX_COLUNAS} colunas)` };
  const linhas: string[][] = [];
  for (let l = 1; l <= aba.rowCount; l++) {
    const row = aba.getRow(l);
    linhas.push(Array.from({ length: aba.columnCount }, (_, c) => texto(row.getCell(c + 1).value)));
  }
  return importar(linhas, hoje());
}

const importacaoSchema = z.array(z.object({ venda: z.unknown(), original: z.string().max(5000) })).max(5000);

/** Salva as vendas já conferidas na tela, guardando o texto original de cada linha. */
export async function salvarImportacao(itens: unknown): Promise<Resposta> {
  const dono = await donoId();
  const lista = importacaoSchema.safeParse(itens);
  if (!lista.success) return { erro: "Algo deu errado com a lista. Tente importar de novo." };
  const dados = [];
  for (const [i, item] of lista.data.entries()) {
    const r = vendaSchema.safeParse(item.venda);
    if (!r.success) return { erro: `A venda ${i + 1} ainda tem algo para conferir: ${r.error.issues[0].message}` };
    dados.push({ ...paraBanco(r.data), donoId: dono, origem: "IMPORTADA" as const, textoOriginal: item.original });
  }
  await db.venda.createMany({ data: dados });
  revalidatePath("/");
  return {};
}
