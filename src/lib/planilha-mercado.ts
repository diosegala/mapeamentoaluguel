// Planilha da leitura de mercado, montada no navegador com os mesmos números do dashboard.
import type { Cell, Row, Sheet } from "write-excel-file/browser";

import {
  INDICADORES,
  ehEscolha,
  ehNumerica,
  textoResposta,
  type Formato,
  type LeituraMercado,
  type PerguntaMercado,
} from "@/lib/mercado";
import { num } from "@/lib/projecao-carteira";

const FORMATOS: Record<Formato, string> = {
  inteiro: "#,##0",
  decimal: "#,##0.0",
  reais: '"R$" #,##0',
  pct: "0.0%",
  pontos: "0.0%",
  dias: "0",
};

const cab = (textos: string[]): Row =>
  textos.map((t) => ({ value: t, fontWeight: "bold", wrap: true }));
const texto = (v: string): Cell => ({ value: v, type: String });

/** Número com o formato do indicador; "pontos" (ex.: inadimplência 7) vira 0,07 para o formato de %. */
function numero(v: number | null | undefined, formato: Formato): Cell {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return { value: formato === "pontos" ? v / 100 : v, type: Number, format: FORMATOS[formato] };
}

const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Abas da planilha; separado do download para poder ser testado fora do navegador. */
export function montarAbas(
  leitura: LeituraMercado,
  perguntas: PerguntaMercado[],
  base: string,
): Sheet<unknown>[] {
  const clientes = leitura.clientes;

  const sobre: Row[] = [
    cab(["Leitura de mercado CUPOLA"]),
    [texto("Gerada em"), texto(new Date().toLocaleString("pt-BR"))],
    [texto("Base"), texto(base)],
    [texto("Imobiliárias"), { value: clientes.length, type: Number }],
    [
      texto("Indicadores"),
      texto(
        "Mesmas fórmulas do relatório individual; crescimento em 12 meses no cenário de referência CUPOLA (TRID 60%, TCNC 30%).",
      ),
    ],
  ];

  const respostas: Row[] = [
    cab(["Imobiliária", "Cidade", "UF", "Concluído em", ...perguntas.map((p) => p.texto)]),
    ...clientes.map((c) => [
      texto(c.nome),
      texto(c.cidade),
      texto(c.estado),
      texto(dataBr(c.concluido_em)),
      ...perguntas.map((p): Cell => {
        const v = c.respostas[p.chave];
        if (ehNumerica(p.tipo)) {
          const n = num(v);
          return n === null ? null : { value: n, type: Number };
        }
        const outro = c.respostas[`${p.chave}__outro`];
        const t =
          textoResposta(v) +
          (typeof outro === "string" && outro.trim() ? ` (Outro: ${outro.trim()})` : "");
        return t ? texto(t) : null;
      }),
    ]),
  ];

  const indicadores: Row[] = [
    cab(["Imobiliária", "UF", ...INDICADORES.map((i) => i.rotulo)]),
    ...leitura.indicadores.map(({ cliente, valores }) => [
      texto(cliente.nome),
      texto(cliente.estado),
      ...INDICADORES.map((i) => numero(valores[i.chave], i.formato)),
    ]),
    [],
    [texto("Como cada indicador é calculado")],
    ...INDICADORES.map((i) => [texto(i.rotulo), texto(i.explicacao)]),
  ];

  const linhaEst = (
    rotulo: string,
    est: LeituraMercado["resumoIndicadores"][string],
    formato: Formato,
  ): Row => [
    texto(rotulo),
    est ? { value: est.n, type: Number } : null,
    ...(["min", "p25", "mediana", "p75", "max", "media"] as const).map((k) =>
      numero(est?.[k], formato),
    ),
  ];
  const resumo: Row[] = [
    cab(["Medida", "Respostas", "Mínimo", "P25", "Mediana", "P75", "Máximo", "Média"]),
    ...INDICADORES.map((i) =>
      linhaEst(i.rotulo, leitura.resumoIndicadores[i.chave] ?? null, i.formato),
    ),
    [],
    cab(["Pergunta numérica"]),
    ...leitura.resumoNumericas.map(({ pergunta, est }) =>
      linhaEst(pergunta.texto, est, pergunta.tipo === "moeda" ? "reais" : "decimal"),
    ),
  ];

  const distribuicoes: Row[] = [
    cab(["Pergunta", "Opção", "Imobiliárias", "% de quem respondeu", "Respondentes", "Quais"]),
    ...leitura.distribuicoes.flatMap((d) =>
      d.itens.map((i) => [
        texto(d.texto),
        texto(i.opcao),
        { value: i.contagem, type: Number },
        { value: i.pct, type: Number, format: "0%" },
        { value: d.respondentes, type: Number },
        texto(i.clientes.join(", ")),
      ]),
    ),
  ];

  const abertos: Row[] = [
    cab(["Imobiliária", "Pergunta", "Resposta"]),
    ...perguntas
      .filter((p) => !ehEscolha(p.tipo) && !ehNumerica(p.tipo))
      .flatMap((p) =>
        clientes
          .filter((c) => textoResposta(c.respostas[p.chave]))
          .map((c) => [texto(c.nome), texto(p.texto), texto(textoResposta(c.respostas[p.chave]))]),
      ),
    ...leitura.distribuicoes.flatMap((d) =>
      d.outros.map((o) => [texto(o.cliente), texto(`${d.texto} (Outro)`), texto(o.texto)]),
    ),
  ];

  const largura = (n: number, primeira = 32, demais = 18) => [
    { width: primeira },
    ...Array(n).fill({ width: demais }),
  ];
  const abas: Sheet<unknown>[] = [
    { sheet: "Sobre", data: sobre, columns: [{ width: 16 }, { width: 90 }] },
    {
      sheet: "Respostas",
      data: respostas,
      columns: largura(perguntas.length + 3, 30, 28),
      stickyRowsCount: 1,
      stickyColumnsCount: 1,
    },
    {
      sheet: "Indicadores",
      data: indicadores,
      columns: largura(INDICADORES.length + 1, 30, 16),
      stickyRowsCount: 1,
      stickyColumnsCount: 1,
    },
    { sheet: "Resumo numérico", data: resumo, columns: largura(7, 48, 14), stickyRowsCount: 1 },
    {
      sheet: "Distribuições",
      data: distribuicoes,
      columns: [
        { width: 60 },
        { width: 60 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 80 },
      ],
      stickyRowsCount: 1,
    },
    {
      sheet: "Textos abertos",
      data: abertos,
      columns: [{ width: 30 }, { width: 60 }, { width: 90 }],
      stickyRowsCount: 1,
    },
  ] as Sheet<unknown>[];
  return abas;
}

export async function baixarPlanilhaMercado(
  leitura: LeituraMercado,
  perguntas: PerguntaMercado[],
  base: string,
) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  await writeXlsxFile(montarAbas(leitura, perguntas, base) as never).toFile(
    `cupola-mercado-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
