import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const itens = [
  { to: "/admin", label: "Diagnósticos", papeis: ["admin"] },
  { to: "/clientes", label: "Clientes", papeis: ["admin", "cs"] },
  { to: "/admin/perguntas", label: "Perguntas", papeis: ["admin"] },
  { to: "/admin/prompt", label: "Prompt da IA", papeis: ["admin"] },
  { to: "/admin/base", label: "Base de conhecimento", papeis: ["admin"] },
  { to: "/admin/api", label: "Chave e uso", papeis: ["admin"] },
  { to: "/admin/email", label: "E-mail", papeis: ["admin"] },
  { to: "/admin/usuarios", label: "Usuários", papeis: ["admin"] },
] as const;

export function AdminNav() {
  const navigate = useNavigate();
  const { papel } = useRouteContext({ from: "/_authenticated" });
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
          <Link to={papel === "admin" ? "/admin" : "/clientes"} className="flex items-center gap-3">
            <img src="/brand/cupola.png" alt="CUPOLA" className="h-7 w-auto" />
            <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
              {papel === "admin" ? "Painel" : "Atendimento"}
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {itens.filter((i) => (i.papeis as readonly string[]).includes(papel)).map((i) => (
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
