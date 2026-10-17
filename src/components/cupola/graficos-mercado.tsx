// Gráficos da leitura de mercado: uma série só, em grafite, com dica ao passar o mouse.
import { useRef, useState } from "react";

import { formatar, type Distribuicao, type Estatisticas, type Indicador } from "@/lib/mercado";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Barras horizontais de uma pergunta de escolha; ao passar o mouse, mostra quais imobiliárias marcaram. */
export function BarrasDistribuicao({ d, titulo }: { d: Distribuicao; titulo?: string }) {
  const maior = Math.max(1, ...d.itens.map((i) => i.contagem));
  return (
    <figure className="grid content-start gap-3 rounded-2xl border border-border bg-card p-5">
      <figcaption className="grid gap-1">
        <span className="text-[15px] leading-[1.35] font-bold">{titulo ?? d.texto}</span>
        {titulo && (
          <span className="text-[12px] leading-[1.4] text-foreground-subtle">{d.texto}</span>
        )}
        <span className="text-[12px] text-foreground-subtle">
          {d.respondentes}{" "}
          {d.respondentes === 1 ? "imobiliária respondeu" : "imobiliárias responderam"}
          {d.tipo === "escolha_multipla" ? " · cada uma pode marcar mais de uma opção" : ""}
        </span>
      </figcaption>
      {d.itens.length === 0 ? (
        <p className="text-sm text-foreground-muted">Sem respostas neste recorte.</p>
      ) : (
        <ul className="grid gap-2.5">
          {d.itens.map((i) => (
            <li key={i.opcao} className="group relative grid gap-1 outline-none" tabIndex={0}>
              <div className="flex items-baseline justify-between gap-3 text-[13px] leading-[1.35]">
                <span className="text-foreground">{i.opcao}</span>
                <span className="shrink-0 font-semibold whitespace-nowrap text-foreground tabular-nums">
                  {i.contagem} · {pct(i.pct)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-background-secondary">
                <div
                  className="h-2 rounded-full bg-foreground-muted transition-colors group-hover:bg-foreground group-focus:bg-foreground"
                  style={{ width: `${(i.contagem / maior) * 100}%`, minWidth: i.contagem ? 8 : 0 }}
                />
              </div>
              {i.clientes.length > 0 && (
                <div className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden max-w-sm rounded-lg bg-dark-background px-3 py-2 text-[12px] leading-[1.45] text-foreground-on-dark shadow-lg group-hover:block group-focus:block">
                  {i.clientes.join(", ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {d.outros.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer text-foreground-muted">
            {d.outros.length} {d.outros.length === 1 ? "resposta escrita" : "respostas escritas"} em
            "Outro"
          </summary>
          <ul className="mt-2 grid gap-1.5">
            {d.outros.map((o, k) => (
              <li key={k} className="leading-[1.45]">
                <span className="font-semibold">{o.cliente}:</span>{" "}
                <span className="text-foreground-muted">{o.texto}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </figure>
  );
}

/** Um ponto por imobiliária na escala do indicador, com a faixa P25–P75 e a mediana. */
export function PontosIndicador({
  ind,
  est,
  pontos,
}: {
  ind: Indicador;
  est: Estatisticas | null;
  pontos: Array<{ nome: string; valor: number }>;
}) {
  const W = 520;
  const H = 96;
  const m = { l: 12, r: 12 };
  const eixoY = 66;
  const svgRef = useRef<SVGSVGElement>(null);
  const [foco, setFoco] = useState<number | null>(null);

  if (!est || !pontos.length)
    return (
      <figure className="grid content-start gap-2 rounded-2xl border border-border bg-card p-5">
        <figcaption className="text-[15px] font-bold">{ind.rotulo}</figcaption>
        <p className="text-sm text-foreground-muted">Sem dados suficientes neste recorte.</p>
      </figure>
    );

  const span = est.max - est.min || Math.abs(est.max) || 1;
  const x0 = est.min - span * 0.04;
  const x1 = est.max + span * 0.04;
  const x = (v: number) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
  // Pontos próximos sobem em camadas, para nenhum ficar escondido atrás de outro.
  const ordenados = pontos.map((p, i) => ({ ...p, i })).sort((a, b) => a.valor - b.valor);
  const camadas: number[] = [];
  const posicoes = ordenados.map((p) => {
    const px = x(p.valor);
    let nivel = 0;
    while (camadas[nivel] !== undefined && px - camadas[nivel]! < 12) nivel++;
    camadas[nivel] = px;
    return { ...p, px, py: eixoY - 12 - Math.min(nivel, 4) * 12 };
  });

  const mover = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = (clientX - r.left) * (W / r.width);
    const py = (clientY - r.top) * (H / r.height);
    let melhor: number | null = null;
    let dist = Infinity;
    posicoes.forEach((p, k) => {
      const dd = Math.hypot(p.px - px, (p.py - py) * 0.6);
      if (dd < dist) {
        dist = dd;
        melhor = k;
      }
    });
    setFoco(dist < 40 ? melhor : null);
  };
  const focado = foco !== null ? posicoes[foco] : null;
  const alinhar = (px: number) => (px < W * 0.15 ? "start" : px > W * 0.85 ? "end" : "middle");

  return (
    <figure className="grid content-start gap-2 rounded-2xl border border-border bg-card p-5">
      <figcaption className="grid gap-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[15px] font-bold">{ind.rotulo}</span>
          <span className="text-[13px] text-foreground-muted">
            mediana{" "}
            <strong className="text-foreground tabular-nums">
              {formatar(est.mediana, ind.formato)}
            </strong>
          </span>
        </div>
        <span className="text-[12px] text-foreground-subtle">
          {ind.explicacao} · {est.n} {est.n === 1 ? "imobiliária" : "imobiliárias"}
          {ind.melhor ? ` · melhor quanto ${ind.melhor}` : ""}
        </span>
      </figcaption>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full overflow-visible"
          role="img"
          aria-label={`${ind.rotulo}: de ${formatar(est.min, ind.formato)} a ${formatar(est.max, ind.formato)}, mediana ${formatar(est.mediana, ind.formato)}`}
          onPointerMove={(e) => mover(e.clientX, e.clientY)}
          onPointerLeave={() => setFoco(null)}
        >
          <rect
            x={x(est.p25)}
            y={8}
            width={Math.max(2, x(est.p75) - x(est.p25))}
            height={eixoY - 8}
            rx={4}
            fill="var(--color-accent)"
          />
          <line x1={m.l} x2={W - m.r} y1={eixoY} y2={eixoY} stroke="var(--color-border)" />
          <line
            x1={x(est.mediana)}
            x2={x(est.mediana)}
            y1={4}
            y2={eixoY}
            stroke="var(--color-foreground)"
            strokeWidth={2}
          />
          {posicoes.map((p, k) => (
            <circle
              key={p.i}
              cx={p.px}
              cy={p.py}
              r={foco === k ? 6.5 : 5}
              fill={foco === k ? "var(--color-foreground)" : "var(--color-foreground-muted)"}
              stroke="var(--color-card)"
              strokeWidth={2}
            />
          ))}
          <text
            x={x(est.min)}
            y={H - 10}
            textAnchor={alinhar(x(est.min))}
            fontSize={12}
            fill="var(--color-foreground-subtle)"
          >
            {formatar(est.min, ind.formato)}
          </text>
          <text
            x={x(est.max)}
            y={H - 10}
            textAnchor={alinhar(x(est.max))}
            fontSize={12}
            fill="var(--color-foreground-subtle)"
          >
            {formatar(est.max, ind.formato)}
          </text>
        </svg>
        {focado && (
          <div
            className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-lg bg-dark-background px-3 py-1.5 text-[12px] whitespace-nowrap text-foreground-on-dark"
            style={{ left: `${Math.min(85, Math.max(15, (focado.px / W) * 100))}%` }}
          >
            {focado.nome}: {formatar(focado.valor, ind.formato)}
          </div>
        )}
      </div>
      <span className="flex flex-wrap gap-4 text-[12px] text-foreground-subtle">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-4 rounded-sm bg-accent ring-1 ring-border" /> metade
          central (P25 a P75)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-3 w-[2px] bg-foreground" /> mediana
        </span>
      </span>
    </figure>
  );
}
