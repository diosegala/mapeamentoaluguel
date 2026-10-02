import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Users, Workflow, MonitorCog, BarChart3 } from "lucide-react";

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
  { icon: BarChart3, titulo: "Perfil da imobiliária", texto: "Carteira, estoque, locações e receitas." },
  { icon: Users, titulo: "Gestão Estratégica", texto: "Pessoas, marketing, liderança e uso de IA." },
  { icon: Workflow, titulo: "Gestão Comercial", texto: "Captação de imóveis, leads e atendimento." },
  { icon: MonitorCog, titulo: "Gestão Administrativa e Financeira", texto: "Contratos, cobrança, sistemas e rotinas." },
];

function Home() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");

  const codigoLimpo = codigo.trim().toUpperCase();

  return (
    <main className="flex min-h-screen flex-col bg-dark-background text-foreground-on-dark">
      <header className="mx-auto w-full max-w-5xl px-6 pt-8">
        <img src="/brand/cupola-branca.png" alt="CUPOLA" className="h-8 w-auto" />
      </header>

      <section className="mx-auto w-full max-w-5xl flex-1 px-6 pt-16 pb-14">
        <span className="text-[12px] font-bold tracking-[0.16em] text-primary uppercase">Imersão Cupola Aluguel</span>
        <h1 className="titulo-marca mt-5 max-w-4xl text-[30px] sm:text-[44px]">
          Diagnóstico da sua <span className="text-primary">operação de locação</span>
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-[1.6] text-[#c9c6be]">
          Responda ao mapeamento da sua gestão estratégica, comercial, administrativa e financeira. Ao final, você recebe
          a leitura da CUPOLA sobre onde estão os gargalos e o que atacar primeiro.
        </p>

        <form
          className="mt-10 grid max-w-xl gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!codigoLimpo) return;
            navigate({ to: "/formulario/$codigo", params: { codigo: codigoLimpo } });
          }}
        >
          <label htmlFor="codigo" className="text-[14px] font-semibold">
            Código do diagnóstico
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="codigo"
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.toUpperCase())}
              placeholder="EX: K7QM2P9X"
              maxLength={8}
              className="h-12 rounded-full border-[#3a3f47] bg-[#171a1f] px-5 font-bold tracking-[0.25em] text-foreground-on-dark uppercase placeholder:text-[#6b7078] placeholder:tracking-[0.1em]"
            />
            <Button type="submit" size="lg" disabled={!codigoLimpo}>
              Começar
              <ArrowRight />
            </Button>
          </div>
          <p className="text-[13px] text-[#9ea2a8]">
            Use o código que você recebeu da CUPOLA para iniciar ou retomar o preenchimento.
          </p>
        </form>

        <div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pilares.map((pilar) => (
            <div key={pilar.titulo} className="grid content-start gap-2 rounded-2xl bg-[#171a1f] p-5">
              <pilar.icon className="size-5 text-primary" />
              <h2 className="text-[16px] font-semibold">{pilar.titulo}</h2>
              <p className="text-[14px] leading-[1.5] text-[#9ea2a8]">{pilar.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 border-t border-dark-border px-6 py-8 text-[13px] text-[#9ea2a8]">
        <span>CUPOLA · Método de gestão para imobiliárias</span>
        <Link to="/auth" className="font-semibold text-foreground-on-dark underline">
          Acesso CUPOLA
        </Link>
      </footer>
    </main>
  );
}
