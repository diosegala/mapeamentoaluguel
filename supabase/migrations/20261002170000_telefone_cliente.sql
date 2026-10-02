-- WhatsApp do contato da imobiliária, só dígitos com DDI (ex.: 5541999998888), para abrir a conversa já com o número.
ALTER TABLE public.diagnosticos ADD COLUMN IF NOT EXISTS telefone text;
