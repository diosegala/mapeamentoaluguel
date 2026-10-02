-- Papel de Atendimento (CS): cadastra clientes, envia links e acompanha o preenchimento, sem acesso ao restante do painel.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cs';
