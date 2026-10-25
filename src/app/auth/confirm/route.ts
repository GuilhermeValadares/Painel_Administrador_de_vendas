import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

// Link do e-mail "Esqueci a senha": troca o código por uma sessão e segue para criar a senha nova.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const destino = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (code) {
    const { error } = await (await supabaseServidor()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, request.url));
  }
  return NextResponse.redirect(new URL("/login?erro=link", request.url));
}
