import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { AdminNav } from "@/components/cupola/admin-nav";
import { AlterarSenha } from "@/components/cupola/alterar-senha";
import { CampoSenha } from "@/components/cupola/campo-senha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROTULOS_PAPEL, type Papel } from "@/lib/papeis";
import { criarUsuario, listarUsuarios, removerUsuario } from "@/lib/usuarios.functions";

export const Route = createFileRoute("/_authenticated/admin_/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários | CUPOLA" },
      { name: "description", content: "Crie e gerencie os acessos ao painel da Imersão Cupola Aluguel." },
    ],
  }),
  component: Usuarios,
});

const DESCRICAO_PAPEL: Record<Papel, string> = {
  admin: "Acesso completo: relatórios, revisão, prompt, configurações e usuários.",
  cs: "Cadastra clientes, envia o link do questionário e acompanha o preenchimento. Não vê relatórios nem configurações.",
};

type Usuario = {
  user_id: string;
  papel: Papel;
  email: string;
  criado_em: string;
  ultimo_acesso: string | null;
  eu: boolean;
};

function Usuarios() {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarUsuarios);
  const criar = useServerFn(criarUsuario);
  const remover = useServerFn(removerUsuario);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>("cs");

  const { data, isLoading, error } = useQuery({ queryKey: ["usuarios"], queryFn: () => listar() });

  const criarMut = useMutation({
    mutationFn: () => criar({ data: { email, senha, papel } }),
    onSuccess: (novo) => {
      toast.success(`Acesso de ${ROTULOS_PAPEL[novo.papel]} liberado para ${novo.email}`);
      setEmail("");
      setSenha("");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar usuário."),
  });

  const removerMut = useMutation({
    mutationFn: (user_id: string) => remover({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Acesso removido.");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover."),
  });

  const lista = (data ?? []) as Usuario[];

  return (
    <main className="min-h-screen bg-background">
      <AdminNav />

      <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h1 className="titulo-marca text-[20px]">Novo usuário</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Informe o e-mail, uma senha inicial e o papel. Se a pessoa já tiver conta, a senha e o papel são atualizados. Quem
            esquecer a senha pode redefinir sozinho pela tela de login, em "Esqueci minha senha".
          </p>
          <form
            className="mt-5 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              criarMut.mutate();
            }}
          >
            <div className="grid gap-3 md:grid-cols-[2fr_1.5fr]">
              {/* Sem preenchimento automático: o navegador não deve colar aqui o e-mail e a senha de quem está logado. */}
              <Input
                id="novo-email"
                name="novo-usuario-email"
                type="email"
                autoComplete="off"
                placeholder="email@cupola.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
              <CampoSenha
                id="nova-senha-inicial"
                name="novo-usuario-senha"
                autoComplete="new-password"
                placeholder="Senha inicial (mín. 8)"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={8}
                className="h-11"
              />
            </div>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-[13px] font-semibold">Papel</legend>
              {(["cs", "admin"] as Papel[]).map((p) => (
                <label
                  key={p}
                  className={`grid cursor-pointer gap-1 rounded-2xl border p-4 transition-colors ${
                    papel === p ? "border-foreground bg-accent" : "border-border hover:border-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <input
                      type="radio"
                      name="papel"
                      value={p}
                      checked={papel === p}
                      onChange={() => setPapel(p)}
                      className="accent-foreground"
                    />
                    {ROTULOS_PAPEL[p]}
                  </span>
                  <span className="text-[13px] leading-[1.5] text-foreground-muted">{DESCRICAO_PAPEL[p]}</span>
                </label>
              ))}
            </fieldset>
            <div>
              <Button type="submit" className="h-11 px-6" disabled={criarMut.isPending}>
                {criarMut.isPending ? "Salvando..." : "Criar acesso"}
              </Button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-bold text-foreground">Usuários com acesso</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
            {isLoading ? (
              <p className="p-6 text-sm text-foreground-muted">Carregando...</p>
            ) : error ? (
              <p className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : "Erro ao carregar."}</p>
            ) : lista.length === 0 ? (
              <p className="p-6 text-sm text-foreground-muted">Nenhum usuário cadastrado.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-[13px] text-foreground-subtle">
                  <tr>
                    <th className="px-4 py-3 font-semibold">E-mail</th>
                    <th className="px-4 py-3 font-semibold">Papel</th>
                    <th className="px-4 py-3 font-semibold">Último acesso</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((u) => (
                    <tr key={u.user_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        {u.email}
                        {u.eu ? <span className="ml-2 text-[12px] text-foreground-subtle">(você)</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                            u.papel === "admin" ? "bg-foreground text-primary" : "bg-background-secondary text-foreground-muted"
                          }`}
                        >
                          {ROTULOS_PAPEL[u.papel]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground-subtle">
                        {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.eu ? null : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive"
                            disabled={removerMut.isPending}
                            onClick={() => removerMut.mutate(u.user_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remover acesso
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-2 text-[13px] text-foreground-subtle">
            Para mudar o papel de alguém, crie o acesso de novo com o mesmo e-mail e o papel desejado.
          </p>
        </section>

        <AlterarSenha />
      </div>
    </main>
  );
}
