import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { BarrasDistribuicao } from "@/components/cupola/graficos-mercado";
import {
  CartoesMercado,
  GradeIndicadores,
  RankingDores,
  TabelaComparativa,
  TituloPainel as Titulo,
} from "@/components/cupola/paineis-mercado";
import { Button } from "@/components/ui/button";
import {
  DORES,
  FAIXAS_CARTEIRA,
  FILTROS_VAZIOS,
  aplicarFiltros,
  descreverFiltros,
  ehDor,
  ehTecnologia,
  lerMercado,
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

            <CartoesMercado leitura={leitura} total={todos.length} />

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
              <GradeIndicadores leitura={leitura} />
            </section>

            <section className="grid gap-4">
              <Titulo
                titulo="Comparativo por imobiliária"
                texto="Clique no título de uma coluna para ordenar. ▲ marca o quarto mais favorável da base no indicador e ▼ o quarto que pede atenção. Desmarque uma imobiliária para tirá-la da conta (útil para testes internos)."
              />
              <TabelaComparativa
                clientes={recorte}
                leitura={leitura}
                excluidos={filtros.excluidos}
                alternar={alternar}
              />
            </section>

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
  const { papel } = useRouteContext({ from: "/_authenticated" });
  const ehAdmin = papel === "admin";
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
          texto={
            ehAdmin
              ? "A IA lê os números desta página, as dores, os textos de “Outro” e as prioridades dos relatórios publicados, e escreve uma leitura consolidada com perfis de clientes e oportunidades para a CUPOLA. Usa o recorte atual dos filtros."
              : "Leitura consolidada da base de clientes, com perfis e oportunidades. Cada versão indica a base de imobiliárias que entrou na conta."
          }
        />
        {ehAdmin && (
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
        )}
      </div>
      {!ehAdmin && q.data && versoes.length === 0 && (
        <p className="text-sm text-foreground-muted">Nenhum relatório gerado ainda.</p>
      )}
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
