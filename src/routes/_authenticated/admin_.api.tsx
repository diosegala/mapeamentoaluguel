import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listarDiagnosticos } from "@/lib/admin.functions";
import { listarUsoApi, statusChaveAnthropic } from "@/lib/uso.functions";

export const Route = createFileRoute("/_authenticated/admin_/api")({
  head: () => ({
    meta: [
      { title: "Chave da API e uso | CUPOLA" },
      {
        name: "description",
        content: "Configure a chave da Anthropic e acompanhe o consumo em tokens e em dinheiro.",
      },
      { property: "og:title", content: "Chave da API e uso | CUPOLA" },
      {
        property: "og:description",
        content: "Configure a chave da Anthropic e acompanhe o consumo em tokens e em dinheiro.",
      },
    ],
  }),
  component: ConfigApi,
});

const dolar = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const numero = (v: number) => v.toLocaleString("pt-BR");

function ConfigApi() {
  const status = useServerFn(statusChaveAnthropic);
  const uso = useServerFn(listarUsoApi);
  const clientes = useServerFn(listarDiagnosticos);

  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [cliente, setCliente] = useState("");
  const [modelo, setModelo] = useState("");

  const statusQuery = useQuery({ queryKey: ["chave-anthropic"], queryFn: () => status() });
  const clientesQuery = useQuery({ queryKey: ["admin-diagnosticos"], queryFn: () => clientes() });
  const usoQuery = useQuery({
    queryKey: ["uso-api", de, ate, cliente, modelo],
    queryFn: () =>
      uso({
        data: {
          de: de || null,
          ate: ate || null,
          diagnostico_id: cliente || null,
          modelo: modelo || null,
        },
      }),
  });

  const linhas = usoQuery.data ?? [];

  const totais = useMemo(() => {
    return linhas.reduce(
      (acc, l) => ({
        entrada: acc.entrada + l.entrada,
        saida: acc.saida + l.saida,
        custo: acc.custo + l.custo,
        chamadas: acc.chamadas + 1,
      }),
      { entrada: 0, saida: 0, custo: 0, chamadas: 0 },
    );
  }, [linhas]);

  const modelos = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.modelo).filter(Boolean))) as string[],
    [linhas],
  );

  const porCliente = useMemo(() => {
    const mapa = new Map<string, { tokens: number; custo: number; chamadas: number }>();
    for (const l of linhas) {
      const atual = mapa.get(l.cliente) ?? { tokens: 0, custo: 0, chamadas: 0 };
      atual.tokens += l.entrada + l.saida;
      atual.custo += l.custo;
      atual.chamadas += 1;
      mapa.set(l.cliente, atual);
    }
    return Array.from(mapa.entries()).sort((a, b) => b[1].custo - a[1].custo);
  }, [linhas]);

  const chaveOk = statusQuery.data?.configurada;

  return (
    <main className="min-h-screen bg-background">
      <AdminNav />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-xl font-bold text-foreground">Chave da API e uso</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          A chave da Anthropic fica guardada com segurança no servidor e nunca aparece no site.
        </p>

        <section className="mt-6 rounded-[10px] border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {chaveOk ? (
                <CheckCircle2 className="h-5 w-5 text-foreground" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {statusQuery.isLoading
                    ? "Verificando..."
                    : chaveOk
                      ? `Chave configurada (final ${statusQuery.data?.final})`
                      : "Chave da Anthropic ainda não configurada"}
                </p>
                <p className="text-[13px] text-foreground-subtle">
                  {chaveOk
                    ? "Os relatórios podem ser gerados normalmente."
                    : "Peça no chat para configurar a chave — ela é salva em um formulário seguro."}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => statusQuery.refetch()}>
              Verificar novamente
            </Button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-foreground">Uso da API</h2>

          <div className="mt-3 grid gap-3 rounded-[10px] border border-border bg-card p-4 md:grid-cols-4">
            <div>
              <label className="text-[13px] font-semibold text-foreground-muted">De</label>
              <Input type="date" className="mt-1" value={de} onChange={(e) => setDe(e.target.value)} />
            </div>
            <div>
              <label className="text-[13px] font-semibold text-foreground-muted">Até</label>
              <Input
                type="date"
                className="mt-1"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[13px] font-semibold text-foreground-muted">Cliente</label>
              <select
                className="mt-1 h-10 w-full rounded-[8px] border border-border bg-background px-3 text-sm text-foreground"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              >
                <option value="">Todos</option>
                {(clientesQuery.data ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_imobiliaria} · {c.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[13px] font-semibold text-foreground-muted">Modelo</label>
              <select
                className="mt-1 h-10 w-full rounded-[8px] border border-border bg-background px-3 text-sm text-foreground"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              >
                <option value="">Todos</option>
                {modelos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { rotulo: "Gerações", valor: numero(totais.chamadas) },
              { rotulo: "Tokens de entrada", valor: numero(totais.entrada) },
              { rotulo: "Tokens de saída", valor: numero(totais.saida) },
              { rotulo: "Custo estimado", valor: dolar(totais.custo) },
            ].map((c) => (
              <div key={c.rotulo} className="rounded-[10px] border border-border bg-card p-4">
                <p className="text-[13px] text-foreground-muted">{c.rotulo}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{c.valor}</p>
              </div>
            ))}
          </div>

          {usoQuery.isLoading ? (
            <p className="mt-6 text-sm text-foreground-muted">Carregando...</p>
          ) : usoQuery.error ? (
            <p className="mt-6 text-sm text-destructive">
              {usoQuery.error instanceof Error ? usoQuery.error.message : "Erro ao carregar."}
            </p>
          ) : linhas.length === 0 ? (
            <p className="mt-6 text-sm text-foreground-muted">
              Nenhum relatório gerado no período selecionado.
            </p>
          ) : (
            <>
              <div className="mt-8 rounded-[10px] border border-border bg-card p-4">
                <h3 className="text-[13px] font-semibold text-foreground-muted">Por cliente</h3>
                <div className="mt-3 space-y-2">
                  {porCliente.map(([nome, v]) => (
                    <div key={nome} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-foreground">{nome}</span>
                      <span className="shrink-0 text-foreground-muted">
                        {numero(v.tokens)} tokens · {dolar(v.custo)} · {v.chamadas}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-[10px] border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-[13px] text-foreground-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Data</th>
                      <th className="px-4 py-3 font-semibold">Cliente</th>
                      <th className="px-4 py-3 font-semibold">Modelo</th>
                      <th className="px-4 py-3 text-right font-semibold">Entrada</th>
                      <th className="px-4 py-3 text-right font-semibold">Saída</th>
                      <th className="px-4 py-3 text-right font-semibold">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-foreground-muted">
                          {new Date(l.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {l.cliente} · {l.codigo}
                        </td>
                        <td className="px-4 py-3 text-foreground-muted">{l.modelo ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-foreground-muted">
                          {numero(l.entrada)}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground-muted">
                          {numero(l.saida)}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground">{dolar(l.custo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
