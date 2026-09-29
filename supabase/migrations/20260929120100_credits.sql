-- Reserva / confirmação / estorno de créditos (padrão reserve-commit).
--
-- Fluxo usado por /api/generate:
--   1. reserve_credit   -> debita o saldo ANTES de chamar o Gemini, de forma atômica (trava a linha do perfil).
--   2. commit_reservation -> marca a reserva como confirmada quando a imagem foi entregue.
--   3. refund_reservation -> devolve o crédito se a geração falhar (idempotente: só estorna uma vez).
--   refund_stale_reservations -> rotina de limpeza para reservas presas (ex.: o servidor caiu no meio).
--
-- reserve_credit também aplica um limite simples de requisições por usuário por minuto.

create table if not exists public.credit_reservations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      integer not null check (amount > 0),
  status      text not null default 'reserved' check (status in ('reserved', 'committed', 'refunded')),
  created_at  timestamptz not null default now(),
  settled_at  timestamptz
);

create index if not exists credit_reservations_user_created_idx
  on public.credit_reservations (user_id, created_at desc);
create index if not exists credit_reservations_open_idx
  on public.credit_reservations (created_at) where status = 'reserved';

alter table public.credit_reservations enable row level security;
-- Sem políticas: somente o service role e as funções SECURITY DEFINER acessam a tabela.
revoke all on public.credit_reservations from anon, authenticated;

create or replace function public.reserve_credit(
  p_user_id uuid,
  p_amount integer default 1,
  p_max_per_minute integer default 20
)
returns table (out_status text, out_reservation_id uuid, out_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_recent  integer;
  v_id      uuid;
begin
  if p_amount is null or p_amount < 1 then
    raise exception 'p_amount deve ser >= 1';
  end if;

  -- Trava a linha do perfil: reservas concorrentes do mesmo usuário são serializadas aqui.
  select p.credits into v_credits from public.profiles p where p.id = p_user_id for update;

  if not found then
    return query select 'no_profile'::text, null::uuid, 0;
    return;
  end if;

  select count(*) into v_recent
  from public.credit_reservations r
  where r.user_id = p_user_id and r.created_at > now() - interval '1 minute';

  if v_recent >= p_max_per_minute then
    return query select 'rate_limited'::text, null::uuid, v_credits;
    return;
  end if;

  if v_credits < p_amount then
    return query select 'insufficient'::text, null::uuid, v_credits;
    return;
  end if;

  update public.profiles p
     set credits = p.credits - p_amount, updated_at = now()
   where p.id = p_user_id
   returning p.credits into v_credits;

  insert into public.credit_reservations (user_id, amount)
  values (p_user_id, p_amount)
  returning id into v_id;

  return query select 'ok'::text, v_id, v_credits;
end;
$$;

create or replace function public.commit_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.credit_reservations r
     set status = 'committed', settled_at = now()
   where r.id = p_reservation_id and r.status = 'reserved';
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

-- Devolve o saldo após o estorno, ou NULL se a reserva não existe / já foi liquidada.
create or replace function public.refund_reservation(p_reservation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid;
  v_amount  integer;
  v_credits integer;
begin
  update public.credit_reservations r
     set status = 'refunded', settled_at = now()
   where r.id = p_reservation_id and r.status = 'reserved'
   returning r.user_id, r.amount into v_user, v_amount;

  if not found then
    return null;
  end if;

  update public.profiles p
     set credits = p.credits + v_amount, updated_at = now()
   where p.id = v_user
   returning p.credits into v_credits;

  return v_credits;
end;
$$;

-- Estorna reservas ainda abertas há mais que o intervalo informado. Retorna quantas foram estornadas.
create or replace function public.refund_stale_reservations(p_older_than interval default interval '10 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_count integer := 0;
begin
  for v_id in
    select r.id from public.credit_reservations r
    where r.status = 'reserved' and r.created_at < now() - p_older_than
  loop
    if public.refund_reservation(v_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Ajuste de cota por um administrador (ou pelo service role). p_delta pode ser negativo.
create or replace function public.admin_grant_credits(p_user_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
begin
  if not (
    coalesce(auth.role(), '') = 'service_role'
    or exists (select 1 from public.profiles a where a.id = auth.uid() and a.role = 'admin')
  ) then
    raise exception 'permissão negada: apenas administradores podem ajustar créditos';
  end if;

  update public.profiles p
     set credits = p.credits + p_delta, updated_at = now()
   where p.id = p_user_id
   returning p.credits into v_credits;

  if not found then
    raise exception 'perfil não encontrado';
  end if;
  return v_credits;
end;
$$;

-- Funções de saldo: somente o service role (servidor). O Supabase concede EXECUTE a anon/authenticated por padrão.
revoke all on function public.reserve_credit(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.commit_reservation(uuid) from public, anon, authenticated;
revoke all on function public.refund_reservation(uuid) from public, anon, authenticated;
revoke all on function public.refund_stale_reservations(interval) from public, anon, authenticated;
grant execute on function public.reserve_credit(uuid, integer, integer) to service_role;
grant execute on function public.commit_reservation(uuid) to service_role;
grant execute on function public.refund_reservation(uuid) to service_role;
grant execute on function public.refund_stale_reservations(interval) to service_role;

-- admin_grant_credits valida o papel internamente, então pode ser chamada por usuários autenticados.
revoke all on function public.admin_grant_credits(uuid, integer) from public, anon;
grant execute on function public.admin_grant_credits(uuid, integer) to authenticated, service_role;
