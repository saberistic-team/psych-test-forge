alter table public.tests
  add column if not exists listed boolean not null default false,
  add column if not exists featured boolean not null default false,
  add column if not exists verified boolean not null default false,
  add column if not exists tagline text,
  add column if not exists listing_description text,
  add column if not exists listed_at timestamptz;

create index if not exists tests_listed_idx on public.tests (listed, published) where listed and published;
create index if not exists tests_featured_idx on public.tests (featured) where featured;

drop policy if exists "public reads listed tests" on public.tests;
create policy "public reads listed tests"
on public.tests
for select
to anon, authenticated
using (published = true and listed = true and deleted_at is null);

grant select on public.tests to anon;