export const MODELOS_AUDITORIA = [
  { id: "claude-haiku-4-5", rotulo: "Claude Haiku 4.5 (rápido e barato)" },
  { id: "claude-sonnet-5", rotulo: "Claude Sonnet 5 (equilibrado)" },
  { id: "claude-opus-5", rotulo: "Claude Opus 5 (mais profundo)" },
  { id: "claude-opus-5-5", rotulo: "Claude Opus 5.5 (mais profundo, nova geração)" },
  { id: "claude-fable-5-1", rotulo: "Claude Fable 5.1" },
] as const;

export type ModeloAuditoria = (typeof MODELOS_AUDITORIA)[number]["id"];

export function modeloAuditoriaValido(modelo: string | undefined): ModeloAuditoria {
  const encontrado = MODELOS_AUDITORIA.find((m) => m.id === modelo);
  return encontrado ? encontrado.id : MODELOS_AUDITORIA[0].id;
}

export type Problema = { categoria: string; trecho: string; correcao: string; motivo: string };

export type Revisao = {
  veredito: "aprovado" | "corrigir" | "regenerar" | "falhou";
  resumo: string;
  problemas: Problema[];
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
};

export const ROTULOS_VEREDITO: Record<string, string> = {
  aprovado: "Aprovado sem correções",
  corrigir: "Corrigido automaticamente",
  regenerar: "Gerado de novo",
  falhou: "Revisão falhou",
};

const ROTULOS_CATEGORIA: Record<string, string> = {
  fato_inventado: "Fato não informado",
  numero_errado: "Número errado",
  causa_como_fato: "Causa afirmada como fato",
  comparacao_proibida: "Comparação proibida",
  ponto_a_validar_omitido: "Ponto a validar omitido",
  estilo: "Estilo",
  estrutura: "Estrutura",
};

/** Texto em Markdown de uma revisão, para exibir no painel. */
export function revisaoEmMarkdown(r: { veredito: string; resumo: string; problemas: Problema[] }, aplicadas?: number) {
  const linhas = [`**${ROTULOS_VEREDITO[r.veredito] ?? r.veredito}.** ${r.resumo}`];
  if (aplicadas != null && r.problemas.length) linhas.push(`\nCorreções aplicadas: ${aplicadas} de ${r.problemas.length}.`);
  for (const p of r.problemas) {
    linhas.push(`\n- **${ROTULOS_CATEGORIA[p.categoria] ?? p.categoria}:** ${p.motivo}`);
    if (p.trecho) linhas.push(`  - Antes: "${p.trecho}"`, `  - Depois: "${p.correcao}"`);
  }
  if (!r.problemas.length && r.veredito !== "falhou") linhas.push("\nNenhum problema encontrado.");
  return linhas.join("\n");
}
