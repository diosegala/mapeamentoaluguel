// Telefone/WhatsApp de clientes brasileiros: guardado só com dígitos e DDI 55.

/** Normaliza para "55" + DDD + número; null se não parecer um telefone válido. */
export function normalizarTelefone(entrada: string | null | undefined): string | null {
  let d = String(entrada ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

/** Exibição: (41) 99999-8888. */
export function formatarTelefone(digitos: string | null | undefined): string {
  const d = String(digitos ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Máscara enquanto digita. */
export function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Link do WhatsApp com a mensagem; sem número, abre para escolher o contato. */
export function linkWhatsApp(telefone: string | null | undefined, mensagem: string): string {
  const numero = normalizarTelefone(telefone);
  return `https://wa.me/${numero ?? ""}?text=${encodeURIComponent(mensagem)}`;
}
