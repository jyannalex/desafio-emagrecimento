-- 0008: alimento cadastrado por unidade (kcal de 1 unidade) além de por grama (kcal em 100 g).
-- Cada alimento/item é medido de um jeito só.

alter table public.foods alter column kcal_100g drop not null;
alter table public.foods add column if not exists kcal_unidade numeric(6,1) check (kcal_unidade between 0 and 5000);
alter table public.foods add constraint foods_um_jeito_de_medir check ((kcal_100g is null) <> (kcal_unidade is null));

alter table public.meal_items alter column gramas drop not null;
alter table public.meal_items alter column kcal_100g drop not null;
alter table public.meal_items add column if not exists unidades numeric(5,1) check (unidades > 0 and unidades <= 100);
alter table public.meal_items add column if not exists kcal_unidade numeric(6,1) check (kcal_unidade between 0 and 5000);
alter table public.meal_items add constraint meal_items_um_jeito_de_medir check (
  (gramas is not null and kcal_100g is not null and unidades is null and kcal_unidade is null)
  or (gramas is null and kcal_100g is null and unidades is not null and kcal_unidade is not null)
);
