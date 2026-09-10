export const frasesMotivacionais = [
  "Operação de locação boa não é a maior — é a mais previsível.",
  "O que não é medido vira opinião. O que é medido vira estratégia.",
  "Processo claro libera o time para vender mais.",
  "Tecnologia não resolve processo indefinido — ela amplifica o que já existe.",
  "Carteira cresce com captação constante, não com sorte.",
  "Cada resposta aqui vira um insight no seu diagnóstico.",
  "Quem controla o funil controla o resultado.",
  "IA bem aplicada devolve tempo para o que é humano: relacionamento.",
];

export function fraseAleatoria() {
  return frasesMotivacionais[Math.floor(Math.random() * frasesMotivacionais.length)]!;
}
