-- Endereços que recebem as respostas dos clientes ao e-mail do relatório (cabeçalho Reply-To).
ALTER TABLE public.configuracao_email
  ADD COLUMN IF NOT EXISTS responder_para text NOT NULL DEFAULT 'dioner.segala@cupola.com.br, kariny.martins@cupola.com.br';
