import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminNav } from "@/components/cupola/admin-nav";
import { AlterarSenha } from "@/components/cupola/alterar-senha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarDiagnostico } from "@/lib/admin.functions";
import { listarClientes } from "@/lib/clientes.functions";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes | CUPOLA" }] }),
  component: Clientes,
});

type Cliente = {
  id: string;
  codigo: string;
  nome_imobiliaria: string;
  cidade: string;
  estado: string;
  status: string;
  secao_atual: number | null;
  created_at: string;
  iniciado_em: string | null;
  concluido_em: string | null;
};

type Etapa = "nao_iniciado" | "preenchendo" | "respondido";

const ETAPAS: Array<{ id: Etapa | "todos"; rotulo: string }> = [
  { id: "todos", rotulo: "Todos" },
  { id: "nao_iniciado", rotulo: "Não iniciado" },
  { id: "preenchendo", rotulo: "Preenchendo" },
  { id: "respondido", rotulo: "Respondido" },
];

function etapaDe(status: string): Etapa {
  if (status === "nao_iniciado") return "nao_iniciado";
  if (status === "em_andamento") return "preenchendo";
  return "respondido";
}

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

function linkQuestionario(codigo: string) {
  return typeof window === "undefined" ? "" : `${window.location.origin}/formulario/${codigo}`;
}

function mensagemWhatsApp(c: { nome_imobiliaria: string; codigo: string }) {
  return (
    `Olá! Este é o link para o mapeamento da operação de locação da ${c.nome_imobiliaria}, ` +
    `parte da Imersão Cupola Aluguel: ${linkQuestionario(c.codigo)}\n\n` +
    `As respostas ficam salvas a cada bloco, então dá para pausar e continuar depois. ` +
    `Ao terminar, o diagnóstico chega por e-mail em até 1 dia útil.`
  );
}

async function copiar(texto: string, aviso: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(aviso);
  } catch {
    toast.error("Não foi possível copiar. Selecione e copie manualmente.");
  }
}

function Clientes() {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarClientes);
  const criar = useServerFn(criarDiagnostico);

  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Etapa | "todos">("todos");
  const [recemCriado, setRecemCriado] = useState<{ codigo: string; nome_imobiliaria: string } | null>(null);

  const q = useQuery({ queryKey: ["clientes"], queryFn: () => listar(), refetchInterval: 60_000 });

  const criarMut = useMutation({
    mutationFn: () => criar({ data: { nome_imobiliaria: nome, cidade, estado } }),
    onSuccess: (novo) => {
      setRecemCriado({ codigo: novo.codigo, nome_imobiliaria: nome });
      setNome("");
      setCidade("");
      setEstado("");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao cadastrar."),
  });

  const secoes = q.data?.secoes ?? [];
  const todos = (q.data?.clientes ?? []) as Cliente[];
  const contagem = (e: Etapa) => todos.filter((c) => etapaDe(c.status) === e).length;
  const lista = todos.filter((c) => {
    if (filtro !== "todos" && etapaDe(c.status) !== filtro) return false;
    const t = busca.trim().toLowerCase();
    return !t || c.codigo.toLowerCase().includes(t) || c.nome_imobiliaria.toLowerCase().includes(t);
  });

  function andamento(c: Cliente) {
    const etapa = etapaDe(c.status);
    if (etapa === "nao_iniciado") return { texto: "Não iniciado", classe: "bg-background-secondary text-foreground-muted" };
    if (etapa === "preenchendo") {
      const pos = c.secao_atual != null ? secoes.indexOf(c.secao_atual) + 1 : 0;
      return {
        texto: pos > 0 ? `Preenchendo · bloco ${pos} de ${secoes.length}` : "Preenchendo",
        classe: "bg-accent text-[#1f2a0a]",
      };
    }
    return {
      texto: c.status === "concluido" ? "Respondido · diagnóstico enviado" : "Respondido · diagnóstico em preparação",
      classe: "bg-foreground text-primary",
    };
  }

  return (
    <main className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h1 className="titulo-marca text-[20px]">Novo cliente</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Cadastre a imobiliária para gerar o código e o link do questionário.
          </p>
          <form
            className="mt-5 grid gap-3 md:grid-cols-[2fr_1.5fr_auto_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              criarMut.mutate();
            }}
          >
            <Input id="cliente-nome" placeholder="Nome da imobiliária" value={nome} onChange={(e) => setNome(e.target.value)} required className="h-11" />
            <Input id="cliente-cidade" placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} required className="h-11" />
            <Input
              id="cliente-uf"
              placeholder="UF"
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
              required
              className="h-11 w-20 uppercase"
            />
            <Button type="submit" className="h-11 px-6" disabled={criarMut.isPending}>
              {criarMut.isPending ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </form>

          {recemCriado && (
            <div className="mt-5 grid gap-3 rounded-2xl bg-dark-background p-5 text-foreground-on-dark">
              <p className="text-[15px]">
                <strong>{recemCriado.nome_imobiliaria}</strong> cadastrada. Código{" "}
                <strong className="tracking-[0.15em] text-primary">{recemCriado.codigo}</strong>
              </p>
              <code className="overflow-x-auto rounded-xl bg-[#171a1f] px-4 py-3 text-[13px] whitespace-nowrap">
                {linkQuestionario(recemCriado.codigo)}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => copiar(linkQuestionario(recemCriado.codigo), "Link copiado")}>
                  <Copy /> Copiar link
                </Button>
                <Button
                  variant="outline"
                  className="border-[#3a3f47] bg-transparent text-foreground-on-dark hover:bg-white/10 hover:text-foreground-on-dark"
                  onClick={() => copiar(mensagemWhatsApp(recemCriado), "Mensagem copiada")}
                >
                  Copiar mensagem pronta
                </Button>
                <Button
                  variant="outline"
                  className="border-[#3a3f47] bg-transparent text-foreground-on-dark hover:bg-white/10 hover:text-foreground-on-dark"
                  asChild
                >
                  <a href={`https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp(recemCriado))}`} target="_blank" rel="noreferrer">
                    <MessageCircle /> Enviar por WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por andamento">
              {ETAPAS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="tab"
                  aria-selected={filtro === e.id}
                  onClick={() => setFiltro(e.id)}
                  className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                    filtro === e.id ? "border-foreground bg-foreground text-primary" : "border-input bg-card hover:border-foreground"
                  }`}
                >
                  {e.rotulo}
                  {e.id !== "todos" && <span className="ml-1.5 opacity-70">{contagem(e.id)}</span>}
                </button>
              ))}
            </div>
            <Input
              id="cliente-busca"
              placeholder="Buscar por código ou imobiliária"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-10 max-w-xs"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            {q.isLoading ? (
              <p className="p-6 text-sm text-foreground-muted">Carregando...</p>
            ) : q.error ? (
              <p className="p-6 text-sm text-destructive">{(q.error as Error).message}</p>
            ) : lista.length === 0 ? (
              <p className="p-6 text-sm text-foreground-muted">Nenhum cliente encontrado.</p>
            ) : (
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border text-[13px] text-foreground-subtle">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Imobiliária</th>
                    <th className="px-4 py-3 font-semibold">Código</th>
                    <th className="px-4 py-3 font-semibold">Andamento</th>
                    <th className="px-4 py-3 font-semibold">Cadastro</th>
                    <th className="px-4 py-3 font-semibold">Respondido em</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => {
                    const a = andamento(c);
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <span className="font-semibold">{c.nome_imobiliaria}</span>
                          <span className="block text-[13px] text-foreground-subtle">
                            {c.cidade}/{c.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold tracking-[0.15em]">{c.codigo}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${a.classe}`}>{a.texto}</span>
                        </td>
                        <td className="px-4 py-3 text-foreground-subtle">{data(c.created_at)}</td>
                        <td className="px-4 py-3 text-foreground-subtle">{etapaDe(c.status) === "respondido" ? data(c.concluido_em) : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => copiar(linkQuestionario(c.codigo), "Link copiado")}>
                              <Copy className="h-3.5 w-3.5" /> Link
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp(c))}`} target="_blank" rel="noreferrer">
                                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                              </a>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <AlterarSenha />
      </div>
    </main>
  );
}
