import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function RelatorioMarkdown({ conteudo }: { conteudo: string }) {
  return (
    <div className="space-y-4 text-[15px] leading-7 text-foreground [&_h1]:mt-8 [&_h1]:text-[30px] [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:text-[22px] [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-[18px] [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-semibold [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{conteudo}</ReactMarkdown>
    </div>
  );
}

export function AvisoIa() {
  return (
    <p className="rounded-2xl border border-border bg-card p-4 text-sm text-foreground-muted">
      Este relatório foi gerado por inteligência artificial a partir das suas respostas e é um
      diagnóstico inicial.
    </p>
  );
}
