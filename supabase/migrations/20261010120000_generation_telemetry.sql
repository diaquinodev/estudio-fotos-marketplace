-- Adiciona colunas opcionais de telemetria na tabela generations
-- Permite auditar custo em USD, provedor de IA e modelo utilizado por geração

alter table public.generations
  add column if not exists cost_usd numeric(10, 6),
  add column if not exists provider text,
  add column if not exists model text;
