-- Imagens geradas: metadados na tabela `generations` e arquivo no bucket privado `generations` do Storage.
-- Caminho do arquivo: <user_id>/<generation_id>.<ext>  (a política de leitura exige que a pasta seja o id do usuário).

create table if not exists public.generations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null default 'generate' check (kind in ('generate', 'edit')),
  shot_type     text,
  prompt        text,
  storage_path  text not null,
  mime_type     text not null default 'image/png',
  created_at    timestamptz not null default now()
);

create index if not exists generations_user_created_idx
  on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;

create policy generations_select_own on public.generations
  for select to authenticated
  using (user_id = auth.uid());

create policy generations_delete_own on public.generations
  for delete to authenticated
  using (user_id = auth.uid());

-- Inserção somente pelo servidor (service role), depois de gerar a imagem.
revoke insert, update on public.generations from anon, authenticated;
revoke all on public.generations from anon;

-- Bucket privado; as imagens são exibidas com URLs assinadas.
insert into storage.buckets (id, name, public)
values ('generations', 'generations', false)
on conflict (id) do nothing;

create policy generations_objects_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'generations' and (storage.foldername(name))[1] = auth.uid()::text);
