import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { CurrencyInput } from "@/components/cupola/currency-input";
import { SelectableButton } from "@/components/cupola/selectable-button";
import { TelaTransicao } from "@/components/cupola/transicao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fraseAleatoria } from "@/lib/frases";
import { abrirDiagnostico, concluirEGerar, salvarSecao } from "@/lib/publico.functions";

export const Route = createFileRoute("/formulario/$codigo")({
  head: () => ({
    meta: [
      { title: "Preencher diagnóstico | CUPOLA" },
      { name: "description", content: "Formulário de mapeamento da operação de locação da Imersão Cupola Aluguel." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Preencher diagnóstico | CUPOLA" },
      { property: "og:description", content: "Formulário de mapeamento da operação de locação da Imersão Cupola Aluguel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: Formulario,
});

const NOMES_SECOES: Record<number, string> = {
  1: "Perfil da Imobiliária",
  2: "Gestão Estratégica",
  3: "Gestão Comercial",
  4: "Gestão Administrativa e Financeira",
};

type Valor = string | number | string[] | null;

function Formulario() {
  const { codigo } = Route.useParams();
  const navigate = useNavigate();
  const abrir = useServerFn(abrirDiagnostico);
  const salvar = useServerFn(salvarSecao);
  const concluir = useServerFn(concluirEGerar);

  const q = useQuery({
    queryKey: ["formulario", codigo],
    queryFn: async () => {
      const r = await abrir({ data: { codigo } });
      if (r.erro !== null) throw new Error(r.erro);
      return r;
    },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [respostas, setRespostas] = useState<Record<string, Valor>>({});
  const [indice, setIndice] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [transicao, setTransicao] = useState<string | null>(null);

  const secoes = useMemo(() => {
    const s = new Set((q.data?.perguntas ?? []).map((p) => p.secao));
    return [...s].sort((a, b) => a - b);
  }, [q.data]);

  useEffect(() => {
    if (!q.data) return;
    if (["concluido", "gerando_relatorio", "erro_geracao"].includes(q.data.status)) {
      navigate({ to: "/relatorio/$codigo", params: { codigo }, replace: true });
      return;
    }
    setRespostas(q.data.respostas as Record<string, Valor>);
    const i = secoes.findIndex((s) => s >= q.data!.secao_atual);
    setIndice(i < 0 ? Math.max(0, secoes.length - 1) : i);
  }, [q.data, secoes]);

  if (q.isLoading) return <Mensagem titulo="Carregando..." />;
  if (q.error)
    return (
      <Mensagem titulo="Não foi possível abrir" texto={(q.error as Error).message}>
        <Link to="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground">
          Voltar ao início
        </Link>
      </Mensagem>
    );
  if (transicao) return <TelaTransicao frase={transicao} />;
  if (!q.data || secoes.length === 0) return <Mensagem titulo="Questionário indisponível" />;

  const secao = secoes[indice]!;
  const perguntas = q.data.perguntas.filter((p) => p.secao === secao);
  const ultima = indice === secoes.length - 1;

  const set = (k: string, v: Valor) => setRespostas((r) => ({ ...r, [k]: v }));

  async function avancar() {
    setErro(null);
    for (const p of perguntas) {
      const v = respostas[p.chave];
      const vazio = v == null || v === "" || (Array.isArray(v) && v.length === 0);
      if (p.obrigatoria && vazio) return setErro(`Responda: "${p.texto}"`);
      const temOutro = v === "Outro" || (Array.isArray(v) && v.includes("Outro"));
      if (temOutro && !String(respostas[`${p.chave}__outro`] ?? "").trim())
        return setErro(`Descreva a opção "Outro" em: "${p.texto}"`);
    }
    const payload: Record<string, Valor> = {};
    for (const p of perguntas) {
      if (p.chave in respostas) payload[p.chave] = respostas[p.chave] ?? null;
      const o = `${p.chave}__outro`;
      if (o in respostas) payload[o] = respostas[o] ?? null;
    }
    setSalvando(true);
    try {
      const proxima = ultima ? secao : secoes[indice + 1]!;
      await salvar({ data: { codigo, secao, proxima, respostas: payload as any } });
      if (ultima) {
        await concluir({ data: { codigo } });
        navigate({ to: "/relatorio/$codigo", params: { codigo } });
        return;
      }
      setTransicao(fraseAleatoria());
      setTimeout(() => {
        setTransicao(null);
        setIndice(indice + 1);
        window.scrollTo(0, 0);
      }, 2200);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const nomeSecao = (n: number) => q.data!.nomesSecoes?.[n] ?? NOMES_SECOES[n] ?? `Seção ${n}`;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <img src="/brand/cupola.png" alt="CUPOLA" className="h-7 w-auto" />
          <span className="text-[13px] font-semibold text-foreground-subtle">{q.data.nome}</span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${secoes.length}, minmax(0, 1fr))` }} aria-label="Progresso">
          {secoes.map((n, i) => (
            <li key={n} className="grid gap-2" aria-current={i === indice ? "step" : undefined}>
              <span className={`h-1.5 rounded-full ${i < indice ? "bg-foreground" : i === indice ? "bg-primary" : "bg-border"}`} />
              <span className={`hidden truncate text-[12px] font-semibold sm:block ${i === indice ? "text-foreground" : "text-foreground-subtle"}`}>
                {nomeSecao(n)}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[13px] font-semibold text-foreground-subtle">
          Bloco {indice + 1} de {secoes.length}
        </p>
        <h1 className="titulo-marca mt-2 text-[22px] sm:text-[28px]">{nomeSecao(secao)}</h1>

        <div className="mt-8 space-y-6">
          {perguntas.map((p) => (
            <div key={p.chave} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <label className="block text-[16px] font-semibold text-foreground">
                {p.texto}
                {p.obrigatoria && <span className="text-destructive"> *</span>}
              </label>
              {p.descricao && <p className="mt-1 text-sm text-foreground-muted">{p.descricao}</p>}
              <div className="mt-3">
                <Campo p={p} valor={respostas[p.chave] ?? null} outro={String(respostas[`${p.chave}__outro`] ?? "")} set={set} />
              </div>
            </div>
          ))}
        </div>

        {erro && <p className="mt-6 text-sm text-destructive">{erro}</p>}
        <div className="mt-10 flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={indice === 0 || salvando} onClick={() => setIndice(indice - 1)}>
            ← Voltar
          </Button>
          <Button size="lg" disabled={salvando} onClick={avancar}>
            {salvando ? "Salvando..." : ultima ? "Gerar diagnóstico" : "Próximo bloco"}
          </Button>
        </div>
      </div>
    </main>
  );
}

function Campo({
  p,
  valor,
  outro,
  set,
}: {
  p: { chave: string; tipo: string; opcoes: string[]; permite_outro: boolean };
  valor: Valor;
  outro: string;
  set: (k: string, v: Valor) => void;
}) {
  const opcoes = [...(p.opcoes ?? []), ...(p.permite_outro ? ["Outro"] : [])];
  const campoOutro = (
    <Input className="mt-3" placeholder="Descreva" value={outro} maxLength={300} onChange={(e) => set(`${p.chave}__outro`, e.target.value)} />
  );

  if (p.tipo === "escolha_unica") {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <SelectableButton key={o} label={o} selected={valor === o} onClick={() => set(p.chave, o)} />
          ))}
        </div>
        {valor === "Outro" && campoOutro}
      </>
    );
  }
  if (p.tipo === "escolha_multipla") {
    const atual = Array.isArray(valor) ? valor : [];
    const alternar = (o: string) => {
      const nenhuma = /^nenhum/i.test(o);
      if (atual.includes(o)) return set(p.chave, atual.filter((x) => x !== o));
      if (nenhuma) return set(p.chave, [o]);
      set(p.chave, [...atual.filter((x) => !/^nenhum/i.test(x)), o]);
    };
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <SelectableButton key={o} label={o} selected={atual.includes(o)} onClick={() => alternar(o)} />
          ))}
        </div>
        {atual.includes("Outro") && campoOutro}
      </>
    );
  }
  if (p.tipo === "numero") {
    return (
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={valor == null ? "" : String(valor)}
        onChange={(e) => {
          const n = e.target.value === "" ? null : Math.max(0, Number(e.target.value));
          set(p.chave, n);
        }}
      />
    );
  }
  if (p.tipo === "moeda") {
    return <CurrencyInput value={typeof valor === "number" ? valor : null} onChange={(v) => set(p.chave, v)} />;
  }
  if (p.tipo === "texto_longo") {
    return <Textarea rows={4} maxLength={4000} value={String(valor ?? "")} onChange={(e) => set(p.chave, e.target.value)} />;
  }
  return <Input maxLength={500} value={String(valor ?? "")} onChange={(e) => set(p.chave, e.target.value)} />;
}

function Mensagem({ titulo, texto, children }: { titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-dark-background px-6 py-8 text-foreground-on-dark">
      <img src="/brand/cupola-branca.png" alt="CUPOLA" className="h-7 w-auto self-start" />
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-lg">
          <h1 className="titulo-marca text-[22px] sm:text-[26px]">{titulo}</h1>
          {texto && <p className="mt-4 text-base text-[#c9c6be]">{texto}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}
