import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Save, X } from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  alternarPergunta,
  atualizarPergunta,
  criarPergunta,
  listarPerguntas,
  reordenarPerguntas,
} from "@/lib/config.functions";

export const Route = createFileRoute("/_authenticated/admin_/perguntas")({
  head: () => ({
    meta: [
      { title: "Perguntas do diagnóstico | CUPOLA" },
      {
        name: "description",
        content: "Edite, reordene e ative as perguntas das 6 seções do diagnóstico.",
      },
      { property: "og:title", content: "Perguntas do diagnóstico | CUPOLA" },
      {
        property: "og:description",
        content: "Edite, reordene e ative as perguntas das 6 seções do diagnóstico.",
      },
    ],
  }),
  component: Perguntas,
});

type Pergunta = {
  id: string;
  secao: number;
  chave: string;
  texto: string;
  descricao: string | null;
  tipo: string;
  opcoes: string[];
  permite_outro: boolean;
  obrigatoria: boolean;
  ordem: number;
  ativo: boolean;
};

const TIPOS = [
  { valor: "texto", rotulo: "Texto curto" },
  { valor: "texto_longo", rotulo: "Texto longo" },
  { valor: "escolha_unica", rotulo: "Escolha única" },
  { valor: "escolha_multipla", rotulo: "Escolha múltipla" },
  { valor: "numero", rotulo: "Número" },
  { valor: "moeda", rotulo: "Valor em R$" },
] as const;

const SECOES = [
  "1 · Perfil da imobiliária",
  "2 · Pessoas",
  "3 · Processos",
  "4 · Tecnologia",
  "5 · Uso de IA",
  "6 · Indicadores",
];

function ehEscolha(tipo: string) {
  return tipo === "escolha_unica" || tipo === "escolha_multipla";
}

function Perguntas() {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarPerguntas);
  const criar = useServerFn(criarPergunta);
  const atualizar = useServerFn(atualizarPergunta);
  const alternar = useServerFn(alternarPergunta);
  const reordenar = useServerFn(reordenarPerguntas);

  const [secao, setSecao] = useState(1);
  const [editando, setEditando] = useState<Pergunta | null>(null);
  const [criandoNova, setCriandoNova] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["perguntas"],
    queryFn: () => listar(),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["perguntas"] });

  const salvarMut = useMutation({
    mutationFn: async (p: Pergunta) => {
      if (criandoNova) {
        return criar({
          data: {
            secao: p.secao,
            texto: p.texto,
            descricao: p.descricao,
            tipo: p.tipo as any,
            opcoes: p.opcoes,
            permite_outro: p.permite_outro,
            obrigatoria: p.obrigatoria,
            ordem: p.ordem,
          },
        });
      }
      return atualizar({
        data: {
          id: p.id,
          secao: p.secao,
          texto: p.texto,
          descricao: p.descricao,
          tipo: p.tipo as any,
          opcoes: p.opcoes,
          permite_outro: p.permite_outro,
          obrigatoria: p.obrigatoria,
          ordem: p.ordem,
        },
      });
    },
    onSuccess: () => {
      toast.success("Pergunta salva.");
      setEditando(null);
      setCriandoNova(false);
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const alternarMut = useMutation({
    mutationFn: (v: { id: string; ativo: boolean }) => alternar({ data: v }),
    onSuccess: () => invalidar(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
  });

  const reordenarMut = useMutation({
    mutationFn: (itens: { id: string; ordem: number }[]) => reordenar({ data: { itens } }),
    onSuccess: () => invalidar(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao reordenar."),
  });

  const todas = ((data ?? []) as Pergunta[]).map((p) => ({
    ...p,
    opcoes: Array.isArray(p.opcoes) ? p.opcoes : [],
  }));
  const daSecao = todas
    .filter((p) => p.secao === secao)
    .sort((a, b) => a.ordem - b.ordem);

  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= daSecao.length) return;
    const nova = [...daSecao];
    const [item] = nova.splice(indice, 1);
    nova.splice(alvo, 0, item);
    reordenarMut.mutate(nova.map((p, i) => ({ id: p.id, ordem: i + 1 })));
  }

  function novaPergunta() {
    setCriandoNova(true);
    setEditando({
      id: "",
      secao,
      chave: "",
      texto: "",
      descricao: "",
      tipo: "texto",
      opcoes: [],
      permite_outro: false,
      obrigatoria: true,
      ordem: daSecao.length + 1,
      ativo: true,
    });
  }

  return (
    <main className="min-h-screen bg-background">
      <AdminNav />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Perguntas do diagnóstico</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Edite o texto, o tipo, a ordem e quais perguntas aparecem no formulário.
            </p>
          </div>
          <Button className="gap-2" onClick={novaPergunta}>
            <Plus className="h-4 w-4" /> Nova pergunta
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {SECOES.map((rotulo, i) => (
            <button
              key={rotulo}
              type="button"
              onClick={() => setSecao(i + 1)}
              className={`rounded-[8px] border px-3 py-2 text-sm transition-colors ${
                secao === i + 1
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground-muted hover:text-foreground"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {editando ? (
          <EditorPergunta
            valor={editando}
            nova={criandoNova}
            salvando={salvarMut.isPending}
            onCancelar={() => {
              setEditando(null);
              setCriandoNova(false);
            }}
            onMudar={setEditando}
            onSalvar={() => salvarMut.mutate(editando)}
          />
        ) : null}

        <div className="mt-6 space-y-3">
          {isLoading ? (
            <p className="text-sm text-foreground-muted">Carregando...</p>
          ) : error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Erro ao carregar."}
            </p>
          ) : daSecao.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nenhuma pergunta nesta seção.</p>
          ) : (
            daSecao.map((p, i) => (
              <div
                key={p.id}
                className={`flex flex-wrap items-start gap-3 rounded-[10px] border border-border bg-card p-4 ${
                  p.ativo ? "" : "opacity-60"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0 || reordenarMut.isPending}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => mover(i, 1)}
                    disabled={i === daSecao.length - 1 || reordenarMut.isPending}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-foreground">{p.texto}</p>
                  <p className="mt-1 text-[13px] text-foreground-subtle">
                    {TIPOS.find((t) => t.valor === p.tipo)?.rotulo ?? p.tipo}
                    {p.obrigatoria ? " · obrigatória" : " · opcional"}
                    {ehEscolha(p.tipo) ? ` · ${p.opcoes.length} opções` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={p.ativo}
                    onCheckedChange={(v) => alternarMut.mutate({ id: p.id, ativo: v })}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCriandoNova(false);
                      setEditando(p);
                    }}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function EditorPergunta({
  valor,
  nova,
  salvando,
  onMudar,
  onSalvar,
  onCancelar,
}: {
  valor: Pergunta;
  nova: boolean;
  salvando: boolean;
  onMudar: (p: Pergunta) => void;
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const [novaOpcao, setNovaOpcao] = useState("");

  return (
    <section className="mt-6 rounded-[10px] border border-primary/40 bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">
          {nova ? "Nova pergunta" : "Editar pergunta"}
        </h2>
        <Button variant="ghost" size="icon" onClick={onCancelar}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-[13px] font-semibold text-foreground-muted">Pergunta</label>
          <Input
            className="mt-1 h-11"
            value={valor.texto}
            onChange={(e) => onMudar({ ...valor, texto: e.target.value })}
          />
        </div>

        <div>
          <label className="text-[13px] font-semibold text-foreground-muted">
            Texto de apoio (opcional)
          </label>
          <Textarea
            className="mt-1"
            rows={2}
            value={valor.descricao ?? ""}
            onChange={(e) => onMudar({ ...valor, descricao: e.target.value })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-[13px] font-semibold text-foreground-muted">Tipo</label>
            <select
              className="mt-1 h-11 w-full rounded-[8px] border border-border bg-background px-3 text-sm"
              value={valor.tipo}
              onChange={(e) => onMudar({ ...valor, tipo: e.target.value })}
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-semibold text-foreground-muted">Seção</label>
            <select
              className="mt-1 h-11 w-full rounded-[8px] border border-border bg-background px-3 text-sm"
              value={valor.secao}
              onChange={(e) => onMudar({ ...valor, secao: Number(e.target.value) })}
            >
              {SECOES.map((s, i) => (
                <option key={s} value={i + 1}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {ehEscolha(valor.tipo) ? (
          <div>
            <label className="text-[13px] font-semibold text-foreground-muted">Opções</label>
            <div className="mt-2 space-y-2">
              {valor.opcoes.map((op, i) => (
                <div key={`${op}-${i}`} className="flex items-center gap-2">
                  <Input
                    className="h-10"
                    value={op}
                    onChange={(e) => {
                      const opcoes = [...valor.opcoes];
                      opcoes[i] = e.target.value;
                      onMudar({ ...valor, opcoes });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onMudar({ ...valor, opcoes: valor.opcoes.filter((_, j) => j !== i) })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  className="h-10"
                  placeholder="Adicionar opção"
                  value={novaOpcao}
                  onChange={(e) => setNovaOpcao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novaOpcao.trim()) {
                      e.preventDefault();
                      onMudar({ ...valor, opcoes: [...valor.opcoes, novaOpcao.trim()] });
                      setNovaOpcao("");
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!novaOpcao.trim()) return;
                    onMudar({ ...valor, opcoes: [...valor.opcoes, novaOpcao.trim()] });
                    setNovaOpcao("");
                  }}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch
              checked={valor.obrigatoria}
              onCheckedChange={(v) => onMudar({ ...valor, obrigatoria: v })}
            />
            Obrigatória
          </label>
          {ehEscolha(valor.tipo) ? (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Switch
                checked={valor.permite_outro}
                onCheckedChange={(v) => onMudar({ ...valor, permite_outro: v })}
              />
              Permitir "Outro"
            </label>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button className="gap-2" onClick={onSalvar} disabled={salvando}>
            <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </section>
  );
}
