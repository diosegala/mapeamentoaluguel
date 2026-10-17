// Relatório consolidado para a liderança da CUPOLA. Roda na mesma fila dos relatórios de cliente,
// depois deles, e usa os números de mercado.ts como oficiais.
import PROMPT_MERCADO from "../../prompts/mercado-v1.md?raw";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chaveAnthropic, gerarAteFim, type UsoAcumulado } from "@/lib/anthropic.server";
import {
  DORES,
  INDICADORES,
  aplicarFiltros,
  descreverFiltros,
  ehDor,
  formatar,
  lerMercado,
  type Filtros,
  type LeituraMercado,
} from "@/lib/mercado";
import { carregarMercado } from "@/lib/mercado.functions";
import { dividirSecoes, extrairPrioridades } from "@/lib/relatorio-secoes";

const MAX_TOKENS_RESPOSTA = 32_000;
const MAX_TRECHOS = 4;
// Mesmo prazo da fila de clientes: uma geração interrompida volta para a fila depois dele.
const RETOMAR_APOS_MS = 12 * 60_000;
const limiteRetomada = () => new Date(Date.now() - RETOMAR_APOS_MS).toISOString();

export type ResumoMercado = {
  n: number;
  carteiraMediana: number | null;
  conversaoMediana: number | null;
  crescimentoMediana: number | null;
  iaEstruturada: string | null;
};

export function resumoDaLeitura(l: LeituraMercado): ResumoMercado {
  const usaIa = l.distribuicoes.find((d) => d.chave === "usa_ia");
  const estruturada = usaIa?.itens.find((i) => /estruturada/i.test(i.opcao));
  return {
    n: l.clientes.length,
    carteiraMediana: l.resumoIndicadores["carteira"]?.mediana ?? null,
    conversaoMediana: l.resumoIndicadores["conversaoLeads"]?.mediana ?? null,
    crescimentoMediana: l.resumoIndicadores["crescimento"]?.mediana ?? null,
    iaEstruturada: usaIa?.respondentes
      ? `${estruturada?.contagem ?? 0} de ${usaIa.respondentes}`
      : null,
  };
}

/** Coloca um relatório de mercado na fila com o recorte atual do dashboard. */
export async function iniciarRelatorioMercado(filtros: Filtros, userId: string) {
  const dados = await carregarMercado(supabaseAdmin);
  const incluidos = aplicarFiltros(dados.clientes, filtros);
  if (!incluidos.length) throw new Error("Nenhuma imobiliária no recorte atual.");
  const excluidos = dados.clientes
    .filter((c) => filtros.excluidos.includes(c.id))
    .map((c) => c.nome);
  const { data: ult } = await supabaseAdmin
    .from("relatorios_mercado")
    .select("versao")
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabaseAdmin
    .from("relatorios_mercado")
    .insert({
      versao: (ult?.versao ?? 0) + 1,
      status: "gerando",
      base: descreverFiltros(filtros, excluidos),
      filtros,
      diagnosticos_incluidos: incluidos.map((c) => c.id),
      criado_por: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Relatório de mercado pendente mais antigo, ou null. */
export async function proximoDaFilaMercado(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("relatorios_mercado")
    .select("id")
    .eq("status", "gerando")
    .or(`processando_desde.is.null,processando_desde.lt."${limiteRetomada()}"`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

const linha = (...c: Array<string | number>) => `| ${c.join(" | ")} |`;

/** Blocos de dados para o modelo: números calculados aqui, nunca pelo modelo. */
function montarContexto(
  l: LeituraMercado,
  base: string,
  prioridades: Map<string, string[]>,
): string {
  const ufs = [...new Set(l.clientes.map((c) => c.estado))].sort().join(", ");
  const blocos: string[] = [];
  blocos.push(`<base>\n${l.clientes.length} imobiliárias (${ufs}). Recorte: ${base}.\n</base>`);

  blocos.push(
    [
      "<indicadores_por_cliente>",
      linha("Imobiliária", "Cidade/UF", ...INDICADORES.map((i) => i.rotulo)),
      linha("---", "---", ...INDICADORES.map(() => "---")),
      ...l.indicadores.map(({ cliente, valores }) =>
        linha(
          cliente.nome,
          `${cliente.cidade}/${cliente.estado}`,
          ...INDICADORES.map((i) => formatar(valores[i.chave], i.formato)),
        ),
      ),
      "",
      "Como cada indicador é calculado:",
      ...INDICADORES.map(
        (i) => `- ${i.rotulo}: ${i.explicacao}.${i.melhor ? ` Melhor quanto ${i.melhor}.` : ""}`,
      ),
      "</indicadores_por_cliente>",
    ].join("\n"),
  );

  blocos.push(
    [
      "<resumo_indicadores>",
      linha("Indicador", "Respostas", "Mínimo", "P25", "Mediana", "P75", "Máximo"),
      linha("---", "---", "---", "---", "---", "---", "---"),
      ...INDICADORES.map((i) => {
        const e = l.resumoIndicadores[i.chave];
        return e
          ? linha(
              i.rotulo,
              e.n,
              ...[e.min, e.p25, e.mediana, e.p75, e.max].map((v) => formatar(v, i.formato)),
            )
          : linha(i.rotulo, 0, "—", "—", "—", "—", "—");
      }),
      "</resumo_indicadores>",
    ].join("\n"),
  );

  const titulosDor = new Map(DORES.map((d) => [d.chave, d.titulo]));
  blocos.push(
    [
      "<distribuicoes>",
      ...l.distribuicoes.map((d) =>
        [
          `## ${d.texto}${ehDor(d.chave) ? ` [DOR: ${titulosDor.get(d.chave)}]` : ""} (${d.respondentes} responderam${d.tipo === "escolha_multipla" ? "; várias opções por imobiliária" : ""})`,
          ...d.itens
            .filter((i) => i.contagem > 0)
            .map(
              (i) => `- ${i.opcao}: ${i.contagem} de ${d.respondentes} (${i.clientes.join(", ")})`,
            ),
        ].join("\n"),
      ),
      "</distribuicoes>",
    ].join("\n\n"),
  );

  const outros = l.distribuicoes.flatMap((d) =>
    d.outros.map((o) => `- ${o.cliente}, em "${d.texto}": ${o.texto}`),
  );
  if (outros.length) blocos.push(`<respostas_outro>\n${outros.join("\n")}\n</respostas_outro>`);

  const pri = l.clientes
    .filter((c) => prioridades.get(c.id)?.length)
    .map((c) => `- ${c.nome}: ${prioridades.get(c.id)!.join("; ")}`);
  if (pri.length)
    blocos.push(`<prioridades_publicadas>\n${pri.join("\n")}\n</prioridades_publicadas>`);

  return blocos.join("\n\n");
}

/** Títulos das prioridades do último relatório publicado de cada cliente. */
async function prioridadesPublicadas(ids: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>();
  if (!ids.length) return mapa;
  const { data } = await supabaseAdmin
    .from("relatorios")
    .select("diagnostico_id, conteudo, versao")
    .in("diagnostico_id", ids)
    .not("publicado_em", "is", null)
    .order("versao", { ascending: false });
  for (const r of data ?? []) {
    if (mapa.has(r.diagnostico_id) || !r.conteudo) continue;
    const secao = dividirSecoes(r.conteudo).secoes.find((s) => s.tipo === "prioridades");
    const titulos = secao
      ? extrairPrioridades(secao.corpo).prioridades.map((p) => p.titulo.replace(/\*\*/g, ""))
      : [];
    mapa.set(r.diagnostico_id, titulos);
  }
  return mapa;
}

/** Executa um relatório de mercado já na fila. Nunca lança; registra o erro na linha. */
export async function executarRelatorioMercado(id: string) {
  const { data: reservado } = await supabaseAdmin
    .from("relatorios_mercado")
    .update({ processando_desde: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "gerando")
    .or(`processando_desde.is.null,processando_desde.lt."${limiteRetomada()}"`)
    .select("id, base, diagnosticos_incluidos");
  const rel = reservado?.[0];
  if (!rel) return;

  const uso: UsoAcumulado = { entrada: 0, saida: 0, cacheCriacao: 0, cacheLeitura: 0 };
  const salvar = (campos: Record<string, unknown>) =>
    supabaseAdmin
      .from("relatorios_mercado")
      .update({
        ...campos,
        tokens_entrada: uso.entrada,
        tokens_saida: uso.saida,
        tokens_cache_criacao: uso.cacheCriacao,
        tokens_cache_leitura: uso.cacheLeitura,
      } as never)
      .eq("id", id);

  try {
    const ids = new Set((rel.diagnosticos_incluidos as string[]) ?? []);
    const dados = await carregarMercado(supabaseAdmin);
    const clientes = dados.clientes.filter((c) => ids.has(c.id));
    if (!clientes.length) {
      await salvar({ status: "erro", erro: "As imobiliárias do recorte não foram encontradas." });
      return;
    }
    const leitura = lerMercado(dados.perguntas, clientes);
    const [chave, { data: cfg }, prioridades] = await Promise.all([
      chaveAnthropic(),
      supabaseAdmin
        .from("configuracoes_agente")
        .select("modelo")
        .eq("ativo", true)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle(),
      prioridadesPublicadas(clientes.map((c) => c.id)),
    ]);
    if (!chave) {
      await salvar({ status: "erro", erro: "Chave da Anthropic não configurada." });
      return;
    }
    const modelo = cfg?.modelo || "claude-sonnet-5";
    const contexto = montarContexto(leitura, rel.base, prioridades);
    await salvar({ modelo, resumo: resumoDaLeitura(leitura) });
    const r = await gerarAteFim(
      chave,
      {
        model: modelo,
        max_tokens: MAX_TOKENS_RESPOSTA,
        system: [{ type: "text", text: PROMPT_MERCADO }],
        usuario: `${contexto}\n\nEscreva a leitura de mercado para a liderança da CUPOLA.`,
      },
      uso,
      MAX_TRECHOS,
    );
    if ("erro" in r) await salvar({ status: "erro", erro: r.erro });
    else await salvar({ status: "concluido", conteudo: r.texto, erro: null });
  } catch (e) {
    console.error("relatório de mercado", e);
    await salvar({ status: "erro", erro: "Erro inesperado ao gerar o relatório de mercado." });
  }
}
