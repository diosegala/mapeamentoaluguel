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
