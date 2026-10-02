import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { RelatorioCupola } from "@/components/cupola/relatorio-cupola";
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

  if (q.isLoading) return <Tela titulo="Carregando..." />;
  if (q.error)
    return (
      <Tela titulo="Não foi possível abrir" texto={(q.error as Error).message}>
        <Link to="/" className="mt-8 inline-block text-sm text-foreground-on-dark underline">
          Voltar ao início
        </Link>
      </Tela>
    );
  if (!d) return null;

  if (d.conteudo) {
    return (
      <main className="min-h-screen bg-background print:bg-white">
        <RelatorioCupola
          conteudo={d.conteudo}
          nome={d.nome}
          local={[d.cidade, d.estado].filter(Boolean).join("/")}
          geradoEm={d.geradoEm}
          numeros={d.numeros}
          acoes={
            <Button onClick={() => window.print()}>
              <Download /> Baixar PDF
            </Button>
          }
        />
        <p className="mx-auto max-w-5xl px-5 pb-12 text-[13px] text-foreground-subtle sm:px-8">
          Este relatório foi gerado com apoio de inteligência artificial a partir das respostas do questionário, passou
          por revisão automática de qualidade e é um diagnóstico inicial.
        </p>
      </main>
    );
  }

  if (d.statusRelatorio === "erro" || d.statusDiagnostico === "erro_geracao") {
    return (
      <Tela
        titulo="Tivemos um problema ao gerar o relatório"
        texto={erroAcao ?? "Suas respostas estão salvas. Você pode tentar novamente."}
      >
        <Button
          size="lg"
          className="mt-8"
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
      </Tela>
    );
  }

  if (d.statusRelatorio === "gerando") return <Espera iniciadoEm={d.iniciadoEm} />;

  return (
    <Tela titulo="Relatório ainda não disponível" texto="Conclua o questionário para gerar o relatório.">
      <Link to="/formulario/$codigo" params={{ codigo }} className="mt-8 inline-block text-sm text-foreground-on-dark underline">
        Ir para o questionário
      </Link>
    </Tela>
  );
}

/** Etapas reais do processo; o tempo decorrido mostra que a página segue viva. */
function Espera({ iniciadoEm }: { iniciadoEm: string | null }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const minutos = iniciadoEm ? Math.max(0, Math.floor((agora - new Date(iniciadoEm).getTime()) / 60_000)) : 0;
  const etapas = [
    { texto: "Respostas recebidas", feita: true },
    { texto: "Indicadores e projeção da carteira calculados", feita: true },
    { texto: "Escrevendo a análise com o Método CUPOLA e revisando a qualidade", feita: false },
  ];
  return (
    <Tela titulo="Estamos preparando o seu diagnóstico">
      <ol className="mt-8 grid gap-3 text-left">
        {etapas.map((e) => (
          <li
            key={e.texto}
            className={`grid grid-cols-[28px_1fr] items-center gap-3 text-[15px] ${e.feita ? "text-foreground-on-dark" : "font-semibold text-foreground-on-dark"}`}
          >
            {e.feita ? (
              <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-4" />
              </span>
            ) : (
              <span className="grid size-7 place-items-center rounded-full ring-2 ring-primary ring-inset">
                <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
              </span>
            )}
            {e.texto}
          </li>
        ))}
      </ol>
      <p className="mt-8 text-[14px] text-[#9ea2a8]">
        Leva de 5 a 8 minutos{minutos > 0 ? ` (${minutos} min até agora)` : ""}. Pode deixar esta página aberta: ela atualiza
        sozinha.
      </p>
    </Tela>
  );
}

function Tela({ titulo, texto, children }: { titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-dark-background px-6 py-8 text-foreground-on-dark">
      <img src="/brand/cupola-branca.png" alt="CUPOLA" className="h-7 w-auto self-start" />
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-lg">
          <h1 className="titulo-marca text-[22px] sm:text-[26px]">{titulo}</h1>
          {texto && <p className="mt-4 text-base text-[#c9c6be]">{texto}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}
