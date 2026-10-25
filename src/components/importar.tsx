"use client";

import { useState } from "react";
import { ArrowLeft, FileSpreadsheet, Pencil, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { lerPlanilha, salvarImportacao } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ItemImportado, type ResultadoImportacao } from "@/lib/importador";
import { FormVenda, type Sugestoes } from "./form-venda";

type Conferir = ItemImportado & { estado: "pendente" | "ok" | "fora" };

export function Importar({ aberto, fechar, sugestoes }: { aberto: boolean; fechar: () => void; sugestoes: Sugestoes }) {
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [conferir, setConferir] = useState<Conferir[]>([]);
  const [corrigindo, setCorrigindo] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function recomecar() {
    setResultado(null);
    setConferir([]);
    setCorrigindo(null);
    setErro(null);
  }

  async function escolherArquivo(arquivo?: File) {
    if (!arquivo) return;
    const form = new FormData();
    form.set("planilha", arquivo);
    setOcupado(true);
    setErro(null);
    const r = await lerPlanilha(form).catch(() => ({ erro: "Não consegui ler a planilha. Tente de novo." }));
    setOcupado(false);
    if ("erro" in r) return setErro(r.erro);
    setResultado(r);
    setConferir(r.conferir.map((c) => ({ ...c, estado: "pendente" })));
  }

  const mudarItem = (i: number, m: Partial<Conferir>) => setConferir((lista) => lista.map((c, j) => (j === i ? { ...c, ...m } : c)));
  const pendentes = conferir.filter((c) => c.estado === "pendente").length;
  const prontas = resultado ? [...resultado.vendas, ...conferir.filter((c) => c.estado === "ok")] : [];

  async function salvar() {
    setOcupado(true);
    const r = await salvarImportacao(prontas.map(({ venda, original }) => ({ venda, original })));
    setOcupado(false);
    if (r.erro) return setErro(r.erro);
    toast.success(`${prontas.length} vendas trazidas da planilha`);
    recomecar();
    fechar();
  }

  const item = corrigindo !== null ? conferir[corrigindo] : null;

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trazer minha planilha</DialogTitle>
          <DialogDescription>
            O que estiver claro eu organizo. O que tiver dúvida eu pergunto para você. Nada é salvo antes de você confirmar.
          </DialogDescription>
        </DialogHeader>

        {erro && <p role="alert" className="font-medium text-destructive">{erro}</p>}

        {!resultado && (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center focus-within:ring-3 focus-within:ring-ring/60 hover:bg-muted">
            <FileSpreadsheet className="size-10 text-primary" aria-hidden />
            <span className="text-lg font-medium">{ocupado ? "Lendo a planilha..." : "Toque aqui para escolher a planilha (.xlsx)"}</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={ocupado}
              onChange={(e) => escolherArquivo(e.target.files?.[0])}
            />
          </label>
        )}

        {resultado && item && corrigindo !== null && (
          <div className="flex flex-col gap-4">
            <Button variant="ghost" className="self-start" onClick={() => setCorrigindo(null)}>
              <ArrowLeft /> Voltar para a lista
            </Button>
            <Original item={item} />
            <FormVenda
              inicial={item.venda}
              sugestoes={sugestoes}
              textoBotao="Está certo assim"
              aoSalvar={async (venda) => {
                mudarItem(corrigindo, { venda, estado: "ok" });
                setCorrigindo(null);
              }}
            />
          </div>
        )}

        {resultado && corrigindo === null && (
          <div className="flex flex-col gap-5">
            <p className="rounded-xl bg-muted p-4 text-xl" role="status">
              Entendi <strong>{resultado.vendas.length} vendas</strong> e <strong>{conferir.length}</strong> precisam da sua conferência.
            </p>
            {resultado.estoque.length > 0 && (
              <div className="rounded-xl border p-4">
                <p className="font-medium">Deixei de fora {resultado.estoque.length} compra(s) de estoque, porque não são vendas:</p>
                <ul className="mt-2 list-disc pl-6 text-base text-muted-foreground">
                  {resultado.estoque.map((e) => <li key={e.linha}>Linha {e.linha}: {e.original}</li>)}
                </ul>
              </div>
            )}
            {resultado.vazias > 0 && <p className="text-base text-muted-foreground">Pulei {resultado.vazias} linha(s) vazia(s).</p>}

            {conferir.length > 0 && <h3 className="text-xl font-semibold">Para conferir</h3>}
            <ul className="flex flex-col gap-3">
              {conferir.map((c, i) => (
                <li key={c.linha} className={`rounded-xl border-2 p-4 ${c.estado === "pendente" ? "border-orange-300 bg-orange-50" : "opacity-70"}`}>
                  <Original item={c} />
                  {c.estado === "pendente" ? (
                    <>
                      <p className="mt-2 text-base font-medium text-orange-800">Existe um ou mais erros nesta venda.</p>
                      <p className="text-base">Sugestão: corrija.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setCorrigindo(i)}><Pencil /> Corrigir</Button>
                        <Button variant="ghost" onClick={() => mudarItem(i, { estado: "fora" })}><X /> Não trazer</Button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-medium">{c.estado === "ok" ? "✓ Conferida" : "Não vai ser trazida"}</span>
                      <Button variant="ghost" size="sm" onClick={() => mudarItem(i, { estado: "pendente" })}>Mudar</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="sticky bottom-0 flex flex-col gap-2 bg-popover pt-2">
              {pendentes > 0 && <p className="text-center font-medium text-orange-800">Falta conferir {pendentes}.</p>}
              <Button size="lg" onClick={salvar} disabled={ocupado || pendentes > 0 || !prontas.length}>
                <Upload /> {ocupado ? "Salvando..." : `Salvar ${prontas.length} vendas`}
              </Button>
              <Button variant="ghost" onClick={recomecar}>Escolher outro arquivo</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Original({ item }: { item: ItemImportado }) {
  return (
    <p className="text-base">
      <span className="font-semibold">Linha {item.linha} da planilha:</span>{" "}
      <span className="font-mono text-muted-foreground">{item.original}</span>
    </p>
  );
}

