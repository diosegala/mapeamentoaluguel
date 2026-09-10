import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { criarAdmin, listarAdmins, removerAdmin } from "@/lib/usuarios.functions";

export const Route = createFileRoute("/_authenticated/admin_/usuarios")({
  head: () => ({
    meta: [
      { title: "Administradores | CUPOLA" },
      {
        name: "description",
        content: "Crie e gerencie os administradores do painel da Imersão Cupola Aluguel.",
      },
      { property: "og:title", content: "Administradores | CUPOLA" },
      {
        property: "og:description",
        content: "Crie e gerencie os administradores do painel da Imersão Cupola Aluguel.",
      },
    ],
  }),
  component: Usuarios,
});

type Admin = {
  user_id: string;
  email: string;
  criado_em: string;
  ultimo_acesso: string | null;
  eu: boolean;
};

function Usuarios() {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarAdmins);
  const criar = useServerFn(criarAdmin);
  const remover = useServerFn(removerAdmin);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admins"],
    queryFn: () => listar(),
  });

  const criarMut = useMutation({
    mutationFn: (payload: { email: string; senha: string }) => criar({ data: payload }),
    onSuccess: (novo) => {
      toast.success(`Acesso liberado para ${novo.email}`);
      setEmail("");
      setSenha("");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar usuário."),
  });

  const removerMut = useMutation({
    mutationFn: (user_id: string) => remover({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Acesso removido.");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover."),
  });

  const lista = (data ?? []) as Admin[];

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const trocarSenhaMut = useMutation({
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
    <main className="min-h-screen bg-background">
      <AdminNav />

      <div className="mx-auto max-w-4xl px-6 py-10">
        <section className="rounded-[10px] border border-border bg-card p-6">
          <h1 className="text-xl font-bold text-foreground">Novo administrador</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Informe o e-mail e uma senha inicial. Se a pessoa já tiver conta, a senha é atualizada e
            o acesso ao painel é liberado.
          </p>
          <form
            className="mt-5 grid gap-3 md:grid-cols-[2fr_1.5fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              criarMut.mutate({ email, senha });
            }}
          >
            <Input
              type="email"
              placeholder="email@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
            <Input
              type="password"
              placeholder="Senha inicial (mín. 8)"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={8}
              className="h-11"
            />
            <Button type="submit" className="h-11 px-6" disabled={criarMut.isPending}>
              {criarMut.isPending ? "Salvando..." : "Criar acesso"}
            </Button>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-foreground">Administradores</h2>
          <div className="mt-4 overflow-hidden rounded-[10px] border border-border bg-card">
            {isLoading ? (
              <p className="p-6 text-sm text-foreground-muted">Carregando...</p>
            ) : error ? (
              <p className="p-6 text-sm text-destructive">
                {error instanceof Error ? error.message : "Erro ao carregar."}
              </p>
            ) : lista.length === 0 ? (
              <p className="p-6 text-sm text-foreground-muted">Nenhum administrador cadastrado.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-[13px] text-foreground-subtle">
                  <tr>
                    <th className="px-4 py-3 font-semibold">E-mail</th>
                    <th className="px-4 py-3 font-semibold">Último acesso</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.user_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        {a.email}
                        {a.eu ? (
                          <span className="ml-2 text-[12px] text-foreground-subtle">(você)</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-foreground-subtle">
                        {a.ultimo_acesso
                          ? new Date(a.ultimo_acesso).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.eu ? null : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive"
                            disabled={removerMut.isPending}
                            onClick={() => removerMut.mutate(a.user_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remover
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-[10px] border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-foreground">Alterar minha senha</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Informe a senha atual e escolha uma nova senha com pelo menos 8 caracteres.
          </p>
          <form
            className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              trocarSenhaMut.mutate();
            }}
          >
            <Input
              type="password"
              placeholder="Senha atual"
              autoComplete="current-password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
              className="h-11"
            />
            <Input
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
              type="password"
              placeholder="Repetir nova senha"
              autoComplete="new-password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              minLength={8}
              className="h-11"
            />
            <Button type="submit" className="h-11 px-6" disabled={trocarSenhaMut.isPending}>
              {trocarSenhaMut.isPending ? "Salvando..." : "Alterar senha"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
