import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  adicionarDocumentos,
  atualizarDocumento,
  listarDocumentos,
  removerDocumento,
  sincronizarDocumento,
  sincronizarTodos,
} from "@/lib/conhecimento.functions";


export const Route = createFileRoute("/_authenticated/admin_/base")({
  head: () => ({
    meta: [
      { title: "Base de conhecimento | CUPOLA" },
      {
        name: "description",
        content: "Cadastre os links dos diagnósticos que a IA usa como referência.",
      },
      { property: "og:title", content: "Base de conhecimento | CUPOLA" },
      {
        property: "og:description",
        content: "Cadastre os links dos diagnósticos que a IA usa como referência.",
      },
    ],
  }),
  component: BaseConhecimento,
});

type Documento = {
  id: string;
  titulo: string;
  url_google_docs: string | null;
  ativo: boolean;
  ordem: number;
  status_sincronizacao: string;
  erro_sincronizacao: string | null;
  ultima_sincronizacao: string | null;
  created_at: string;
  resumo_ia: string | null;
  insights: unknown;
  temas: unknown;
  caracteres: number | null;
  trecho: string | null;
  analisado_em: string | null;
};

function lista(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.map((v) => String(v)) : [];
}

function dataCurta(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function BaseConhecimento() {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarDocumentos);
  const adicionar = useServerFn(adicionarDocumentos);
  const atualizar = useServerFn(atualizarDocumento);
  const remover = useServerFn(removerDocumento);
  const sincronizar = useServerFn(sincronizarDocumento);
  const sincronizarTudo = useServerFn(sincronizarTodos);

  const [titulo, setTitulo] = useState("");
  const [links, setLinks] = useState("");
  const [aberto, setAberto] = useState<Record<string, boolean>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["base-conhecimento"],
    queryFn: () => listar(),
  });

  const documentos = (data ?? []) as unknown as Documento[];

  const lidos = documentos.filter((d) => d.status_sincronizacao === "ok").length;
  const comErro = documentos.filter((d) => d.status_sincronizacao === "erro").length;
  const parciais = documentos.filter((d) => d.status_sincronizacao === "lido").length;
  const nunca = documentos.length - lidos - comErro - parciais;

  function recarregar() {
    queryClient.invalidateQueries({ queryKey: ["base-conhecimento"] });
  }

  const adicionarMut = useMutation({
    mutationFn: () => adicionar({ data: { titulo: titulo.trim() || null, links } }),
    onSuccess: (r) => {
      toast.success(`${r.total} link(s) adicionado(s).`);
      setTitulo("");
      setLinks("");
      recarregar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao adicionar."),
  });

  const atualizarMut = useMutation({
    mutationFn: (v: { id: string; titulo?: string; url_google_docs?: string; ativo?: boolean }) =>
      atualizar({ data: v }),
    onSuccess: recarregar,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const removerMut = useMutation({
    mutationFn: (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      toast.success("Link removido.");
      recarregar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover."),
  });

  const lerMut = useMutation({
    mutationFn: (id: string) => sincronizar({ data: { id } }),
    onSuccess: (r) => {
      if (r.status === "erro") toast.error(r.mensagem);
      else toast.success(r.mensagem);
      recarregar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao ler o documento."),
  });

  const lerTudoMut = useMutation({
    mutationFn: () => sincronizarTudo(),
    onSuccess: (r) => {
      toast.success(`${r.ok} documento(s) lido(s), ${r.falhas} com problema.`);
      recarregar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao ler os documentos."),
  });


  return (
    <main className="min-h-screen bg-background">
      <AdminNav />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-xl font-bold text-foreground">Base de conhecimento</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Cole aqui os links dos diagnósticos de referência. Pode colar vários de uma vez, um por
          linha — não há limite de links.
        </p>

        <section className="mt-6 rounded-[10px] border border-border bg-card p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="text-[13px] font-semibold text-foreground-muted">
                Nome (opcional)
              </label>
              <Input
                className="mt-1"
                value={titulo}
                placeholder="Ex.: Diagnóstico Imobiliária X"
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
          </div>
          <label className="mt-4 block text-[13px] font-semibold text-foreground-muted">
            Links (um por linha)
          </label>
          <Textarea
            className="mt-1 min-h-[140px] font-mono text-[13px]"
            value={links}
            placeholder={"https://docs.google.com/document/d/...\nhttps://docs.google.com/document/d/..."}
            onChange={(e) => setLinks(e.target.value)}
          />
          <div className="mt-4 flex justify-end">
            <Button
              className="gap-2"
              onClick={() => adicionarMut.mutate()}
              disabled={adicionarMut.isPending || links.trim().length < 5}
            >
              <Plus className="h-4 w-4" />
              {adicionarMut.isPending ? "Adicionando..." : "Adicionar links"}
            </Button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-foreground">
            Links cadastrados{documentos.length ? ` (${documentos.length})` : ""}
          </h2>

          {isLoading ? (
            <p className="mt-3 text-sm text-foreground-muted">Carregando...</p>
          ) : error ? (
            <p className="mt-3 text-sm text-destructive">
              {error instanceof Error ? error.message : "Erro ao carregar."}
            </p>
          ) : documentos.length === 0 ? (
            <p className="mt-3 text-sm text-foreground-muted">Nenhum link cadastrado ainda.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {documentos.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <Input
                      defaultValue={d.titulo}
                      className="h-9"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== d.titulo) atualizarMut.mutate({ id: d.id, titulo: v });
                      }}
                    />
                    <Input
                      defaultValue={d.url_google_docs ?? ""}
                      className="h-9 font-mono text-[12px]"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== d.url_google_docs)
                          atualizarMut.mutate({ id: d.id, url_google_docs: v });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={d.ativo}
                        onCheckedChange={(ativo) => atualizarMut.mutate({ id: d.id, ativo })}
                      />
                      <span className="text-[13px] text-foreground-muted">
                        {d.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    {d.url_google_docs ? (
                      <a
                        href={d.url_google_docs}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground-muted transition-colors hover:text-foreground"
                        aria-label="Abrir link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remover link"
                      onClick={() => removerMut.mutate(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
