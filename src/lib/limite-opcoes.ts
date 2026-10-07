// Limite de escolhas lido do texto da pergunta ("Marque até 3 opções", "Selecione até duas opções").
// Assim, mudar o texto no painel muda o limite junto.

const POR_EXTENSO: Record<string, number> = {
  uma: 1, um: 1, duas: 2, dois: 2, "três": 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

/** Máximo de opções que a pergunta permite marcar, ou null quando não há limite no texto. */
export function limiteDaPergunta(texto: string): number | null {
  const m = texto
    .toLowerCase()
    .match(/(?:até|no máximo|no maximo)\s+(\d+|uma|um|duas|dois|três|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(?:opç|opc|ite|alternativ|resposta|etapa)/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]!) ? Number(m[1]) : POR_EXTENSO[m[1]!];
  return n && n > 0 ? n : null;
}
