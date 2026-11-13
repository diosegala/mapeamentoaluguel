import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { mentorPodeAbrir, papelPrincipal } from "@/lib/papeis";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // O usuário lê os próprios papéis (RLS); o servidor confere de novo em cada função.
    const { data: linhas } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const papel = papelPrincipal((linhas ?? []).map((l) => l.role as string));
    if (!papel) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    if (papel === "cs" && location.pathname.startsWith("/admin"))
      throw redirect({ to: "/clientes" });
    if (papel === "mentor" && !mentorPodeAbrir(location.pathname)) throw redirect({ to: "/admin" });
    return { user: data.user, papel };
  },
  component: () => <Outlet />,
});
