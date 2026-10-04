-- Sorria FASE 3 — Solicitações de horário + Agenda
-- Solicitação ≠ Consulta. Agenda administrativa ≠ Prontuário clínico.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'appointment_request_status') then
    create type public.appointment_request_status as enum (
      'new', 'under_review', 'proposed', 'approved', 'rejected', 'cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'preferred_period') then
    create type public.preferred_period as enum ('morning', 'afternoon', 'evening');
  end if;
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type public.appointment_status as enum (
      'scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'no_show', 'cancelled'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- appointment_requests
-- ---------------------------------------------------------------------------
create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,

  requested_date date,
  preferred_period public.preferred_period not null default 'morning',

  reason text not null,
  custom_reason text,
  notes text,

  status public.appointment_request_status not null default 'new',

  proposed_start_at timestamptz,
  proposed_end_at timestamptz,
  proposed_professional_id uuid references public.profiles (id) on delete set null,

  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

comment on table public.appointment_requests is
  'Solicitação de horário. Nunca vira consulta automaticamente.';

create index if not exists appointment_requests_clinic_status_idx
  on public.appointment_requests (clinic_id, status, created_at desc);
create index if not exists appointment_requests_patient_idx
  on public.appointment_requests (patient_id);

drop trigger if exists appointment_requests_set_updated_at on public.appointment_requests;
create trigger appointment_requests_set_updated_at
  before update on public.appointment_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,
  professional_id uuid not null references public.profiles (id) on delete restrict,

  appointment_request_id uuid references public.appointment_requests (id) on delete set null,

  start_at timestamptz not null,
  end_at timestamptz not null,

  reason text,
  status public.appointment_status not null default 'scheduled',

  estimated_value numeric(12, 2),
  notes text,

  created_by uuid references public.profiles (id) on delete set null,

  cancelled_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointments_time_range check (end_at > start_at)
);

comment on table public.appointments is
  'Consulta definitiva da agenda. Canceladas não bloqueiam horário.';

create index if not exists appointments_clinic_start_idx
  on public.appointments (clinic_id, start_at);
create index if not exists appointments_clinic_end_idx
  on public.appointments (clinic_id, end_at);
create index if not exists appointments_professional_start_idx
  on public.appointments (clinic_id, professional_id, start_at);
create index if not exists appointments_patient_idx
  on public.appointments (patient_id);
create index if not exists appointments_status_idx
  on public.appointments (clinic_id, status);

-- Impede overlap para mesmo profissional (exceto cancelled)
-- Usa exclusão de intervalo half-open [start, end)
create extension if not exists btree_gist;

alter table public.appointments
  drop constraint if exists appointments_no_overlap_active;

alter table public.appointments
  add constraint appointments_no_overlap_active
  exclude using gist (
    clinic_id with =,
    professional_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status <> 'cancelled');

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- appointment_status_history
-- ---------------------------------------------------------------------------
create table if not exists public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists appointment_status_history_appt_idx
  on public.appointment_status_history (appointment_id, created_at desc);
create index if not exists appointment_status_history_clinic_idx
  on public.appointment_status_history (clinic_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.appointment_requests enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_status_history enable row level security;

-- Requests
create policy "appointment_requests_select"
  on public.appointment_requests for select to authenticated
  using (
    public.is_active_clinic_member(clinic_id)
    and public.has_permission(clinic_id, 'appointment_requests.view')
  );

create policy "appointment_requests_insert"
  on public.appointment_requests for insert to authenticated
  with check (
    public.is_active_clinic_member(clinic_id)
    and public.has_permission(clinic_id, 'appointment_requests.manage')
  );

create policy "appointment_requests_update"
  on public.appointment_requests for update to authenticated
  using (
    public.is_active_clinic_member(clinic_id)
    and public.has_permission(clinic_id, 'appointment_requests.manage')
  )
  with check (
    public.is_active_clinic_member(clinic_id)
    and public.has_permission(clinic_id, 'appointment_requests.manage')
  );

create policy "appointment_requests_no_delete"
  on public.appointment_requests for delete to authenticated
  using (false);

-- Appointments
create policy "appointments_select"
  on public.appointments for select to authenticated
  using (
    public.is_active_clinic_member(clinic_id)
    and public.has_permission(clinic_id, 'appointments.view')
  );

create policy "appointments_insert"
  on public.appointments for insert to authenticated
  with check (
    public.is_active_clinic_member(clinic_id)
    and public.has_permission(clinic_id, 'appointments.create')
  );

create policy "appointments_update"
  on public.appointments for update to authenticated
  using (
    public.is_active_clinic_member(clinic_id)
    and (
      public.has_permission(clinic_id, 'appointments.update')
      or public.has_permission(clinic_id, 'appointments.cancel')
    )
  )
  with check (
    public.is_active_clinic_member(clinic_id)
  );

create policy "appointments_no_delete"
  on public.appointments for delete to authenticated
  using (false);

-- History
create policy "appointment_status_history_select"
  on public.appointment_status_history for select to authenticated
  using (
    public.is_active_clinic_member(clinic_id)
    and public.has_permission(clinic_id, 'appointments.view')
  );

create policy "appointment_status_history_insert"
  on public.appointment_status_history for insert to authenticated
  with check (
    public.is_active_clinic_member(clinic_id)
    and (
      public.has_permission(clinic_id, 'appointments.create')
      or public.has_permission(clinic_id, 'appointments.update')
      or public.has_permission(clinic_id, 'appointments.cancel')
    )
  );

create policy "appointment_status_history_no_update"
  on public.appointment_status_history for update to authenticated
  using (false);

create policy "appointment_status_history_no_delete"
  on public.appointment_status_history for delete to authenticated
  using (false);
