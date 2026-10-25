"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleDollarSign, Download, FileUp, LogOut, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apagarVenda, desfazerApagar, marcarPago, salvarVenda } from "@/app/actions";
import { sair } from "@/app/login/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type Cartao,
  dataBR,
  type Entrega,
  NOME_CARTAO,
  NOME_ENTREGA,
  NOME_PAGAMENTO,
  type Pagamento,
  reais,
  type Tipo,
} from "@/lib/venda";
import { CamposPagamento, FormVenda, type Sugestoes } from "./form-venda";
import { Importar } from "./importar";

export type VendaLinha = {
  id: string;
  data: string;
  produto: string;
  cliente: string | null;
  valorCentavos: number;
  pagamento: Pagamento;
  cartao: Cartao | null;
  parcelas: number | null;
  entrega: Entrega;
  rastreio: string | null;
  observacao: string | null;
  tipo: Tipo;
};

export type Resumo = { hoje: number; mes: number; receber: number; qtdReceber: number };

export const FILTROS = [
  ["hoje", "Hoje"],
  ["semana", "Esta semana"],
  ["mes", "Este mês"],
  ["tudo", "Tudo"],
  ["receber", "A receber"],
  ["rastreio", "Falta rastreio"],
] as const;

export function Painel({
  resumo,
  vendas,
  sugestoes,
  q,
  filtro,
}: {
  resumo: Resumo;
  vendas: VendaLinha[];
  sugestoes: Sugestoes;
  q: string;
  filtro: string;
}) {
  const router = useRouter();
  const [buscando, startTransition] = useTransition();
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [editando, setEditando] = useState<VendaLinha | "nova" | null>(null);
  const [apagando, setApagando] = useState<VendaLinha | null>(null);
  const [pagando, setPagando] = useState<VendaLinha | null>(null);
  const [importando, setImportando] = useState(false);

  function irPara(busca: string, f: string) {
    const p = new URLSearchParams();
    if (busca.trim()) p.set("q", busca.trim());
    if (f !== "tudo") p.set("filtro", f);
    startTransition(() => router.replace(p.size ? `/?${p}` : "/", { scroll: false }));
  }

  function buscar(texto: string) {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => irPara(texto, filtro), 300);
  }

  async function confirmarApagar() {
    if (!apagando) return;
    const { id } = apagando;
    setApagando(null);
    await apagarVenda(id);
    toast("Venda apagada", {
      duration: 10_000,
      action: { label: "Desfazer", onClick: () => desfazerApagar(id).then(() => toast.success("A venda voltou")) },
    });
  }

  const link = (f: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (f !== "tudo") p.set("filtro", f);
    return p.size ? `/?${p}` : "/";
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Vendas da Maria</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportando(true)}>
            <FileUp /> Trazer planilha
          </Button>
          <Button variant="outline" nativeButton={false} render={<a href="/planilha" download />}>
            <Download /> Baixar planilha
          </Button>
          <form action={sair}>
            <Button variant="ghost" type="submit">
              <LogOut /> Sair
            </Button>
          </form>
        </div>
      </header>

      <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-3">
        <Cartao titulo="Vendido hoje" valor={reais(resumo.hoje)} />
        <Cartao titulo="Vendido neste mês" valor={reais(resumo.mes)} />
        <Link
          href={link("receber")}
          className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-5 text-orange-900 outline-none hover:bg-orange-100 focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <p className="text-lg">A receber</p>
          <p className="text-3xl font-semibold">{reais(resumo.receber)}</p>
          <p className="text-base">{resumo.qtdReceber === 1 ? "1 venda" : `${resumo.qtdReceber} vendas`} · ver quem deve</p>
        </Link>
      </section>

      <Button size="lg" className="h-16 text-2xl" onClick={() => setEditando("nova")}>
        <Plus className="size-7" /> Nova venda
      </Button>

      <section aria-label="Vendas" className="flex flex-col gap-4">
        <div className="relative">
          <label htmlFor="busca" className="sr-only">Procurar venda</label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="busca"
            type="search"
            defaultValue={q}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Procurar por cliente, produto, rastreio..."
            className="h-14 bg-background pl-11"
          />
        </div>
        <nav aria-label="Atalhos" className="flex gap-2 overflow-x-auto pb-1">
          {FILTROS.map(([f, nome]) => (
            <Link
              key={f}
              href={link(f)}
              replace
              scroll={false}
              aria-current={filtro === f ? "page" : undefined}
              className="flex h-12 shrink-0 items-center rounded-full border-2 px-4 text-lg whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/60 aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {nome}
            </Link>
          ))}
        </nav>

        <div aria-live="polite" className={buscando ? "opacity-60 transition-opacity" : undefined}>
          {vendas.length === 0 ? (
            <p className="rounded-2xl border bg-card p-8 text-center text-xl">
              {q || filtro !== "tudo" ? "Nenhuma venda encontrada." : "Ainda não há vendas. Toque em + Nova venda."}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {vendas.map((v) => (
                <ItemVenda key={v.id} v={v} editar={() => setEditando(v)} apagar={() => setApagando(v)} pagar={() => setPagando(v)} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <Dialog open={editando !== null} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editando === "nova" ? "Nova venda" : "Corrigir venda"}</DialogTitle>
          </DialogHeader>
          {editando !== null && (
            <FormVenda
              key={editando === "nova" ? "nova" : editando.id}
              inicial={editando === "nova" ? undefined : paraFormulario(editando)}
              sugestoes={sugestoes}
              aoSalvar={async (venda) => {
                const r = await salvarVenda(venda, editando === "nova" ? undefined : editando.id);
                if (r.erros || r.erro) return r;
                toast.success("Venda salva");
                setEditando(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={apagando !== null} onOpenChange={(o) => !o && setApagando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai apagar a venda de {apagando?.produto}
              {apagando?.cliente ? ` para ${apagando.cliente}` : ""}. Se errar, dá para desfazer logo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmarApagar}>
              <Trash2 /> Sim, apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <JaPagou venda={pagando} fechar={() => setPagando(null)} />
      <Importar aberto={importando} fechar={() => setImportando(false)} sugestoes={sugestoes} />
    </div>
  );
}

const paraFormulario = (v: VendaLinha) => ({
  ...v,
  cliente: v.cliente ?? undefined,
  rastreio: v.rastreio ?? undefined,
  observacao: v.observacao ?? undefined,
});

function Cartao({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-lg text-muted-foreground">{titulo}</p>
      <p className="text-3xl font-semibold">{valor}</p>
    </div>
  );
}

function ItemVenda({ v, editar, apagar, pagar }: { v: VendaLinha; editar: () => void; apagar: () => void; pagar: () => void }) {
  const devolucao = v.tipo === "DEVOLUCAO";
  const pendente = v.pagamento === "PENDENTE" && !devolucao;
  const pagamento =
    NOME_PAGAMENTO[v.pagamento] +
    (v.cartao ? ` ${NOME_CARTAO[v.cartao]}` : "") +
    (v.pagamento === "CREDITO" && v.parcelas ? ` ${v.parcelas}x` : "");

  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base text-muted-foreground">{dataBR(v.data)}</p>
          <p className="text-xl font-semibold break-words">{v.produto}</p>
          <p className="text-lg">{v.cliente || "Cliente não anotada"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-2xl font-semibold ${devolucao ? "text-destructive" : ""}`}>
            {devolucao ? `− ${reais(v.valorCentavos)}` : reais(v.valorCentavos)}
          </p>
          {devolucao ? (
            <p className="font-medium text-destructive">Devolução</p>
          ) : (
            <p className={`font-medium ${pendente ? "text-orange-800" : "text-emerald-800"}`}>
              {pendente ? "A receber" : `Recebido · ${pagamento}`}
            </p>
          )}
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-base">
        <Package className="size-5 text-muted-foreground" aria-hidden />
        {NOME_ENTREGA[v.entrega]}
        {v.entrega === "CORREIOS" &&
          (v.rastreio ? (
            <span className="font-mono select-all">{v.rastreio}</span>
          ) : (
            <span className="font-medium text-orange-800">· falta o código de rastreio</span>
          ))}
      </p>
      {v.observacao && <p className="text-base text-muted-foreground">“{v.observacao}”</p>}
      <div className="flex flex-wrap gap-2">
        {pendente && (
          <Button onClick={pagar} className="bg-emerald-700 text-white hover:bg-emerald-800">
            <CircleDollarSign /> Já pagou
          </Button>
        )}
        <Button variant="outline" onClick={editar}>
          <Pencil /> Corrigir
        </Button>
        <Button variant="ghost" onClick={apagar}>
          <Trash2 /> Apagar
        </Button>
      </div>
    </li>
  );
}

function JaPagou({ venda, fechar }: { venda: VendaLinha | null; fechar: () => void }) {
  const [p, setP] = useState<{ pagamento?: Pagamento; cartao?: Cartao; parcelas?: number }>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    if (!venda) return;
    if (!p.pagamento) return setErros({ pagamento: "Escolha como ela pagou" });
    setSalvando(true);
    const r = await marcarPago(venda.id, p);
    setSalvando(false);
    if (r.erros) return setErros(r.erros);
    if (r.erro) return setErros({ pagamento: r.erro });
    toast.success("Pronto, marcado como pago");
    setP({});
    setErros({});
    fechar();
  }

  return (
    <Dialog open={venda !== null} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Já pagou</DialogTitle>
        </DialogHeader>
        {venda && (
          <p>
            {venda.produto}
            {venda.cliente ? ` · ${venda.cliente}` : ""} · <strong>{reais(venda.valorCentavos)}</strong>
          </p>
        )}
        <CamposPagamento {...p} mudar={(m) => setP((a) => ({ ...a, ...m }))} erros={erros} semPendente />
        <Button size="lg" onClick={confirmar} disabled={salvando}>
          <CircleDollarSign /> {salvando ? "Salvando..." : "Marcar como pago"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
