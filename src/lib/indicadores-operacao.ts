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

export type IndicadoresNumericos = {
  carteira: number | null;
  estoque: number | null;
  locacoes: number | null;
  leads: number | null;
  faturamento: number | null;
  pessoasAdm: number | null;
  velocidadeEstoque: number | null;
  mesesEstoque: number | null;
  conversaoLeads: number | null;
  leadsPorLocacao: number | null;
  leadsPorImovel: number | null;
  receitaPorImovel: number | null;
  carteiraPorPessoa: number | null;
  faturamentoPorPessoa: number | null;
};

/** Indicadores da operação em números; o texto do prompt e a leitura de mercado partem daqui. */
export function indicadoresNumericos(respostas: Record<string, unknown>): IndicadoresNumericos {
  const carteira = num(respostas["imoveis_administrados"]);
  const estoque = num(respostas["estoque_disponivel"]);
  const locacoes = num(respostas["locacoes_mes"]);
  const leads = num(respostas["leads_mes"]);
  const faturamento = num(respostas["faturamento_locacao"]);
  const pessoasAdm = num(respostas["pessoas_administrativo"]);
  return {
    carteira,
    estoque,
    locacoes,
    leads,
    faturamento,
    pessoasAdm,
    velocidadeEstoque: positivo(estoque) && locacoes !== null ? locacoes / estoque : null,
    mesesEstoque: positivo(estoque) && positivo(locacoes) ? estoque / locacoes : null,
    conversaoLeads: positivo(leads) && locacoes !== null ? locacoes / leads : null,
    leadsPorLocacao: positivo(leads) && positivo(locacoes) ? leads / locacoes : null,
    leadsPorImovel: positivo(estoque) && positivo(leads) ? leads / estoque : null,
    receitaPorImovel: positivo(carteira) && positivo(faturamento) ? faturamento / carteira : null,
    carteiraPorPessoa: positivo(pessoasAdm) && positivo(carteira) ? carteira / pessoasAdm : null,
    faturamentoPorPessoa: positivo(pessoasAdm) && positivo(faturamento) ? faturamento / pessoasAdm : null,
  };
}

export function blocoIndicadores(respostas: Record<string, unknown>, projecao: ProjecaoCarteira | null): string {
  const i = indicadoresNumericos(respostas);
  const { carteira, estoque, locacoes, leads, faturamento, pessoasAdm } = i;

  const l: string[] = [];
  if (i.velocidadeEstoque !== null) {
    l.push(`- Velocidade de locação do estoque = ${locacoes} locações ÷ ${estoque} disponíveis = ${pct(i.velocidadeEstoque)} ao mês.`);
    if (i.mesesEstoque !== null)
      l.push(`- Meses para alugar o estoque atual no ritmo de hoje = ${estoque} ÷ ${locacoes} = ${n1(i.mesesEstoque)} meses.`);
  }
  if (i.conversaoLeads !== null) {
    l.push(`- Conversão de leads em locações = ${locacoes} ÷ ${leads} leads = ${pct(i.conversaoLeads)} ao mês.`);
    if (i.leadsPorLocacao !== null) l.push(`- Leads por locação = ${leads} ÷ ${locacoes} = ${n1(i.leadsPorLocacao)}.`);
  }
  if (i.leadsPorImovel !== null)
    l.push(`- Leads por imóvel disponível = ${leads} ÷ ${estoque} = ${n1(i.leadsPorImovel)} por mês.`);
  if (i.receitaPorImovel !== null)
    l.push(`- Receita média por imóvel administrado = ${reais(faturamento!)} ÷ ${carteira} = ${reais(i.receitaPorImovel, 2)} por mês.`);
  if (i.carteiraPorPessoa !== null)
    l.push(`- Carteira por pessoa do administrativo = ${carteira} ÷ ${pessoasAdm} = ${n1(i.carteiraPorPessoa)} imóveis.`);
  if (i.faturamentoPorPessoa !== null)
    l.push(`- Faturamento por pessoa do administrativo = ${reais(faturamento!)} ÷ ${pessoasAdm} = ${reais(i.faturamentoPorPessoa)} por mês.`);

  const alertas: string[] = [];
  if (positivo(leads) && locacoes !== null && locacoes > leads)
    alertas.push(`- Locações por mês (${locacoes}) maiores que leads por mês (${leads}).`);
  if (projecao && projecao.tdca > 0.1)
    alertas.push(`- Desocupações somam ${pct(projecao.tdca)} da carteira ao mês.`);
  alertas.push(...contradicoes(respostas));
  const observacoes = indicadoresDaProjecao(respostas);

  if (!l.length && !alertas.length) return "";
  return [
    "# Indicadores da operação (calculados pela CUPOLA a partir das respostas; use estes valores, sem refazer as contas)",
    DEFINICOES,
    ...l,
    ...(alertas.length
      ? ["", "Pontos a validar com a imobiliária (aponte no relatório, sem escolher uma versão):", ...alertas]
      : []),
    ...(observacoes.length ? ["", "Observações (não são contradições nem falhas da imobiliária):", ...observacoes] : []),
  ].join("\n");
}

const lista = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []).map(String);

/** Indicadores da projeção que a imobiliária diz acompanhar: dado útil, não contradição. */
function indicadoresDaProjecao(respostas: Record<string, unknown>): string[] {
  const declarados = lista(respostas["indicadores_acompanhados"]).filter((i) => /reloca|convers(ã|a)o das capta/i.test(i));
  if (!declarados.length) return [];
  return [
    `- A imobiliária acompanha ${declarados.map((d) => `"${d}"`).join(" e ")}. O questionário não pede esses valores, então a projeção usa as referências. Recomende levar os valores que a imobiliária já acompanha para a projeção; não diga que falta valor registrado nem trate isso como contradição.`,
  ];
}

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
