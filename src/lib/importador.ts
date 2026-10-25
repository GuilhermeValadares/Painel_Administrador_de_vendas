import {
  type Cartao,
  type Entrega,
  type Pagamento,
  type VendaEntrada,
  dataBR,
  paraCentavos,
  RASTREIO,
  vendaSchema,
} from "./venda";

// Função pura: recebe as linhas da planilha (já como texto) e devolve o que entendeu.
// Regra geral: nunca inventa. Quando não tem certeza, manda para "Para conferir".

export type Rascunho = Partial<VendaEntrada>;
export type ItemImportado = { linha: number; original: string; venda: Rascunho; motivos: string[] };
export type ResultadoImportacao = {
  vendas: ItemImportado[];
  conferir: ItemImportado[];
  estoque: ItemImportado[];
  vazias: number;
};

const COLUNAS = ["data", "produto", "cliente", "valor", "pagamento", "cartao", "parcelas", "entrega", "rastreio", "observacao"] as const;
type Coluna = (typeof COLUNAS)[number];

const CABECALHO: [Coluna, RegExp][] = [
  ["data", /data|quando/],
  ["produto", /vendeu|produto|o que/],
  ["cliente", /quem|cliente/],
  ["valor", /valor|quanto/],
  ["cartao", /cartao|bandeira/],
  ["parcelas", /vezes|parcela/],
  ["pagamento", /pagou|pagamento/],
  ["entrega", /entrega|loja/],
  ["rastreio", /rastreio|codigo/],
  ["observacao", /obs/],
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function mapearColunas(cabecalho: string[]): Record<Coluna, number> | null {
  const mapa: Partial<Record<Coluna, number>> = {};
  cabecalho.forEach((c, i) => {
    const achou = CABECALHO.find(([col, re]) => mapa[col] === undefined && re.test(norm(c)));
    if (achou) mapa[achou[0]] = i;
  });
  return mapa.data !== undefined && mapa.produto !== undefined ? (mapa as Record<Coluna, number>) : null;
}

function dataValida(a: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
}

type DataLida = { data: string } | { opcoes: [string, string] } | null;

function lerData(texto: string, ano: number): DataLida {
  const t = texto.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = dataValida(+m[1], +m[2], +m[3]);
    return d ? { data: d } : null;
  }
  m = t.match(/^(\d{1,2})\/(\d{1,2})$/); // dia/mês, sem ano
  if (m) {
    const d = dataValida(ano, +m[2], +m[1]);
    return d ? { data: d } : null;
  }
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], m[3].length === 2 ? 2000 + +m[3] : +m[3]];
    const diaMes = dataValida(y, b, a);
    const mesDia = dataValida(y, a, b);
    if (diaMes && mesDia && diaMes !== mesDia) return { opcoes: [diaMes, mesDia] };
    const d = diaMes ?? mesDia;
    return d ? { data: d } : null;
  }
  return null;
}

const dias = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

function lerPagamento(textoPag: string, cartaoTxt: string, vezesTxt: string, obs: string) {
  const motivos: string[] = [];
  const p = norm([textoPag, cartaoTxt, vezesTxt].join(" "));
  const vezes = p.match(/(\d{1,2})\s*x/)?.[1] ?? vezesTxt.trim().match(/^\d{1,2}$/)?.[0];
  let pagamento: Pagamento | undefined;

  const detectar = (t: string): Pagamento | undefined =>
    /fiado|depois paga|vai pagar|\bdeve\b|pendente/.test(t) ? "PENDENTE"
    : /pix/.test(t) ? "PIX"
    : /dinheiro|especie/.test(t) ? "DINHEIRO"
    : /debito/.test(t) ? "DEBITO"
    : /credito/.test(t) ? "CREDITO"
    : /maquin|cartao/.test(t) ? (vezes ? "CREDITO" : undefined)
    : undefined;

  if (!norm(textoPag)) {
    pagamento = detectar(norm(obs));
    motivos.push(pagamento ? "O pagamento estava vazio. Pela observação, parece ser este" : "Falta dizer como pagou");
  } else {
    pagamento = detectar(p);
    if (!pagamento) motivos.push(/maquin|cartao/.test(p) ? "Não sei se foi débito ou crédito" : "Não entendi como pagou");
  }

  let cartao: Cartao | undefined;
  let parcelas: number | undefined;
  if (pagamento === "DEBITO" || pagamento === "CREDITO") {
    cartao = /visa/.test(p) ? "VISA" : /master/.test(p) ? "MASTER" : /\belo\b/.test(p) ? "ELO" : norm(cartaoTxt) ? "OUTRO" : undefined;
    if (!cartao) motivos.push("Falta dizer qual cartão");
  }
  if (pagamento === "CREDITO") {
    parcelas = vezes ? Number(vezes) : 1;
    if (!vezes) motivos.push("Falta dizer em quantas vezes");
  }
  return { pagamento, cartao, parcelas, motivos };
}

function lerEntrega(texto: string, temRastreio: boolean): { entrega?: Entrega; motivo?: string } {
  const e = norm(texto);
  if (/loja|presencial|na hora|levou/.test(e)) return { entrega: "NA_HORA" };
  if (/busc|retir/.test(e)) return { entrega: "BUSCOU" };
  if (/correio|sedex|\bpac\b/.test(e)) return { entrega: "CORREIOS" };
  if (/moto/.test(e)) return { entrega: "MOTOBOY" };
  if (!e && temRastreio) return { entrega: "CORREIOS", motivo: "A entrega estava vazia, mas tem código de rastreio" };
  return { motivo: e ? "Não entendi como a cliente recebeu" : "Falta dizer como a cliente recebeu" };
}

export function importar(linhas: string[][], hojeISO: string): ResultadoImportacao {
  const resultado: ResultadoImportacao = { vendas: [], conferir: [], estoque: [], vazias: 0 };
  const mapa = mapearColunas(linhas[0] ?? []);
  const corpo = mapa ? linhas.slice(1) : linhas;
  const inicio = mapa ? 2 : 1; // número da linha no Excel
  const col = mapa ?? (Object.fromEntries(COLUNAS.map((c, i) => [c, i])) as Record<Coluna, number>);
  const campo = (l: string[], c: Coluna) => (l[col[c]] ?? "").trim();

  // Ano padrão para "4/8": o primeiro ano escrito na planilha, ou o ano de hoje.
  const anoEscrito = corpo.map((l) => campo(l, "data").match(/(\d{4})-\d{2}-\d{2}|\/(\d{2}|\d{4})$/)).find(Boolean);
  const ano = anoEscrito ? Number(anoEscrito[1] ?? (anoEscrito[2].length === 2 ? "20" + anoEscrito[2] : anoEscrito[2])) : Number(hojeISO.slice(0, 4));

  const lidas = corpo.map((l) => lerData(campo(l, "data"), ano));
  const certas = lidas.flatMap((d) => (d && "data" in d ? [d.data] : [])).sort();
  const mediana = certas[Math.floor(certas.length / 2)];
  const foraDoPeriodo = (d: string) => d > hojeISO || (mediana !== undefined && dias(d, mediana) > 90);

  const vistas = new Map<string, number>();
  let dataAnterior: string | undefined;

  corpo.forEach((l, i) => {
    const linha = inicio + i;
    if (l.every((c) => !c?.trim())) {
      resultado.vazias++;
      return;
    }
    const motivos: string[] = [];
    const original = l.map((c) => c?.trim() ?? "").join(" | ");
    const textoData = campo(l, "data");
    const produto = campo(l, "produto");
    let observacao = campo(l, "observacao");

    // Data
    let data: string | undefined;
    const lida = lidas[i];
    if (lida && "data" in lida) {
      data = lida.data;
      if (foraDoPeriodo(data)) {
        motivos.push(`A data "${textoData}" está fora do período da planilha`);
        data = dataAnterior;
      }
    } else if (lida) {
      const ref = dataAnterior ?? mediana ?? hojeISO;
      data = dias(lida.opcoes[0], ref) <= dias(lida.opcoes[1], ref) ? lida.opcoes[0] : lida.opcoes[1];
      motivos.push(`A data "${textoData}" pode ser ${dataBR(lida.opcoes[0])} ou ${dataBR(lida.opcoes[1])}`);
    } else {
      data = dataAnterior;
      motivos.push(textoData ? `Não dá para saber o dia de "${textoData}"` : "A data estava vazia");
    }
    if (!data && motivos.length) data = hojeISO;
    dataAnterior = data;

    // Compra de estoque não é venda
    if (/\bcomprei\b|estoque/.test(norm(`${produto} ${observacao}`))) {
      resultado.estoque.push({ linha, original, venda: { data, produto, observacao }, motivos: [] });
      return;
    }
    if (!produto) motivos.push("Falta dizer o que vendeu");

    // Cliente e rastreio
    let cliente = campo(l, "cliente");
    let rastreio = campo(l, "rastreio").replace(/\s/g, "").toUpperCase();
    const codigoNoCliente = cliente.toUpperCase().match(/\b[A-Z]{2}\s?\d{9}\s?[A-Z]{2}\b/);
    if (codigoNoCliente) {
      const codigo = codigoNoCliente[0].replace(/\s/g, "");
      cliente = cliente.slice(0, codigoNoCliente.index) + cliente.slice(codigoNoCliente.index! + codigoNoCliente[0].length);
      cliente = cliente.replace(/^[\s,;-]+|[\s,;-]+$/g, "");
      if (!rastreio) rastreio = codigo;
    }
    if (rastreio && !RASTREIO.test(rastreio)) motivos.push("O código de rastreio não está no formato certo");

    // Valor
    let valorCentavos: number | undefined;
    let tipo: "VENDA" | "DEVOLUCAO" = "VENDA";
    const textoValor = campo(l, "valor");
    const comExtra = textoValor.match(/^(?:r\$)?\s*([\d.,]+)\s*\+\s*(?:r\$)?\s*([\d.,]+)\s*(.*)$/i);
    if (!textoValor) motivos.push("Falta o valor");
    else if (comExtra) {
      valorCentavos = paraCentavos(comExtra[1]) ?? undefined;
      const extra = `${comExtra[3].trim() || "extra"} R$ ${comExtra[2]}`;
      observacao = observacao ? `${observacao}; ${extra}` : extra;
      motivos.push(`O valor "${textoValor}" tinha algo somado. Coloquei ${comExtra[1]} no valor e o resto na observação`);
    } else {
      const c = paraCentavos(textoValor);
      if (c === null || c === 0) motivos.push(`Não entendi o valor "${textoValor}"`);
      else {
        valorCentavos = Math.abs(c);
        if (c < 0) tipo = "DEVOLUCAO";
      }
    }

    const pag = lerPagamento(campo(l, "pagamento"), campo(l, "cartao"), campo(l, "parcelas"), observacao);
    motivos.push(...pag.motivos);

    const ent = lerEntrega(campo(l, "entrega"), !!rastreio);
    if (ent.motivo) motivos.push(ent.motivo);
    if (rastreio && ent.entrega && ent.entrega !== "CORREIOS") motivos.push("Tem código de rastreio, mas a entrega não é Correios");

    const venda: Rascunho = {
      data,
      produto,
      cliente: cliente || undefined,
      valorCentavos,
      pagamento: pag.pagamento,
      cartao: pag.cartao,
      parcelas: pag.parcelas,
      entrega: ent.entrega,
      rastreio: rastreio || undefined,
      observacao: observacao || undefined,
      tipo,
    };

    const chave = [data, norm(produto), norm(cliente), valorCentavos, tipo].join("|");
    const repetida = vistas.get(chave);
    if (repetida) motivos.push(`Parece repetida da linha ${repetida}`);
    else vistas.set(chave, linha);

    if (!motivos.length) {
      const ok = vendaSchema.safeParse(venda);
      if (!ok.success) motivos.push(...ok.error.issues.map((e) => e.message));
    }
    (motivos.length ? resultado.conferir : resultado.vendas).push({ linha, original, venda, motivos });
  });

  return resultado;
}
