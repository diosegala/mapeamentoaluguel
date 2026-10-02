// Papéis de acesso ao painel. Admin vê tudo; CS (Atendimento) só cadastra clientes e acompanha o preenchimento.
export type Papel = "admin" | "cs";

export const ROTULOS_PAPEL: Record<Papel, string> = {
  admin: "Administrador",
  cs: "Atendimento",
};

/** Papel do usuário (admin prevalece se houver os dois), ou null sem acesso. */
export async function papelDoUsuario(supabase: any, userId: string): Promise<Papel | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const papeis = ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
  if (papeis.includes("admin")) return "admin";
  if (papeis.includes("cs")) return "cs";
  return null;
}

/** Garante que o usuário tem um dos papéis permitidos; devolve o papel. */
export async function garantirPapel(supabase: any, userId: string, permitidos: Papel[]): Promise<Papel> {
  const papel = await papelDoUsuario(supabase, userId);
  if (!papel || !permitidos.includes(papel)) throw new Error("Acesso restrito.");
  return papel;
}
