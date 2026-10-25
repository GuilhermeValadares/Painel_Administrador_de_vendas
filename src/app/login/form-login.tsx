"use client";

import { useActionState } from "react";
import { LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar, esqueciSenha } from "./actions";

export function FormLogin({ erroLink }: { erroLink: boolean }) {
  const [erro, acaoEntrar, entrando] = useActionState(entrar, erroLink ? "Esse link já venceu. Peça outro em “Esqueci a senha”." : null);
  const [aviso, acaoEsqueci, enviando] = useActionState(esqueciSenha, null);

  return (
    <form action={acaoEntrar} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Seu e-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="senha">Sua senha</Label>
        <Input id="senha" name="senha" type="password" autoComplete="current-password" />
      </div>
      {erro && <p role="alert" className="text-destructive">{erro}</p>}
      <Button type="submit" size="lg" disabled={entrando}>
        <LogIn /> {entrando ? "Entrando..." : "Entrar"}
      </Button>
      <Button type="submit" variant="link" formAction={acaoEsqueci} formNoValidate disabled={enviando}>
        <Mail /> Esqueci a senha
      </Button>
      {aviso && <p role="status" className="text-center">{aviso}</p>}
    </form>
  );
}
