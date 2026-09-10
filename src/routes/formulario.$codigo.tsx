import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/formulario/$codigo")({
  head: () => ({
    meta: [
      { title: "Preencher diagnóstico | CUPOLA" },
      {
        name: "description",
        content: "Formulário de mapeamento da operação de locação da Imersão Cupola Aluguel.",
      },
      { property: "og:title", content: "Preencher diagnóstico | CUPOLA" },
      {
        property: "og:description",
        content: "Formulário de mapeamento da operação de locação da Imersão Cupola Aluguel.",
      },
    ],
  }),
  component: Formulario,
});

function Formulario() {
  const { codigo } = Route.useParams();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-lg text-center">
        <h1 className="text-[30px] leading-[36px] font-bold text-foreground">
          Formulário em preparação
        </h1>
        <p className="mt-3 text-base text-foreground-muted">
          O questionário do código <strong className="text-foreground">{codigo}</strong> será
          liberado assim que a base de dados do diagnóstico estiver conectada.
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
