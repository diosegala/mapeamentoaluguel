import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { AvisoIa, RelatorioMarkdown } from "@/components/cupola/relatorio-markdown";
import { Button } from "@/components/ui/button";
import { concluirEGerar, lerRelatorio, processarRelatorio } from "@/lib/publico.functions";

export const Route = createFileRoute("/relatorio/$codigo")({
  head: () => ({
    meta: [
      { title: "Relatório de diagnóstico | CUPOLA" },
      { name: "description", content: "Relatório de diagnóstico da operação de locação." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Relatório de diagnóstico | CUPOLA" },
      { property: "og:description", content: "Relatório de diagnóstico da operação de locação." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: Relatorio,
});

function Relatorio() {
  const { codigo } = Route.useParams();
  const ler = useServerFn(lerRelatorio);
  const processar = useServerFn(processarRelatorio);
  const concluir = useServerFn(concluirEGerar);
  const disparado = useRef(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["relatorio-publico", codigo],
    queryFn: async () => {
      const r = await ler({ data: { codigo } });
      if (r.erro !== null) throw new Error(r.erro);
      return r;
    },
    retry: false,
    refetchInterval: (query) => {
      const d = query.state.data;
      return d && !d.conteudo && d.statusRelatorio === "gerando" ? 3000 : false;
    },
  });

  const d = q.data;
  useEffect(() => {
    if (d?.statusRelatorio === "gerando" && !d.conteudo && !disparado.current) {
      disparado.current = true;
      processar({ data: { codigo } }).finally(() => q.refetch());
    }
  }, [d?.statusRelatorio, d?.conteudo]);

  if (q.isLoading) return <Centro titulo="Carregando..." />;
  if (q.error)
    return (
      <Centro titulo="Não foi possível abrir" texto={(q.error as Error).message}>
        <Link to="/" className="mt-6 inline-block text-sm underline">Voltar ao início</Link>
      </Centro>
    );
  if (!d) return null;

  if (d.conteudo) {
    return (
      <main className="min-h-screen bg-background px-6 py-12 print:p-0">
        <article className="relatorio-pdf mx-auto max-w-3xl">
          <div className="print-hidden mb-6 flex justify-end">
            <Button onClick={() => window.print()}>Baixar PDF</Button>
          </div>
          <div className="relatorio-capa">
            <span className="capa-marca inline-flex rounded-[40px] bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground">
              Diagnóstico CUPOLA
            </span>
            <h1 className="mt-4 text-[34px] leading-[40px] font-bold text-foreground">{d.nome}</h1>
            <p className="capa-meta mt-2 text-sm text-foreground-muted">
              Diagnóstico da Operação de Locação · {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="mt-6 print:hidden"><AvisoIa /></div>
          <div className="relatorio-conteudo mt-8"><RelatorioMarkdown conteudo={d.conteudo} /></div>
          <p className="mt-10 hidden border-t border-border pt-4 text-xs text-foreground-subtle print:block">
            Este relatório foi gerado por inteligência artificial a partir das respostas do questionário e é um
            diagnóstico inicial. Ele não substitui a análise aprofundada da equipe CUPOLA.
          </p>
        </article>
      </main>
    );
  }

  if (d.statusRelatorio === "erro" || d.statusDiagnostico === "erro_geracao") {
    return (
      <Centro
        titulo="Tivemos um problema ao gerar o relatório"
        texto={erroAcao ?? "Suas respostas estão salvas. Você pode tentar novamente."}
      >
        <Button
          className="mt-6"
          onClick={async () => {
            setErroAcao(null);
            try {
              await concluir({ data: { codigo } });
              disparado.current = false;
              q.refetch();
            } catch (e) {
              setErroAcao((e as Error).message);
            }
          }}
        >
          Tentar novamente
        </Button>
      </Centro>
    );
  }

  if (d.statusRelatorio === "gerando") {
    return (
      <Centro
        titulo="Estamos escrevendo o seu diagnóstico"
        texto="Isso leva de 1 a 3 minutos. Pode deixar esta página aberta — ela atualiza sozinha."
        animar
      />
    );
  }

  return (
    <Centro titulo="Relatório ainda não disponível" texto="Conclua o questionário para gerar o relatório.">
      <Link to="/formulario/$codigo" params={{ codigo }} className="mt-6 inline-block text-sm underline">
        Ir para o questionário
      </Link>
    </Centro>
  );
}

function Centro({
  titulo,
  texto,
  animar,
  children,
}: {
  titulo: string;
  texto?: string;
  animar?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-lg text-center">
        {animar && (
          <div className="mx-auto mb-6 flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-3 animate-bounce rounded-full bg-primary"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}
        <h1 className="text-[28px] leading-[34px] font-bold text-foreground">{titulo}</h1>
        {texto && <p className="mt-3 text-base text-foreground-muted">{texto}</p>}
        {children}
      </div>
    </main>
  );
}
