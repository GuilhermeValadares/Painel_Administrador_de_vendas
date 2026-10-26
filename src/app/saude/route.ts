import { connection } from "next/server";
import { db } from "@/lib/db";

// Temporário: diz se o servidor consegue falar com o banco, sem mostrar segredos. Remover depois do diagnóstico.
export async function GET() {
  await connection();
  const url = process.env.DATABASE_URL ?? "";
  const info = {
    temDatabaseUrl: url.length > 0,
    comAspas: /^["']|["']$/.test(url),
    comSenhaPadrao: url.includes("[YOUR-PASSWORD]"),
    portaPooler: url.includes(":6543/"),
    temSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    regiao: process.env.VERCEL_REGION ?? null,
  };
  try {
    await db.venda.count();
    return Response.json({ ...info, banco: "ok" });
  } catch (e) {
    const erro = e as { code?: string; name?: string };
    return Response.json({ ...info, banco: "erro", tipo: erro.code ?? erro.name ?? "desconhecido" }, { status: 500 });
  }
}
