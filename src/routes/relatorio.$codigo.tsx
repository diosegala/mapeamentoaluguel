import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Download } from "lucide-react";

import { RelatorioCupola } from "@/components/cupola/relatorio-cupola";
import { Button } from "@/components/ui/button";
import { lerRelatorio } from "@/lib/publico.functions";

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

  const q = useQuery({
    queryKey: ["relatorio-publico", codigo],
    queryFn: async () => {
      const r = await ler({ data: { codigo } });
      if (r.erro !== null) throw new Error(r.erro);
      return r;
    },
    retry: false,
    // Enquanto prepara, confere de tempos em tempos: no modo automático o relatório aparece sozinho.
    refetchInterval: (query) => (query.state.data?.estado === "preparando" ? 30_000 : false),
  });

  if (q.isLoading) return <Tela titulo="Carregando..." />;
  if (q.error)
    return (
      <Tela titulo="Não foi possível abrir" texto={(q.error as Error).message}>
        <Link to="/" className="mt-8 inline-block text-sm text-foreground-on-dark underline">
          Voltar ao início
        </Link>
      </Tela>
    );
  const d = q.data;
  if (!d) return null;

  if (d.estado === "publicado" && d.conteudo) {
    return (
      <main className="min-h-screen bg-background print:bg-white">
        <RelatorioCupola
          conteudo={d.conteudo}
          nome={d.nome}
          local={[d.cidade, d.estado_uf].filter(Boolean).join("/")}
          geradoEm={d.geradoEm}
          numeros={d.numeros}
          acoes={
            <Button onClick={() => window.print()}>
              <Download /> Baixar PDF
            </Button>
          }
        />
        <p className="mx-auto max-w-5xl px-5 pb-12 text-[13px] text-foreground-subtle sm:px-8">
          Este relatório foi gerado com apoio de inteligência artificial a partir das respostas do questionário, revisado
          pela equipe CUPOLA, e é um diagnóstico inicial.
        </p>
      </main>
    );
  }

  if (d.estado === "preparando") return <Agradecimento nome={d.nome} email={d.email} />;

  return (
    <Tela titulo="Relatório ainda não disponível" texto="Conclua o questionário para receber o diagnóstico.">
      <Link to="/formulario/$codigo" params={{ codigo }} className="mt-8 inline-block text-sm text-foreground-on-dark underline">
        Ir para o questionário
      </Link>
    </Tela>
  );
}

/** Depois do questionário: o diagnóstico é escrito, revisado e chega por e-mail. */
function Agradecimento({ nome, email }: { nome: string; email: string | null }) {
  const etapas = [
    { texto: "Respostas recebidas", feita: true },
    { texto: "Análise da operação com o Método CUPOLA", feita: false },
    { texto: "Revisão da equipe CUPOLA", feita: false },
    { texto: `Envio para ${email ?? "o e-mail informado no questionário"}`, feita: false },
  ];
  return (
    <Tela titulo="Obrigado! Recebemos suas respostas">
      <p className="mt-4 text-base leading-[1.6] text-[#c9c6be]">
        Estamos preparando o diagnóstico da operação de locação da {nome}. Ele chega em até 1 dia útil no e-mail{" "}
        <strong className="text-foreground-on-dark">{email ?? "informado no questionário"}</strong>.
      </p>
      <ol className="mt-8 grid gap-3 text-left">
        {etapas.map((e) => (
          <li key={e.texto} className="grid grid-cols-[28px_1fr] items-center gap-3 text-[15px] text-foreground-on-dark">
            {e.feita ? (
              <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-4" />
              </span>
            ) : (
              <span className="size-7 rounded-full ring-2 ring-[#3a3f47] ring-inset" />
            )}
            {e.texto}
          </li>
        ))}
      </ol>
      <p className="mt-8 text-[14px] text-[#9ea2a8]">
        Pode fechar esta página. Se o e-mail não chegar, confira a caixa de spam ou fale com a equipe CUPOLA.
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
