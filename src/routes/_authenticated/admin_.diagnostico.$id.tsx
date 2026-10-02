import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AdminNav } from "@/components/cupola/admin-nav";
import { RelatorioCupola } from "@/components/cupola/relatorio-cupola";
import { RelatorioMarkdown } from "@/components/cupola/relatorio-markdown";
import { RevisaoHumana } from "@/components/cupola/revisao-humana";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auditarRelatorioIa, detalheDiagnostico, enviarRelatorioPorEmail, regenerarRelatorio } from "@/lib/admin.functions";
import { MODELOS_AUDITORIA, ROTULOS_VEREDITO, revisaoEmMarkdown } from "@/lib/auditoria-modelos";
import { rotuloStatus } from "@/lib/status-diagnostico";
import { linkWhatsApp } from "@/lib/telefone";

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
    onSuccess: () => toast.success("Nova versão na fila. Fica pronta em alguns minutos."),
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
  const auditar = useServerFn(auditarRelatorioIa);
  const [modeloAuditoria, setModeloAuditoria] = useState<string>(MODELOS_AUDITORIA[0].id);
  const auditoria = useMutation({
    mutationFn: (relatorioId: string) => auditar({ data: { id, relatorioId, modelo: modeloAuditoria } }),
    onError: (e) => toast.error((e as Error).message),
  });

  const d = q.data?.diagnostico;
  const link = d && typeof window !== "undefined" ? `${window.location.origin}/relatorio/${d.codigo}` : "";
  const linkForm = d && typeof window !== "undefined" ? `${window.location.origin}/formulario/${d.codigo}` : "";
  const ultimo = q.data?.relatorios.find((r) => r.status === "concluido");
  // Versão que o cliente vê, e versão gerada aguardando revisão (a mais nova, ainda não publicada).
  const publicado = q.data?.relatorios.find((r) => r.publicado_em);
  const pendente = ultimo && !ultimo.publicado_em ? ultimo : undefined;
  const respostas = (d?.respostas ?? {}) as Record<string, unknown>;
  const local = d ? [d.cidade, d.estado].filter(Boolean).join("/") : "";

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
                <h1 className="titulo-marca text-[24px]">{d.nome_imobiliaria}</h1>
                <p className="text-sm text-foreground-muted">
                  {d.cidade}/{d.estado} · código <strong className="tracking-[0.15em]">{d.codigo}</strong> · {rotuloStatus(d.status)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(linkForm); toast.success("Link do questionário copiado"); }}>
                  Copiar link do questionário
                </Button>
                <Button variant="outline" disabled={!publicado} onClick={() => { navigator.clipboard.writeText(link); toast.success("Link do relatório copiado"); }}>
                  Copiar link do relatório
                </Button>
                <Button
                  variant="outline"
                  disabled={!publicado}
                  onClick={() =>
                    window.open(
                      linkWhatsApp(d.telefone, `Olá! Seu diagnóstico da operação de locação feito pela CUPOLA está pronto: ${link}`),
                      "_blank",
                    )
                  }
                >
                  Enviar por WhatsApp
                </Button>
                <Button variant="outline" disabled={!publicado} onClick={() => window.open(link, "_blank")}>
                  Baixar PDF
                </Button>
                <Button variant="outline" disabled={!publicado} onClick={() => setMostrarEmail((v) => !v)}>
                  Enviar por e-mail
                </Button>
                <Button disabled={regen.isPending || Object.keys(respostas).length === 0} onClick={() => regen.mutate()}>
                  {regen.isPending ? "Enviando para a fila..." : "Gerar nova versão"}
                </Button>
              </div>
            </header>

            {mostrarEmail && (
              <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
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
                  Reenvia a última versão aprovada. Enquanto o domínio da cupola.com.br não estiver verificado no Resend, os envios só chegam ao e-mail do dono da conta Resend.
                </p>
              </section>
            )}

            {pendente?.conteudo && (
              <RevisaoHumana
                diagnosticoId={id}
                versao={pendente}
                nome={d.nome_imobiliaria}
                local={local}
                numeros={q.data!.numeros}
                emailCliente={(respostas["email_responsavel"] as string | undefined) ?? null}
                aoConcluir={() => q.refetch()}
              />
            )}

            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-[18px] font-bold">Versões do relatório</h2>
              {q.data!.relatorios.length === 0 && <p className="text-sm text-foreground-muted">Nenhum relatório ainda.</p>}
              <ul className="space-y-2 text-sm">
                {q.data!.relatorios.map((r) => {
                  const revisao = q.data!.revisoes.find((a) => a.relatorio_id === r.id);
                  return (
                    <li key={r.id} className="space-y-1">
                      <div className="flex flex-wrap gap-3">
                        <strong>v{r.versao}</strong>
                        <span>
                          {r.publicado_em ? "publicada" : r.status === "concluido" ? "aguardando revisão" : r.status}
                        </span>
                        <span className="text-foreground-subtle">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                        <span className="text-foreground-subtle">{r.modelo ?? ""}</span>
                        {r.tokens_entrada != null && <span className="text-foreground-subtle">{r.tokens_entrada} / {r.tokens_saida} tokens</span>}
                        {r.erro && <span className="text-destructive">{r.erro}</span>}
                      </div>
                      {revisao && (
                        <details className="rounded-2xl bg-background-secondary px-3 py-2">
                          <summary className="cursor-pointer text-foreground-muted">
                            Revisão automática: {ROTULOS_VEREDITO[revisao.veredito] ?? revisao.veredito}
                            {revisao.correcoes_aplicadas > 0 && ` (${revisao.correcoes_aplicadas} correções)`}
                          </summary>
                          <div className="mt-2">
                            <RelatorioMarkdown conteudo={revisaoEmMarkdown(revisao, revisao.correcoes_aplicadas)} />
                          </div>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {ultimo?.conteudo && (
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[18px] font-bold">Revisão de qualidade (v{ultimo.versao})</h2>
                    <p className="text-sm text-foreground-muted">
                      Todo relatório já passa pela revisão automática antes de ser publicado. Aqui é possível rodar o mesmo revisor de novo, com outro modelo, apenas para consulta: o relatório não é alterado.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={modeloAuditoria}
                      onChange={(e) => setModeloAuditoria(e.target.value)}
                      disabled={auditoria.isPending}
                      className="h-9 rounded-2xl border border-border bg-card px-3 text-sm text-foreground"
                      aria-label="Modelo da revisão"
                    >
                      {MODELOS_AUDITORIA.map((m) => (
                        <option key={m.id} value={m.id}>{m.rotulo}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      disabled={auditoria.isPending}
                      onClick={() => auditoria.mutate(ultimo.id)}
                    >
                      {auditoria.isPending ? "Revisando..." : auditoria.data ? "Revisar novamente" : "Revisar relatório com IA"}
                    </Button>
                  </div>
                </div>
                {auditoria.isPending && <p className="text-sm text-foreground-muted">Analisando, isso pode levar até um minuto...</p>}
                {auditoria.error && <p className="text-sm text-destructive">{(auditoria.error as Error).message}</p>}
                {auditoria.data && !auditoria.isPending && (
                  <div className="mt-4"><RelatorioMarkdown conteudo={auditoria.data.conteudo} /></div>
                )}
              </section>
            )}

            {publicado?.conteudo && !pendente && (
              <section className="grid gap-3">
                <h2 className="text-[18px] font-bold">
                  Versão publicada (v{publicado.versao}), como o cliente vê
                  {publicado.revisado_em && (
                    <span className="ml-2 text-sm font-normal text-foreground-subtle">
                      revisada em {new Date(publicado.revisado_em).toLocaleString("pt-BR")}
                    </span>
                  )}
                </h2>
                <div className="overflow-hidden rounded-2xl border border-border bg-background">
                  <RelatorioCupola
                    conteudo={publicado.conteudo}
                    nome={d.nome_imobiliaria}
                    local={local}
                    geradoEm={publicado.created_at}
                    numeros={q.data!.numeros}
                  />
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-border bg-card p-6">
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
