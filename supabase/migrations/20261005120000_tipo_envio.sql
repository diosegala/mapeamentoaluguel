-- Tipo de cada envio: relatório ao cliente ou avisos internos (revisão pendente, erro de geração).
ALTER TABLE public.envios_email ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'relatorio';
