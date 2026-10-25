import { z } from "zod";

// Mesmos valores dos enums do Prisma (prisma/schema.prisma).
export const PAGAMENTOS = ["PIX", "DINHEIRO", "DEBITO", "CREDITO", "PENDENTE"] as const;
export const CARTOES = ["VISA", "MASTER", "ELO", "OUTRO"] as const;
export const ENTREGAS = ["NA_HORA", "BUSCOU", "CORREIOS", "MOTOBOY"] as const;
export const TIPOS = ["VENDA", "DEVOLUCAO"] as const;

export type Pagamento = (typeof PAGAMENTOS)[number];
export type Cartao = (typeof CARTOES)[number];
export type Entrega = (typeof ENTREGAS)[number];
export type Tipo = (typeof TIPOS)[number];

export const NOME_PAGAMENTO: Record<Pagamento, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  PENDENTE: "Ainda não pagou",
};
export const NOME_CARTAO: Record<Cartao, string> = { VISA: "Visa", MASTER: "Master", ELO: "Elo", OUTRO: "Outro" };
export const NOME_ENTREGA: Record<Entrega, string> = {
  NA_HORA: "Levou na hora",
  BUSCOU: "Veio buscar",
  CORREIOS: "Correios",
  MOTOBOY: "Motoboy",
};

export const RASTREIO = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

/** "35", "35,00", "R$ 1.234,56", "35.5" → centavos. Devolve null se não for um número. */
export function paraCentavos(texto: string): number | null {
  let t = texto.replace(/r\$|\s/gi, "");
  if (!/^-?[\d.,]+$/.test(t)) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // 1.234 = mil duzentos e trinta e quatro
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function reais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Valor em texto para o campo do formulário: 3500 → "35,00". */
export function valorTexto(centavos: number | null | undefined): string {
  return centavos ? (centavos / 100).toFixed(2).replace(".", ",") : "";
}

/** Data de hoje (AAAA-MM-DD) no horário de Brasília. */
export function hoje(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(data + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function dataBR(data: string): string {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

const textoOpcional = z.string().trim().max(500).optional().transform((t) => t || null);

export const vendaSchema = z
  .object({
    data: z.iso.date({ error: "Falta dizer quando foi" }),
    produto: z.string({ error: "Falta dizer o que você vendeu" }).trim().min(1, "Falta dizer o que você vendeu").max(200),
    cliente: textoOpcional,
    valorCentavos: z
      .number({ error: "Falta dizer quanto foi" })
      .int()
      .positive("O valor precisa ser maior que zero")
      .max(100_000_000, "Esse valor parece grande demais"),
    pagamento: z.enum(PAGAMENTOS, { error: "Falta dizer como pagou" }),
    cartao: z.enum(CARTOES).nullish(),
    parcelas: z.number().int().min(1).max(12, "No máximo 12 vezes").nullish(),
    entrega: z.enum(ENTREGAS, { error: "Falta dizer como a cliente recebeu" }),
    rastreio: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .refine((r) => !r || RASTREIO.test(r), "O código tem 2 letras, 9 números e 2 letras (ex.: AA123456789BR)"),
    observacao: textoOpcional,
    tipo: z.enum(TIPOS).default("VENDA"),
  })
  .superRefine((v, ctx) => {
    const cartao = v.pagamento === "DEBITO" || v.pagamento === "CREDITO";
    if (cartao && !v.cartao) ctx.addIssue({ code: "custom", path: ["cartao"], message: "Falta dizer qual cartão" });
    if (v.pagamento === "CREDITO" && !v.parcelas)
      ctx.addIssue({ code: "custom", path: ["parcelas"], message: "Falta dizer em quantas vezes" });
  })
  // Limpa o que não vale para a escolha feita (ex.: rastreio de quem levou na hora).
  .transform((v) => {
    const cartao = v.pagamento === "DEBITO" || v.pagamento === "CREDITO";
    return {
      ...v,
      cartao: cartao ? v.cartao! : null,
      parcelas: v.pagamento === "CREDITO" ? v.parcelas! : v.pagamento === "DEBITO" ? 1 : null,
      rastreio: v.entrega === "CORREIOS" && v.rastreio ? v.rastreio : null,
    };
  });

export type VendaEntrada = z.input<typeof vendaSchema>;
export type VendaValida = z.output<typeof vendaSchema>;

/** Primeira mensagem de erro de cada campo, para mostrar na tela. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const r: Record<string, string> = {};
  for (const i of erro.issues) r[String(i.path[0])] ??= i.message;
  return r;
}
