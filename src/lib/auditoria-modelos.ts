export const MODELOS_AUDITORIA = [
  { id: "claude-haiku-4-5", rotulo: "Claude Haiku 4.5 (rápido e barato)" },
  { id: "claude-sonnet-5", rotulo: "Claude Sonnet 5 (mais profundo)" },
] as const;

export type ModeloAuditoria = (typeof MODELOS_AUDITORIA)[number]["id"];

export function modeloAuditoriaValido(modelo: string | undefined): ModeloAuditoria {
  const encontrado = MODELOS_AUDITORIA.find((m) => m.id === modelo);
  return encontrado ? encontrado.id : MODELOS_AUDITORIA[0].id;
}
