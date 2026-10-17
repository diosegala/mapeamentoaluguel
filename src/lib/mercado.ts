// Leitura de mercado: agrega as respostas de todos os clientes. Funções puras, usadas pelo
// dashboard, pela planilha e pelo relatório da liderança, para os três mostrarem os mesmos números.
import { indicadoresNumericos } from "@/lib/indicadores-operacao";
import { metasDoTexto, num, projetarCarteira } from "@/lib/projecao-carteira";

export type PerguntaMercado = {
  chave: string;
  texto: string;
  tipo: string;
  opcoes: string[];
  secao: number;
  ordem: number;
};

export type ClienteMercado = {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  concluido_em: string;
  // `any` (e não unknown) para o tipo passar pela checagem de serialização das funções de servidor.
  respostas: Record<string, any>;
  relatorio_publicado_em: string | null;
};

/** Perguntas de dor ("marque até 3"), na ordem em que aparecem no dashboard. */
export const DORES: Array<{ chave: string; titulo: string }> = [
  { chave: "etapas_criticas", titulo: "Gargalos comerciais" },
  {
    chave: "marque_ate_3_opcoes_de_etapas_que_voce_considera_c",
    titulo: "Gargalos administrativos",
  },
  { chave: "maior_dificuldade_pessoas", titulo: "Dificuldades com a equipe" },
  { chave: "gargalos_marketing", titulo: "Gargalos de marketing" },
  { chave: "expectativa_ia", titulo: "O que esperam que a IA resolva" },
];

const TECNOLOGIA = new Set([
  "sistema_crm",
  "satisfacao_crm",
  "sistema_gestao",
  "satisfacao_sistema",
  "integracoes",
  "assinatura_digital",
  "usa_ia",
  "aplicacoes_ia",
  "ferramentas_ia",
  "politica_ia",
]);

export const ehEscolha = (tipo: string) => tipo === "escolha_unica" || tipo === "escolha_multipla";
export const ehNumerica = (tipo: string) => tipo === "numero" || tipo === "moeda";
export const ehDor = (chave: string) => DORES.some((d) => d.chave === chave);
export const ehTecnologia = (chave: string) => TECNOLOGIA.has(chave) || chave.startsWith("ia_");

// ---------------------------------------------------------------- estatística

export type Estatisticas = {
  n: number;
  min: number;
  p25: number;
  mediana: number;
  p75: number;
  max: number;
  media: number;
};

/** Quantil com interpolação linear (mesmo método do QUARTIL.INC do Excel). */
function quantil(ordenados: number[], q: number) {
  const pos = (ordenados.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  const prox = ordenados[base + 1];
  return prox === undefined
    ? ordenados[base]!
    : ordenados[base]! + resto * (prox - ordenados[base]!);
}

export function estatisticas(valores: Array<number | null>): Estatisticas | null {
  const v = valores
    .filter((x): x is number => x !== null && Number.isFinite(x))
    .sort((a, b) => a - b);
  if (!v.length) return null;
  return {
    n: v.length,
    min: v[0]!,
    p25: quantil(v, 0.25),
    mediana: quantil(v, 0.5),
    p75: quantil(v, 0.75),
    max: v[v.length - 1]!,
    media: v.reduce((a, b) => a + b, 0) / v.length,
  };
}

// ---------------------------------------------------------------- indicadores

export type Formato = "inteiro" | "decimal" | "reais" | "pct" | "pontos" | "dias";

export type Indicador = {
  chave: string;
  rotulo: string;
  explicacao: string;
  formato: Formato;
  /** Qual lado é o desejável; null quando não há leitura de melhor ou pior. */
  melhor: "maior" | "menor" | null;
};

export const INDICADORES: Indicador[] = [
  {
    chave: "carteira",
    rotulo: "Carteira",
    explicacao: "Imóveis administrados (alugados)",
    formato: "inteiro",
    melhor: null,
  },
  {
    chave: "faturamento",
    rotulo: "Faturamento/mês",
    explicacao: "Faturamento mensal da locação",
    formato: "reais",
    melhor: null,
  },
  {
    chave: "receitaPorImovel",
    rotulo: "Receita por imóvel",
    explicacao: "Faturamento ÷ carteira, por mês",
    formato: "reais",
    melhor: "maior",
  },
  {
    chave: "conversaoLeads",
    rotulo: "Conversão de leads",
    explicacao: "Locações ÷ leads, por mês",
    formato: "pct",
    melhor: "maior",
  },
  {
    chave: "leadsPorLocacao",
    rotulo: "Leads por locação",
    explicacao: "Leads ÷ locações",
    formato: "decimal",
    melhor: "menor",
  },
  {
    chave: "velocidadeEstoque",
    rotulo: "Velocidade do estoque",
    explicacao: "Locações ÷ imóveis disponíveis, por mês",
    formato: "pct",
    melhor: "maior",
  },
  {
    chave: "tdca",
    rotulo: "Desocupação (TDCA)",
    explicacao: "Desocupações ÷ carteira, por mês",
    formato: "pct",
    melhor: "menor",
  },
  {
    chave: "icca",
    rotulo: "Captação (ICCA)",
    explicacao: "Captações ÷ carteira, por mês",
    formato: "pct",
    melhor: "maior",
  },
  {
    chave: "crescimento",
    rotulo: "Crescimento em 12 meses",
    explicacao: "Projeção nas referências CUPOLA (TRID 60%, TCNC 30%)",
    formato: "pct",
    melhor: "maior",
  },
  {
    chave: "carteiraPorPessoa",
    rotulo: "Carteira por pessoa adm.",
    explicacao: "Carteira ÷ pessoas do administrativo",
    formato: "decimal",
    melhor: "maior",
  },
  {
    chave: "faturamentoPorPessoa",
    rotulo: "Faturamento por pessoa adm.",
    explicacao: "Faturamento ÷ pessoas do administrativo, por mês",
    formato: "reais",
    melhor: "maior",
  },
  {
    chave: "inadimplencia",
    rotulo: "Inadimplência",
    explicacao: "Taxa informada pela imobiliária",
    formato: "pontos",
    melhor: "menor",
  },
  {
    chave: "tempoVisitaChaves",
    rotulo: "Visita até chaves",
    explicacao: "Dias entre a visita e a entrega das chaves",
    formato: "dias",
    melhor: "menor",
  },
];

export type ValoresIndicadores = Record<string, number | null>;

/** Indicadores de um cliente, com as mesmas fórmulas do relatório individual. */
export function indicadoresDoCliente(respostas: Record<string, unknown>): ValoresIndicadores {
  const i = indicadoresNumericos(respostas);
  const p = projetarCarteira({
    carteira: respostas["imoveis_administrados"],
    desocupacoes: respostas["desocupacoes_mes"],
    captacoes: respostas["captacoes_mes"],
    metas: metasDoTexto(respostas["meta_12_meses"]),
  });
  return {
    carteira: i.carteira,
    faturamento: i.faturamento,
    receitaPorImovel: i.receitaPorImovel,
    conversaoLeads: i.conversaoLeads,
    leadsPorLocacao: i.leadsPorLocacao,
    velocidadeEstoque: i.velocidadeEstoque,
    tdca: p?.tdca ?? null,
    icca: p?.icca ?? null,
    crescimento: p?.crescimento ?? null,
    carteiraPorPessoa: i.carteiraPorPessoa,
    faturamentoPorPessoa: i.faturamentoPorPessoa,
    inadimplencia: num(respostas["inadimplencia"]),
    tempoVisitaChaves: num(respostas["tempo_visita_chaves"]),
  };
}

const mil = (x: number, casas: number) =>
  x.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function formatar(valor: number | null | undefined, formato: Formato): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";
  switch (formato) {
    case "inteiro":
      return mil(Math.round(valor), 0);
    case "decimal":
      return mil(valor, 1);
    case "reais":
      return `R$ ${mil(valor, 0)}`;
    case "pct":
      return `${mil(valor * 100, 1)}%`;
    case "pontos":
      return `${mil(valor, 1)}%`;
    case "dias":
      return `${mil(valor, 0)} dias`;
  }
}

/** Posição do valor na base: quartil desejável, quartil a observar ou meio. */
export function quartil(
  valor: number | null,
  est: Estatisticas | null,
  ind: Indicador,
): "bom" | "atencao" | null {
  if (valor === null || !est || !ind.melhor || est.n < 4) return null;
  const alto = valor >= est.p75 && est.p75 > est.p25;
  const baixo = valor <= est.p25 && est.p75 > est.p25;
  if (ind.melhor === "maior") return alto ? "bom" : baixo ? "atencao" : null;
  return baixo ? "bom" : alto ? "atencao" : null;
}

// ---------------------------------------------------------------- distribuições

export type ItemDistribuicao = { opcao: string; contagem: number; pct: number; clientes: string[] };

export type Distribuicao = {
  chave: string;
  texto: string;
  tipo: string;
  secao: number;
  respondentes: number;
  itens: ItemDistribuicao[];
  /** Textos digitados em "Outro", com o cliente. */
  outros: Array<{ cliente: string; texto: string }>;
};

const lista = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v === null || v === undefined || v === "" ? [] : [v])
    .map((x) => String(x).trim())
    .filter(Boolean);

/** Contagem por opção. Múltipla escolha e dores vêm da mais citada para a menos; escolha única mantém a escala da pergunta. */
export function distribuicao(p: PerguntaMercado, clientes: ClienteMercado[]): Distribuicao {
  const porOpcao = new Map<string, string[]>(p.opcoes.map((o) => [o, []]));
  const outros: Distribuicao["outros"] = [];
  let respondentes = 0;
  for (const c of clientes) {
    const valores = lista(c.respostas[p.chave]);
    if (!valores.length) continue;
    respondentes++;
    for (const v of new Set(valores)) porOpcao.set(v, [...(porOpcao.get(v) ?? []), c.nome]);
    const outro = c.respostas[`${p.chave}__outro`];
    if (typeof outro === "string" && outro.trim())
      outros.push({ cliente: c.nome, texto: outro.trim() });
  }
  let itens = [...porOpcao.entries()].map(([opcao, nomes]) => ({
    opcao,
    contagem: nomes.length,
    pct: respondentes ? nomes.length / respondentes : 0,
    clientes: nomes,
  }));
  if (p.tipo === "escolha_multipla" || ehDor(p.chave))
    itens = itens.sort((a, b) => b.contagem - a.contagem);
  // Opções que ninguém marcou continuam visíveis na escala; nas listas longas, só poluem.
  if (p.tipo === "escolha_multipla") itens = itens.filter((i) => i.contagem > 0);
  return {
    chave: p.chave,
    texto: p.texto,
    tipo: p.tipo,
    secao: p.secao,
    respondentes,
    itens,
    outros,
  };
}

// ---------------------------------------------------------------- filtros

export const FAIXAS_CARTEIRA = [
  { id: "ate500", rotulo: "Até 500 imóveis", teste: (n: number) => n <= 500 },
  { id: "501a1000", rotulo: "501 a 1.000 imóveis", teste: (n: number) => n > 500 && n <= 1000 },
  { id: "acima1000", rotulo: "Acima de 1.000 imóveis", teste: (n: number) => n > 1000 },
] as const;

export type Filtros = { estado: string; faixa: string; desde: string; excluidos: string[] };

export const FILTROS_VAZIOS: Filtros = { estado: "", faixa: "", desde: "", excluidos: [] };

export function aplicarFiltros(clientes: ClienteMercado[], f: Filtros): ClienteMercado[] {
  const faixa = FAIXAS_CARTEIRA.find((x) => x.id === f.faixa);
  return clientes.filter((c) => {
    if (f.excluidos.includes(c.id)) return false;
    if (f.estado && c.estado !== f.estado) return false;
    if (f.desde && c.concluido_em.slice(0, 10) < f.desde) return false;
    if (faixa) {
      const n = num(c.respostas["imoveis_administrados"]);
      if (n === null || !faixa.teste(n)) return false;
    }
    return true;
  });
}

/** Descrição dos filtros em português, para o relatório e para a planilha. */
export function descreverFiltros(f: Filtros, nomesExcluidos: string[] = []): string {
  const partes = [
    f.estado && `estado ${f.estado}`,
    f.faixa && FAIXAS_CARTEIRA.find((x) => x.id === f.faixa)?.rotulo.toLowerCase(),
    f.desde && `concluídos desde ${f.desde.split("-").reverse().join("/")}`,
    nomesExcluidos.length && `sem ${nomesExcluidos.join(", ")}`,
  ].filter(Boolean);
  return partes.length ? partes.join("; ") : "todos os questionários concluídos";
}

// ---------------------------------------------------------------- leitura completa

export type LeituraMercado = {
  clientes: ClienteMercado[];
  indicadores: Array<{ cliente: ClienteMercado; valores: ValoresIndicadores }>;
  resumoIndicadores: Record<string, Estatisticas | null>;
  resumoNumericas: Array<{ pergunta: PerguntaMercado; est: Estatisticas | null }>;
  distribuicoes: Distribuicao[];
};

export function lerMercado(
  perguntas: PerguntaMercado[],
  clientes: ClienteMercado[],
): LeituraMercado {
  const indicadores = clientes.map((c) => ({
    cliente: c,
    valores: indicadoresDoCliente(c.respostas),
  }));
  const resumoIndicadores = Object.fromEntries(
    INDICADORES.map((ind) => [
      ind.chave,
      estatisticas(indicadores.map((l) => l.valores[ind.chave] ?? null)),
    ]),
  );
  const resumoNumericas = perguntas
    .filter((p) => ehNumerica(p.tipo))
    .map((p) => ({
      pergunta: p,
      est: estatisticas(clientes.map((c) => num(c.respostas[p.chave]))),
    }));
  const distribuicoes = perguntas
    .filter((p) => ehEscolha(p.tipo))
    .map((p) => distribuicao(p, clientes));
  return { clientes, indicadores, resumoIndicadores, resumoNumericas, distribuicoes };
}

/** Valor de uma resposta como texto de célula ou de prompt. */
export function textoResposta(v: unknown): string {
  return lista(v).join("; ");
}
