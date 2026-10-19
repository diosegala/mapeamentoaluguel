import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Download } from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { RelatorioMercado } from "@/components/cupola/relatorio-mercado";
import { Button } from "@/components/ui/button";
import { lerMercado } from "@/lib/mercado";
import { dadosMercado, lerRelatorioMercado } from "@/lib/mercado.functions";

export const Route = createFileRoute("/_authenticated/admin_/mercado_/relatorio/$id")({
  head: () => ({ meta: [{ title: "Leitura de mercado | CUPOLA" }] }),
  component: PaginaRelatorioMercado,
});

function PaginaRelatorioMercado() {
  const { id } = Route.useParams();
  const ler = useServerFn(lerRelatorioMercado);
  const buscarDados = useServerFn(dadosMercado);
  const q = useQuery({ queryKey: ["relatorio-mercado", id], queryFn: () => ler({ data: { id } }) });
  const dados = useQuery({ queryKey: ["mercado"], queryFn: () => buscarDados() });
  const r = q.data;

  // Os gráficos usam as mesmas imobiliárias que entraram no texto.
  const leitura = useMemo(() => {
    if (!r || !dados.data) return null;
    const ids = new Set(r.diagnosticos_incluidos);
    return lerMercado(
      dados.data.perguntas,
      dados.data.clientes.filter((c) => ids.has(c.id)),
    );
  }, [r, dados.data]);
  const nomeSecao = (n: number) =>
    dados.data?.secoes.find((s) => s.numero === n)?.nome ?? `Seção ${n}`;

  return (
    <main className="min-h-screen bg-background print:bg-white">
      <div className="print-hidden">
        <AdminNav />
      </div>
      {q.isLoading && (
        <p className="mx-auto max-w-5xl px-6 py-8 text-sm text-foreground-muted">Carregando...</p>
      )}
      {q.error && (
        <p className="mx-auto max-w-5xl px-6 py-8 text-sm text-destructive">
          {(q.error as Error).message}
        </p>
      )}
      {r && !r.conteudo && (
        <p className="mx-auto max-w-5xl px-6 py-8 text-sm text-foreground-muted">
          {r.status === "erro"
            ? `A geração falhou: ${r.erro}`
            : "O relatório ainda está sendo gerado."}{" "}
          <Link to="/admin/mercado" className="underline">
            Voltar
          </Link>
        </p>
      )}
      {r?.conteudo && (
        <>
          <RelatorioMercado
            conteudo={r.conteudo}
            versao={r.versao}
            base={r.base}
            geradoEm={r.created_at}
            leitura={leitura}
            nomeSecao={nomeSecao}
            acoes={
              <>
                <Button
                  variant="outline"
                  asChild
                  className="border-dark-border bg-transparent text-foreground-on-dark"
                >
                  <Link to="/admin/mercado">Voltar ao painel</Link>
                </Button>
                <Button onClick={() => window.print()} disabled={!leitura}>
                  <Download /> Baixar PDF
                </Button>
              </>
            }
          />
          <p className="mx-auto max-w-5xl px-5 pb-12 text-[13px] text-foreground-subtle sm:px-8">
            Leitura gerada com apoio de inteligência artificial a partir das respostas dos clientes.
            Os números vêm dos cálculos da plataforma; as conclusões são hipóteses para a liderança
            validar. Uso interno da CUPOLA.
          </p>
        </>
      )}
    </main>
  );
}
