-- Aktendashboard · Kategorien und Unterkategorien aus dem alten Aktendashboard

insert into public.categories (slug, label, color, color_light, icon, sort_order, for_documents) values
  ('versicherungen', 'Versicherungen',  '#2563EB', '#EFF6FF', 'schild',  1, true),
  ('steuer',         'Steuer',          '#16A34A', '#F0FDF4', 'beleg',   2, true),
  ('vertraege',      'Verträge',        '#EA580C', '#FFF7ED', 'vertrag', 3, true),
  ('kosten',         'Kostenübersicht', '#7C3AED', '#F5F3FF', 'euro',    4, false),
  ('sonstiges',      'Sonstiges',       '#6B7280', '#F9FAFB', 'ordner',  5, true);

insert into public.subcategories (category, label, sort_order)
select 'versicherungen', label, ord from unnest(array[
  'Krankenversicherung', 'Lebensversicherung', 'Arbeitsunfähigkeitsversicherung', 'Kfz-Versicherung',
  'Rentenversicherung', 'Haftpflichtversicherung', 'Hausratversicherung', 'Sonstige Versicherung'
]) with ordinality as t(label, ord)
union all
select 'steuer', label, ord from unnest(array[
  'Steuerbescheid', 'Steuererklärung', 'Mahnung / Erinnerung', 'Nummern & Kontakte',
  'Belege & Nachweise', 'Sonstiges Steuer'
]) with ordinality as t(label, ord)
union all
select 'vertraege', label, ord from unnest(array[
  'Mietvertrag', 'Arbeitsvertrag', 'Fitnessstudio', 'Internet & Telefon',
  'Streaming & Abos', 'Banken & Kredite', 'Sonstiger Vertrag'
]) with ordinality as t(label, ord)
union all
select 'sonstiges', label, ord from unnest(array[
  'Ausweise & Pässe', 'Zertifikate', 'Sonstiges'
]) with ordinality as t(label, ord);
