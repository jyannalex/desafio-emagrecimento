-- 0009: VAR — um participante contesta um ponto do outro; o ponto só cai se o contestado aceitar.

create table if not exists public.var_lances (
  id           bigint generated always as identity primary key,
  alvo         uuid not null references public.profiles(id) on delete cascade,  -- quem foi contestado
  autor        uuid not null references public.profiles(id) on delete cascade,  -- quem chamou o VAR
  dia          date not null,
  ponto        text not null check (ponto in ('cafe', 'almoco', 'jantar', 'atividade', 'agua')),
  motivo       text not null check (length(trim(motivo)) between 3 and 300),
  status       text not null default 'aberto' check (status in ('aberto', 'aceito', 'retirado')),
  created_at   timestamptz not null default now(),
  encerrado_em timestamptz,
  check (alvo <> autor)
);

-- um lance aberto ou aceito por ponto; retirado libera abrir de novo
create unique index if not exists var_lances_um_por_ponto on public.var_lances (alvo, dia, ponto)
  where status in ('aberto', 'aceito');

create table if not exists public.var_mensagens (
  id         bigint generated always as identity primary key,
  lance_id   bigint not null references public.var_lances(id) on delete cascade,
  autor      uuid not null references public.profiles(id) on delete cascade,
  texto      text not null check (length(trim(texto)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists var_mensagens_lance on public.var_mensagens (lance_id);

-- a pessoa fez mesmo esse ponto naquele dia?
create or replace function public.ponto_feito(p_user uuid, p_dia date, p_ponto text) returns boolean
language sql stable as $$
  select coalesce((
    select case p_ponto
      when 'cafe' then l.cafe
      when 'almoco' then l.almoco
      when 'jantar' then l.jantar
      when 'atividade' then l.atividade_min >= 60
      when 'agua' then l.agua_ml >= l.meta_agua_ml_do_dia
      else false end
    from public.daily_logs l where l.user_id = p_user and l.dia = p_dia
  ), false)
$$;

-- encerrado_em automático ao aceitar/retirar
create or replace function public.var_encerra() returns trigger
language plpgsql as $$
begin
  if new.status <> 'aberto' and old.status = 'aberto' then
    new.encerrado_em := now();
  end if;
  return new;
end;
$$;
drop trigger if exists var_lances_encerra on public.var_lances;
create trigger var_lances_encerra before update on public.var_lances for each row execute function public.var_encerra();

alter table public.var_lances    enable row level security;
alter table public.var_mensagens enable row level security;

create policy var_lances_select on public.var_lances for select to authenticated using (true);
create policy var_lances_insert on public.var_lances for insert to authenticated
  with check (
    autor = auth.uid()
    and status = 'aberto' and encerrado_em is null
    and dia <= public.today_br()
    and exists (select 1 from public.challenge c where dia between c.data_inicio and c.data_fim)
    and public.ponto_feito(alvo, dia, ponto)
  );
-- só abertos mudam; contestado aceita, quem abriu retira
create policy var_lances_update on public.var_lances for update to authenticated
  using (status = 'aberto' and auth.uid() in (alvo, autor))
  with check ((status = 'aceito' and alvo = auth.uid()) or (status = 'retirado' and autor = auth.uid()));

create policy var_mensagens_select on public.var_mensagens for select to authenticated using (true);
create policy var_mensagens_insert on public.var_mensagens for insert to authenticated
  with check (
    autor = auth.uid()
    and exists (
      select 1 from public.var_lances v
      where v.id = lance_id and v.status = 'aberto' and auth.uid() in (v.alvo, v.autor)
    )
  );

-- privilégios: no lance só o status muda; nada se apaga
revoke all on public.var_lances, public.var_mensagens from anon, authenticated;
grant select, insert on public.var_lances, public.var_mensagens to authenticated;
grant update (status) on public.var_lances to authenticated;
grant select on public.var_lances, public.var_mensagens to anon;
