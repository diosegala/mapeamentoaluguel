create extension if not exists supabase_vault with schema vault;

create or replace function public.salvar_segredo(p_nome text, p_valor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_nome;
  if v_id is null then
    perform vault.create_secret(p_valor, p_nome, 'Gerenciado pelo painel CUPOLA');
  else
    perform vault.update_secret(v_id, p_valor, p_nome);
  end if;
end;
$$;

create or replace function public.ler_segredo(p_nome text)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_nome limit 1;
$$;

revoke all on function public.salvar_segredo(text, text) from public;
revoke all on function public.salvar_segredo(text, text) from anon;
revoke all on function public.salvar_segredo(text, text) from authenticated;
revoke all on function public.ler_segredo(text) from public;
revoke all on function public.ler_segredo(text) from anon;
revoke all on function public.ler_segredo(text) from authenticated;
grant execute on function public.salvar_segredo(text, text) to service_role;
grant execute on function public.ler_segredo(text) to service_role;