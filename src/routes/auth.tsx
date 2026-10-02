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
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    setCarregando(true);
    try {
      const { data: sessao, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      const { data: linhas } = await supabase.from("user_roles").select("role").eq("user_id", sessao.user.id);
      const papeis = (linhas ?? []).map((l) => l.role as string);
      if (papeis.includes("admin")) navigate({ to: "/admin" });
      else if (papeis.includes("cs")) navigate({ to: "/clientes" });
      else {
        await supabase.auth.signOut();
        throw new Error("Seu usuário ainda não tem acesso ao painel. Fale com um administrador da CUPOLA.");
      }
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-dark-background px-6">
      <div className="w-full max-w-md rounded-2xl bg-card p-8">
        <img src="/brand/cupola.png" alt="CUPOLA" className="h-8 w-auto" />
        <h1 className="titulo-marca mt-8 text-[20px]">Painel CUPOLA</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Entre com seu e-mail corporativo para gerenciar os diagnósticos.
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
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-2 h-11"
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={carregando}>
            {carregando ? "Aguarde..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-5 text-[13px] text-foreground-subtle">
          Acessos são criados por um administrador na aba Usuários do painel.
        </p>
        <Link to="/" className="mt-4 inline-block text-[13px] font-semibold text-foreground-muted underline">
          ← Voltar ao início
        </Link>
      </div>
    </main>
  );
}
