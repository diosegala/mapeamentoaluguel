ALTER TABLE public.base_conhecimento
  ADD COLUMN IF NOT EXISTS resumo_ia text,
  ADD COLUMN IF NOT EXISTS insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS temas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS caracteres integer,
  ADD COLUMN IF NOT EXISTS trecho text,
  ADD COLUMN IF NOT EXISTS analisado_em timestamp with time zone;