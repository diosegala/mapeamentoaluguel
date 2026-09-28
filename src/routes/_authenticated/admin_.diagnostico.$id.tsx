import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AdminNav } from "@/components/cupola/admin-nav";
import { AvisoIa, RelatorioMarkdown } from "@/components/cupola/relatorio-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { detalheDiagnostico, enviarRelatorioPorEmail, regenerarRelatorio } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin_/diagnostico/$id")({
  head: () => ({ meta: [{ title: "Detalhe do diagnóstico | CUPOLA" }] }),
  component: Detalhe,
});

function valor(v: unknown) {
  if (v == null || v === "") return "—";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

function Detalhe() {
  const { id } = Route.useParams();
  const buscar = useServerFn(detalheDiagnostico);
  const regenerar = useServerFn(regenerarRelatorio);
  const enviarEmail = useServerFn(enviarRelatorioPorEmail);
  const [emailDestino, setEmailDestino] = useState("");
  const [mostrarEmail, setMostrarEmail] = useState(false);
  const q = useQuery({
    queryKey: ["admin-diagnostico", id],
    queryFn: () => buscar({ data: { id } }),
    refetchInterval: (query) =>
      query.state.data?.relatorios?.[0]?.status === "gerando" ? 4000 : false,
  });
  const regen = useMutation({
    mutationFn: () => regenerar({ data: { id } }),
    onSuccess: () => toast.success("Nova versão gerada"),
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => q.refetch(),
  });
  const envio = useMutation({
    mutationFn: () => enviarEmail({ data: { id, email: emailDestino.trim() || undefined } }),
    onSuccess: () => {
      toast.success(`Relatório enviado para ${emailDestino.trim() || "o e-mail do questionário"}`);
      setMostrarEmail(false);
      setEmailDestino("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const d = q.data?.diagnostico;
  const link = d && typeof window !== "undefined" ? `${window.location.origin}/relatorio/${d.codigo}` : "";
  const linkForm = d && typeof window !== "undefined" ? `${window.location.origin}/formulario/${d.codigo}` : "";
  const ultimo = q.data?.relatorios.find((r) => r.status === "concluido");
  const respostas = (d?.respostas ?? {}) as Record<string, unknown>;

  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <Link to="/admin" className="text-sm text-foreground-muted hover:text-foreground">← Diagnósticos</Link>
        {q.isLoading && <p>Carregando...</p>}
        {q.error && <p className="text-destructive">{(q.error as Error).message}</p>}
        {d && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-bold text-foreground">{d.nome_imobiliaria}</h1>
                <p className="text-sm text-foreground-muted">
                  {d.cidade}/{d.estado} · código <strong className="tracking-[0.15em]">{d.codigo}</strong> · {d.status}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(linkForm); toast.success("Link do questionário copiado"); }}>
                  Copiar link do questionário
                </Button>
                <Button variant="outline" disabled={!ultimo} onClick={() => { navigator.clipboard.writeText(link); toast.success("Link do relatório copiado"); }}>
                  Copiar link do relatório
                </Button>
                <Button
                  variant="outline"
                  disabled={!ultimo}
                  onClick={() =>
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(`Olá! Seu diagnóstico da operação de locação feito pela CUPOLA está pronto: ${link}`)}`,
                      "_blank",
                    )
                  }
                >
                  Enviar por WhatsApp
                </Button>
                <Button variant="outline" disabled={!ultimo} onClick={() => window.open(link, "_blank")}>
                  Baixar PDF
                </Button>
                <Button variant="outline" disabled={!ultimo} onClick={() => setMostrarEmail((v) => !v)}>
                  Enviar por e-mail
                </Button>
                <Button disabled={regen.isPending || Object.keys(respostas).length === 0} onClick={() => regen.mutate()}>
                  {regen.isPending ? "Gerando..." : "Regenerar relatório"}
                </Button>
              </div>
            </header>

            {mostrarEmail && (
              <section className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-card p-4">
                <Input
                  type="email"
                  placeholder="Vazio = e-mail do questionário"
                  value={emailDestino}
                  onChange={(e) => setEmailDestino(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  disabled={envio.isPending}
                  onClick={() => envio.mutate()}
                >
                  {envio.isPending ? "Enviando..." : "Enviar relatório"}
                </Button>
                <p className="w-full text-xs text-foreground-subtle">
                  Enquanto o subdomínio da cupola.com.br não estiver verificado no Resend, os envios de teste só chegam ao e-mail do dono da conta Resend.
                </p>
              </section>
            )}

            <section className="rounded-[10px] border border-border bg-card p-6">
              <h2 className="mb-4 text-[18px] font-bold">Versões do relatório</h2>
              {q.data!.relatorios.length === 0 && <p className="text-sm text-foreground-muted">Nenhum relatório ainda.</p>}
              <ul className="space-y-2 text-sm">
                {q.data!.relatorios.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-3">
                    <strong>v{r.versao}</strong>
                    <span>{r.status}</span>
                    <span className="text-foreground-subtle">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                    <span className="text-foreground-subtle">{r.modelo ?? ""}</span>
                    {r.tokens_entrada != null && <span className="text-foreground-subtle">{r.tokens_entrada} / {r.tokens_saida} tokens</span>}
                    {r.erro && <span className="text-destructive">{r.erro}</span>}
                  </li>
                ))}
              </ul>
            </section>

            {ultimo?.conteudo && (
              <section className="rounded-[10px] border border-border bg-card p-6">
                <h2 className="mb-4 text-[18px] font-bold">Relatório (v{ultimo.versao})</h2>
                <AvisoIa />
                <div className="mt-6"><RelatorioMarkdown conteudo={ultimo.conteudo} /></div>
              </section>
            )}

            <section className="rounded-[10px] border border-border bg-card p-6">
              <h2 className="mb-4 text-[18px] font-bold">Respostas</h2>
              <dl className="space-y-3 text-sm">
                {q.data!.perguntas.filter((p) => p.chave in respostas).map((p) => (
                  <div key={p.chave}>
                    <dt className="font-semibold">{p.texto}</dt>
                    <dd className="text-foreground-muted">
                      {valor(respostas[p.chave])}
                      {respostas[`${p.chave}__outro`] ? ` (Outro: ${respostas[`${p.chave}__outro`]})` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
