-- Revisão automática dos relatórios antes da publicação.
ALTER TABLE public.auditorias
  ADD COLUMN IF NOT EXISTS automatica boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS veredito text,
  ADD COLUMN IF NOT EXISTS resumo text,
  ADD COLUMN IF NOT EXISTS problemas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS correcoes_aplicadas integer NOT NULL DEFAULT 0;

-- Texto gerado antes das correções da revisão, para conferência no painel.
ALTER TABLE public.relatorios
  ADD COLUMN IF NOT EXISTS conteudo_original text;
