import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RelatorioCupola } from "@/components/cupola/relatorio-cupola";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { aprovarEEnviar, salvarRevisao } from "@/lib/admin.functions";
import type { NumerosDestaque } from "@/lib/indicadores-operacao";

type Versao = {
  id: string;
  versao: number;
  conteudo: string;
  conteudo_ia: string | null;
  nota_revisao: string | null;
  created_at: string;
};

/** Revisão humana de uma versão ainda não publicada: editar, salvar e aprovar o envio ao cliente. */
export function RevisaoHumana({
  diagnosticoId,
  versao,
  nome,
  local,
  numeros,
  emailCliente,
  aoConcluir,
}: {
  diagnosticoId: string;
  versao: Versao;
  nome: string;
  local: string;
  numeros: NumerosDestaque | null;
  emailCliente: string | null;
  aoConcluir: () => void;
}) {
  const salvar = useServerFn(salvarRevisao);
  const aprovar = useServerFn(aprovarEEnviar);
  const [texto, setTexto] = useState(versao.conteudo);
  const [nota, setNota] = useState(versao.nota_revisao ?? "");
  const [salvo, setSalvo] = useState({ texto: versao.conteudo, nota: versao.nota_revisao ?? "" });
  const [confirmando, setConfirmando] = useState(false);

  // Troca de versão (nova geração) recarrega o editor.
  useEffect(() => {
    setTexto(versao.conteudo);
    setNota(versao.nota_revisao ?? "");
    setSalvo({ texto: versao.conteudo, nota: versao.nota_revisao ?? "" });
    setConfirmando(false);
  }, [versao.id]);

  const alterado = texto !== salvo.texto || nota !== salvo.nota;
  const editadoPeloRevisor = versao.conteudo_ia != null && texto !== versao.conteudo_ia;
  const entrada = { id: diagnosticoId, relatorioId: versao.id, conteudo: texto, nota: nota || undefined };

  const rascunho = useMutation({
    mutationFn: () => salvar({ data: entrada }),
    onSuccess: () => {
      setSalvo({ texto, nota });
      toast.success("Rascunho salvo");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const envio = useMutation({
    mutationFn: () => aprovar({ data: entrada }),
    onSuccess: (r) => {
      if (r.enviado) toast.success(`Aprovado e enviado para ${emailCliente ?? "o cliente"}`);
      else toast.error(`Aprovado e publicado, mas o e-mail falhou: ${r.erroEnvio}. Use "Enviar por e-mail" para tentar de novo.`);
      aoConcluir();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section className="grid gap-4 rounded-2xl border-2 border-foreground bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="w-fit rounded-full bg-foreground px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-primary uppercase">
            Aguardando revisão
          </span>
          <h2 className="titulo-marca mt-2 text-[18px]">Revisar a versão {versao.versao}</h2>
          <p className="max-w-2xl text-sm text-foreground-muted">
            O cliente só recebe depois da aprovação. Edite o texto em Markdown à esquerda; à direita, a prévia mostra
            exatamente o que o cliente vai ver.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!editadoPeloRevisor || rascunho.isPending || envio.isPending}
            onClick={() => versao.conteudo_ia != null && setTexto(versao.conteudo_ia)}
          >
            Descartar edições
          </Button>
          <Button variant="outline" disabled={!alterado || rascunho.isPending || envio.isPending} onClick={() => rascunho.mutate()}>
            {rascunho.isPending ? "Salvando..." : alterado ? "Salvar rascunho" : "Rascunho salvo"}
          </Button>
          <Button disabled={envio.isPending} onClick={() => setConfirmando(true)}>
            Aprovar e enviar
          </Button>
        </div>
      </div>

      {confirmando && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-dark-background p-4 text-foreground-on-dark">
          <p className="flex-1 text-[15px]">
            Publicar a versão {versao.versao} e enviar para <strong>{emailCliente ?? "o e-mail do questionário"}</strong>?
          </p>
          <Button variant="ghost" className="text-foreground-on-dark hover:bg-white/10" onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
          <Button disabled={envio.isPending} onClick={() => envio.mutate()}>
            {envio.isPending ? "Enviando..." : "Confirmar envio"}
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid min-w-0 content-start gap-3">
          <label htmlFor="texto-revisao" className="text-[13px] font-semibold">
            Texto do relatório (Markdown)
          </label>
          <Textarea
            id="texto-revisao"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-[70vh] resize-y font-mono text-[13px] leading-[1.6]"
          />
          <label htmlFor="nota-revisao" className="text-[13px] font-semibold">
            Nota para o agente (opcional)
          </label>
          <Textarea
            id="nota-revisao"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="O que o agente deveria ter feito diferente? Ex.: não sugerir contratação quando o cliente já tem a função coberta."
          />
          <p className="text-xs text-foreground-subtle">
            As edições e a nota viram propostas de aprendizado para as próximas gerações, depois de aprovadas por um admin.
          </p>
        </div>
        <div className="min-w-0">
          <span className="text-[13px] font-semibold">Prévia, como o cliente vê</span>
          <div className="mt-3 h-[calc(70vh+11rem)] overflow-auto rounded-2xl border border-border bg-background">
            <RelatorioCupola conteudo={texto} nome={nome} local={local} geradoEm={versao.created_at} numeros={numeros} />
          </div>
        </div>
      </div>
    </section>
  );
}
