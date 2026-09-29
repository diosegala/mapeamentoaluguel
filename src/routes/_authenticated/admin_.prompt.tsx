import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MODELOS_ANTHROPIC,
  ativarVersaoPrompt,
  definirModeloAtivo,
  listarVersoesPrompt,
  salvarPrompt,
} from "@/lib/config.functions";

export const Route = createFileRoute("/_authenticated/admin_/prompt")({
  head: () => ({
    meta: [
      { title: "Prompt do consultor de IA | CUPOLA" },
      {
        name: "description",
        content: "Edite as instruções que a IA usa para escrever o relatório do diagnóstico.",
      },
      { property: "og:title", content: "Prompt do consultor de IA | CUPOLA" },
      {
        property: "og:description",
        content: "Edite as instruções que a IA usa para escrever o relatório do diagnóstico.",
      },
    ],
  }),
  component: PromptAgente,
});

type Versao = {
  id: string;
  prompt_sistema: string;
  versao: number;
  ativo: boolean;
  created_at: string;
  modelo: string | null;
};

function PromptAgente() {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarVersoesPrompt);
  const salvar = useServerFn(salvarPrompt);
  const ativar = useServerFn(ativarVersaoPrompt);
  const definirModelo = useServerFn(definirModeloAtivo);

  const [texto, setTexto] = useState("");
  const [modelo, setModelo] = useState<string>("claude-sonnet-5");
  const [carregado, setCarregado] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["prompt-versoes"],
    queryFn: () => listar(),
  });

  const versoes = (data ?? []) as Versao[];
  const ativa = versoes.find((v) => v.ativo);

  useEffect(() => {
    if (!carregado && ativa) {
      setTexto(ativa.prompt_sistema);
      setModelo(ativa.modelo ?? "claude-sonnet-5");
      setCarregado(true);
    }
  }, [ativa, carregado]);

  const modeloMut = useMutation({
    mutationFn: (novo: string) => definirModelo({ data: { modelo: novo } }),
    onSuccess: () => {
      toast.success("Modelo atualizado.");
      queryClient.invalidateQueries({ queryKey: ["prompt-versoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao trocar o modelo."),
  });

  const salvarMut = useMutation({
    mutationFn: () => salvar({ data: { prompt_sistema: texto, modelo } }),
    onSuccess: (nova) => {
      toast.success(`Versão ${nova.versao} salva e ativada.`);
      queryClient.invalidateQueries({ queryKey: ["prompt-versoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const ativarMut = useMutation({
    mutationFn: (id: string) => ativar({ data: { id } }),
    onSuccess: () => {
      toast.success("Versão ativada.");
      queryClient.invalidateQueries({ queryKey: ["prompt-versoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
  });

  return (
    <main className="min-h-screen bg-background">
      <AdminNav />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="titulo-marca text-[20px]">Prompt do consultor de IA</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Estas são as instruções usadas para escrever o relatório. Cada gravação cria uma nova
          versão e passa a valer imediatamente.
        </p>

        {isLoading ? (
          <p className="mt-6 text-sm text-foreground-muted">Carregando...</p>
        ) : error ? (
          <p className="mt-6 text-sm text-destructive">
            {error instanceof Error ? error.message : "Erro ao carregar."}
          </p>
        ) : (
          <>
            <section className="mt-6 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-[15px] font-bold text-foreground">
                Modelo usado para gerar o diagnóstico
              </h2>
              <p className="mt-1 text-[13px] text-foreground-muted">
                Escolha qual modelo da Anthropic escreverá os relatórios. A troca vale
                imediatamente para os próximos diagnósticos.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {MODELOS_ANTHROPIC.map((m) => {
                  const escolhido = modelo === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={escolhido}
                      disabled={modeloMut.isPending}
                      onClick={() => {
                        setModelo(m.id);
                        modeloMut.mutate(m.id);
                      }}
                      className={
                        escolhido
                          ? "rounded-2xl border border-primary bg-primary/10 p-4 text-left"
                          : "rounded-2xl border border-border bg-background p-4 text-left hover:bg-card-hover"
                      }
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {m.nome}
                        {escolhido ? " · em uso" : ""}
                      </p>
                      <p className="mt-1 text-[13px] text-foreground-subtle">{m.descricao}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="mt-6 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground-muted">
                  {ativa ? `Versão ativa: ${ativa.versao}` : "Nenhuma versão ativa"}
                </span>
                <span className="text-[13px] text-foreground-subtle">
                  {texto.length.toLocaleString("pt-BR")} caracteres
                </span>
              </div>
              <Textarea
                className="mt-3 min-h-[420px] font-mono text-[13px] leading-relaxed"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setTexto(ativa?.prompt_sistema ?? "")}
                  disabled={!ativa || texto === ativa.prompt_sistema}
                >
                  Descartar alterações
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => salvarMut.mutate()}
                  disabled={salvarMut.isPending || texto.trim().length < 20}
                >
                  <Save className="h-4 w-4" />
                  {salvarMut.isPending ? "Salvando..." : "Salvar nova versão"}
                </Button>
              </div>
            </div>

            <section className="mt-8">
              <h2 className="text-lg font-bold text-foreground">Histórico de versões</h2>
              <div className="mt-3 space-y-2">
                {versoes.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Versão {v.versao}
                        {v.ativo ? " · ativa" : ""}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-foreground-subtle">
                        {new Date(v.created_at).toLocaleString("pt-BR")} ·{" "}
                        {v.prompt_sistema.slice(0, 90)}...
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setTexto(v.prompt_sistema)}>
                        Ver no editor
                      </Button>
                      {!v.ativo ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => ativarMut.mutate(v.id)}
                          disabled={ativarMut.isPending}
                        >
                          Ativar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
