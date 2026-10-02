// Fila de geração: o pg_cron do Supabase chama esta rota a cada minuto enquanto houver
// relatório pendente. Gerar aqui, e não na página do cliente, permite que ele feche a aba.
import { createFileRoute } from "@tanstack/react-router";

/** Comparação em tempo constante, para o token não vazar por diferença de tempo de resposta. */
function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

export const Route = createFileRoute("/api/fila-relatorios")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.rpc("ler_segredo" as never, { p_nome: "FILA_TOKEN" } as never);
        const esperado = (data as string | null) ?? "";
        const recebido = request.headers.get("x-fila-token") ?? "";
        if (!esperado || !iguais(recebido, esperado)) return new Response("Não autorizado.", { status: 401 });

        const { executarRelatorio, proximoDaFila } = await import("@/lib/gerar-relatorio.server");
        const id = await proximoDaFila();
        if (!id) return Response.json({ processado: null });
        await executarRelatorio(id);
        return Response.json({ processado: id });
      },
    },
  },
});
