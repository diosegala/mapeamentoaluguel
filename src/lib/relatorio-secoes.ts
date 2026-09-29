// Divide o relatório em Markdown nas seções que o prompt pede, para cada uma ganhar seu formato.
// Tudo que não se encaixa no padrão volta como texto comum: a página nunca quebra.

export type TipoSecao = "leitura" | "numeros" | "carteira" | "eixo" | "prioridades" | "limites" | "texto";

export type Secao = { numero: string | null; titulo: string; tipo: TipoSecao; corpo: string };

export type Achado = { titulo: string; texto: string; metodo: string | null };

export type Prioridade = {
  ordem: string;
  titulo: string;
  campos: Record<string, string>;
  extra: string;
};

function tipoDe(titulo: string): TipoSecao {
  const t = titulo.toLowerCase();
  if (t.includes("leitura geral")) return "leitura";
  if (t.includes("números da operação")) return "numeros";
  if (t.includes("carteira sustenta")) return "carteira";
  if (/gestão (estratégica|comercial|administrativa)/.test(t)) return "eixo";
  if (t.includes("prioridades")) return "prioridades";
  if (t.includes("limites")) return "limites";
  return "texto";
}

export function dividirSecoes(markdown: string): { introducao: string; secoes: Secao[] } {
  const linhas = markdown.split("\n");
  const secoes: Secao[] = [];
  const antes: string[] = [];
  let atual: Secao | null = null;
  const corpo: string[] = [];
  const fechar = () => {
    if (atual) secoes.push({ ...atual, corpo: corpo.join("\n").trim() });
    corpo.length = 0;
  };
  for (const linha of linhas) {
    const m = linha.match(/^##\s+(?:(\d+)\.\s*)?(.+?)\s*$/);
    if (m && !linha.startsWith("###")) {
      fechar();
      atual = { numero: m[1] ?? null, titulo: m[2]!, tipo: tipoDe(m[2]!), corpo: "" };
      continue;
    }
    if (atual) corpo.push(linha);
    else if (!/^#\s/.test(linha)) antes.push(linha);
  }
  fechar();
  return { introducao: antes.join("\n").trim(), secoes };
}

const MARCA_METODO = /(?:^|\s)((?:O|No|Pelo|Para o) Método CUPOLA\b)/;

/** Parágrafos que começam com um título em negrito viram achados; o trecho do método vai para um destaque. */
export function extrairAchados(corpo: string): { achados: Achado[]; resto: string } {
  const achados: Achado[] = [];
  const resto: string[] = [];
  for (const par of corpo.split(/\n\s*\n/)) {
    const m = par.trim().match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
    if (!m || !m[2]) {
      if (par.trim()) resto.push(par.trim());
      continue;
    }
    const titulo = m[1]!.trim().replace(/[.:]$/, "");
    let texto = m[2].trim();
    let metodo: string | null = null;
    const i = texto.search(MARCA_METODO);
    if (i > 0) {
      metodo = texto.slice(i).trim();
      texto = texto.slice(0, i).trim();
    }
    achados.push({ titulo, texto, metodo });
  }
  return { achados, resto: resto.join("\n\n") };
}

/** Blocos "**1. Título**" seguidos de itens "- **Campo:** valor". */
export function extrairPrioridades(corpo: string): { prioridades: Prioridade[]; resto: string } {
  const prioridades: Prioridade[] = [];
  const resto: string[] = [];
  let atual: Prioridade | null = null;
  for (const linha of corpo.split("\n")) {
    const cab = linha.match(/^\s*(?:\*\*|###\s*)(\d+)[.)]\s*(.+?)(?:\*\*)?\s*$/);
    if (cab) {
      if (atual) prioridades.push(atual);
      atual = { ordem: cab[1]!, titulo: cab[2]!.replace(/\*\*$/, "").trim(), campos: {}, extra: "" };
      continue;
    }
    // Aceita "- **Campo:** valor", "- **Campo**: valor" e "- Campo: valor".
    const campo = linha.match(/^\s*[-*]\s+(?:\*\*)?([A-Za-zÀ-ÿ0-9 ]{2,40}?)(?:\*\*)?:(?:\*\*)?\s*(.*)$/);
    if (atual && campo) {
      atual.campos[campo[1]!.replace(/:$/, "").trim()] = campo[2]!.trim();
      continue;
    }
    if (atual) atual.extra += (atual.extra ? "\n" : "") + linha;
    else resto.push(linha);
  }
  if (atual) prioridades.push(atual);
  return { prioridades, resto: resto.join("\n").trim() };
}
