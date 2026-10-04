-- Sorria FASE 0 — fundação
-- Tabelas: clinics, profiles, clinic_members
-- RLS inicial + helpers de membership

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'clinic_role') then
    create type public.clinic_role as enum ('owner', 'dentist', 'secretary', 'staff');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Clinics (dado configurável da conta — não faz parte da marca Sorria)
-- ---------------------------------------------------------------------------
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  timezone text not null default 'America/Sao_Paulo',
  phone text,
  email text,
  address_line text,
  city text,
  state text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clinics is
  'Clínicas usuárias do Sorria. O nome da clínica é dado configurável, não identidade do produto.';

-- ---------------------------------------------------------------------------
-- Profiles (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de usuário vinculado ao Supabase Auth.';

-- ---------------------------------------------------------------------------
-- Clinic members (multi-clínica desde o início)
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.clinic_role not null default 'staff',
  is_active boolean not null default true,
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create index if not exists clinic_members_user_id_idx on public.clinic_members (user_id);
create index if not exists clinic_members_clinic_id_idx on public.clinic_members (clinic_id);

comment on table public.clinic_members is
  'Vínculo usuário ↔ clínica com papel. Toda entidade futura deve respeitar clinic_id.';

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clinics_set_updated_at on public.clinics;
create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists clinic_members_set_updated_at on public.clinic_members;
create trigger clinic_members_set_updated_at
  before update on public.clinic_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer para evitar recursão de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_clinic_member(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_members cm
    where cm.clinic_id = p_clinic_id
      and cm.user_id = auth.uid()
      and cm.is_active = true
  );
$$;

create or replace function public.is_clinic_owner(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_members cm
    where cm.clinic_id = p_clinic_id
      and cm.user_id = auth.uid()
      and cm.role = 'owner'
      and cm.is_active = true
  );
$$;

create or replace function public.user_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.clinic_id
  from public.clinic_members cm
  where cm.user_id = auth.uid()
    and cm.is_active = true;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.clinic_members enable row level security;

-- Profiles
drop policy if exists "profiles_select_own_or_same_clinic" on public.profiles;
create policy "profiles_select_own_or_same_clinic"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.clinic_members me
      join public.clinic_members other
        on other.clinic_id = me.clinic_id
      where me.user_id = auth.uid()
        and me.is_active = true
        and other.user_id = profiles.id
        and other.is_active = true
    )
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- Clinics
drop policy if exists "clinics_select_member" on public.clinics;
create policy "clinics_select_member"
  on public.clinics
  for select
  to authenticated
  using (public.is_clinic_member(id));

drop policy if exists "clinics_update_owner" on public.clinics;
create policy "clinics_update_owner"
  on public.clinics
  for update
  to authenticated
  using (public.is_clinic_owner(id))
  with check (public.is_clinic_owner(id));

drop policy if exists "clinics_insert_authenticated" on public.clinics;
create policy "clinics_insert_authenticated"
  on public.clinics
  for insert
  to authenticated
  with check (auth.uid() is not null);

-- Clinic members
drop policy if exists "clinic_members_select_same_clinic" on public.clinic_members;
create policy "clinic_members_select_same_clinic"
  on public.clinic_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_clinic_member(clinic_id)
  );

drop policy if exists "clinic_members_insert_owner" on public.clinic_members;
create policy "clinic_members_insert_owner"
  on public.clinic_members
  for insert
  to authenticated
  with check (
    public.is_clinic_owner(clinic_id)
    or (
      user_id = auth.uid()
      and role = 'owner'
      and not exists (
        select 1 from public.clinic_members existing
        where existing.clinic_id = clinic_members.clinic_id
      )
    )
  );

drop policy if exists "clinic_members_update_owner" on public.clinic_members;
create policy "clinic_members_update_owner"
  on public.clinic_members
  for update
  to authenticated
  using (public.is_clinic_owner(clinic_id))
  with check (public.is_clinic_owner(clinic_id));

drop policy if exists "clinic_members_delete_owner" on public.clinic_members;
create policy "clinic_members_delete_owner"
  on public.clinic_members
  for delete
  to authenticated
  using (public.is_clinic_owner(clinic_id));

-- ---------------------------------------------------------------------------
-- Seed demo clinic (fictícia — multi-clínica)
-- ---------------------------------------------------------------------------
insert into public.clinics (id, name, slug, timezone, city, state)
values (
  '11111111-1111-1111-1111-111111111111',
  'Clínica Demo Sorria',
  'clinica-demo-sorria',
  'America/Sao_Paulo',
  'São Paulo',
  'SP'
)
on conflict (id) do nothing;
