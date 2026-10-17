// Projeção de carteira CUPOLA (mesma lógica da planilha "CUP Projeção de Carteira").
export const TRID_REFERENCIA = 0.6; // relocação de imóveis desocupados
export const TCNC_REFERENCIA = 0.3; // conversão de novas captações em contratos

export type ProjecaoCarteira = {
  carteira: number;
  desocupacoes: number;
  captacoes: number;
  tdca: number;
  icca: number;
  trid: number;
  tcnc: number;
  fator: number;
  serie: number[]; // meses 0..12
  crescimento: number;
  final: number;
  metas: Array<{ meta: number; icca: number; captacoesMes: number }>;
};

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function metasDoTexto(texto: unknown): number[] {
  if (typeof texto !== "string" || !/crescer/i.test(texto)) return [];
  return (texto.match(/\d+(?:,\d+)?\s*%/g) ?? []).map((m) => Number(m.replace("%", "").replace(",", ".").trim()) / 100);
}

export function projetarCarteira(
  entrada: { carteira: unknown; desocupacoes: unknown; captacoes: unknown; metas?: number[] },
  trid = TRID_REFERENCIA,
  tcnc = TCNC_REFERENCIA,
): ProjecaoCarteira | null {
  const carteira = num(entrada.carteira);
  const desocupacoes = num(entrada.desocupacoes);
  const captacoes = num(entrada.captacoes);
  if (!carteira || carteira <= 0 || desocupacoes === null || captacoes === null) return null;
  const tdca = desocupacoes / carteira;
  const icca = captacoes / carteira;
  const fator = 1 - tdca + tdca * trid + icca * tcnc;
  const serie = [carteira];
  let atual = carteira;
  for (let i = 1; i <= 12; i++) { atual *= fator; serie.push(atual); }
  const metas = (entrada.metas ?? []).map((meta) => {
    const f = Math.pow(1 + meta, 1 / 12);
    const iccaNec = (f - 1 + tdca * (1 - trid)) / tcnc;
    return { meta, icca: iccaNec, captacoesMes: iccaNec * carteira };
  });
  return { carteira, desocupacoes, captacoes, tdca, icca, trid, tcnc, fator, serie, crescimento: atual / carteira - 1, final: atual, metas };
}

export type PosicaoOperacao = "acima" | "proxima" | "abaixo";

/** Onde a operação está em relação ao cenário: locações informadas contra as que o cenário pressupõe (margem de 10%). */
export function posicaoOperacao(p: ProjecaoCarteira, locacoesInformadas: number | null): PosicaoOperacao | null {
  const pressupostas = p.desocupacoes * p.trid + p.captacoes * p.tcnc;
  if (locacoesInformadas === null || pressupostas <= 0) return null;
  const razao = locacoesInformadas / pressupostas;
  return razao > 1.1 ? "acima" : razao < 0.9 ? "abaixo" : "proxima";
}

export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d).replace(".", ",")}%`;
export const n1 = (x: number) => x.toFixed(1).replace(".", ",");

export function blocoProjecao(p: ProjecaoCarteira | null, locacoesInformadas: number | null = null): string {
  if (!p) return "";
  const relocados = p.desocupacoes * p.trid;
  const novos = p.captacoes * p.tcnc;
  const l = [
    "# Projeção da carteira no cenário de referência CUPOLA (calculada pela CUPOLA — números oficiais, não refaça nem conteste a conta)",
    "Este cenário não é o ritmo atual da imobiliária: mostra onde a carteira chegaria se a operação relocasse os desocupados e convertesse as captações nas referências TRID e TCNC. Escreva os resultados no condicional (\"chegaria\", \"seria\") e nunca como \"no ritmo atual\".",
    `- Carteira atual: ${p.carteira} imóveis administrados (só os alugados; o estoque disponível não entra na carteira nem na fórmula); desocupações/mês: ${p.desocupacoes}; captações/mês (imóveis captados, que entram no estoque disponível): ${p.captacoes}.`,
    `- TDCA (taxa de desocupação sobre a carteira) = ${p.desocupacoes} ÷ ${p.carteira} = ${pct(p.tdca, 2)} ao mês.`,
    `- ICCA (índice de captação sobre a carteira) = ${p.captacoes} ÷ ${p.carteira} = ${pct(p.icca, 2)} ao mês.`,
    `- TRID (relocação dos imóveis desocupados) = ${pct(p.trid, 0)} e TCNC (captações que viram contrato) = ${pct(p.tcnc, 0)} são as referências médias observadas em clientes da CUPOLA. Apresente-as apenas assim; não comente se o questionário pergunta esses valores nem se a operação os mede.`,
    `- Fórmula mensal: carteira do mês = carteira anterior − carteira × TDCA + carteira × TDCA × TRID + carteira × ICCA × TCNC (fator mensal ${p.fator.toFixed(4).replace(".", ",")}).`,
    `- Fluxo do primeiro mês no cenário de referência: desocupam ${p.desocupacoes}; desses, ${n1(relocados)} seriam relocados e ${n1(p.desocupacoes - relocados)} não seriam relocados no mês: ficariam aguardando nova locação no estoque ou sairiam da administração, deixando a carteira. Das ${p.captacoes} captações, ${n1(novos)} virariam contrato novo e ${n1(p.captacoes - novos)} não entrariam na carteira naquele mês.`,
    `- Saldo mensal no cenário de referência = relocados + contratos novos − desocupações = ${n1(relocados)} + ${n1(novos)} − ${p.desocupacoes} = ${n1(relocados + novos - p.desocupacoes)} imóveis por mês.`,
    `- Série no cenário de referência (mês 0 a 12): ${p.serie.map(n1).join(" → ")}.`,
    `- Carteira em 12 meses no cenário de referência: ${n1(p.final)} imóveis; crescimento de ${pct(p.crescimento)} (${n1(p.final - p.carteira)} imóveis).`,
  ];
  const posicao = posicaoOperacao(p, locacoesInformadas);
  const pressupostas = relocados + novos;
  const comparacao = `- Locações por mês que o cenário de referência pressupõe = ${n1(relocados)} relocados + ${n1(novos)} contratos novos = ${n1(pressupostas)}. Locações por mês informadas pela imobiliária: ${locacoesInformadas} (${pct((locacoesInformadas ?? 0) / pressupostas, 0)} do cenário).`;
  if (posicao === "acima")
    l.push(
      comparacao,
      `- A OPERAÇÃO ALUGA ACIMA DO CENÁRIO DE REFERÊNCIA. Abra a seção da carteira por esta comparação, antes de detalhar o cenário: a imobiliária aluga ${locacoesInformadas} imóveis por mês e o cenário pressupõe ${n1(pressupostas)}. Diga logo em seguida que, por isso, o resultado do cenário (${pct(p.crescimento)} em 12 meses) não descreve esta operação: a relocação dos desocupados, a conversão das captações, ou as duas, estão acima das referências de ${pct(p.trid, 0)} e ${pct(p.tcnc, 0)}, e a carteira real tende a ficar acima da projeção. Só então apresente o cenário, como referência. Não calcule outra projeção, não estime a TRID ou a TCNC reais e não use a projeção para concluir que falta captação.`,
    );
  else if (posicao === "abaixo")
    l.push(
      `${comparacao} Esta comparação é a distância entre a operação e a referência CUPOLA: a operação aluga menos do que o cenário pressupõe, então a carteira real tende a ficar abaixo da projeção.`,
    );
  else if (posicao === "proxima")
    l.push(`${comparacao} A operação aluga perto do que o cenário pressupõe.`);
  if (posicao === "acima") {
    if (p.metas.length)
      l.push(
        "- Captações para a meta: não apresente nenhum número. Com a operação alugando acima do cenário, a conversão real tende a ser maior que a TCNC de referência, e um número calculado com ela superestimaria a necessidade de captação.",
      );
  } else
    for (const m of p.metas)
      l.push(`- No cenário de referência, para crescer ${pct(m.meta, 0)} em 12 meses: ICCA necessário ${pct(m.icca, 2)}, ou cerca de ${n1(m.captacoesMes)} captações por mês (hoje: ${p.captacoes}). Esse número supõe TCNC de ${pct(p.tcnc, 0)}; com conversão real menor, seriam necessárias mais captações, então não o compare com as captações atuais como se a captação sobrasse.`);
  return l.join("\n");
}
