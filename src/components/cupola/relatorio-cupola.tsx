import { useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { NumerosDestaque } from "@/lib/indicadores-operacao";
import { dividirSecoes, extrairAchados, extrairPrioridades, type Secao } from "@/lib/relatorio-secoes";

const pct = (x: number, casas = 1) => `${(x * 100).toFixed(casas).replace(".", ",")}%`;
const inteiro = (x: number) => Math.round(x).toLocaleString("pt-BR");
/** Uma casa decimal só quando necessária, como no texto do relatório (40,3). */
const decimal = (x: number) => (Math.round(x * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Markdown do relatório; em modo inline, sem parágrafos em volta. */
function Md({ texto, inline }: { texto: string; inline?: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={inline ? { p: ({ children }) => <>{children}</> } : undefined}
    >
      {texto}
    </ReactMarkdown>
  );
}

const prosa =
  "space-y-4 text-[17px] leading-[1.65] text-foreground [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1";

export function RelatorioCupola({
  conteudo,
  nome,
  local,
  geradoEm,
  numeros,
  acoes,
}: {
  conteudo: string;
  nome: string;
  local: string;
  geradoEm: string | null;
  numeros: NumerosDestaque | null;
  acoes?: ReactNode;
}) {
  const { introducao, secoes } = useMemo(() => dividirSecoes(conteudo), [conteudo]);
  const data = new Date(geradoEm ?? Date.now()).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="relatorio-pdf">
      <header className="relatorio-capa bg-dark-background text-foreground-on-dark">
        <div className="mx-auto flex max-w-5xl flex-col gap-10 px-5 pt-7 pb-24 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <img src="/brand/cupola-consultoria-branca.png" alt="CUPOLA consultoria" className="capa-logo h-8 w-auto" />
            {acoes && <div className="print-hidden flex flex-wrap gap-2">{acoes}</div>}
          </div>
          <img src="/brand/cupola-simbolo.png" alt="" className="capa-simbolo hidden" />
          <div className="grid gap-4">
            <span className="text-[12px] font-bold tracking-[0.16em] text-primary uppercase">
              Diagnóstico da operação de locação
            </span>
            <h1 className="titulo-marca text-[30px] sm:text-[46px]">{nome}</h1>
            <p className="text-[15px] text-[#9ea2a8]">
              {[local, `Gerado em ${data}`, "Imersão Cupola Aluguel"].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </header>

      <div className="relatorio-conteudo mx-auto grid max-w-5xl gap-12 px-5 pb-20 sm:px-8">
        {numeros ? <Destaques numeros={numeros} /> : <div className="h-4" />}
        {introducao && (
          <div className={`max-w-3xl ${prosa}`}>
            <Md texto={introducao} />
          </div>
        )}
        {secoes.length === 0 && !introducao && (
          <div className={`max-w-3xl ${prosa}`}>
            <Md texto={conteudo} />
          </div>
        )}
        {secoes.map((s, i) => (
          <SecaoRelatorio key={`${s.titulo}-${i}`} secao={s} numeros={numeros} />
        ))}
      </div>
    </article>
  );
}

function Destaques({ numeros }: { numeros: NumerosDestaque }) {
  const metas = numeros.metas;
  const faixa = metas.length
    ? metas.length > 1
      ? `meta de +${Math.round(metas[0]!.meta * 100)}% a +${Math.round(metas[metas.length - 1]!.meta * 100)}%`
      : `meta de +${Math.round(metas[0]!.meta * 100)}%`
    : null;
  const cartoes = [
    { rotulo: "Carteira hoje", valor: inteiro(numeros.carteira), detalhe: "imóveis administrados", escuro: false },
    {
      rotulo: "Em 12 meses, no ritmo atual",
      valor: inteiro(numeros.final),
      detalhe: [`${numeros.crescimento >= 0 ? "+" : "−"}${pct(Math.abs(numeros.crescimento))}`, faixa].filter(Boolean).join("; "),
      escuro: true,
    },
    ...(metas.length
      ? [
          {
            rotulo: "Captações para a meta",
            valor:
              metas.length > 1
                ? `${decimal(metas[0]!.captacoesMes)} a ${decimal(metas[metas.length - 1]!.captacoesMes)}`
                : decimal(metas[0]!.captacoesMes),
            detalhe: `por mês; hoje são ${inteiro(numeros.captacoes)}`,
            escuro: false,
          },
        ]
      : []),
    ...(numeros.conversao
      ? [
          {
            rotulo: "Conversão de leads",
            valor: pct(numeros.conversao.locacoes / numeros.conversao.leads),
            detalhe: `${inteiro(numeros.conversao.locacoes)} locações em ${inteiro(numeros.conversao.leads)} leads por mês`,
            escuro: false,
          },
        ]
      : []),
  ];
  return (
    <div className="destaques -mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cartoes.map((c) => (
        <div
          key={c.rotulo}
          className={`grid content-start gap-1 rounded-2xl border p-5 ${
            c.escuro ? "border-dark-background bg-dark-background text-foreground-on-dark" : "border-border bg-card"
          }`}
        >
          <span className={`text-[13px] font-semibold ${c.escuro ? "text-primary" : "text-foreground-muted"}`}>{c.rotulo}</span>
          <span className="titulo-marca text-[26px] leading-[1.6] tabular-nums">{c.valor}</span>
          <span className={`text-[13px] ${c.escuro ? "text-[#9ea2a8]" : "text-foreground-subtle"}`}>{c.detalhe}</span>
        </div>
      ))}
    </div>
  );
}

function Cabecalho({ secao }: { secao: Secao }) {
  return (
    <div className="grid gap-1">
      {secao.numero && <span className="titulo-marca text-[13px] text-foreground-subtle">{secao.numero.padStart(2, "0")}</span>}
      <h2 className="titulo-marca text-[20px] sm:text-[22px]">{secao.titulo}</h2>
    </div>
  );
}

function SecaoRelatorio({ secao, numeros }: { secao: Secao; numeros: NumerosDestaque | null }) {
  if (secao.tipo === "eixo") {
    const { achados, resto } = extrairAchados(secao.corpo);
    if (achados.length)
      return (
        <section className="secao-relatorio grid gap-5">
          <Cabecalho secao={secao} />
          {resto && (
            <div className={`max-w-3xl ${prosa}`}>
              <Md texto={resto} />
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {achados.map((a) => (
              <article key={a.titulo} className="achado grid content-start gap-3 rounded-2xl border border-border bg-card p-5">
                <h3 className="text-[19px] leading-[1.3] font-bold">{a.titulo}</h3>
                <div className="space-y-3 text-[15px] leading-[1.6] text-foreground-muted [&_strong]:font-semibold [&_strong]:text-foreground">
                  <Md texto={a.texto} />
                </div>
                {a.metodo && (
                  <div className="grid gap-1 rounded-xl bg-accent px-4 py-3 text-[14px] leading-[1.55] text-[#1f2a0a]">
                    <span className="text-[11px] font-bold tracking-[0.14em] uppercase">Método CUPOLA</span>
                    <span>
                      <Md texto={a.metodo} inline />
                    </span>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      );
  }

  if (secao.tipo === "prioridades") {
    const { prioridades, resto } = extrairPrioridades(secao.corpo);
    if (prioridades.length)
      return (
        <section className="secao-relatorio grid gap-5">
          <Cabecalho secao={secao} />
          {resto && (
            <div className={`max-w-3xl ${prosa}`}>
              <Md texto={resto} />
            </div>
          )}
          <div className="grid gap-3">
            {prioridades.map((p) => (
              <Prioridade key={p.ordem + p.titulo} p={p} />
            ))}
          </div>
        </section>
      );
  }

  if (secao.tipo === "limites")
    return (
      <section className="secao-relatorio grid gap-3 rounded-2xl bg-background-secondary p-6">
        <span className="text-[12px] font-bold tracking-[0.14em] text-foreground-subtle uppercase">{secao.titulo}</span>
        <div className="space-y-2 text-[15px] leading-[1.6] text-foreground-muted [&_li]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5">
          <Md texto={secao.corpo} />
        </div>
      </section>
    );

  if (secao.tipo === "numeros")
    return (
      <section className="secao-relatorio grid gap-5">
        <Cabecalho secao={secao} />
        <div className="tabela-numeros overflow-x-auto rounded-2xl border border-border bg-card text-[14px] leading-[1.5] [&_table]:w-full [&_table]:min-w-[640px] [&_table]:border-collapse [&_td]:border-t [&_td]:border-border [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td:first-child]:font-semibold [&_td:nth-child(2)]:whitespace-nowrap [&_td:nth-child(2)]:tabular-nums [&_th]:bg-background-secondary [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-bold [&_th]:tracking-[0.08em] [&_th]:text-foreground-subtle [&_th]:uppercase">
          <Md texto={secao.corpo} />
        </div>
      </section>
    );

  return (
    <section className="secao-relatorio grid gap-5">
      <Cabecalho secao={secao} />
      {secao.tipo === "carteira" && numeros && <GraficoCarteira numeros={numeros} />}
      <div className={`max-w-3xl ${secao.tipo === "leitura" ? `${prosa} text-[19px] [&_p]:text-[19px]` : prosa}`}>
        <Md texto={secao.corpo} />
      </div>
    </section>
  );
}

function Prioridade({ p }: { p: ReturnType<typeof extrairPrioridades>["prioridades"][number] }) {
  const { campos } = p;
  const pegar = (prefixo: string) => Object.entries(campos).find(([k]) => k.toLowerCase().startsWith(prefixo))?.[1];
  const fazer = pegar("o que fazer");
  const porque = pegar("por que");
  const medir = pegar("como medir");
  const pilar = pegar("pilar");
  const base = pegar("com base");
  const conhecidos = new Set(["o que fazer", "por que", "como medir", "pilar", "com base"]);
  const outros = Object.entries(campos).filter(([k]) => ![...conhecidos].some((c) => k.toLowerCase().startsWith(c)));
  return (
    <article className="prioridade grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-border bg-card p-5 sm:gap-5">
      <span className="titulo-marca grid size-12 place-items-center rounded-xl bg-dark-background text-[22px] leading-none text-primary">
        {p.ordem}
      </span>
      <div className="grid min-w-0 gap-3">
        <h3 className="text-[18px] leading-[1.3] font-bold">
          <Md texto={p.titulo} inline />
        </h3>
        {fazer && (
          <div className="text-[15px] leading-[1.6]">
            <span className="font-semibold">O que fazer em 90 dias: </span>
            <Md texto={fazer} inline />
          </div>
        )}
        {porque && (
          <div className="text-[15px] leading-[1.6] text-foreground-muted">
            <span className="font-semibold text-foreground">Por que agora: </span>
            <Md texto={porque} inline />
          </div>
        )}
        {outros.map(([k, v]) => (
          <div key={k} className="text-[15px] leading-[1.6] text-foreground-muted">
            <span className="font-semibold text-foreground">{k}: </span>
            <Md texto={v} inline />
          </div>
        ))}
        {(pilar || medir) && (
          <div className="flex flex-wrap gap-2">
            {pilar && (
              <span className="rounded-full bg-background-secondary px-3 py-1 text-[12px] font-semibold text-foreground-muted">
                Pilar: <span className="text-foreground">{pilar.replace(/\.$/, "")}</span>
              </span>
            )}
            {medir && (
              <span className="rounded-full bg-background-secondary px-3 py-1 text-[12px] font-semibold text-foreground-muted">
                Como medir: <span className="text-foreground">{medir.replace(/\.$/, "")}</span>
              </span>
            )}
          </div>
        )}
        {base && <p className="text-[13px] leading-[1.5] text-foreground-subtle">Com base em: {base}</p>}
        {p.extra.trim() && (
          <div className={prosa}>
            <Md texto={p.extra} />
          </div>
        )}
      </div>
    </article>
  );
}

function GraficoCarteira({ numeros }: { numeros: NumerosDestaque }) {
  const W = 640;
  const H = 260;
  const m = { l: 48, r: 60, t: 14, b: 30 };
  const atual = numeros.serie;
  const metas = numeros.metas;
  const curva = (meta: number) => atual.map((_, i) => numeros.carteira * Math.pow(1 + meta, i / 12));
  const metaMin = metas.length ? curva(metas[0]!.meta) : null;
  const metaMax = metas.length ? curva(metas[metas.length - 1]!.meta) : null;
  const valores = [...atual, ...(metaMin ?? []), ...(metaMax ?? [])];
  const passo = Math.pow(10, Math.floor(Math.log10(Math.max(1, Math.max(...valores) - Math.min(...valores))))) ;
  const y0 = Math.floor((Math.min(...valores) - passo * 0.3) / passo) * passo;
  const y1 = Math.ceil((Math.max(...valores) + passo * 0.3) / passo) * passo;
  const x = (i: number) => m.l + (i / 12) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const marcas: number[] = [];
  for (let v = y0; v <= y1 + 1e-9; v += passo) marcas.push(v);
  const linha = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  const faixa =
    metaMin && metaMax
      ? `${linha(metaMax)} ${metaMin
          .map((v, i) => [i, v] as const)
          .reverse()
          .map(([i, v]) => `L${x(i)} ${y(v)}`)
          .join(" ")} Z`
      : null;

  const svgRef = useRef<SVGSVGElement>(null);
  const [foco, setFoco] = useState<number | null>(null);
  const mover = (clientX: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = (clientX - r.left) * (W / r.width);
    setFoco(Math.max(0, Math.min(12, Math.round(((px - m.l) / (W - m.l - m.r)) * 12))));
  };
  const rotuloFinal = (v: number) => (
    <text x={x(12) + 10} y={y(v) + 4} fontSize={12} fontWeight={700} fill="currentColor">
      {inteiro(v)}
    </text>
  );

  return (
    <figure className="grafico-carteira grid gap-3 rounded-2xl border border-border bg-card p-5">
      <figcaption className="grid gap-2">
        <span className="text-[15px] font-bold">Imóveis administrados, mês a mês</span>
        <span className="flex flex-wrap gap-4 text-[13px] text-foreground-muted">
          <span className="inline-flex items-center gap-2">
            <i className="inline-block h-[3px] w-4 rounded bg-foreground" />
            Ritmo atual
          </span>
          {faixa && (
            <span className="inline-flex items-center gap-2">
              <i className="inline-block h-2.5 w-4 rounded-sm bg-primary/60" />
              Faixa da meta
            </span>
          )}
          {!faixa && metaMin && (
            <span className="inline-flex items-center gap-2">
              <i className="inline-block h-[3px] w-4 rounded bg-primary" />
              Meta
            </span>
          )}
        </span>
      </figcaption>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full overflow-visible text-foreground"
          role="img"
          aria-label={`Projeção da carteira de ${inteiro(numeros.carteira)} para ${inteiro(numeros.final)} imóveis em 12 meses`}
          onPointerMove={(e) => mover(e.clientX)}
          onPointerLeave={() => setFoco(null)}
        >
          {marcas.map((v) => (
            <g key={v}>
              <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
              <text x={m.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--color-foreground-subtle)">
                {inteiro(v)}
              </text>
            </g>
          ))}
          {[0, 3, 6, 9, 12].map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-foreground-subtle)">
              {i === 0 ? "hoje" : `mês ${i}`}
            </text>
          ))}
          {faixa && <path d={faixa} fill="var(--color-primary)" fillOpacity={0.5} />}
          {!faixa && metaMin && <path d={linha(metaMin)} fill="none" stroke="var(--color-primary)" strokeWidth={3} />}
          <path d={linha(atual)} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={x(12)} cy={y(atual[12]!)} r={5} fill="currentColor" stroke="var(--color-card)" strokeWidth={2} />
          {rotuloFinal(atual[12]!)}
          {metaMin && rotuloFinal(metaMin[12]!)}
          {metaMax && metaMax !== metaMin && metas.length > 1 && rotuloFinal(metaMax[12]!)}
          {foco !== null && (
            <line x1={x(foco)} x2={x(foco)} y1={m.t} y2={H - m.b} stroke="var(--color-foreground-muted)" strokeDasharray="3 3" />
          )}
        </svg>
        {foco !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-dark-background px-3 py-1.5 text-[12px] whitespace-nowrap text-foreground-on-dark"
            style={{ left: `${(x(foco) / W) * 100}%` }}
          >
            {foco === 0 ? "Hoje" : `Mês ${foco}`}: ritmo atual {inteiro(atual[foco]!)}
            {metaMin && ` · meta ${inteiro(metaMin[foco]!)}${metaMax && metas.length > 1 ? ` a ${inteiro(metaMax[foco]!)}` : ""}`}
          </div>
        )}
      </div>
    </figure>
  );
}
