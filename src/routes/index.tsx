import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Users, Workflow, MonitorCog, Sparkles, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Diagnóstico da Operação de Locação | CUPOLA" },
      {
        name: "description",
        content:
          "Responda ao mapeamento da Imersão Cupola Aluguel e receba um diagnóstico da sua operação de locação.",
      },
      { property: "og:title", content: "Diagnóstico da Operação de Locação | CUPOLA" },
      {
        property: "og:description",
        content:
          "Responda ao mapeamento da Imersão Cupola Aluguel e receba um diagnóstico da sua operação de locação.",
      },
    ],
  }),
  component: Home,
});

const pilares = [
  { icon: Users, titulo: "Pessoas", texto: "Tamanho, papéis e liderança do time de locação." },
  { icon: Workflow, titulo: "Processos", texto: "Captação, SLA de atendimento, desocupação e funil." },
  { icon: MonitorCog, titulo: "Tecnologia", texto: "Sistema de gestão, CRM, automações e dashboards." },
  { icon: Sparkles, titulo: "Uso de IA", texto: "Ferramentas, disseminação e barreiras na operação." },
  { icon: BarChart3, titulo: "Indicadores", texto: "Estoque, locações, captações, leads e VGL." },
];

function Home() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");

  const codigoLimpo = codigo.trim().toUpperCase();

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-12">
        <span className="inline-flex items-center rounded-[40px] bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground">
          Imersão Cupola Aluguel
        </span>
        <h1 className="mt-6 text-[40px] leading-[44px] font-bold tracking-tight text-foreground md:text-[50px] md:leading-[54px]">
          Diagnóstico da sua operação de locação
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-6 text-foreground-muted">
          Um mapeamento estruturado de pessoas, processos, tecnologia, uso de inteligência
          artificial e indicadores objetivos. Ao final, você recebe um relatório com a leitura da
          CUPOLA sobre onde estão os gargalos e quais são os próximos passos.
        </p>

        <form
          className="mt-10 max-w-xl rounded-[10px] border border-border bg-card p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!codigoLimpo) return;
            navigate({ to: "/formulario/$codigo", params: { codigo: codigoLimpo } });
          }}
        >
          <label htmlFor="codigo" className="text-[13px] font-semibold text-foreground">
            Código do diagnóstico
          </label>
          <p className="mt-1 text-sm text-foreground-subtle">
            Use o código que você recebeu da CUPOLA para iniciar ou retomar o preenchimento.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              id="codigo"
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.toUpperCase())}
              placeholder="EX: K7QM2P"
              maxLength={8}
              className="h-12 tracking-[0.2em] uppercase"
            />
            <Button type="submit" size="lg" className="h-12 px-6" disabled={!codigoLimpo}>
              Começar
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </form>
      </section>

      <section className="border-t border-border bg-background-secondary">
        <div className="mx-auto grid max-w-5xl gap-4 px-6 py-14 sm:grid-cols-2 lg:grid-cols-3">
          {pilares.map((pilar) => (
            <div key={pilar.titulo} className="rounded-[10px] border border-border bg-card p-5">
              <pilar.icon className="size-5 text-foreground" />
              <h2 className="mt-3 text-lg font-semibold text-foreground">{pilar.titulo}</h2>
              <p className="mt-1 text-sm leading-5 text-foreground-muted">{pilar.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-10 text-[13px] text-foreground-subtle">
        CUPOLA — Método de gestão para imobiliárias.
      </footer>
    </main>
  );
}
