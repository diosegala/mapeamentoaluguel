// Relatório para a liderança: o texto da IA com os gráficos da leitura de mercado nas seções
// a que pertencem, e no fim um anexo com os mesmos painéis do dashboard.
import { useMemo, type ReactNode } from "react";

import { BarrasDistribuicao } from "@/components/cupola/graficos-mercado";
import {
  CartoesMercado,
  GradeIndicadores,
  RankingDores,
  TabelaComparativa,
  TituloPainel,
} from "@/components/cupola/paineis-mercado";
import {
  Cabecalho,
  CapaRelatorio,
  Md,
  dataPorExtenso,
  prosa,
} from "@/components/cupola/relatorio-cupola";
import { DORES, INDICADORES, ehDor, ehTecnologia, type LeituraMercado } from "@/lib/mercado";
import { dividirSecoes, extrairAchados, type Secao } from "@/lib/relatorio-secoes";

const tabelas =
  "[&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-2xl [&_table]:text-[14px] [&_table]:leading-[1.5] [&_td]:border-t [&_td]:border-border [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top [&_td:first-child]:font-semibold [&_th]:bg-background-secondary [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-bold [&_th]:tracking-[0.08em] [&_th]:text-foreground-subtle [&_th]:uppercase";
const texto = `max-w-3xl ${prosa} ${tabelas} [&_h3]:mt-6 [&_h3]:text-[17px] [&_h3]:font-bold`;

// Indicadores mostrados dentro da seção de indicadores; o anexo traz todos.
const DESTAQUE_INDICADORES = [
  "locacoesVsCenario",
  "crescimento",
  "conversaoLeads",
  "icca",
  "tdca",
  "inadimplencia",
];

type TipoMercado =
  | "resumo"
  | "dores"
  | "indicadores"
  | "tecnologia"
  | "perfis"
  | "oportunidades"
  | "atencao"
  | "limites"
  | "texto";

function tipoMercado(titulo: string): TipoMercado {
  const t = titulo.toLowerCase();
  if (t.includes("resumo")) return "resumo";
  // "indicadores" contém "dores": precisa vir antes.
  if (t.includes("indicadores")) return "indicadores";
  if (t.includes("dores")) return "dores";
  if (t.includes("tecnologia")) return "tecnologia";
  if (t.includes("perfis")) return "perfis";
  if (t.includes("oportunidades")) return "oportunidades";
  if (t.includes("atenção") || t.includes("atencao")) return "atencao";
  if (t.includes("limites")) return "limites";
  return "texto";
}

/** Grupos "**Título**" ou "### Título" seguidos de itens, como em "Oportunidades para a CUPOLA". */
function gruposComTitulo(corpo: string): {
  grupos: Array<{ titulo: string; corpo: string }>;
  resto: string;
} {
  const grupos: Array<{ titulo: string; corpo: string }> = [];
  const resto: string[] = [];
  for (const linha of corpo.split("\n")) {
    const m = linha.match(/^\s*(?:###\s+(.+?)|\*\*([^*]+?)\*\*:?)\s*$/);
    if (m) {
      grupos.push({ titulo: (m[1] ?? m[2]!).replace(/:$/, "").trim(), corpo: "" });
      continue;
    }
    const atual = grupos[grupos.length - 1];
    if (atual) atual.corpo += `${linha}\n`;
    else resto.push(linha);
  }
  return { grupos: grupos.filter((g) => g.corpo.trim()), resto: resto.join("\n").trim() };
}

/** Itens "- **Nome**: texto" (ou com travessão) viram um cartão por imobiliária. */
function itensNomeados(corpo: string): {
  itens: Array<{ nome: string; texto: string }>;
  resto: string;
} {
  const itens: Array<{ nome: string; texto: string }> = [];
  const resto: string[] = [];
  for (const linha of corpo.split("\n")) {
    const m = linha.match(/^\s*[-*]\s+\*\*(.+?)\*\*\s*(?:[:—–-]\s*)?(.*)$/);
    if (m) {
      const texto = m[2]!.trim();
      itens.push({
        nome: m[1]!.replace(/[:.]$/, "").trim(),
        texto: texto.charAt(0).toUpperCase() + texto.slice(1),
      });
    } else if (itens.length && linha.trim() && !/^\s*[-*]\s/.test(linha))
      itens[itens.length - 1]!.texto += ` ${linha.trim()}`;
    else resto.push(linha);
  }
  return { itens, resto: resto.join("\n").trim() };
}

function Cartao({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <article className="cartao-mercado grid content-start gap-2 rounded-2xl border border-border bg-card p-5">
      <h3 className="text-[17px] leading-[1.3] font-bold">{titulo}</h3>
      <div className="space-y-2 text-[15px] leading-[1.6] text-foreground-muted [&_li]:ml-5 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  );
}

function SecaoMercado({ secao, leitura }: { secao: Secao; leitura: LeituraMercado }) {
  const tipo = tipoMercado(secao.titulo);
  const corpo = <Md texto={secao.corpo} />;

  if (tipo === "limites")
    return (
      <section className="secao-relatorio caixa-limites grid gap-3 rounded-2xl bg-background-secondary p-6">
        <span className="text-[12px] font-bold tracking-[0.14em] text-foreground-subtle uppercase">
          {secao.titulo}
        </span>
        <div className="space-y-2 text-[15px] leading-[1.6] text-foreground-muted [&_li]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5">
          {corpo}
        </div>
      </section>
    );

  let conteudo: ReactNode = <div className={texto}>{corpo}</div>;

  if (tipo === "resumo")
    conteudo = <div className={`${texto} text-[19px] [&_p]:text-[19px]`}>{corpo}</div>;

  if (tipo === "dores")
    conteudo = (
      <>
        <RankingDores leitura={leitura} limite={8} />
        <div className={texto}>{corpo}</div>
      </>
    );

  if (tipo === "indicadores")
    conteudo = (
      <>
        <GradeIndicadores
          leitura={leitura}
          indicadores={INDICADORES.filter((i) => DESTAQUE_INDICADORES.includes(i.chave))}
        />
        <div className={texto}>{corpo}</div>
      </>
    );

  if (tipo === "tecnologia") {
    const graficos = ["usa_ia", "expectativa_ia"]
      .map((c) => leitura.distribuicoes.find((d) => d.chave === c))
      .filter((d) => d !== undefined);
    conteudo = (
      <>
        <div className="grade-2 grid gap-4 md:grid-cols-2">
          {graficos.map((d) => (
            <BarrasDistribuicao key={d.chave} d={d} />
          ))}
        </div>
        <div className={texto}>{corpo}</div>
      </>
    );
  }

  if (tipo === "perfis") {
    const { achados, resto } = extrairAchados(secao.corpo);
    if (achados.length)
      conteudo = (
        <>
          {resto && (
            <div className={texto}>
              <Md texto={resto} />
            </div>
          )}
          <div className="grade-2 grid gap-3 md:grid-cols-2">
            {achados.map((a) => (
              <Cartao key={a.titulo} titulo={<Md texto={a.titulo} inline />}>
                <Md texto={[a.texto, a.metodo].filter(Boolean).join(" ")} />
              </Cartao>
            ))}
          </div>
        </>
      );
  }

  if (tipo === "oportunidades") {
    const { grupos, resto } = gruposComTitulo(secao.corpo);
    if (grupos.length)
      conteudo = (
        <>
          {resto && (
            <div className={texto}>
              <Md texto={resto} />
            </div>
          )}
          <div className="grade-2 grid gap-3 md:grid-cols-2">
            {grupos.map((g) => (
              <Cartao key={g.titulo} titulo={g.titulo}>
                <Md texto={g.corpo.trim()} />
              </Cartao>
            ))}
          </div>
        </>
      );
  }

  if (tipo === "atencao") {
    const { itens, resto } = itensNomeados(secao.corpo);
    if (itens.length)
      conteudo = (
        <>
          {resto && (
            <div className={texto}>
              <Md texto={resto} />
            </div>
          )}
          <div className="grade-2 grid gap-3 md:grid-cols-2">
            {itens.map((i) => (
              <Cartao key={i.nome} titulo={i.nome}>
                <Md texto={i.texto} />
              </Cartao>
            ))}
          </div>
        </>
      );
  }

  return (
    <section className="secao-relatorio grid gap-5">
      <Cabecalho secao={secao} />
      {conteudo}
    </section>
  );
}

/** Mesmos painéis do dashboard, para consulta depois do texto. */
function Anexo({
  leitura,
  nomeSecao,
}: {
  leitura: LeituraMercado;
  nomeSecao: (n: number) => string;
}) {
  const dist = (chave: string) => leitura.distribuicoes.find((d) => d.chave === chave);
  const tecnologia = leitura.distribuicoes.filter((d) => ehTecnologia(d.chave));
  const demais = leitura.distribuicoes.filter((d) => !ehDor(d.chave) && !ehTecnologia(d.chave));
  const secoesDemais = [...new Set(demais.map((d) => d.secao))];
  // A tabela é larga demais para uma página: vai em duas partes.
  const metade = Math.ceil(INDICADORES.length / 2);

  return (
    <section className="anexo-mercado grid gap-10 border-t border-border pt-12">
      <div className="cabecalho-secao grid gap-1">
        <span className="titulo-marca text-[13px] text-foreground-subtle">Anexo</span>
        <h2 className="titulo-marca text-[20px] sm:text-[22px]">Dados da leitura</h2>
        <p className="max-w-3xl text-[15px] text-foreground-muted">
          Os painéis da página Leitura de mercado, com as imobiliárias deste relatório. Os
          indicadores usam as mesmas fórmulas do relatório individual.
        </p>
      </div>

      <div className="secao-anexo grid gap-4">
        <TituloPainel
          titulo="Principais dores"
          texto="Perguntas em que a imobiliária marca até três gargalos."
        />
        <div className="grade-2 grid gap-4 md:grid-cols-2">
          {DORES.map((dor) => {
            const d = dist(dor.chave);
            return d ? <BarrasDistribuicao key={dor.chave} d={d} titulo={dor.titulo} /> : null;
          })}
        </div>
      </div>

      <div className="secao-anexo grid gap-4">
        <TituloPainel
          titulo="Indicadores"
          texto="Um ponto por imobiliária. A faixa clara é a metade central da base; a linha escura, a mediana."
        />
        <GradeIndicadores leitura={leitura} />
      </div>

      <div className="secao-anexo grid gap-4">
        <TituloPainel
          titulo="Comparativo por imobiliária"
          texto="▲ marca o quarto mais favorável da base no indicador e ▼ o quarto que pede atenção."
        />
        <TabelaComparativa
          clientes={leitura.clientes}
          leitura={leitura}
          colunas={INDICADORES.slice(0, metade)}
        />
        <TabelaComparativa
          clientes={leitura.clientes}
          leitura={leitura}
          colunas={INDICADORES.slice(metade)}
        />
      </div>

      <div className="secao-anexo grid gap-4">
        <TituloPainel titulo="Tecnologia e IA" />
        <div className="grade-2 grid gap-4 md:grid-cols-2">
          {tecnologia.map((d) => (
            <BarrasDistribuicao key={d.chave} d={d} />
          ))}
        </div>
      </div>

      {secoesDemais.map((s) => (
        <div key={s} className="secao-anexo grid gap-4">
          <TituloPainel titulo={nomeSecao(s)} />
          <div className="grade-2 grid gap-4 md:grid-cols-2">
            {demais
              .filter((d) => d.secao === s)
              .map((d) => (
                <BarrasDistribuicao key={d.chave} d={d} />
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function RelatorioMercado({
  conteudo,
  versao,
  base,
  geradoEm,
  leitura,
  nomeSecao,
  acoes,
}: {
  conteudo: string;
  versao: number;
  base: string;
  geradoEm: string;
  leitura: LeituraMercado | null;
  nomeSecao: (n: number) => string;
  acoes?: ReactNode;
}) {
  const { introducao, secoes } = useMemo(() => dividirSecoes(conteudo), [conteudo]);

  return (
    <article className="relatorio-pdf relatorio-mercado">
      <CapaRelatorio
        rotulo={`Relatório para a liderança CUPOLA · versão ${versao}`}
        titulo="Leitura de mercado"
        detalhes={[`Base: ${base}`, `Gerado em ${dataPorExtenso(geradoEm)}`, "Uso interno"]}
        acoes={acoes}
      />
      <div className="relatorio-conteudo mx-auto grid max-w-5xl gap-12 px-5 pb-20 sm:px-8">
        <div className="destaques -mt-16">
          {leitura ? <CartoesMercado leitura={leitura} /> : <div className="h-4" />}
        </div>
        {introducao && (
          <div className={texto}>
            <Md texto={introducao} />
          </div>
        )}
        {secoes.map((s, i) =>
          leitura ? (
            <SecaoMercado key={`${s.titulo}-${i}`} secao={s} leitura={leitura} />
          ) : (
            <section key={`${s.titulo}-${i}`} className="secao-relatorio grid gap-5">
              <Cabecalho secao={s} />
              <div className={texto}>
                <Md texto={s.corpo} />
              </div>
            </section>
          ),
        )}
        {leitura && <Anexo leitura={leitura} nomeSecao={nomeSecao} />}
      </div>
    </article>
  );
}
