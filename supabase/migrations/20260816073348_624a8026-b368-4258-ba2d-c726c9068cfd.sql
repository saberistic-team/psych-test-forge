create table if not exists public.listing_events (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  kind text not null check (kind in ('impression','join')),
  created_at timestamptz not null default now()
);

create index if not exists listing_events_test_idx on public.listing_events (test_id, kind);

grant select on public.listing_events to authenticated;
grant all on public.listing_events to service_role;

alter table public.listing_events enable row level security;

drop policy if exists "creators read own listing events" on public.listing_events;
create policy "creators read own listing events"
on public.listing_events
for select
to authenticated
using (
  exists (select 1 from public.tests t where t.id = listing_events.test_id and t.creator_id = auth.uid())
  or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);