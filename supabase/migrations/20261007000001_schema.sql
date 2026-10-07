-- Aktendashboard · Grundschema
-- Tabellen für Kategorien, Mitglieder, Dokumente, Textabschnitte und Kostenposten.
-- Die Zugriffsregeln stehen in der nächsten Migration (…_zugriff.sql).

create schema if not exists private;

-- Kategorien mit Farben, wie im alten Aktendashboard.
-- „kosten“ ist nur eine Ansicht mit eigener Farbe, keine Kategorie für Dokumente.
create table public.categories (
  slug          text primary key,
  label         text not null,
  color         text not null,
  color_light   text not null,
  icon          text,
  sort_order    int not null default 0,
  for_documents boolean not null default true
);

create table public.subcategories (
  id         bigint generated always as identity primary key,
  category   text not null references public.categories (slug) on update cascade on delete cascade,
  label      text not null,
  sort_order int not null default 0,
  unique (category, label)
);

-- Erlaubte Konten. Nur wer hier steht, sieht Daten – auch wenn er angemeldet ist.
create table public.members (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null unique,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null default auth.uid() references auth.users (id),  -- wer hochgeladen hat
  title          text not null check (length(trim(title)) > 0),
  file_path      text not null unique,                    -- Pfad im Bucket „akten“: {id}/{dateiname}
  file_name      text not null,                           -- Originalname beim Hochladen
  file_type      text,
  file_size      integer,
  category       text not null references public.categories (slug) on update cascade,
  subcategory    text,
  sender         text,                                    -- Absender, z. B. Finanzamt Hamburg-Nord
  document_date  date,                                    -- Datum des Schreibens
  reference      text,                                    -- Aktenzeichen, Kundennummer, Steuernummer
  summary        text,
  fulltext       text,                                    -- von Claude extrahierter Volltext (Phase 2)
  tags           text[] not null default '{}',
  amount         numeric(12, 2),
  currency       text not null default 'EUR',
  cost_interval  text check (cost_interval in ('einmalig', 'monatlich', 'quartalsweise', 'halbjährlich', 'jährlich')),
  due_date       date,
  end_date       date,
  billing_day    smallint check (billing_day between 1 and 31),
  notes          text,
  flagged        boolean not null default false,
  ai_confidence  numeric(3, 2) check (ai_confidence between 0 and 1),
  ai_model       text,                                    -- welches Modell analysiert hat
  status         text not null default 'neu' check (status in ('neu', 'geprüft', 'erledigt')),
  deleted_at     timestamptz,                             -- Papierkorb statt hartem Löschen
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('german', coalesce(title, '') || ' ' || coalesce(sender, '') || ' ' || coalesce(reference, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(fulltext, '') || ' ' || coalesce(notes, '')), 'C')
  ) stored
);

create index documents_search_idx   on public.documents using gin (search);
create index documents_list_idx     on public.documents (created_at desc) where deleted_at is null;
create index documents_due_idx      on public.documents (due_date) where deleted_at is null and due_date is not null;
create index documents_category_idx on public.documents (category);
create index documents_owner_idx    on public.documents (owner);

-- Textabschnitte für Rückfragen an Claude (Phase 4), angelegt von der Analyse (Phase 2)
create table public.document_chunks (
  id          bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  position    int not null,
  content     text not null,
  search      tsvector generated always as (to_tsvector('german', content)) stored,
  unique (document_id, position)
);

create index document_chunks_search_idx on public.document_chunks using gin (search);

-- Kostenposten, auch ohne Dokument (Phase 3)
create table public.cost_entries (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references public.documents (id) on delete set null,
  label         text not null,
  amount        numeric(12, 2) not null,
  currency      text not null default 'EUR',
  cost_interval text not null check (cost_interval in ('einmalig', 'monatlich', 'quartalsweise', 'halbjährlich', 'jährlich')),
  category      text not null references public.categories (slug) on update cascade,
  subcategory   text,
  start_date    date,
  end_date      date,
  next_due      date,
  notes         text,
  created_by    uuid default auth.uid() references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index cost_entries_document_idx   on public.cost_entries (document_id);
create index cost_entries_category_idx   on public.cost_entries (category);
create index cost_entries_created_by_idx on public.cost_entries (created_by);

-- updated_at bei jeder Änderung nachziehen
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function private.set_updated_at();

create trigger cost_entries_set_updated_at
  before update on public.cost_entries
  for each row execute function private.set_updated_at();
