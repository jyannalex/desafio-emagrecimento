-- 0004: além das 6 cores prontas, aceita qualquer cor no formato #rrggbb.
alter table public.profiles drop constraint if exists profiles_cor_check;
alter table public.profiles add constraint profiles_cor_check
  check (cor is null or cor in ('tangerina', 'mirtilo', 'framboesa', 'menta', 'uva', 'turquesa') or cor ~ '^#[0-9a-f]{6}$');
