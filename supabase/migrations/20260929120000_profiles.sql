-- Perfis de usuário e cota de créditos.
-- Cada usuário (auth.users) tem um perfil com saldo de créditos (1 crédito = 1 imagem gerada).
-- O saldo só é alterado por funções SECURITY DEFINER (ver migração de créditos) ou pelo service role;
-- clientes autenticados têm apenas leitura do próprio perfil.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  credits     integer not null default 0 check (credits >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Perfil do usuário com a cota de créditos de geração.';
comment on column public.profiles.role is 'admin pode ajustar créditos de outros usuários via admin_grant_credits.';

alter table public.profiles enable row level security;

-- Leitura: somente o próprio perfil.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- Nenhuma política de INSERT/UPDATE/DELETE para clientes: impede que o usuário altere o próprio saldo ou papel.
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke all on public.profiles from anon;

-- Cria o perfil automaticamente quando um usuário é criado no Supabase Auth.
-- Saldo inicial: 3 créditos (mesmo valor de cortesia usado pelo código original). Ajuste conforme a política da empresa.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, credits)
  values (new.id, new.email, 3)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfis para usuários que já existiam antes desta migração.
insert into public.profiles (id, email, credits)
select u.id, u.email, 3
from auth.users u
on conflict (id) do nothing;
