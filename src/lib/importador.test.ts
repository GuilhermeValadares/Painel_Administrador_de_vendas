import { describe, expect, it } from "vitest";
import { importar } from "./importador";
import { paraCentavos, vendaSchema } from "./venda";

// Linhas inspiradas nos exemplos reais do PRD.
// shortcut: trocar pelas 72 linhas reais da planilha da Maria quando o arquivo estiver no repositório.
const CABECALHO = ["data", "o que vendeu", "pra quem", "valor", "como pagou", "cartão", "vezes", "entrega ou loja", "rastreio", "observação"];
const HOJE = "2026-10-25";

const rodar = (...linhas: string[][]) => importar([CABECALHO, ...linhas], HOJE);
const linha = (o: Partial<Record<"data" | "produto" | "cliente" | "valor" | "pag" | "cartao" | "vezes" | "entrega" | "rastreio" | "obs", string>>) => [
  o.data ?? "", o.produto ?? "", o.cliente ?? "", o.valor ?? "", o.pag ?? "", o.cartao ?? "", o.vezes ?? "", o.entrega ?? "", o.rastreio ?? "", o.obs ?? "",
];
const base = { data: "2026-08-06", produto: "brinco argola", cliente: "Ana", valor: "35", pag: "pix", entrega: "loja" };

describe("paraCentavos", () => {
  it("entende os jeitos da Maria escrever valor", () => {
    expect(paraCentavos("35")).toBe(3500);
    expect(paraCentavos("35,00")).toBe(3500);
    expect(paraCentavos("R$ 35")).toBe(3500);
    expect(paraCentavos("R$ 1.234,56")).toBe(123456);
    expect(paraCentavos("1.234")).toBe(123400);
    expect(paraCentavos("35.5")).toBe(3550);
    expect(paraCentavos("-40")).toBe(-4000);
    expect(paraCentavos("trinta")).toBeNull();
  });
});

describe("vendaSchema", () => {
  const ok = { data: "2026-08-06", produto: "colar", valorCentavos: 3500, pagamento: "PIX", entrega: "NA_HORA" } as const;
  it("aceita uma venda simples e limpa campos que não valem", () => {
    const r = vendaSchema.parse({ ...ok, cartao: "VISA", parcelas: 3, rastreio: "AA123456789BR" });
    expect(r).toMatchObject({ cartao: null, parcelas: null, rastreio: null, tipo: "VENDA" });
  });
  it("débito é sempre 1 vez", () => {
    expect(vendaSchema.parse({ ...ok, pagamento: "DEBITO", cartao: "ELO", parcelas: 5 }).parcelas).toBe(1);
  });
  it("exige cartão e parcelas no crédito, com mensagens que ensinam", () => {
    const r = vendaSchema.safeParse({ ...ok, pagamento: "CREDITO" });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message)).toEqual(["Falta dizer qual cartão", "Falta dizer em quantas vezes"]);
  });
  it("recusa rastreio fora do formato e valor zero", () => {
    expect(vendaSchema.safeParse({ ...ok, entrega: "CORREIOS", rastreio: "123" }).success).toBe(false);
    expect(vendaSchema.safeParse({ ...ok, valorCentavos: 0 }).success).toBe(false);
  });
});

describe("importar", () => {
  it("linha limpa vira venda", () => {
    const r = rodar(linha(base));
    expect(r.conferir).toEqual([]);
    expect(r.vendas[0].venda).toMatchObject({ data: "2026-08-06", valorCentavos: 3500, pagamento: "PIX", entrega: "NA_HORA" });
    expect(r.vendas[0].original).toContain("brinco argola");
  });

  it("padroniza datas 4/8 e 8/16/26", () => {
    const r = rodar(linha({ ...base, data: "4/8" }), linha({ ...base, data: "8/16/26", produto: "anel" }));
    expect(r.vendas.map((v) => v.venda.data)).toEqual(["2026-08-04", "2026-08-16"]);
  });

  it("data ambígua usa a vizinha como pista e pede conferência", () => {
    const r = rodar(linha({ ...base, data: "2026-08-05" }), linha({ ...base, data: "8/6/26", produto: "anel" }));
    expect(r.conferir[0].venda.data).toBe("2026-08-06");
    expect(r.conferir[0].motivos[0]).toMatch(/pode ser/);
  });

  it("ontem, segunda e vazia sugerem a data da linha anterior", () => {
    const r = rodar(
      linha({ ...base, data: "2026-08-10" }),
      linha({ ...base, data: "ontem", produto: "a" }),
      linha({ ...base, data: "segunda", produto: "b" }),
      linha({ ...base, data: "", produto: "c" }),
    );
    expect(r.conferir.map((c) => c.venda.data)).toEqual(["2026-08-10", "2026-08-10", "2026-08-10"]);
  });

  it("data fora do período pede conferência", () => {
    const r = rodar(linha(base), linha({ ...base, produto: "x" }), linha({ ...base, data: "12/3", produto: "y" }), linha({ ...base, data: "12 de marco", produto: "z" }));
    expect(r.conferir.map((c) => c.venda.produto)).toEqual(["y", "z"]);
  });

  it("35+12 frete separa valor e observação, mas pede conferência", () => {
    const r = rodar(linha({ ...base, valor: "35+12 frete" }));
    expect(r.conferir[0].venda).toMatchObject({ valorCentavos: 3500, observacao: "frete R$ 12" });
  });

  it("valor vazio pede conferência; -40 vira devolução", () => {
    const r = rodar(linha({ ...base, valor: "" }), linha({ ...base, valor: "-40", produto: "colar" }));
    expect(r.conferir[0].motivos).toContain("Falta o valor");
    expect(r.vendas[0].venda).toMatchObject({ tipo: "DEVOLUCAO", valorCentavos: 4000 });
  });

  it("credito 3x visa numa célula e maquinha com parcelas", () => {
    const r = rodar(linha({ ...base, pag: "credito 3x visa" }), linha({ ...base, produto: "anel", pag: "maquinha", cartao: "master", vezes: "2" }));
    expect(r.vendas.map((v) => [v.venda.pagamento, v.venda.parcelas, v.venda.cartao])).toEqual([
      ["CREDITO", 3, "VISA"],
      ["CREDITO", 2, "MASTER"],
    ]);
  });

  it("fiado e depois paga viram Ainda não pagou", () => {
    const r = rodar(linha({ ...base, pag: "fiado" }), linha({ ...base, produto: "anel", pag: "depois paga" }));
    expect(r.vendas.map((v) => v.venda.pagamento)).toEqual(["PENDENTE", "PENDENTE"]);
  });

  it("pagamento vazio com 'pagou no pix' sugere Pix e pede conferência", () => {
    const r = rodar(linha({ ...base, pag: "", obs: "pagou no pix" }));
    expect(r.conferir[0].venda.pagamento).toBe("PIX");
  });

  it("move rastreio da coluna 'pra quem' e mantém telefone como cliente", () => {
    const r = rodar(
      linha({ ...base, cliente: "AA123456789BR", entrega: "correios" }),
      linha({ ...base, produto: "anel", cliente: "(11) 98888-7777", entrega: "sedex" }),
    );
    expect(r.vendas[0].venda).toMatchObject({ cliente: undefined, rastreio: "AA123456789BR", entrega: "CORREIOS" });
    expect(r.vendas[1].venda).toMatchObject({ cliente: "(11) 98888-7777", entrega: "CORREIOS" });
  });

  it("traduz as entregas", () => {
    const r = rodar(
      linha({ ...base, entrega: "presencial" }),
      linha({ ...base, produto: "b", entrega: "ela veio buscar" }),
      linha({ ...base, produto: "c", entrega: "motoboy" }),
    );
    expect(r.vendas.map((v) => v.venda.entrega)).toEqual(["NA_HORA", "BUSCOU", "MOTOBOY"]);
  });

  it("compra de estoque fica de fora; linha vazia é ignorada", () => {
    const r = rodar(linha({ ...base, produto: "comprei 20 argolas", valor: "200" }), linha({}), linha(base));
    expect(r.estoque).toHaveLength(1);
    expect(r.vazias).toBe(1);
    expect(r.vendas).toHaveLength(1);
  });

  it("linha repetida pede conferência", () => {
    const r = rodar(linha(base), linha(base));
    expect(r.vendas).toHaveLength(1);
    expect(r.conferir[0].motivos[0]).toMatch(/repetida da linha 2/);
  });

  it("tudo que foi para 'vendas' passa na validação do formulário", () => {
    const r = rodar(linha(base), linha({ ...base, data: "4/8", pag: "credito 3x visa", entrega: "correios", rastreio: "aa123456789br" }));
    for (const v of r.vendas) expect(vendaSchema.safeParse(v.venda).success).toBe(true);
  });
});
