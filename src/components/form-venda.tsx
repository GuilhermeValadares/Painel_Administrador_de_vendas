"use client";

import { useId, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type Cartao,
  CARTOES,
  type Entrega,
  ENTREGAS,
  errosPorCampo,
  hoje,
  NOME_CARTAO,
  NOME_ENTREGA,
  NOME_PAGAMENTO,
  type Pagamento,
  PAGAMENTOS,
  paraCentavos,
  reais,
  somarDias,
  type Tipo,
  type VendaEntrada,
  valorTexto,
  vendaSchema,
} from "@/lib/venda";

export type Sugestoes = { produtos: { produto: string; valorCentavos: number }[]; clientes: string[] };
type Erros = Record<string, string>;

/** Botões grandes de escolha única (rádios nativos, para teclado e leitor de tela). */
export function Escolha<T extends string>({
  legenda,
  opcoes,
  valor,
  aoEscolher,
  erro,
}: {
  legenda: string;
  opcoes: [T, string][];
  valor: T | null | undefined;
  aoEscolher: (v: T) => void;
  erro?: string;
}) {
  const nome = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-lg font-medium">{legenda}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map(([v, rotulo]) => (
          <label key={v} className="relative">
            <input
              type="radio"
              name={nome}
              value={v}
              checked={valor === v}
              onChange={() => aoEscolher(v)}
              className="peer sr-only"
            />
            <span className="flex h-12 cursor-pointer items-center rounded-lg border-2 border-input bg-background px-4 text-lg select-none peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/60">
              {rotulo}
            </span>
          </label>
        ))}
      </div>
      <MensagemErro texto={erro} />
    </fieldset>
  );
}

export function MensagemErro({ texto }: { texto?: string }) {
  return texto ? <p role="alert" className="text-base font-medium text-destructive">{texto}</p> : null;
}

/** Como pagou + cartão + parcelas. Usado no formulário e no "Já pagou". */
export function CamposPagamento({
  pagamento,
  cartao,
  parcelas,
  mudar,
  erros,
  semPendente = false,
}: {
  pagamento?: Pagamento | null;
  cartao?: Cartao | null;
  parcelas?: number | null;
  mudar: (m: { pagamento?: Pagamento; cartao?: Cartao; parcelas?: number }) => void;
  erros: Erros;
  semPendente?: boolean;
}) {
  const opcoes = PAGAMENTOS.filter((p) => !semPendente || p !== "PENDENTE").map((p) => [p, NOME_PAGAMENTO[p]] as [Pagamento, string]);
  return (
    <>
      <Escolha legenda="Como pagou?" opcoes={opcoes} valor={pagamento} aoEscolher={(p) => mudar({ pagamento: p })} erro={erros.pagamento} />
      {(pagamento === "DEBITO" || pagamento === "CREDITO") && (
        <Escolha
          legenda="Qual cartão?"
          opcoes={CARTOES.map((c) => [c, NOME_CARTAO[c]])}
          valor={cartao}
          aoEscolher={(c) => mudar({ cartao: c })}
          erro={erros.cartao}
        />
      )}
      {pagamento === "CREDITO" && (
        <Escolha
          legenda="Em quantas vezes?"
          opcoes={Array.from({ length: 12 }, (_, i) => [String(i + 1), `${i + 1}x`] as [string, string])}
          valor={parcelas ? String(parcelas) : undefined}
          aoEscolher={(n) => mudar({ parcelas: Number(n) })}
          erro={erros.parcelas}
        />
      )}
    </>
  );
}

/** O mesmo formulário para registrar, editar e corrigir uma linha importada. */
export function FormVenda({
  inicial,
  sugestoes,
  aoSalvar,
  textoBotao = "Salvar venda",
}: {
  inicial?: Partial<VendaEntrada>;
  sugestoes: Sugestoes;
  aoSalvar: (venda: VendaEntrada) => Promise<{ erros?: Erros; erro?: string } | void>;
  textoBotao?: string;
}) {
  const [v, setV] = useState<Partial<VendaEntrada>>({ data: hoje(), tipo: "VENDA", ...inicial });
  const [valor, setValor] = useState(valorTexto(inicial?.valorCentavos));
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const mudar = (m: Partial<VendaEntrada>) => setV((atual) => ({ ...atual, ...m }));
  const ids = useId();
  const dia = hoje();

  function escolherProduto(produto: string) {
    mudar({ produto });
    const conhecido = sugestoes.produtos.find((p) => p.produto === produto);
    if (conhecido && !valor) setValor(valorTexto(conhecido.valorCentavos));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const centavos = paraCentavos(valor);
    const entrada = { ...v, valorCentavos: centavos ?? undefined } as VendaEntrada;
    const r = vendaSchema.safeParse(entrada);
    const novos = r.success ? {} : errosPorCampo(r.error);
    if (valor.trim() && centavos === null) novos.valorCentavos = "Escreva só o número, por exemplo 35,00";
    setErros(novos);
    if (Object.keys(novos).length) {
      document.getElementById(`${ids}-${Object.keys(novos)[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSalvando(true);
    const resposta = await aoSalvar(entrada);
    setSalvando(false);
    if (resposta?.erros) setErros(resposta.erros);
    if (resposta?.erro) setErros({ geral: resposta.erro });
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      <div id={`${ids}-data`} className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-data-campo`}>Quando foi?</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={v.data === dia ? "default" : "outline"} onClick={() => mudar({ data: dia })}>Hoje</Button>
          <Button type="button" variant={v.data === somarDias(dia, -1) ? "default" : "outline"} onClick={() => mudar({ data: somarDias(dia, -1) })}>Ontem</Button>
          <Input id={`${ids}-data-campo`} type="date" value={v.data ?? ""} max={dia} onChange={(e) => mudar({ data: e.target.value })} className="w-auto flex-1" />
        </div>
        <MensagemErro texto={erros.data} />
      </div>

      <div id={`${ids}-produto`} className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-produto-campo`}>O que você vendeu?</Label>
        <Input
          id={`${ids}-produto-campo`}
          list={`${ids}-produtos`}
          value={v.produto ?? ""}
          onChange={(e) => escolherProduto(e.target.value)}
          placeholder="Ex.: brinco argola"
          autoComplete="off"
          aria-invalid={!!erros.produto}
        />
        <datalist id={`${ids}-produtos`}>
          {sugestoes.produtos.map((p) => (
            <option key={p.produto} value={p.produto} label={reais(p.valorCentavos)} />
          ))}
        </datalist>
        <MensagemErro texto={erros.produto} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-cliente-campo`}>Para quem?</Label>
        <div className="flex gap-2">
          <Input
            id={`${ids}-cliente-campo`}
            list={`${ids}-clientes`}
            value={v.cliente ?? ""}
            onChange={(e) => mudar({ cliente: e.target.value })}
            placeholder="Nome ou telefone"
            autoComplete="off"
          />
          <Button type="button" variant={v.cliente === "" ? "default" : "outline"} onClick={() => mudar({ cliente: "" })}>
            Não anotei
          </Button>
        </div>
        <datalist id={`${ids}-clientes`}>
          {sugestoes.clientes.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <div id={`${ids}-valorCentavos`} className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-valor-campo`}>Quanto foi?</Label>
        <div className="relative max-w-56">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">R$</span>
          <Input
            id={`${ids}-valor-campo`}
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="35,00"
            className="pl-11"
            aria-invalid={!!erros.valorCentavos}
          />
        </div>
        <MensagemErro texto={erros.valorCentavos} />
      </div>

      <div id={`${ids}-pagamento`} className="flex flex-col gap-6">
        <CamposPagamento pagamento={v.pagamento} cartao={v.cartao} parcelas={v.parcelas} mudar={mudar} erros={erros} />
      </div>

      <div id={`${ids}-entrega`}>
        <Escolha<Entrega>
          legenda="Como a cliente recebeu?"
          opcoes={ENTREGAS.map((e) => [e, NOME_ENTREGA[e]])}
          valor={v.entrega}
          aoEscolher={(entrega) => mudar({ entrega })}
          erro={erros.entrega}
        />
      </div>

      {v.entrega === "CORREIOS" && (
        <div id={`${ids}-rastreio`} className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-rastreio-campo`}>Código de rastreio (pode colocar depois)</Label>
          <Input
            id={`${ids}-rastreio-campo`}
            value={v.rastreio ?? ""}
            onChange={(e) => mudar({ rastreio: e.target.value.toUpperCase().replace(/\s/g, "") })}
            placeholder="AA123456789BR"
            autoComplete="off"
            className="max-w-72 font-mono uppercase"
            aria-invalid={!!erros.rastreio}
          />
          <MensagemErro texto={erros.rastreio} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-obs-campo`}>Quer anotar algo?</Label>
        <Textarea
          id={`${ids}-obs-campo`}
          value={v.observacao ?? ""}
          onChange={(e) => mudar({ observacao: e.target.value })}
          placeholder="Ex.: pediu embrulho"
        />
      </div>

      <Escolha<Tipo>
        legenda="É uma devolução?"
        opcoes={[["VENDA", "Não, é venda"], ["DEVOLUCAO", "Sim, devolução"]]}
        valor={v.tipo}
        aoEscolher={(tipo) => mudar({ tipo })}
      />

      <MensagemErro texto={erros.geral} />
      <Button type="submit" size="lg" disabled={salvando} className="sticky bottom-0 shadow-lg">
        <Save /> {salvando ? "Salvando..." : textoBotao}
      </Button>
    </form>
  );
}
