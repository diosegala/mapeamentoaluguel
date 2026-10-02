import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

/** Troca de senha de quem está logado, pedindo a senha atual. */
export function AlterarSenha() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const trocar = useMutation({
    mutationFn: async () => {
      if (novaSenha !== confirmarSenha) throw new Error("As senhas não conferem.");
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
        current_password: senhaAtual,
      } as { password: string; current_password: string });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Senha alterada com sucesso.");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao alterar a senha."),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-bold text-foreground">Alterar minha senha</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Informe a senha atual e escolha uma nova senha com pelo menos 8 caracteres.
      </p>
      <form
        className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          trocar.mutate();
        }}
      >
        <Input
          id="senha-atual"
          type="password"
          placeholder="Senha atual"
          autoComplete="current-password"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          required
          className="h-11"
        />
        <Input
          id="senha-nova"
          type="password"
          placeholder="Nova senha"
          autoComplete="new-password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          required
          minLength={8}
          className="h-11"
        />
        <Input
          id="senha-confirmar"
          type="password"
          placeholder="Repetir nova senha"
          autoComplete="new-password"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          required
          minLength={8}
          className="h-11"
        />
        <Button type="submit" className="h-11 px-6" disabled={trocar.isPending}>
          {trocar.isPending ? "Salvando..." : "Alterar senha"}
        </Button>
      </form>
    </section>
  );
}
