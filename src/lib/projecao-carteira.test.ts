import { describe, expect, it } from "vitest";
import { metasDoTexto, projetarCarteira } from "./projecao-carteira";

describe("projetarCarteira", () => {
  it("reproduz a planilha CUPOLA", () => {
    const p = projetarCarteira({ carteira: 500, desocupacoes: 14, captacoes: 25 }, 0.78, 0.25)!;
    expect(p.serie[1]).toBeCloseTo(503.17, 2);
    expect(p.serie[12]).toBeCloseTo(539.3948912, 5);
    expect(p.crescimento).toBeCloseTo(0.07878978, 6);
  });
  it("captações necessárias levam à meta", () => {
    const p = projetarCarteira({ carteira: 500, desocupacoes: 14, captacoes: 25, metas: [0.2] })!;
    const q = projetarCarteira({ carteira: 500, desocupacoes: 14, captacoes: p.metas[0].captacoesMes })!;
    expect(q.crescimento).toBeCloseTo(0.2, 6);
  });
  it("lê faixas da meta", () => {
    expect(metasDoTexto("Crescer a carteira de imóveis administrados entre 11% e 20%")).toEqual([0.11, 0.2]);
    expect(metasDoTexto("Vender a carteira de locação")).toEqual([]);
  });
});
