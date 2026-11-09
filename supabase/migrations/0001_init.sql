-- Desafio de Emagrecimento — schema inicial + RLS

-- "Hoje" no fuso de Brasília
create or replace function public.today_br() returns date
language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- Perfis --------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  nome          text not null,
  meta_agua_ml  int  not null default 2000 check (meta_agua_ml > 0)
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Desafio (linha única) -----------------------------------------------------
create table public.challenge (
  id           int  primary key default 1 check (id = 1),
  nome         text not null,
  data_inicio  date not null,
  data_fim     date not null,
  check (data_fim >= data_inicio)
);

-- Registros diários ---------------------------------------------------------
create table public.daily_logs (
  user_id              uuid not null references public.profiles (id) on delete cascade,
  dia                  date not null,
  cafe                 bool not null default false,
  almoco               bool not null default false,
  lanche               bool not null default false,
  jantar               bool not null default false,
  nota_cafe            text,
  nota_almoco          text,
  nota_lanche          text,
  nota_jantar          text,
  atividade            bool not null default false,
  atividade_min        int  not null default 0 check (atividade_min >= 0),
  agua_ml              int  not null default 0 check (agua_ml >= 0),
  meta_agua_ml_do_dia  int  not null check (meta_agua_ml_do_dia > 0),
  updated_at           timestamptz not null default now(),
  primary key (user_id, dia)
);

-- Pesagens -------------------------------------------------------------------
create table public.weights (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  dia      date not null,
  kg       numeric(5,2) not null check (kg > 0 and kg < 400),
  unique (user_id, dia)
);

-- RLS -----------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.challenge  enable row level security;
alter table public.daily_logs enable row level security;
alter table public.weights    enable row level security;

-- leitura: qualquer usuário logado
create policy profiles_select   on public.profiles   for select to authenticated using (true);
create policy challenge_select  on public.challenge  for select to authenticated using (true);
create policy daily_logs_select on public.daily_logs for select to authenticated using (true);
create policy weights_select    on public.weights    for select to authenticated using (true);

-- perfil: só o próprio
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- desafio: qualquer um dos dois
create policy challenge_insert on public.challenge for insert to authenticated with check (true);
create policy challenge_update on public.challenge for update to authenticated using (true) with check (true);

-- registros diários: só o próprio, só hoje/ontem, só dentro do desafio; sem delete
create or replace function public.can_write_log(p_user uuid, p_dia date) returns boolean
language sql stable as $$
  select p_user = auth.uid()
     and p_dia between public.today_br() - 1 and public.today_br()
     and exists (select 1 from public.challenge c where p_dia between c.data_inicio and c.data_fim)
$$;

create policy daily_logs_insert on public.daily_logs for insert to authenticated
  with check (public.can_write_log(user_id, dia));
create policy daily_logs_update on public.daily_logs for update to authenticated
  using (public.can_write_log(user_id, dia)) with check (public.can_write_log(user_id, dia));

-- pesos: só o próprio, qualquer data
create policy weights_insert on public.weights for insert to authenticated with check (user_id = auth.uid());
create policy weights_update on public.weights for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy weights_delete on public.weights for delete to authenticated using (user_id = auth.uid());

-- updated_at automático
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger daily_logs_touch before update on public.daily_logs
  for each row execute function public.touch_updated_at();

grant select, insert, update on public.profiles, public.challenge, public.daily_logs to authenticated;
grant select, insert, update, delete on public.weights to authenticated;
