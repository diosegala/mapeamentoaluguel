import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminNav } from "@/components/cupola/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  atualizarStatusEnvios,
  lerModeloEmail,
  listarEnviosEmail,
  previaModeloEmail,
  salvarModeloEmail,
} from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/admin_/email")({
  head: () => ({
    meta: [
      { title: "E-mail do relatório | CUPOLA" },
      { name: "description", content: "Personalize o e-mail do relatório e acompanhe as entregas." },
      { property: "og:title", content: "E-mail do relatório | CUPOLA" },
      { property: "og:description", content: "Personalize o e-mail do relatório e acompanhe as entregas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaEmail,
});

type Modelo = {
  envio_automatico: boolean;
  assunto: string;
  titulo: string;
  corpo: string;
  texto_botao: string;
  rodape: string;
  emails_alerta: string;
  emails_revisao: string;
};

const ROTULO_STATUS: Record<string, string> = {
  enviando: "Enviando",
  enviado: "Enviado",
  sent: "Enviado",
  delivered: "Entregue",
  delivery_delayed: "Atrasado",
  opened: "Aberto",
  clicked: "Clicado",
  bounced: "Não entregue",
  complained: "Marcado como spam",
  erro: "Erro",
};

const VARIAVEIS = [
  ["{{nome}}", "primeiro nome de quem preencheu"],
  ["{{imobiliaria}}", "nome da imobiliária"],
  ["{{cidade}}", "cidade/UF"],
  ["{{link}}", "link do relatório"],
];

function PaginaEmail() {
  const ler = useServerFn(lerModeloEmail);
  const salvar = useServerFn(salvarModeloEmail);
  const previa = useServerFn(previaModeloEmail);
  const listar = useServerFn(listarEnviosEmail);
  const atualizar = useServerFn(atualizarStatusEnvios);

  const q = useQuery({ queryKey: ["modelo-email"], queryFn: () => ler() });
  const envios = useQuery({ queryKey: ["envios-email"], queryFn: () => listar() });
  const [m, setM] = useState<Modelo | null>(null);
  const [html, setHtml] = useState("");
  const [assuntoPrevia, setAssuntoPrevia] = useState("");

  useEffect(() => {
    if (q.data && !m) {
      const { id: _id, ...resto } = q.data as Modelo & { id: string };
      setM({
        envio_automatico: resto.envio_automatico,
        assunto: resto.assunto,
        titulo: resto.titulo,
        corpo: resto.corpo,
        texto_botao: resto.texto_botao,
        rodape: resto.rodape,
        emails_alerta: resto.emails_alerta ?? "",
        emails_revisao: resto.emails_revisao ?? "",
      });
    }
  }, [q.data, m]);

  useEffect(() => {
    if (!m) return;
    const t = setTimeout(() => {
      previa({ data: m })
        .then((r) => {
          setHtml(r.html);
          setAssuntoPrevia(r.assunto);
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [m, previa]);

  const gravar = useMutation({
    mutationFn: () => salvar({ data: { ...m!, id: q.data!.id } }),
    onSuccess: () => toast.success("Modelo de e-mail salvo"),
    onError: (e) => toast.error((e as Error).message),
  });
  const sync = useMutation({
    mutationFn: () => atualizar(),
    onSuccess: (r) => {
      toast.success(r.atualizados ? `${r.atualizados} status atualizado(s)` : "Nenhuma mudança");
      envios.refetch();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const campo = (k: keyof Modelo) => (e: { target: { value: string } }) =>
    setM((s) => (s ? { ...s, [k]: e.target.value } : s));

  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        <div>
          <h1 className="titulo-marca text-[20px]">E-mail do relatório</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Enviado ao cliente quando o relatório é publicado, usando o nome e o e-mail informados no questionário.
          </p>
        </div>

        {!m ? (
          <p className="text-sm text-foreground-muted">Carregando…</p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div>
                  <p className="font-semibold text-foreground">Envio automático (sem revisão humana)</p>
                  <p className="text-sm text-foreground-muted">
                    {m.envio_automatico
                      ? "Ligado: o relatório revisado pela IA é publicado e enviado ao cliente assim que fica pronto."
                      : "Desligado: o relatório fica aguardando revisão no painel e só chega ao cliente depois de alguém clicar em \"Aprovar e enviar\"."}
                  </p>
                </div>
                <Switch
                  checked={m.envio_automatico}
                  onCheckedChange={(v) => setM({ ...m, envio_automatico: v })}
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                <Label>E-mails que recebem aviso de revisão pendente</Label>
                <Input
                  placeholder="kariny@cupola.com.br"
                  value={m.emails_revisao}
                  onChange={campo("emails_revisao")}
                />
                <p className="text-xs text-foreground-muted">
                  Recebem um aviso quando um mapeamento fica pronto e aguarda revisão. Vazio = todos os administradores.
                </p>
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                <Label>E-mails de alerta de erro</Label>
                <Input
                  placeholder="voce@cupola.com.br, outra@cupola.com.br"
                  value={m.emails_alerta}
                  onChange={campo("emails_alerta")}
                />
                <p className="text-xs text-foreground-muted">
                  Recebem um aviso imediato quando a geração de um relatório falha. Vazio = todos os administradores.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 text-sm">
                <p className="mb-2 font-semibold text-foreground">Variáveis disponíveis</p>
                <ul className="space-y-1 text-foreground-muted">
                  {VARIAVEIS.map(([v, d]) => (
                    <li key={v}>
                      <code className="rounded bg-muted px-1 text-foreground">{v}</code> — {d}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <Label>Assunto</Label>
                <Input value={m.assunto} onChange={campo("assunto")} />
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={m.titulo} onChange={campo("titulo")} />
              </div>
              <div className="space-y-2">
                <Label>Mensagem (linha em branco separa parágrafos)</Label>
                <Textarea rows={8} value={m.corpo} onChange={campo("corpo")} />
              </div>
              <div className="space-y-2">
                <Label>Texto do botão</Label>
                <Input value={m.texto_botao} onChange={campo("texto_botao")} />
              </div>
              <div className="space-y-2">
                <Label>Rodapé</Label>
                <Textarea rows={2} value={m.rodape} onChange={campo("rodape")} />
              </div>
              <Button onClick={() => gravar.mutate()} disabled={gravar.isPending}>
                {gravar.isPending ? "Salvando…" : "Salvar modelo"}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Prévia (dados de exemplo)</p>
              <p className="text-sm text-foreground-muted">Assunto: {assuntoPrevia}</p>
              <iframe
                title="Prévia do e-mail"
                srcDoc={html}
                sandbox=""
                className="h-[640px] w-full rounded-lg border border-border bg-card"
              />
            </div>
          </div>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Acompanhamento de entregas</h2>
            <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
              {sync.isPending ? "Atualizando…" : "Atualizar status"}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-foreground-muted">
                <tr className="border-b border-border">
                  <th className="p-3">Data</th>
                  <th className="p-3">Imobiliária</th>
                  <th className="p-3">Destinatário</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(envios.data ?? []).map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="p-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                    <td className="p-3">{e.diagnosticos?.nome_imobiliaria ?? "—"}</td>
                    <td className="p-3">{e.destinatario}</td>
                    <td className="p-3">{e.automatico ? "Automático" : "Manual"}</td>
                    <td className="p-3" title={e.erro ?? ""}>
                      {ROTULO_STATUS[e.status] ?? e.status}
                      {e.erro && <span className="block text-xs text-destructive">{e.erro}</span>}
                    </td>
                  </tr>
                ))}
                {envios.data?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-foreground-muted">Nenhum envio ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
