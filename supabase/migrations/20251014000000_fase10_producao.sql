-- Sorria FASE 10 — Produção / onboarding / clinic settings
-- Não reescreve migrations históricas. Campos opcionais + RLS.

alter table public.clinics
  add column if not exists trade_name text,
  add column if not exists logo_url text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended', 'closed')),
  add column if not exists slot_minutes integer not null default 30
    check (slot_minutes > 0 and slot_minutes <= 240),
  add column if not exists hours_json jsonb not null default '{}'::jsonb,
  add column if not exists feature_flags jsonb not null default
    '{"assistant_enabled": true, "portal_enabled": true}'::jsonb,
  add column if not exists onboarding_json jsonb not null default '{}'::jsonb;

comment on column public.clinics.status is
  'active | suspended | closed — clínica suspensa/fechada não usa recursos protegidos';
comment on column public.clinics.hours_json is
  'Horários de funcionamento por dia da semana (periodos HH:mm)';
comment on column public.clinics.onboarding_json is
  'Progresso de onboarding retomável por clínica';

alter table public.profiles
  add column if not exists professional_name text,
  add column if not exists cro text,
  add column if not exists cro_uf char(2),
  add column if not exists specialty text;

create table if not exists public.clinic_onboarding_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  step text not null,
  created_at timestamptz not null default now()
);

create index if not exists clinic_onboarding_events_clinic_idx
  on public.clinic_onboarding_events (clinic_id, created_at desc);

alter table public.clinic_onboarding_events enable row level security;

create policy clinic_onboarding_events_member on public.clinic_onboarding_events
  for all to authenticated
  using (public.has_permission(clinic_id, 'clinic.settings') or public.is_clinic_owner(clinic_id))
  with check (public.has_permission(clinic_id, 'clinic.settings') or public.is_clinic_owner(clinic_id));

-- Permissão de configuração da clínica (se ainda não existir)
insert into public.permissions (key, name, description, category) values
  ('clinic.settings', 'Configurar clínica', 'Editar dados, horários e onboarding da clínica', 'clinic')
on conflict (key) do nothing;

select public.grant_permissions('owner', array['clinic.settings']);

-- Índices de suporte a listas grandes (justificados)
create index if not exists patients_clinic_created_idx
  on public.patients (clinic_id, created_at desc);

create index if not exists appointments_clinic_start_idx
  on public.appointments (clinic_id, start_at);
