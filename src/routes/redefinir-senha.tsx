import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CampoSenha } from "@/components/cupola/campo-senha";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha | CUPOLA" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RedefinirSenha,
});

type Estado = "verificando" | "pronto" | "invalido";

function RedefinirSenha() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [salvando, setSalvando] = useState(false);
  const verificado = useRef(false);

  // O link traz um token de uso único; trocá-lo por uma sessão permite definir a senha nova.
  useEffect(() => {
    if (verificado.current) return;
    verificado.current = true;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token_hash");
    (async () => {
      if (token) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: "recovery" });
        if (!error) {
          // Tira o token do endereço para não ficar no histórico do navegador.
          window.history.replaceState(null, "", "/redefinir-senha");
          return setEstado("pronto");
        }
      }
      // Recarregar a página depois de validar o link: a sessão já existe.
      const { data } = await supabase.auth.getSession();
      setEstado(data.session ? "pronto" : "invalido");
    })();
  }, []);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (senha !== confirmar) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      toast.success("Senha redefinida.");
      const { data: linhas } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const papeis = (linhas ?? []).map((l) => l.role as string);
      navigate({ to: papeis.includes("admin") ? "/admin" : "/clientes" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a senha.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-dark-background px-6">
      <div className="w-full max-w-md rounded-2xl bg-card p-8">
        <img src="/brand/cupola.png" alt="CUPOLA" className="h-8 w-auto" />
        <h1 className="titulo-marca mt-8 text-[20px]">Nova senha</h1>

        {estado === "verificando" && <p className="mt-3 text-sm text-foreground-muted">Validando o link...</p>}

        {estado === "invalido" && (
          <>
            <p className="mt-3 text-sm text-foreground-muted">
              Este link expirou ou já foi usado. Peça um novo na tela de login, em "Esqueci minha senha".
            </p>
            <Link to="/auth" className="mt-6 inline-block text-[13px] font-semibold text-foreground-muted underline">
              Ir para o login
            </Link>
          </>
        )}

        {estado === "pronto" && (
          <form className="mt-6 space-y-4" onSubmit={salvar}>
            <p className="text-sm text-foreground-muted">Escolha uma senha com pelo menos 8 caracteres.</p>
            <div>
              <label htmlFor="senha-nova-redefinir" className="text-[13px] font-semibold">
                Nova senha
              </label>
              <CampoSenha
                id="senha-nova-redefinir"
                autoComplete="new-password"
                required
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-2 h-11"
              />
            </div>
            <div>
              <label htmlFor="senha-confirmar-redefinir" className="text-[13px] font-semibold">
                Repetir nova senha
              </label>
              <CampoSenha
                id="senha-confirmar-redefinir"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="mt-2 h-11"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
