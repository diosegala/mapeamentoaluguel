import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const itens = [
  { to: "/admin", label: "Diagnósticos" },
  { to: "/admin/perguntas", label: "Perguntas" },
  { to: "/admin/prompt", label: "Prompt da IA" },
  { to: "/admin/base", label: "Base de conhecimento" },
  { to: "/admin/api", label: "Chave e uso" },
  { to: "/admin/usuarios", label: "Administradores" },
] as const;

export function AdminNav() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex flex-wrap items-center gap-5">
          <Link to="/" className="text-[15px] font-bold text-foreground">
            CUPOLA · Painel
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {itens.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                activeOptions={{ exact: true }}
                activeProps={{ className: "text-foreground font-semibold" }}
                inactiveProps={{ className: "text-foreground-muted" }}
                className="transition-colors hover:text-foreground"
              >
                {i.label}
              </Link>
            ))}
          </nav>
        </div>
        <Button variant="ghost" onClick={sair} className="gap-2">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </header>
  );
}
