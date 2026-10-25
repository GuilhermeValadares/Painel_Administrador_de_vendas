import { Suspense } from "react";
import { FormLogin } from "./form-login";

export default function Login({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Vendas da Maria</h1>
        <p className="mt-2 text-muted-foreground">Entre para ver e anotar suas vendas</p>
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <Suspense>
          {searchParams.then((p) => (
            <FormLogin erroLink={p.erro === "link"} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}
