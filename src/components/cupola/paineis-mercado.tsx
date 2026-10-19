// Painéis da leitura de mercado, usados no dashboard e no relatório para a liderança.
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { PontosIndicador } from "@/components/cupola/graficos-mercado";
import {
  DORES,
  INDICADORES,
  formatar,
  indicadoresDoCliente,
  quartil,
  type ClienteMercado,
  type Indicador,
  type LeituraMercado,
} from "@/lib/mercado";

export function TituloPainel({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="titulo-painel grid gap-1">
      <h2 className="titulo-marca text-[18px]">{titulo}</h2>
      {texto && <p className="max-w-3xl text-sm text-foreground-muted">{texto}</p>}
    </div>
  );
}

export function CartoesMercado({ leitura, total }: { leitura: LeituraMercado; total?: number }) {
  const r = leitura.resumoIndicadores;
  const usaIa = leitura.distribuicoes.find((d) => d.chave === "usa_ia");
  const estruturada = usaIa?.itens.find((i) => /estruturada/i.test(i.opcao));
  const cartoes = [
    {
      rotulo: "Imobiliárias na leitura",
      valor: String(leitura.clientes.length),
      detalhe:
        total !== undefined ? `de ${total} com questionário concluído` : "questionários concluídos",
      escuro: false,
    },
    {
      rotulo: "Carteira mediana",
      valor: formatar(r["carteira"]?.mediana, "inteiro"),
      detalhe: r["carteira"]
        ? `imóveis; de ${formatar(r["carteira"].min, "inteiro")} a ${formatar(r["carteira"].max, "inteiro")}`
        : "imóveis administrados",
      escuro: false,
    },
    {
      rotulo: "Conversão de leads, mediana",
      valor: formatar(r["conversaoLeads"]?.mediana, "pct"),
      detalhe: "locações ÷ leads por mês",
      escuro: false,
    },
    {
      rotulo: "Locações ÷ cenário, mediana",
      valor: formatar(r["locacoesVsCenario"]?.mediana, "pct"),
      detalhe: "acima de 100%, a operação aluga mais que a referência CUPOLA",
      escuro: true,
    },
    {
      rotulo: "Usam IA de forma estruturada",
      valor: usaIa?.respondentes ? `${estruturada?.contagem ?? 0} de ${usaIa.respondentes}` : "—",
      detalhe: "as demais usam de forma informal, testam ou não usam",
      escuro: false,
    },
  ];
  return (
    <div className="cartoes-mercado grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cartoes.map((c) => (
        <div
          key={c.rotulo}
          className={`grid content-start gap-1 rounded-2xl border p-5 ${
            c.escuro
              ? "border-dark-background bg-dark-background text-foreground-on-dark"
              : "border-border bg-card"
          }`}
        >
          <span
            className={`text-[13px] font-semibold ${c.escuro ? "text-primary" : "text-foreground-muted"}`}
          >
            {c.rotulo}
          </span>
          <span className="titulo-marca text-[24px] leading-[1.6] tabular-nums">{c.valor}</span>
          <span className={`text-[12px] ${c.escuro ? "text-[#9ea2a8]" : "text-foreground-subtle"}`}>
            {c.detalhe}
          </span>
        </div>
      ))}
    </div>
  );
}

/** As dores mais citadas somando todas as perguntas de gargalo (sem a expectativa sobre IA). */
export function RankingDores({
  leitura,
  limite = 6,
}: {
  leitura: LeituraMercado;
  limite?: number;
}) {
  const itens = DORES.filter((d) => d.chave !== "expectativa_ia")
    .flatMap((dor) => {
      const d = leitura.distribuicoes.find((x) => x.chave === dor.chave);
      return (d?.itens ?? [])
        .filter((i) => i.contagem > 0 && i.opcao !== "Outro")
        .map((i) => ({ ...i, area: dor.titulo, respondentes: d?.respondentes ?? 0 }));
    })
    .sort((a, b) => b.pct - a.pct || b.contagem - a.contagem)
    .slice(0, limite);
  if (!itens.length) return null;
  return (
    <ol className="ranking-dores grid gap-3 rounded-2xl bg-dark-background p-5 text-foreground-on-dark">
      {itens.map((i, k) => (
        <li
          key={i.area + i.opcao}
          className="grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-x-3 gap-y-1.5"
        >
          <span className="titulo-marca text-[15px] text-primary">{k + 1}</span>
          <span className="text-[14px] leading-[1.4]">
            {i.opcao} <span className="text-[12px] text-[#9ea2a8]">· {i.area.toLowerCase()}</span>
          </span>
          <span className="text-[14px] font-semibold whitespace-nowrap tabular-nums">
            {i.contagem} de {i.respondentes}
          </span>
          <span />
          <span className="col-span-2 h-1.5 rounded-full bg-dark-border">
            <span
              className="block h-1.5 rounded-full bg-primary"
              style={{ width: `${i.pct * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Um gráfico de pontos por indicador, em duas colunas. */
export function GradeIndicadores({
  leitura,
  indicadores = INDICADORES,
}: {
  leitura: LeituraMercado;
  indicadores?: Indicador[];
}) {
  return (
    <div className="grade-indicadores grid gap-4 md:grid-cols-2">
      {indicadores.map((ind) => (
        <PontosIndicador
          key={ind.chave}
          ind={ind}
          est={leitura.resumoIndicadores[ind.chave] ?? null}
          pontos={leitura.indicadores
            .filter((l) => l.valores[ind.chave] !== null && l.valores[ind.chave] !== undefined)
            .map((l) => ({ nome: l.cliente.nome, valor: l.valores[ind.chave]! }))}
        />
      ))}
    </div>
  );
}

/**
 * Tabela com uma linha por imobiliária e uma coluna por indicador. Com `alternar`, cada linha
 * ganha a caixa para entrar ou sair da conta (dashboard); sem ela, é só leitura (relatório).
 */
export function TabelaComparativa({
  clientes,
  leitura,
  colunas = INDICADORES,
  excluidos = [],
  alternar,
}: {
  clientes: ClienteMercado[];
  leitura: LeituraMercado;
  colunas?: Indicador[];
  excluidos?: string[];
  alternar?: (id: string) => void;
}) {
  const [ordem, setOrdem] = useState<{ chave: string; desc: boolean }>({
    chave: "carteira",
    desc: true,
  });
  const valores = new Map(leitura.indicadores.map((l) => [l.cliente.id, l.valores]));
  // Excluídos continuam visíveis (para voltar à conta), com valores calculados à parte.
  const linhas = clientes.map((c) => ({
    c,
    v: valores.get(c.id) ?? indicadoresDoCliente(c.respostas),
  }));
  linhas.sort((a, b) => {
    if (ordem.chave === "nome") return a.c.nome.localeCompare(b.c.nome) * (ordem.desc ? -1 : 1);
    const va = a.v[ordem.chave] ?? null;
    const vb = b.v[ordem.chave] ?? null;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * (ordem.desc ? -1 : 1);
  });
  const ordenar = (chave: string) =>
    setOrdem((o) => ({ chave, desc: o.chave === chave ? !o.desc : chave !== "nome" }));
  const seta = (chave: string) =>
    ordem.chave === chave ? (
      ordem.desc ? (
        <ArrowDown className="print-hidden inline h-3 w-3" />
      ) : (
        <ArrowUp className="print-hidden inline h-3 w-3" />
      )
    ) : null;

  return (
    <div className="tabela-comparativa overflow-x-auto rounded-2xl border border-border bg-card">
      <table className={`w-full text-left text-[13px] ${alternar ? "min-w-[1100px]" : ""}`}>
        <thead className="border-b border-border text-[12px] text-foreground-subtle">
          <tr>
            {alternar && <th className="px-3 py-3" />}
            <th className="px-3 py-3 font-semibold">
              <Ordenar
                ativo={Boolean(alternar)}
                onClick={() => ordenar("nome")}
                className="text-left hover:text-foreground"
              >
                Imobiliária {seta("nome")}
              </Ordenar>
            </th>
            {colunas.map((ind) => (
              <th
                key={ind.chave}
                className="px-3 py-3 text-right align-bottom font-semibold"
                title={ind.explicacao}
              >
                <Ordenar
                  ativo={Boolean(alternar)}
                  onClick={() => ordenar(ind.chave)}
                  className="text-right hover:text-foreground"
                >
                  {ind.rotulo} {seta(ind.chave)}
                </Ordenar>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ c, v }) => {
            const fora = excluidos.includes(c.id);
            return (
              <tr
                key={c.id}
                className={`border-b border-border last:border-0 ${fora ? "opacity-40" : ""}`}
              >
                {alternar && (
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={!fora}
                      onChange={() => alternar(c.id)}
                      aria-label={`Incluir ${c.nome} na leitura`}
                      className="h-4 w-4 accent-[var(--color-foreground)]"
                    />
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <Link
                    to="/admin/diagnostico/$id"
                    params={{ id: c.id }}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {c.nome}
                  </Link>
                  <span className="cidade block text-[12px] text-foreground-subtle">
                    {c.cidade}/{c.estado}
                  </span>
                </td>
                {colunas.map((ind) => {
                  const valor = v[ind.chave] ?? null;
                  const pos = fora
                    ? null
                    : quartil(valor, leitura.resumoIndicadores[ind.chave] ?? null, ind);
                  return (
                    <td
                      key={ind.chave}
                      className={`px-3 py-2.5 text-right whitespace-nowrap tabular-nums ${
                        pos === "bom"
                          ? "bg-accent font-semibold"
                          : pos === "atencao"
                            ? "bg-background-secondary"
                            : ""
                      }`}
                    >
                      {pos === "bom" && (
                        <span className="mr-1 text-[10px]" aria-label="quarto mais favorável">
                          ▲
                        </span>
                      )}
                      {pos === "atencao" && (
                        <span
                          className="mr-1 text-[10px] text-foreground-muted"
                          aria-label="quarto que pede atenção"
                        >
                          ▼
                        </span>
                      )}
                      {formatar(valor, ind.formato)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={colunas.length + 2} className="px-3 py-6 text-sm text-foreground-muted">
                Nenhuma imobiliária neste recorte.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Cabeçalho que ordena no dashboard; no relatório, só texto. */
function Ordenar({
  ativo,
  onClick,
  className,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  if (!ativo) return <span className={className}>{children}</span>;
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
