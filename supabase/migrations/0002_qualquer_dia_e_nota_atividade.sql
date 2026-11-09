-- 0002: libera editar qualquer dia do desafio até hoje e adiciona a nota da atividade.

-- Antes: só hoje e ontem. Agora: qualquer dia entre o início do desafio e hoje (nunca o futuro).
create or replace function public.can_write_log(p_user uuid, p_dia date) returns boolean
language sql stable as $$
  select p_user = auth.uid()
     and p_dia <= public.today_br()
     and exists (select 1 from public.challenge c where p_dia between c.data_inicio and c.data_fim)
$$;

-- O que foi feito na atividade física (ex.: caminhada, musculação).
alter table public.daily_logs add column if not exists nota_atividade text;
