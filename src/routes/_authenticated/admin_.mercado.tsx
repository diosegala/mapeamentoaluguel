import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Download } from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { BarrasDistribuicao, PontosIndicador } from "@/components/cupola/graficos-mercado";
import { Button } from "@/components/ui/button";
import {
  DORES,
  FAIXAS_CARTEIRA,
  FILTROS_VAZIOS,
  INDICADORES,
  aplicarFiltros,
  descreverFiltros,
  ehDor,
  ehTecnologia,
  formatar,
  indicadoresDoCliente,
  lerMercado,
  quartil,
  type Filtros,
} from "@/lib/mercado";
import {
  dadosMercado,
  gerarRelatorioMercado,
  listarRelatoriosMercado,
} from "@/lib/mercado.functions";

export const Route = createFileRoute("/_authenticated/admin_/mercado")({
  head: () => ({
    meta: [
      { title: "Leitura de mercado | CUPOLA" },
      {
        name: "description",
        content: "Respostas, dores e indicadores de todos os clientes, lado a lado.",
      },
    ],
  }),
  component: Mercado,
});

const BASE_PEQUENA = 5;
const seletor = "h-9 rounded-2xl border border-border bg-card px-3 text-sm text-foreground";

function Mercado() {
  const buscar = useServerFn(dadosMercado);
  const q = useQuery({ queryKey: ["mercado"], queryFn: () => buscar() });
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [baixando, setBaixando] = useState(false);

  const todos = useMemo(() => q.data?.clientes ?? [], [q.data]);
  const perguntas = useMemo(() => q.data?.perguntas ?? [], [q.data]);
  // O recorte respeita estado, faixa e data; a exclusão manual só tira da conta, a linha continua na tabela.
  const recorte = useMemo(
    () => aplicarFiltros(todos, { ...filtros, excluidos: [] }),
    [todos, filtros],
  );
  const incluidos = useMemo(
    () => recorte.filter((c) => !filtros.excluidos.includes(c.id)),
    [recorte, filtros.excluidos],
  );
  const leitura = useMemo(() => lerMercado(perguntas, incluidos), [perguntas, incluidos]);
  const estados = useMemo(() => [...new Set(todos.map((c) => c.estado))].sort(), [todos]);
  const nomesExcluidos = todos.filter((c) => filtros.excluidos.includes(c.id)).map((c) => c.nome);
  const base = descreverFiltros(filtros, nomesExcluidos);

  const alternar = (id: string) =>
    setFiltros((f) => ({
      ...f,
      excluidos: f.excluidos.includes(id)
        ? f.excluidos.filter((x) => x !== id)
        : [...f.excluidos, id],
    }));

  async function baixar() {
    setBaixando(true);
    try {
      const { baixarPlanilhaMercado } = await import("@/lib/planilha-mercado");
      await baixarPlanilhaMercado(leitura, perguntas, base);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a planilha.");
    } finally {
      setBaixando(false);
    }
  }

  const dist = (chave: string) => leitura.distribuicoes.find((d) => d.chave === chave);
  const nomeSecao = (n: number) => q.data?.secoes.find((s) => s.numero === n)?.nome ?? `Seção ${n}`;
  const demais = leitura.distribuicoes.filter((d) => !ehDor(d.chave) && !ehTecnologia(d.chave));
  const secoesDemais = [...new Set(demais.map((d) => d.secao))];

  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-1">
              <h1 className="titulo-marca text-[24px]">Leitura de mercado</h1>
              <p className="text-sm text-foreground-muted">
                Respostas, dores e indicadores dos clientes com questionário concluído. Base: {base}
                .
              </p>
            </div>
            <Button
              variant="outline"
              disabled={baixando || !incluidos.length}
              onClick={baixar}
              className="gap-2"
            >
              <Download className="h-4 w-4" /> {baixando ? "Gerando..." : "Baixar planilha"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Estado"
              className={seletor}
              value={filtros.estado}
              onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
            >
              <option value="">Todos os estados</option>
              {estados.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            <select
              aria-label="Tamanho da carteira"
              className={seletor}
              value={filtros.faixa}
              onChange={(e) => setFiltros((f) => ({ ...f, faixa: e.target.value }))}
            >
              <option value="">Qualquer carteira</option>
              {FAIXAS_CARTEIRA.map((fx) => (
                <option key={fx.id} value={fx.id}>
                  {fx.rotulo}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-foreground-muted">
              Concluídos desde
              <input
                type="date"
                className={seletor}
                value={filtros.desde}
                onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
              />
            </label>
            {(filtros.estado || filtros.faixa || filtros.desde || filtros.excluidos.length > 0) && (
              <Button variant="ghost" size="sm" onClick={() => setFiltros(FILTROS_VAZIOS)}>
                Limpar filtros
              </Button>
            )}
          </div>
        </header>

        {q.isLoading && <p className="text-sm text-foreground-muted">Carregando...</p>}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

        {q.data && (
          <>
            {incluidos.length > 0 && incluidos.length < BASE_PEQUENA && (
              <p className="rounded-2xl border border-border bg-background-secondary p-4 text-sm text-foreground-muted">
                Base pequena ({incluidos.length}{" "}
                {incluidos.length === 1 ? "imobiliária" : "imobiliárias"}): leia os números como
                sinais, não como retrato do mercado.
              </p>
            )}

            <Cartoes leitura={leitura} total={todos.length} />

            <RelatoriosLideranca filtros={filtros} base={base} n={incluidos.length} />

            <section className="grid gap-4">
              <Titulo
                titulo="Principais dores"
                texto="Perguntas em que a imobiliária marca até três gargalos. Passe o mouse numa barra para ver quem marcou."
              />
              <RankingDores leitura={leitura} />
              <div className="grid gap-4 md:grid-cols-2">
                {DORES.map((dor) => {
                  const d = dist(dor.chave);
                  return d ? (
                    <BarrasDistribuicao key={dor.chave} d={d} titulo={dor.titulo} />
                  ) : null;
                })}
              </div>
            </section>

            <section className="grid gap-4">
              <Titulo
                titulo="Indicadores"
                texto="Um ponto por imobiliária. A faixa clara é a metade central da base; a linha escura, a mediana. Mesmas fórmulas do relatório individual."
              />
              <div className="grid gap-4 md:grid-cols-2">
                {INDICADORES.map((ind) => (
                  <PontosIndicador
                    key={ind.chave}
                    ind={ind}
                    est={leitura.resumoIndicadores[ind.chave] ?? null}
                    pontos={leitura.indicadores
                      .filter(
                        (l) => l.valores[ind.chave] !== null && l.valores[ind.chave] !== undefined,
                      )
                      .map((l) => ({ nome: l.cliente.nome, valor: l.valores[ind.chave]! }))}
                  />
                ))}
              </div>
            </section>

            <Comparativo
              recorte={recorte}
              excluidos={filtros.excluidos}
              alternar={alternar}
              leitura={leitura}
            />

            <section className="grid gap-4">
              <Titulo
                titulo="Tecnologia e IA"
                texto="Sistemas, integrações e maturidade no uso de inteligência artificial."
              />
              <div className="grid gap-4 md:grid-cols-2">
                {leitura.distribuicoes
                  .filter((d) => ehTecnologia(d.chave))
                  .map((d) => (
                    <BarrasDistribuicao key={d.chave} d={d} />
                  ))}
              </div>
            </section>

            {secoesDemais.map((s) => (
              <section key={s} className="grid gap-4">
                <Titulo titulo={nomeSecao(s)} />
                <div className="grid gap-4 md:grid-cols-2">
                  {demais
                    .filter((d) => d.secao === s)
                    .map((d) => (
                      <BarrasDistribuicao key={d.chave} d={d} />
                    ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}

/** Relatório escrito pela IA para a liderança, com o recorte atual; roda na fila e fica guardado por versão. */
function RelatoriosLideranca({ filtros, base, n }: { filtros: Filtros; base: string; n: number }) {
  const listar = useServerFn(listarRelatoriosMercado);
  const gerar = useServerFn(gerarRelatorioMercado);
  const q = useQuery({
    queryKey: ["relatorios-mercado"],
    queryFn: () => listar(),
    refetchInterval: (query) =>
      query.state.data?.some((r) => r.status === "gerando") ? 5000 : false,
  });
  const mut = useMutation({
    mutationFn: () => gerar({ data: filtros }),
    onSuccess: () => toast.success("Relatório na fila. Fica pronto em alguns minutos."),
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => q.refetch(),
  });
  const versoes = q.data ?? [];

  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Titulo
          titulo="Relatório para a liderança"
          texto="A IA lê os números desta página, as dores, os textos de “Outro” e as prioridades dos relatórios publicados, e escreve uma leitura consolidada com perfis de clientes e oportunidades para a CUPOLA. Usa o recorte atual dos filtros."
        />
        <Button
          disabled={mut.isPending || n === 0}
          onClick={() => {
            if (
              window.confirm(
                `Gerar relatório para a liderança com ${n} imobiliária(s)?\n\nBase: ${base}.`,
              )
            )
              mut.mutate();
          }}
        >
          {mut.isPending ? "Enviando para a fila..." : "Gerar relatório"}
        </Button>
      </div>
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {versoes.length > 0 && (
        <ul className="grid gap-2 text-sm">
          {versoes.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border pt-2"
            >
              <strong>v{r.versao}</strong>
              {r.status === "concluido" ? (
                <Link
                  to="/admin/mercado/relatorio/$id"
                  params={{ id: r.id }}
                  className="font-semibold underline underline-offset-4"
                >
                  Abrir relatório
                </Link>
              ) : r.status === "gerando" ? (
                <span className="text-foreground-muted">gerando...</span>
              ) : (
                <span className="text-destructive">erro: {r.erro}</span>
              )}
              <span className="text-foreground-subtle">
                {new Date(r.created_at).toLocaleString("pt-BR")}
              </span>
              <span className="text-foreground-subtle">
                {r.clientes} imobiliárias · {r.base}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Titulo({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="grid gap-1">
      <h2 className="titulo-marca text-[18px]">{titulo}</h2>
      {texto && <p className="max-w-3xl text-sm text-foreground-muted">{texto}</p>}
    </div>
  );
}

function Cartoes({ leitura, total }: { leitura: ReturnType<typeof lerMercado>; total: number }) {
  const r = leitura.resumoIndicadores;
  const usaIa = leitura.distribuicoes.find((d) => d.chave === "usa_ia");
  const estruturada = usaIa?.itens.find((i) => /estruturada/i.test(i.opcao));
  const cartoes = [
    {
      rotulo: "Imobiliárias na leitura",
      valor: String(leitura.clientes.length),
      detalhe: `de ${total} com questionário concluído`,
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
      rotulo: "Crescimento em 12 meses, mediana",
      valor: formatar(r["crescimento"]?.mediana, "pct"),
      detalhe: "no cenário de referência CUPOLA",
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
function RankingDores({ leitura }: { leitura: ReturnType<typeof lerMercado> }) {
  const itens = DORES.filter((d) => d.chave !== "expectativa_ia")
    .flatMap((dor) => {
      const d = leitura.distribuicoes.find((x) => x.chave === dor.chave);
      return (d?.itens ?? [])
        .filter((i) => i.contagem > 0 && i.opcao !== "Outro")
        .map((i) => ({ ...i, area: dor.titulo }));
    })
    .sort((a, b) => b.pct - a.pct || b.contagem - a.contagem)
    .slice(0, 6);
  if (!itens.length) return null;
  return (
    <ol className="grid gap-2 rounded-2xl bg-dark-background p-5 text-foreground-on-dark sm:grid-cols-2">
      {itens.map((i, k) => (
        <li key={i.area + i.opcao} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3">
          <span className="titulo-marca text-[15px] text-primary">{k + 1}</span>
          <span className="text-[14px] leading-[1.4]">
            {i.opcao} <span className="text-[12px] text-[#9ea2a8]">· {i.area.toLowerCase()}</span>
          </span>
          <span className="text-[14px] font-semibold tabular-nums">{Math.round(i.pct * 100)}%</span>
        </li>
      ))}
    </ol>
  );
}

function Comparativo({
  recorte,
  excluidos,
  alternar,
  leitura,
}: {
  recorte: ReturnType<typeof lerMercado>["clientes"];
  excluidos: string[];
  alternar: (id: string) => void;
  leitura: ReturnType<typeof lerMercado>;
}) {
  const [ordem, setOrdem] = useState<{ chave: string; desc: boolean }>({
    chave: "carteira",
    desc: true,
  });
  const valores = new Map(leitura.indicadores.map((l) => [l.cliente.id, l.valores]));
  // Excluídos continuam visíveis (para voltar à conta), com valores calculados à parte.
  const linhas = recorte.map((c) => ({
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
        <ArrowDown className="inline h-3 w-3" />
      ) : (
        <ArrowUp className="inline h-3 w-3" />
      )
    ) : null;

  return (
    <section className="grid gap-4">
      <Titulo
        titulo="Comparativo por imobiliária"
        texto="Clique no título de uma coluna para ordenar. ▲ marca o quarto mais favorável da base no indicador e ▼ o quarto que pede atenção. Desmarque uma imobiliária para tirá-la da conta (útil para testes internos)."
      />
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[1100px] text-left text-[13px]">
          <thead className="border-b border-border text-[12px] text-foreground-subtle">
            <tr>
              <th className="px-3 py-3" />
              <th className="px-3 py-3 font-semibold">
                <button
                  type="button"
                  onClick={() => ordenar("nome")}
                  className="hover:text-foreground"
                >
                  Imobiliária {seta("nome")}
                </button>
              </th>
              {INDICADORES.map((ind) => (
                <th
                  key={ind.chave}
                  className="px-3 py-3 text-right font-semibold"
                  title={ind.explicacao}
                >
                  <button
                    type="button"
                    onClick={() => ordenar(ind.chave)}
                    className="hover:text-foreground"
                  >
                    {ind.rotulo} {seta(ind.chave)}
                  </button>
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
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={!fora}
                      onChange={() => alternar(c.id)}
                      aria-label={`Incluir ${c.nome} na leitura`}
                      className="h-4 w-4 accent-[var(--color-foreground)]"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      to="/admin/diagnostico/$id"
                      params={{ id: c.id }}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {c.nome}
                    </Link>
                    <span className="block text-[12px] text-foreground-subtle">
                      {c.cidade}/{c.estado}
                    </span>
                  </td>
                  {INDICADORES.map((ind) => {
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
                <td
                  colSpan={INDICADORES.length + 2}
                  className="px-3 py-6 text-sm text-foreground-muted"
                >
                  Nenhuma imobiliária neste recorte.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
