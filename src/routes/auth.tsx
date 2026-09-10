import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso administrativo | CUPOLA" },
      {
        name: "description",
        content: "Área restrita da CUPOLA para gerenciar diagnósticos da Imersão Cupola Aluguel.",
      },
      { property: "og:title", content: "Acesso administrativo | CUPOLA" },
      {
        property: "og:description",
        content: "Área restrita da CUPOLA para gerenciar diagnósticos da Imersão Cupola Aluguel.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: "/admin" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/admin" });
        else toast.success("Conta criada. Confirme o e-mail para entrar.");
      }
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-[10px] border border-border bg-card p-8">
        <Link to="/" className="text-[13px] font-semibold text-foreground-subtle">
          ← Voltar ao início
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Painel CUPOLA</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          {modo === "entrar"
            ? "Entre com seu e-mail corporativo para gerenciar os diagnósticos."
            : "Crie sua senha de acesso ao painel."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={enviar}>
          <div>
            <label htmlFor="email" className="text-[13px] font-semibold text-foreground">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 h-11"
            />
          </div>
          <div>
            <label htmlFor="senha" className="text-[13px] font-semibold text-foreground">
              Senha
            </label>
            <Input
              id="senha"
              type="password"
              required
              minLength={6}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-2 h-11"
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={carregando}>
            {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar acesso"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-5 text-[13px] font-semibold text-foreground-subtle underline"
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
        >
          {modo === "entrar" ? "Primeiro acesso? Criar senha" : "Já tenho acesso. Entrar"}
        </button>
      </div>
    </main>
  );
}
