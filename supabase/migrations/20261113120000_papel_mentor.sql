-- Papel de Mentor: lê os diagnósticos publicados e a leitura de mercado, sem editar, gerar ou enviar nada.
-- As leituras passam pelas funções do servidor, que conferem o papel; as políticas RLS continuam só para admin.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mentor';
