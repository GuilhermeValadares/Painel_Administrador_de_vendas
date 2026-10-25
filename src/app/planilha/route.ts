import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { donoId } from "@/lib/supabase/server";
import { hoje, NOME_CARTAO, NOME_ENTREGA, NOME_PAGAMENTO } from "@/lib/venda";

// "Baixar planilha": as vendas organizadas, com as colunas que a Maria já conhece.
export async function GET() {
  const dono = await donoId();
  const vendas = await db.venda.findMany({
    where: { donoId: dono, apagadaEm: null },
    orderBy: [{ data: "asc" }, { criadaEm: "asc" }],
  });

  const livro = new ExcelJS.Workbook();
  const aba = livro.addWorksheet("Vendas");
  aba.columns = [
    { header: "Data", key: "data", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "O que vendeu", key: "produto", width: 30 },
    { header: "Para quem", key: "cliente", width: 22 },
    { header: "Valor", key: "valor", width: 12, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Como pagou", key: "pagamento", width: 16 },
    { header: "Cartão", key: "cartao", width: 10 },
    { header: "Vezes", key: "parcelas", width: 8 },
    { header: "Entrega", key: "entrega", width: 15 },
    { header: "Rastreio", key: "rastreio", width: 16 },
    { header: "Observação", key: "observacao", width: 30 },
    { header: "Tipo", key: "tipo", width: 11 },
  ];
  aba.getRow(1).font = { bold: true };
  aba.views = [{ state: "frozen", ySplit: 1 }];
  for (const v of vendas) {
    aba.addRow({
      ...v,
      valor: (v.tipo === "DEVOLUCAO" ? -v.valorCentavos : v.valorCentavos) / 100,
      pagamento: NOME_PAGAMENTO[v.pagamento],
      cartao: v.cartao && NOME_CARTAO[v.cartao],
      entrega: NOME_ENTREGA[v.entrega],
      tipo: v.tipo === "DEVOLUCAO" ? "Devolução" : "Venda",
    });
  }

  return new Response(await livro.xlsx.writeBuffer(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vendas-${hoje()}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
