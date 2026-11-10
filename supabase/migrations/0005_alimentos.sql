-- 0005: catálogo de alimentos (TACO + cadastrados) e o que foi comido em cada refeição, em gramas.
-- Calorias são só informação: nada aqui mexe em pontos.

create table if not exists public.foods (
  id          bigint generated always as identity primary key,
  nome        text not null check (length(trim(nome)) between 2 and 80),
  kcal_100g   numeric(6,1) not null check (kcal_100g between 0 and 900),
  origem      text not null check (origem in ('taco', 'custom')),
  taco_id     int unique,
  criado_por  uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  check ((origem = 'taco') = (taco_id is not null)),
  check ((origem = 'custom') = (criado_por is not null))
);

create table if not exists public.meal_items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  dia         date not null,
  refeicao    text not null check (refeicao in ('cafe', 'almoco', 'lanche', 'jantar')),
  food_id     bigint references public.foods(id) on delete set null,
  -- cópia do alimento no momento do registro: editar/apagar o alimento não muda o histórico
  nome        text not null,
  kcal_100g   numeric(6,1) not null check (kcal_100g between 0 and 900),
  gramas      numeric(6,1) not null check (gramas > 0 and gramas <= 5000),
  created_at  timestamptz not null default now()
);

create index if not exists meal_items_user_dia on public.meal_items (user_id, dia);

alter table public.foods      enable row level security;
alter table public.meal_items enable row level security;

-- alimentos: todos leem; só cadastra/edita/apaga o próprio "custom" (TACO é só leitura)
create policy foods_select on public.foods for select to authenticated using (true);
create policy foods_insert on public.foods for insert to authenticated
  with check (origem = 'custom' and criado_por = auth.uid());
create policy foods_update on public.foods for update to authenticated
  using (origem = 'custom' and criado_por = auth.uid())
  with check (origem = 'custom' and criado_por = auth.uid());
create policy foods_delete on public.foods for delete to authenticated
  using (origem = 'custom' and criado_por = auth.uid());

-- itens: todos leem; cada um mexe nos seus, nos dias em que pode editar o registro
create policy meal_items_select on public.meal_items for select to authenticated using (true);
create policy meal_items_insert on public.meal_items for insert to authenticated
  with check (public.can_write_log(user_id, dia));
create policy meal_items_update on public.meal_items for update to authenticated
  using (public.can_write_log(user_id, dia)) with check (public.can_write_log(user_id, dia));
create policy meal_items_delete on public.meal_items for delete to authenticated
  using (public.can_write_log(user_id, dia));

grant select, insert, update, delete on public.foods, public.meal_items to authenticated;
