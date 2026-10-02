/** Rótulos dos status de diagnóstico exibidos no painel. */
export const ROTULOS_STATUS: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Preenchendo",
  gerando_relatorio: "Gerando relatório",
  em_revisao: "Aguardando revisão",
  concluido: "Enviado ao cliente",
  erro_geracao: "Erro na geração",
};

export const rotuloStatus = (s: string) => ROTULOS_STATUS[s] ?? s;
