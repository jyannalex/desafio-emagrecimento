-- 0003: cada um escolhe a própria cor e fotos opcionais nas tarefas do dia.

-- ── Cor do participante (null = cor padrão pela ordem do id) ──
alter table public.profiles add column if not exists cor text
  check (cor is null or cor in ('tangerina', 'mirtilo', 'framboesa', 'menta', 'uva', 'turquesa'));

-- ── Fotos: o arquivo fica no Storage (bucket "fotos"); aqui só o caminho e o tamanho ──
create table if not exists public.photos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  dia        date not null,
  tarefa     text not null check (tarefa in ('cafe', 'almoco', 'lanche', 'jantar', 'atividade')),
  path       text not null unique,
  bytes      int  not null check (bytes > 0),
  created_at timestamptz not null default now(),
  unique (user_id, dia, tarefa)
);

alter table public.photos enable row level security;

create policy photos_select on public.photos for select to authenticated using (true);

-- enviar/trocar: só a própria, só em dia editável, só dentro da própria pasta
create policy photos_insert on public.photos for insert to authenticated
  with check (public.can_write_log(user_id, dia) and split_part(path, '/', 1) = auth.uid()::text);
create policy photos_update on public.photos for update to authenticated
  using (user_id = auth.uid())
  with check (public.can_write_log(user_id, dia) and split_part(path, '/', 1) = auth.uid()::text);

-- apagar: as próprias, de qualquer dia (para liberar espaço)
create policy photos_delete on public.photos for delete to authenticated using (user_id = auth.uid());

-- ── Storage: bucket privado, até 2 MB, só JPEG (o app reduz a foto antes de enviar) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy fotos_ler on storage.objects for select to authenticated
  using (bucket_id = 'fotos');
create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
