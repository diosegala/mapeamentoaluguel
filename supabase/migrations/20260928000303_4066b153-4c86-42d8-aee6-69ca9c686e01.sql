CREATE TABLE public.tentativas_codigo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  sucesso boolean NOT NULL DEFAULT false,
  tipo text NOT NULL DEFAULT 'codigo',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tentativas_ip ON public.tentativas_codigo (ip_hash, created_at DESC);
GRANT ALL ON public.tentativas_codigo TO service_role;
ALTER TABLE public.tentativas_codigo ENABLE ROW LEVEL SECURITY;