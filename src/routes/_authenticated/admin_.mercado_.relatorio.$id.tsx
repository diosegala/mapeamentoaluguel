import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { RelatorioCupola } from "@/components/cupola/relatorio-cupola";
import { Button } from "@/components/ui/button";
import { formatar } from "@/lib/mercado";
import { lerRelatorioMercado } from "@/lib/mercado.functions";

export const Route = createFileRoute("/_authenticated/admin_/mercado_/relatorio/$id")({
  head: () => ({ meta: [{ title: "Leitura de mercado | CUPOLA" }] }),
  component: RelatorioMercado,
});

function RelatorioMercado() {
  const { id } = Route.useParams();
  const ler = useServerFn(lerRelatorioMercado);
  const q = useQuery({ queryKey: ["relatorio-mercado", id], queryFn: () => ler({ data: { id } }) });
  const r = q.data;

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
          <RelatorioCupola
            conteudo={r.conteudo}
            nome="Leitura de mercado"
            rotulo={`Relatório para a liderança CUPOLA · versão ${r.versao}`}
            local={`Base: ${r.base}`}
            geradoEm={r.created_at}
            numeros={null}
            destaques={r.resumo ? <Resumo resumo={r.resumo} /> : undefined}
            acoes={
              <>
                <Button
                  variant="outline"
                  asChild
                  className="border-dark-border bg-transparent text-foreground-on-dark"
                >
                  <Link to="/admin/mercado">Voltar ao painel</Link>
                </Button>
                <Button onClick={() => window.print()}>
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

function Resumo({
  resumo,
}: {
  resumo: {
    n: number;
    carteiraMediana: number | null;
    conversaoMediana: number | null;
    crescimentoMediana: number | null;
    iaEstruturada: string | null;
  };
}) {
  const cartoes = [
    {
      rotulo: "Imobiliárias na leitura",
      valor: String(resumo.n),
      detalhe: "questionários concluídos",
      escuro: false,
    },
    {
      rotulo: "Carteira mediana",
      valor: formatar(resumo.carteiraMediana, "inteiro"),
      detalhe: "imóveis administrados",
      escuro: false,
    },
    {
      rotulo: "Crescimento em 12 meses, mediana",
      valor: formatar(resumo.crescimentoMediana, "pct"),
      detalhe: "no cenário de referência CUPOLA",
      escuro: true,
    },
    {
      rotulo: "Conversão de leads, mediana",
      valor: formatar(resumo.conversaoMediana, "pct"),
      detalhe: "locações ÷ leads por mês",
      escuro: false,
    },
    {
      rotulo: "Usam IA de forma estruturada",
      valor: resumo.iaEstruturada ?? "—",
      detalhe: "imobiliárias",
      escuro: false,
    },
  ];
  return (
    <div className="destaques -mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          <span className="titulo-marca text-[26px] leading-[1.6] tabular-nums">{c.valor}</span>
          <span className={`text-[13px] ${c.escuro ? "text-[#9ea2a8]" : "text-foreground-subtle"}`}>
            {c.detalhe}
          </span>
        </div>
      ))}
    </div>
  );
}
