// Papéis de acesso ao painel. Admin vê tudo; CS (Atendimento) só cadastra clientes e acompanha o preenchimento;
// Mentor só lê os diagnósticos publicados e a leitura de mercado, sem editar, gerar ou enviar nada.
export type Papel = "admin" | "cs" | "mentor";

export const ROTULOS_PAPEL: Record<Papel, string> = {
  admin: "Administrador",
  cs: "Atendimento",
  mentor: "Mentor",
};

/** O que cada papel pode fazer, na tela de usuários e no e-mail de convite. */
export const DESCRICAO_PAPEL: Record<Papel, string> = {
  admin: "Acesso completo: relatórios, revisão, prompt, configurações e usuários.",
  cs: "Cadastra clientes, envia o link do questionário e acompanha o preenchimento. Não vê relatórios nem configurações.",
  mentor: "Lê os diagnósticos publicados e a leitura de mercado. Não cadastra, edita, gera nem envia nada.",
};

/** Papel mais amplo de uma lista de papéis (admin > cs > mentor), ou null sem acesso. */
export function papelPrincipal(papeis: string[]): Papel | null {
  if (papeis.includes("admin")) return "admin";
  if (papeis.includes("cs")) return "cs";
  if (papeis.includes("mentor")) return "mentor";
  return null;
}

/** Página inicial de cada papel depois do login. */
export function inicioDoPapel(papel: Papel): "/admin" | "/clientes" {
  return papel === "cs" ? "/clientes" : "/admin";
}

/** Rotas do painel que o mentor pode abrir (só leitura). */
export function mentorPodeAbrir(caminho: string): boolean {
  const p = caminho.replace(/\/+$/, "") || "/";
  return (
    p === "/admin" ||
    /^\/admin\/diagnostico\/[^/]+$/.test(p) ||
    p === "/admin/mercado" ||
    /^\/admin\/mercado\/relatorio\/[^/]+$/.test(p)
  );
}

/** Papel do usuário (o mais amplo, se houver mais de um), ou null sem acesso. */
export async function papelDoUsuario(supabase: any, userId: string): Promise<Papel | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return papelPrincipal(((data ?? []) as Array<{ role: string }>).map((r) => r.role));
}

/** Garante que o usuário tem um dos papéis permitidos; devolve o papel. */
export async function garantirPapel(
  supabase: any,
  userId: string,
  permitidos: Papel[],
): Promise<Papel> {
  const papel = await papelDoUsuario(supabase, userId);
  if (!papel || !permitidos.includes(papel)) throw new Error("Acesso restrito.");
  return papel;
}
