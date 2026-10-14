// Indicadores da operação calculados no servidor, para o modelo interpretar em vez de fazer contas.
import {
  blocoProjecao,
  metasDoTexto,
  n1,
  num,
  pct,
  projetarCarteira,
  type ProjecaoCarteira,
} from "@/lib/projecao-carteira";

const reais = (x: number, casas = 0) => {
  const [inteiro, decimal] = x.toFixed(casas).split(".");
  const milhar = inteiro!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${milhar}${decimal ? `,${decimal}` : ""}`;
};
const positivo = (x: number | null): x is number => x !== null && x > 0;

// Carteira e estoque são grupos separados; sem esta definição o modelo lê o estoque como fatia da carteira.
const DEFINICOES = [
  "Definições: imóveis administrados (carteira) são apenas os imóveis alugados, com contrato ativo.",
  "Imóveis disponíveis (estoque) são os anunciados para locação hoje e não fazem parte da carteira.",
  "Os dois números não se relacionam: não divida um pelo outro, não diga que o estoque é parte ou porcentagem da carteira e não some os dois.",
].join(" ");

export function blocoIndicadores(respostas: Record<string, unknown>, projecao: ProjecaoCarteira | null): string {
  const carteira = num(respostas["imoveis_administrados"]);
  const estoque = num(respostas["estoque_disponivel"]);
  const locacoes = num(respostas["locacoes_mes"]);
  const leads = num(respostas["leads_mes"]);
  const faturamento = num(respostas["faturamento_locacao"]);
  const pessoasAdm = num(respostas["pessoas_administrativo"]);

  const l: string[] = [];
  if (positivo(estoque) && locacoes !== null) {
    l.push(`- Velocidade de locação do estoque = ${locacoes} locações ÷ ${estoque} disponíveis = ${pct(locacoes / estoque)} ao mês.`);
    if (positivo(locacoes))
      l.push(`- Meses para alugar o estoque atual no ritmo de hoje = ${estoque} ÷ ${locacoes} = ${n1(estoque / locacoes)} meses.`);
  }
  if (positivo(leads) && locacoes !== null) {
    l.push(`- Conversão de leads em locações = ${locacoes} ÷ ${leads} leads = ${pct(locacoes / leads)} ao mês.`);
    if (positivo(locacoes)) l.push(`- Leads por locação = ${leads} ÷ ${locacoes} = ${n1(leads / locacoes)}.`);
  }
  if (positivo(estoque) && positivo(leads))
    l.push(`- Leads por imóvel disponível = ${leads} ÷ ${estoque} = ${n1(leads / estoque)} por mês.`);
  if (positivo(carteira) && positivo(faturamento))
    l.push(`- Receita média por imóvel administrado = ${reais(faturamento)} ÷ ${carteira} = ${reais(faturamento / carteira, 2)} por mês.`);
  if (positivo(pessoasAdm) && positivo(carteira))
    l.push(`- Carteira por pessoa do administrativo = ${carteira} ÷ ${pessoasAdm} = ${n1(carteira / pessoasAdm)} imóveis.`);
  if (positivo(pessoasAdm) && positivo(faturamento))
    l.push(`- Faturamento por pessoa do administrativo = ${reais(faturamento)} ÷ ${pessoasAdm} = ${reais(faturamento / pessoasAdm)} por mês.`);

  const alertas: string[] = [];
  if (positivo(leads) && locacoes !== null && locacoes > leads)
    alertas.push(`- Locações por mês (${locacoes}) maiores que leads por mês (${leads}).`);
  if (projecao && projecao.tdca > 0.1)
    alertas.push(`- Desocupações somam ${pct(projecao.tdca)} da carteira ao mês.`);
  alertas.push(...contradicoes(respostas));

  if (!l.length && !alertas.length) return "";
  return [
    "# Indicadores da operação (calculados pela CUPOLA a partir das respostas; use estes valores, sem refazer as contas)",
    DEFINICOES,
    ...l,
    ...(alertas.length
      ? ["", "Pontos a validar com a imobiliária (aponte no relatório, sem escolher uma versão):", ...alertas]
      : []),
  ].join("\n");
}

const lista = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []).map(String);

/** Contradições entre respostas que o modelo tende a não perceber sozinho. */
function contradicoes(respostas: Record<string, unknown>): string[] {
  const out: string[] = [];
  const usoIa = String(respostas["usa_ia"] ?? "");
  const ferramentas = lista(respostas["ferramentas_ia"]).filter((f) => !/^nenhuma/i.test(f));
  if (/informal|não utiliz|testando/i.test(usoIa) && ferramentas.length)
    out.push(
      `- Uso de IA declarado como "${usoIa}", mas a pergunta sobre ferramentas pede apenas as usadas de forma estruturada e foram marcadas: ${ferramentas.join(", ")}.`,
    );
  const acompanhados = lista(respostas["indicadores_acompanhados"]);
  const declarados = acompanhados.filter((i) => /reloca|convers(ã|a)o das capta/i.test(i));
  if (declarados.length)
    out.push(
      `- A imobiliária declara acompanhar ${declarados.map((d) => `"${d}"`).join(" e ")}, mas o questionário não pede esses valores; a projeção usa as referências TRID e TCNC. Os valores reais podem mudar a projeção.`,
    );
  return out;
}

export type NumerosDestaque = {
  carteira: number;
  final: number;
  crescimento: number;
  captacoes: number;
  serie: number[];
  locacoesReferencia: number;
  locacoesInformadas: number | null;
  metas: Array<{ meta: number; captacoesMes: number }>;
  conversao: { locacoes: number; leads: number } | null;
};

/** Números de destaque do relatório (cartões e gráfico), vindos do cálculo e não do texto da IA. */
export function numerosDestaque(respostas: Record<string, unknown>): NumerosDestaque | null {
  const p = projetarCarteira({
    carteira: respostas["imoveis_administrados"],
    desocupacoes: respostas["desocupacoes_mes"],
    captacoes: respostas["captacoes_mes"],
    metas: metasDoTexto(respostas["meta_12_meses"]),
  });
  if (!p) return null;
  const locacoes = num(respostas["locacoes_mes"]);
  const leads = num(respostas["leads_mes"]);
  return {
    carteira: p.carteira,
    final: p.final,
    crescimento: p.crescimento,
    captacoes: p.captacoes,
    serie: p.serie,
    locacoesReferencia: p.desocupacoes * p.trid + p.captacoes * p.tcnc,
    locacoesInformadas: locacoes,
    metas: p.metas.map((m) => ({ meta: m.meta, captacoesMes: m.captacoesMes })),
    conversao: positivo(leads) && locacoes !== null ? { locacoes, leads } : null,
  };
}

/** Blocos numéricos calculados no servidor, iguais para a geração e para a revisão. */
export function blocosCalculados(respostas: Record<string, unknown>) {
  const p = projetarCarteira({
    carteira: respostas["imoveis_administrados"],
    desocupacoes: respostas["desocupacoes_mes"],
    captacoes: respostas["captacoes_mes"],
    metas: metasDoTexto(respostas["meta_12_meses"]),
  });
  return { projecao: blocoProjecao(p, num(respostas["locacoes_mes"])), indicadores: blocoIndicadores(respostas, p) };
}
