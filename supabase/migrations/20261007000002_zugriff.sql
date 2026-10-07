-- Aktendashboard · Zugriffsregeln
-- Lesen und Schreiben nur für angemeldete Konten, die in public.members stehen.
-- Ohne Login (Rolle anon) ist nichts erreichbar, weder Tabellen noch Dateien.

-- Hilfsfunktion: Steht das angemeldete Konto in der erlaubten Liste?
-- security definer, damit die Regeln members lesen können, ohne eigene Regel dafür.
-- Liegt im Schema private, das nicht über die API erreichbar ist.
create function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m where m.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_member() from public;
revoke all on function private.set_updated_at() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

-- Tabellenrechte: anon bekommt gar nichts, Stammdaten sind für angemeldete Konten nur lesbar.
revoke all on public.categories, public.subcategories, public.members,
              public.documents, public.document_chunks, public.cost_entries from anon;
revoke insert, update, delete on public.categories, public.subcategories, public.members from authenticated;
revoke truncate on public.categories, public.subcategories, public.members,
                   public.documents, public.document_chunks, public.cost_entries from authenticated;

alter table public.categories      enable row level security;
alter table public.subcategories   enable row level security;
alter table public.members         enable row level security;
alter table public.documents       enable row level security;
alter table public.document_chunks enable row level security;
alter table public.cost_entries    enable row level security;

create policy "Mitglieder lesen Kategorien" on public.categories
  for select to authenticated using ((select private.is_member()));

create policy "Mitglieder lesen Unterkategorien" on public.subcategories
  for select to authenticated using ((select private.is_member()));

create policy "Mitglieder sehen Mitglieder" on public.members
  for select to authenticated using ((select private.is_member()));

-- Dokumente: beide sehen und bearbeiten alles. Endgültig löschen geht nur aus dem Papierkorb.
create policy "Mitglieder lesen Dokumente" on public.documents
  for select to authenticated using ((select private.is_member()));

create policy "Mitglieder legen Dokumente an" on public.documents
  for insert to authenticated
  with check ((select private.is_member()) and owner = (select auth.uid()));

create policy "Mitglieder bearbeiten Dokumente" on public.documents
  for update to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));

create policy "Mitglieder löschen Dokumente aus dem Papierkorb" on public.documents
  for delete to authenticated
  using ((select private.is_member()) and deleted_at is not null);

create policy "Mitglieder verwalten Textabschnitte" on public.document_chunks
  for all to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));

create policy "Mitglieder verwalten Kostenposten" on public.cost_entries
  for all to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));

-- Dateispeicher: privater Bucket, max. 25 MB je Datei, nur PDF und Bilder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('akten', 'akten', false, 26214400,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

create policy "akten: Mitglieder lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'akten' and (select private.is_member()));

create policy "akten: Mitglieder laden hoch" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'akten' and (select private.is_member()));

-- Löschen nur, wenn kein aktives Dokument mehr auf die Datei zeigt
-- (Dokument liegt im Papierkorb oder wurde nie gespeichert).
create policy "akten: Mitglieder löschen" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'akten'
    and (select private.is_member())
    and not exists (
      select 1 from public.documents d
      where d.file_path = objects.name and d.deleted_at is null
    )
  );
