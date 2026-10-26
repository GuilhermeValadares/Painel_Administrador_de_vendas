import { connection } from "next/server";
import { Suspense } from "react";
import { Painel, type VendaLinha } from "@/components/painel";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { donoId } from "@/lib/supabase/server";
import { hoje, somarDias } from "@/lib/venda";

export default function Inicio({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-xl">Carregando suas vendas...</p>}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

const dia = (iso: string) => new Date(iso + "T00:00:00Z");
const BUSCA = ["produto", "cliente", "observacao", "rastreio"] as const;

async function Conteudo({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await connection(); // a sessão e a data de hoje só existem no momento do pedido
  const dono = await donoId();
  const p = await searchParams;
  const q = typeof p.q === "string" ? p.q.trim().slice(0, 100) : "";
  const filtro = typeof p.filtro === "string" ? p.filtro : "tudo";

  // Datas do filtro "De / Até": só vale AAAA-MM-DD de verdade; se vier trocado, inverte.
  const lerDia = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(dia(v).getTime()) && dia(v).toISOString().startsWith(v) ? v : "");
  let [de, ate] = [lerDia(p.de), lerDia(p.ate)];
  if (de && ate && de > ate) [de, ate] = [ate, de];

  const hojeISO = hoje();
  const inicioMes = hojeISO.slice(0, 8) + "01";
  const inicioSemana = somarDias(hojeISO, -dia(hojeISO).getUTCDay()); // semana começa no domingo
  const base = { donoId: dono, apagadaEm: null } satisfies Prisma.VendaWhereInput;

  const where: Prisma.VendaWhereInput = {
    ...base,
    ...(filtro === "hoje" && { data: dia(hojeISO) }),
    ...(filtro === "semana" && { data: { gte: dia(inicioSemana) } }),
    ...(filtro === "mes" && { data: { gte: dia(inicioMes) } }),
    ...((de || ate) && { data: { ...(de && { gte: dia(de) }), ...(ate && { lte: dia(ate) }) } }),
    ...(filtro === "receber" && { pagamento: "PENDENTE", tipo: "VENDA" }),
    ...(filtro === "rastreio" && { entrega: "CORREIOS", rastreio: null }),
    ...(q && { OR: BUSCA.map((c) => ({ [c]: { contains: q, mode: "insensitive" } })) }),
  };

  // Devoluções entram subtraindo do total.
  const vendido = async (data: Prisma.VendaWhereInput["data"]) => {
    const grupos = await db.venda.groupBy({ by: ["tipo"], where: { ...base, data }, _sum: { valorCentavos: true } });
    return grupos.reduce((t, g) => t + (g.tipo === "DEVOLUCAO" ? -1 : 1) * (g._sum.valorCentavos ?? 0), 0);
  };

  const dados = await Promise.all([
    vendido(dia(hojeISO)),
    vendido({ gte: dia(inicioMes), lte: dia(hojeISO) }),
    db.venda.aggregate({ where: { ...base, pagamento: "PENDENTE", tipo: "VENDA" }, _sum: { valorCentavos: true }, _count: true }),
    // shortcut: mostra as 200 mais recentes; paginar se a lista passar disso com frequência.
    db.venda.findMany({ where, orderBy: [{ data: "desc" }, { criadaEm: "desc" }], take: 200 }),
    db.venda.findMany({
      where: { ...base, tipo: "VENDA" },
      distinct: ["produto"],
      orderBy: { data: "desc" },
      select: { produto: true, valorCentavos: true },
      take: 300,
    }),
    db.venda.findMany({
      where: { ...base, cliente: { not: null } },
      distinct: ["cliente"],
      orderBy: { data: "desc" },
      select: { cliente: true },
      take: 300,
    }),
  ]).catch(() => null);
  if (!dados) return <ErroBanco semUrl={!process.env.DATABASE_URL} />;
  const [vendidoHoje, vendidoMes, receber, lista, produtos, clientes] = dados;

  const vendas: VendaLinha[] = lista.map((v) => ({
    id: v.id,
    data: v.data.toISOString().slice(0, 10),
    produto: v.produto,
    cliente: v.cliente,
    valorCentavos: v.valorCentavos,
    pagamento: v.pagamento,
    cartao: v.cartao,
    parcelas: v.parcelas,
    entrega: v.entrega,
    rastreio: v.rastreio,
    observacao: v.observacao,
    tipo: v.tipo,
  }));

  return (
    <Painel
      resumo={{ hoje: vendidoHoje, mes: vendidoMes, receber: receber._sum.valorCentavos ?? 0, qtdReceber: receber._count }}
      vendas={vendas}
      sugestoes={{ produtos, clientes: clientes.map((c) => c.cliente!) }}
      q={q}
      filtro={filtro}
      de={de}
      ate={ate}
    />
  );
}

// Só chega aqui quem já entrou: explica a falha em vez da tela de erro genérica.
function ErroBanco({ semUrl }: { semUrl: boolean }) {
  return (
    <main className="mx-auto max-w-xl p-8 text-center">
      <h1 className="text-2xl font-semibold">Não consegui abrir as vendas</h1>
      <p className="mt-3">
        {semUrl
          ? "O site ainda não está ligado ao banco de dados (falta a variável DATABASE_URL na Vercel)."
          : "O site não conseguiu falar com o banco de dados. Confira a variável DATABASE_URL na Vercel (sem aspas e com a senha certa)."}
      </p>
    </main>
  );
}
