create table public.configuracao_email (
  id uuid primary key default gen_random_uuid(),
  envio_automatico boolean not null default true,
  assunto text not null default 'Seu diagnóstico da operação de locação está pronto, {{nome}}',
  titulo text not null default 'Olá, {{nome}}! O diagnóstico da {{imobiliaria}} está pronto.',
  corpo text not null default 'Preparamos um raio-x da sua operação de locação, com pontos fortes, gargalos e prioridades de melhoria.

Você pode ler o relatório completo e baixar o PDF pelo botão abaixo.',
  texto_botao text not null default 'Ver meu diagnóstico',
  rodape text not null default 'Este relatório foi gerado com apoio de inteligência artificial e revisado pela equipe CUPOLA.',
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.configuracao_email to authenticated;
grant all on public.configuracao_email to service_role;
alter table public.configuracao_email enable row level security;
create policy "Admins manage configuracao_email" on public.configuracao_email for all to authenticated
  using (private.has_role(auth.uid(), 'admin'::app_role)) with check (private.has_role(auth.uid(), 'admin'::app_role));
insert into public.configuracao_email default values;

create table public.envios_email (
  id uuid primary key default gen_random_uuid(),
  diagnostico_id uuid not null references public.diagnosticos(id) on delete cascade,
  relatorio_id uuid references public.relatorios(id) on delete set null,
  destinatario text not null,
  automatico boolean not null default false,
  status text not null default 'enviando',
  resend_id text,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.envios_email to authenticated;
grant all on public.envios_email to service_role;
alter table public.envios_email enable row level security;
create policy "Admins manage envios_email" on public.envios_email for all to authenticated
  using (private.has_role(auth.uid(), 'admin'::app_role)) with check (private.has_role(auth.uid(), 'admin'::app_role));
create index envios_email_diag_idx on public.envios_email(diagnostico_id, created_at desc);