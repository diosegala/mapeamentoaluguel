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

export function blocoIndicadores(respostas: Record<string, unknown>, projecao: ProjecaoCarteira | null): string {
  const carteira = num(respostas["imoveis_administrados"]);
  const estoque = num(respostas["estoque_disponivel"]);
  const locacoes = num(respostas["locacoes_mes"]);
  const leads = num(respostas["leads_mes"]);
  const faturamento = num(respostas["faturamento_locacao"]);
  const pessoasAdm = num(respostas["pessoas_administrativo"]);

  const l: string[] = [];
  if (positivo(carteira) && estoque !== null)
    l.push(`- Estoque sobre a carteira = ${estoque} disponíveis ÷ ${carteira} administrados = ${pct(estoque / carteira)}.`);
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
  if (projecao && locacoes !== null) {
    const pelaFormula = projecao.desocupacoes * projecao.trid + projecao.captacoes * projecao.tcnc;
    l.push(
      `- Locações por mês pela fórmula da projeção (relocados + contratos novos) = ${n1(pelaFormula)}; locações por mês informadas = ${locacoes}.`,
    );
  }

  const alertas: string[] = [];
  if (positivo(leads) && locacoes !== null && locacoes > leads)
    alertas.push(`- Locações por mês (${locacoes}) maiores que leads por mês (${leads}).`);
  if (positivo(carteira) && estoque !== null && estoque > carteira)
    alertas.push(`- Imóveis disponíveis (${estoque}) maiores que a carteira administrada (${carteira}).`);
  if (projecao && projecao.tdca > 0.1)
    alertas.push(`- Desocupações somam ${pct(projecao.tdca)} da carteira ao mês.`);
  alertas.push(...contradicoes(respostas));

  if (!l.length && !alertas.length) return "";
  return [
    "# Indicadores da operação (calculados pela CUPOLA a partir das respostas; use estes valores, sem refazer as contas)",
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

/** Blocos numéricos calculados no servidor, iguais para a geração e para a revisão. */
export function blocosCalculados(respostas: Record<string, unknown>) {
  const p = projetarCarteira({
    carteira: respostas["imoveis_administrados"],
    desocupacoes: respostas["desocupacoes_mes"],
    captacoes: respostas["captacoes_mes"],
    metas: metasDoTexto(respostas["meta_12_meses"]),
  });
  return { projecao: blocoProjecao(p), indicadores: blocoIndicadores(respostas, p) };
}
