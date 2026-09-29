import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarDiagnostico, excluirDiagnostico, listarDiagnosticos } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel de diagnósticos | CUPOLA" },
      {
        name: "description",
        content: "Crie códigos e acompanhe os diagnósticos da Imersão Cupola Aluguel.",
      },
      { property: "og:title", content: "Painel de diagnósticos | CUPOLA" },
      {
        property: "og:description",
        content: "Crie códigos e acompanhe os diagnósticos da Imersão Cupola Aluguel.",
      },
    ],
  }),
  component: Admin,
});

function Admin() {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarDiagnosticos);
  const criar = useServerFn(criarDiagnostico);
  const excluir = useServerFn(excluirDiagnostico);

  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [busca, setBusca] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["diagnosticos"],
    queryFn: () => listar(),
  });

  const criarMut = useMutation({
    mutationFn: (payload: { nome_imobiliaria: string; cidade: string; estado: string }) =>
      criar({ data: payload }),
    onSuccess: (novo) => {
      toast.success(`Código gerado: ${novo.codigo}`);
      setNome("");
      setCidade("");
      setEstado("");
      queryClient.invalidateQueries({ queryKey: ["diagnosticos"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar."),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Diagnóstico excluído.");
      queryClient.invalidateQueries({ queryKey: ["diagnosticos"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir."),
  });


  type Linha = {
    id: string;
    codigo: string;
    nome_imobiliaria: string;
    cidade: string;
    estado: string;
    status: string;
    created_at: string;
  };

  const lista = ((data ?? []) as Linha[]).filter((d) => {
    const t = busca.trim().toLowerCase();
    if (!t) return true;
    return d.codigo.toLowerCase().includes(t) || d.nome_imobiliaria.toLowerCase().includes(t);
  });

  return (
    <main className="min-h-screen bg-background">
      <AdminNav />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <section className="rounded-[10px] border border-border bg-card p-6">
          <h1 className="text-xl font-bold text-foreground">Novo diagnóstico</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Cadastre a imobiliária e envie o código gerado para o cliente.
          </p>
          <form
            className="mt-5 grid gap-3 md:grid-cols-[2fr_1.5fr_auto_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              criarMut.mutate({ nome_imobiliaria: nome, cidade, estado });
            }}
          >
            <Input
              placeholder="Nome da imobiliária"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="h-11"
            />
            <Input
              placeholder="Cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              required
              className="h-11"
            />
            <Input
              placeholder="UF"
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
              required
              className="h-11 w-20 uppercase"
            />
            <Button type="submit" className="h-11 px-6" disabled={criarMut.isPending}>
              {criarMut.isPending ? "Gerando..." : "Gerar código"}
            </Button>
          </form>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">Diagnósticos</h2>
            <Input
              placeholder="Buscar por código ou imobiliária"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-10 max-w-xs"
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-[10px] border border-border bg-card">
            {isLoading ? (
              <p className="p-6 text-sm text-foreground-muted">Carregando...</p>
            ) : error ? (
              <p className="p-6 text-sm text-destructive">
                {error instanceof Error ? error.message : "Erro ao carregar."}
              </p>
            ) : lista.length === 0 ? (
              <p className="p-6 text-sm text-foreground-muted">Nenhum diagnóstico ainda.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-[13px] text-foreground-subtle">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Código</th>
                    <th className="px-4 py-3 font-semibold">Imobiliária</th>
                    <th className="px-4 py-3 font-semibold">Cidade</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Criado em</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((d: Linha) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-semibold tracking-[0.15em]">{d.codigo}</td>
                      <td className="px-4 py-3">
                        <Link
                          to="/admin/diagnostico/$id"
                          params={{ id: d.id }}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {d.nome_imobiliaria}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {d.cidade}/{d.estado}
                      </td>
                      <td className="px-4 py-3">{d.status}</td>
                      <td className="px-4 py-3 text-foreground-subtle">
                        {new Date(d.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              navigator.clipboard.writeText(d.codigo);
                              toast.success("Código copiado");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" /> Copiar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive hover:text-destructive"
                            disabled={excluirMut.isPending}
                            onClick={() => {
                              const ok = window.confirm(
                                `Excluir o diagnóstico de "${d.nome_imobiliaria}" (${d.codigo})?\n\nIsso remove também relatórios, envios de e-mail e registros de uso vinculados. Essa ação não pode ser desfeita.`,
                              );
                              if (ok) excluirMut.mutate(d.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
