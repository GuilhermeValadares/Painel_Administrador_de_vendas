"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";

export async function entrar(_: string | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  if (!email || !senha) return "Falta preencher o e-mail e a senha";
  const { error } = await (await supabaseServidor()).auth.signInWithPassword({ email, password: senha });
  if (error) return "O e-mail ou a senha não conferem. Tente de novo.";
  redirect("/");
}

export async function esqueciSenha(_: string | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  if (!email) return "Escreva o seu e-mail acima e toque de novo em “Esqueci a senha”";
  const origem = (await headers()).get("origin");
  await (await supabaseServidor()).auth.resetPasswordForEmail(email, {
    redirectTo: `${origem}/auth/confirm?next=/nova-senha`,
  });
  // Mesma resposta exista ou não a conta, para não revelar quais e-mails estão cadastrados.
  return "Pronto! Se o e-mail estiver certo, chega um link para criar uma senha nova.";
}

export async function novaSenha(_: string | null, form: FormData) {
  const senha = String(form.get("senha") ?? "");
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 letras ou números";
  const { error } = await (await supabaseServidor()).auth.updateUser({ password: senha });
  if (error) return "Não deu para trocar a senha. Peça um link novo na tela de entrada.";
  redirect("/");
}

export async function sair() {
  await (await supabaseServidor()).auth.signOut();
  redirect("/login");
}
