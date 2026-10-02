import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import type { Papel } from "@/lib/papeis";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // O usuário lê os próprios papéis (RLS); o servidor confere de novo em cada função.
    const { data: linhas } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const papeis = (linhas ?? []).map((l) => l.role as string);
    const papel: Papel | null = papeis.includes("admin") ? "admin" : papeis.includes("cs") ? "cs" : null;
    if (!papel) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    if (papel === "cs" && location.pathname.startsWith("/admin")) throw redirect({ to: "/clientes" });
    return { user: data.user, papel };
  },
  component: () => <Outlet />,
});
