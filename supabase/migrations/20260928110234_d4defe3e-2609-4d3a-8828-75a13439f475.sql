ALTER TABLE public.relatorios
  ADD COLUMN IF NOT EXISTS tokens_cache_criacao integer,
  ADD COLUMN IF NOT EXISTS tokens_cache_leitura integer;