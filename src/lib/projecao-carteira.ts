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

export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d).replace(".", ",")}%`;
export const n1 = (x: number) => x.toFixed(1).replace(".", ",");

export function blocoProjecao(p: ProjecaoCarteira | null): string {
  if (!p) return "";
  const l = [
    "# Projeção da carteira (calculada pela CUPOLA — números oficiais, não refaça nem conteste a conta)",
    `- Carteira atual: ${p.carteira} imóveis administrados; desocupações/mês: ${p.desocupacoes}; captações/mês: ${p.captacoes}.`,
    `- TDCA (taxa de desocupação sobre a carteira) = ${p.desocupacoes} ÷ ${p.carteira} = ${pct(p.tdca, 2)} ao mês.`,
    `- ICCA (índice de captação sobre a carteira) = ${p.captacoes} ÷ ${p.carteira} = ${pct(p.icca, 2)} ao mês.`,
    `- TRID (relocação dos imóveis desocupados) = ${pct(p.trid, 0)} e TCNC (captações que viram contrato) = ${pct(p.tcnc, 0)}: referências médias observadas pela CUPOLA.`,
    `- Fórmula mensal: carteira do mês = carteira anterior − carteira × TDCA + carteira × TDCA × TRID + carteira × ICCA × TCNC (fator mensal ${p.fator.toFixed(4).replace(".", ",")}).`,
    `- Fluxo do primeiro mês em imóveis: desocupam ${p.desocupacoes}; desses, ${n1(p.desocupacoes * p.trid)} são relocados e ${n1(p.desocupacoes * (1 - p.trid))} saem da carteira. Das ${p.captacoes} captações, ${n1(p.captacoes * p.tcnc)} viram contrato novo e ${n1(p.captacoes * (1 - p.tcnc))} não entram na carteira.`,
    `- Saldo mensal = relocados + contratos novos − desocupações = ${n1(p.desocupacoes * p.trid)} + ${n1(p.captacoes * p.tcnc)} − ${p.desocupacoes} = ${n1(p.desocupacoes * p.trid + p.captacoes * p.tcnc - p.desocupacoes)} imóveis por mês.`,
    `- Série (mês 0 a 12): ${p.serie.map(n1).join(" → ")}.`,
    `- Carteira projetada em 12 meses: ${n1(p.final)} imóveis; crescimento de ${pct(p.crescimento)} (${n1(p.final - p.carteira)} imóveis).`,
  ];
  for (const m of p.metas)
    l.push(`- Para crescer ${pct(m.meta, 0)} em 12 meses, mantidas TDCA, TRID e TCNC: ICCA necessário ${pct(m.icca, 2)}, ou cerca de ${n1(m.captacoesMes)} captações por mês (hoje: ${p.captacoes}).`);
  return l.join("\n");
}
