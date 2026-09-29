import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chamarComRetry } from "@/lib/anthropic.server";
import type { Problema, Revisao } from "@/lib/auditoria-modelos";

const INSTRUCOES = `Você é o revisor de qualidade da CUPOLA. Um relatório de diagnóstico da operação de locação de uma imobiliária foi escrito por IA e será enviado ao cliente sem leitura humana. Sua revisão é a última barreira antes do envio: encontre problemas reais e corrija cada um com uma substituição pontual.

Você recebe <imobiliaria>, <respostas>, <indicadores> e <projecao_carteira> (quando houver) e o <relatorio>. Dados cadastrais e respostas são fatos. Os números de <indicadores> e <projecao_carteira> são oficiais.

# O que procurar
- fato_inventado: afirmação sobre a imobiliária que não está nas respostas. Inclui ausências não informadas ("não tem backup", "não mede", "sem segmentação") e ligações entre respostas que o questionário não faz, como dizer que o líder é o dono ou qual ferramenta é usada em qual atividade quando isso foi perguntado em perguntas separadas.
- numero_errado: número que diverge das respostas, de <indicadores> ou de <projecao_carteira>, ou conta errada.
- causa_como_fato: causa afirmada como fato ("explica", "é a causa", "é o que faz") sem que as respostas a demonstrem.
- comparacao_proibida: comparação com o mercado, com "a média", com outras imobiliárias ou com o porte ("raro", "pouco comum", "acima da média", "completo para o porte"). TRID, TCNC e parâmetros identificados como do Método CUPOLA são permitidos.
- ponto_a_validar_omitido: item de "Pontos a validar com a imobiliária" em <indicadores> que não aparece em nenhuma parte do relatório.
- estilo: travessão (—), a palavra "giro", tratamento por "você".
- estrutura: seção obrigatória ausente (Leitura geral, Os números da operação, A carteira sustenta a meta?, Gestão Estratégica, Gestão Comercial, Gestão Administrativa e Financeira, Prontidão para IA, Prioridades, Limites deste diagnóstico), texto duplicado ou cortado.

Não são problemas: recomendações, práticas e parâmetros atribuídos ao Método CUPOLA (você não tem o método para conferir); leituras e interpretações apresentadas como tal; escolhas de redação fora da lista acima. Não aponte algo só porque poderia ser dito de outro jeito.

# Como corrigir
- "trecho" é uma cópia exata, caractere por caractere, de um pedaço do relatório, inclusive asteriscos e pontuação. Deve ser curto, de preferência uma frase, e aparecer uma única vez no relatório.
- "correcao" é o texto que substitui o trecho. Mude só o necessário e mantenha o tom e o formato. Para remover uma afirmação, reescreva a frase sem ela.
- Para incluir um ponto a validar omitido, use como trecho a linha "## Limites deste diagnóstico" e como correção essa mesma linha, uma linha em branco e o novo item "- ...".
- Para problemas de estrutura, deixe trecho e correção vazios.

# Veredito
- "aprovado": nenhum problema.
- "corrigir": os problemas se resolvem com as substituições.
- "regenerar": só para problema de estrutura que substituições não resolvem, ou erros espalhados pela maior parte do texto.
"resumo": uma ou duas frases sobre a qualidade do relatório.`;

const CATEGORIAS = [
  "fato_inventado",
  "numero_errado",
  "causa_como_fato",
  "comparacao_proibida",
  "ponto_a_validar_omitido",
  "estilo",
  "estrutura",
];

const ESQUEMA = {
  type: "object",
  properties: {
    veredito: { type: "string", enum: ["aprovado", "corrigir", "regenerar"] },
    resumo: { type: "string" },
    problemas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          categoria: { type: "string", enum: CATEGORIAS },
          trecho: { type: "string" },
          correcao: { type: "string" },
          motivo: { type: "string" },
        },
        required: ["categoria", "trecho", "correcao", "motivo"],
        additionalProperties: false,
      },
    },
  },
  required: ["veredito", "resumo", "problemas"],
  additionalProperties: false,
};

/** Revisa um relatório e devolve problemas com correções pontuais. Nunca lança: falhas viram veredito "falhou". */
export async function revisarRelatorio(opcoes: {
  chave: string;
  modelo: string;
  contexto: string;
  relatorio: string;
}): Promise<Revisao> {
  const r = await chamarComRetry(opcoes.chave, {
    model: opcoes.modelo,
    max_tokens: 32_000,
    stream: true,
    system: INSTRUCOES,
    output_config: { format: { type: "json_schema", schema: ESQUEMA } },
    messages: [{ role: "user", content: `${opcoes.contexto}\n\n<relatorio>\n${opcoes.relatorio}\n</relatorio>` }],
  });
  const base = {
    modelo: opcoes.modelo,
    tokensEntrada: r.usage.input + r.usage.cacheCriacao + r.usage.cacheLeitura,
    tokensSaida: r.usage.output,
  };
  if (!r.ok) return { ...base, veredito: "falhou", resumo: `Falha na revisão (${r.status}): ${r.erro}`, problemas: [] };
  if (r.stop !== "end_turn")
    return { ...base, veredito: "falhou", resumo: `Revisão interrompida (${r.stop ?? "sem motivo"}).`, problemas: [] };
  try {
    const j = JSON.parse(r.texto) as Pick<Revisao, "veredito" | "resumo" | "problemas">;
    return { ...base, veredito: j.veredito, resumo: j.resumo, problemas: j.problemas ?? [] };
  } catch {
    return { ...base, veredito: "falhou", resumo: "A revisão retornou um formato inesperado.", problemas: [] };
  }
}

/** Aplica as substituições cujo trecho aparece exatamente uma vez no texto. */
export function aplicarCorrecoes(texto: string, problemas: Problema[]) {
  let aplicadas = 0;
  for (const p of problemas) {
    if (!p.trecho) continue;
    const i = texto.indexOf(p.trecho);
    if (i < 0 || texto.indexOf(p.trecho, i + 1) >= 0) continue;
    texto = texto.slice(0, i) + p.correcao + texto.slice(i + p.trecho.length);
    aplicadas++;
  }
  return { texto, aplicadas };
}

export async function registrarRevisao(registro: {
  diagnosticoId: string;
  relatorioId: string;
  revisao: Revisao;
  aplicadas: number;
  automatica: boolean;
}) {
  const { revisao } = registro;
  const { error } = await supabaseAdmin.from("auditorias").insert({
    diagnostico_id: registro.diagnosticoId,
    relatorio_id: registro.relatorioId,
    modelo: revisao.modelo,
    tokens_entrada: revisao.tokensEntrada,
    tokens_saida: revisao.tokensSaida,
    automatica: registro.automatica,
    veredito: revisao.veredito,
    resumo: revisao.resumo,
    problemas: revisao.problemas,
    correcoes_aplicadas: registro.aplicadas,
  } as never);
  if (error) console.error("registrar revisão", error.message);
}
