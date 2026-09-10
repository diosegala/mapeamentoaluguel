import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/relatorio/$codigo")({
  head: () => ({
    meta: [
      { title: "Relatório de diagnóstico | CUPOLA" },
      {
        name: "description",
        content: "Relatório de diagnóstico da operação de locação gerado para a sua imobiliária.",
      },
      { property: "og:title", content: "Relatório de diagnóstico | CUPOLA" },
      {
        property: "og:description",
        content: "Relatório de diagnóstico da operação de locação gerado para a sua imobiliária.",
      },
    ],
  }),
  component: Relatorio,
});

function Relatorio() {
  const { codigo } = Route.useParams();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-lg text-center">
        <h1 className="text-[30px] leading-[36px] font-bold text-foreground">
          Relatório em preparação
        </h1>
        <p className="mt-3 text-base text-foreground-muted">
          O relatório do código <strong className="text-foreground">{codigo}</strong> ficará
          disponível aqui assim que a base de dados do diagnóstico estiver conectada.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center rounded-[10px] bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
