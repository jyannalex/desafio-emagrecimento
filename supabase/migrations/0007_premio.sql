-- 0007: prêmio do desafio (texto livre, opcional).
alter table public.challenge add column if not exists premio text check (premio is null or length(premio) <= 120);
