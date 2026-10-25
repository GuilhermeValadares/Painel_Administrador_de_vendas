"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { novaSenha } from "../login/actions";

export default function NovaSenha() {
  const [erro, acao, salvando] = useActionState(novaSenha, null);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10">
      <h1 className="text-center text-3xl font-semibold">Criar senha nova</h1>
      <form action={acao} className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <Label htmlFor="senha">Senha nova (pelo menos 8 letras ou números)</Label>
          <Input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        {erro && <p role="alert" className="text-destructive">{erro}</p>}
        <Button type="submit" size="lg" disabled={salvando}>
          <KeyRound /> Salvar senha
        </Button>
      </form>
    </main>
  );
}
